import { generateRandomCellInRect } from "library/common/position-tools";
import { HordeColor, createPF } from "library/common/primitives";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import { BulletConfig, ShotParams, Stride_Color, UnitCommandConfig, UnitMapLayer } from "library/game-logic/horde-types";
import { ITargetPointSpell } from "../ITargetPointSpell";
import {Cell} from "../../Core/Cell";
import {CreateHordeBulletConfig} from "../../Units/IConfig";

export class Spell_FireArrowsRain extends ITargetPointSpell {
    private static _Init : boolean = false;
    private static _BulletConfig : BulletConfig;
    private static _ShotParams : ShotParams;

    protected static _ButtonUid                     : string = "Spell_FireArrowsRain";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_FireArrowsRain";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(228, 18, 47, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 228, 18, 47);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(3, 0);

    protected static _ChargesCountPerLevel          : Array<number> = [
        3, 5, 7, 9, 12
    ];

    private static _RainArrowsCountPerLevel   : Array<number> = [
        10, 15, 20, 25, 30
    ];
    private static _RainRadiusPerLevel : Array<number> = [
        2, 2, 2, 3, 3
    ];
    private static _RainLaunchMaxDistancePerLevel   : Array<number> = [
        10, 12, 14, 16, 18
    ];

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Дождь огненных стрел";
    protected static _DescriptionTemplate           : string =
        "Запускает дождь из {0} огненных стрел радиусом в {1} клеток на расстояние до {2} клеток.";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._RainArrowsCountPerLevel, this._RainRadiusPerLevel, this._RainLaunchMaxDistancePerLevel];

    ///////////////////////////////////

    public static GetCommandConfig(slotNum: number, level: number) : UnitCommandConfig {
        var config = super.GetCommandConfig(slotNum, level);

        if (!this._Init) {
            this._BulletConfig = CreateHordeBulletConfig("#BulletConfig_FireArrow", "#Spell_FireArrowsRain_Bullet");
            ScriptUtils.SetValue(this._BulletConfig, "IsBallistic", true);
            // убираем дружественный огонь у огня
            ScriptUtils.SetValue(this._BulletConfig, "CanDamageAllied", false);

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
        if (distance > Spell_FireArrowsRain._RainLaunchMaxDistancePerLevel[this.level]) {
            moveVec = moveVec.Scale(Spell_FireArrowsRain._RainLaunchMaxDistancePerLevel[this.level] / distance).Round();
        }

        var targetCell = heroCell.Add(moveVec);

        var generator = generateRandomCellInRect(
            targetCell.X - Spell_FireArrowsRain._RainRadiusPerLevel[this.level],
            targetCell.Y - Spell_FireArrowsRain._RainRadiusPerLevel[this.level],
            2 * Spell_FireArrowsRain._RainRadiusPerLevel[this.level] + 1,
            2 * Spell_FireArrowsRain._RainRadiusPerLevel[this.level] + 1
        );
        for (let position = generator.next(), bulletNum = 0;
            !position.done && bulletNum < Spell_FireArrowsRain._RainArrowsCountPerLevel[this.level];
            position = generator.next(), bulletNum++) {
            spawnBullet(
                this._caster.hordeUnit,  // Игра будет считать, что именно этот юнит запустил снаряд
                null,
                null,
                Spell_FireArrowsRain._BulletConfig,
                Spell_FireArrowsRain._ShotParams,
                this._caster.hordeUnit.Position.ToPoint2D(),
                new Cell(position.value.X, position.value.Y).Scale(32).Add(new Cell(16, 16)).ToHordePoint(),
                UnitMapLayer.Main
            );
        }

        return false;
    }
}
