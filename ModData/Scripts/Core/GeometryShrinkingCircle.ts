import { GeometryCircle } from "./GeometryCircle";
import { Stride_Color } from "library/game-logic/horde-types";

export class GeometryShrinkingCircle {
    startCircle: GeometryCircle;
    endCircle: GeometryCircle;
    animationTotalTime: number;
    everyTick_tiksToLive: number;
    end_tiksToLive: number;

    animationStartTime: number;

    animationIsEnd: boolean;
    // @ts-expect-error
    currentCircle: GeometryCircle;

    constructor (startCircle: GeometryCircle, endCircle: GeometryCircle, animationTotalTime: number, everyTick_tiksToLive: number, end_tiskToLive: number) {
        this.startCircle   = startCircle;
        this.endCircle     = endCircle;
        this.animationTotalTime = animationTotalTime;
        this.everyTick_tiksToLive = everyTick_tiksToLive;
        this.end_tiksToLive = end_tiskToLive;

        this.animationIsEnd = false;
        this.animationStartTime = -1;
    }

    public OnEveryTick(gameTickNum:number) {
        if (this.animationIsEnd) {
            return;
        }

        // ловим первый кадр анимации
        if (this.animationStartTime < 0) {
            this.animationStartTime = gameTickNum;
        }

        var animationTime = gameTickNum - this.animationStartTime;

        // проверка, что анимация закончилась
        if (animationTime > this.animationTotalTime) {
            this.animationIsEnd = true;

            // рисуем постоянный круг
            this.currentCircle = this._CreateInterpCircle(this.animationTotalTime);
            this.currentCircle.Draw(this.end_tiksToLive);

            return;
        }

        // анимация идет
        this.currentCircle = this._CreateInterpCircle(animationTime);
        this.currentCircle.Draw(this.everyTick_tiksToLive);
    }

    private _CreateInterpCircle(animationTime: number) : GeometryCircle {
        var t = animationTime / this.animationTotalTime;
        return new GeometryCircle(
            this.startCircle.radius + t*(this.endCircle.radius - this.startCircle.radius),
            this.startCircle.center.Add(this.endCircle.center.Minus(this.startCircle.center).Scale(t)),
            new Stride_Color(Math.round(this.startCircle.color.R + t*(this.endCircle.color.R - this.startCircle.color.R)),
                 Math.round(this.startCircle.color.G + t*(this.endCircle.color.G - this.startCircle.color.G)),
                 Math.round(this.startCircle.color.B + t*(this.endCircle.color.B - this.startCircle.color.B))),
            this.startCircle.thickness + t*(this.endCircle.thickness - this.startCircle.thickness)
        );
    }
}
