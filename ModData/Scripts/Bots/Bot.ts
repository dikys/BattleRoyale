import { log, LogLevel } from "library/common/logging";
import { createPoint, Point2D } from "library/common/primitives";
import { generateCellInSpiral } from "library/common/position-tools";
import { DiplomacyStatus, Settlement, Unit, UnitCommand } from "library/game-logic/horde-types";
import { IHero } from "../Heroes/IHero";
import { Cell } from "../Core/Cell";
import { ISpell } from "../Spells/ISpell";

/**
 * Состояние бота
 */
export enum BotState {
    PATROLLING,     // Патрулирование и поиск целей
    ATTACKING,      // Атака противника или здания
    RETREATING,     // Отступление при низком здоровье
    HEALING,        // Поиск лечения
    PURSUING        // Преследование отступающего противника
}

/**
 * Тип цели
 */
export enum TargetType {
    ENEMY_UNIT,     // Вражеский юнит
    ENEMY_BUILDING, // Вражеское здание
    HEAL_SOURCE,    // Источник лечения
    PATROL_POINT    // Точка патрулирования
}

/**
 * Информация о цели
 */
export interface TargetInfo {
    unit: Unit | null;
    cell: Cell;
    type: TargetType;
    priority: number;
    distance: number;
    lastSeenTick: number;
}

/**
 * Класс бота для управления героем
 */
export class HeroBot {
    protected _hero: IHero;
    protected _state: BotState;
    protected _currentTarget: TargetInfo | null;
    protected _patrolPoints: Cell[];
    protected _currentPatrolIndex: number;
    protected _lastStateChange: number;
    protected _lastHealthCheck: number;
    protected _lastAbilityUse: number;
    
    // Настройки поведения
    private static readonly CRITICAL_HEALTH_THRESHOLD = 0.3;    // 30% здоровья
    private static readonly LOW_HEALTH_THRESHOLD = 0.5;          // 50% здоровья
    private static readonly SIGHT_RANGE = 16;                    // Радиус обзора
    private static readonly PATROL_RADIUS = 20;                 // Радиус патрулирования
    private static readonly MIN_ARMY_STRENGTH = 0.7;            // Минимальная сила армии для атаки
    private static readonly RETREAT_DISTANCE = 10;              // Дистанция отступления
    private static readonly ABILITY_COOLDOWN = 100;             // Минимальный интервал между способностями

    constructor(hero: IHero) {
        this._hero = hero;
        this._state = BotState.PATROLLING;
        this._currentTarget = null;
        this._patrolPoints = this._generatePatrolPoints();
        this._currentPatrolIndex = 0;
        this._lastStateChange = 0;
        this._lastHealthCheck = 0;
        this._lastAbilityUse = 0;
    }

    /**
     * Основной цикл обновления бота
     */
    public onEveryTick(gameTickNum: number): boolean {
        if (this._hero.IsDead()) {
            return false;
        }

        // Мониторинг здоровья
        this._checkHealth(gameTickNum);

        // Обновление состояния
        this._updateState(gameTickNum);

        // Выполнение действий в зависимости от состояния
        switch (this._state) {
            case BotState.PATROLLING:
                this._handlePatrolling(gameTickNum);
                break;
            case BotState.ATTACKING:
                this._handleAttacking(gameTickNum);
                break;
            case BotState.RETREATING:
                this._handleRetreating(gameTickNum);
                break;
            case BotState.HEALING:
                this._handleHealing(gameTickNum);
                break;
            case BotState.PURSUING:
                this._handlePursuing(gameTickNum);
                break;
        }

        // Использование способностей
        this._useAbilities(gameTickNum);

        return true;
    }

    /**
     * Мониторинг здоровья героя
     */
    private _checkHealth(gameTickNum: number): void {
        if (gameTickNum - this._lastHealthCheck < 25) return; // Проверяем каждые 0.5 секунды
        this._lastHealthCheck = gameTickNum;

        const healthRatio = this._hero.hordeUnit.Health / this._hero.hordeUnit.Cfg.MaxHealth;

        if (healthRatio <= HeroBot.CRITICAL_HEALTH_THRESHOLD) {
            if (this._state !== BotState.RETREATING && this._state !== BotState.HEALING) {
                this._setState(BotState.RETREATING, gameTickNum);
            }
        } else if (healthRatio <= HeroBot.LOW_HEALTH_THRESHOLD) {
            if (this._state === BotState.ATTACKING || this._state === BotState.PURSUING) {
                // Рассмотреть отступление в зависимости от силы противника
                if (!this._shouldContinueFighting()) {
                    this._setState(BotState.RETREATING, gameTickNum);
                }
            }
        }
    }

