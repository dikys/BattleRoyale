import {
    ACommandArgs,
    DiplomacyStatus,
    DrawLayer, Settlement,
    Stride_Color,
    StringVisualEffect,
    Unit,
    UnitCommand,
    UnitCommandConfig,
    UnitConfig,
    UnitHurtType
} from "library/game-logic/horde-types";
import { HordeColor, ResourcesAmount } from "library/common/primitives";
import { spawnString } from "library/game-logic/decoration-spawn";
import { IUnitCaster } from "./IUnitCaster";
import { log } from "library/common/logging";
import {Cell} from "../Core/Cell";
import {formatStringStrict} from "../Core/Utils";
import {GameField} from "../Core/GameField";
import {GameSettlement} from "../Core/GameSettlement";
import {BuildingTemplate} from "../Units/IFactory";

export enum SpellState {
    READY,
    ACTIVATED,
    ACTIVATED_DELAY,
    WAIT_CHARGE,
    WAIT_DELETE
}

export class SpellRefData {
    public static diplomacyTable : Array<Array<DiplomacyStatus>>;
    public static scenaWidth : number;
    public static scenaHeight : number;
    public static BuildingsTemplate : BuildingTemplate[];
    public static NeutralSettlement : GameSettlement;
    public static EnemySettlement : GameSettlement;
    public static GameField : GameField;

    static Init(buildingsTemplate : BuildingTemplate[],
        neutralSettlement : GameSettlement,
        enemySettlement : GameSettlement,
        gameField : GameField) {
        // diplomacyTable

        let scenaSettlements = ActiveScena.GetRealScena().Settlements;
        this.diplomacyTable = new Array<Array<DiplomacyStatus>>(scenaSettlements.Count);
        for (var settlementNum = 0; settlementNum < scenaSettlements.Count; settlementNum++) {
            this.diplomacyTable[settlementNum] = new Array<DiplomacyStatus>(scenaSettlements.Count);
        }
        ForEach(scenaSettlements, (settlement : Settlement) => {
            const settlementUid = parseInt(settlement.Uid);
            ForEach(scenaSettlements, (otherSettlement : Settlement) => {
                const otherSettlementUid = parseInt(otherSettlement.Uid);
                this.diplomacyTable[settlementUid][otherSettlementUid]
                    = this.diplomacyTable[otherSettlementUid][settlementUid]
                    = (settlement.Diplomacy.IsWarStatus(otherSettlement)
                    ? DiplomacyStatus.War
                    : DiplomacyStatus.Alliance);
            });
        });

        this.scenaWidth      = ActiveScena.GetRealScena().Size.Width;
        this.scenaHeight     = ActiveScena.GetRealScena().Size.Height;

        this.BuildingsTemplate = buildingsTemplate;
        this.NeutralSettlement = neutralSettlement;
        this.EnemySettlement   = enemySettlement;
        this.GameField         = gameField;
    }
}

export class ISpell {
    protected static _ProcessingModule : number = 25;
    protected static _ProcessingTack   : number = 0;

    protected static _MaxLevel                      : number = 0;
    protected static _NamePrefix                    : string = "Способность";
    protected static _DescriptionTemplate           : string = "Описание.";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = [[]];

    protected static _ButtonUidPrefix               : string = "#BattleRoyale_";
    protected static _ButtonUid                     : string = "Spell_CustomCommand";
    protected static _ButtonCommandTypeBySlot       : Array<UnitCommand> = [UnitCommand.OneClick_Custom_0, UnitCommand.OneClick_Custom_1, UnitCommand.OneClick_Custom_2, UnitCommand.OneClick_Custom_3, UnitCommand.OneClick_Custom_4];
    protected static _ButtonCommandBaseUid          : string = "#UnitCommandConfig_HoldPosition";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_View";
    protected static _ButtonPositionBySlot          : Array<Cell> = [new Cell(0, 0), new Cell(0, 1), new Cell(1, 0), new Cell(1, 1), new Cell(2, 1)];
    protected static _ButtonHotkeyBySlot            : Array<string> = ["W", "E", "R", "T", "Y"];
    protected static _SpellCost                     : ResourcesAmount = new ResourcesAmount(500, 0, 0, 0);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(0, 0);

    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(255, 255, 255, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 255, 255, 255);

    protected static _ChargesReloadTime             : number = 50*60;
    protected static _ActivateDelay                 : number = 50;
    protected static _ChargesCountPerLevel          : Array<number> = [ 1 ];

