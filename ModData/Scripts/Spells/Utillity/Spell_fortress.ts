import {ISpell, SpellRefData} from "../ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, DiplomacyStatus, Stride_Color, Unit, UnitDirection } from "library/game-logic/horde-types";
import { IUnitCaster } from "../IUnitCaster";
import { spawnUnit } from "library/game-logic/unit-spawn";
import { iterateOverUnitsInBox, unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import {Cell} from "../../Core/Cell";

export class Spell_fortress extends ISpell {
    //protected static _Duration : number = 10 * 50;
    //protected static _Radius : number = 4;

    protected static _ButtonUid                     : string = "Spell_fortress";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_fortress";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(200, 160, 100, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 200, 160, 100);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(4, 0);

    private static _FortressDurationPerLevel   : Array<number> = [
        10, 14, 16, 18, 20
    ].map(sec => sec*50);
    private static _FortressRadiusPerLevel   : Array<number> = [
        4, 5, 6, 7, 8
    ];
    protected static _ChargesCountPerLevel   : Array<number> = [
        1, 1, 2, 2, 3
    ];

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Крепость";
    protected static _DescriptionTemplate           : string = "Воздвигает вокруг врагов забор в радиусе {0}x{0} вокруг героя в течении {1} секунд.";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._FortressRadiusPerLevel.map(num => 2*num + 1), this._FortressDurationPerLevel.map(ticks => ticks / 50)];

    ////////////////////////////////////

    private _spawnedUnits : Array<Unit>;
    
    constructor(caster: IUnitCaster) {
        super(caster);
        this._spawnedUnits = new Array<Unit>();
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            var spawnedConfig = HordeContentApi.GetUnitConfig("#UnitConfig_Slavyane_Fence");
            var unitCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            var r        = Spell_fortress._FortressRadiusPerLevel[this.level];
            var cells    = new Array<Cell>();
            var LD       = new Cell(Math.max(0, unitCell.X - r), Math.max(0, unitCell.Y - r));
            var RU       = new Cell(Math.min(SpellRefData.scenaWidth, unitCell.X + r), Math.min(SpellRefData.scenaHeight, unitCell.Y + r));
            for (var x = LD.X; x <= RU.X; x++) {
                cells.push(new Cell(x, LD.Y));
                cells.push(new Cell(x, RU.Y));
            }
            for (var y = LD.Y + 1; y < RU.Y; y++) {
                cells.push(new Cell(LD.X, y));
                cells.push(new Cell(RU.X, y));
            }
            for (var cell of cells) {
                if (unitCanBePlacedByRealMap(spawnedConfig, cell.X, cell.Y)) {
                    var unit = spawnUnit(
                        this._caster.hordeUnit.Owner, spawnedConfig, cell.ToHordePoint(), UnitDirection.Down);
                    if (unit) {
                        this._spawnedUnits.push(unit);
                        spawnDecoration(
                            ActiveScena.GetRealScena(),
                            HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust"),
                            Cell.ConvertHordePoint(unit.Cell).Scale(32).Add(new Cell(16, 16)).ToHordePoint());
                    }
                }
            }

            // запечатывает юнитов в забор!
            // let unitsIter = iterateOverUnitsInBox(this._caster.hordeUnit.Cell, Spell_fortress._FortressRadiusPerLevel[this.level]);
            // for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
            //     //if (this._caster.unit.Owner.Diplomacy.GetDiplomacyStatus(u.value.Owner) == DiplomacyStatus.War) {
            //     if (SpellRefData.diplomacyTable[parseInt(this._caster.hordeUnit.Owner.Uid)][parseInt(u.value.Owner.Uid)]
            //         == DiplomacyStatus.War) {
            //         var unitCell = Cell.ConvertHordePoint(u.value.Cell);
                    
            //         for (var x = Math.max(0, unitCell.X - 1); x <= Math.min(SpellRefData.scenaWidth, unitCell.X + 1); x++) {
            //             for (var y = Math.max(0, unitCell.Y - 1); y <= Math.min(SpellRefData.scenaHeight, unitCell.Y + 1); y++) {
            //                 var cell = new Cell(x, y);
            //                 if (unitCanBePlacedByRealMap(spawnedConfig, cell.X, cell.Y)) {
            //                     var unit = spawnUnit(
            //                         this._caster.hordeUnit.Owner, spawnedConfig, cell.ToHordePoint(), UnitDirection.Down);
            //                     if (unit) {
            //                         this._spawnedUnits.push(unit);
            //                         spawnDecoration(
            //                             ActiveScena.GetRealScena(),
            //                             HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust"),
            //                             Cell.ConvertHordePoint(unit.Cell).Scale(32).Add(new Cell(16, 16)).ToHordePoint());
            //                     }
            //                 }
            //             }
            //         }
            //     }
            // }

            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // проверяем, что закончилось
        if (this._activatedTick + Spell_fortress._FortressDurationPerLevel[this.level] <= gameTickNum) {
            this._spawnedUnits.forEach(unit => {
                unit.Delete();
                spawnDecoration(
                    ActiveScena.GetRealScena(),
                    HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust"),
                    Cell.ConvertHordePoint(unit.Cell).Scale(32).Add(new Cell(16, 16)).ToHordePoint());
            });
            this._spawnedUnits.splice(0);
            return false;
        }

        return true;
    }
}
