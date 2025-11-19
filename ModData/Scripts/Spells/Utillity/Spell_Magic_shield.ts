import { Unit, UnitHurtType, VisualEffectConfig } from "library/game-logic/horde-types";
import { IPassiveSpell } from "../IPassiveSpell";
import { SpellState } from "../ISpell";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import {Cell} from "../../Core/Cell";

export class Spell_Magic_shield extends IPassiveSpell {
    protected static _ButtonUid                     : string = "Spell_Magic_shield";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_Magic_shield";
    protected static _SpellPreferredProductListPosition : Cell = new Cell(4, 0);

    protected static _ChargesCountPerLevel          : Array<number> = [ 1, 2, 7, 9, 11 ];

    private static _ShieldEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_MagicBabble");

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Магический щит";
    protected static _DescriptionTemplate           : string = "Пассивка. Каждое получение урона отнимает заряд и невелирует урон.";

    private _shieldActiveUntil: number = 0;
    private static readonly SHIELD_DURATION_TICKS = 50;

    public OnTakeDamage(AttackerUnit: Unit, EffectiveDamage: number, HurtType: UnitHurtType): void {
        super.OnTakeDamage(AttackerUnit, EffectiveDamage, HurtType);

        const isBuffActive = Battle.GameTimer.GameFramesCounter < this._shieldActiveUntil;
        const canActivateBuff = (this._state == SpellState.READY || this._state == SpellState.ACTIVATED);

        if (!isBuffActive && !canActivateBuff) {
            return; // Nothing to do
        }

        // Negate damage & show effect
        if (EffectiveDamage > 0) {
            this._caster.hordeUnit.Health += EffectiveDamage;
        }

        // тушим огонь
        if (HurtType == UnitHurtType.Fire) {
            this._caster.hordeUnit.EffectsMind.RemoveEffect(HordeClassLibrary.UnitComponents.Enumerations.UnitEffectFlag.Burning);
        }

        // If buff wasn't active, activate it and consume a charge
        if (!isBuffActive && canActivateBuff) {
            this._shieldActiveUntil = Battle.GameTimer.GameFramesCounter + Spell_Magic_shield.SHIELD_DURATION_TICKS;
            this._SpendCharge();
            spawnDecoration(
                ActiveScena.GetRealScena(),
                Spell_Magic_shield._ShieldEffect,
                this._caster.hordeUnit.Position.ToPoint2D()
            );
        }
    }
}
