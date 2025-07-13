import { GameSettlement } from "./GameSettlement";
import { IHero } from "../Heroes/IHero";
import { Bot } from "../Bots/Bot";

export class PlayerSettlement extends GameSettlement {
    public isDefeat:      boolean;
    public heroUnit:      IHero;
    public settlementUid: number;
    public bot: Bot | null = null;

    /**
     * @constructor
     * @param {HordeClassLibrary.World.Settlements.Settlement} hordeSettlement - Объект поселения из движка.
     * @param {IHero} hordeUnit - Герой, принадлежащий этому поселению.
     */
    public constructor(hordeSettlement: HordeClassLibrary.World.Settlements.Settlement, hordeUnit: IHero) {
        super(hordeSettlement);

        this.isDefeat      = false;
        this.heroUnit      = hordeUnit;
        this.settlementUid = Number.parseInt(hordeSettlement.Uid);
    } // </constructor>

    /**
     * @method OnEveryTick
     * @description Вызывается на каждом тике, обновляет состояние героя и, если есть, бота.
     * @param {number} gameTickNum - Текущий тик игры.
     */
    public OnEveryTick(gameTickNum:number) {
        this.heroUnit.OnEveryTick(gameTickNum);
        if (this.bot) {
            this.bot.OnEveryTick(gameTickNum);
        }
    } // </OnEveryTick>
}
