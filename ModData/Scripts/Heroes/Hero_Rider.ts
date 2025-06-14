import { TileType } from "library/game-logic/horde-types";
import { ISpell } from "../Spells/ISpell";
import { Spell_fiery_trail } from "../Spells/Spell_fiery_trail";
import { IHero } from "./IHero";
import { Spell_Teleportation } from "../Spells/Spell_Teleportation";
import { Spell_fiery_dash } from "../Spells/Spell_fiery_dash";

export class Hero_Rider extends IHero {
    protected static CfgUid      : string = this.CfgPrefix + "Rider";
    protected static BaseCfgUid  : string = "#UnitConfig_Slavyane_Raider";
    protected static _Spells : Array<typeof ISpell> = [Spell_fiery_trail, Spell_fiery_dash];

    constructor(hordeUnit: HordeClassLibrary.World.Objects.Units.Unit) {
        super(hordeUnit);
    }

    protected static _InitHordeConfig() {
        ScriptUtils.SetValue(this.Cfg, "Name", "Герой {всадник}");
        ScriptUtils.SetValue(this.Cfg, "MaxHealth", 30);
        ScriptUtils.SetValue(this.Cfg, "Shield", 0);
        ScriptUtils.SetValue(this.Cfg.MainArmament.ShotParams, "Damage", 5);
        ScriptUtils.SetValue(this.Cfg, "Sight", 3);
        ScriptUtils.SetValue(this.Cfg, "Weight", 20);
        ScriptUtils.SetValue(this.Cfg, "PressureResist", 30);
        this.Cfg.Speeds.Item.set(TileType.Forest, 2);

        super._InitHordeConfig();
        //ScriptUtils.SetValue(config, "Flags", mergeFlags(UnitFlags, config.Flags, UnitFlags.FireResistant, UnitFlags.MagicResistant));
    }
}