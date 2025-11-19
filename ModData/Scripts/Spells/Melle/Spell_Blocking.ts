import { Unit, UnitHurtType, VisualEffectConfig } from "library/game-logic/horde-types";
import { IPassiveSpell } from "../IPassiveSpell";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import {Cell} from "../../Core/Cell";

export class Spell_Blocking extends IPassiveSpell {
    protected static _ButtonUid                     : string = "Spell_Blocking";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_Blocking";
    protected static _ChargesCountPerLevel          : Array<number> = [];
    protected static _SpellPreferredProductListPosition : Cell = new Cell(3, 0);

    private static _BlockPeriodPerLevel   : Array<number> = [
        10, 8, 6, 5, 4
    ];

    private static _BlockEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust");

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Блокирование";
    protected static _DescriptionTemplate           : string = "Пассивка. Каждый {0} урон ближнего, дальнего, осадного"
        + " типа блокируется";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._BlockPeriodPerLevel];

    private _takeNum : number = 0;

    public OnTakeDamage(AttackerUnit: Unit, EffectiveDamage: number, HurtType: UnitHurtType): void {
        super.OnTakeDamage(AttackerUnit, EffectiveDamage, HurtType);

        if (HurtType != UnitHurtType.Mele && HurtType != UnitHurtType.Arrow && HurtType != UnitHurtType.Heavy) {
            return;
        }

        this._takeNum++;
        if (this._takeNum >= Spell_Blocking._BlockPeriodPerLevel[this.level]) {
            this._takeNum = 0;
            this._caster.hordeUnit.Health += EffectiveDamage;
            spawnDecoration(
                ActiveScena.GetRealScena(),
                Spell_Blocking._BlockEffect,
                this._caster.hordeUnit.Position.ToPoint2D());
        }
    }
}
