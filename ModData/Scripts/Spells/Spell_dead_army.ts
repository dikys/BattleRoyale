import { SpellGlobalRef } from "./ISpell";
import { createHordeColor, createResourcesAmount, HordeColor } from "library/common/primitives";
import { ACommandArgs, Stride_Color, TileType, UnitCommand, UnitDirection, UnitFlags, UnitHurtType } from "library/game-logic/horde-types";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { spawnUnit } from "library/game-logic/unit-spawn";
import { IUnitCaster } from "./IUnitCaster";
import { generateCellInSpiral } from "library/common/position-tools";
import { Cell } from "../Core/Cell";
import { IProduceSpell } from "./IProduceSpell";
import { log } from "library/common/logging";
import { IUnit } from "../Units/IUnit";
import { mergeFlags } from "library/dotnet/dotnet-utils";
import { UnitProducerProfessionParams, UnitProfession } from "library/game-logic/unit-professions";
import { CfgAddUnitProducer } from "../Units/IConfig";

export class IDeadUnit extends IUnit {
    public static SoulsCount = 1;

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "TintColor", createHordeColor(255, 79, 0, 112));
        ScriptUtils.SetValue(this.Cfg, "Flags", mergeFlags(UnitFlags, this.Cfg.Flags, UnitFlags.NotChoosable));
        ScriptUtils.SetValue(this.Cfg, "Description",  this.Cfg.Description +
            (this.Cfg.Description == "" ? "" : "\n") +
            "  требует душ " + this.SoulsCount + "\n" +
            "  здоровье " + this.Cfg.MaxHealth + "\n" +
            "  броня " + this.Cfg.Shield + "\n" +
            (
                this.Cfg.MainArmament
                ? "  атака " + this.Cfg.MainArmament.ShotParams.Damage + "\n" +
                "  радиус атаки " + this.Cfg.MainArmament.Range + "\n"
                : ""
            ) +
            "  скорость бега " + this.Cfg.Speeds.Item.get(TileType.Grass) + " (в лесу " + this.Cfg.Speeds.Item.get(TileType.Forest) + ")" + "\n"
            + (this.Cfg.Flags.HasFlag(UnitFlags.FireResistant) || this.Cfg.Flags.HasFlag(UnitFlags.MagicResistant)
                ? "  иммунитет к " + (this.Cfg.Flags.HasFlag(UnitFlags.FireResistant) ? "огню " : "") + 
                    (this.Cfg.Flags.HasFlag(UnitFlags.MagicResistant) ? "магии " : "") + "\n"
                : "")
            + "  радиус видимости " + this.Cfg.Sight + " (в лесу " + this.Cfg.ForestVision + ")\n");
    }
}

export class DeadArcher extends IDeadUnit {
    protected static CfgUid      : string = this.CfgPrefix + "Dead_Archer";
    protected static BaseCfgUid  : string = "#UnitConfig_Slavyane_Archer";

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Name", "Мертвый лучник");
    }
}

export class DeadRider extends IDeadUnit {
    protected static CfgUid      : string = this.CfgPrefix + "Dead_Rider";
    protected static BaseCfgUid  : string = "#UnitConfig_Slavyane_Raider";

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Name", "Мертвый всадник");
    }
}

export class DeadHeavymen extends IDeadUnit {
    protected static CfgUid      : string = this.CfgPrefix + "Dead_Heavymen";
    protected static BaseCfgUid  : string = "#UnitConfig_Slavyane_Heavymen";

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Name", "Мертвый тяжелый рыцарь");
    }
}

export class DeadVillur extends IDeadUnit {
    public static SoulsCount = 15;

    protected static CfgUid      : string = this.CfgPrefix + "Dead_Villur";
    protected static BaseCfgUid  : string = "#UnitConfig_Mage_Villur";

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Name", "Мертвый виллур");
    }
}

