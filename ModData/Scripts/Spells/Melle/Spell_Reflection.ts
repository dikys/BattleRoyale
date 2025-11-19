import { Unit, UnitHurtType, VisualEffectConfig } from "library/game-logic/horde-types";
import { IPassiveSpell } from "../IPassiveSpell";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import {Cell} from "../../Core/Cell";

export class Spell_Reflection extends IPassiveSpell {
    protected static _ButtonUid                     : string = "Spell_Reflection";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_Reflection";
    protected static _ChargesCountPerLevel          : Array<number> = [];
    protected static _SpellPreferredProductListPosition : Cell = new Cell(3, 0);

    private static _ReflectionDamagePerLevel   : Array<number> = [
        1, 2, 3, 4, 5
    ];

    private static _ReflectionEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust");

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Отражение";
    protected static _DescriptionTemplate           : string = "Пассивка. Враги, которые нанесли по вам урон ближнего,"
        + " дальнего, осадного типа получают в ответ {0} урона";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._ReflectionDamagePerLevel];

    public OnTakeDamage(AttackerUnit: Unit, EffectiveDamage: number, HurtType: UnitHurtType): void {
        super.OnTakeDamage(AttackerUnit, EffectiveDamage, HurtType);

        if (HurtType != UnitHurtType.Mele && HurtType != UnitHurtType.Arrow && HurtType != UnitHurtType.Heavy) {
            return;
        }

        this._caster.hordeUnit.BattleMind.CauseDamage(AttackerUnit,
            Spell_Reflection._ReflectionDamagePerLevel[this.level],
            UnitHurtType.Any);

        spawnDecoration(
            ActiveScena.GetRealScena(),
            Spell_Reflection._ReflectionEffect,
            AttackerUnit.Position.ToPoint2D());
    }
}
