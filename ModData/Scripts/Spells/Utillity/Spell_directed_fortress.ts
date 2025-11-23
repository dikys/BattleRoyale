import {ISpell, SpellRefData} from "../ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, Stride_Color, Unit, UnitDirection } from "library/game-logic/horde-types";
import { IUnitCaster } from "../IUnitCaster";
import { spawnUnit } from "library/game-logic/unit-spawn";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import {Cell} from "../../Core/Cell";
import { ITargetPointSpell } from "../ITargetPointSpell";
import { log } from "library/common/logging";

export class Spell_directed_fortress extends ITargetPointSpell {
    protected static _ButtonUid                     : string = "Spell_directed_fortress";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_directed_fortress";
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
    protected static _NamePrefix                    : string = "Укрепление";
    protected static _DescriptionTemplate           : string = "Воздвигает в указаном направлении забор на расстоянии до {0} клеток от героя в течении {1} секунд.";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._FortressRadiusPerLevel, this._FortressDurationPerLevel.map(ticks => ticks / 50)];

    ////////////////////////////////////

    private _spawnedUnits : Array<Unit>;
    
    constructor(caster: IUnitCaster) {
        super(caster);
        this._spawnedUnits = new Array<Unit>();
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            var spawnedConfig = HordeContentApi.GetUnitConfig("#UnitConfig_Slavyane_Fence");
            var casterCell    = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            var castRadius    = Math.max(
                1,
                Math.min(Spell_directed_fortress._FortressRadiusPerLevel[this.level],
                    this._targetCell.Minus(casterCell).Length_Chebyshev()));
            var nPositions    = 4 * 2 * castRadius;
        
            var cells = new Array<Cell>();
            var LD    = new Cell(casterCell.X - castRadius, casterCell.Y - castRadius);
            var RU    = new Cell(casterCell.X + castRadius, casterCell.Y + castRadius);
            for (var x = LD.X; x <= RU.X; x++) {
                cells.push(new Cell(x, LD.Y));
            }
            for (var y = LD.Y + 1; y < RU.Y; y++) {
                cells.push(new Cell(RU.X, y));
            }
            for (var x = RU.X; x >= LD.X; x--) {
                cells.push(new Cell(x, RU.Y));
            }
            for (var y = RU.Y - 1; y > LD.Y; y--) {
                cells.push(new Cell(LD.X, y));
            }

            var castStartPosition = 0;
            var minDist = 1000000;
            for (var i = 0; i < nPositions; i++) {
                var dist = this._targetCell.Minus(cells[i]).Length_L2_2();
                if (dist < minDist) {
                    castStartPosition = i;
                    minDist = dist;
                }
            }
            castStartPosition -= castRadius;
            if (castStartPosition < 0) {
                castStartPosition += nPositions;
            }

            for (var pos = castStartPosition; pos <= castStartPosition + 2*castRadius; pos++) {
                var cell = cells[pos % nPositions];
                log.info("pos = ", pos, " cell = ", cell.X, ", ", cell.Y);
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
            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // проверяем, что закончилось
        if (this._activatedTick + Spell_directed_fortress._FortressDurationPerLevel[this.level] <= gameTickNum) {
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
