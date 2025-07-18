import { IUnit } from "../Units/IUnit";
import { ReplaceUnitParameters, TileType, UnitFlags } from "library/game-logic/horde-types";
import { mergeFlags } from "library/dotnet/dotnet-utils";
import { ISpell } from "../Spells/ISpell";
import { Spell_golden_barracks_summon } from "../Spells/Spell_golden_barracks_summon";
import { IConfig } from "../Units/IConfig";
import { BuildingTemplate } from "../Units/IFactory";
import { IHero } from "./IHero";
import { Spell_teleportation_mark } from "../Spells/Spell_teleportation_mark";
import { Spell_PoisonBomb } from "../Spells/Spell_PoisonBomb";

export class Hero_Scorpion extends IHero {
    protected static CfgUid      : string = this.CfgPrefix + "HeroScorpion";
    protected static BaseCfgUid  : string = "#UnitConfig_Nature_ScorpionMed";
    protected static _Spells : Array<typeof ISpell> = [Spell_golden_barracks_summon, Spell_PoisonBomb];

    // настройки формации - начальный радиус
    protected static _formationStartRadius : number = 2;
    // настройки формации - плотность орбит
    protected static _formationDestiny : number = 2 / 3;

    private _scorpions : Array<IUnit>;

    /**
     * @constructor
     * @param {HordeClassLibrary.World.Objects.Units.Unit} hordeUnit - Юнит из движка, который будет представлять этого героя.
     */
    constructor(hordeUnit: HordeClassLibrary.World.Objects.Units.Unit) {
        super(hordeUnit);

        this._scorpions = new Array<IUnit>();
    } // </constructor>

    protected static _InitHordeConfig() {
        ScriptUtils.SetValue(this.Cfg, "Name", "Герой {скорпион}");
        ScriptUtils.SetValue(this.Cfg, "MaxHealth", 11);
        ScriptUtils.SetValue(this.Cfg, "Shield", 0);
        ScriptUtils.SetValue(this.Cfg.MainArmament.ShotParams, "Damage", 3);
        this.Cfg.Speeds.Item.set(TileType.Forest, 4);
        this.Cfg.Speeds.Item.set(TileType.Grass, 13);
        ScriptUtils.SetValue(this.Cfg, "Weight", 9);
        ScriptUtils.SetValue(this.Cfg, "PressureResist", 20);
        
        super._InitHordeConfig();

        var scorpionConfig = Scorpion.GetHordeConfig();
        ScriptUtils.SetValue(this.Cfg, "Description", this.Cfg.Description + "\n\n" +
            "Из зданий на карте вместо ожидаемых юнитов появляются скорпионы ("
            + scorpionConfig.MaxHealth + " здоровья " + scorpionConfig.MainArmament.ShotParams.Damage
            + " урона), их количество зависит от редкости здания. После смерти главного скорпиона выбирается новый."
        );
    }

    /**
     * @method OnDestroyBuilding
     * @description Вызывается при уничтожении здания. Заменяет спавн юнитов на спавн скорпионов.
     * @param {BuildingTemplate} buildingTemplate - Шаблон разрушенного здания.
     * @param {number} rarity - Редкость здания.
     * @param {IConfig} spawnUnitConfig - Исходная конфигурация юнита для спавна.
     * @param {number} spawnCount - Исходное количество юнитов для спавна.
     * @returns {[IConfig, number]} - Возвращает конфигурацию скорпиона и новое количество для спавна.
     */
    public OnDestroyBuilding(buildingTemplate: BuildingTemplate, rarity: number, spawnUnitConfig: IConfig, spawnCount: number): [IConfig, number] {
        return [new IConfig(Scorpion.GetHordeConfig()), rarity + 1 + 1];    
    } // </OnDestroyBuilding>

