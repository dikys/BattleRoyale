import { Unit, UnitCommand } from "library/game-logic/horde-types";
import { Cell } from "../Core/Cell";
import { GameField } from "../Core/GameField";
import { GameSettlement } from "../Core/GameSettlement";
import { IUnit } from "./IUnit";
import { AssignOrderMode } from "library/mastermind/virtual-input";
import { iterateOverUnitsInBox } from "library/game-logic/unit-and-map";
import { PlayerSettlement } from "../Core/PlayerSettlement";

export class Priest extends IUnit {
    protected static CfgUid      : string = this.CfgPrefix + "Priest";
    protected static BaseCfgUid  : string = "#UnitConfig_Mage_Villur";

    private _gameField: GameField;
    private _enemySettlement: GameSettlement;
    private _playerSettlements: Array<PlayerSettlement>;

    private _targetCell: Cell | null;
    /// 0 - мирный, хилит всех
    /// 1 - вражеский, никого не хилит
    /// 2 - юнит игрока, хилит его юнитов
    private _state: number;

    private _healPeriod: number;

    constructor(hordeUnit: Unit, gameField: GameField, enemySettlement: GameSettlement, playerSettlements: Array<PlayerSettlement>) {
        super(hordeUnit);
        this._gameField         = gameField;
        this._enemySettlement   = enemySettlement;
        this._playerSettlements = playerSettlements;

        this._targetCell      = null;
        this._state           = 0;
        this._healPeriod      = 5;
    }

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Name", "Ворожей");
    }

    public OnEveryTick(gameTickNum: number): boolean {
        if (!super.OnEveryTick(gameTickNum)) {
            return false;
        }

        if (this.hordeUnit.IsDead) {
            return true;
        }

        // логика смены поселения

        if (this._state == 0) {
            if (this.hordeUnit.Health / this.hordeConfig.MaxHealth < 0.9) {
                this._state = 1;
                this.hordeUnit.ChangeOwner(this._enemySettlement.hordeSettlement);
            }
        } else if (this._state == 1) {
            if (this.hordeUnit.Health / this.hordeConfig.MaxHealth < 0.2) {
                let unitsIter = iterateOverUnitsInBox(this.hordeUnit.Cell, 15);
                for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
                    if (u.value.Id == this.hordeUnit.Id || u.value.Cfg.IsBuilding) {
                        continue;
                    }

                    var playerSettlementNum = this._playerSettlements.findIndex((playerSettlement) => {
                        return (playerSettlement.settlementUid == Number.parseInt(u.value.Owner.Uid));
                    });
                    if (playerSettlementNum >= 0) {
                        this.hordeUnit.ChangeOwner(u.value.Owner);
                        this._playerSettlements[playerSettlementNum].heroUnit.AddUnitToFormation(this);
                        this._state = 2;
                        break;
                    }
                }
            }
        }

        // логика отхила

        if (this._state == 0) {
            if (this._healPeriod == 0) {
                this._healPeriod = 5;
                let unitsIter = iterateOverUnitsInBox(this.hordeUnit.Cell, 6);
                for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
                    if (u.value.Id == this.hordeUnit.Id || u.value.Cfg.IsBuilding) {
                        continue;
                    }

                    u.value.Health = Math.min(u.value.Health + 4, u.value.Cfg.MaxHealth);
                }
            } else {
                this._healPeriod--;
            }
        } else if (this._state == 2) {
            if (this._healPeriod == 0) {
                this._healPeriod = 5;
                let unitsIter = iterateOverUnitsInBox(this.hordeUnit.Cell, 6);
                for (let u = unitsIter.next(); !u.done; u = unitsIter.next()) {
                    if (u.value.Id == this.hordeUnit.Id
                        || u.value.Cfg.IsBuilding
                        || u.value.Owner.Uid != this.hordeUnit.Owner.Uid) {
                        continue;
                    }

                    u.value.Health = Math.min(u.value.Health + 1, u.value.Cfg.MaxHealth);
                }
            } else {
                this._healPeriod--;
            }
        }

        // логика хождения

        if (this._state != 2) {
            if (this._targetCell) {
                if (this.hordeUnit.OrdersMind.IsIdle()) {
                    this.GivePointCommand(this._targetCell, this._state ? UnitCommand.Attack : UnitCommand.MoveToPoint, AssignOrderMode.Replace);
                } else {
                    var unitCell = new Cell(this.hordeUnit.Cell.X, this.hordeUnit.Cell.Y);
                    if (unitCell.Minus(this._targetCell).Length_Chebyshev() < 3) {
                        this._targetCell = null;
                    }
                }
            } else {
                // создаем позицию
                var generator    = this._gameField.GeneratorRandomCell();
                this._targetCell = generator.next().value;
            }
        }

        return true;
    }
}