    /** флаг, что расходник */
    protected static _IsConsumables                 : boolean = false;

    protected static _IsPassive : boolean = false;

    public static GetName(level: number) : string {
        if (level == -1) {
            return this._NamePrefix;
        } else {
            return this._NamePrefix + " " + (level + 1);
        }
    }

    public static IsConsumables() {
        return this._IsConsumables;
    }

    private static _IsDescriptionInit = false;
    public static GetDescription(in_level: number) : string {
        if (!this._IsDescriptionInit) {
            this._IsDescriptionInit = true;

            if (this._ChargesCountPerLevel.length == 0) {
                // пассивка
            } else if (this._ChargesCountPerLevel.length == 1) {
                // не зависит от уровня
                this._DescriptionTemplate += " Зарядов " + this._ChargesCountPerLevel[0] + ", перезарядка каждого "
                    + (this._ChargesReloadTime / 50) + " сек.";
            } else {
                this._DescriptionTemplate += " Зарядов {" + this._DescriptionParamsPerLevel.length + "}, перезарядка каждого "
                    + (this._ChargesReloadTime / 50) + " сек.";
                this._DescriptionParamsPerLevel.push(this._ChargesCountPerLevel);
            }
        }

        var description : string = "";
        if (in_level == -1) {
            var nParams = this._DescriptionParamsPerLevel.length;
            var params  = new Array<any>(nParams);
            for (var i = 0; i < nParams; i++) {
                params[i] = "";
                for (var level = 0; level <= this._MaxLevel; level++) {
                    params[i] += this._DescriptionParamsPerLevel[i][level];
                    if (level != this._MaxLevel) {
                        params[i] += "/";
                    }
                }
            }
            description += formatStringStrict(this._DescriptionTemplate, params);
        } else {
            var nParams = this._DescriptionParamsPerLevel.length;
            var params  = new Array<any>(nParams);
            for (var i = 0; i < nParams; i++) {
                params[i] = this._DescriptionParamsPerLevel[i][in_level];
            }
            description += formatStringStrict(this._DescriptionTemplate, params);
        }
        
        return description;
    }