    /**
     * @method AddUnitToFormation
     * @description Добавляет юнита в формацию. Если юнит - скорпион, также добавляет его во внутренний список.
     * @param {IUnit} unit - Юнит для добавления.
     */
    public AddUnitToFormation(unit: IUnit): void {
        super.AddUnitToFormation(unit);

        if (unit.hordeConfig.Uid == Scorpion.GetHordeConfig().Uid) {
            this._scorpions.push(unit);
        }
    } // </AddUnitToFormation>

    /**
     * @method IsDead
     * @description Проверяет, мертв ли герой. Герой считается мертвым, если его основной юнит мертв и у него не осталось скорпионов.
     * @returns {boolean} - true, если герой мертв.
     */
    public IsDead(): boolean {
        return this.hordeUnit.IsDead && this._scorpions.length == 0;
    } // </IsDead>

    /**
     * @method OnEveryTick
     * @description Вызывается на каждом тике. Управляет логикой "стаи" скорпионов, включая выбор нового лидера после смерти текущего.
     * @param {number} gameTickNum - Текущий тик игры.
     * @returns {boolean} - Возвращает false, если базовый метод вернул false, иначе true.
     */
    public OnEveryTick(gameTickNum: number): boolean {
        if (!super.OnEveryTick(gameTickNum)) {
            return false;
        }

        // удаляем мертвых скорпов
        for (var i = 0; i < this._scorpions.length; i++) {
            if (this._scorpions[i].hordeUnit.IsDead) {
                this._scorpions.splice(i--, 1);
            }
        }

        // выбираем нового вожака
        if (this.hordeUnit.IsDead && this._scorpions.length > 0) {
            // Параметры замены
            let replaceParams           = new ReplaceUnitParameters();
            replaceParams.OldUnit       = this._scorpions[0].hordeUnit;
            replaceParams.NewUnitConfig = Hero_Scorpion.GetHordeConfig();
            replaceParams.Cell = null;                  // Можно задать клетку, в которой должен появиться новый юнит. Если null, то центр создаваемого юнита совпадет с предыдущим
            replaceParams.PreserveHealthLevel = true;   // Нужно ли передать уровень здоровья? (в процентном соотношении)
            replaceParams.PreserveExperience = true;    // Нужно ли передать опыт?
            replaceParams.PreserveOrders = true;        // Нужно ли передать приказы?
            replaceParams.PreserveKillsCounter = true;  // Нужно ли передать счетчик убийств?
            replaceParams.Silent = true;                // Отключение вывода в лог возможных ошибок (при регистрации и создании модели)
    
            // повышаем выбранного скорпа до лидера
            var newHero = this._scorpions[0].hordeUnit.Owner.Units.ReplaceUnit(replaceParams);
            this.ReplaceHordeUnit(newHero);
            this._scorpions.splice(0, 1);
        }

        return true;
    } // </OnEveryTick>
}

class Scorpion extends IUnit {
    protected static CfgUid      : string = this.CfgPrefix + "Scorpion";
    protected static BaseCfgUid  : string = "#UnitConfig_Nature_ScorpionMed";

    /**
     * @constructor
     * @param {any} hordeUnit - Юнит из движка, который будет представлять этого скорпиона.
     */
    constructor(hordeUnit: any) {
        super(hordeUnit);
    } // </constructor>

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Name", "Скорпион");
        ScriptUtils.SetValue(this.Cfg, "MaxHealth", 9);
        ScriptUtils.SetValue(this.Cfg, "Shield", 0);
        ScriptUtils.SetValue(this.Cfg.MainArmament.ShotParams, "Damage", 3);
        ScriptUtils.SetValue(this.Cfg, "Flags", mergeFlags(UnitFlags, this.Cfg.Flags, UnitFlags.NotChoosable));
        this.Cfg.Speeds.Item.set(TileType.Forest, 4);
        this.Cfg.Speeds.Item.set(TileType.Grass, 13);

        ScriptUtils.SetValue(this.Cfg, "Weight", 9);
        ScriptUtils.SetValue(this.Cfg, "PressureResist", 18);
    }
}
