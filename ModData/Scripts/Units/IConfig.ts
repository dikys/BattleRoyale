import { createPoint } from "library/common/primitives";
import { enumerate, eNext } from "library/dotnet/dotnet-utils";
import { BulletConfig, TileType, UnitCommand, UnitConfig, UnitFlags, UnitSpecification } from "library/game-logic/horde-types";
import { getUnitProfessionParams, UnitProducerProfessionParams, UnitProfession } from "library/game-logic/unit-professions";

/**
 * @function CreateHordeUnitConfig
 * @description Создает или пересоздает конфигурацию юнита на основе базовой.
 * @param {string} BaseCfgUid - UID базовой конфигурации.
 * @param {string} newCfgUid - UID для новой конфигурации.
 * @returns {UnitConfig} - Новая или обновленная конфигурация юнита.
 */
export function CreateHordeUnitConfig(BaseCfgUid: string, newCfgUid: string) : UnitConfig {
    var hordeConfig: UnitConfig;

    // при наличии конфига удаляем его
    if (HordeContentApi.HasUnitConfig(newCfgUid)) {
        hordeConfig = HordeContentApi.GetUnitConfig(newCfgUid);
        HordeContentApi.RemoveConfig(hordeConfig);
    }// else {
        hordeConfig = HordeContentApi.CloneConfig(HordeContentApi.GetUnitConfig(BaseCfgUid), newCfgUid) as UnitConfig;
    //}

    return hordeConfig;
} // </CreateHordeUnitConfig>

/**
 * @function CreateHordeBulletConfig
 * @description Создает или возвращает конфигурацию снаряда на основе базовой.
 * @param {string} baseConfigUid - UID базовой конфигурации.
 * @param {string} newConfigUid - UID для новой конфигурации.
 * @returns {BulletConfig} - Новая или существующая конфигурация снаряда.
 */
export function CreateHordeBulletConfig(baseConfigUid: string, newConfigUid: string) : BulletConfig {
    if (HordeContentApi.HasBulletConfig(newConfigUid)) {
        return HordeContentApi.GetBulletConfig(newConfigUid);
    } else {
        return HordeContentApi.CloneConfig(HordeContentApi.GetBulletConfig(baseConfigUid), newConfigUid) as BulletConfig;
    }
} // </CreateHordeBulletConfig>

/**
 * @function CfgAddUnitProducer
 * @description Добавляет или настраивает профессию "Производитель юнитов" для заданной конфигурации.
 * @param {UnitConfig} Cfg - Конфигурация юнита, которую нужно модифицировать.
 */
export function CfgAddUnitProducer(Cfg: UnitConfig) {
    // даем профессию найм войнов при отсутствии
    if (!getUnitProfessionParams(Cfg, UnitProfession.UnitProducer)) {
        var donorCfg = HordeContentApi.CloneConfig(HordeContentApi.GetUnitConfig("#UnitConfig_Slavyane_Barrack")) as UnitConfig;
        var prof_unitProducer = getUnitProfessionParams(donorCfg, UnitProfession.UnitProducer);
        Cfg.ProfessionParams.Item.set(UnitProfession.UnitProducer, prof_unitProducer);
        
        if (Cfg.BuildingConfig == null) {
            ScriptUtils.SetValue(Cfg, "BuildingConfig", donorCfg.BuildingConfig);
        }

        // добавляем точки выхода
        if (Cfg.BuildingConfig.EmergePoint == null) {
            ScriptUtils.SetValue(Cfg.BuildingConfig, "EmergePoint", createPoint(0, 0));
        }
        if (Cfg.BuildingConfig.EmergePoint2 == null) {
            ScriptUtils.SetValue(Cfg.BuildingConfig, "EmergePoint2", createPoint(0, 0));
        }

        // очищаем список
        var producerParams = Cfg.GetProfessionParams(UnitProducerProfessionParams, UnitProfession.UnitProducer);
        // @ts-expect-error
        var produceList    = producerParams.CanProduceList;
        produceList.Clear();

        HordeContentApi.RemoveConfig(donorCfg);
    }
} // </CfgAddUnitProducer>