    /**
     * Обновление состояния бота
     */
    private _updateState(gameTickNum: number): void {
        // Поиск целей
        this._scanForTargets(gameTickNum);

        // Логика смены состояний
        if (this._state === BotState.PATROLLING && this._currentTarget) {
            if (this._currentTarget.type === TargetType.ENEMY_BUILDING || 
                this._currentTarget.type === TargetType.ENEMY_UNIT) {
                if (this._shouldAttack()) {
                    this._setState(BotState.ATTACKING, gameTickNum);
                }
            }
        }
    }

    /**
     * Обработка патрулирования
     */
    protected _handlePatrolling(gameTickNum: number): void {
        const currentCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);
        const targetPatrolPoint = this._patrolPoints[this._currentPatrolIndex];
        
        // Проверяем, достигли ли мы текущей точки патрулирования
        if (currentCell.Minus(targetPatrolPoint).Length_Chebyshev() <= 2) {
            this._currentPatrolIndex = (this._currentPatrolIndex + 1) % this._patrolPoints.length;
        }

        // Движение к точке патрулирования
        this._moveToPoint(targetPatrolPoint);
    }

    /**
     * Обработка атаки
     */
    private _handleAttacking(gameTickNum: number): void {
        if (!this._currentTarget || !this._currentTarget.unit || this._currentTarget.unit.IsDead) {
            this._setState(BotState.PATROLLING, gameTickNum);
            return;
        }

        const heroCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);
        const targetCell = Cell.ConvertHordePoint(this._currentTarget.unit.Cell);
        const distance = heroCell.Minus(targetCell).Length_Chebyshev();

        // Проверяем дистанцию атаки
        const attackRange = this._hero.hordeUnit.Cfg.MainArmament?.Range || 3;
        
        if (distance <= attackRange) {
            // Атакуем цель
            this._attackTarget(this._currentTarget.unit);
        } else {
            // Приближаемся к цели
            this._moveToPoint(targetCell);
        }

        // Проверяем, нужно ли отступать
        if (!this._shouldContinueFighting()) {
            this._setState(BotState.RETREATING, gameTickNum);
        }
    }

    /**
     * Обработка отступления
     */
    private _handleRetreating(gameTickNum: number): void {
        // Ищем ближайшую безопасную точку
        const safePoint = this._findSafeRetreatPoint();
        this._moveToPoint(safePoint);

        // Проверяем, можем ли мы прекратить отступление
        const healthRatio = this._hero.hordeUnit.Health / this._hero.hordeUnit.Cfg.MaxHealth;
        if (healthRatio > HeroBot.LOW_HEALTH_THRESHOLD && this._isInSafeArea()) {
            if (this._findHealSource()) {
                this._setState(BotState.HEALING, gameTickNum);
            } else {
                this._setState(BotState.PATROLLING, gameTickNum);
            }
        }
    }

    /**
     * Обработка лечения
     */
    private _handleHealing(gameTickNum: number): void {
        const healSource = this._findHealSource();
        if (healSource) {
            const heroCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);
            const healCell = Cell.ConvertHordePoint(healSource.Cell);
            
            if (heroCell.Minus(healCell).Length_Chebyshev() <= 3) {
                // Остаемся рядом с источником лечения
                // Здесь можно добавить логику взаимодействия с лечащими юнитами
            } else {
                this._moveToPoint(healCell);
            }
        } else {
            // Источник лечения недоступен, возвращаемся к патрулированию
            this._setState(BotState.PATROLLING, gameTickNum);
        }

        // Проверяем, восстановилось ли здоровье
        const healthRatio = this._hero.hordeUnit.Health / this._hero.hordeUnit.Cfg.MaxHealth;
        if (healthRatio >= 0.8) {
            this._setState(BotState.PATROLLING, gameTickNum);
        }
    }

    /**
     * Обработка преследования
     */
    private _handlePursuing(gameTickNum: number): void {
        if (!this._currentTarget || !this._currentTarget.unit) {
            this._setState(BotState.PATROLLING, gameTickNum);
            return;
        }

        const heroCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);
        const targetCell = Cell.ConvertHordePoint(this._currentTarget.unit.Cell);
        const distance = heroCell.Minus(targetCell).Length_Chebyshev();

        if (distance > 15) {
            // Цель слишком далеко, прекращаем преследование
            this._setState(BotState.PATROLLING, gameTickNum);
        } else {
            this._moveToPoint(targetCell);
            
            // Если догнали, переходим к атаке
            const attackRange = this._hero.hordeUnit.Cfg.MainArmament?.Range || 3;
            if (distance <= attackRange) {
                this._setState(BotState.ATTACKING, gameTickNum);
            }
        }
    }

    /**
     * Использование способностей
     */
    private _useAbilities(gameTickNum: number): void {
        if (gameTickNum - this._lastAbilityUse < HeroBot.ABILITY_COOLDOWN) return;

        // Получаем список доступных способностей
        const spells = (this._hero as any)._spells as ISpell[];
        if (!spells) return;

        for (const spell of spells) {
            if (this._shouldUseAbility(spell, gameTickNum)) {
                this._useAbility(spell, gameTickNum);
                this._lastAbilityUse = gameTickNum;
                break;
            }
        }
    }

    /**
     * Проверка, стоит ли использовать способность
     */
    protected _shouldUseAbility(spell: ISpell, gameTickNum: number): boolean {
        // Пропускаем проверку состояния заклинания - будем проверять при активации
        // if (spell._state !== SpellState.READY) return false;

        const spellName = spell.GetUid();
        const heroCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);
        const healthRatio = this._hero.hordeUnit.Health / this._hero.hordeUnit.Cfg.MaxHealth;

        // Лечащие способности
        if (spellName.includes("healing") || spellName.includes("aura")) {
            return healthRatio < HeroBot.LOW_HEALTH_THRESHOLD && this._isInSafeArea();
        }

        // Атакующие способности
        if (spellName.includes("fireball") || spellName.includes("magic")) {
            return this._state === BotState.ATTACKING && this._currentTarget && 
                   this._currentTarget.type === TargetType.ENEMY_UNIT;
        }

        // Область поражения
        if (spellName.includes("rain") || spellName.includes("bomb")) {
            const enemyCount = this._countNearbyEnemies(heroCell, 5);
            return enemyCount >= 3 || (this._state === BotState.ATTACKING && 
                   this._currentTarget?.type === TargetType.ENEMY_BUILDING);
        }

        // Телепортация
        if (spellName.includes("teleport")) {
            return this._state === BotState.RETREATING || 
                   (this._state === BotState.ATTACKING && this._currentTarget && 
                    heroCell.Minus(Cell.ConvertHordePoint(this._currentTarget.unit!.Cell)).Length_Chebyshev() > 8);
        }

        // Невидимость
        if (spellName.includes("invisibility")) {
            return this._state === BotState.RETREATING || 
                   (this._state === BotState.PATROLLING && this._hasNearbyEnemies());
        }

        // Призыв
        if (spellName.includes("summon") || spellName.includes("army")) {
            return this._state === BotState.ATTACKING && this._currentTarget && 
                   this._getArmyStrength() < HeroBot.MIN_ARMY_STRENGTH;
        }

        // Страх
        if (spellName.includes("fear")) {
            const enemyCount = this._countNearbyEnemies(heroCell, 4);
            return enemyCount >= 2;
        }

        return false;
    }

    /**
     * Использование способности
     */
    private _useAbility(spell: ISpell, gameTickNum: number): void {
        const spellName = spell.GetUid();
        
        // Определяем цель для способности
        let targetCell: Cell | null = null;
        
        if (this._currentTarget && this._currentTarget.unit) {
            targetCell = Cell.ConvertHordePoint(this._currentTarget.unit.Cell);
        } else {
            // Используем текущую позицию героя для способностей самокаста
            targetCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);
        }

        if (targetCell) {
            // Создаем аргументы команды для активации способности
            // Это упрощенная версия - в реальной реализации нужно создать правильные ACommandArgs
            const activateArgs = this._createSpellArgs(targetCell);
            spell.Activate(activateArgs);
        }
    }

    /**
     * Создание аргументов для заклинания
     */
    private _createSpellArgs(targetCell: Cell): any {
        // Упрощенная реализация - нужно создать правильные ACommandArgs
        return {
            CommandTarget: targetCell.ToHordePoint(),
            Caster: this._hero.hordeUnit
        };
    }

    /**
     * Сканирование области в поисках целей
     */
    private _scanForTargets(gameTickNum: number): void {
        const heroCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);
        let bestTarget: TargetInfo | null = null;
        let bestPriority = -1;

        // Сканируем все юниты в радиусе видимости
        // const allUnits = ActiveScena.GetRealScena().UnitsMap;
        // Здесь нужна реализация поиска юнитов в радиусе
        // Это упрощенная версия - заглушка для компиляции

        // Приоритеты целей:
        // 1. Вражеские здания (высший приоритет)
        // 2. Вражеские герои
        // 3. Вражеские юниты
        // 4. Источники лечения (при низком здоровье)

        // TODO: Реализовать поиск целей через API игры
        // if (bestTarget && bestTarget.priority > bestPriority) {
        //     this._currentTarget = bestTarget;
        // }
    }

    /**
     * Проверка, стоит ли атаковать цель
     */
    private _shouldAttack(): boolean {
        if (!this._currentTarget) return false;

        const armyStrength = this._getArmyStrength();
        const healthRatio = this._hero.hordeUnit.Health / this._hero.hordeUnit.Cfg.MaxHealth;

        // Всегда атакуем здания, если здоровье не критическое
        if (this._currentTarget.type === TargetType.ENEMY_BUILDING) {
            return healthRatio > HeroBot.CRITICAL_HEALTH_THRESHOLD;
        }

        // Атакуем юнитов только при достаточной силе
        return armyStrength >= HeroBot.MIN_ARMY_STRENGTH && 
               healthRatio > HeroBot.CRITICAL_HEALTH_THRESHOLD;
    }

    /**
     * Проверка, стоит ли продолжать бой
     */
    protected _shouldContinueFighting(): boolean {
        const healthRatio = this._hero.hordeUnit.Health / this._hero.hordeUnit.Cfg.MaxHealth;
        const armyStrength = this._getArmyStrength();

        return healthRatio > HeroBot.CRITICAL_HEALTH_THRESHOLD && 
               armyStrength >= HeroBot.MIN_ARMY_STRENGTH * 0.5;
    }

    /**
     * Получение силы армии (упрощенная версия)
     */
    private _getArmyStrength(): number {
        // Здесь должна быть реализация подсчета силы армии
        // Учитывается количество юнитов, их здоровье и боевая мощь
        return 1.0; // Заглушка
    }

    /**
     * Поиск безопасной точки для отступления
     */
    private _findSafeRetreatPoint(): Cell {
        const heroCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);
        
        // Ищем точку в противоположном направлении от врагов
        // Упрощенная реализация
        return heroCell.Add(new Cell(-HeroBot.RETREAT_DISTANCE, -HeroBot.RETREAT_DISTANCE));
    }

    /**
     * Проверка, находится ли герой в безопасной зоне
     */
    private _isInSafeArea(): boolean {
        // Проверяем отсутствие врагов поблизости
        return !this._hasNearbyEnemies();
    }

    /**
     * Поиск источника лечения
     */
    private _findHealSource(): Unit | null {
        // Здесь должен быть поиск дружественных священников или других источников лечения
        return null; // Заглушка
    }

    /**
     * Проверка наличия врагов поблизости
     */
    protected _hasNearbyEnemies(): boolean {
        const heroCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);
        return this._countNearbyEnemies(heroCell, HeroBot.SIGHT_RANGE) > 0;
    }

    /**
     * Подсчет врагов в радиусе
     */
    protected _countNearbyEnemies(center: Cell, radius: number): number {
        // Здесь должна быть реализация подсчета врагов
        return 0; // Заглушка
    }

    /**
     * Движение к точке
     */
    private _moveToPoint(targetCell: Cell): void {
        // Здесь должна быть реализация отдачи команды движения
        const targetPoint = targetCell.ToHordePoint();
        // this._hero.hordeUnit.GiveCommand(...);
    }

    /**
     * Атака цели
     */
    private _attackTarget(target: Unit): void {
        // Здесь должна быть реализация отдачи команды атаки
        // this._hero.hordeUnit.GiveCommand(...);
    }

    /**
     * Генерация точек патрулирования
     */
    private _generatePatrolPoints(): Cell[] {
        const heroCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);
        const points: Cell[] = [];
        
        // Создаем 8 точек по кругу вокруг начальной позиции
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * 2 * Math.PI;
            const x = Math.round(heroCell.X + HeroBot.PATROL_RADIUS * Math.cos(angle));
            const y = Math.round(heroCell.Y + HeroBot.PATROL_RADIUS * Math.sin(angle));
            points.push(new Cell(x, y));
        }
        
        return points;
    }

    /**
     * Установка состояния бота
     */
    private _setState(newState: BotState, gameTickNum: number): void {
        if (this._state !== newState) {
            log.info(`Bot state changed from ${BotState[this._state]} to ${BotState[newState]}`);
            this._state = newState;
            this._lastStateChange = gameTickNum;
            this._currentTarget = null; // Сбрасываем текущую цель при смене состояния
        }
    }
}

