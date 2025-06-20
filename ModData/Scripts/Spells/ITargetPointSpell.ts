import { ACommandArgs, UnitCommand } from "library/game-logic/horde-types";
import { Cell } from "../Core/Cell";
import { ISpell } from "./ISpell";

export class ITargetPointSpell extends ISpell {
    /// \todo вернуть после исправления
    protected static _ButtonCommandTypeBySlot       : Array<UnitCommand> = [UnitCommand.PointBased_Custom_0, UnitCommand.PointBased_Custom_1, UnitCommand.PointBased_Custom_2, UnitCommand.PointBased_Custom_3];
    //protected static _ButtonCommandTypeBySlot       : Array<UnitCommand> = [UnitCommand.Capture, UnitCommand.Capture, UnitCommand.Capture, UnitCommand.Capture];
    protected static _ButtonCommandBaseUid          : string = "#UnitCommandConfig_Capture";
    // @ts-expect-error
    protected _targetCell                           : Cell;

    public Activate(activateArgs: ACommandArgs) : boolean {
        if (super.Activate(activateArgs)) {
            // @ts-expect-error
            this._targetCell = Cell.ConvertHordePoint(activateArgs.TargetCell);

            return true;
        } else {
            return false;
        }
    }
}
