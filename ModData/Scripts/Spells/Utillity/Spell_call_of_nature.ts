import { ISpell, SpellRefData } from "../ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, Stride_Color, TileType, Unit, UnitDirection } from "library/game-logic/horde-types";
import { IUnitCaster } from "../IUnitCaster";
import { spawnUnit } from "library/game-logic/unit-spawn";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { generateCellInSpiral } from "library/common/position-tools";
import {Cell} from "../../Core/Cell";
import { Bear } from "../../Heroes/Hero_Hunter";

export class Spell_call_of_nature extends ISpell {
    protected static _ButtonUid                     : string = "Spell_call_of_nature";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_call_of_nature";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(18, 228, 47, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 18, 228, 47);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(4, 0);

    protected static _CallRadius             : number = 20;
    protected static _SpawnedCountPerLevel   : Array<number> = [10, 12, 14, 16, 18];
    protected static _DurationPerLevel       : Array<number> = [15, 20, 25, 30, 35].map(sec => sec * 50);
    protected static _ChargesCountPerLevel   : Array<number> = [1, 1, 2, 2, 3];

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Зов природы";
    protected static _DescriptionTemplate           : string = "Из ближайших лесов (до " + Spell_call_of_nature._CallRadius + ")" +
        " призывает {0} медведей, которые живут в течении {1} секунд.";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._SpawnedCountPerLevel, this._DurationPerLevel.map(ticks => ticks / 50)];

    private _spawnedUnits : Array<Unit>;
    
    constructor(caster: IUnitCaster) {
        super(caster);
        this._spawnedUnits = new Array<Unit>();
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            var generator = generateCellInSpiral(heroCell.X, heroCell.Y);
            var spawnedConfig = Bear.GetHordeConfig();
            var spawnedCount = 0;
            for (let position = generator.next(); !position.done
                && this._spawnedUnits.length < Spell_call_of_nature._SpawnedCountPerLevel[this.level];
                position = generator.next()) {
                var cell = new Cell(position.value.X, position.value.Y);

                // проверяем радиус
                if (heroCell.Minus(cell).Length_Chebyshev() > Spell_call_of_nature._CallRadius) {
                    break;
                }

                // спавним в лесу
                if (SpellRefData.GameField.GetTileType(cell) == TileType.Forest
                    && unitCanBePlacedByRealMap(spawnedConfig, cell.X, cell.Y)) {
                    var unit = spawnUnit(this._caster.hordeUnit.Owner, spawnedConfig, cell.ToHordePoint(), UnitDirection.Down);
                    if (unit) {
                        spawnedCount ++;
                        this._spawnedUnits.push(unit);
                    }
                }
            }

            return spawnedCount > 0;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // Check if duration ended
        if (this._activatedTick + Spell_call_of_nature._DurationPerLevel[this.level] <= gameTickNum) {
            this._spawnedUnits.forEach(unit => {
                if (!unit.IsDead) {
                    unit.Delete();
                    spawnDecoration(
                        ActiveScena.GetRealScena(),
                        HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust"),
                        Cell.ConvertHordePoint(unit.Cell).Scale(32).Add(new Cell(16, 16)).ToHordePoint());
                }
            });
            this._spawnedUnits.splice(0);
            return false;
        }

        return true;
    }
}
