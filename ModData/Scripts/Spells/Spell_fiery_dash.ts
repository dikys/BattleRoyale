import { ISpell } from "./ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, BulletConfig, DiplomacyStatus, Stride_Color, UnitDirection, UnitMapLayer, VisualEffectConfig } from "library/game-logic/horde-types";
import { Cell } from "../Core/Cell";
import { IUnitCaster } from "./IUnitCaster";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { log } from "library/common/logging";

export class Spell_fiery_dash extends ISpell {
    private static _DashMaxDistance : number = 10;
    private static _FireConfig : BulletConfig = HordeContentApi.GetBulletConfig("#BulletConfig_Fire");
    private static _DashEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleRedDust");

    protected static _ButtonUid                     : string = "Spell_fiery_dash";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_fiery_dash";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(228, 18, 47, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 228, 18, 47);
    protected static _Name                          : string = "Огненный рывок";
    protected static _Description                   : string = "Делает рывок в сторону взгляда, максимум на " + Spell_fiery_dash._DashMaxDistance + " клеток, поджигая все на своем пути.";

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            var heroCell   = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            var moveVec    = this._caster.DirectionVector();
            var targetCell = heroCell.Add(moveVec.Scale(Spell_fiery_dash._DashMaxDistance)).Round();
            while (!(targetCell.X == heroCell.X && targetCell.Y == heroCell.Y)) {
                var hordeCell = targetCell.ToHordePoint();
                if (unitCanBePlacedByRealMap(this._caster.hordeConfig, hordeCell.X, hordeCell.Y)
                    && this._caster.hordeUnit.MapMind.CheckPathTo(hordeCell, false).Found) {    
                    break;
                }

                targetCell = targetCell.Minus(moveVec).Round();
            }

            log.info("FIRE DASH START ", heroCell.X, " ", heroCell.Y);
            log.info("FIRE DASH END ", targetCell.X, " ", targetCell.Y);

            while (!(targetCell.X == heroCell.X && targetCell.Y == heroCell.Y)) {
                var dashPoint = heroCell.Scale(32).Add(new Cell(16, 16)).ToHordePoint();
                spawnDecoration(
                    ActiveScena.GetRealScena(),
                    Spell_fiery_dash._DashEffect,
                    dashPoint);
                var upperHordeUnit = ActiveScena.UnitsMap.GetUpperUnit(heroCell.ToHordePoint());
                if (upperHordeUnit && this._caster.hordeUnit.Owner.Diplomacy.GetDiplomacyStatus(upperHordeUnit.Owner) != DiplomacyStatus.War) {
                    
                } else {
                    HordeClassLibrary.World.Objects.Bullets.Implementations.Fire.BaseFireBullet.MakeFire(
                        this._caster.hordeUnit, dashPoint, UnitMapLayer.Main, Spell_fiery_dash._FireConfig);
                }

                log.info("FIRE DASH ", heroCell.X, " ", heroCell.Y);

                heroCell = heroCell.Add(moveVec).Round();
            }

            this._caster.hordeUnit.MapMind.TeleportToCell(targetCell.ToHordePoint());

            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        return false;
    }
}
