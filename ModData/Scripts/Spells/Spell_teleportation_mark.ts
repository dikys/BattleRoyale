
import { ISpell } from "./ISpell";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { createPoint, HordeColor } from "library/common/primitives";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { Stride_Color } from "library/game-logic/horde-types";
import { generateCellInSpiral } from "library/common/position-tools";
import { Cell } from "../Core/Cell";

export class Spell_teleportation_mark extends ISpell {
    protected static _ButtonUid                     : string = "Spell_Teleportation_mark";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_teleportation_mark";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(122, 161, 233, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 122, 161, 233);
    protected static _ChargesCount                  : number = 2;
    protected static _Name                          : string = "Телепортационная метка";
    protected static _Description                   : string = "При первои использовании устанавливает метку. При повторном герой телепортируется в установленную метку.";

    private _mark : Cell;

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // первая активация
        if (this._charges == 2) {
            this._mark = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
        }
        // вторая активация
        else {
            // выбираем свободную клетку
            var generator = generateCellInSpiral(this._mark.X, this._mark.Y);
            for (let position = generator.next(); !position.done; position = generator.next()) {
                var tpCell = createPoint(position.value.X, position.value.Y);

                if (unitCanBePlacedByRealMap(this._caster.hordeConfig, tpCell.X, tpCell.Y) && this._caster.hordeUnit.MapMind.CheckPathTo(tpCell, false).Found) {
                    this._caster.hordeUnit.MapMind.TeleportToCell(tpCell);
                    spawnDecoration(
                        ActiveScena.GetRealScena(),
                        HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust"),
                        Cell.ConvertHordePoint(tpCell).Scale(32).Add(new Cell(16, 16)).ToHordePoint());
                    break;
                }
            }
        }

        return false;
    }
}
