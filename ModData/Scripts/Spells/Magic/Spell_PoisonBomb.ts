import { createPF, HordeColor } from "library/common/primitives";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import { ACommandArgs, BulletConfig, DiplomacyStatus, ShotParams, Stride_Color, UnitCommandConfig, UnitFlags, UnitHurtType, UnitMapLayer, VisualEffectConfig } from "library/game-logic/horde-types";
import { ITargetPointSpell } from "../ITargetPointSpell";
import { IUnitCaster } from "../IUnitCaster";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { iterateOverUnitsInBox } from "library/game-logic/unit-and-map";
import { log } from "library/common/logging";
import { IUnit } from "../../Units/IUnit";
import {Cell} from "../../Core/Cell";
import {SpellRefData} from "../ISpell";

export class Spell_PoisonBomb extends ITargetPointSpell {
    protected static _ButtonUid                     : string = "Spell_PoisonBomb";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_PoisonBomb";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(0, 200, 0, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 0, 200, 0);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(2, 0);

    private static _Init : boolean = false;
    private static _BombConfig : BulletConfig;
    private static _BombShotParams : ShotParams;

    private static _MaxDistance : number = 10;
    private static _CloudEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_BloodGreenPool");
    private static _CloudDurationPerLevel : Array<number> = [
        4, 6, 8, 10, 12
    ].map(sec => sec * 50);
    private static _CloudDamagePerLevel : Array<number> = [
        1, 1.5, 2, 2.5, 3
    ];
    protected static _ChargesCountPerLevel   : Array<number> = [
        1, 2, 3, 4, 5
    ];
    private static _CloudRadius : number = 2;
    private static _CloudApplyPeriod : number = 1.2*50;

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Ядовитая бомба";
    protected static _DescriptionTemplate           : string =
        "Запускает ядовитую бомбу в выбранном направлении до " + Spell_PoisonBomb._MaxDistance
        + " клеток, которая распространяет яд вокруг попавшей клетки в области "
        + (2*Spell_PoisonBomb._CloudRadius + 1) + "x" + (2*Spell_PoisonBomb._CloudRadius + 1)
        + ". Яд наносит врагам суммарно {0} магического урона (игнорирует броню) в течении {1}."
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._CloudDurationPerLevel.map((duration, level) => {
            return Math.round(duration / this._CloudApplyPeriod * this._CloudDamagePerLevel[level]);
        }), this._CloudDurationPerLevel.map(ticks => ticks / 50)];

    ///////////////////////////////////

    // @ts-ignore
    private _cloudApplyTick : number;
    // @ts-ignore
    private _cloudDeltaDamage : number;
    private _targetUnits : Array<IUnit>;

    constructor(caster: IUnitCaster) {
        super(caster);

        this._targetUnits = new Array<IUnit>();
    }

    public static GetCommandConfig(slotNum: number, level: number) : UnitCommandConfig {
        var config = super.GetCommandConfig(slotNum, level);

        if (!this._Init) {
            this._BombConfig = HordeContentApi.GetBulletConfig("#BulletConfig_CatapultBomb");
            this._BombShotParams = ShotParams.CreateInstance();
            ScriptUtils.SetValue(this._BombShotParams, "Damage", 1);
            ScriptUtils.SetValue(this._BombShotParams, "AdditiveBulletSpeed", createPF(0, 0));
        }

        return config;
    }

    public Activate(activateArgs: ACommandArgs) : boolean {
        if (super.Activate(activateArgs)) {
            var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            var moveVec  = this._targetCell.Minus(heroCell);
    
            // максимальная дистанция
            var distance = moveVec.Length_Chebyshev();
            if (distance > Spell_PoisonBomb._MaxDistance) {
                moveVec = moveVec.Scale(Spell_PoisonBomb._MaxDistance / distance).Round();
            }
    
            var targetCell = heroCell.Add(moveVec);
            spawnBullet(
                this._caster.hordeUnit,  // Игра будет считать, что именно этот юнит запустил снаряд
                null,
                null,
                Spell_PoisonBomb._BombConfig,
                Spell_PoisonBomb._BombShotParams,
                this._caster.hordeUnit.Position.ToPoint2D(),
                targetCell.Scale(32).Add(new Cell(16, 16)).ToHordePoint(),
                UnitMapLayer.Main
            );

            let unitsIter = iterateOverUnitsInBox(this._targetCell.ToHordePoint(), Spell_PoisonBomb._CloudRadius);
            for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
                if (SpellRefData.diplomacyTable[parseInt(this._caster.hordeUnit.Owner.Uid)][parseInt(u.value.Owner.Uid)]
                    == DiplomacyStatus.War
                    && !u.value.Cfg.Flags.HasFlag(UnitFlags.MagicResistant)) {
                    if (u.value.ScriptData.IUnit) {
                        this._targetUnits.push(u.value.ScriptData.IUnit);
                    } else {
                        this._targetUnits.push(new IUnit(u.value, 0));
                    }
                    log.info("targetUnits = ", u.value.Cfg.Name);
                }
            }

            this._cloudApplyTick = this._activatedTick;
            this._cloudDeltaDamage = 0;

            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        var isApply = this._cloudApplyTick <= gameTickNum;
        var isEnd   = this._activatedTick + Spell_PoisonBomb._CloudDurationPerLevel[this.level] < gameTickNum;
 
        if (isApply || isEnd) {
            this._cloudApplyTick +=  Spell_PoisonBomb._CloudApplyPeriod;

            var cloudDamage = Spell_PoisonBomb._CloudDamagePerLevel[this.level] + this._cloudDeltaDamage;
            this._cloudDeltaDamage = cloudDamage - Math.floor(cloudDamage);
            cloudDamage = Math.floor(cloudDamage);

            if (cloudDamage > 0) {
                for (var unitNum = 0; unitNum < this._targetUnits.length; unitNum++) {
                    if (this._targetUnits[unitNum].hordeUnit.IsDead) {
                        this._targetUnits.splice(unitNum--, 1);
                        continue;
                    }

                    var targetUnit = this._targetUnits[unitNum].hordeUnit;
                    this._caster.hordeUnit.BattleMind.CauseDamage(targetUnit,
                        cloudDamage + targetUnit.Cfg.Shield,
                        UnitHurtType.Any);

                    spawnDecoration(
                        ActiveScena.GetRealScena(),
                        Spell_PoisonBomb._CloudEffect,
                        Cell.ConvertHordePoint(targetUnit.Cell).Scale(32).Add(new Cell(16, 16)).ToHordePoint());
                }
            }
        }

        if (isEnd) {
            this._targetUnits.splice(0);

            return false;
        }

        return true;
    }
}
