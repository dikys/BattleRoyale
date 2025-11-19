import {ISpell, SpellRefData} from "../ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, DiplomacyStatus, Stride_Color } from "library/game-logic/horde-types";
import { iterateOverUnitsInBox } from "library/game-logic/unit-and-map";
import {Cell} from "../../Core/Cell";

export class Spell_healing_aura extends ISpell {
    private static _MaxDistance : number = 7;
    private static _HealPeriod  : number = 50;
    private static _HealHp      : number = 3;

    protected static _ButtonUid                     : string = "Spell_healing_aura";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_healing_aura";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(75, 255, 59, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 75, 255, 59);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(4, 0);

    private static _AuraDurationPerLevel   : Array<number> = [
        7, 9, 12, 14, 16
    ].map(sec => sec*50);
    protected static _ChargesCountPerLevel   : Array<number> = [
        1, 1, 2, 2, 3
    ];

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Аура лечения";
    protected static _DescriptionTemplate           : string = "Активация ауры лечения " + (Spell_healing_aura._HealHp * Spell_healing_aura._HealPeriod / 50)
        + " хп / сек на расстоянии " + Spell_healing_aura._MaxDistance + " клеток в течении {0} секунд.";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._AuraDurationPerLevel.map(ticks => ticks / 50)];

    // @ts-ignore
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
        if (this._activatedTick + Spell_healing_aura._AuraDurationPerLevel[this.level] <= gameTickNum) {
            return false;
        }

        // хилим только своих
        if (this._healTick < gameTickNum) {
            this._healTick += Spell_healing_aura._HealPeriod;

            let unitsIter = iterateOverUnitsInBox(this._caster.hordeUnit.Cell, 6);
            for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
                if (u.value.Cfg.IsBuilding
                    || SpellRefData.diplomacyTable[parseInt(this._caster.hordeUnit.Owner.Uid)][parseInt(u.value.Owner.Uid)]
                    == DiplomacyStatus.War) {
                    continue;
                }

                u.value.Health = Math.min(u.value.Health + Spell_healing_aura._HealHp, u.value.Cfg.MaxHealth);
            }
        }

        return true;
    }
}
