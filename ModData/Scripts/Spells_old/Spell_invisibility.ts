import { ISpell } from "./ISpell";
import { HordeColor } from "library/common/primitives";
import { ACommandArgs, ReplaceUnitParameters, Stride_Color, UnitConfig } from "library/game-logic/horde-types";
import { IConfig } from "../Units/IConfig";

// class Horse_invisibility extends IConfig {
//     protected static CfgUid      : string = this.CfgPrefix + "_invisibility_horse";
//     protected static BaseCfgUid  : string = "#UnitConfig_Nature_Invisibility_Horse";
// }

export class Spell_invisibility extends ISpell {
    protected static _Duration : number = 10 * 50;

    protected static _ButtonUid                     : string = "Spell_invisibility";
    protected static _ButtonAnimationsCatalogUid    : string = "#AnimCatalog_Command_invisibility";
    protected static _EffectStrideColor             : Stride_Color = new Stride_Color(255, 255, 255, 255);
    protected static _EffectHordeColor              : HordeColor = new HordeColor(255, 255, 255, 255);
    protected static _Name                          : string = "Невидимость";
    protected static _Description                   : string = "Становится невидимым в течении " + (this._Duration / 50) + " сек.";

    // @ts-expect-error
    private _casterCfg : UnitConfig;

    public Activate(activateArgs: ACommandArgs): boolean {
        if (super.Activate(activateArgs)) {
            this._casterCfg = this._caster.hordeConfig;

            // Параметры замены
            let replaceParams           = new ReplaceUnitParameters();
            replaceParams.OldUnit       = this._caster.hordeUnit;
            //replaceParams.NewUnitConfig = Horse_invisibility.GetHordeConfig();
            replaceParams.NewUnitConfig = HordeContentApi.GetUnitConfig("#UnitConfig_Nature_Invisibility_Horse");
            replaceParams.Cell = null;                  // Можно задать клетку, в которой должен появиться новый юнит. Если null, то центр создаваемого юнита совпадет с предыдущим
            replaceParams.PreserveHealthLevel = true;   // Нужно ли передать уровень здоровья? (в процентном соотношении)
            replaceParams.PreserveExperience = true;    // Нужно ли передать опыт?
            replaceParams.PreserveOrders = true;        // Нужно ли передать приказы?
            replaceParams.PreserveKillsCounter = true;  // Нужно ли передать счетчик убийств?
            replaceParams.Silent = true;                // Отключение вывода в лог возможных ошибок (при регистрации и создании модели)
    
            // повышаем выбранного скорпа до лидера
            var newHero = this._caster.hordeUnit.Owner.Units.ReplaceUnit(replaceParams);
            this._caster.ReplaceHordeUnit(newHero);

            return true;
        } else {
            return false;
        }
    }

    protected _OnEveryTickActivated(gameTickNum: number): boolean {
        super._OnEveryTickActivated(gameTickNum);

        if (this._caster.hordeUnit.IsDead) {
            return true;
        }

        // проверяем, что лечение закончилось
        if (this._activatedTick + Spell_invisibility._Duration <= gameTickNum) {
            // Параметры замены
            let replaceParams           = new ReplaceUnitParameters();
            replaceParams.OldUnit       = this._caster.hordeUnit;
            replaceParams.NewUnitConfig = this._casterCfg;
            replaceParams.Cell = null;                  // Можно задать клетку, в которой должен появиться новый юнит. Если null, то центр создаваемого юнита совпадет с предыдущим
            replaceParams.PreserveHealthLevel = true;   // Нужно ли передать уровень здоровья? (в процентном соотношении)
            replaceParams.PreserveExperience = true;    // Нужно ли передать опыт?
            replaceParams.PreserveOrders = true;        // Нужно ли передать приказы?
            replaceParams.PreserveKillsCounter = true;  // Нужно ли передать счетчик убийств?
            replaceParams.Silent = true;                // Отключение вывода в лог возможных ошибок (при регистрации и создании модели)
    
            // повышаем выбранного скорпа до лидера
            var newHero = this._caster.hordeUnit.Owner.Units.ReplaceUnit(replaceParams);
            this._caster.ReplaceHordeUnit(newHero);

            return false;
        }

        return true;
    }
}
