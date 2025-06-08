import { createPoint } from "library/common/primitives";
import { PointCommandArgs, TileType, UnitCommand, UnitFlags } from "library/game-logic/horde-types";
import { UnitProfession } from "library/game-logic/unit-professions";
import { AssignOrderMode } from "library/mastermind/virtual-input";
import { Cell } from "./Cell";

class Agent {
    unit: any;
    // номер ячейки
    cellNum: number;
    // целевая ячейка для движения
    targetCell: Cell;
    // приоритет
    priority: number;

    constructor(unit: any, cellNum?: number, targetCell?: Cell) {
        this.unit       = unit;
        this.cellNum    = cellNum ?? 0;
        this.targetCell = targetCell ?? new Cell(0, 0);
        this.priority   = Agent._CalcPriority(unit.Cfg);
    }

    /** отдать приказ в точку */
    public GivePointCommand(cell: Cell, command: any, orderMode: any) {
        var pointCommandArgs = new PointCommandArgs(createPoint(cell.X, cell.Y), command, orderMode);
        UnitAllowCommands(this.unit);
        this.unit.Cfg.GetOrderDelegate(this.unit, pointCommandArgs);
        UnitDisallowCommands(this.unit);
    }

    private static _OpCfgToPriority: Map<string, number> = new Map<string, number>();
    private static _CalcPriority(unitConfig: any) {
        var priority : number = 0;
        if (this._OpCfgToPriority.has(unitConfig.Uid)) {
            priority = this._OpCfgToPriority.get(unitConfig.Uid) as number;
        } else {
            let mainArmament = unitConfig.MainArmament;
            var isCombat = mainArmament != null &&
                unitConfig.GetProfessionParams(UnitProfession.Harvester, true) == null &&
                !unitConfig.Flags.HasFlag(UnitFlags.Building);
            if (isCombat) {
                priority = 100 * mainArmament.Range
                    - 10 * unitConfig.Speeds.Item(TileType.Grass)
                    - unitConfig.MaxHealth * unitConfig.Shield / mainArmament.ShotParams.Damage;
            } else {
                priority = 100000;
            }
        }
        return priority;
    }
};

enum SwarmOrbitStage {
    IDLE,
    OFFSET,
    CHANGED_CENTER
};

class Orbit {
    private static _CreatedOrbitsCount = 0;
    private static _UpdatePeriodSize = 0;

    // юнит - центр колонии
    unitCenter: any;
    // предыдущее положение центра
    unitCenterPrevCell: Cell;
    // текущее положение центра
    unitCenterCell: Cell;

    // отсортированный список юнитов
    agents: Array<Agent>;
    radius: number;
    cellsCount: number;
    maxAgents: number;
    // относительные координаты
    cells: Array<Cell>;
    // такт для обновления
    updateTact: number;

    state: SwarmOrbitStage;

    private _unitsMap : any;

    constructor(unitCenter : any, radius : number) {
        this.unitCenter = unitCenter;
        this.agents    = new Array<Agent>();
        this.radius   = radius;

        var sideLength = 2 * this.radius;

        this.cellsCount   = 4 * sideLength;
        this.maxAgents = this.cellsCount / 3;
        
        this.cells  = new Array<Cell>();
        for (var i = 0; i < sideLength; i++) {
            this.cells.push(new Cell(-this.radius + i, -this.radius));
        }
        for (var i = 0; i < sideLength; i++) {
            this.cells.push(new Cell(-this.radius + sideLength, -this.radius + i));
        }
        for (var i = 0; i < sideLength; i++) {
            this.cells.push(new Cell(-this.radius + sideLength - i, -this.radius + sideLength));
        }
        for (var i = 0; i < sideLength; i++) {
            this.cells.push(new Cell(-this.radius, -this.radius + sideLength - i));
        }

        this.updateTact = Math.round(Orbit._CreatedOrbitsCount / 4);
        Orbit._CreatedOrbitsCount++;
        Orbit._UpdatePeriodSize = this.updateTact + 1;

        this.unitCenterPrevCell = new Cell(0, 0);
        this.unitCenterCell     = new Cell(0, 0);

        this.state = SwarmOrbitStage.IDLE;

        this._unitsMap = ActiveScena.GetRealScena().UnitsMap;
    }

