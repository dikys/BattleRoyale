import { ACommandArgs, BattleController, DrawLayer, Stride_Color, StringVisualEffect, UnitCommand, UnitCommandConfig } from "library/game-logic/horde-types";
import { GameField } from "../Core/GameField";
import { GameSettlement } from "../Core/GameSettlement";
import { BuildingTemplate } from "../Units/IFactory";
import { HordeColor } from "library/common/primitives";
import { Cell } from "../Core/Cell";
import { spawnString } from "library/game-logic/decoration-spawn";
import { IUnitCaster } from "./IUnitCaster";
import { log } from "library/common/logging";

export enum SpellState {
    READY,
    ACTIVATED,
    RELOAD_CHARGE,
    RELOAD
}

export class SpellGlobalRef {
    public static BuildingsTemplate: Array<BuildingTemplate>;
    public static NeutralSettlement: GameSettlement;
    public static EnemySettlement: GameSettlement;
    public static GameField: GameField;
}

export class ISpell {
    private static _ProcessingPeriod        : number = 25;
    private static _ProcessingModuleTick    : number = 0;

    protected static _ButtonUidPrefix               : string = "#BattleRoyale_";
    protected static _ButtonUid                     : string = "Spell_CustomCommand";
    protected static _ButtonCommandType             : UnitCommand = UnitCommand.HoldPosition;
    protected static _ButtonCommandBaseUid          : string = "#UnitCommandConfig_HoldPosition";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_View";
    protected static _ButtonPosition                : Cell   = new Cell(1, 1);
    protected static _ButtonHotkey                  : string = "Q";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(255, 255, 255, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 255, 255, 255);
    protected static _ReloadTime                    : number = 50*60;
    protected static _ChargesReloadTime             : number = 50;
    protected static _ChargesCount                  : number = 1;
    protected static _Name                          : string = "Способность";
    protected static _Description                   : string = "";

    public static GetCommandConfig() : UnitCommandConfig {
        var customCommandCfgUid = this._ButtonUidPrefix + this._ButtonUid;
        var customCommand : UnitCommandConfig;
        if (HordeContentApi.HasUnitCommand(customCommandCfgUid)) {
            customCommand = HordeContentApi.GetUnitCommand(customCommandCfgUid);
        } else {
            if (this._ChargesCount > 1) {
                this._Description += "Количество зарядов: " + this._ChargesCount
                    + " (перезарядка " + this._ChargesReloadTime / 50 + " сек). ";
            }
            this._Description += " Перезарядка способности " + this._ReloadTime / 50 + " сек. ";
            log.info(this._Description);

            customCommand = HordeContentApi.CloneConfig(
                HordeContentApi.GetUnitCommand(this._ButtonCommandBaseUid), customCommandCfgUid) as UnitCommandConfig;
            // Настройка
            ScriptUtils.SetValue(customCommand, "Name", this._Name);
            ScriptUtils.SetValue(customCommand, "Tip", this._Description);  // Это будет отображаться при наведении курсора
            //ScriptUtils.SetValue(customCommand, "UnitCommand", CUSTOM_COMMAND_ID);
            ScriptUtils.SetValue(customCommand, "Hotkey", this._ButtonHotkey);
            ScriptUtils.SetValue(customCommand, "ShowButton", true);
            ScriptUtils.SetValue(customCommand, "PreferredPosition", this._ButtonPosition);
            ScriptUtils.SetValue(customCommand, "AutomaticMode", null);
            // Установка анимации выполняетс чуть другим способом:
            ScriptUtils.GetValue(customCommand, "AnimationsCatalogRef")
                .SetConfig(HordeContentApi.GetAnimationCatalog(this._ButtonAnimationsCatalogUid));
        }

        return customCommand;
    }

    public static GetName() : string {
        return this._Name;
    }

    public static GetDescription() : string {
        return this._Description;
    }

