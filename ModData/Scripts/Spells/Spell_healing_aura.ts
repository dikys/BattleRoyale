import { ISpell } from "./ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, Stride_Color } from "library/game-logic/horde-types";
import { iterateOverUnitsInBox } from "library/game-logic/unit-and-map";

export class Spell_healing_aura extends ISpell {
    private static _MaxDistance : number = 7;
    private static _HealTime    : number = 250;
    private static _HealPeriod  : number = 50;
    private static _HealHp      : number = 3;

    protected static _ButtonUid                     : string = "Spell_healing_aura";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_healing_aura";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(75, 255, 59, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 75, 255, 59);
    protected static _Name                          : string = "Аура лечения";
    protected static _Description                   : string = "Активация ауры лечения " + (Spell_healing_aura._HealHp * Spell_healing_aura._HealPeriod / 50)
        + " хп / сек на расстоянии" + Spell_healing_aura._MaxDistance + " клеток в течении " + (Spell_healing_aura._HealTime / 50) + " секунд.";

    private _healTick : number;

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            this._healTick = this._activatedTick;
            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // проверяем, что лечение закончилось
        if (this._activatedTick + Spell_healing_aura._HealTime <= gameTickNum) {
            return false;
        }

        // хилим только своих
        if (this._healTick < gameTickNum) {
            this._healTick += Spell_healing_aura._HealPeriod;

            let unitsIter = iterateOverUnitsInBox(this._caster.hordeUnit.Cell, 6);
            for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
                if (u.value.Owner.Uid != this._caster.hordeUnit.Owner.Uid) {
                    continue;
                }

                u.value.Health = Math.min(u.value.Health + Spell_healing_aura._HealHp, u.value.Cfg.MaxHealth);
            }
        }

        return true;
    }
}