    AddAgents(agents: Array<Agent>) {
        if (agents.length == 0) {
            return;
        }

        if (this.agents.length > 2) {
            agents.forEach((agent) => this.AddAgent(agent));
        } else {
            this.agents = this.agents.concat(agents);

            // перевычисляем ячейки для всех
            var orbitCellStep     = this.cellsCount / this.agents.length;
            var orbitAccCellStep  = 0;
            for (var unitNum = 0; unitNum < this.agents.length; unitNum++) {
                this.agents[unitNum].cellNum    = Math.round(orbitAccCellStep) % this.cellsCount;
                orbitAccCellStep               += orbitCellStep;
            }

            // теперь юнитам нужно вычислить новые целевые клетки
            this.state = SwarmOrbitStage.CHANGED_CENTER;
        }
    }

    AddAgent(inAgent: Agent) {
        var inUnitRelativePos = new Cell(inAgent.unit.Cell.X, inAgent.unit.Cell.Y).Minus(this.unitCenterCell);

        if (this.agents.length > 2) {
            // ищем ближайших двух юнитов
            var nearAgent_num     = -1;
            var nearAgent_l2      = Number.MAX_VALUE;
            var prevNearAgent_num = -1;
            var prevNearAgent_l2  = Number.MAX_VALUE;
            for (var agentNum = 0; agentNum < this.agents.length; agentNum++) {
                var agent    = this.agents[agentNum];
                var distance = inUnitRelativePos.Minus(this.cells[agent.cellNum]).Length_L2();

                if (distance < nearAgent_l2) {
                    prevNearAgent_l2  = nearAgent_l2;
                    prevNearAgent_num = nearAgent_num;

                    nearAgent_l2  = distance;
                    nearAgent_num = agentNum;
                } else if (distance < prevNearAgent_l2) {
                    prevNearAgent_l2  = distance;
                    prevNearAgent_num = agentNum;
                }
            };

            // вставляем нашего юнита между ними
            var inAgentNum     : number;
            var unitsCellMaxNum = Math.max(this.agents[nearAgent_num].cellNum, this.agents[prevNearAgent_num].cellNum);
            var unitsCellMinNum = Math.min(this.agents[nearAgent_num].cellNum, this.agents[prevNearAgent_num].cellNum);
                // если ячейки юнитов между конца
            if (unitsCellMaxNum - unitsCellMinNum > unitsCellMinNum + this.cellsCount - unitsCellMaxNum) {
                inAgent.cellNum = Math.round(unitsCellMinNum + 0.5 * (unitsCellMinNum + this.cellsCount - unitsCellMaxNum)) % this.cellsCount;
            } else {
                inAgent.cellNum = Math.round(0.5 * (this.agents[nearAgent_num].cellNum + this.agents[prevNearAgent_num].cellNum));
            }
                // если номера юнитов между конца
            if (Math.abs(prevNearAgent_num - nearAgent_num) == this.agents.length - 1) {
                inAgentNum = this.agents.length;
            } else {
                inAgentNum = Math.min(nearAgent_num, prevNearAgent_num) + 1;
            }
                // добавляем агента
            inAgent.targetCell = this.unitCenterCell.Add(this.cells[inAgent.cellNum]);
            this.agents.splice(inAgentNum, 0, inAgent);
            
            // перевычисляем ячейки всех юнитов относительно нового юнита
            var orbitCellStep     = this.cellsCount / this.agents.length;
            var orbitAccCellStep  = orbitCellStep;
            for (var unitNum = inAgentNum + 1; unitNum < this.agents.length; unitNum++) {
                this.agents[unitNum].cellNum    = Math.round(inAgent.cellNum + orbitAccCellStep) % this.cellsCount;
                orbitAccCellStep              += orbitCellStep;
            }
            for (var unitNum = 0; unitNum < inAgentNum; unitNum++) {
                this.agents[unitNum].cellNum    = Math.round(inAgent.cellNum + orbitAccCellStep) % this.cellsCount;
                orbitAccCellStep              += orbitCellStep;
            }
        } else {
            // вставляем юнита и перевычисляем ячейки для всех
            this.agents.push(inAgent);
            var orbitCellStep     = this.cellsCount / this.agents.length;
            var orbitAccCellStep  = 0;
            for (var unitNum = 0; unitNum < this.agents.length; unitNum++) {
                this.agents[unitNum].cellNum    = Math.round(orbitAccCellStep) % this.cellsCount;
                orbitAccCellStep               += orbitCellStep;
            }
        }

        // теперь юнитам нужно вычислить новые целевые клетки
        this.state = SwarmOrbitStage.CHANGED_CENTER;
    }

