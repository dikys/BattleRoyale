import {ISpell, SpellRefData} from "../ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, DiplomacyStatus, Stride_Color, UnitCommand, VisualEffectConfig } from "library/game-logic/horde-types";
import { iterateOverUnitsInBox } from "library/game-logic/unit-and-map";
import { IUnitCaster } from "../IUnitCaster";
import { AssignOrderMode } from "library/mastermind/virtual-input";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import {Cell} from "../../Core/Cell";
import {IUnit} from "../../Units/IUnit";

export class Spell_Agr_attack extends ISpell {
    protected static _ButtonUid                     : string = "Spell_Agr_attack";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_Agr_attack";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(81, 207, 207, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 81, 207, 207);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(3, 0);

    private static _AgrTimePerLevel   : Array<number> = [
        7, 9, 11, 13, 15
    ].map(sec => sec*50);
    private static _AgrRadiusPerLevel : Array<number> = [
        4, 5, 6, 7, 8
    ];
    protected static _ChargesCountPerLevel : Array<number> = [
        1, 1, 2, 2, 3
    ];
    private static _AgrEffectConfig : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_MagicCircle_red");

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Приступ ярости";
    protected static _DescriptionTemplate           : string
        = "Враги в радиусе {0} клеток на {1} секунд стремятся подойти к вам вплотную игнорируя опасности";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>>
        = [this._AgrRadiusPerLevel, this._AgrTimePerLevel.map(ticks => ticks / 50)];

    ///////////////////////////////////
    
    private _agrUnits  : Array<IUnit>;

    constructor(caster: IUnitCaster) {
        super(caster);

        this._agrUnits = new Array<IUnit>();
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            let unitsIter = iterateOverUnitsInBox(this._caster.hordeUnit.Cell,
                Spell_Agr_attack._AgrRadiusPerLevel[this.level]);
            for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
                if (//this._caster.unit.Owner.Diplomacy.GetDiplomacyStatus(u.value.Owner) == DiplomacyStatus.War
                    SpellRefData.diplomacyTable[parseInt(this._caster.hordeUnit.Owner.Uid)][parseInt(u.value.Owner.Uid)]
                    == DiplomacyStatus.War
                    && u.value.Cfg.IsBuilding == false) {
                    if (u.value.ScriptData.IUnit) {
                        this._agrUnits.push(u.value.ScriptData.IUnit);
                    } else {
                        this._agrUnits.push(new IUnit(u.value, 0));
                    }
                }
            }
            //for (var unit of this._agrUnits) {
                //unit.DisallowCommands();
            //}
            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        if (this._caster.hordeUnit.IsDead || this._activatedTick + Spell_Agr_attack._AgrTimePerLevel[this.level] <= gameTickNum) {
            for (var unit of this._agrUnits) {
                unit.hordeUnit.OrdersMind.CancelOrdersSafe(true);
            }

            return false;
        }

        var agrCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);

        for (var unitNum = 0; unitNum < this._agrUnits.length; unitNum++) {
            var unit = this._agrUnits[unitNum];
            if (unit.hordeUnit.IsDead) {
                this._agrUnits.splice(unitNum, 1);
                unitNum--;
            }

            var unitPoint = Cell.ConvertHordePoint(unit.hordeUnit.Cell).Scale(32)
                .Add(new Cell(16, 16)).ToHordePoint();
            spawnDecoration(
                ActiveScena.GetRealScena(),
                Spell_Agr_attack._AgrEffectConfig,
                unitPoint);

            //unit.AllowCommands();
            unit.GivePointCommand(agrCell, UnitCommand.MoveToPoint, AssignOrderMode.Replace);
            //unit.DisallowCommands();
        }

        return true;
    }
}
