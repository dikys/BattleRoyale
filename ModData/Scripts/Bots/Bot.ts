import { IHero } from "../Heroes/IHero";
import { GameField } from "../Core/GameField";
import { PlayerSettlement } from "../Core/PlayerSettlement";
import { GameSettlement } from "../Core/GameSettlement";
import { IHero } from "../Heroes/IHero";
import { GameField } from "../Core/GameField";
import { PlayerSettlement } from "../Core/PlayerSettlement";
import { GameSettlement } from "../Core/GameSettlement";
import { IUnit } from "../Units/IUnit";
import { Cell } from "../Core/Cell";
import { log } from "library/common/logging";
import { DiplomacyStatus, UnitFlags } from "library/game-logic/horde-types";
import { Priest } from "../Units/Priest";

/**
 * @enum BotStrategy
 * @description Перечисление возможных стратегий поведения бота.
 */
enum BotStrategy {
    ATTACK_BUILDING, // Атака зданий для получения юнитов
    ATTACK_ENEMY_HERO, // Атака вражеского героя
    FARM_NEUTRALS, // Фарм нейтральных юнитов
    RETREAT, // Отступление
    HEAL, // Поиск лечения
    EXPLORE // Исследование карты
}

/**
 * @class Bot
 * @description Управляет поведением искусственного интеллекта (бота) в игре.
 * Отвечает за принятие решений и управление героем и его армией.
 */
export class Bot {
    // =================================================================================================================
    // СВОЙСТВА
    // =================================================================================================================

    /**
     * @property {IHero} hero - Герой, которым управляет бот.
     * @private
     */
    private hero: IHero;

    /**
     * @property {GameField} gameField - Игровое поле, на котором происходят действия.
     * @private
     */
    private gameField: GameField;

    /**
     * @property {PlayerSettlement} playerSettlement - Поселение, принадлежащее боту.
     * @private
     */
    private playerSettlement: PlayerSettlement;

    /**
     * @property {GameSettlement} enemySettlement - Поселение врага (для спавна нейтральных/вражеских юнитов).
     * @private
     */
    private enemySettlement: GameSettlement;

    /**
     * @property {GameSettlement} neutralSettlement - Нейтральное поселение.
     * @private
     */
    private neutralSettlement: GameSettlement;

    /**
     * @property {number} lastTickProcessed - Последний тик, в который производилась обработка логики бота.
     * @private
     */
    private lastTickProcessed: number = 0;


    // =================================================================================================================
    // КОНСТРУКТОР
    // =================================================================================================================

    /**
     * @constructor
     * @param {IHero} hero - Герой, которым будет управлять бот.
     * @param {GameField} gameField - Игровое поле.
     * @param {PlayerSettlement} playerSettlement - Поселение бота.
     * @param {GameSettlement} enemySettlement - Вражеское поселение.
     * @param {GameSettlement} neutralSettlement - Нейтральное поселение.
     */
    constructor(hero: IHero, gameField: GameField, playerSettlement: PlayerSettlement, enemySettlement: GameSettlement, neutralSettlement: GameSettlement) {
        this.hero = hero;
        this.gameField = gameField;
        this.playerSettlement = playerSettlement;
        this.enemySettlement = enemySettlement;
        this.neutralSettlement = neutralSettlement;
    }


    // =================================================================================================================
    // ОСНОВНОЙ МЕТОД ОБНОВЛЕНИЯ
    // =================================================================================================================

    /**
     * @method OnEveryTick
     * @description Вызывается на каждом тике игрового цикла. Основная точка входа для логики бота.
     * @param {number} gameTickNum - Текущий номер тика игры.
     */
    public OnEveryTick(gameTickNum: number): void {
        // Ограничиваем частоту обработки для оптимизации производительности
        if (gameTickNum - this.lastTickProcessed < 50) { // Например, обрабатываем раз в 50 тиков
            return;
        }
        this.lastTickProcessed = gameTickNum;

        // 1. Сбор информации (анализ обстановки)
        const threats = this.AnalyzeThreats();
        const opportunities = this.AnalyzeOpportunities();

        // 2. Принятие решений (выбор стратегии)
        const currentStrategy = this.ChooseStrategy(threats, opportunities);

        // 3. Выполнение действий
        this.ExecuteStrategy(currentStrategy);
    }


