import { ScriptUnitWorkerState, Unit, UnitCommand, UnitConfig, UnitState } from "library/game-logic/horde-types";
import { IUnit } from "./IUnit";
import { UnitProducerProfessionParams, UnitProfession } from "library/game-logic/unit-professions";
import { Hero_Crusader } from "../Heroes/Hero_Crusader";
import { Hero_FireArcher } from "../Heroes/Hero_FireArcher";
import { Hero_Hunter } from "../Heroes/Hero_Hunter";
import { Hero_Rider } from "../Heroes/Hero_Rider";
import { Hero_Scorpion } from "../Heroes/Hero_Scorpion";
import { Hero_Totemist } from "../Heroes/Hero_Totemist";
import { log } from "library/common/logging";
import { IHero } from "../Heroes/IHero";
import { createGameMessageWithNoSound } from "library/common/messages";
import { createHordeColor } from "library/common/primitives";
import { Hero_Necromancer } from "../Heroes/Hero_Necromancer";

var opUnitIdToTavernObject : Map<number, Tavern> = new Map<number, Tavern>();

export class Tavern extends IUnit {
    protected static CfgUid      : string = this.CfgPrefix + "Tavern";
    protected static BaseCfgUid  : string = "#UnitConfig_Slavyane_Barrack";

    private static Heroes : Array<typeof IHero> = [
        Hero_Crusader,
        Hero_FireArcher,
        Hero_Hunter,
        Hero_Rider,
        Hero_Scorpion,
        Hero_Totemist,
        Hero_Necromancer
    ];

    private static _OnProducedCallbackInit = false;

    public selectedHero : typeof IHero | null;

    constructor(hordeUnit: Unit) {
        super(hordeUnit);

        opUnitIdToTavernObject.set(hordeUnit.Id, this);
        this.selectedHero = null;
    }

    public static GetHordeConfig(): UnitConfig {
        super.GetHordeConfig();

        if (!this._OnProducedCallbackInit) {
            this._OnProducedCallbackInit = true;
            
            const workerName = `${this.CfgPrefix}_Tavern_Produce`
            // Обертка для метода из плагина, чтобы работал "this"
            const workerWrapper = (u: Unit) => this._OnProduced.call(this, u);
            // Прокидываем доступ к функции-обработчику в .Net через глобальную переменную
            UnitWorkersRegistry.Register(workerName, workerWrapper);
            // Объект-обработчик
            const workerObject = new ScriptUnitWorkerState();
            // Установка функции-обработчика
            ScriptUtils.SetValue(workerObject, "FuncName", workerName);
            // Установка обработчика в конфиг
            const stateWorkers = ScriptUtils.GetValue(this.Cfg, "StateWorkers");
            stateWorkers.Item.set(UnitState.Produce, workerObject);
        }

        return this.Cfg;
    }

    private static _OnProduced(unit: Unit) {
        var tavern = opUnitIdToTavernObject.get(unit.Id) as Tavern;
        for (var hero of this.Heroes) {
            if (hero.CfgUid == unit.OrdersMind.ActiveOrder.ProductUnitConfig.Uid) {
                tavern.selectedHero = hero;
                tavern.hordeUnit.Owner.Messages.AddMessage(createGameMessageWithNoSound("Вы выбрали " + hero.GetHordeConfig().Name, tavern.hordeUnit.Owner.SettlementColor));
                break;
            }
        }
        tavern.hordeUnit.OrdersMind.CancelOrdersSafe();
    }

    public static _InitHordeConfig(): void {
        super._InitHordeConfig();

        // добавляем героев
        var producerParams = this.Cfg.GetProfessionParams(UnitProducerProfessionParams, UnitProfession.UnitProducer) as UnitProducerProfessionParams;
        var produceList    = producerParams.CanProduceList;
        produceList.Clear();
        this.Heroes.forEach((hero) => produceList.Add(hero.GetHordeConfig()));

        ScriptUtils.SetValue(this.Cfg, "Name", "Таверна");
        // малый обзор
        ScriptUtils.SetValue(this.Cfg, "Sight", 0);

        // убираем команду самоуничтожения
        if (this.Cfg.AllowedCommands.ContainsKey(UnitCommand.DestroySelf)) {
            this.Cfg.AllowedCommands.Remove(UnitCommand.DestroySelf);
        }
    }
}
