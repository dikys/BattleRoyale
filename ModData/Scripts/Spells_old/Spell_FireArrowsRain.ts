import { createPF, HordeColor } from "library/common/primitives";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import { BulletConfig, ShotParams, Stride_Color, UnitCommandConfig, UnitMapLayer } from "library/game-logic/horde-types";
import { ITargetPointSpell } from "./ITargetPointSpell";
import { Cell } from "../Core/Cell";
import { CreateHordeBulletConfig } from "../Units/IConfig";
import { generateCellInRect, generateRandomCellInRect } from "library/common/position-tools";

export class Spell_FireArrowsRain extends ITargetPointSpell {
    private static _MaxDistance : number = 10;
    private static _RainRadius : number = 2;
    private static _RainSize : number = 10;
    
    private static _Init : boolean = false;
    private static _BulletConfig : BulletConfig;
    private static _ShotParams : ShotParams;

    protected static _ButtonUid                     : string = "Spell_FireArrowsRain";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_FireArrowsRain";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(228, 18, 47, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 228, 18, 47);
    protected static _Name                          : string = "Дождь огненных стрел";
    protected static _Description                   : string = "Запускает дождь из " + this._RainSize + " огненных стрел радиусом в "
        + this._RainRadius + " клеток";

    public static GetCommandConfig(slotNum: number) : UnitCommandConfig {
        var config = super.GetCommandConfig(slotNum);

        if (!this._Init) {
            this._BulletConfig = CreateHordeBulletConfig("#BulletConfig_FireArrow", "#Spell_FireArrowsRain_Bullet");
            ScriptUtils.SetValue(this._BulletConfig, "BaseBulletSpeed", 0.1);
            ScriptUtils.SetValue(this._BulletConfig, "IsBallistic", true);

            this._ShotParams = ShotParams.CreateInstance();
            ScriptUtils.SetValue(this._ShotParams, "Damage", 4);
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
        if (distance > Spell_FireArrowsRain._MaxDistance) {
            moveVec = moveVec.Scale(Spell_FireArrowsRain._MaxDistance / distance).Round();
        }

        var targetCell = heroCell.Add(moveVec);

        var generator = generateRandomCellInRect(targetCell.X - Spell_FireArrowsRain._RainRadius, targetCell.Y - Spell_FireArrowsRain._RainRadius,
            2 * Spell_FireArrowsRain._RainRadius + 1, 2 * Spell_FireArrowsRain._RainRadius + 1
        );
        for (let position = generator.next(), bulletNum = 0; !position.done && bulletNum < Spell_FireArrowsRain._RainSize; position = generator.next(), bulletNum++) {
            spawnBullet(
                this._caster.hordeUnit,  // Игра будет считать, что именно этот юнит запустил снаряд
                null,
                null,
                Spell_FireArrowsRain._BulletConfig,
                Spell_FireArrowsRain._ShotParams,
                this._caster.hordeUnit.Position,
                new Cell(position.value.X, position.value.Y).Scale(32).Add(new Cell(16, 16)).ToHordePoint(),
                UnitMapLayer.Main
            );
        }

        return false;
    }
}