/**
 * Специализированные боты для разных типов героев
 */

/**
 * Бот для мага огня
 */
export class FireMageBot extends HeroBot {
    protected _shouldUseAbility(spell: ISpell, gameTickNum: number): boolean {
        const spellName = spell.GetUid();
        const heroCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);

        // Маги предпочитают атаковать с дистанции
        if (spellName.includes("fireball")) {
            return this._state === BotState.ATTACKING && this._currentTarget &&
                   heroCell.Minus(Cell.ConvertHordePoint(this._currentTarget.unit!.Cell)).Length_Chebyshev() >= 5;
        }

        if (spellName.includes("fire_arrows_rain")) {
            const enemyCount = this._countNearbyEnemies(heroCell, 8);
            return enemyCount >= 2;
        }

        return super._shouldUseAbility(spell, gameTickNum);
    }
}

/**
 * Бот для воина
 */
export class WarriorBot extends HeroBot {
    private static readonly AGGRESSIVE_HEALTH_THRESHOLD = 0.3; // Воины более агрессивны

    protected _shouldContinueFighting(): boolean {
        const healthRatio = this._hero.hordeUnit.Health / this._hero.hordeUnit.Cfg.MaxHealth;
        return healthRatio > WarriorBot.AGGRESSIVE_HEALTH_THRESHOLD;
    }

