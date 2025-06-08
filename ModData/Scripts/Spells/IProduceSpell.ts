import { ACommandArgs, UnitCommand, UnitConfig } from "library/game-logic/horde-types";
import { Cell } from "../Core/Cell";
import { ISpell } from "./ISpell";
import { printObjectItems } from "library/common/introspection";
import { CfgAddUnitProducer } from "../Units/IConfig";
import { IUnitCaster } from "./IUnitCaster";

export class IProduceSpell extends ISpell {
    protected static _ButtonCommandType             : UnitCommand = UnitCommand.Produce;
    protected static _ButtonCommandBaseUid          : string = "#UnitCommandConfig_Produce";
    protected static _ButtonHotkey                  : string = "E";

    protected _productCfg : UnitConfig;

    constructor(caster: IUnitCaster) {
        var casterCfg = caster.hordeConfig;
        CfgAddUnitProducer(casterCfg);
        if (casterCfg.AllowedCommands.ContainsKey(UnitCommand.Repair)) {
            casterCfg.AllowedCommands.Remove(UnitCommand.Repair);
        }
        if (casterCfg.AllowedCommands.ContainsKey(UnitCommand.Produce)) {
            casterCfg.AllowedCommands.Remove(UnitCommand.Produce);
        }
        caster.hordeUnit.CommandsMind.RemoveAddedCommand(UnitCommand.Repair);
        caster.hordeUnit.CommandsMind.RemoveAddedCommand(UnitCommand.Produce);

        super(caster);
    }

    public Activate(activateArgs: ACommandArgs) : boolean {
        if (super.Activate(activateArgs)) {
            this._productCfg = activateArgs.ProductCfg;

            return true;
        } else {
            return false;
        }
    }
}