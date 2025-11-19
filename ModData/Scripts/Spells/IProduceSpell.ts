import { ACommandArgs, Unit, UnitCommand, UnitConfig, UnitState } from "library/game-logic/horde-types";
import { ISpell } from "./ISpell";
import { IUnitCaster } from "./IUnitCaster";
import { setUnitStateWorker } from "library/game-logic/workers";
import {CfgAddUnitProducer} from "../Units/IConfig";

var pluginWrappedWorker     : any = null;
var cfgUidWithWrappedWorker : Map<string, boolean> = new Map<string, boolean>();

export class IProduceSpell extends ISpell {
    /// \todo вернуть после исправления
    //protected static _ButtonCommandTypeBySlot       : Array<UnitCommand> = [UnitCommand.Produce_Custom_0, UnitCommand.Produce_Custom_1, UnitCommand.Produce_Custom_2, UnitCommand.Produce_Custom_3, UnitCommand.Produce_Custom_4];
    protected static _ButtonCommandTypeBySlot       : Array<UnitCommand> = [UnitCommand.Produce, UnitCommand.Produce, UnitCommand.Produce, UnitCommand.Produce];
    protected static _ButtonCommandBaseUid          : string = "#UnitCommandConfig_Produce";
    // @ts-ignore
    protected _productCfg : UnitConfig;

    constructor(caster: IUnitCaster, ...spellArgs: any[]) {
        var casterCfg = caster.hordeUnit.Cfg;
        CfgAddUnitProducer(casterCfg);
        if (casterCfg.AllowedCommands.ContainsKey(UnitCommand.Repair)) {
            casterCfg.AllowedCommands.Remove(UnitCommand.Repair);
        }
        if (casterCfg.AllowedCommands.ContainsKey(UnitCommand.Produce)) {
            casterCfg.AllowedCommands.Remove(UnitCommand.Produce);
        }
        caster.hordeUnit.CommandsMind.RemoveAddedCommand(UnitCommand.Repair);
        caster.hordeUnit.CommandsMind.RemoveAddedCommand(UnitCommand.Produce);

        super(caster, spellArgs);

        // костыль
        if (!pluginWrappedWorker) {
            pluginWrappedWorker = (u: Unit) => IUnitCaster._StateWorkerCustom(u);
        }
        if (!cfgUidWithWrappedWorker.has(caster.hordeUnit.Cfg.Uid)) {
            setUnitStateWorker("CustomOrder", caster.hordeUnit.Cfg, UnitState.Produce, pluginWrappedWorker);
        }
    }

    public Activate(activateArgs: ACommandArgs) : boolean {
        if (super.Activate(activateArgs)) {
            // @ts-expect-error
            this._productCfg = activateArgs.ProductCfg;

            return true;
        } else {
            return false;
        }
    }

    public OnReplacedCaster(caster: IUnitCaster): void {
        // костыль
        if (!pluginWrappedWorker) {
            pluginWrappedWorker = (u: Unit) => IUnitCaster._StateWorkerCustom(u);
        }
        if (!cfgUidWithWrappedWorker.has(caster.hordeUnit.Cfg.Uid)) {
            setUnitStateWorker("CustomOrder", caster.hordeUnit.Cfg, UnitState.Produce, pluginWrappedWorker);
        }
    }
}