import { HordeColor } from "library/common/primitives";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { Stride_Color, BulletConfig, VisualEffectConfig, UnitFlags, DiplomacyStatus, UnitMapLayer, UnitHurtType } from "library/game-logic/horde-types";
import {ISpell, SpellRefData} from "../ISpell";
import { IUnitCaster } from "../IUnitCaster";
import {Cell} from "../../Core/Cell";

export class Spell_fiery_trail extends ISpell {
    protected static _ButtonUid                     : string = "Spell_fiery_trail";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_fiery_trail";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(228, 18, 47, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 228, 18, 47);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(1, 0);
    
    private static _TrailDurationPerLevel   : Array<number> = [
        10, 12, 15, 18, 20
    ].map(sec => sec*50);
    private static _TrailAddDamagePerLevel : Array<number> = [
        0, 1, 5, 6, 7
    ];
    protected static _ChargesCountPerLevel   : Array<number> = [
        1, 1, 2, 2, 3
    ];
    private static _FireConfig : BulletConfig = HordeContentApi.GetBulletConfig("#BulletConfig_Fire");
    private static _TrailEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleRedDust");

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Огненный след";
    protected static _DescriptionTemplate           : string =
        "В течении {0} секунд оставляет огненный след, который поджигает врагов"
        + " и дополнительно наносит {1} огненного урона/сек (игнорирует броню)";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._TrailDurationPerLevel.map(ticks => ticks / 50), this._TrailAddDamagePerLevel.map(damage => damage * 50 / this._ProcessingModule)];

    ///////////////////////////////////

    private _trailCells : Array<Cell>;

    constructor(caster: IUnitCaster) {
        super(caster);

        this._trailCells = new Array<Cell>();
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // проверяем, что закончилось
        if (this._activatedTick + Spell_fiery_trail._TrailDurationPerLevel[this.level] <= gameTickNum) {
            this._trailCells.splice(0);
            return false;
        }

        // добавляем клетки в след
        var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
        if (this._trailCells.length == 0
            || this._trailCells[this._trailCells.length - 1].X != heroCell.X
            || this._trailCells[this._trailCells.length - 1].Y != heroCell.Y) {
            this._trailCells.push(heroCell);
        }

        // поджигаем след
        this._trailCells.forEach(cell => {
            var trailPoint = cell.Scale(32).Add(new Cell(16, 16)).ToHordePoint();

            // проверяем, что на клетке нет своего юнита
            var upperHordeUnit = ActiveScena.UnitsMap.GetUpperUnit(cell.ToHordePoint());
            if (upperHordeUnit
                && !upperHordeUnit.Cfg.Flags.HasFlag(UnitFlags.FireResistant)
                && SpellRefData.diplomacyTable[parseInt(this._caster.hordeUnit.Owner.Uid)][parseInt(upperHordeUnit.Owner.Uid)]
                === DiplomacyStatus.War) {
                //&& this._caster.unit.Owner.Diplomacy.GetDiplomacyStatus(upperHordeUnit.Owner) == DiplomacyStatus.War) {
                HordeClassLibrary.World.Objects.Bullets.Implementations.Fire.BaseFireBullet.MakeFire(
                    this._caster.hordeUnit, trailPoint, UnitMapLayer.Main, Spell_fiery_trail._FireConfig);
                this._caster.hordeUnit.BattleMind.CauseDamage(upperHordeUnit,
                    Spell_fiery_trail._TrailAddDamagePerLevel[this.level] + upperHordeUnit.Cfg.Shield,
                    UnitHurtType.Fire);
                // upperHordeUnit.BattleMind.TakeDamage(
                //     Spell_fiery_trail._TrailAddDamagePerLevel[this.level] + upperHordeUnit.Cfg.Shield,
                //     UnitHurtType.Any);
            }
            
            spawnDecoration(
                ActiveScena.GetRealScena(),
                Spell_fiery_trail._TrailEffect,
                trailPoint);
        });

        return true;
    }
}
