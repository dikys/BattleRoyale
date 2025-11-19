import { ISpell } from "../ISpell";
import { HordeColor, ResourcesAmount } from "library/common/primitives";
import { ACommandArgs, ReplaceUnitParameters, Stride_Color } from "library/game-logic/horde-types";
import {Hero_Necromancer} from "../../Heroes/Hero_Necromancer";

export class Spell_Mage_transform extends ISpell {
    protected static _ButtonUid                     : string = "Spell_Mage_transform";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_View"; // Assume an animation catalog
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(255, 0, 255, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 0, 255, 255);
    protected static _NamePrefix                    : string = "Превращение в мага";
    protected static _DescriptionTemplate           : string = "Превращает юнита в мага";
    protected static _SpellCost                     : ResourcesAmount = new ResourcesAmount(0, 0, 500, 0);
    protected static _IsConsumables                 : boolean = true;

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            // Параметры замены
            let replaceParams           = new ReplaceUnitParameters();
            replaceParams.OldUnit       = this._caster.hordeUnit;
            replaceParams.NewUnitConfig = Hero_Necromancer.GetHordeConfig();
            replaceParams.Cell = this._caster.hordeUnit.Cell;
            replaceParams.PreserveHealthLevel = true;
            replaceParams.PreserveExperience = true;
            // важно!
            replaceParams.PreserveOrders = false;
            replaceParams.PreserveKillsCounter = true;
            replaceParams.Silent = true;
    
            // Замена юнита
            var newUnit = this._caster.hordeUnit.Owner.Units.ReplaceUnit(replaceParams);
            this._caster.ReplaceHordeUnit(newUnit);

            return true;
        } else {
            return false;
        }
    }
} 