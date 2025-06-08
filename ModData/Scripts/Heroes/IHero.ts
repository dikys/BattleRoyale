import { ACommandArgs, GeometryCanvas, GeometryVisualEffect, Stride_Color, Stride_Vector2, TileType, Unit, UnitCommand, UnitFlags } from "library/game-logic/horde-types";
import { IConfig } from "../Units/IConfig";
import { spawnGeometry } from "library/game-logic/decoration-spawn";
import { Formation2 } from "../Core/Formation2";
import { BuildingTemplate } from "../Units/IFactory";
import { Cell } from "../Core/Cell";
import { IUnitCaster } from "../Spells/IUnitCaster";
import { IUnit } from "../Units/IUnit";
import { ISpell } from "../Spells/ISpell";

export class IHero extends IUnitCaster {
    // способности
    protected static _Spells : Array<typeof ISpell>;
    // настройки формации - начальный радиус
    protected static _FormationStartRadius : number = 3;
    // настройки формации - плотность орбит
    protected static _FormationDestiny : number = 1 / 3;
    
    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        var spellsInfo = "";
        for (var spellNum = 0; spellNum < this._Spells.length; spellNum++) {
            spellsInfo += "Способность " + (spellNum + 1) + ": "
                + this._Spells[spellNum].GetName() + "\n"
                + this._Spells[spellNum].GetDescription() + "\n";
        }

        // формируем описание характеристик

        ScriptUtils.SetValue(this.Cfg, "Description",  this.Cfg.Description +
            (this.Cfg.Description == "" ? "" : "\n") +
            "  здоровье " + this.Cfg.MaxHealth + "\n" +
            "  броня " + this.Cfg.Shield + "\n" +
            (
                this.Cfg.MainArmament
                ? "  атака " + this.Cfg.MainArmament.ShotParams.Damage + "\n" +
                "  радиус атаки " + this.Cfg.MainArmament.Range + "\n"
                : ""
            ) +
            "  скорость бега " + this.Cfg.Speeds.Item.get(TileType.Grass) + " (в лесу " + this.Cfg.Speeds.Item.get(TileType.Forest) + ")" + "\n"
            + (this.Cfg.Flags.HasFlag(UnitFlags.FireResistant) || this.Cfg.Flags.HasFlag(UnitFlags.MagicResistant)
                ? "  иммунитет к " + (this.Cfg.Flags.HasFlag(UnitFlags.FireResistant) ? "огню " : "") + 
                    (this.Cfg.Flags.HasFlag(UnitFlags.MagicResistant) ? "магии " : "") + "\n"
                : "")
            + "  радиус видимости " + this.Cfg.Sight + " (в лесу " + this.Cfg.ForestVision + ")\n"
            + "\n" + spellsInfo);
    }

    // формация
    protected _formation : Formation2;

    constructor(hordeUnit: Unit) {
        super(hordeUnit);

        this._frame = null;
        
        // создаем класс формации
        this._formation = new Formation2(
            Cell.ConvertHordePoint(this.hordeUnit.Cell),
            this.constructor['_FormationStartRadius'],
            this.constructor['_FormationDestiny']);

        var spells = this.constructor["_Spells"];
        spells.forEach(spell => {
            this.AddSpell(spell);
        });
    }

    public IsDead() : boolean {
        return this.hordeUnit.IsDead;
    }

    public OnDestroyBuilding(buildingTemplate: BuildingTemplate, rarity: number, spawnUnitConfig: IConfig, spawnCount: number) : [IConfig, number] {
        return [spawnUnitConfig, spawnCount];
    }

    public AddUnitToFormation(unit: IUnit) {
        this._formation.AddUnits([ unit ]);
    }

    public OnEveryTick(gameTickNum: number): boolean {
        this._formation.OnEveryTick(gameTickNum);
        this._UpdateFrame();

        if (!super.OnEveryTick(gameTickNum)) {
            return false;
        }

        this._formation.SetCenter(Cell.ConvertHordePoint(this.hordeUnit.Cell));

        return true;
    }

    public OnOrder(commandArgs: ACommandArgs) {
        if (!super.OnOrder(commandArgs)) {
            return false;
        }

        // управление формацией

        if (commandArgs.CommandType == UnitCommand.Attack) {
            var targetHordeUnit = ActiveScena.UnitsMap.GetUpperUnit(commandArgs.TargetCell);
            if (targetHordeUnit) {
                this._formation.SetAttackTarget(new IUnit(targetHordeUnit));
            } else {
                this._formation.SmartAttackCell(Cell.ConvertHordePoint(commandArgs.TargetCell));
            }
        }
        else if (commandArgs.CommandType == UnitCommand.Cancel) {
            this._formation.SmartMoveToTargetCommand();
        }

        return true;
    }

    private _frame : GeometryVisualEffect | null;
    private _UpdateFrame() {
        if (this.IsDead()) {
            if (this._frame) {
                this._frame.Free();
                this._frame = null;
            }
            return;
        }

        if (!this._frame) {
            this._MakeFrame();
        } else {
            this._frame.Position = this.hordeUnit.Position;

            // в лесу рамка должна быть невидимой
            let landscapeMap = ActiveScena.GetRealScena().LandscapeMap;
            var tile = landscapeMap.Item.get(this.hordeUnit.Cell);
            if (tile.Cfg.Type == TileType.Forest) {
                this._frame.Visible = false;
            } else {
                this._frame.Visible = true;
            }
        }
    }
    private _MakeFrame() {
        // Объект для низкоуровневого формирования геометрии
        let geometryCanvas = new GeometryCanvas();
        
        const width  = 32;
        const height = 32;

        var points = host.newArr(Stride_Vector2, 5)  as Stride_Vector2[];;
        points[0] = new Stride_Vector2(Math.round(-0.7*width),  Math.round(-0.7*height));
        points[1] = new Stride_Vector2(Math.round( 0.7*width),  Math.round(-0.7*height));
        points[2] = new Stride_Vector2(Math.round( 0.7*width),  Math.round( 0.7*height));
        points[3] = new Stride_Vector2(Math.round(-0.7*width),  Math.round( 0.7*height));
        points[4] = new Stride_Vector2(Math.round(-0.7*width),  Math.round(-0.7*height));

        geometryCanvas.DrawPolyLine(points,
            new Stride_Color(
                this.hordeUnit.Owner.SettlementColor.R,
                this.hordeUnit.Owner.SettlementColor.G,
                this.hordeUnit.Owner.SettlementColor.B),
            3.0, false);

        let ticksToLive = GeometryVisualEffect.InfiniteTTL;
        this._frame = spawnGeometry(ActiveScena, geometryCanvas.GetBuffers(), this.hordeUnit.Position, ticksToLive);
    }
}