export class Spell_dead_army extends IProduceSpell {
    private static _Duration : number = 50*50;

    protected static _ButtonUid                     : string = "Spell_dead_army";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_army_of_dead";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(79, 0, 112, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 79, 0, 112);
    protected static _Name                          : string = "Армия мёртвых";
    protected static _Description                   : string = "Призвать армию мертвецов вне леса. Время действия " + (this._Duration / 50) + " сек.";
    protected static _ReloadTime                    : number = 10*50;

    protected static _DeadUnitTypes : Array<typeof IDeadUnit> = [
        DeadArcher,
        DeadRider,
        DeadHeavymen,
        DeadVillur
    ];

    private _spawnedUnitTypeNum : number;
    private _spawnedUnits : Array<IDeadUnit>;

    constructor(caster: IUnitCaster) {
        super(caster);

        var producerParams = caster.hordeConfig.GetProfessionParams(UnitProducerProfessionParams, UnitProfession.UnitProducer);
        var produceList    = producerParams.CanProduceList;
        produceList.Add(DeadArcher.GetHordeConfig());
        produceList.Add(DeadRider.GetHordeConfig());
        produceList.Add(DeadHeavymen.GetHordeConfig());
        produceList.Add(DeadVillur.GetHordeConfig());

        this._spawnedUnits = new Array<IDeadUnit>();
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            this._spawnedUnitTypeNum = Spell_dead_army._DeadUnitTypes.findIndex((unitType) => unitType.GetHordeConfig().Uid == this._productCfg.Uid);
            if (this._spawnedUnitTypeNum == -1) {
                return false;
            }

            var heroCell      = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            var generator     = generateCellInSpiral(heroCell.X, heroCell.Y);
            var spawnedType   = Spell_dead_army._DeadUnitTypes[this._spawnedUnitTypeNum];
            var spawnedConfig = spawnedType.GetHordeConfig();
            var spawnCount    = Math.floor(this._caster.hordeUnit.Owner.Resources.FreePeople / spawnedType.SoulsCount);

            if (spawnCount == 0) {
                return true;
            }

            for (let position = generator.next(); !position.done && this._spawnedUnits.length < spawnCount; position = generator.next()) {
                var cell = new Cell(position.value.X, position.value.Y);
                if (SpellGlobalRef.GameField.GetTileType(cell) != TileType.Forest
                    && unitCanBePlacedByRealMap(spawnedConfig, cell.X, cell.Y)) {
                    var unit = spawnUnit(this._caster.hordeUnit.Owner, spawnedConfig, cell.ToHordePoint(), UnitDirection.Down);
                    if (unit) {
                        this._spawnedUnits.push(new spawnedType(unit));
                    }
                }
            }

            var amount = createResourcesAmount(0, 0, 0, spawnCount * spawnedType.SoulsCount);
            this._caster.hordeUnit.Owner.Resources.TakeResources(amount);

            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // призыв был пуст
        if (this._spawnedUnits.length == 0) {
            return false;
        }

        // проверяем, что закончилось
        if (this._activatedTick + Spell_dead_army._Duration <= gameTickNum) {
            var returnedSouls = 0;
            var coeff = Spell_dead_army._DeadUnitTypes[this._spawnedUnitTypeNum].SoulsCount
                / Spell_dead_army._DeadUnitTypes[this._spawnedUnitTypeNum].GetHordeConfig().MaxHealth;
            this._spawnedUnits.forEach(unit => {
                if (unit.hordeUnit.IsDead) {
                    return;
                }
                returnedSouls += unit.hordeUnit.Health * coeff;
                unit.hordeUnit.BattleMind.InstantDeath(null, UnitHurtType.Mele);
            });
            this._spawnedUnits.splice(0);

            var amount = createResourcesAmount(0, 0, 0, Math.round(returnedSouls));
            this._caster.hordeUnit.Owner.Resources.AddResources(amount);

            return false;
        }

        return true;
    }
}
