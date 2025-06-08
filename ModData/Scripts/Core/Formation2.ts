import { createPoint } from "library/common/primitives";
import { AOrderBase, DiplomacyStatus, OrderAttackUnit, UnitCommand } from "library/game-logic/horde-types";
import { AssignOrderMode } from "library/mastermind/virtual-input";
import { IUnit } from "../Units/IUnit";
import { Cell } from "./Cell";
import { log } from "library/common/logging";
import { printObjectItems } from "library/common/introspection";
import { IHero } from "../Heroes/IHero";

class Agent {
    unit: IUnit;
    // номер ячейки
    cellNum: number;
    // целевая ячейка для движения
    targetCell: Cell;
    // цель атаки капитана
    attackTarget: IUnit | null;

    constructor(unit: IUnit, cellNum?: number, targetCell?: Cell) {
        this.unit       = unit;
        this.cellNum    = cellNum ?? 0;
        this.targetCell = targetCell ?? new Cell(0, 0);
    }

    /** отдать приказ в точку */
    public GivePointCommand(cell: Cell, command: any, orderMode: any) {
        this.unit.AllowCommands();
        this.unit.GivePointCommand(cell, command, orderMode);
        this.unit.DisallowCommands();
    }

    /** атаковать точку */
    public SmartAttackCommand(cell: Cell) {
        var upperHordeUnit = ActiveScena.UnitsMap.GetUpperUnit(cell.ToHordePoint());
        if (upperHordeUnit && upperHordeUnit.Owner.Uid != this.unit.hordeUnit.Owner.Uid) {
            this.GivePointCommand(cell, UnitCommand.MoveToPoint, AssignOrderMode.Replace);
        } else {
            this.GivePointCommand(cell, UnitCommand.Attack, AssignOrderMode.Replace);
        }
    }

    /** вернуться в целевую точку */
    public SmartMoveToTargetCommand() {
        this.GivePointCommand(this.targetCell, UnitCommand.MoveToPoint, AssignOrderMode.Replace);
    }

    public OnEveryTick(gameTickNum: number) {
        // если агент здание и не достроился, то ничего не делаем
        if (this.unit.hordeUnit.EffectsMind.BuildingInProgress) {
            return;
        }

        var agentCell = Cell.ConvertHordePoint(this.unit.hordeUnit.Cell);
        var distanceToTargetCell = agentCell.Minus(this.targetCell).Length_Chebyshev();

        // атакуем врага

        if (this.attackTarget) {
            // если это союзник, то не бьем
            if (this.attackTarget.hordeUnit.Owner.Uid == this.unit.hordeUnit.Owner.Uid) {
                this.attackTarget = null;
            } else {
                if (this.unit.hordeUnit.BattleMind.CanAttackTarget(this.attackTarget.hordeUnit)) {
                    var attackTargetCell = Cell.ConvertHordePoint(this.attackTarget.hordeUnit.Cell);
                    var distanceToAttackTargetCell = agentCell.Minus(attackTargetCell).Length_Chebyshev();

                    if (distanceToAttackTargetCell < 2*14 && distanceToTargetCell < 2*12) {
                        this.GivePointCommand(attackTargetCell, UnitCommand.Attack, AssignOrderMode.Replace);
                        return;
                    }
                }
            }
        }

        // идем в точку

        if (distanceToTargetCell == 0) {
            return;
        }

        // если юнит ушел далеко, пытаемся вернуть его назад
        if (distanceToTargetCell > 2*8) {
            this.GivePointCommand(this.targetCell, UnitCommand.MoveToPoint, AssignOrderMode.Replace);
        }
        // если юнит не на целевой клетке и ничего не делает, то отправляем его в целевую точку
        else if (this.unit.hordeUnit.OrdersMind.IsIdle()) {
            var upperHordeUnit = ActiveScena.UnitsMap.GetUpperUnit(createPoint(this.targetCell.X, this.targetCell.Y));
            if (upperHordeUnit) {
                if (upperHordeUnit.Owner.Diplomacy.GetDiplomacyStatus(this.unit.hordeUnit.Owner) == DiplomacyStatus.War) {
                    this.GivePointCommand(this.targetCell, UnitCommand.Attack, AssignOrderMode.Replace);
                } else {
                    this.GivePointCommand(this.targetCell, UnitCommand.MoveToPoint, AssignOrderMode.Replace);
                }
            } else {
                this.GivePointCommand(this.targetCell, UnitCommand.Attack, AssignOrderMode.Replace);
            }
        }
    }
};

class Orbit {
    private static _CreatedOrbitsCount = 0;
    private static _UpdatePeriodSize = 0;

    // предыдущее положение центра
    private prevCenterFormation: Cell;
    // текущее положение центра
    private centerFormation: Cell;
    // атакованный юнит
    private attackTarget: IUnit | null;

    // отсортированный список юнитов
    agents: Array<Agent>;
    radius: number;
    cellsCount: number;
    maxAgents: number;
    // относительные координаты
    cells: Array<Cell>;
    // такт для обновления
    updateTact: number;

    constructor(center : Cell, radius : number, orbitDestiny : number) {
        this.agents    = new Array<Agent>();
        this.radius   = radius;

        var sideLength = 2 * this.radius;

        this.cellsCount   = 4 * sideLength;
        this.maxAgents = Math.floor(this.cellsCount * orbitDestiny);
        
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

        this.prevCenterFormation = center;
        this.centerFormation     = center;
        this.attackTarget        = null;
    }

