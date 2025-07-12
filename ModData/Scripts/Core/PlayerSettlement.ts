import { GameSettlement } from "./GameSettlement";
import { IHero } from "../Heroes/IHero";
import { Bot } from "../../Bots/Bot";

export class PlayerSettlement extends GameSettlement {
    public isDefeat:      boolean;
    public heroUnit:      IHero;
    public settlementUid: number;
    public bot: Bot | null = null;

    public constructor(hordeSettlement: HordeClassLibrary.World.Settlements.Settlement, hordeUnit: IHero) {
        super(hordeSettlement);

        this.isDefeat      = false;
        this.heroUnit      = hordeUnit;
        this.settlementUid = Number.parseInt(hordeSettlement.Uid);
    }

    public OnEveryTick(gameTickNum:number) {
        this.heroUnit.OnEveryTick(gameTickNum);
        if (this.bot) {
            this.bot.OnEveryTick(gameTickNum);
        }
    }
}
