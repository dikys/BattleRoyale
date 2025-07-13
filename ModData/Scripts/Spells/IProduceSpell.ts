import { ACommandArgs, UnitCommand, UnitConfig } from "library/game-logic/horde-types";
import { ISpell } from "./ISpell";
import { CfgAddUnitProducer } from "../Units/IConfig";
import { IUnitCaster } from "./IUnitCaster";

export class IProduceSpell extends ISpell {
    /// \todo вернуть после исправления
    //protected static _ButtonCommandTypeBySlot       : Array<UnitCommand> = [UnitCommand.Produce_Custom_0, UnitCommand.Produce_Custom_1, UnitCommand.Produce_Custom_2, UnitCommand.Produce_Custom_3];
    protected static _ButtonCommandTypeBySlot       : Array<UnitCommand> = [UnitCommand.Produce, UnitCommand.Produce, UnitCommand.Produce, UnitCommand.Produce];
    protected static _ButtonCommandBaseUid          : string = "#UnitCommandConfig_Produce";
    // @ts-expect-error
    protected _productCfg : UnitConfig;

    /**
     * @constructor
     * @param {IUnitCaster} caster - Юнит, который кастует заклинание.
     */
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
    } // </constructor>

    /**
     * @method Activate
     * @description Активирует заклинание, сохраняя конфигурацию создаваемого юнита.
     * @param {ACommandArgs} activateArgs - Аргументы команды активации.
     * @returns {boolean} - true, если активация прошла успешно, иначе false.
     */
    public Activate(activateArgs: ACommandArgs) : boolean {
        if (super.Activate(activateArgs)) {
            // @ts-expect-error
            this._productCfg = activateArgs.ProductCfg;

            return true;
        } else {
            return false;
        }
    } // </Activate>
}