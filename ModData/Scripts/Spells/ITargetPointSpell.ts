import { ACommandArgs, UnitCommand } from "library/game-logic/horde-types";
import { Cell } from "../Core/Cell";
import { ISpell } from "./ISpell";

export class ITargetPointSpell extends ISpell {
    protected static _ButtonCommandType             : UnitCommand = UnitCommand.Capture;
    protected static _ButtonCommandBaseUid          : string = "#UnitCommandConfig_Capture";
    protected static _ButtonHotkey                  : string = "W";
    protected _targetCell                           : Cell;

    public Activate(activateArgs: ACommandArgs) : boolean {
        if (super.Activate(activateArgs)) {
            this._targetCell = Cell.ConvertHordePoint(activateArgs.TargetCell);

            return true;
        } else {
            return false;
        }
    }
}
