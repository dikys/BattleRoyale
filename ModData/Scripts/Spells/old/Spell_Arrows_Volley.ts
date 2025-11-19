import { HordeColor, createPF } from "library/common/primitives";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import { Stride_Color, ShotParams, UnitMapLayer } from "library/game-logic/horde-types";
import { ITargetPointSpell } from "../ITargetPointSpell";
import { IUnitCaster } from "../IUnitCaster";
import { Cell } from "../../Types/Geometry";

export class Spell_Arrows_Volley extends ITargetPointSpell {
    private static _MaxDistance : number = 6;

    protected static _ButtonUid                     : string = "Spell_Arrows_Volley";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_arrows_volley";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(250, 216, 170, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 250, 216, 170);
    protected static _ChargesCount                  : number = 4;
    protected static _Name                          : string = "Залп стрел";
    protected static _Description                   : string = "Запускает стрелу в выбранном направлении до " + this._MaxDistance + " клеток.";

    constructor(caster: IUnitCaster) {
        super(caster);
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        var casterCell = Cell.ConvertHordePoint(this._caster.unit.Cell);
        var moveVec    = this._targetCell.Minus(casterCell);

        // максимальная дистанция
        var distance = moveVec.Length_Chebyshev();
        if (distance > Spell_Arrows_Volley._MaxDistance) {
            moveVec = moveVec.Scale(Spell_Arrows_Volley._MaxDistance / distance).Round();
        }

        var targetCell = casterCell.Add(moveVec);

        var bulletConfig = HordeContentApi.GetBulletConfig("#BulletConfig_Arrow");
        var bulletShotParams = ShotParams.CreateInstance();
        ScriptUtils.SetValue(bulletShotParams, "Damage", 4);
        ScriptUtils.SetValue(bulletShotParams, "AdditiveBulletSpeed", createPF(0, 0));
        spawnBullet(
            this._caster.unit,  // Игра будет считать, что именно этот юнит запустил снаряд
            null,
            null,
            bulletConfig,
            bulletShotParams,
            this._caster.unit.Position,
            targetCell.Scale(32).Add(new Cell(16, 16)).ToHordePoint(),
            UnitMapLayer.Main
        );

        return false;
    }
}
