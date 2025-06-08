import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { SpellGlobalRef } from "./ISpell";
import { generateCellInSpiral } from "library/common/position-tools";
import { HordeColor } from "library/common/primitives";
import { Stride_Color, UnitDirection } from "library/game-logic/horde-types";
import { spawnUnits } from "library/game-logic/unit-spawn";
import { Cell } from "../Core/Cell";
import { ScriptData_Building } from "../Core/ScriptData_Building";
import { ITargetPointSpell } from "./ITargetPointSpell";

export class Spell_golden_barracks_summon extends ITargetPointSpell {
    private static _MaxDistance : number = 6;

    protected static _ButtonUid                     : string = "Spell_golden_barracks_summon";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_golden_barracks_summon";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(252, 233, 177, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 252, 233, 177);
    protected static _Name                          : string = "Призыв золотой казармы";
    protected static _Description                   : string = "Призывает случайную золотую казарму в клетку, максимальное расстояние "
        + Spell_golden_barracks_summon._MaxDistance + " клеток.";

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
        var moveVec  = this._targetCell.Minus(heroCell);
        var distance = moveVec.Length_Chebyshev();

        // максимальная дистанция телепорта
        if (distance > Spell_golden_barracks_summon._MaxDistance) {
            moveVec = moveVec.Scale(Spell_golden_barracks_summon._MaxDistance / distance).Round();
        }

        var targetCell = heroCell.Add(moveVec);

        // спавним казарму в указанную точку
        var rnd                 = ActiveScena.GetRealScena().Context.Randomizer;
        var generator           = generateCellInSpiral(targetCell.X, targetCell.Y);
        var buildingTemplateNum = rnd.RandomNumber(0, SpellGlobalRef.BuildingsTemplate.length - 1);
        var rarityNum           = SpellGlobalRef.BuildingsTemplate[buildingTemplateNum].buildings.length - 1;
        var units               = spawnUnits(
            SpellGlobalRef.EnemySettlement.hordeSettlement,
            SpellGlobalRef.BuildingsTemplate[buildingTemplateNum].buildings[rarityNum].hordeConfig,
            1,
            UnitDirection.RightDown,
            generator);
        units.forEach((unit) => {
            unit.ScriptData.Building = new ScriptData_Building();
            (unit.ScriptData.Building as ScriptData_Building).templateNum = buildingTemplateNum;
            
            for (var x = unit.Cell.X; x < unit.Cell.X + unit.Cfg.Size.Width; x++) {
                for (var y = unit.Cell.Y; y < unit.Cell.Y + unit.Cfg.Size.Height; y++) {
                    spawnDecoration(
                        ActiveScena.GetRealScena(),
                        HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust"),
                        new Cell(x, y).Scale(32).Add(new Cell(16, 16)).ToHordePoint());
                }
            }
        });

        return false;
    }
}
