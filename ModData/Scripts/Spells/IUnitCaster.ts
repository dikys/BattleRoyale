import {
    ACommandArgs,
    MotionCustom,
    OrderCustom, ScriptUnitWorkerGetOrder,
    StateMotion,
    Unit,
    UnitCommand,
    UnitConfig,
    UnitState
} from "library/game-logic/horde-types";
import { ISpell, SpellState } from "./ISpell";
import { createGameMessageWithNoSound } from "library/common/messages";
import { createHordeColor } from "library/common/primitives";
import { setUnitStateWorker } from "library/game-logic/workers";
import {IUnit} from "../Units/IUnit";
import { log } from "library/common/logging";

var pluginWrappedWorker     : any = null;
var cfgUidWithWrappedWorker : Map<string, boolean> = new Map<string, boolean>();

export class IUnitCaster extends IUnit {
    protected static _SpellsMaxCount : number = 5;

    private static _OpUnitIdToUnitCasterObject : Map<number, IUnitCaster> = new Map<number, IUnitCaster>();
    private static _GetOrderWorkerSet : boolean = false;
    private static _baseGetOrderWorker : HordeClassLibrary.UnitComponents.Workers.Interfaces.Special.AUnitWorkerGetOrder;

    public static GetHordeConfig() : UnitConfig {
        // удаляем конфиг при первом запуске, чтобы был скопирован обработчик из базового конфига
        if (!this.Cfg && HordeContentApi.HasUnitConfig(this.CfgUid)) {
            HordeContentApi.RemoveConfig(HordeContentApi.GetUnitConfig(this.CfgUid));
        }

        var cfg = super.GetHordeConfig();

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

            //log.info("[", this.CfgUid,"] GetHordeConfig::register _GetOrderWorkerSet");
        }

