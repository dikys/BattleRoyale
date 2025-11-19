import { ACommandArgs, BattleController, DrawLayer, Stride_Color, StringVisualEffect, Unit, UnitCommand, UnitCommandConfig, UnitConfig } from "library/game-logic/horde-types";
import { GameField } from "../Core/GameField";
import { GameSettlement } from "../Core/GameSettlement";
import { BuildingTemplate } from "../Units/IFactory";
import { HordeColor, ResourcesAmount } from "library/common/primitives";
import { Cell } from "../Core/Cell";
import { spawnString } from "library/game-logic/decoration-spawn";
import { IUnitCaster } from "./IUnitCaster";
import { log } from "library/common/logging";
import { printObjectItems } from "library/common/introspection";

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
    protected static _ProcessingModule : number = 25;
    protected static _ProcessingTack   : number = 0;

    protected static _ButtonUidPrefix               : string = "#BattleRoyale_";
    protected static _ButtonUid                     : string = "Spell_CustomCommand";
    /// \todo вернуть после исправления
    protected static _ButtonCommandTypeBySlot       : Array<UnitCommand> = [UnitCommand.OneClick_Custom_0, UnitCommand.OneClick_Custom_1, UnitCommand.OneClick_Custom_2, UnitCommand.OneClick_Custom_3];
    //protected static _ButtonCommandTypeBySlot       : Array<UnitCommand> = [UnitCommand.HoldPosition, UnitCommand.HoldPosition, UnitCommand.HoldPosition, UnitCommand.HoldPosition]
    protected static _ButtonCommandBaseUid          : string = "#UnitCommandConfig_HoldPosition";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_View";
    protected static _ButtonPositionBySlot          : Array<Cell> = [new Cell(0, 0), new Cell(0, 1), new Cell(1, 0), new Cell(1, 1)];
    protected static _ButtonHotkeyBySlot            : Array<string> = ["Q", "W", "E", "R"];
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(255, 255, 255, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 255, 255, 255);
    protected static _ReloadTime                    : number = 50*60;
    protected static _ChargesReloadTime             : number = 50;
    protected static _ChargesCount                  : number = 1;
    protected static _Name                          : string = "Способность";
    protected static _Description                   : string = "";
    protected static _UnitCost                      : ResourcesAmount = new ResourcesAmount(0, 0, 0, 0);

    /**
     * @method GetCommandConfig
     * @description Создает или возвращает конфигурацию команды для кнопки заклинания в UI.
     * @static
     * @param {number} slotNum - Номер слота для заклинания.
     * @returns {UnitCommandConfig} - Конфигурация команды.
     */
    public static GetCommandConfig(slotNum: number) : UnitCommandConfig {
        var customCommandCfgUid = this._ButtonUidPrefix + this._ButtonUid + "_" + slotNum;
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
            ScriptUtils.SetValue(customCommand, "UnitCommand", this._ButtonCommandTypeBySlot[slotNum]);
            ScriptUtils.SetValue(customCommand, "Hotkey", this._ButtonHotkeyBySlot[slotNum]);
            ScriptUtils.SetValue(customCommand, "ShowButton", true);
            ScriptUtils.SetValue(customCommand, "PreferredPosition", this._ButtonPositionBySlot[slotNum]);
            ScriptUtils.SetValue(customCommand, "AutomaticMode", null);
            // Установка анимации выполняетс чуть другим способом:
            ScriptUtils.GetValue(customCommand, "AnimationsCatalogRef")
                .SetConfig(HordeContentApi.GetAnimationCatalog(this._ButtonAnimationsCatalogUid));
        }

        return customCommand;
    } // </GetCommandConfig>

    /**
     * @method GetUnitConfig
     * @description Создает или возвращает конфигурацию "юнита" для представления заклинания (например, в меню производства).
     * @static
     * @returns {UnitConfig} - Конфигурация юнита.
     */
    public static GetUnitConfig() {
        var unitConfigCfgUid = this._ButtonUidPrefix + this._ButtonUid + "_UnitCfg";
        var unitConfig : UnitConfig;
        if (HordeContentApi.HasUnitConfig(unitConfigCfgUid)) {
            unitConfig = HordeContentApi.GetUnitConfig(unitConfigCfgUid);
        } else {
            unitConfig = HordeContentApi.CloneConfig(HordeContentApi.GetUnitConfig("#UnitConfig_Barbarian_Swordmen"), unitConfigCfgUid) as UnitConfig;
            ScriptUtils.SetValue(unitConfig, "Name", this._Name);
            ScriptUtils.SetValue(unitConfig, "Description", this._Description);
            ScriptUtils.GetValue(unitConfig, "PortraitCatalogRef").SetConfig(HordeContentApi.GetAnimationCatalog(this._ButtonAnimationsCatalogUid));
            ScriptUtils.SetValue(unitConfig.CostResources, "Gold",   this._UnitCost.Gold);
            ScriptUtils.SetValue(unitConfig.CostResources, "Metal",  this._UnitCost.Metal);
            ScriptUtils.SetValue(unitConfig.CostResources, "Lumber", this._UnitCost.Lumber);
            ScriptUtils.SetValue(unitConfig.CostResources, "People", this._UnitCost.People);
        }

        return unitConfig;
    } // </GetUnitConfig>

    /**
     * @method GetName
     * @description Возвращает имя заклинания.
     * @static
     * @returns {string} - Имя заклинания.
     */
    public static GetName() : string {
        return this._Name;
    } // </GetName>

    /**
     * @method GetDescription
     * @description Возвращает описание заклинания.
     * @static
     * @returns {string} - Описание заклинания.
     */
    public static GetDescription() : string {
        return this._Description;
    } // </GetDescription>

    /**
     * @method GetUid
     * @description Возвращает уникальный идентификатор (UID) заклинания.
     * @static
     * @returns {string} - UID заклинания.
     */
    public static GetUid() : string {
        return this._ButtonUidPrefix + this._ButtonUid;
    } // </GetUid>

    public level : number;

    protected _caster                 : IUnitCaster;
    protected _state                  : SpellState;
    protected _chargesCount           : number;
    protected _charges                : number;
    // @ts-expect-error
    protected _activatedTick          : number;
    // @ts-expect-error
    protected _activatedArgs          : ACommandArgs;
    // @ts-expect-error
    protected _activatedEffect        : StringVisualEffect;
    // @ts-expect-error
    protected _reloadTick             : number;
    // @ts-expect-error
    protected _chargesReloadTick      : number;
    private   _processingTack         : number;
    private   _slotNum                : number;

    /**
     * @constructor
     * @param {IUnitCaster} caster - Юнит, который будет использовать это заклинание.
     */
    constructor(caster: IUnitCaster) {
        // @ts-expect-error
        this._processingTack = this.constructor["_ProcessingTack"]++ % this.constructor["_ProcessingModule"];
        this._caster               = caster;
        this._state                = SpellState.READY;
        // @ts-expect-error
        this._chargesCount         = this.constructor["_ChargesCount"];
        this._charges              = this._chargesCount;
        this.level                 = 1;

        // ищем свободный слот
        var casterSpells = this._caster.Spells();
        for (this._slotNum = 0; this._slotNum < 4; this._slotNum++) {
            if (casterSpells.findIndex(spell => spell._slotNum == this._slotNum) == -1) {
                break;
            }
        }

        this._caster.hordeUnit.CommandsMind.AddCommand(this.GetUnitCommand(), this.GetCommandConfig());
    } // </constructor>

    /**
     * @method OnReplacedCaster
     * @description Вызывается при замене юнита-кастера (например, при повышении скорпиона до героя).
     * @param {IUnitCaster} caster - Новый юнит-кастер.
     */
    public OnReplacedCaster(caster: IUnitCaster) {
        this._caster = caster;

        if (this._state != SpellState.RELOAD) {
            this._caster.hordeUnit.CommandsMind.AddCommand(this.GetUnitCommand(), this.GetCommandConfig());
        }
    } // </OnReplacedCaster>

    /**
     * @method GetUnitCommand
     * @description Возвращает тип команды, связанный с этим заклинанием.
     * @returns {UnitCommand} - Тип команды.
     */
    public GetUnitCommand() : UnitCommand {
        // @ts-expect-error
        return this.constructor["_ButtonCommandTypeBySlot"][this._slotNum];
    } // </GetUnitCommand>

    /**
     * @method GetCommandConfig
     * @description Возвращает конфигурацию команды для этого экземпляра заклинания.
     * @returns {UnitCommandConfig} - Конфигурация команды.
     */
    public GetCommandConfig() : UnitCommandConfig {
        // @ts-expect-error
        return this.constructor["GetCommandConfig"](this._slotNum);
    } // </GetCommandConfig>

    /**
     * @method GetUid
     * @description Возвращает UID этого экземпляра заклинания.
     * @returns {string} - UID.
     */
    public GetUid() : string {
        // @ts-expect-error
        return this.constructor["GetUid"]();
    } // </GetUid>

    /**
     * @method GetState
     * @description Возвращает текущее состояние заклинания.
     * @returns {SpellState} - Состояние (READY, ACTIVATED, RELOAD, etc.).
     */
    public GetState() : SpellState {
        return this._state;
    } // </GetState>

    /**
     * @method Activate
     * @description Активирует заклинание, если оно готово.
     * @param {ACommandArgs} activateArgs - Аргументы команды активации.
     * @returns {boolean} - true, если активация прошла успешно, иначе false.
     */
    public Activate(activateArgs: ACommandArgs) : boolean {
        if (this._state == SpellState.READY) {
            this._state             = SpellState.ACTIVATED;
            this._activatedTick     = Battle.GameTimer.GameFramesCounter;
            this._activatedArgs     = activateArgs;

            // @ts-expect-error
            this._activatedEffect   = spawnString(ActiveScena, this.constructor['_Name'],
                Cell.ConvertHordePoint(this._caster.hordeUnit.Cell)
                // @ts-expect-error
                .Scale(32).Add(new Cell(-2.5*this.constructor['_Name'].length, 0)).Round().ToHordePoint(), 150);
            this._activatedEffect.Height    = 18;
            // @ts-expect-error
            this._activatedEffect.Color     = this.constructor['_EffectHordeColor'];
            this._activatedEffect.DrawLayer = DrawLayer.Birds;

            return true;
        } else {
            return false;
        }
    } // </Activate>

    /**
     * @method OnEveryTick
     * @description Вызывается на каждом тике, управляет жизненным циклом заклинания (перезарядка, активация).
     * @param {number} gameTickNum - Текущий тик игры.
     * @returns {boolean} - true, если заклинание было обработано в этот тик.
     */
    public OnEveryTick(gameTickNum: number): boolean {
        // @ts-expect-error
        if (gameTickNum % this.constructor["_ProcessingModule"] != this._processingTack) {
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
                        // @ts-expect-error
                        this._reloadTick = gameTickNum + this.constructor["_ReloadTime"];
                        this._caster.hordeUnit.CommandsMind.RemoveAddedCommand(this.GetUnitCommand());
                    } else {
                        this._state = SpellState.RELOAD_CHARGE;
                        // @ts-expect-error
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
                    this._state   = SpellState.READY;
                    this._charges = this._chargesCount;
                    this._caster.hordeUnit.CommandsMind.AddCommand(this.GetUnitCommand(), this.GetCommandConfig());
                }
                break;
        }

        return true;
    } // </OnEveryTick>

    /**
     * @method LevelUp
     * @description Повышает уровень заклинания, увеличивая количество зарядов.
     */
    public LevelUp() {
        this.level++;

        // @ts-expect-error
        this._chargesCount += this.constructor["_ChargesCount"];;
        // @ts-expect-error
        this._charges      += this.constructor["_ChargesCount"];;
    } // </LevelUp>

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