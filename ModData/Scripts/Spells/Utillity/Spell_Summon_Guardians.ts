import { ISpell } from "../ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, Stride_Color, Unit, UnitDirection } from "library/game-logic/horde-types";
import { IUnitCaster } from "../IUnitCaster";
import { spawnUnit } from "library/game-logic/unit-spawn";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { spawnDecoration } from "library/game-logic/decoration-spawn";
import { generateCellInSpiral } from "library/common/position-tools";
import {Cell} from "../../Core/Cell";

export class Spell_Summon_Guardians extends ISpell {
    protected static _ButtonUid                     : string = "Spell_Summon_Guardians";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_Summon_Guardians";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(100, 100, 255, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 100, 100, 255);
    protected static _SpellPreferredProductListPosition : Cell = new Cell(4, 0);

    private static _GuardiansCountPerLevel   : Array<number> = [3, 4, 5, 6, 7];
    private static _DurationPerLevel         : Array<number> = [10, 15, 20, 25, 30].map(sec => sec * 50);
    protected static _ChargesCountPerLevel   : Array<number> = [1, 1, 2, 2, 3];

    protected static _MaxLevel                      : number = 4;
    protected static _NamePrefix                    : string = "Призыв стражей";
    protected static _DescriptionTemplate           : string = "Призывает {0} стражей вокруг героя на {1} секунд для атаки врагов.";
    protected static _DescriptionParamsPerLevel     : Array<Array<any>> = 
        [this._GuardiansCountPerLevel, this._DurationPerLevel.map(ticks => ticks / 50)];

    private _spawnedUnits : Array<Unit>;
    
    constructor(caster: IUnitCaster) {
        super(caster);
        this._spawnedUnits = new Array<Unit>();
    }

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            var guardianConfig = HordeContentApi.GetUnitConfig("#UnitConfig_Slavyane_Heavymen");
            var casterCell = Cell.ConvertHordePoint(this._caster.hordeUnit.Cell);

            // Find free cells around caster in spiral order and spawn guardians
            var generator = generateCellInSpiral(casterCell.X, casterCell.Y);
            generator.next(); // skip caster's cell

            var spawnedCount = 0;
            var maxGuardians = Spell_Summon_Guardians._GuardiansCountPerLevel[this.level];

            while (spawnedCount < maxGuardians) {
                var next = generator.next();
                if (next.done) break;

                var cell = new Cell(next.value.X, next.value.Y);

                if (unitCanBePlacedByRealMap(guardianConfig, cell.X, cell.Y)) {
                    var unit = spawnUnit(
                        this._caster.hordeUnit.Owner, guardianConfig, cell.ToHordePoint(), UnitDirection.Down);
                    if (unit) {
                        this._spawnedUnits.push(unit);
                        spawnDecoration(
                            ActiveScena.GetRealScena(),
                            HordeContentApi.GetVisualEffectConfig("#VisualEffectConfig_LittleDust"),
                            Cell.ConvertHordePoint(unit.Cell).Scale(32).Add(new Cell(16, 16)).ToHordePoint());
                        spawnedCount++;
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
        if (this._activatedTick + Spell_Summon_Guardians._DurationPerLevel[this.level] <= gameTickNum) {
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
