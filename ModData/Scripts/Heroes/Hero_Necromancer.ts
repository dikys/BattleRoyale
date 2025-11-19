import { ISpell } from "../Spells/ISpell";
import { IHero } from "./IHero";
import { BuildingTemplate } from "../Units/IFactory";
import { IConfig } from "../Units/IConfig";
import { createResourcesAmount } from "library/common/primitives";
import { Spell_fear_attack } from "../Spells/Magic/Spell_fear_attack";
import { Spell_dead_army } from "../Spells/Utillity/Spell_dead_army";

export class Hero_Necromancer extends IHero {
    protected static CfgUid      : string = this.CfgPrefix + "Necromancer";
    protected static BaseCfgUid  : string = "#UnitConfig_Mage_Mag_2";
    //protected static _Spells : Array<typeof ISpell> = [Spell_dead_army, Spell_fear_attack];
    protected static _Spells : Array<typeof ISpell> = [Spell_fear_attack, Spell_dead_army];

    /**
     * @constructor
     * @param {HordeClassLibrary.World.Objects.Units.Unit} hordeUnit - Юнит из движка, который будет представлять этого героя.
     */
    constructor(hordeUnit: HordeClassLibrary.World.Objects.Units.Unit) {
        super(hordeUnit);
    } // </constructor>

    protected static _InitHordeConfig() {
        ScriptUtils.SetValue(this.Cfg, "Name", "Герой {некромант}");
        ScriptUtils.SetValue(this.Cfg, "MaxHealth", 22);
        ScriptUtils.SetValue(this.Cfg, "Shield", 0);
        ScriptUtils.SetValue(this.Cfg.MainArmament.ShotParams, "Damage", 5);
        ScriptUtils.SetValue(this.Cfg.MainArmament, "Range", 2);
        ScriptUtils.SetValue(this.Cfg.MainArmament, "ForestRange", 1);
        ScriptUtils.SetValue(this.Cfg, "Sight", 8);
        ScriptUtils.SetValue(this.Cfg, "Weight", 9);
        ScriptUtils.SetValue(this.Cfg, "PressureResist", 20);

        super._InitHordeConfig();
    }

    /**
     * @method OnDestroyBuilding
     * @description Вызывается при уничтожении здания. Некромант получает души (ресурсы) за разрушение.
     * @param {BuildingTemplate} buildingTemplate - Шаблон разрушенного здания.
     * @param {number} rarity - Редкость здания.
     * @param {IConfig} spawnUnitConfig - Конфигурация юнита, который должен был появиться из здания.
     * @param {number} spawnCount - Количество юнитов, которое должно было появиться.
     * @returns {[IConfig, number]} - Возвращает исходную конфигурацию юнита и 0, отменяя спавн.
     */
    public OnDestroyBuilding(buildingTemplate: BuildingTemplate, rarity: number, spawnUnitConfig: IConfig, spawnCount: number): [IConfig, number] {
        var amount = createResourcesAmount(0, 0, 0, rarity + 1);
        this.hordeUnit.Owner.Resources.AddResources(amount);

        return [spawnUnitConfig, 0];    
    } // </OnDestroyBuilding>
}
