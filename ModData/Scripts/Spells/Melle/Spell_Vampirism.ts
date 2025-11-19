import { Unit, UnitHurtType } from "library/game-logic/horde-types";
import { IPassiveSpell } from "../IPassiveSpell";
import {Cell} from "../../Core/Cell";

export class Spell_Vampirism extends IPassiveSpell {
    protected static _ButtonUid                     : string = "Spell_Vampirism";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_Vampirism";
    protected static _ChargesCountPerLevel          : Array<number> = [];
    protected static _SpellPreferredProductListPosition : Cell = new Cell(3, 0);

    private static _VampirismCoeffPerLevel   : Array<number> = [
        0.2, 0.4, 0.6, 0.8, 1.0
    ];

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Вампиризм";
    protected static _DescriptionTemplate           : string = "Пассивка. Урон ближнего, осадного, дальнего (лечение в 2 раза меньше) типа"
        + " восстанавливает хп в размере {0} % нанесенного урона (то есть с вычетом брони врага)";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._VampirismCoeffPerLevel.map(value => value * 100)];

    public OnCauseDamage(VictimUnit: Unit, Damage: number, EffectiveDamage: number, HurtType: UnitHurtType) {
        super.OnCauseDamage(VictimUnit, Damage, EffectiveDamage, HurtType);

        if (HurtType != UnitHurtType.Mele && HurtType != UnitHurtType.Heavy && HurtType != UnitHurtType.Arrow) {
            return;
        }

        var heal = Math.round(EffectiveDamage * Spell_Vampirism._VampirismCoeffPerLevel[this.level] * (HurtType == UnitHurtType.Arrow ? 0.5 : 1.0));
        if (heal > 0) {
            heal = Math.min(this._caster.hordeUnit.Cfg.MaxHealth - this._caster.hordeUnit.Health, heal);
            if (heal > 0) {
                this._caster.hordeUnit.Health = this._caster.hordeUnit.Health + heal;
            }
        }
    }
}
