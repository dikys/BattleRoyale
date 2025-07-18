import { ISpell } from "../Spells/ISpell";
import { Spell_fortress } from "../Spells/Spell_fortress";
import { Spell_healing_aura } from "../Spells/Spell_healing_aura";
import { IHero } from "./IHero";

export class Hero_Crusader extends IHero {
    protected static CfgUid      : string = this.CfgPrefix + "Crusader";
    protected static BaseCfgUid  : string = "#UnitConfig_Slavyane_Spearman";
    protected static _Spells : Array<typeof ISpell> = [Spell_healing_aura, Spell_fortress];

    /**
     * @constructor
     * @param {HordeClassLibrary.World.Objects.Units.Unit} hordeUnit - Юнит из движка, который будет представлять этого героя.
     */
    constructor(hordeUnit: HordeClassLibrary.World.Objects.Units.Unit) {
        super(hordeUnit);
    } // </constructor>

    protected static _InitHordeConfig() {
        ScriptUtils.SetValue(this.Cfg, "Name", "Герой {рыцарь}");
        ScriptUtils.SetValue(this.Cfg, "MaxHealth", 60);
        ScriptUtils.SetValue(this.Cfg, "Shield", 2);
        ScriptUtils.SetValue(this.Cfg.MainArmament.ShotParams, "Damage", 5);
        ScriptUtils.SetValue(this.Cfg, "Sight", 5);

        super._InitHordeConfig();
        //ScriptUtils.SetValue(config, "Flags", mergeFlags(UnitFlags, config.Flags, UnitFlags.FireResistant, UnitFlags.MagicResistant));
    }
}