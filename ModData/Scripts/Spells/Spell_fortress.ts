import { ISpell } from "./ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, Stride_Color, Unit, UnitDirection } from "library/game-logic/horde-types";
import { IUnitCaster } from "./IUnitCaster";
import { Cell } from "../Core/Cell";
import { spawnUnit } from "library/game-logic/unit-spawn";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { spawnDecoration } from "library/game-logic/decoration-spawn";

export class Spell_fortress extends ISpell {
    protected static _Duration : number = 10 * 50;
    protected static _Radius : number = 4;

    protected static _ButtonUid                     : string = "Spell_fortress";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_fortress";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(200, 160, 100, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 200, 160, 100);
    protected static _Name                          : string = "Крепость";
    protected static _Description                   : string = "Призывает клетку забора вокруг героя на расстоянии "
        + Spell_fortress._Radius + " клеток в течении " + (this._Duration / 50) + " сек.";

    private _spawnedUnits : Array<Unit>;
    
    constructor(caster: IUnitCaster) {
        super(caster);

        this._spawnedUnits = new Array<Unit>();
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            var spawnedConfig = HordeContentApi.GetUnitConfig("#UnitConfig_Slavyane_Fence");

            var rectX = heroCell.X - Spell_fortress._Radius;
            var rectY = heroCell.Y - Spell_fortress._Radius;
            var rectW = 2 * Spell_fortress._Radius;
            var rectH = 2 * Spell_fortress._Radius;

            let scenaWidth = ActiveScena.GetRealScena().Size.Width;
            let scenaHeight = ActiveScena.GetRealScena().Size.Height;

            rectX = Math.max(0, rectX);
            rectY = Math.max(0, rectY);
            rectW = Math.min(scenaWidth - rectX, rectW);
            rectH = Math.min(scenaHeight - rectY, rectH);

            for (var x = rectX; x <= rectX + rectW; x++) {
                for (var y = rectY; y <= rectY + rectH; y += rectH) {
                    var cell = new Cell(x, y);
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
            }
            for (var y = rectY + 1; y < rectY + rectH; y++) {
                for (var x = rectX; x <= rectX + rectW; x += rectW) {
                    var cell = new Cell(x, y);
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
            }

            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // проверяем, что закончилось
        if (this._activatedTick + Spell_fortress._Duration <= gameTickNum) {
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
