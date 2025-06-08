import { GeometryCanvas, GeometryVisualEffect, Stride_Color, Stride_Vector2 } from "library/game-logic/horde-types";
import { Cell } from "./Cell";
import { spawnGeometry } from "library/game-logic/decoration-spawn";
import { createPoint } from "library/common/primitives";

export class GeometryCircle {
    radius: number;
    center: Cell;
    color: Stride_Color;
    thickness: number;

    geometry: GeometryVisualEffect;

    constructor(radius: number, center: Cell, color: Stride_Color, thickness: number, ) {
        this.radius = Math.round(radius);
        this.center = center;
        this.color  = color;
        this.thickness = thickness;

        this.center.X = Math.round(this.center.X);
        this.center.Y = Math.round(this.center.Y);
    }

    public Draw(tiksToLive?: number) {
        let geometryCanvas = new GeometryCanvas();
        geometryCanvas.DrawCircle(
            new Stride_Vector2(0, 0),
            this.radius,
            this.color,
            40,
            this.thickness,
            false);
        var geometryBuffer = geometryCanvas.GetBuffers();
        this.geometry = spawnGeometry(ActiveScena, geometryBuffer, createPoint(this.center.X, this.center.Y), tiksToLive ?? 10000000);
        this.geometry.FogOfWarMode = HordeClassLibrary.World.Objects.VisualEffects.VisualEffectFogOfWarMode.Ignore;
    }
}