    public static GetCommandConfig(slotNum: number, level: number) : UnitCommandConfig {
        var customCommandCfgUid = this._ButtonUidPrefix + this._ButtonUid + "_" + slotNum + "_" + level;
        var customCommand : UnitCommandConfig;
        if (HordeContentApi.HasUnitCommand(customCommandCfgUid)) {
            customCommand = HordeContentApi.GetUnitCommand(customCommandCfgUid);
        } else {
            customCommand = HordeContentApi.CloneConfig(
                HordeContentApi.GetUnitCommand(this._ButtonCommandBaseUid), customCommandCfgUid) as UnitCommandConfig;
            // Настройка
            ScriptUtils.SetValue(customCommand, "Name", this.GetName(level));
            ScriptUtils.SetValue(customCommand, "Tip", this.GetDescription(level));  // Это будет отображаться при наведении курсора
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
    }

    public static GetUnitConfig() {
        var unitConfigCfgUid = this._ButtonUidPrefix + this._ButtonUid + "_UnitCfg";
        var unitConfig : UnitConfig;
        if (HordeContentApi.HasUnitConfig(unitConfigCfgUid)) {
            unitConfig = HordeContentApi.GetUnitConfig(unitConfigCfgUid);
        } else {
            unitConfig = HordeContentApi.CloneConfig(HordeContentApi.GetUnitConfig("#UnitConfig_Barbarian_Swordmen"), unitConfigCfgUid) as UnitConfig;
            ScriptUtils.SetValue(unitConfig, "Name", this.GetName(-1));
            ScriptUtils.SetValue(unitConfig, "Description", this.GetDescription(-1));
            ScriptUtils.GetValue(unitConfig, "PortraitCatalogRef").SetConfig(HordeContentApi.GetAnimationCatalog(this._ButtonAnimationsCatalogUid));
            ScriptUtils.SetValue(unitConfig.CostResources, "Gold",   this._SpellCost.Gold);
            ScriptUtils.SetValue(unitConfig.CostResources, "Metal",  this._SpellCost.Metal);
            ScriptUtils.SetValue(unitConfig.CostResources, "Lumber", this._SpellCost.Lumber);
            ScriptUtils.SetValue(unitConfig.CostResources, "People", this._SpellCost.People);
            ScriptUtils.SetValue(unitConfig, "PreferredProductListPosition", this._SpellPreferredProductListPosition.ToHordePoint());
        }

        return unitConfig;
    }

    public static GetUid() : string {
        return this._ButtonUidPrefix + this._ButtonUid;
    }

    public level : number;

    protected _caster                 : IUnitCaster;
    protected _state                  : SpellState;
    protected _charges                : number;
    //protected _reload                 : number;

    // @ts-ignore
    protected _activatedTick          : number;
    // @ts-ignore
    protected _activatedArgs          : ACommandArgs;
    // @ts-ignore
    protected _activatedEffect        : StringVisualEffect;
    
    //protected _reloadTick             : number;
    
    protected _chargesReloadTicks     : Array<number>;
    private   _processingTack         : number;
    private   _slotNum                : number;

    constructor(caster: IUnitCaster, ...spellArgs: any[]) {
        var thisClass = this.constructor as typeof ISpell;

        this._processingTack = thisClass._ProcessingTack++ % thisClass._ProcessingModule;
        this._caster               = caster;
        this._state                = SpellState.READY;
        
        var ChargesCountPerLevel : Array<number> = thisClass._ChargesCountPerLevel;
        this.level                 = 0;
        this._charges              = ChargesCountPerLevel.length == 0 ? 0 : ChargesCountPerLevel[this.level];
        this._chargesReloadTicks   = new Array<number>();

        // ищем свободный слот
        var casterSpells = this._caster.Spells();
        if (thisClass._IsPassive) {
            for (this._slotNum = 4; this._slotNum >= 0; this._slotNum--) {
                if (casterSpells.findIndex(spell => spell._slotNum == this._slotNum) == -1) {
                    break;
                }
            }
        } else {
            for (this._slotNum = 0; this._slotNum < 5; this._slotNum++) {
                if (casterSpells.findIndex(spell => spell._slotNum == this._slotNum) == -1) {
                    break;
                }
            }
        }

        this._caster.hordeUnit.CommandsMind.AddCommand(this.GetUnitCommand(), this.GetCommandConfig());
    }

    public OnReplacedCaster(caster: IUnitCaster) {
        this._caster = caster;
        var thisClass = this.constructor as typeof ISpell;

        // if (this._state != SpellState.WAIT_CHARGE
        //     && this._state != SpellState.WAIT_DELETE
        //     && !this.constructor["_IsConsumables"]) {
        if (this._charges > 0 || (thisClass._ChargesCountPerLevel.length == 0)) {
            log.info("добавляем команду ", this.GetCommandConfig().Uid, " для юнита ", caster.hordeUnit.Name);
            this._caster.hordeUnit.CommandsMind.AddCommand(this.GetUnitCommand(), this.GetCommandConfig());
        }
    }

    public GetUnitCommand() : UnitCommand {
        var thisClass = this.constructor as typeof ISpell;
        return thisClass._ButtonCommandTypeBySlot[this._slotNum];
    }

    public GetCommandConfig() : UnitCommandConfig {
        var thisClass = this.constructor as typeof ISpell;
        return thisClass.GetCommandConfig(this._slotNum, this.level);
    }

    public GetUid() : string {
        var thisClass = this.constructor as typeof ISpell;
        return thisClass.GetUid();
    }

    public Activate(activateArgs: ACommandArgs) : boolean {
        if (this._state == SpellState.READY) {
            this._state             = SpellState.ACTIVATED;
            this._activatedTick     = Battle.GameTimer.GameFramesCounter;
            this._activatedArgs     = activateArgs;

            var thisClass = this.constructor as typeof ISpell;

            // эффект
            this._activatedEffect   = spawnString(ActiveScena, thisClass.GetName(this.level),
                Cell.ConvertHordePoint(this._caster.hordeUnit.Cell)
                .Scale(32).Add(new Cell(-2.5*thisClass.GetName(this.level).length, 0)).Round().ToHordePoint(), 150);
            this._activatedEffect.Height    = 18;
            this._activatedEffect.Color     = thisClass._EffectHordeColor;
            this._activatedEffect.DrawLayer = DrawLayer.Birds;

            // запускаем перезарядку заряда если не расходник
            this._charges--;
            if (!thisClass._IsConsumables) {
                this._chargesReloadTicks.push(this._activatedTick + thisClass._ChargesReloadTime);
            }

            return true;
        } else {
            return false;
        }
    }

    public OnEveryTick(gameTickNum: number): boolean {
        var thisClass = this.constructor as typeof ISpell;

        if (gameTickNum % thisClass._ProcessingModule != this._processingTack) {
            return false;
        }

        // перезарядка зарядов
        if (this._chargesReloadTicks.length != 0 && this._chargesReloadTicks[0] <= gameTickNum) {
            this._charges++;
            log.info("заряд перезаредился");
            this._chargesReloadTicks.splice(0, 1);
        }
        
        switch (this._state) {
            case SpellState.READY:
                if (!this._OnEveryTickReady(gameTickNum)) {
                    this._state = SpellState.ACTIVATED;
                }
                break;
            case SpellState.ACTIVATED:
                if (!this._OnEveryTickActivated(gameTickNum)) {
                    if (this._charges == 0) {
                        if (thisClass._IsConsumables) {
                            this._state = SpellState.WAIT_DELETE;
                        } else {
                            this._state = SpellState.WAIT_CHARGE;
                            this._caster.hordeUnit.CommandsMind.RemoveAddedCommand(this.GetUnitCommand());
                        }
                    } else {
                        this._state = SpellState.ACTIVATED_DELAY;
                    }
                }
                break;
            case SpellState.ACTIVATED_DELAY:
                if (!this._OnEveryTickActivatedDelay(gameTickNum)) {
                    this._state = SpellState.READY;
                }
                break;
            case SpellState.WAIT_CHARGE:
                if (!this._OnEveryTickWaitReload(gameTickNum)) {
                    this._state   = SpellState.READY;
                    this._caster.hordeUnit.CommandsMind.AddCommand(this.GetUnitCommand(), this.GetCommandConfig());
                }
                break;
        }

        return true;
    }

    public State() : SpellState {
        return this._state;
    }

    public LevelUp() : boolean {
        var thisClass = this.constructor as typeof ISpell;

        if (this.level == thisClass._MaxLevel) return false;
        this.level++;

        // увеличиваем число зарядов
        var ChargesCountPerLevel : Array<number> = thisClass._ChargesCountPerLevel;
        if (ChargesCountPerLevel.length == 0) {
        } else if (ChargesCountPerLevel.length == 1) {
        } else {
            var chargeReloadTick = Battle.GameTimer.GameFramesCounter
                + thisClass._ChargesReloadTime;
            for (var i = 0; i < ChargesCountPerLevel[this.level] - ChargesCountPerLevel[this.level - 1]; i++) {
                log.info("заряд пошел на перезарядку в ", chargeReloadTick);
                this._chargesReloadTicks.push(chargeReloadTick);
            }
        }

        // обновляем состояние кнопки команды
        if (this._state != SpellState.WAIT_CHARGE) {
            this._caster.hordeUnit.CommandsMind.RemoveAddedCommand(this.GetUnitCommand());
            this._caster.hordeUnit.CommandsMind.AddCommand(this.GetUnitCommand(), this.GetCommandConfig());
        }

        return true;
    }

    public OnCauseDamage(VictimUnit: Unit, Damage: number, EffectiveDamage: number, HurtType: UnitHurtType) {
    }

    public OnTakeDamage(AttackerUnit: Unit, EffectiveDamage: number, HurtType: UnitHurtType) {
    }

    protected _SpendCharge() {
        var thisClass = this.constructor as typeof ISpell;
        var chargeReloadTick = Battle.GameTimer.GameFramesCounter
            + thisClass._ChargesReloadTime;
        this._charges--;
        this._chargesReloadTicks.push(chargeReloadTick);

        if (this._charges == 0) {
            this._caster.hordeUnit.CommandsMind.RemoveAddedCommand(this.GetUnitCommand());
            this._state = SpellState.WAIT_CHARGE;
        }
    }

    protected _OnEveryTickReady(gameTickNum: number) : boolean {
        return true;
    }

    protected _OnEveryTickActivated(gameTickNum: number) : boolean {
        return false;
    }

    protected _OnEveryTickActivatedDelay(gameTickNum: number) : boolean {
        var thisClass = this.constructor as typeof ISpell;
        return gameTickNum < this._activatedTick + thisClass._ActivateDelay;
    }

    protected _OnEveryTickWaitReload(gameTickNum: number) : boolean {
        return this._charges == 0;
    }
}