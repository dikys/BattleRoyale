import { ISpell } from "./ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, DiplomacyStatus, Stride_Color, Unit, UnitCommand, VisualEffectConfig } from "library/game-logic/horde-types";
import { iterateOverUnitsInBox } from "library/game-logic/unit-and-map";
import { IUnitCaster } from "./IUnitCaster";
import { IUnit } from "../Units/IUnit";
import { Cell } from "../Core/Cell";
import { AssignOrderMode } from "library/mastermind/virtual-input";
import { spawnDecoration } from "library/game-logic/decoration-spawn";

export class Spell_fear_attack extends ISpell {
    private static _FearTime   : number = 7*50;
    private static _FearRadius : number = 3;
    private static _FearEffectConfig : VisualEffectConfig = HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_MagicCircle");
    
    protected static _ButtonUid                     : string = "Spell_fear_attack";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_fear_attack";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(81, 207, 207, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 81, 207, 207);
    protected static _Name                          : string = "Приступ страха";
    protected static _Description                   : string = "Вселяет страх во вражеских юнитов на расстоянии " + Spell_fear_attack._FearRadius
        + " клеток в течении " + (Spell_fear_attack._FearTime / 50) + " секунд";

    private _fearUnits : Array<IUnit>;
    // @ts-expect-error
    private _fearCell : Cell;

    constructor(caster: IUnitCaster) {
        super(caster);

        this._fearUnits = new Array<IUnit>();
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            this._fearCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            
            var scenaWidth  = ActiveScena.GetRealScena().Size.Width;
            var scenaHeight = ActiveScena.GetRealScena().Size.Height;
            for (var x = Math.max(0, this._fearCell.X - Spell_fear_attack._FearRadius); x <= Math.min(scenaWidth, this._fearCell.X + Spell_fear_attack._FearRadius); x++) {
                for (var y = Math.max(0, this._fearCell.Y - Spell_fear_attack._FearRadius); y <= Math.min(scenaHeight, this._fearCell.Y + Spell_fear_attack._FearRadius); y++) {
                    var targetCell = new Cell(x, y).Scale(32).Add(new Cell(16, 16)).ToHordePoint();
                    spawnDecoration(
                        ActiveScena.GetRealScena(),
                        Spell_fear_attack._FearEffectConfig,
                        targetCell);
                }
            }

            let unitsIter = iterateOverUnitsInBox(this._caster.hordeUnit.Cell, Spell_fear_attack._FearRadius);
            for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
                if (this._caster.hordeUnit.Owner.Diplomacy.GetDiplomacyStatus(u.value.Owner) == DiplomacyStatus.War
                    && u.value.Cfg.IsBuilding == false) {
                    if (u.value.ScriptData.IUnit) {
                        this._fearUnits.push(u.value.ScriptData.IUnit);
                    } else {
                        this._fearUnits.push(new IUnit(u.value));
                    }
                }
            }
            for (var unit of this._fearUnits) {
                unit.DisallowCommands();
            }
            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // проверяем, что лечение закончилось
        if (this._activatedTick + Spell_fear_attack._FearTime <= gameTickNum) {
            for (var unit of this._fearUnits) {
                unit.AllowCommands();
            }

            return false;
        }

        for (var unitNum = 0; unitNum < this._fearUnits.length; unitNum++) {
            var unit = this._fearUnits[unitNum];
            if (unit.hordeUnit.IsDead) {
                this._fearUnits.splice(unitNum, 1);
                unitNum--;
            }

            var unitPoint = Cell.ConvertHordePoint(unit.hordeUnit.Cell).Scale(32).Add(new Cell(16, 16)).ToHordePoint();
            spawnDecoration(
                ActiveScena.GetRealScena(),
                Spell_fear_attack._FearEffectConfig,
                unitPoint);

            var targetCell = this._fearCell.Add(Cell.ConvertHordePoint(unit.hordeUnit.Cell).Minus(this._fearCell).Scale(10));
            unit.AllowCommands();
            unit.GivePointCommand(targetCell, UnitCommand.MoveToPoint, AssignOrderMode.Replace);
            unit.DisallowCommands();
        }

        return true;
    }
}
