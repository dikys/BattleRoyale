import { createPF, HordeColor } from "library/common/primitives";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import { ACommandArgs, BulletConfig, DiplomacyStatus, ShotParams, Stride_Color, UnitCommandConfig, UnitFlags, UnitHurtType, UnitMapLayer, VisualEffectConfig } from "library/game-logic/horde-types";
import { ITargetPointSpell } from "../ITargetPointSpell";
import { IUnitCaster } from "../IUnitCaster";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { Cell } from "../../Core/Cell";
import { SpellRefData } from "../ISpell";

export class Spell_PoisonBomb_v2 extends ITargetPointSpell {
    protected static _ButtonUid                     : string = "Spell_PoisonBomb_v2";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_PoisonBomb";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(0, 200, 0, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 0, 200, 0);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(2, 0);

    private static _Init : boolean = false;
    private static _BombConfig : BulletConfig;
    private static _BombShotParams : ShotParams;

    private static _MaxDistance : number = 10;
    private static _CloudIncreasePeriod : number = 1.2*50;
    private static _CloudEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_BloodGreenPool");
    private static _CloudDurationPerLevel : Array<number> = [
        8, 10, 12, 14, 16
    ].map(sec => sec * 50);
    private static _CloudDamagePerLevel : Array<number> = [
        1, 1, 2, 2, 3
    ];
    protected static _ChargesCountPerLevel   : Array<number> = [
        1, 1, 2, 2, 3
    ];

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Ядовитая бомба";
    protected static _DescriptionTemplate           : string =
        "Запускает ядовитую бомбу в выбранном направлении до " + Spell_PoisonBomb._MaxDistance
        + " клеток, которая распространяет яд вокруг попавшей клетки в течении "
        + " {0} секунд до 9х9 клеток. Яд наносит врагам {1} магического урона в секунду."
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._CloudDurationPerLevel.map(ticks => ticks / 50), this._CloudDamagePerLevel.map(damage => damage * 50 / this._ProcessingModule)];

    ///////////////////////////////////

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

    public static GetCommandConfig(slotNum: number, level: number) : UnitCommandConfig {
        var config = super.GetCommandConfig(slotNum, level);

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
                this._caster.hordeUnit.Position.ToPoint2D(),
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

        if (this._activatedTick + Spell_PoisonBomb._CloudDurationPerLevel[this.level] < gameTickNum) {
            this._cloudCells.splice(0);
            this._cloudCellsHash.clear();

            return false;
        }

        if (this._cloudIncreaseTick < gameTickNum) {
            this._cloudIncreaseTick += Spell_PoisonBomb._CloudIncreasePeriod;
            
            // распространяем лужу
            if (this._activatedTick + 4 * Spell_PoisonBomb._CloudIncreasePeriod >= gameTickNum) {
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

            // декорации
            this._cloudCells.forEach(cell => {
                spawnDecoration(
                    ActiveScena.GetRealScena(),
                    Spell_PoisonBomb._CloudEffect,
                    cell.Scale(32).Add(new Cell(16, 16)).ToHordePoint());
            });
        }

        // урон
        this._cloudCells.forEach(cell => {
            var upperHordeUnit = ActiveScena.UnitsMap.GetUpperUnit(cell.ToHordePoint());
            if (upperHordeUnit
                && !upperHordeUnit.Cfg.Flags.HasFlag(UnitFlags.MagicResistant)
                && SpellRefData.diplomacyTable[parseInt(this._caster.hordeUnit.Owner.Uid)][parseInt(upperHordeUnit.Owner.Uid)]) {
                // upperHordeUnit.BattleMind.TakeDamage(Spell_PoisonBomb._CloudDamagePerLevel[this.level] + upperHordeUnit.Cfg.Shield,
                //     UnitHurtType.Any);
                this._caster.hordeUnit.BattleMind.CauseDamage(upperHordeUnit,
                    Spell_PoisonBomb._CloudDamagePerLevel[this.level] + upperHordeUnit.Cfg.Shield,
                    UnitHurtType.Any);
            }
        });

        return true;
    }
}
