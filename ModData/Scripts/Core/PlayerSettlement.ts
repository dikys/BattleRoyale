import { GameSettlement } from "./GameSettlement";
import { IHero } from "../Heroes/IHero";

export class PlayerSettlement extends GameSettlement {
    public isDefeat:      boolean;
    public heroUnit:      IHero;
    public settlementUid: number;

    public constructor(hordeSettlement: HordeClassLibrary.World.Settlements.Settlement, hordeUnit: IHero) {
        super(hordeSettlement);

        this.isDefeat      = false;
        this.heroUnit      = hordeUnit;
        this.settlementUid = Number.parseInt(hordeSettlement.Uid);
    }

    public OnEveryTick(gameTickNum:number) {
        this.heroUnit.OnEveryTick(gameTickNum);
    }
}