/**
 * @class FactoryConfig
 * @description Хранит пару конфигураций: юнита и фабрики, которая его производит.
 */
export class FactoryConfig {
    public unitConfig: IConfig;
    public factoryConfig: IConfig;
    
    /**
     * @constructor
     * @param {IConfig} unitConfig - Конфигурация производимого юнита.
     * @param {IConfig} factoryConfig - Конфигурация фабрики.
     */
    constructor(unitConfig: IConfig, factoryConfig: IConfig) {
        this.unitConfig    = unitConfig;
        this.factoryConfig = factoryConfig;
    } // </constructor>
}
/**
 * @function GetConfigsByWorker
 * @description Рекурсивно обходит дерево производства, начиная с указанного рабочего, и возвращает все пары "юнит-фабрика".
 * @param {string} workerHordeConfigUid - UID конфигурации рабочего, с которого начинается обход.
 * @returns {Array<FactoryConfig>} - Массив пар конфигураций.
 */
export function GetConfigsByWorker(workerHordeConfigUid: string) : Array<FactoryConfig> {
    var configs = new Array<FactoryConfig>();

    let cfgCache = new Map<string, boolean>();
    const ApplyChangesRecursively = (cfgUid: string, factoryCfgUid: string) => {
        // делаем так, чтобы учитывался 1 раз
        if (cfgCache.has(cfgUid)) {
            return;
        }

        var cfg = HordeContentApi.GetUnitConfig(cfgUid);

        // производящий конфиг пуст, это значит первый вызов, это рабочий, пропускаем
        if (factoryCfgUid != "") {
            var factoryCfg = HordeContentApi.GetUnitConfig(factoryCfgUid);
            configs.push(new FactoryConfig(new IConfig(cfg), new IConfig(factoryCfg)));
        }
        
        // переходим к следующему ид
        let producerParams : UnitProducerProfessionParams = cfg.GetProfessionParams(UnitProducerProfessionParams, UnitProfession.UnitProducer, true);
        if (producerParams) {
            let produceList = enumerate(producerParams.CanProduceList);
            let produceListItem;
            cfgCache.set(cfgUid, producerParams.CanProduceList.Count > 0);
            while ((produceListItem = eNext(produceList)) !== undefined) {
                ApplyChangesRecursively(produceListItem.Uid, cfgUid);
            }
        } else {
            cfgCache.set(cfgUid, true);
        }
    }

    ApplyChangesRecursively(workerHordeConfigUid, "");

    return configs;
} // </GetConfigsByWorker>

/**
 * @class IConfig
 * @description Обертка над стандартной конфигурацией юнита (UnitConfig), предоставляющая дополнительные методы и логику.
 */
export class IConfig {
// non-static
    public hordeConfig : UnitConfig;

    /**
     * @constructor
     * @param {UnitConfig} hordeConfig - Конфигурация юнита из движка.
     */
    constructor (hordeConfig : UnitConfig) {
        this.hordeConfig = hordeConfig;
    } // </constructor>

    /**
     * @method IsCombat
     * @description Определяет, является ли юнит боевым.
     * @returns {boolean} - true, если юнит боевой.
     */
    public IsCombat () {
        let mainArmament = this.hordeConfig.MainArmament;
        return mainArmament != null &&
            this.hordeConfig.GetProfessionParams(UnitProfession.Harvester, true) == null &&
            !this.hordeConfig.Flags.HasFlag(UnitFlags.Building);
    } // </IsCombat>

