// Mods/DefenceFromTeimur/Scripts/Spells/Magic/Spell_Homing_Fireball.ts
import { ACommandArgs, BaseBullet, BulletConfig, BulletEmittingArgs, BulletState, DiplomacyStatus, ShotParams, Stride_Color, Unit, UnitCommandConfig, UnitMapLayer } from "library/game-logic/horde-types";
import { HordeColor, createPF, createPoint } from "library/common/primitives";
import { IUnitCaster } from "../IUnitCaster";
import { setBulletInitializeWorker, setBulletProcessWorker } from "library/game-logic/workers";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import { iterateOverUnitsInBox } from "library/game-logic/unit-and-map";
import {ISpell, SpellRefData} from "../ISpell";
import { log } from "library/common/logging";
import {CreateHordeBulletConfig} from "../../Units/IConfig";
import {Cell} from "../../Core/Cell";

export class Spell_Homing_Fireball extends ISpell {
    protected static _ButtonUid: string = "Spell_Homing_Fireball";
    protected static _ButtonAnimationsCatalogUid: string = "#AnimCatalog_Command_Homing_Fireball";
    protected static _EffectStrideColor: Stride_Color = new Stride_Color(255, 60, 60, 255);
    protected static _EffectHordeColor: HordeColor = new HordeColor(255, 60, 60, 255);
    protected static _DamagePerLevel: Array<number> = [50, 60, 70, 80, 90];
    protected static _BulletSpeed: number = 15;
    protected static _HomingStrength: number = 0.5; // Процент от скорости, на который снаряд корректирует направление
    protected static _MaxDistance: number = 100; // Максимальная дистанция для самонаведения
    protected static _Acceleration: number = 1.5; // Ускорение при прицеливании
    protected static _MaxSpeed: number = 30; // Максимальная скорость снаряда
    protected static _Friction: number = 0.95; // Коэффициент трения (для инерции)

    private static _Init: boolean = false;
    private static _BulletConfig: BulletConfig;
    private static _ShotParams: ShotParams;

    public static GetCommandConfig(slotNum: number, level: number): UnitCommandConfig {
        var config = super.GetCommandConfig(slotNum, level);

        if (!this._Init) {
            this._BulletConfig = CreateHordeBulletConfig("#BulletConfig_DragonFire", "#BulletConfig_Spell_homing_fireball");
            
            // убираем дружественный огонь у огня
            ScriptUtils.SetValue(this._BulletConfig, "CanDamageAllied", false);

            this._ShotParams = ShotParams.CreateInstance();
            ScriptUtils.SetValue(this._ShotParams, "Damage", 10);
            ScriptUtils.SetValue(this._ShotParams, "AdditiveBulletSpeed", createPF(0, 0));

            setBulletInitializeWorker("ISPELL", this._BulletConfig, this._HomingInitializeWorker);
            setBulletProcessWorker("ISPELL", this._BulletConfig, this._HomingProcessWorker);
        }

        return config;
    }