        return cfg;
    }

    private static _GetOrderWorker(unit: Unit, commandArgs: ACommandArgs): boolean {
        var heroObj = IUnitCaster._OpUnitIdToUnitCasterObject.get(unit.Id);
        if (heroObj) {
            if (!heroObj.OnOrder(commandArgs)) {
                return true;
            }
        }

        // запуск обычного обработчика получения приказа
        return this._baseGetOrderWorker.GetOrder(unit, commandArgs);
    }

    public static _StateWorkerCustom(u: Unit) {
        let motion = u.OrdersMind.ActiveMotion;
        var caster : IUnitCaster = (u.ScriptData.IUnitCasterRef as IUnitCaster);

        // костыль
        // @ts-expect-error
        if (u.OrdersMind.ActiveOrder.ProductUnitConfig) {
            for (var spellNum = 0; spellNum < caster._spells.length; spellNum++) {
                if (caster._spells[spellNum].GetUnitCommand() == UnitCommand.Produce) {
                    // @ts-expect-error
                    caster._spells[spellNum].Activate({ProductCfg: u.OrdersMind.ActiveOrder.ProductUnitConfig});
                    motion.State = StateMotion.Done;
                    return;
                }
            }
            motion.State = StateMotion.Failed;
            return;
        }

        // Проверяем, что сейчас действительно выполняется кастомный приказ
        if (!host.isType(MotionCustom, motion)) {
            motion.State = StateMotion.Failed;
            return;
        }

        // Настройка при первом запуске обработки состояния Custom
        if (motion.IsUnprepared) {
            // Команда с которой был выдан приказ
            let cmdArgs = (u.OrdersMind.ActiveOrder as OrderCustom).CommandArgs;

            // способность, которая была вызвана
            var spellNum = 0;
            for (; spellNum < caster._spells.length; spellNum++) {
                if (caster._spells[spellNum].GetUnitCommand() == cmdArgs.CommandType) {
                    break;
                }
            }

            // проверяем, что способность найдена
            if (spellNum == caster._spells.length) {
                motion.State = StateMotion.Failed;
            }

            // активируем способность
            caster._spells[spellNum].Activate(cmdArgs);
            motion.State = StateMotion.Done;
        }
    }

    protected _spells : Array<ISpell>;
    private _causeDamageHandler : any;
    private _takeDamageHandler : any;

    constructor(hordeUnit: Unit) {
        super(hordeUnit);

        this._spells = new Array<ISpell>();
        this._SetWorker();
        
        this.hordeUnit.CommandsMind.HideCommand(UnitCommand.Attack);
        this.hordeUnit.CommandsMind.HideCommand(UnitCommand.MoveToPoint);
        this.hordeUnit.CommandsMind.HideCommand(UnitCommand.Cancel);

        IUnitCaster._OpUnitIdToUnitCasterObject.set(this.hordeUnit.Id, this);

        var that = this;
        this._causeDamageHandler = this.hordeUnit.EventsMind.CauseDamage.connect((sender, args) => that.OnCauseDamage(sender, args));
        this._takeDamageHandler  = this.hordeUnit.EventsMind.TakeDamage.connect((sender, args) => that.OnTakeDamage(sender, args));
    }

    public OnOrder(commandArgs: ACommandArgs): boolean {
        return true;
    }

    private _SetWorker () {
        this.hordeUnit.ScriptData.IUnitCasterRef = this;

        if (!pluginWrappedWorker) {
            pluginWrappedWorker = (u: Unit) => IUnitCaster._StateWorkerCustom(u);
        }

        if (!cfgUidWithWrappedWorker.has(this.hordeUnit.Cfg.Uid)) {
            setUnitStateWorker("CustomOrder", this.hordeUnit.Cfg, UnitState.Custom, pluginWrappedWorker);
            cfgUidWithWrappedWorker.set(this.hordeUnit.Cfg.Uid, true);
        }
    }

    public AddSpell(spellType: typeof ISpell, ...spellArgs: any[]) : boolean {
        // если добавляется тот же скилл, то прокачиваем скилл
        var spellNum;
        for (spellNum = 0; spellNum < this._spells.length; spellNum++) {
            if (this._spells[spellNum].GetUid() == spellType.GetUid()) {
                break;
            }
        }

        var thisClass = this.constructor as typeof IUnitCaster;

        if (spellNum < this._spells.length) {
            if (this._spells[spellNum].LevelUp()) {
                let msg = createGameMessageWithNoSound("Способность улучшена!", createHordeColor(255, 255, 100, 100));
                this.hordeUnit.Owner.Messages.AddMessage(msg);
                return true;
            } else {
                let msg = createGameMessageWithNoSound("Способность максимального уровня!", createHordeColor(255, 255, 100, 100));
                this.hordeUnit.Owner.Messages.AddMessage(msg);
                return false;
            }
        } else if (spellNum == this._spells.length && this._spells.length < thisClass._SpellsMaxCount) {
            this._spells.push(new spellType(this, ...spellArgs));
            return true;
        } else {
            let msg = createGameMessageWithNoSound("Нет свободных слотов!", createHordeColor(255, 255, 100, 100));
            this.hordeUnit.Owner.Messages.AddMessage(msg);
            return false;
        }
    }

    public Spells() : Array<ISpell> {
        return this._spells;
    }

    public OnEveryTick(gameTickNum: number): boolean {
        this._spells.forEach(spell => spell.OnEveryTick(gameTickNum));
        for (var spellNum = 0; spellNum < this._spells.length; spellNum++) {
            if (this._spells[spellNum].State() == SpellState.WAIT_DELETE) {
                this._spells.splice(spellNum--, 1);
            }
        }

        return super.OnEveryTick(gameTickNum);
    }

    public OnCauseDamage(sender: any, args: any) {
        this._spells.forEach(spell => spell.OnCauseDamage(args.VictimUnit, args.Damage, args.EffectiveDamage, args.HurtType));
    }

    public OnTakeDamage(sender: any, args: any) {
        this._spells.forEach(spell => spell.OnTakeDamage(args.AttackerUnit, args.Damage, args.HurtType));
    }

    // public OnOrder(commandArgs: ACommandArgs) {
    //     for (var spellNum = 0; spellNum < this._spells.length; spellNum++) {
    //         if (this._spells[spellNum].GetUnitCommand() != commandArgs.CommandType) {
    //             continue;
    //         }

    //         this._spells[spellNum].Activate(commandArgs);
    //         return false;
    //     }

    //     return true;
    // }

    public ReplaceHordeUnit(unit: Unit): void {
        super.ReplaceHordeUnit(unit);

        this.hordeUnit.CommandsMind.HideCommand(UnitCommand.Attack);
        this.hordeUnit.CommandsMind.HideCommand(UnitCommand.MoveToPoint);
        this.hordeUnit.CommandsMind.HideCommand(UnitCommand.Cancel);

        this._SetWorker();

        this._causeDamageHandler.disconnect();
        this._takeDamageHandler.disconnect();
        var that = this;
        this._causeDamageHandler = this.hordeUnit.EventsMind.CauseDamage.connect((sender, args) => that.OnCauseDamage(sender, args));
        this._takeDamageHandler  = this.hordeUnit.EventsMind.TakeDamage.connect((sender, args) => that.OnTakeDamage(sender, args));

        this._spells.forEach(spell => spell.OnReplacedCaster(this));

        IUnitCaster._OpUnitIdToUnitCasterObject.set(this.hordeUnit.Id, this);
    }
}