    private static _getConfigPower: Map<string, number> = new Map<string, number>();
    /**
     * @method CalcPower
     * @description Рассчитывает "силу" юнита на основе его характеристик.
     * @returns {number} - Рассчитанное значение силы.
     */
    public CalcPower(): number {
        var res: number = 0;
        if (IConfig._getConfigPower.has(this.hordeConfig.Uid)) {
            res = IConfig._getConfigPower.get(this.hordeConfig.Uid) as number;
        } else {
            // вычисляем всего опыта

            var hp           = this.hordeConfig.MaxHealth;
            var shield       = this.hordeConfig.Shield;
            var mainArmament = this.hordeConfig.MainArmament;
            if (this.hordeConfig.Flags.HasFlag(UnitFlags.Building)) {
                if (mainArmament) {
                    var damage = Math.max(mainArmament.ShotParams.Damage, 1);
                    res        = Math.sqrt(hp/damage)*(1 + 0.5*shield/damage)*5.67375886524;
                } else {
                    //res        = Math.log10(hp)*(1+0.5*shield)*5.67375886524;
                    res        = 4;
                }
            } else {
                var speed = this.hordeConfig.Speeds.Item.get(TileType.Grass) as number;
                if (mainArmament) {
                    var damage = Math.max(mainArmament.ShotParams.Damage, 1);
                    res        = Math.sqrt(hp/damage)*(1 + 0.5*shield/damage)*Math.sqrt(speed * 0.1)*5.67375886524;

                    var range  = mainArmament.Range;
                    res        = res*Math.max(1.0, Math.log(range));

                    if (this.hordeConfig.Specification.HasFlag(UnitSpecification.Mage)) {
                        res = res*1.6;
                    }
                } else {
                    res        = 4;
                }
            }

            // вычисляем опыт на 1 хп
            res = res;
            IConfig._getConfigPower.set(this.hordeConfig.Uid, res);
        }
        return res;
    } // </CalcPower>

// static

    public    static CfgPrefix   : string = "#BattleRoyale_";
    protected static CfgUid      : string = "";
    protected static Cfg         : UnitConfig;
    protected static BaseCfgUid  : string = "";

    /**
     * @method GetHordeConfig
     * @description Возвращает или создает и инициализирует статическую конфигурацию юнита для этого класса.
     * @static
     * @returns {UnitConfig} - Конфигурация юнита.
     */
    public static GetHordeConfig () : UnitConfig {
        if (this.Cfg) {
            return this.Cfg;
        } else {
            this.Cfg = CreateHordeUnitConfig(this.BaseCfgUid, this.CfgUid);

            this._InitHordeConfig();

            return this.Cfg;
        }
    } // </GetHordeConfig>

    protected static _InitHordeConfig() {
        // убираем требования
        this.Cfg.TechConfig.Requirements.Clear();
        // описание
        ScriptUtils.SetValue(this.Cfg, "Description", "");
        // убираем производство людей
        ScriptUtils.SetValue(this.Cfg, "ProducedPeople", 0);
        // убираем налоги
        ScriptUtils.SetValue(this.Cfg, "SalarySlots", 0);
        // делаем 0-ую стоимость
        ScriptUtils.SetValue(this.Cfg.CostResources, "Gold",   0);
        ScriptUtils.SetValue(this.Cfg.CostResources, "Metal",  0);
        ScriptUtils.SetValue(this.Cfg.CostResources, "Lumber", 0);
        ScriptUtils.SetValue(this.Cfg.CostResources, "People", 0);
        // убираем дружественный огонь
        if (this.Cfg.MainArmament) {
            var bulletCfg = HordeContentApi.GetBulletConfig(this.Cfg.MainArmament.BulletConfig.Uid);
            ScriptUtils.SetValue(bulletCfg, "CanDamageAllied", false);
        }
        // убираем захватываемость
        if (this.Cfg.ProfessionParams.ContainsKey(UnitProfession.Capturable)) {
            this.Cfg.ProfessionParams.Remove(UnitProfession.Capturable);
        }
        // убираем команду захвата
        if (this.Cfg.AllowedCommands.ContainsKey(UnitCommand.Capture)) {
            this.Cfg.AllowedCommands.Remove(UnitCommand.Capture);
        }
        // убираем команду удержания позиции
        // if (this.Cfg.AllowedCommands.ContainsKey(UnitCommand.HoldPosition)) {
        //     this.Cfg.AllowedCommands.Remove(UnitCommand.HoldPosition);
        // }
        // убираем профессию добычу
        if (this.Cfg.ProfessionParams.ContainsKey(UnitProfession.Harvester)) {
            this.Cfg.ProfessionParams.Remove(UnitProfession.Harvester);
        }

        // убираем дружественный огонь у огня
        ScriptUtils.SetValue(HordeContentApi.GetBulletConfig("#BulletConfig_Fire"), "CanDamageAllied", false);
    }
}
