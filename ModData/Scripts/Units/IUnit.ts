import { createPoint } from "library/common/primitives";
import { UnitCommand, PointCommandArgs, UnitDirection, UnitConfig, Unit, OneClickCommandArgs, ProduceCommandArgs } from "library/game-logic/horde-types";
import { Cell } from "../Core/Cell";
import { IConfig } from "./IConfig";
import { unitCanBePlacedByRealMap } from "library/game-logic/unit-and-map";

const SpawnUnitParameters = HordeClassLibrary.World.Objects.Units.SpawnUnitParameters;

/**
 * @function CreateUnit
 * @description Создает экземпляр юнита по заданной конфигурации.
 * @param {IConfig} config - Конфигурация юнита.
 * @param {any} settlement - Поселение, которому будет принадлежать юнит.
 * @param {Cell} cell - Клетка, в которой будет создан юнит.
 * @param {any[]} args - Дополнительные аргументы для конструктора.
 * @returns {IUnit | null} - Созданный юнит или null, если создание невозможно.
 */
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
} // </CreateUnit>

/**
 * @class IUnit
 * @description Базовый класс-обертка для всех юнитов в моде, расширяющий IConfig.
 */
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
    private _cfg                  : UnitConfig;

    /**
     * @constructor
     * @param {any[]} args - Аргументы, первым из которых должен быть юнит из движка.
     */
    constructor(...args: any[]) {
        super(args[0].Cfg);

        this._SetHordeUnit(args[0]);
        this.processingTickModule           = 50;
        // @ts-expect-error
        this.processingTick                 = this.hordeUnit.PseudoTickCounter % this.processingTickModule;
    } // </constructor>

    private _SetHordeUnit(unit : Unit) {
        this.hordeUnit                      = unit;
        this.hordeUnit.ScriptData.IUnit     = this;
        this._disallowedCommands            = ScriptUtils.GetValue(this.hordeUnit.CommandsMind, "DisallowedCommands");
        this._cfg                           = this.hordeUnit.Cfg;
    }

    /**
     * @method NeedProcessing
     * @description Определяет, нужно ли обрабатывать логику юнита в текущем тике.
     * @param {number} gameTickNum - Текущий тик игры.
     * @returns {boolean} - true, если юнит нужно обработать.
     */
    public NeedProcessing(gameTickNum: number) : boolean {
        return gameTickNum % this.processingTickModule == this.processingTick;
    } // </NeedProcessing>

    /**
     * @method DisallowCommands
     * @description Запрещает юниту выполнять основные команды (движение, атака и т.д.).
     */
    public DisallowCommands() {
        if (!this._disallowedCommands.ContainsKey(UnitCommand.MoveToPoint)) {
            this._disallowedCommands.Add(UnitCommand.MoveToPoint, 1);
            this._disallowedCommands.Add(UnitCommand.HoldPosition, 1);
            this._disallowedCommands.Add(UnitCommand.Attack, 1);
            this._disallowedCommands.Add(UnitCommand.Capture, 1);
            this._disallowedCommands.Add(UnitCommand.StepAway, 1);
            this._disallowedCommands.Add(UnitCommand.Cancel, 1);
        }
    } // </DisallowCommands>
    
    /**
     * @method AllowCommands
     * @description Разрешает юниту выполнять основные команды.
     */
    public AllowCommands() {
        if (this._disallowedCommands.ContainsKey(UnitCommand.MoveToPoint)) {
            this._disallowedCommands.Remove(UnitCommand.MoveToPoint);
            this._disallowedCommands.Remove(UnitCommand.HoldPosition);
            this._disallowedCommands.Remove(UnitCommand.Attack);
            this._disallowedCommands.Remove(UnitCommand.Capture);
            this._disallowedCommands.Remove(UnitCommand.StepAway);
            this._disallowedCommands.Remove(UnitCommand.Cancel);
        }
    } // </AllowCommands>

    /**
     * @method GivePointCommand
     * @description Отдает юниту приказ, связанный с точкой на карте.
     * @param {Cell} cell - Целевая клетка.
     * @param {any} command - Тип команды.
     * @param {any} orderMode - Режим приказа.
     */
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
    } // </GivePointCommand>

    /**
     * @method GiveOneClickCommand
     * @description Отдает юниту приказ, не требующий указания цели (например, использование способности на себя).
     * @param {UnitCommand} command - Тип команды.
     * @param {any} orderMode - Режим приказа.
     */
    public GiveOneClickCommand(command: UnitCommand, orderMode: any) {
        var oneClickCommandArgs = new OneClickCommandArgs(command, orderMode);
        this._cfg.GetOrderDelegate(this.hordeUnit, oneClickCommandArgs);
    } // </GiveOneClickCommand>

    /**
     * @method GiveProduceCommand
     * @description Отдает юниту приказ на производство другого юнита.
     * @param {any} orderMode - Режим приказа.
     * @param {UnitConfig} productConfig - Конфигурация производимого юнита.
     * @param {number} [count=1] - Количество юнитов для производства.
     */
    public GiveProduceCommand(orderMode: any, productConfig: UnitConfig, count: number = 1) {
        var produceCommandArgs = new ProduceCommandArgs(orderMode, productConfig, count);
        this._cfg.GetOrderDelegate(this.hordeUnit, produceCommandArgs);
    } // </GiveProduceCommand>

    /**
     * @method OnEveryTick
     * @description Вызывается на каждом тике. Возвращает, нужно ли обрабатывать логику юнита.
     * @param {number} gameTickNum - Текущий тик игры.
     * @returns {boolean} - true, если юнит нужно обработать.
     */
    public OnEveryTick(gameTickNum:number) : boolean {
        return this.NeedProcessing(gameTickNum);
    } // </OnEveryTick>

    /**
     * @method ReplaceHordeUnit
     * @description Заменяет юнит движка, которым управляет этот класс.
     * @param {Unit} unit - Новый юнит.
     */
    public ReplaceHordeUnit(unit: Unit) {
        this._SetHordeUnit(unit);
    } // </ReplaceHordeUnit>

    /**
     * @method DirectionVector
     * @description Возвращает единичный вектор направления юнита.
     * @returns {Cell} - Вектор направления.
     */
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
    } // </DirectionVector>

// static

    protected static _ScenaWidth  : number = -1;
    protected static _ScenaHeight : number;

    /**
     * @method CreateUnit
     * @description Создает экземпляр юнита данного класса.
     * @static
     * @param {any} settlement - Поселение, которому будет принадлежать юнит.
     * @param {Cell} cell - Клетка, в которой будет создан юнит.
     * @param {any[]} args - Дополнительные аргументы для конструктора.
     * @returns {IUnit | null} - Созданный юнит или null, если создание невозможно.
     */
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
    } // </CreateUnit>
}
