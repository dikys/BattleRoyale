import { HordeColor, createPF } from "library/common/primitives";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import { BulletConfig, ShotParams, Stride_Color, UnitCommandConfig, UnitMapLayer } from "library/game-logic/horde-types";
import { ITargetPointSpell } from "../ITargetPointSpell";
import {Cell} from "../../Core/Cell";

export class Spell_Fireball extends ITargetPointSpell {
    private static _Init         : boolean = false;
    private static _BulletConfig : BulletConfig;
    private static _ShotParamsPerLevel : Array<ShotParams>;

    protected static _ButtonUid                     : string = "Spell_Fireball";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_fireball";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(228, 18, 47, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 228, 18, 47);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(3, 0);

    private static _FireballMaxDistancePerLevel   : Array<number> = [
        10, 11, 12, 13, 14
    ];
    private static _FireballDamagePerLevel   : Array<number> = [
        10, 11, 12, 13, 14
    ];
    protected static _ChargesCountPerLevel   : Array<number> = [
        1, 2, 3, 4, 5
    ];

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Огненный шар";
    protected static _DescriptionTemplate           : string =
        "Запускает огненный шар в выбранном направлении до {0} клеток, который наносит {1} магического урона и поджигает врагов.";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._FireballMaxDistancePerLevel, this._FireballDamagePerLevel];

    ///////////////////////////////////

    public static GetCommandConfig(slotNum: number, level: number) : UnitCommandConfig {
        var config = super.GetCommandConfig(slotNum, level);

        if (!this._Init) {
            this._BulletConfig = HordeContentApi.GetBulletConfig("#BulletConfig_DragonFire");
            // убираем дружественный огонь у огня
            ScriptUtils.SetValue(this._BulletConfig, "CanDamageAllied", false);
            this._ShotParamsPerLevel = new Array<ShotParams>(this._MaxLevel + 1);
            for (var level = 0; level <= this._MaxLevel; level++) {
                this._ShotParamsPerLevel[level] = ShotParams.CreateInstance();
                ScriptUtils.SetValue(this._ShotParamsPerLevel[level], "Damage", this._FireballDamagePerLevel[level]);
                ScriptUtils.SetValue(this._ShotParamsPerLevel[level], "AdditiveBulletSpeed", createPF(0, 0));
            }
        }

        return config;
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
        var moveVec  = this._targetCell.Minus(heroCell);

        // максимальная дистанция
        var distance = moveVec.Length_Chebyshev();
        if (distance > Spell_Fireball._FireballMaxDistancePerLevel[this.level]) {
            moveVec = moveVec.Scale(Spell_Fireball._FireballMaxDistancePerLevel[this.level] / distance).Round();
        }

        var targetCell = heroCell.Add(moveVec);

        spawnBullet(
            this._caster.hordeUnit,  // Игра будет считать, что именно этот юнит запустил снаряд
            null,
            null,
            Spell_Fireball._BulletConfig,
            Spell_Fireball._ShotParamsPerLevel[this.level],
            this._caster.hordeUnit.Position.ToPoint2D(),
            targetCell.Scale(32).Add(new Cell(16, 16)).ToHordePoint(),
            UnitMapLayer.Main
        );

        return false;
    }
}
