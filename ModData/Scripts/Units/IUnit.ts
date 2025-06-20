import { createPoint } from "library/common/primitives";
import { UnitCommand, PointCommandArgs, UnitDirection, UnitConfig, Unit } from "library/game-logic/horde-types";
import { Cell } from "../Core/Cell";
import { IConfig } from "./IConfig";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";
import { log } from "library/common/logging";

const SpawnUnitParameters = HordeClassLibrary.World.Objects.Units.SpawnUnitParameters;

export function CreateUnit(config: IConfig, settlement: any, cell: Cell, ...args: any[]) : IUnit | null {
    let spawnParams = new SpawnUnitParameters();
    spawnParams.ProductUnitConfig = config.hordeConfig;
    spawnParams.Direction         = UnitDirection.RightDown;

    if (unitCanBePlacedByRealMap(config.hordeConfig, cell.X, cell.Y)) {
        spawnParams.Cell = createPoint(cell.X, cell.Y);
        var hordeUnit = settlement.Units.SpawnUnit(spawnParams);
        return new IUnit([ hordeUnit, ...args ]);
    } else {
        return null;
    }
}

export class IUnit extends IConfig {
// non-static
    // @ts-expect-error
    public hordeUnit: HordeClassLibrary.World.Objects.Units.Unit;
    /** тик на котором нужно обрабатывать юнита */
    private processingTick: number;
    /** модуль на который делится игровой тик, если остаток деления равен processingTick, то юнит обрабатывается */
    private processingTickModule: number;

    protected _disallowedCommands : any;
    // @ts-expect-error
    private _isDisallowedCommands : boolean;
    // @ts-expect-error
    private _cfg                  : UnitConfig;

    constructor(...args: any[]) {
        super(args[0].Cfg);

        this._SetHordeUnit(args[0]);
        this.processingTickModule           = 50;
        // @ts-expect-error
        this.processingTick                 = this.hordeUnit.PseudoTickCounter % this.processingTickModule;
    }

    private _SetHordeUnit(unit : Unit) {
        this.hordeUnit                      = unit;
        this.hordeUnit.ScriptData.IUnit     = this;
        this._disallowedCommands            = ScriptUtils.GetValue(this.hordeUnit.CommandsMind, "DisallowedCommands");
        this._isDisallowedCommands          = false;
        this._cfg                           = this.hordeUnit.Cfg;
    }

    public NeedProcessing(gameTickNum: number) : boolean {
        return gameTickNum % this.processingTickModule == this.processingTick;
    }

    public DisallowCommands() {
        if (!this._isDisallowedCommands) {
            this._isDisallowedCommands = true;
            this._disallowedCommands.Add(UnitCommand.MoveToPoint, 1);
            this._disallowedCommands.Add(UnitCommand.HoldPosition, 1);
            this._disallowedCommands.Add(UnitCommand.Attack, 1);
            this._disallowedCommands.Add(UnitCommand.Capture, 1);
            this._disallowedCommands.Add(UnitCommand.StepAway, 1);
            this._disallowedCommands.Add(UnitCommand.Cancel, 1);
        }
    }
    
    public AllowCommands() {
        if (this._isDisallowedCommands) {
            this._isDisallowedCommands = false;

            this._disallowedCommands.Remove(UnitCommand.MoveToPoint);
            this._disallowedCommands.Remove(UnitCommand.HoldPosition);
            this._disallowedCommands.Remove(UnitCommand.Attack);
            this._disallowedCommands.Remove(UnitCommand.Capture);
            this._disallowedCommands.Remove(UnitCommand.StepAway);
            this._disallowedCommands.Remove(UnitCommand.Cancel);
        }
    }

    public GivePointCommand(cell: Cell, command: any, orderMode: any) {
        if (IUnit._ScenaWidth <= 0) {
            IUnit._ScenaWidth  = ActiveScena.GetRealScena().Size.Width;
            IUnit._ScenaHeight = ActiveScena.GetRealScena().Size.Height;
        }

        cell.X = Math.max(0, cell.X);
        cell.Y = Math.max(0, cell.Y);
        cell.X = Math.min(IUnit._ScenaWidth, cell.X);
        cell.Y = Math.min(IUnit._ScenaHeight, cell.Y);

        var pointCommandArgs = new PointCommandArgs(createPoint(cell.X, cell.Y), command, orderMode);
        this._cfg.GetOrderDelegate(this.hordeUnit, pointCommandArgs);
    }

    public OnEveryTick(gameTickNum:number) : boolean {
        return this.NeedProcessing(gameTickNum);
    }

    public ReplaceHordeUnit(unit: Unit) {
        this._SetHordeUnit(unit);
    }

    public DirectionVector() : Cell {
        switch (this.hordeUnit.Direction) {
            case UnitDirection.Down:
                return new Cell(0, 1);
            case UnitDirection.LeftDown:
                return new Cell(-0.70710678118654752440084436210485, 0.70710678118654752440084436210485);
            case UnitDirection.Left:
                return new Cell(-1, 0);
            case UnitDirection.LeftUp:
                return new Cell(-0.70710678118654752440084436210485, -0.70710678118654752440084436210485);
            case UnitDirection.Up:
                return new Cell(0, -1);
            case UnitDirection.RightUp:
                return new Cell(0.70710678118654752440084436210485, -0.70710678118654752440084436210485);
            case UnitDirection.Right:
                return new Cell(1, 0);
            case UnitDirection.RightDown:
                return new Cell(0.70710678118654752440084436210485, 0.70710678118654752440084436210485);
            default:
                return new Cell(0, 0);
        }
    }

// static

    protected static _ScenaWidth  : number = -1;
    protected static _ScenaHeight : number;

    public static CreateUnit(settlement: any, cell: Cell, ...args: any[]) : IUnit | null {
        // на ходу генерируем конфиг
        var hordeConfig = this.GetHordeConfig();

        let spawnParams = new SpawnUnitParameters();
        spawnParams.ProductUnitConfig = hordeConfig;
        spawnParams.Direction         = UnitDirection.RightDown;
    
        if (unitCanBePlacedByRealMap(hordeConfig, cell.X, cell.Y)) {
            spawnParams.Cell = createPoint(cell.X, cell.Y);
            var hordeUnit = settlement.Units.SpawnUnit(spawnParams);
            return new this([ hordeUnit, ...args ]);
        } else {
            return null;
        }
    }
}
