import { ACommandArgs, ScriptUnitWorkerGetOrder, Unit, UnitConfig } from "library/game-logic/horde-types";
import { IUnit } from "../Units/IUnit";
import { ISpell } from "./ISpell";

export class IUnitCaster extends IUnit {
    private static _OpUnitIdToUnitCasterObject : Map<number, IUnitCaster> = new Map<number, IUnitCaster>();
    private static _GetOrderWorkerSet : boolean = false;
    private static _baseGetOrderWorker : HordeClassLibrary.UnitComponents.Workers.Interfaces.Special.AUnitWorkerGetOrder;

    public static GetHordeConfig () : UnitConfig {
        super.GetHordeConfig();

        // добавляем кастомный обработчик команд
        if (!this._GetOrderWorkerSet) {
            this._GetOrderWorkerSet = true;

            const workerName = `${this.CfgPrefix}_Caster_GetOrderWorker`
            // Обертка для метода из плагина, чтобы работал "this"
            const workerWrapper = (u: Unit, cmdArgs: ACommandArgs) => this._GetOrderWorker.call(this, u, cmdArgs);
            // Прокидываем доступ к функции-обработчику в .Net через глобальную переменную
            UnitWorkersRegistry.Register(workerName, workerWrapper);
            // Объект-обработчик
            const workerObject = new ScriptUnitWorkerGetOrder();
            // Установка функции-обработчика
            ScriptUtils.SetValue(workerObject, "FuncName", workerName);
            // запоминаем базовый обработчик
            this._baseGetOrderWorker = this.Cfg.GetOrderWorker;
            // Установка обработчика в конфиг
            ScriptUtils.SetValue(this.Cfg, "GetOrderWorker", workerObject);
        }

        return this.Cfg;
    }

    private static _GetOrderWorker(unit: Unit, commandArgs: ACommandArgs): boolean {
        var heroObj = this._OpUnitIdToUnitCasterObject.get(unit.Id);
        if (heroObj) {
            if (!heroObj.OnOrder(commandArgs)) {
                return true;
            }
        }

        // запуск обычного обработчика получения приказа
        return this._baseGetOrderWorker.GetOrder(unit, commandArgs);
    }

    protected _spells : Array<ISpell>;

    constructor(hordeUnit: Unit) {
        super(hordeUnit);
    
        this._spells = new Array<ISpell>();
        IUnitCaster._OpUnitIdToUnitCasterObject.set(this.hordeUnit.Id, this);
    }

    public AddSpell(spellType: typeof ISpell) {
        this._spells.push(new spellType(this));
    }

    public OnEveryTick(gameTickNum: number): boolean {
        this._spells.forEach(spell => spell.OnEveryTick(gameTickNum));

        return super.OnEveryTick(gameTickNum);
    }

    public OnOrder(commandArgs: ACommandArgs) {
        for (var spellNum = 0; spellNum < this._spells.length; spellNum++) {
            if (this._spells[spellNum].GetUnitCommand() != commandArgs.CommandType) {
                continue;
            }

            this._spells[spellNum].Activate(commandArgs);
            return false;
        }

        return true;
    }

    public ReplaceHordeUnit(unit: Unit): void {
        super.ReplaceHordeUnit(unit);

        IUnitCaster._OpUnitIdToUnitCasterObject.set(this.hordeUnit.Id, this);
        this._spells.forEach(spell => spell.OnReplacedCaster(this));
    }
}
