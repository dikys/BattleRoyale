/**
 * @class GameSettlement
 * @description Представляет игровое поселение, обертывая стандартный объект поселения из движка.
 */
export class GameSettlement {
    public hordeSettlement: HordeClassLibrary.World.Settlements.Settlement;

    /**
     * @constructor
     * @param {HordeClassLibrary.World.Settlements.Settlement} hordeSettlement - Объект поселения из движка.
     */
    public constructor(hordeSettlement: HordeClassLibrary.World.Settlements.Settlement) {
        this.hordeSettlement = hordeSettlement;
    } // </constructor>

    /**
     * @method OnEveryTick
     * @description Вызывается на каждом тике игры. В данной реализации пуст.
     * @param {number} gameTickNum - Текущий тик игры.
     */
    public OnEveryTick(gameTickNum:number) {
    } // </OnEveryTick>
}
