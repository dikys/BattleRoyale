import {ISpell, SpellRefData} from "../ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, DiplomacyStatus, Stride_Color, UnitCommand, UnitFlags, VisualEffectConfig } from "library/game-logic/horde-types";
import { iterateOverUnitsInBox } from "library/game-logic/unit-and-map";
import { IUnitCaster } from "../IUnitCaster";
import { AssignOrderMode } from "library/mastermind/virtual-input";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import {Cell} from "../../Core/Cell";
import {IUnit} from "../../Units/IUnit";

export class Spell_fear_attack extends ISpell {
    protected static _ButtonUid                     : string = "Spell_fear_attack";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_fear_attack";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(81, 207, 207, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 81, 207, 207);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(2, 0);

    private static _FearTimePerLevel   : Array<number> = [
        7, 8, 9, 10, 11
    ].map(sec => sec*50);
    private static _FearRadiusPerLevel : Array<number> = [
        3, 4, 5, 6, 7
    ];
    protected static _ChargesCountPerLevel   : Array<number> = [
        1, 1, 2, 2, 3
    ];
    private static _FearEffectConfig : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_MagicCircle");

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Приступ страха";
    protected static _DescriptionTemplate           : string
        = "Вселяет страх во вражеских юнитов (без иммуна к магии) в радиусе {0} клеток на {1} секунд";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>>
        = [this._FearRadiusPerLevel, this._FearTimePerLevel.map(ticks => ticks / 50)];

    ///////////////////////////////////
    
    private _fearUnits  : Array<IUnit>;
    // @ts-ignore
    private _fearCell   : Cell;

    constructor(caster: IUnitCaster) {
        super(caster);

        this._fearUnits = new Array<IUnit>();
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            this._fearCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            
            let unitsIter = iterateOverUnitsInBox(this._caster.hordeUnit.Cell, Spell_fear_attack._FearRadiusPerLevel[this.level]);
            for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
                if (SpellRefData.diplomacyTable[parseInt(this._caster.hordeUnit.Owner.Uid)][parseInt(u.value.Owner.Uid)]
                    === DiplomacyStatus.War
                    && !u.value.Cfg.Flags.HasFlag(UnitFlags.MagicResistant)
                    && u.value.Cfg.IsBuilding == false) {
                    if (u.value.ScriptData.IUnit) {
                        this._fearUnits.push(u.value.ScriptData.IUnit);
                    } else {
                        this._fearUnits.push(new IUnit(u.value, 0));
                    }
                }
            }
            //for (var unit of this._fearUnits) {
                //unit.DisallowCommands();
            //}
            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        if (this._activatedTick + Spell_fear_attack._FearTimePerLevel[this.level] <= gameTickNum) {
            for (var unit of this._fearUnits) {
                unit.hordeUnit.OrdersMind.CancelOrdersSafe(true);
            }

            return false;
        }

        for (var unitNum = 0; unitNum < this._fearUnits.length; unitNum++) {
            var unit = this._fearUnits[unitNum];
            if (unit.hordeUnit.IsDead) {
                this._fearUnits.splice(unitNum, 1);
                unitNum--;
            }

            var unitPoint = Cell.ConvertHordePoint(unit.hordeUnit.Cell).Scale(32).Add(new Cell(16, 16)).ToHordePoint();
            spawnDecoration(
                ActiveScena.GetRealScena(),
                Spell_fear_attack._FearEffectConfig,
                unitPoint);

            var targetCell = this._fearCell.Add(Cell.ConvertHordePoint(unit.hordeUnit.Cell).Minus(this._fearCell).Scale(10));
            //unit.AllowCommands();
            unit.GivePointCommand(targetCell, UnitCommand.MoveToPoint, AssignOrderMode.Replace);
            //unit.DisallowCommands();
        }

        return true;
    }
}