    constructor(caster: IUnitCaster, ...spellArgs: any[]) {
        super(caster, spellArgs);
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            var pos = this._caster.hordeUnit.Position.ToPoint2D();
            // Создаем снаряд с самонаведением
            spawnBullet(
                this._caster.hordeUnit,  // Игра будет считать, что именно этот юнит запустил снаряд
                null,
                null,
                Spell_Homing_Fireball._BulletConfig,
                Spell_Homing_Fireball._ShotParams,
                pos,
                createPoint(pos.X + 1, pos.Y),
                UnitMapLayer.Main
            );
            return true;
        }
        return false;
    }

    private static _HomingInitializeWorker(bullet: BaseBullet, emitArgs: BulletEmittingArgs): void {
        // Инициализация снаряда с параметрами самонаведения
        bullet.ScriptData.homingTarget = null;
        bullet.ScriptData.homingStrength = this._HomingStrength;
        bullet.ScriptData.maxDistance = this._MaxDistance;
        bullet.ScriptData.velocity = createPF(0, 0); // Начальная скорость
        bullet.ScriptData.acceleration = createPF(0, 0); // Начальное ускорение
        bullet.ScriptData.endTick = Battle.GameTimer.GameFramesCounter + 10*50;
    }

    private static _HomingProcessWorker(bullet: BaseBullet): void {
        // время жизни снаряда закончилось
        if (bullet.ScriptData.endTick < Battle.GameTimer.GameFramesCounter) {
            ScriptUtils.SetValue(bullet, "State", BulletState.ReachedTheGoal);
            return;
        }

        // обновляем анимацию
        bullet.UpdateAnimation();
        // автоматический полет снаряда
        bullet.DistanceDecrease();

        // Самонаведение на цель
        if (!bullet.ScriptData.homingTarget) {
            // Если цель не установлена, ищем ближайшего врага
            bullet.ScriptData.homingTarget = this._FindNearestEnemy(bullet, -1);
        }

        if (bullet.ScriptData.homingTarget) {
            const dx = bullet.ScriptData.homingTarget.Position.X - bullet.Position.X;
            const dy = bullet.ScriptData.homingTarget.Position.Y - bullet.Position.Y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            var   speed : number = 0.0;

            // Если цель в пределах максимальной дистанции
            if (distance < bullet.ScriptData.maxDistance) {
                // Рассчитываем направление к цели
                const angle = Math.atan2(dy, dx);
                const direction = createPoint(Math.cos(angle), Math.sin(angle));

                // Применяем ускорение к направлению
                const acceleration = createPoint(
                    direction.X * this._Acceleration,
                    direction.Y * this._Acceleration
                );

                // Обновляем ускорение снаряда
                bullet.ScriptData.acceleration = acceleration;

                // Обновляем скорость с учетом ускорения и трения
                bullet.ScriptData.velocity.X = 
                    bullet.ScriptData.velocity.X * this._Friction + 
                    acceleration.X;
                bullet.ScriptData.velocity.Y = 
                    bullet.ScriptData.velocity.Y * this._Friction + 
                    acceleration.Y;

                // Ограничиваем скорость
                speed = Math.sqrt(
                    bullet.ScriptData.velocity.X * bullet.ScriptData.velocity.X +
                    bullet.ScriptData.velocity.Y * bullet.ScriptData.velocity.Y
                );
                if (speed > this._MaxSpeed) {
                    const factor = this._MaxSpeed / speed;
                    bullet.ScriptData.velocity.X *= factor;
                    bullet.ScriptData.velocity.Y *= factor;
                }
            } else {
                // Если цель вне зоны, замедляем снаряд
                bullet.ScriptData.velocity.X *= this._Friction;
                bullet.ScriptData.velocity.Y *= this._Friction;
            }

            // Обновляем позицию снаряда на основе скорости
            bullet.SetTargetPosition(
                createPoint(
                    bullet.Position.X + bullet.ScriptData.velocity.X,
                    bullet.Position.Y + bullet.ScriptData.velocity.Y
                ),
                createPF(1, 0) // Используем 1, так как движение уже учитывает скорость
            );
            // запоминаем кадр анимации
            const frame = bullet.Visual.Animator.CurrentAnimFrame;
            // обновляем анимацию, чтобы снаряд был повернут в сторону цели
            bullet.SetupAnimation();
            // кадр будет 0-ой, поэтому устанавливаем сохраненный
            bullet.Visual.Animator.SetFrame(frame);
        }

        // выбираем следующую цель
        if (bullet.ScriptData.homingTarget && !bullet.ScriptData.homingTarget.IsAlive) {
            bullet.ScriptData.homingTarget = this._FindNearestEnemy(bullet, bullet.ScriptData.homingTarget.Id);
            bullet.DamageCell(false);
        }
    }

    private static _FindNearestEnemy(bullet: BaseBullet, ignoredUnitId: number): Unit | null {
        let unitsIter = iterateOverUnitsInBox(Cell.ConvertHordePoint(bullet.Position).Scale(1/32).Round().ToHordePoint(), 15);
        for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
            if (!u.value.IsDead
                && SpellRefData.diplomacyTable[parseInt(bullet.SourceUnit.Owner.Uid)][parseInt(u.value.Owner.Uid)]
                === DiplomacyStatus.War
                && u.value.Cfg.IsBuilding == false
                && u.value.Id != ignoredUnitId) {
                log.info("Нашли ближайшего ид ", u.value.Id);
                return u.value;
            }
        }

        return null;
    }
}