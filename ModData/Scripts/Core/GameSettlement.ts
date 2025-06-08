export class GameSettlement {
    public hordeSettlement: HordeClassLibrary.World.Settlements.Settlement;

    public constructor(hordeSettlement: HordeClassLibrary.World.Settlements.Settlement) {
        this.hordeSettlement = hordeSettlement;
    }

    public OnEveryTick(gameTickNum:number) {
    }
}
