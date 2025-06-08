import { ISpell, SpellGlobalRef } from "./ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, Stride_Color, TileType, UnitDirection, UnitHurtType } from "library/game-logic/horde-types";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { spawnUnit } from "library/game-logic/unit-spawn";
import { IUnitCaster } from "./IUnitCaster";
import { generateCellInSpiral } from "library/common/position-tools";
import { Cell } from "../Core/Cell";
import { Bear } from "../Heroes/Hero_Hunter";
import { IUnit } from "../Units/IUnit";

export class Spell_call_of_nature extends ISpell {
    private static _Radius : number = 20;
    private static _SpawnCount : number = 10;
    private static _Duration : number = 15*50;

    protected static _ButtonUid                     : string = "Spell_call_of_nature";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_call_of_nature";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(18, 228, 47, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 18, 228, 47);
    protected static _Name                          : string = "Зов природы";
    protected static _Description                   : string = "Из ближайших лесов (до " + Spell_call_of_nature._Radius + " клеток) появляется "
        + Spell_call_of_nature._SpawnCount + " медведей, которые живут в течении " + (Spell_call_of_nature._Duration / 50)
        + " секунд.";

    private _spawnedUnits : Array<IUnit>;

    constructor(caster: IUnitCaster) {
        super(caster);

        this._spawnedUnits = new Array<IUnit>();
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            var heroCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);
            var generator = generateCellInSpiral(heroCell.X, heroCell.Y);
            var spawnedConfig = Bear.GetHordeConfig();
            for (let position = generator.next(); !position.done && this._spawnedUnits.length < Spell_call_of_nature._SpawnCount; position = generator.next()) {
                var cell = new Cell(position.value.X, position.value.Y);

                // проверяем радиус
                if (heroCell.Minus(cell).Length_Chebyshev() > Spell_call_of_nature._Radius) {
                    break;
                }

                // спавним в лесу
                if (SpellGlobalRef.GameField.GetTileType(cell) == TileType.Forest
                    && unitCanBePlacedByRealMap(spawnedConfig, cell.X, cell.Y)) {
                    var unit = spawnUnit(this._caster.hordeUnit.Owner, spawnedConfig, cell.ToHordePoint(), UnitDirection.Down);
                    if (unit) {
                        this._spawnedUnits.push(new Bear(unit));
                    }
                }
            }

            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        // проверяем, что закончилось
        if (this._activatedTick + Spell_call_of_nature._Duration <= gameTickNum) {
            this._spawnedUnits.forEach(unit => {
                unit.hordeUnit.BattleMind.InstantDeath(null, UnitHurtType.Mele);
            });
            this._spawnedUnits.splice(0);
            return false;
        }

        return true;
    }
}
