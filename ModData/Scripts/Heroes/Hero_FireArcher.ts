import { ISpell } from "../Spells/ISpell";
import { Spell_Fireball } from "../Spells/Spell_Fireball";
import { Spell_teleportation_mark } from "../Spells/Spell_teleportation_mark";
import { IHero } from "./IHero";

export class Hero_FireArcher extends IHero {
    protected static CfgUid      : string = this.CfgPrefix + "FireArcher";
    protected static BaseCfgUid  : string = "#UnitConfig_Slavyane_Archer_2";
    protected static _Spells : Array<typeof ISpell> = [Spell_Fireball, Spell_teleportation_mark];

    constructor(hordeUnit: HordeClassLibrary.World.Objects.Units.Unit) {
        super(hordeUnit);
    }

    protected static _InitHordeConfig() {
        ScriptUtils.SetValue(this.Cfg, "Name", "Герой {поджигатель}");
        ScriptUtils.SetValue(this.Cfg, "MaxHealth", 20);
        ScriptUtils.SetValue(this.Cfg, "Shield", 0);
        ScriptUtils.SetValue(this.Cfg.MainArmament.ShotParams, "Damage", 4);
        ScriptUtils.SetValue(this.Cfg, "Sight", 8);
        ScriptUtils.SetValue(this.Cfg, "PressureResist", 20);
        //ScriptUtils.SetValue(config, "Flags", mergeFlags(UnitFlags, config.Flags, UnitFlags.FireResistant, UnitFlags.MagicResistant));

        ScriptUtils.SetValue(this.Cfg, "Weight", 9);
        ScriptUtils.SetValue(this.Cfg, "PressureResist", 20);
        
        super._InitHordeConfig();
    }
}
