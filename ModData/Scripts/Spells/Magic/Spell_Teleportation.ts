import { generateCellInSpiral } from "library/common/position-tools";
import { iterateOverUnitsInBox, unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { createPoint, HordeColor } from "library/common/primitives";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { DiplomacyStatus, Stride_Color, TileType, UnitFlags, UnitHurtType, VisualEffectConfig } from "library/game-logic/horde-types";
import { ITargetPointSpell } from "../ITargetPointSpell";
import {Cell} from "../../Core/Cell";
import {SpellRefData} from "../ISpell";

export class Spell_Teleportation extends ITargetPointSpell {
    protected static _ButtonUid                     : string = "Spell_Teleportation";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_teleportation";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(139, 133, 172, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 139, 133, 172);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(2, 0);

    private static _TeleportDamageEffectConfig : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_MagicCircle");

    private static _TeleportMaxDistancePerLevel : Array<number> = [
        8, 10, 12, 14, 16
    ];
    protected static _ChargesCountPerLevel : Array<number> = [
        1, 2, 3, 4, 5
    ];
    private static _TeleportAddDamagePerLevel : Array<number> = [
        0, 0, 9, 11, 14
    ]
    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Телепортация";
    protected static _DescriptionTemplate           : string = 
        "Телепортация героя в достижимую клетку, максимальное расстояние {0} клеток. В 5х5"
        + " клеток вокруг назначения телепорта наносит {1} магического урона (игнорирует броню)."
        + " При телепортации в клетку с лесом дымок не появляется!";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = [
        this._TeleportMaxDistancePerLevel, this._TeleportAddDamagePerLevel
    ];

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
        var moveVec  = this._targetCell.Minus(heroCell);
        var distance = moveVec.Length_Chebyshev();

        // максимальная дистанция телепорта
        if (distance > Spell_Teleportation._TeleportMaxDistancePerLevel[this.level]) {
            moveVec = moveVec.Scale(Spell_Teleportation._TeleportMaxDistancePerLevel[this.level] / distance).Round();
        }

        var targetCell = heroCell.Add(moveVec);

        // выбираем свободную клетку
        var generator = generateCellInSpiral(targetCell.X, targetCell.Y);
        for (let position = generator.next(); !position.done; position = generator.next()) {
            var tpCell = createPoint(position.value.X, position.value.Y);

            if (unitCanBePlacedByRealMap(this._caster.hordeUnit.Cfg, tpCell.X, tpCell.Y)) {
                spawnDecoration(
                    ActiveScena.GetRealScena(),
                    HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust"),
                    heroCell.Scale(32).Add(new Cell(16, 16)).ToHordePoint());
                this._caster.hordeUnit.MapMind.TeleportToCell(tpCell);
                if (SpellRefData.GameField.GetTileType(Cell.ConvertHordePoint(tpCell)) != TileType.Forest) {
                    spawnDecoration(
                        ActiveScena.GetRealScena(),
                        HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust"),
                        Cell.ConvertHordePoint(tpCell).Scale(32).Add(new Cell(16, 16)).ToHordePoint());
                }

                // наносим урон врагам вокруг
                if (Spell_Teleportation._TeleportAddDamagePerLevel[this.level] > 0) {
                    let unitsIter = iterateOverUnitsInBox(this._caster.hordeUnit.Cell, 5);
                    for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
                        if (//this._caster.unit.Owner.Diplomacy.GetDiplomacyStatus(u.value.Owner) == DiplomacyStatus.War
                            SpellRefData.diplomacyTable[parseInt(this._caster.hordeUnit.Owner.Uid)][parseInt(u.value.Owner.Uid)]
                            == DiplomacyStatus.War
                            && !u.value.Cfg.Flags.HasFlag(UnitFlags.MagicResistant)) {
                            // u.value.BattleMind.TakeDamage(Spell_Teleportation._TeleportAddDamagePerLevel[this.level]
                            //     + u.value.Cfg.Shield,
                            //     UnitHurtType.Any);
                            this._caster.hordeUnit.BattleMind.CauseDamage(u.value,
                                Spell_Teleportation._TeleportAddDamagePerLevel[this.level] + u.value.Cfg.Shield,
                                UnitHurtType.Any);
                            spawnDecoration(
                                ActiveScena.GetRealScena(),
                                Spell_Teleportation._TeleportDamageEffectConfig,
                                u.value.Position.ToPoint2D());
                        }
                    }
                }
                break;
            }
        }

        return false;
    }
}
