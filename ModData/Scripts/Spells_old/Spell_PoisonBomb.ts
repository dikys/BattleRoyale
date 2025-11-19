import { createPF, HordeColor } from "library/common/primitives";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import { ACommandArgs, BulletConfig, DiplomacyStatus, ShotParams, Stride_Color, UnitCommandConfig, UnitHurtType, UnitMapLayer, VisualEffectConfig } from "library/game-logic/horde-types";
import { ITargetPointSpell } from "./ITargetPointSpell";
import { Cell } from "../Core/Cell";
import { IUnitCaster } from "./IUnitCaster";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { log } from "library/common/logging";

export class Spell_PoisonBomb extends ITargetPointSpell {
    private static _MaxDistance : number = 10;
    private static _CloudDuration : number = 8*50;
    private static _CloudIncreasePeriod : number = 2*50;
    private static _CloudEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_BloodGreenPool");
    private static _CloudDamage : number = 1;

    private static _Init : boolean = false;
    private static _BombConfig : BulletConfig;
    private static _BombShotParams : ShotParams;

    protected static _ButtonUid                     : string = "Spell_PoisonBomb";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_PoisonBomb";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(0, 200, 0, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 0, 200, 0);
    protected static _Name                          : string = "Ядовитая бомба";
    protected static _Description                   : string = "Запускает ядовитую бомбу в выбранном направлении до "
        + Spell_PoisonBomb._MaxDistance + " клеток, которая распространяет яд вокруг попавшей клетки в течении " + (Spell_PoisonBomb._CloudDuration / 50) + " секунд. "
        // @ts-expect-error
        + " Яд наносит врагам " + (50 * Spell_PoisonBomb._CloudDamage / Spell_PoisonBomb._ProcessingPeriod) + " урона в секунду.";

    private _cloudCells : Array<Cell>;
    private _cloudIncreaseTick : number;
    private _cloudCellsHash : Map<number, number>;
    private _scenaWidth : number;
    private _scenaHeight : number;

    constructor(caster: IUnitCaster) {
        super(caster);

        this._cloudCells = new Array<Cell>();
        this._cloudIncreaseTick = -1;
        this._cloudCellsHash = new Map<number, number>();
        this._scenaWidth  = ActiveScena.GetRealScena().Size.Width;
        this._scenaHeight = ActiveScena.GetRealScena().Size.Height;
    }

    public static GetCommandConfig(slotNum: number) : UnitCommandConfig {
        var config = super.GetCommandConfig(slotNum);

        if (!this._Init) {
            this._BombConfig = HordeContentApi.GetBulletConfig("#BulletConfig_CatapultBomb");
            this._BombShotParams = ShotParams.CreateInstance();
            ScriptUtils.SetValue(this._BombShotParams, "Damage", 1);
            ScriptUtils.SetValue(this._BombShotParams, "AdditiveBulletSpeed", createPF(0, 0));
        }

        return config;
    }

    public Activate(activateArgs: ACommandArgs) : boolean {
        if (super.Activate(activateArgs)) {
            var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            var moveVec  = this._targetCell.Minus(heroCell);
    
            // максимальная дистанция
            var distance = moveVec.Length_Chebyshev();
            if (distance > Spell_PoisonBomb._MaxDistance) {
                moveVec = moveVec.Scale(Spell_PoisonBomb._MaxDistance / distance).Round();
            }
    
            var targetCell = heroCell.Add(moveVec);
            spawnBullet(
                this._caster.hordeUnit,  // Игра будет считать, что именно этот юнит запустил снаряд
                null,
                null,
                Spell_PoisonBomb._BombConfig,
                Spell_PoisonBomb._BombShotParams,
                this._caster.hordeUnit.Position,
                targetCell.Scale(32).Add(new Cell(16, 16)).ToHordePoint(),
                UnitMapLayer.Main
            );
            this._cloudCells.push(targetCell);
            this._cloudCellsHash.set(targetCell.Hash(), 1);
            this._cloudIncreaseTick = this._activatedTick + Spell_PoisonBomb._CloudIncreasePeriod;

            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        if (this._activatedTick + Spell_PoisonBomb._CloudDuration < gameTickNum) {
            this._cloudCells.splice(0);
            this._cloudCellsHash.clear();

            return false;
        }

        if (this._cloudIncreaseTick < gameTickNum) {
            this._cloudIncreaseTick += Spell_PoisonBomb._CloudIncreasePeriod;
            
            this._cloudCells.forEach(cell => {
                for (var x = Math.max(0, cell.X - 1); x <= Math.min(this._scenaWidth, cell.X + 1); x++) {
                    for (var y = Math.max(0, cell.Y - 1); y <= Math.min(this._scenaHeight, cell.Y + 1); y++) {
                        var cloudCell     = new Cell(x, y);
                        var cloudCellHash = cloudCell.Hash();
                        if (this._cloudCellsHash.has(cloudCellHash)) {
                            continue;
                        }

                        this._cloudCellsHash.set(cloudCellHash, 1);
                        this._cloudCells.push(cloudCell);
                    }
                }
            });
        }

        this._cloudCells.forEach(cell => {
            spawnDecoration(
                ActiveScena.GetRealScena(),
                Spell_PoisonBomb._CloudEffect,
                cell.Scale(32).Add(new Cell(16, 16)).ToHordePoint());

            var upperHordeUnit = ActiveScena.UnitsMap.GetUpperUnit(cell.ToHordePoint());
            if (upperHordeUnit && this._caster.hordeUnit.Owner.Diplomacy.GetDiplomacyStatus(upperHordeUnit.Owner) == DiplomacyStatus.War) {
                upperHordeUnit.BattleMind.TakeDamage(Spell_PoisonBomb._CloudDamage, UnitHurtType.Mele);
            }
        });

        return true;
    }
}
