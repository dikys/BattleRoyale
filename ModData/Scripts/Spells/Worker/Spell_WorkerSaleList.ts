import { ACommandArgs } from "library/game-logic/horde-types";
import { IProduceSpell } from "../IProduceSpell";
import { IUnitCaster } from "../IUnitCaster";
import { UnitProducerProfessionParams, UnitProfession } from "library/game-logic/unit-professions";
import { Spell_fiery_dash } from "../Fire/Spell_fiery_dash";
import { Spell_fiery_trail } from "../Fire/Spell_fiery_trail";
import { Spell_FireArrowsRain } from "../Fire/Spell_FireArrowsRain";
import { Spell_Fireball } from "../Fire/Spell_Fireball";
import { ISpell } from "../ISpell";
import { Spell_fear_attack } from "../Magic/Spell_fear_attack";
import { Spell_PoisonBomb } from "../Magic/Spell_PoisonBomb";
import { Spell_Teleportation } from "../Magic/Spell_Teleportation";
import { Spell_Agr_attack } from "../Melle/Spell_Agr_attack";
import { Spell_Blocking } from "../Melle/Spell_Blocking";
import { Spell_Power_Attack } from "../Melle/Spell_Power_Attack";
import { Spell_Vampirism } from "../Melle/Spell_Vampirism";
import { Spell_fortress } from "../Utillity/Spell_fortress";
import { Spell_healing_aura } from "../Utillity/Spell_healing_aura";
import { Spell_Magic_shield } from "../Utillity/Spell_Magic_shield";
import { createGameMessageWithNoSound } from "library/common/messages";
import { createHordeColor } from "library/common/primitives";
import { Spell_Reflection } from "../Melle/Spell_Reflection";
import { Spell_Summon_Guardians } from "../Utillity/Spell_Summon_Guardians";
import { Spell_Ricochet } from "../Melle/Spell_Ricochet";
import { Spell_Magic_fire } from "../Magic/Spell_Magic_fire";
import { Spell_ranged_transform } from "../Utillity/Spell_ranged_transform";
import { Spell_Melle_transform } from "../Utillity/Spell_Melle_transform";
import { Spell_Mage_transform } from "../Utillity/Spell_Mage_transform";
import { Spell_Raider_transform } from "../Utillity/Spell_Raider_transform";

export class Spell_WorkerSaleList extends IProduceSpell {
    protected static _ChargesReloadTime             : number = 1;

    protected static _ButtonUid                     : string = "Spell_WorkerSaleList";
    protected static _NamePrefix                    : string = "Магазин способностей";
    protected static _DescriptionTemplate           : string = "Открывает доступ к магазину способностей";

    protected static _ChargesCountPerLevel   : Array<number> = [
        100
    ];

    public static SpellsList : Array<typeof ISpell> = 
    [
        Spell_fear_attack,
        Spell_fiery_dash,
        Spell_fiery_trail,
        Spell_FireArrowsRain,
        Spell_Fireball,
        Spell_fortress,
        Spell_healing_aura,
        Spell_PoisonBomb,
        Spell_Teleportation,
        Spell_Vampirism,
        Spell_Blocking,
        Spell_Agr_attack,
        Spell_Power_Attack,
        Spell_Magic_shield,
        Spell_Reflection,
        Spell_Summon_Guardians,
        Spell_Ricochet,
        Spell_Magic_fire,

        Spell_ranged_transform,
        Spell_Melle_transform,
        Spell_Mage_transform,
        Spell_Raider_transform
    ];

    private _targetHero : IUnitCaster;

    constructor(caster: IUnitCaster, ...spellArgs: any[]) {
        super(caster, spellArgs.filter((value, index) => index > 0));

        this._targetHero = spellArgs[0];

        var producerParams = caster.hordeUnit.Cfg.GetProfessionParams(UnitProducerProfessionParams, UnitProfession.UnitProducer);
        // @ts-ignore
        var produceList    = producerParams.CanProduceList;
        produceList.Clear();

        Spell_WorkerSaleList.SpellsList.forEach(spell => {
            produceList.Add(spell.GetUnitConfig());
        });
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            for (var spell of Spell_WorkerSaleList.SpellsList) {
                if (spell.GetUnitConfig().Uid != this._productCfg.Uid) {
                    continue;
                }

                // @ts-expect-error
                if (!this._caster.unit.Owner.Resources.IsEnoughResources(activateArgs.ProductCfg.CostResources)) {
                    let msg = createGameMessageWithNoSound("Не хватает ресурсов!", createHordeColor(255, 255, 100, 100));
                    this._caster.hordeUnit.Owner.Messages.AddMessage(msg);
                    return false;
                }

                if (!this._targetHero.AddSpell(spell)) {
                    return false;
                }

                // @ts-expect-error
                this._caster.unit.Owner.Resources.TakeResources(activateArgs.ProductCfg.CostResources);
                return true;
            }

            return true;
        } else {
            return false;
        }
    }
}
