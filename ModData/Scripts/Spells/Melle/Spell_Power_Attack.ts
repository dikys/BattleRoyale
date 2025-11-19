import { Unit, UnitHurtType, VisualEffectConfig } from "library/game-logic/horde-types";
import { IPassiveSpell } from "../IPassiveSpell";
import { SpellState } from "../ISpell";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import {Cell} from "../../Core/Cell";

export class Spell_Power_Attack extends IPassiveSpell {
    protected static _ButtonUid                     : string = "Spell_Power_Attack";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_Power_Attack";
    protected static _SpellPreferredProductListPosition : Cell = new Cell(3, 0);

    protected static _ChargesCountPerLevel          : Array<number> = [ 5, 10, 15, 20, 30];

    protected static _AddDamage : number = 10;
    private static _PowerAttackEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_Blood");

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Усиленная атака";
    protected static _DescriptionTemplate           : string = "Пассивка. Урон ближнего, дального типа отнимает заряд способности"
        + " и наносит дополнительно " + Spell_Power_Attack._AddDamage + " осадного урона";

    public OnCauseDamage(VictimUnit: Unit, Damage: number, EffectiveDamage: number, HurtType: UnitHurtType) {
        super.OnCauseDamage(VictimUnit, Damage, EffectiveDamage, HurtType);
        if (!(this._state == SpellState.READY || this._state == SpellState.ACTIVATED)) {
            return;
        }

        if (HurtType == UnitHurtType.Mele || HurtType == UnitHurtType.Arrow) {
            this._caster.hordeUnit.BattleMind.CauseDamage(VictimUnit,
                Spell_Power_Attack._AddDamage,
                UnitHurtType.Heavy);

            var decorCell = Cell.ConvertHordePoint(VictimUnit.Cell).Scale(32);
            for (var x = 0; x <= 32; x += 32) {
                for (var y = 0; y <= 32; y += 32) {
                    spawnDecoration(
                        ActiveScena.GetRealScena(),
                        Spell_Power_Attack._PowerAttackEffect,
                        decorCell.Add(new Cell(x, y)).ToHordePoint());
                }
            }

            
            this._SpendCharge();
        }
    }
}
