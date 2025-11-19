import { ACommandArgs, UnitCommand } from "library/game-logic/horde-types";
import { ISpell } from "./ISpell";
import {Cell} from "../Core/Cell";

export class ITargetPointSpell extends ISpell {
    protected static _ButtonCommandTypeBySlot       : Array<UnitCommand> = [UnitCommand.PointBased_Custom_0, UnitCommand.PointBased_Custom_1, UnitCommand.PointBased_Custom_2, UnitCommand.PointBased_Custom_3, UnitCommand.PointBased_Custom_4];
    protected static _ButtonCommandBaseUid          : string = "#UnitCommandConfig_Capture";
    //@ts-ignore
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
