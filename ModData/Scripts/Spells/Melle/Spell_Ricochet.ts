import { DiplomacyStatus, Unit, UnitHurtType, UnitMapLayer } from "library/game-logic/horde-types";
import { IPassiveSpell } from "../IPassiveSpell";
import {SpellRefData, SpellState} from "../ISpell";
import { iterateOverUnitsInBox } from "library/game-logic/unit-and-map";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import {Cell} from "../../Core/Cell";

export class Spell_Ricochet extends IPassiveSpell {
    protected static _ButtonUid                     : string = "Spell_Ricochet";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_Ricochet";
    protected static _SpellPreferredProductListPosition : Cell = new Cell(3, 0);

    protected static _ChargesCountPerLevel          : Array<number> = [ 10, 20, 30, 40, 60];

    //private static _RicochetEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_Blood");

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Рикошет";
    protected static _DescriptionTemplate           : string = "Пассивка. Если ваша атака ближнего, дальнего боя из любого"
        + " источника настигла врага. И рядом (в радиусе вашей атаки) с настигнутым врагом есть еще враги."
        + " То расходуется заряд способности и ваша атака активируется еще раз из положения"
        + " настигнутого врага в ближайшего.";

    private _currentTargets : Map<number, Unit> = new Map<number, Unit>();
    private _deletePeriod : number = 10;

    public OnCauseDamage(VictimUnit: Unit, Damage: number, EffectiveDamage: number, HurtType: UnitHurtType) {
        super.OnCauseDamage(VictimUnit, Damage, EffectiveDamage, HurtType);
        if (!(this._state == SpellState.READY || this._state == SpellState.ACTIVATED)) {
            return;
        }

        if (HurtType != UnitHurtType.Mele && HurtType != UnitHurtType.Arrow) {
            return;
        }

        if (this._currentTargets.has(VictimUnit.Id)) {
            this._currentTargets.delete(VictimUnit.Id);
        }

        // удаляем мертвых
        if (this._deletePeriod-- == 0) {
            this._deletePeriod = 10;
            for (var target of this._currentTargets) {
                if (target[1].IsDead) {
                    this._currentTargets.delete(target[0]);
                }
            }
        }

        let unitsIter = iterateOverUnitsInBox(VictimUnit.Cell, this._caster.hordeUnit.Cfg.MainArmament.Range);
        for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
            if (u.value.Id != VictimUnit.Id
                && !u.value.IsDead
                && SpellRefData.diplomacyTable[parseInt(this._caster.hordeUnit.Owner.Uid)][parseInt(u.value.Owner.Uid)]
                == DiplomacyStatus.War
                && u.value.Cfg.IsBuilding == false
                && !this._currentTargets.has(u.value.Id)) {

                this._currentTargets.set(u.value.Id, u.value);

                spawnBullet(
                    this._caster.hordeUnit,  // Игра будет считать, что именно этот юнит запустил снаряд
                    null,
                    null,
                    this._caster.hordeUnit.Cfg.MainArmament.BulletConfig,
                    this._caster.hordeUnit.Cfg.MainArmament.ShotParams,
                    VictimUnit.Position.ToPoint2D(),
                    u.value.Position.ToPoint2D(),
                    UnitMapLayer.Main
                );
                this._SpendCharge();
                break;
            }
        }
    }
}

