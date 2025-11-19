import { HordeColor } from "library/common/primitives";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { Stride_Color, BulletConfig, VisualEffectConfig, ACommandArgs, UnitFlags, DiplomacyStatus, UnitMapLayer, UnitHurtType } from "library/game-logic/horde-types";
import {ISpell, SpellRefData} from "../ISpell";
import {Cell} from "../../Core/Cell";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";

export class Spell_fiery_dash extends ISpell {
    protected static _ButtonUid                     : string = "Spell_fiery_dash";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_fiery_dash";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(228, 18, 47, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 228, 18, 47);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(1, 0);

    private static _FireDashMaxDistancePerLevel   : Array<number> = [
        10, 12, 14, 16, 18
    ];
    private static _FireDashAddDamagePerLevel : Array<number> = [
        3, 7, 9, 11, 14
    ];
    private static _FireDashWidthPerLevel : Array<number> = [
        1, 1, 2, 2, 2
    ];
    protected static _ChargesCountPerLevel   : Array<number> = [
        1, 2, 3, 4, 5
    ];
    private static _FireConfig : BulletConfig = HordeContentApi.GetBulletConfig("#BulletConfig_Fire");
    private static _FireDashEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleRedDust");

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Огненный рывок";
    protected static _DescriptionTemplate           : string = 
        "Делает рывок в сторону взгляда, максимум на {0} клеток, поджигая все на своем пути,"
        + " дополнительно наносит {1} огненного урона (игнорирует броню), ширина воздействия {2}.";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = [
        this._FireDashMaxDistancePerLevel, this._FireDashAddDamagePerLevel, this._FireDashWidthPerLevel
    ];

    ///////////////////////////////////

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            var heroCell   = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            var moveVec    = this._caster.DirectionVector();
            var targetCell = heroCell.Add(moveVec.Scale(Spell_fiery_dash._FireDashMaxDistancePerLevel[this.level])).Round();
            while (!(targetCell.X == heroCell.X && targetCell.Y == heroCell.Y)) {
                var hordeCell = targetCell.ToHordePoint();
                if (unitCanBePlacedByRealMap(this._caster.hordeUnit.Cfg, hordeCell.X, hordeCell.Y)
                    && this._caster.hordeUnit.MapMind.CheckPathTo(hordeCell, false).Found) {
                    break;
                }

                targetCell = targetCell.Minus(moveVec).Round();
            }

            var dashCells : Array<Cell> = [new Cell(heroCell.X, heroCell.Y)];
            var moveNormalVec = new Cell(-moveVec.Y, moveVec.X);
            for (var i = 0; i < (Spell_fiery_dash._FireDashWidthPerLevel[this.level] - 1) / 2; i++) {
                dashCells.push(dashCells[0].Add(moveNormalVec.Scale(i + 1)).Round());
                dashCells.push(dashCells[0].Add(moveNormalVec.Scale(-(i + 1))).Round());
            }

            while (!(targetCell.X == dashCells[0].X && targetCell.Y == dashCells[0].Y)) {
                for (var i = 0; i < dashCells.length; i++) {
                    var dashPoint = dashCells[i].Scale(32).Add(new Cell(16, 16)).ToHordePoint();
                    spawnDecoration(
                        ActiveScena.GetRealScena(),
                        Spell_fiery_dash._FireDashEffect,
                        dashPoint);
                    var upperHordeUnit = ActiveScena.UnitsMap.GetUpperUnit(dashCells[i].ToHordePoint());
                    if (upperHordeUnit
                        && !upperHordeUnit.Cfg.Flags.HasFlag(UnitFlags.FireResistant)
                        //&& this._caster.unit.Owner.Diplomacy.GetDiplomacyStatus(upperHordeUnit.Owner) == DiplomacyStatus.War) {
                        && SpellRefData.diplomacyTable[parseInt(this._caster.hordeUnit.Owner.Uid)][parseInt(upperHordeUnit.Owner.Uid)]
                        === DiplomacyStatus.War) {
                        HordeClassLibrary.World.Objects.Bullets.Implementations.Fire.BaseFireBullet.MakeFire(
                            this._caster.hordeUnit, dashPoint, UnitMapLayer.Main, Spell_fiery_dash._FireConfig);
                        this._caster.hordeUnit.BattleMind.CauseDamage(upperHordeUnit,
                            Spell_fiery_dash._FireDashAddDamagePerLevel[this.level] + upperHordeUnit.Cfg.Shield,
                            UnitHurtType.Fire
                        );
                        // upperHordeUnit.BattleMind.TakeDamage(
                        //     Spell_fiery_dash._FireDashAddDamagePerLevel[this.level] + upperHordeUnit.Cfg.Shield,
                        //     UnitHurtType.Any);
                    }
                    dashCells[i] = dashCells[i].Add(moveVec).Round();
                }
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