    RemoveAgent(agentNum: number) {
        this.RemoveAgents([agentNum]);
    }

    RemoveAgents(agentsNum : Array<number>) {
        // удаляем юнитов
        agentsNum.sort((a, b) => b - a);
        agentsNum.forEach((unitNum) => this.agents.splice(unitNum, 1));

        // если юниты остались, то перевычисляем ячейки
        if (this.agents.length > 0) {
            var deltaCellNum     = this.cellsCount / this.agents.length;
            var accDeltaCellNum  = 0;
            var startCellNum     = this.agents[0].cellNum;
            this.agents.forEach((agent) => {
                agent.cellNum    = Math.round(startCellNum + accDeltaCellNum) % this.cellsCount;
                accDeltaCellNum += deltaCellNum;
            });
        }

        // теперь юнитам нужно вычислить новые целевые клетки
        this.state = SwarmOrbitStage.CHANGED_CENTER;
    }
    
    public OnEveryTick(gameTickNum: number) : boolean {
        // проверяем, что на текущем такте нужно обновить орбиту
        if (gameTickNum % Orbit._UpdatePeriodSize != this.updateTact) {
            return false;
        }

        this.unitCenterPrevCell = this.unitCenterCell;
        this.unitCenterCell     = new Cell(this.unitCenter.Cell.X, this.unitCenter.Cell.Y);
        // если центр изменился, меняем состояние
        if (!Cell.IsEquals(this.unitCenterCell, this.unitCenterPrevCell)) {
            this.state = SwarmOrbitStage.CHANGED_CENTER;
        }

        // обрабатываем текущее состояние
        if (this.state == SwarmOrbitStage.IDLE) {
            this._StateIdle();
        } else if (this.state == SwarmOrbitStage.OFFSET) {
            this._StateOffset();
        } else if (this.state == SwarmOrbitStage.CHANGED_CENTER) {
            this._StateChangedCenter();
        }

        return true;
    }

    private _MoveToTargetCell() : boolean {
        var isTargetCellsReached = true;
        this.agents.forEach((agent) => {
            var unitCell = new Cell(agent.unit.Cell.X, agent.unit.Cell.Y);
            var distance = unitCell.Minus(agent.targetCell).Length_Chebyshev();
            if (distance == 0) {
                return;
            }
            isTargetCellsReached = false;

            // если юнит ушел далеко, пытаемся вернуть его назад
            if (distance > 8) {
                agent.GivePointCommand(agent.targetCell, UnitCommand.MoveToPoint, AssignOrderMode.Replace);
            }
            // если юнит не на целевой клетке и ничего не делает, то отправляем его в целевую точку
            else if (distance > 0 && agent.unit.OrdersMind.IsIdle()) {
                //agent.GivePointCommand(agent.targetCell, UnitCommand.MoveToPoint, AssignOrderMode.Replace);
                if (this._unitsMap.GetUpperUnit(createPoint(agent.targetCell.X, agent.targetCell.Y))) {
                    agent.GivePointCommand(agent.targetCell, UnitCommand.MoveToPoint, AssignOrderMode.Replace);
                } else {
                    agent.GivePointCommand(agent.targetCell, UnitCommand.Attack, AssignOrderMode.Replace);
                }
            }
            else {
            }
        });
        return isTargetCellsReached;
    }

    private _StateIdle() {
        this._MoveToTargetCell();
    }