    protected _caster                 : IUnitCaster;
    protected _state                  : SpellState;
    protected _charges                : number;
    protected _activatedTick          : number;
    protected _activatedArgs          : ACommandArgs;
    protected _activatedEffect        : StringVisualEffect;
    protected _reloadTick             : number;
    protected _chargesReloadTick      : number;
    private   _processingModuleTick   : number;

    constructor(caster: IUnitCaster) {
        this._processingModuleTick = ISpell._ProcessingModuleTick++ % ISpell._ProcessingPeriod;
        this._caster               = caster;
        this._state                = SpellState.READY;
        this._charges              = this.constructor["_ChargesCount"];
        this._caster.hordeUnit.CommandsMind.AddCommand(this.GetUnitCommand(), this.GetCommandConfig());
    }

    public OnReplacedCaster(caster: IUnitCaster) {
        this._caster = caster;

        if (this._state != SpellState.RELOAD) {
            this._caster.hordeUnit.CommandsMind.AddCommand(this.GetUnitCommand(), this.GetCommandConfig());
        }
    }

    public GetUnitCommand() : UnitCommand {
        return this.constructor["_ButtonCommandType"];
    }

    public GetCommandConfig() : UnitCommandConfig {
        return this.constructor["GetCommandConfig"]();
    }

    public Activate(activateArgs: ACommandArgs) : boolean {
        if (this._state == SpellState.READY) {
            this._state             = SpellState.ACTIVATED;
            this._activatedTick     = BattleController.GameTimer.GameFramesCounter;
            this._activatedArgs     = activateArgs;

            this._activatedEffect   = spawnString(ActiveScena, this.constructor['_Name'],
                Cell.ConvertHordePoint(this._caster.hordeUnit.Cell)
                .Scale(32).Add(new Cell(-2.5*this.constructor['_Name'].length, 0)).Round().ToHordePoint(), 150);
            this._activatedEffect.Height    = 18;
            this._activatedEffect.Color     = this.constructor['_EffectHordeColor'];
            this._activatedEffect.DrawLayer = DrawLayer.Birds;

            return true;
        } else {
            return false;
        }
    }

    public OnEveryTick(gameTickNum: number): boolean {
        if (gameTickNum % ISpell._ProcessingPeriod != this._processingModuleTick) {
            return false;
        }

        switch (this._state) {
            case SpellState.READY:
                if (!this._OnEveryTickReady(gameTickNum)) {
                    this._state = SpellState.ACTIVATED;
                }
                break;
            case SpellState.ACTIVATED:
                if (!this._OnEveryTickActivated(gameTickNum)) {
                    this._charges--;
                    if (this._charges == 0) {
                        this._state = SpellState.RELOAD;
                        this._reloadTick = gameTickNum + this.constructor["_ReloadTime"];
                        this._caster.hordeUnit.CommandsMind.RemoveAddedCommand(this.GetUnitCommand());
                    } else {
                        this._state = SpellState.RELOAD_CHARGE;
                        this._chargesReloadTick = gameTickNum + this.constructor["_ChargesReloadTime"];
                    }
                }
                break;
            case SpellState.RELOAD_CHARGE:
                if (!this._OnEveryTickReloadCharge(gameTickNum)) {
                    this._state = SpellState.READY;
                }
                break;
            case SpellState.RELOAD:
                if (!this._OnEveryTickReload(gameTickNum)) {
                    this._state = SpellState.READY;
                    this._charges = this.constructor["_ChargesCount"];
                    this._caster.hordeUnit.CommandsMind.AddCommand(this.GetUnitCommand(), this.GetCommandConfig());
                }
                break;
        }

        return true;
    }

    protected _OnEveryTickReady(gameTickNum: number) {
        return true;
    }

    protected _OnEveryTickActivated(gameTickNum: number) {
        return true;
    }

    protected _OnEveryTickReloadCharge(gameTickNum: number) {
        return gameTickNum < this._chargesReloadTick;
    }

    protected _OnEveryTickReload(gameTickNum: number) {
        return gameTickNum < this._reloadTick;
    }
}