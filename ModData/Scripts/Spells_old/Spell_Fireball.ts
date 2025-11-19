import { createPF, HordeColor } from "library/common/primitives";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import { BulletConfig, ShotParams, Stride_Color, UnitCommandConfig, UnitMapLayer } from "library/game-logic/horde-types";
import { ITargetPointSpell } from "./ITargetPointSpell";
import { Cell } from "../Core/Cell";

export class Spell_Fireball extends ITargetPointSpell {
    private static _MaxDistance : number = 10;

    private static _Init : boolean = false;
    private static _BulletConfig : BulletConfig;
    private static _ShotParams : ShotParams;

    protected static _ButtonUid                     : string = "Spell_Fireball";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_fireball";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(228, 18, 47, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 228, 18, 47);
    protected static _Name                          : string = "Огненный шар";
    protected static _Description                   : string = "Запускает огненный шар в выбранном направлении до "
        + Spell_Fireball._MaxDistance + " клеток.";

    public static GetCommandConfig(slotNum: number) : UnitCommandConfig {
        var config = super.GetCommandConfig(slotNum);

        if (!this._Init) {
            this._BulletConfig = HordeContentApi.GetBulletConfig("#BulletConfig_Fireball");
            this._ShotParams = ShotParams.CreateInstance();
            ScriptUtils.SetValue(this._ShotParams, "Damage", 10);
            ScriptUtils.SetValue(this._ShotParams, "AdditiveBulletSpeed", createPF(0, 0));
        }

        return config;
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
        var moveVec  = this._targetCell.Minus(heroCell);

        // максимальная дистанция
        var distance = moveVec.Length_Chebyshev();
        if (distance > Spell_Fireball._MaxDistance) {
            moveVec = moveVec.Scale(Spell_Fireball._MaxDistance / distance).Round();
        }

        var targetCell = heroCell.Add(moveVec);

        spawnBullet(
            this._caster.hordeUnit,  // Игра будет считать, что именно этот юнит запустил снаряд
            null,
            null,
            Spell_Fireball._BulletConfig,
            Spell_Fireball._ShotParams,
            this._caster.hordeUnit.Position,
            targetCell.Scale(32).Add(new Cell(16, 16)).ToHordePoint(),
            UnitMapLayer.Main
        );

        return false;
    }
}