    private _StateOffset() {
        var isTargetCellsReached = this._MoveToTargetCell();
        if (isTargetCellsReached) {
            this.state = SwarmOrbitStage.IDLE;

            // this.agents.forEach((agent) => {
            //     agent.targetCell = this.unitCenterCell.Add(this.cells[agent.cellNum]);
            // });
        }
    }

    private _StateChangedCenter() {
        //var unitCenter_moveVec = this.unitCenterCell.Minus(this.unitCenterPrevCell).Scale(2);
        this.agents.forEach((agent) => {
            agent.targetCell = this.unitCenterCell.Add(this.cells[agent.cellNum]);//.Add(unitCenter_moveVec);
        });
        this.state = SwarmOrbitStage.OFFSET;
    }
};

export class Formation1 {
    // юнит - центр колонии
    private _unitCenter: any;
    // орбиты
    private _orbits: Array<Orbit>;
    // номер такта, когда была заказана реформация
    private _reformationOrderTact: number;
    // текущий номер такта
    private _gameTickNum: number;

    constructor(unitCenter: any, startRadius: number) {
        this._unitCenter = unitCenter;

        this._orbits = new Array<Orbit>();
        this._orbits.push(new Orbit(this._unitCenter, startRadius));

        this._reformationOrderTact = -1;
        this._gameTickNum = 0;
    }

    public AddUnits(units: Array<any>) {
        // заказываем реформацию
        this._reformationOrderTact = this._gameTickNum;

        var agents = units.map((unit) => {
            return new Agent(unit);
        });
        agents.sort((a, b) => b.priority - a.priority);
        this._AddAgents(agents);
    }

    public OnEveryTick(gameTickNum: number) {
        this._gameTickNum = gameTickNum;

        this._orbits.forEach((orbit) => {
            if (orbit.OnEveryTick(gameTickNum)) {
                // удаляем мертвых юнитов
                var deadAgentsNum = new Array<number>()
                orbit.agents.forEach((agent, agentNum) => {
                    if (agent.unit.IsDead) {
                        deadAgentsNum.push(agentNum);
                    }
                });
                if (deadAgentsNum.length > 0) {
                    // заказываем реформацию
                    this._reformationOrderTact = this._gameTickNum;

                    orbit.RemoveAgents(deadAgentsNum);
                }
            }
        });

        // реформация
        if (this._reformationOrderTact >= 0 && this._reformationOrderTact + 250 < gameTickNum) {
            this._reformationOrderTact = -1;

            this._Reformation();
        }
    }

    private _Reformation() {
        var agents = new Array<Agent>();

        // извлекаем всех агентов с орбит
        this._orbits.forEach((orbit) => {
            var agentsNum = new Array<number>();
            orbit.agents.forEach((agent, agentNum) => {
                agentsNum.push(agentNum);
                agents.push(agent);
            });
            orbit.RemoveAgents(agentsNum);
        });

        // сортируем по приоритету
        agents.sort((a, b) => b.priority - a.priority);

        this._AddAgents(agents);
    }

    private _AddAgents(agents: Array<Agent>) {
        if (agents.length == 0) {
            return;
        }

        var orbitsAgents = new Array<Array<Agent>>();
        this._orbits.forEach((orbit) => {
            orbitsAgents.push(new Array<Agent>());
        });

        var orbitNum = 0;
        var currPriority = agents[0].priority;
        agents.forEach((agent, agentNum) => {
            while (this._orbits[orbitNum].maxAgents <= this._orbits[orbitNum].agents.length ||
                (agentNum > 0 && currPriority != agent.priority)
            ) {
                currPriority = agent.priority;
                orbitNum++;
                if (this._orbits.length == orbitNum) {
                    this._orbits.push(new Orbit(this._unitCenter, this._orbits[orbitNum - 1].radius + 1));
                    orbitsAgents.push(new Array<Agent>());
                }
            }

            orbitsAgents[orbitNum].push(agent);
        });

        orbitsAgents.forEach((agents, orbitNum) => {
            this._orbits[orbitNum].AddAgents(agents);
        });
    }
};
