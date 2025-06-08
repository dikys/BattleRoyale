import { generateCellInSpiral } from "library/common/position-tools";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { createPoint, HordeColor } from "library/common/primitives";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { Stride_Color } from "library/game-logic/horde-types";
import { ITargetPointSpell } from "./ITargetPointSpell";
import { Cell } from "../Core/Cell";

export class Spell_Teleportation extends ITargetPointSpell {
    private static _MaxDistance : number = 6;

    protected static _ButtonUid                     : string = "Spell_Teleportation";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_teleportation";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(139, 133, 172, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 139, 133, 172);
    protected static _ButtonPosition                : Cell   = new Cell(1, 1);
    protected static _ButtonHotkey                  : string = "Q";
    protected static _Name                          : string = "Телепортация";
    protected static _Description                   : string = "Телепортация героя в достижимую клетку, максимальное расстояние "
        + Spell_Teleportation._MaxDistance + " клеток.";

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
        var moveVec  = this._targetCell.Minus(heroCell);
        var distance = moveVec.Length_Chebyshev();

        // максимальная дистанция телепорта
        if (distance > Spell_Teleportation._MaxDistance) {
            moveVec = moveVec.Scale(Spell_Teleportation._MaxDistance / distance).Round();
        }

        var targetCell = heroCell.Add(moveVec);

        // выбираем свободную клетку
        var generator = generateCellInSpiral(targetCell.X, targetCell.Y);
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

        return false;
    }
}