    // =================================================================================================================
    // ЭТАП 1: СБОР ИНФОРМАЦИИ
    // =================================================================================================================

    /**
     * @method AnalyzeThreats
     * @description Анализирует окружение на наличие угроз (вражеские юниты, опасные зоны).
     * @returns {any[]} - Массив обнаруженных угроз.
     * @private
     */
    private AnalyzeThreats(): IUnit[] {
        const threats: IUnit[] = [];
        const heroPosition = Cell.ConvertHordePoint(this.hero.hordeUnit.Cell);
        const visionRadius = this.hero.hordeUnit.Cfg.Sight;

        // 1. Поиск вражеских юнитов
        const enumerator = ActiveScena.GetRealScena().Units.GetEnumerator();
        while (enumerator.MoveNext()) {
            const unit = enumerator.Current;
            if (!unit || unit.IsDead || unit.Owner.Uid === this.playerSettlement.settlementUid.toString()) {
                continue;
            }

            // Проверяем, что это враг
            const diplomacy = this.playerSettlement.hordeSettlement.Diplomacy.GetDiplomacyStatus(unit.Owner);
            if (diplomacy === DiplomacyStatus.War) {
                const unitPosition = Cell.ConvertHordePoint(unit.Cell);
                if (heroPosition.Minus(unitPosition).Length_L2() <= visionRadius) {
                    threats.push(new IUnit(unit));
                }
            }
        }
        enumerator.Dispose();

        // 2. Проверка нахождения в опасной зоне (вне круга)
        const currentCircle = this.gameField.CurrentCircle();
        if (currentCircle && heroPosition.Minus(currentCircle.center).Length_L2() > currentCircle.radius) {
            // Герой вне круга - это главная угроза. Можно добавить "виртуальную" угрозу.
            log.info("Bot: Hero is outside the safe circle!");
        }
        
        if (threats.length > 0) {
            log.info(`Bot: Found ${threats.length} threats.`);
        }

        return threats;
    }

    /**
     * @method AnalyzeOpportunities
     * @description Анализирует окружение на наличие возможностей (ресурсы, слабые цели, здания).
     * @returns {any[]} - Массив обнаруженных возможностей.
     * @private
     */
    private AnalyzeOpportunities(): IUnit[] {
        const opportunities: IUnit[] = [];
        const heroPosition = Cell.ConvertHordePoint(this.hero.hordeUnit.Cell);
        const visionRadius = this.hero.hordeUnit.Cfg.Sight * 1.5; // Ищем возможности в большем радиусе

        const enumerator = ActiveScena.GetRealScena().Units.GetEnumerator();
        while (enumerator.MoveNext()) {
            const unit = enumerator.Current;
            if (!unit || unit.IsDead) {
                continue;
            }

            // Ищем нейтральные здания (принадлежат вражескому поселению) и знахарей (нейтралы)
            const isNeutralBuilding = unit.Owner.Uid === this.enemySettlement.hordeSettlement.Uid && unit.Cfg.Flags.HasFlag(UnitFlags.Building);
            const isPriest = unit.Cfg.Uid === Priest.GetHordeConfig().Uid
                                && unit.Owner.Uid === this.neutralSettlement.hordeSettlement.Uid;

            if (isNeutralBuilding || isPriest) {
                 const unitPosition = Cell.ConvertHordePoint(unit.Cell);
                if (heroPosition.Minus(unitPosition).Length_L2() <= visionRadius) {
                    opportunities.push(new IUnit(unit));
                }
            }
        }
        enumerator.Dispose();
        
        if (opportunities.length > 0) {
            log.info(`Bot: Found ${opportunities.length} opportunities.`);
        }

        return opportunities;
    }


    // =================================================================================================================
    // ЭТАП 2: ПРИНЯТИЕ РЕШЕНИЙ
    // =================================================================================================================