    public SetAttackTarget(unit: IUnit | null) {
        this.attackTarget = unit;
        // обновляем атакованного юнита
        this.agents.forEach((agent) => {
            agent.attackTarget = this.attackTarget;
        });
    }

    public SetCenter(center: Cell) {
        this.centerFormation = center;
        
        // обновляем целевую клетку у агентов
        if (!Cell.IsEquals(this.centerFormation, this.prevCenterFormation)) {
            this.agents.forEach((agent) => {
                agent.targetCell = this.centerFormation.Add(this.cells[agent.cellNum]);
            });
            this.prevCenterFormation = this.centerFormation;
        }
    }

    public SmartAttackCommand(cell: Cell) {
        this.SetAttackTarget(null);
        this.agents.forEach(agent => {
            agent.SmartAttackCommand(cell.Add(this.cells[agent.cellNum]));
        });
    }

    public SmartMoveToTargetCommand() {
        this.SetAttackTarget(null);
        this.agents.forEach(agent => {
            agent.SmartMoveToTargetCommand();
        });
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
                this.agents[unitNum].targetCell = this.centerFormation.Add(this.cells[this.agents[unitNum].cellNum]);;
            }
        }
    }

    AddAgent(inAgent: Agent) {
        var inUnitRelativePos = new Cell(inAgent.unit.hordeUnit.Cell.X, inAgent.unit.hordeUnit.Cell.Y).Minus(this.centerFormation);

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
            inAgent.targetCell = this.centerFormation.Add(this.cells[inAgent.cellNum]);
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
    }
    
    public OnEveryTick(gameTickNum: number) : boolean {
        // проверяем, что на текущем такте нужно обновить орбиту
        if (gameTickNum % Orbit._UpdatePeriodSize != this.updateTact) {
            return false;
        }
        
        // обновляем информацию об атакованном юните
        if (this.attackTarget
            && (this.attackTarget.hordeUnit.IsDead
                || (this.agents.length > 0
                    && this.agents[0].unit.hordeUnit.Owner.Uid == this.attackTarget.hordeUnit.Owner.Uid))) {
            this.attackTarget = null;
            this.agents.forEach((agent) => {
                agent.attackTarget = null;
            });
        }

        this.agents.forEach((agent) => agent.OnEveryTick(gameTickNum));

        return true;
    }
};

export class Formation2 {
    // центр формации
    private _center: Cell;
    // орбиты
    private _orbits: Array<Orbit>;
    // номер такта, когда была заказана реформация
    private _reformationOrderTact: number;
    // текущий номер такта
    private _gameTickNum: number;
    // плотность орбит
    private _orbitsDestiny: number;

    constructor(center: Cell, startRadius: number, orbitsDestiny: number) {
        this._center = center;
        this._orbitsDestiny = orbitsDestiny;

        this._orbits = new Array<Orbit>();
        this._orbits.push(new Orbit(this._center, startRadius, this._orbitsDestiny));

        this._reformationOrderTact = -1;
        this._gameTickNum = 0;
    }

    public AddUnits(units: Array<IUnit>) {
        // заказываем реформацию
        this._reformationOrderTact = this._gameTickNum;

        var agents = new Array<Agent>();
        units.forEach((unit) => {
            agents.push(new Agent(unit));
        });
        this._AddAgents(agents);
    }

    public RemoveUnits(units: Array<IUnit>) {
        units.forEach(unit => {
            var removed = false;
            this._orbits.forEach(orbit => {
                if (removed) {
                    return;
                }

                var agentNum : number;
                for (agentNum = 0; agentNum < orbit.agents.length; agentNum++) {
                    if (orbit.agents[agentNum].unit.hordeUnit.Id == unit.hordeUnit.Id) {
                        removed = true;
                        unit.AllowCommands();
                        orbit.RemoveAgent(agentNum);
                        break;
                    }
                }
            });
        });
    }
    
    public UnitsCount() {
        var count = 0;
        this._orbits.forEach(orbit => count += orbit.agents.length);
        return count;
    }

    public OnEveryTick(gameTickNum: number) {
        this._gameTickNum = gameTickNum;

        this._orbits.forEach((orbit) => {
            if (orbit.OnEveryTick(gameTickNum)) {
                // удаляем мертвых юнитов
                var deadAgentsNum = new Array<number>()
                orbit.agents.forEach((agent, agentNum) => {
                    if (agent.unit.hordeUnit.IsDead) {
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

    public SetAttackTarget(unit: IUnit | null) {
        this._orbits.forEach((orbit) => {
            orbit.SetAttackTarget(unit);
        });
    }

    
    public SmartAttackCell(cell: Cell) {
        this._orbits.forEach(orbit => {
            orbit.SmartAttackCommand(cell);
        });
    }

    public SmartMoveToTargetCommand() {
        this._orbits.forEach(orbit => {
            orbit.SmartMoveToTargetCommand();
        });
    }

    public SetCenter(center: Cell) {
        this._center = center;
        this._orbits.forEach((orbit) => {
            orbit.SetCenter(center);
        });
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
        agents.forEach((agent, agentNum) => {
            while (this._orbits[orbitNum].maxAgents <= this._orbits[orbitNum].agents.length) {
                orbitNum++;
                if (this._orbits.length == orbitNum) {
                    this._orbits.push(new Orbit(this._center, this._orbits[orbitNum - 1].radius + 1, this._orbitsDestiny));
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
