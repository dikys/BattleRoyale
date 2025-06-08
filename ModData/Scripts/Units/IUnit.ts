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

    public hordeUnit: HordeClassLibrary.World.Objects.Units.Unit;
    /** тик на котором нужно обрабатывать юнита */
    private processingTick: number;
    /** модуль на который делится игровой тик, если остаток деления равен processingTick, то юнит обрабатывается */
    private processingTickModule: number;

    constructor(...args: any[]) {
        super(args[0].Cfg);

        this.hordeUnit            = args[0];
        this._disallowedCommands  = ScriptUtils.GetValue(this.hordeUnit.CommandsMind, "DisallowedCommands");
        this._cfg                 = this.hordeUnit.Cfg;
        this.processingTickModule = 50;
        this.processingTick       = this.hordeUnit.PseudoTickCounter % this.processingTickModule;
    }

    private _disallowedCommands : any;
    private _cfg                : UnitConfig;

    public DisallowCommands() {
        this._disallowedCommands.Add(UnitCommand.MoveToPoint, 1);
        this._disallowedCommands.Add(UnitCommand.HoldPosition, 1);
        this._disallowedCommands.Add(UnitCommand.Attack, 1);
        this._disallowedCommands.Add(UnitCommand.Capture, 1);
        this._disallowedCommands.Add(UnitCommand.StepAway, 1);
        this._disallowedCommands.Add(UnitCommand.Cancel, 1);
    }
    
    public AllowCommands() {
        if (this._disallowedCommands.ContainsKey(UnitCommand.MoveToPoint))  this._disallowedCommands.Remove(UnitCommand.MoveToPoint);
        if (this._disallowedCommands.ContainsKey(UnitCommand.HoldPosition)) this._disallowedCommands.Remove(UnitCommand.HoldPosition);
        if (this._disallowedCommands.ContainsKey(UnitCommand.Attack))       this._disallowedCommands.Remove(UnitCommand.Attack);
        if (this._disallowedCommands.ContainsKey(UnitCommand.Capture))      this._disallowedCommands.Remove(UnitCommand.Capture);
        if (this._disallowedCommands.ContainsKey(UnitCommand.StepAway))     this._disallowedCommands.Remove(UnitCommand.StepAway);
        if (this._disallowedCommands.ContainsKey(UnitCommand.Cancel))       this._disallowedCommands.Remove(UnitCommand.Cancel);
    }

    public GivePointCommand(cell: Cell, command: any, orderMode: any) {
        var pointCommandArgs = new PointCommandArgs(createPoint(cell.X, cell.Y), command, orderMode);
        this._cfg.GetOrderDelegate(this.hordeUnit, pointCommandArgs);
    }

    public OnEveryTick(gameTickNum:number) : boolean {
        return gameTickNum % this.processingTickModule == this.processingTick;
    }

    public ReplaceHordeUnit(unit: Unit) {
        this.hordeUnit = unit;
    }

// static

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