    /**
     * @method ChooseStrategy
     * @description Выбирает наилучшую стратегию на основе анализа обстановки.
     * @param {any[]} threats - Список угроз.
     * @param {any[]} opportunities - Список возможностей.
     * @returns {BotStrategy} - Выбранная стратегия.
     * @private
     */
    private ChooseStrategy(threats: IUnit[], opportunities: IUnit[]): BotStrategy {
        // TODO: Реализовать логику выбора стратегии.
        // - Если здоровье героя низкое, выбрать RETREAT или HEAL.
        // - Если рядом сильный враг, выбрать RETREAT.
        // - Если рядом есть незащищенное здание, выбрать ATTACK_BUILDING.
        // - Если армия бота сильнее армии врага, выбрать ATTACK_ENEMY_HERO.
        // - В остальных случаях выбрать EXPLORE.
        log.info("Bot: Choosing strategy...");
        if (threats.length > 0) {
            return BotStrategy.RETREAT;
        }
        if (opportunities.length > 0) {
            return BotStrategy.ATTACK_BUILDING;
        }
        return BotStrategy.EXPLORE; // По умолчанию - исследование
    }


    // =================================================================================================================
    // ЭТАП 3: ВЫПОЛНЕНИЕ ДЕЙСТВИЙ
    // =================================================================================================================

    /**
     * @method ExecuteStrategy
     * @description Выполняет действия в соответствии с выбранной стратегией.
     * @param {BotStrategy} strategy - Стратегия для выполнения.
     * @private
     */
    private ExecuteStrategy(strategy: BotStrategy): void {
        log.info(`Bot: Executing strategy - ${BotStrategy[strategy]}`);
        switch (strategy) {
            case BotStrategy.ATTACK_BUILDING:
                this.ExecuteAttackBuilding();
                break;
            case BotStrategy.ATTACK_ENEMY_HERO:
                this.ExecuteAttackEnemyHero();
                break;
            case BotStrategy.RETREAT:
                this.ExecuteRetreat();
                break;
            case BotStrategy.EXPLORE:
                this.ExecuteExplore();
                break;
            // ... другие стратегии
        }

        // Также здесь можно управлять использованием способностей героя.
        this.ManageAbilities();
    }

    /**
     * @method ExecuteAttackBuilding
     * @description Логика атаки на здание.
     * @private
     */
    private ExecuteAttackBuilding(): void {
        // TODO: Найти ближайшее здание и отдать приказ атаковать.
        log.info("Bot Action: Attacking building.");
    }

    /**
     * @method ExecuteAttackEnemyHero
     * @description Логика атаки на вражеского героя.
     * @private
     */
    private ExecuteAttackEnemyHero(): void {
        // TODO: Найти вражеского героя и отдать приказ атаковать.
        log.info("Bot Action: Attacking enemy hero.");
    }

    /**
     * @method ExecuteRetreat
     * @description Логика отступления.
     * @private
     */
    private ExecuteRetreat(): void {
        // TODO: Найти безопасную точку и отдать приказ двигаться к ней.
        log.info("Bot Action: Retreating.");
    }

    /**
     * @method ExecuteExplore
     * @description Логика исследования карты.
     * @private
     */
    private ExecuteExplore(): void {
        // TODO: Выбрать случайную точку на карте (в пределах безопасной зоны) и двигаться к ней.
        log.info("Bot Action: Exploring.");
        const targetCell = this.FindRandomPointToExplore();
        if (targetCell) {
            this.hero.SmartMoveTo(targetCell);
        }
    }

    /**
     * @method ManageAbilities
     * @description Управляет использованием способностей героя.
     * @private
     */
    private ManageAbilities(): void {
        // TODO: Проверить, можно ли использовать способность, и если да, то применить ее.
        // Например, если рядом много врагов, использовать АОЕ-способность.
    }


    // =================================================================================================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // =================================================================================================================

    /**
     * @method FindRandomPointToExplore
     * @description Находит случайную, но достижимую точку на карте для исследования.
     * @returns {Cell | null} - Координаты точки или null, если найти не удалось.
     * @private
     */
    private FindRandomPointToExplore(): Cell | null {
        const currentCircle = this.gameField.CurrentCircle();
        if (!currentCircle) {
            return null; // Некуда исследовать, если круга нет
        }

        // Генерируем случайную точку внутри текущего круга
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * currentCircle.radius;
        const point = new Cell(
            currentCircle.center.X + Math.cos(angle) * radius,
            currentCircle.center.Y + Math.sin(angle) * radius
        ).Scale(1/32).Round();

        // Проверяем, достижима ли точка
        if (this.gameField.IsAchievableCell(point)) {
            return point;
        }

        return null; // Не удалось найти точку
    }
}
