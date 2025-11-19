import { ISpell } from "../ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, ReplaceUnitParameters, Stride_Color, Unit, UnitConfig} from "library/game-logic/horde-types";
import { IUnitCaster } from "../IUnitCaster";
import {Cell} from "../../Core/Cell";

export class Spell_invisibility extends ISpell {
    protected static _ButtonUid                     : string = "Spell_invisibility";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_invisibility";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(255, 255, 255, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 255, 255, 255);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(4, 0);

    protected static _DurationPerLevel       : Array<number> = [10, 12, 14, 16, 18].map(sec => sec * 50);
    protected static _ChargesCountPerLevel   : Array<number> = [1, 1, 2, 2, 3];

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Невидимость";
    protected static _DescriptionTemplate           : string = "Становится невидимым в течении {0} секунд. Однако враги могут вас выделить!";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._DurationPerLevel.map(ticks => ticks / 50)];

    protected _unitBaseConfig : UnitConfig | null;

    constructor(caster: IUnitCaster) {
        super(caster);
        this._unitBaseConfig = null;
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            this._unitBaseConfig = this._caster.hordeConfig;

            // Параметры замены
            let replaceParams           = new ReplaceUnitParameters();
            replaceParams.OldUnit       = this._caster.hordeUnit;
            replaceParams.NewUnitConfig = HordeContentApi.GetUnitConfig("#UnitConfig_Nature_Invisibility_Horse");
            replaceParams.Cell = this._caster.hordeUnit.Cell;
            replaceParams.PreserveHealthLevel = true;
            replaceParams.PreserveExperience = true;
            replaceParams.PreserveOrders = false;
            replaceParams.PreserveKillsCounter = true;
            replaceParams.Silent = true;
    
            // Замена юнита
            var newUnit = this._caster.hordeUnit.Owner.Units.ReplaceUnit(replaceParams);
            this._caster.ReplaceHordeUnit(newUnit);

            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        if (this._caster.hordeUnit.IsDead) {
            return false;
        }

        if (this._activatedTick + Spell_invisibility._DurationPerLevel[this.level] <= gameTickNum) {
            // Параметры замены
            let replaceParams           = new ReplaceUnitParameters();
            replaceParams.OldUnit       = this._caster.hordeUnit;
            replaceParams.NewUnitConfig = this._unitBaseConfig as UnitConfig;
            replaceParams.Cell = this._caster.hordeUnit.Cell;
            replaceParams.PreserveHealthLevel = true;
            replaceParams.PreserveExperience = true;
            replaceParams.PreserveOrders = false;
            replaceParams.PreserveKillsCounter = true;
            replaceParams.Silent = true;

            // Замена юнита
            var newUnit = this._caster.hordeUnit.Owner.Units.ReplaceUnit(replaceParams);
            this._caster.ReplaceHordeUnit(newUnit);

            return false;
        }

        return true;
    }
}