    protected _shouldUseAbility(spell: ISpell, gameTickNum: number): boolean {
        const spellName = spell.GetUid();

        // Воины используют усиливающие способности перед боем
        if (spellName.includes("battle_fury") || spellName.includes("charge")) {
            return this._state === BotState.ATTACKING;
        }

        return super._shouldUseAbility(spell, gameTickNum);
    }
}

/**
 * Бот для некроманта
 */
export class NecromancerBot extends HeroBot {
    protected _shouldUseAbility(spell: ISpell, gameTickNum: number): boolean {
        const spellName = spell.GetUid();

        // Некроманты активно используют призыв
        if (spellName.includes("army_of_dead") || spellName.includes("summon")) {
            return this._state === BotState.ATTACKING || 
                   (this._state === BotState.PATROLLING && this._hasNearbyEnemies());
        }

        if (spellName.includes("fear")) {
            // Используем страх чаще
            const enemyCount = this._countNearbyEnemies(
                Cell.ConvertHordePoint(this._hero.hordeUnit.Cell), 6);
            return enemyCount >= 1;
        }

        return super._shouldUseAbility(spell, gameTickNum);
    }
}

/**
 * Бот для разбойника
 */
export class RogueBot extends HeroBot {
    protected _shouldUseAbility(spell: ISpell, gameTickNum: number): boolean {
        const spellName = spell.GetUid();
        const heroCell = Cell.ConvertHordePoint(this._hero.hordeUnit.Cell);

        // Разбойники используют невидимость для подкрадывания
        if (spellName.includes("invisibility")) {
            return this._state === BotState.PATROLLING && this._hasNearbyEnemies() ||
                   (this._state === BotState.ATTACKING && this._currentTarget &&
                    heroCell.Minus(Cell.ConvertHordePoint(this._currentTarget.unit!.Cell)).Length_Chebyshev() > 6);
        }

        // Частое использование телепортации
        if (spellName.includes("teleport")) {
            return this._state === BotState.ATTACKING && this._currentTarget &&
                   heroCell.Minus(Cell.ConvertHordePoint(this._currentTarget.unit!.Cell)).Length_Chebyshev() > 4;
        }

        return super._shouldUseAbility(spell, gameTickNum);
    }

    protected _handlePatrolling(gameTickNum: number): void {
        // Разбойники более осторожно патрулируют, используя укрытия
        super._handlePatrolling(gameTickNum);
        
        // Здесь можно добавить логику поиска укрытий и скрытного передвижения
    }
}