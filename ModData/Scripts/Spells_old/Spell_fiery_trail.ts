import { ISpell } from "./ISpell";
import { HordeColor } from "library/common/primitives";
import { BulletConfig, DiplomacyStatus, Stride_Color, UnitMapLayer, VisualEffectConfig } from "library/game-logic/horde-types";
import { Cell } from "../Core/Cell";
import { IUnitCaster } from "./IUnitCaster";
import { spawnDecoration } from "library/game-logic/decoration-spawn";

export class Spell_fiery_trail extends ISpell {
    private static _FireConfig : BulletConfig = HordeContentApi.GetBulletConfig("#BulletConfig_Fire");
    private static _TrailEffect : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleRedDust");
    private static _TrailDuration : number = 10*50;

    protected static _ButtonUid                     : string = "Spell_fiery_trail";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_fiery_trail";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(228, 18, 47, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 228, 18, 47);
    protected static _Name                          : string = "Огненный след";
    protected static _Description                   : string = "В течении " + (Spell_fiery_trail._TrailDuration / 50) + " секунд оставляет огненный след, который поджигает всех чужаков.";
    
    private _trailCells : Array<Cell>;

    constructor(caster: IUnitCaster) {
        super(caster);

        this._trailCells = new Array<Cell>();
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // проверяем, что закончилось
        if (this._activatedTick + Spell_fiery_trail._TrailDuration <= gameTickNum) {
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
            // проверяем, что на клетке нет своего юнита
            var upperHordeUnit = ActiveScena.UnitsMap.GetUpperUnit(cell.ToHordePoint());
            if (upperHordeUnit && this._caster.hordeUnit.Owner.Diplomacy.GetDiplomacyStatus(upperHordeUnit.Owner) != DiplomacyStatus.War) {
                return;
            }
            
            // поджигаем клетку
            var trailPoint = cell.Scale(32).Add(new Cell(16, 16)).ToHordePoint();
            HordeClassLibrary.World.Objects.Bullets.Implementations.Fire.BaseFireBullet.MakeFire(
                this._caster.hordeUnit, trailPoint, UnitMapLayer.Main, Spell_fiery_trail._FireConfig);
            spawnDecoration(
                ActiveScena.GetRealScena(),
                Spell_fiery_trail._TrailEffect,
                trailPoint);
        });

        return true;
    }
}
