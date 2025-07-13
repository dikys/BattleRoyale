import { log } from "library/common/logging";
import { IHero } from "./Heroes/IHero";
import { HeroBot, FireMageBot, WarriorBot, NecromancerBot, RogueBot } from "./HeroBot";

/**
 * Менеджер ботов для героев
 */
export class HeroBotManager {
    private static _instance: HeroBotManager;
    private _bots: Map<string, HeroBot> = new Map();
    private _isEnabled: boolean = false;

    public static getInstance(): HeroBotManager {
        if (!HeroBotManager._instance) {
            HeroBotManager._instance = new HeroBotManager();
        }
        return HeroBotManager._instance;
    }

    /**
     * Включение/выключение ботов
     */
    public setEnabled(enabled: boolean): void {
        this._isEnabled = enabled;
        log.info(`Hero bots ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Регистрация героя для управления ботом
     */
    public registerHero(hero: IHero): void {
        if (!hero || hero.IsDead()) return;

        const heroId = this._getHeroId(hero);
        if (this._bots.has(heroId)) return;

        // Создаем подходящего бота в зависимости от типа героя
        const bot = this._createBotForHero(hero);
        this._bots.set(heroId, bot);
        
        log.info(`Registered bot for hero: ${heroId}`);
    }

    /**
     * Отмена регистрации героя
     */
    public unregisterHero(hero: IHero): void {
        const heroId = this._getHeroId(hero);
        if (this._bots.has(heroId)) {
            this._bots.delete(heroId);
            log.info(`Unregistered bot for hero: ${heroId}`);
        }
    }

    /**
     * Обновление всех ботов
     */
    public onEveryTick(gameTickNum: number): void {
        if (!this._isEnabled) return;

        for (const [heroId, bot] of this._bots.entries()) {
            try {
                const isAlive = bot.onEveryTick(gameTickNum);
                if (!isAlive) {
                    // Герой умер, удаляем бота
                    this._bots.delete(heroId);
                    log.info(`Bot removed for dead hero: ${heroId}`);
                }
            } catch (error) {
                log.error(`Error in bot for hero ${heroId}: ${error}`);
            }
        }
    }

    /**
     * Создание бота подходящего типа для героя
     */
    private _createBotForHero(hero: IHero): HeroBot {
        const heroConfig = hero.hordeUnit.Cfg;
        const heroName = heroConfig.Name?.toLowerCase() || '';

        // Определяем тип героя по имени или характеристикам
        if (heroName.includes('маг') || heroName.includes('mage') || 
            heroName.includes('волшебник') || heroName.includes('wizard')) {
            return new FireMageBot(hero);
        }
        
        if (heroName.includes('воин') || heroName.includes('warrior') ||
            heroName.includes('рыцарь') || heroName.includes('knight')) {
            return new WarriorBot(hero);
        }
        
        if (heroName.includes('некромант') || heroName.includes('necromancer') ||
            heroName.includes('мертвец') || heroName.includes('undead')) {
            return new NecromancerBot(hero);
        }
        
        if (heroName.includes('разбойник') || heroName.includes('rogue') ||
            heroName.includes('вор') || heroName.includes('thief') ||
            heroName.includes('убийца') || heroName.includes('assassin')) {
            return new RogueBot(hero);
        }

        // По умолчанию создаем базового бота
        return new HeroBot(hero);
    }

    /**
     * Получение уникального ID героя
     */
    private _getHeroId(hero: IHero): string {
        return `${hero.hordeUnit.Owner.Uid}_${hero.hordeUnit.Id}`;
    }

    /**
     * Получение статистики ботов
     */
    public getStats(): { totalBots: number; activeBots: number } {
        return {
            totalBots: this._bots.size,
            activeBots: Array.from(this._bots.values()).filter(bot => !bot['_hero'].IsDead()).length
        };
    }
}

/**
 * Интегратор для автоматического подключения ботов к героям
 */
export class HeroBotIntegrator {
    private _manager: HeroBotManager;
    private _autoRegisterEnabled: boolean = true;
    private _registeredHeroes: Set<string> = new Set();

    constructor() {
        this._manager = HeroBotManager.getInstance();
    }

    /**
     * Включение/выключение автоматической регистрации героев
     */
    public setAutoRegister(enabled: boolean): void {
        this._autoRegisterEnabled = enabled;
    }

    /**
     * Принудительная регистрация всех героев на карте
     */
    public registerAllHeroes(): void {
        // TODO: Реализовать поиск всех героев на карте через API игры
        // Это заглушка для компиляции
        log.info("registerAllHeroes called - implementation needed");
    }

    /**
     * Регистрация конкретного героя
     */
    public registerHero(hero: IHero): void {
        const heroId = `${hero.hordeUnit.Owner.Uid}_${hero.hordeUnit.Id}`;
        if (!this._registeredHeroes.has(heroId)) {
            this._manager.registerHero(hero);
            this._registeredHeroes.add(heroId);
        }
    }

    /**
     * Основной цикл обновления
     */
    public onEveryTick(gameTickNum: number): void {
        // Автоматическая регистрация новых героев
        if (this._autoRegisterEnabled && gameTickNum % 250 === 0) { // Каждые 5 секунд
            this._scanForNewHeroes();
        }

        // Обновление всех ботов
        this._manager.onEveryTick(gameTickNum);
    }

    /**
     * Поиск новых героев для регистрации
     */
    private _scanForNewHeroes(): void {
        // TODO: Реализовать сканирование карты на предмет новых героев
        // Это заглушка для компиляции
    }

    /**
     * Включение ботов
     */
    public enableBots(): void {
        this._manager.setEnabled(true);
    }

    /**
     * Выключение ботов
     */
    public disableBots(): void {
        this._manager.setEnabled(false);
    }

    /**
     * Получение менеджера ботов
     */
    public getManager(): HeroBotManager {
        return this._manager;
    }
}