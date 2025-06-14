import { log } from "library/common/logging";
import { createPoint, Point2D } from "library/common/primitives";

export class Cell {
    X: number;
    Y: number;

    constructor(X: number, Y: number) {
        this.X = X;
        this.Y = Y;
    }

    Add(cell: Cell) : Cell {
        return new Cell(this.X + cell.X, this.Y + cell.Y);
    }
    Minus(cell: Cell) : Cell {
        return new Cell(this.X - cell.X, this.Y - cell.Y);
    }
    Scale(b: number) : Cell {
        return new Cell(this.X * b, this.Y * b);
    }
    Length_L2() : number {
        return Math.sqrt(this.X*this.X + this.Y*this.Y);
    }
    Length_L2_2() : number {
        return this.X*this.X + this.Y*this.Y;
    }
    Length_Chebyshev() : number {
        return Math.max(Math.abs(this.X), Math.abs(this.Y));
    }
    Angle(a: Cell) : number {
        var angle = Math.atan2(a.Y - this.Y, a.X - this.X);
        if (angle < 0) {
            angle += 2*Math.PI;
        }
        return angle;
    }
    VectProd(a: Cell) : number {
        return this.X * a.Y - this.Y * a.X;
    }
    Round() {
        return new Cell(Math.round(this.X), Math.round(this.Y));
    }
    Rotate(angle: number) {
        var cosA = Math.cos(angle);
        var sinA = Math.sin(angle);
        return new Cell(this.X * cosA - this.Y * sinA, this.X * sinA + this.Y * cosA);
    }
    ToHordePoint() : Point2D {
        return createPoint(this.X, this.Y);
    }
    Hash() : number {
        return 10000*this.X + this.Y;
    }
    static IsEquals(a: Cell, b: Cell): boolean {
        return Math.abs(a.X - b.X) < 1e-6 && Math.abs(a.Y - b.Y) < 1e-6;
    }
    static ConvertHordePoint(cell: HordeResurrection.Basic.Primitives.Geometry.Point2D) {
        return new Cell(cell.X, cell.Y);
    } 
    static GetConvexPolygon(points: Cell[]): number[] {
        if (points.length < 3) {
            // Выпуклая оболочка не существует для менее чем 3 точек
            return points.map((_, index) => index);
        }
    
        const n = points.length;
        const hullIndices: number[] = [];
    
        // Находим самую левую точку
        let leftmost = 0;
        for (let i = 1; i < n; i++) {
            if (points[i].X < points[leftmost].X || 
                (points[i].X === points[leftmost].X && points[i].Y < points[leftmost].Y)) {
                leftmost = i;
            }
        }
    
        let current = leftmost;
        let next: number;
    
        do {
            hullIndices.push(current);
            next = (current + 1) % n;
    
            for (let i = 0; i < n; i++) {
                if (i === current || i === next) continue;
                // Проверяем, является ли точка i "более выпуклой" чем next
                const cross = points[next].Minus(points[current]).VectProd(points[i].Minus(points[current]));
                if (cross < 0 || 
                    (cross === 0 && points[current].Minus(points[i]).Length_L2() > points[current].Minus(points[next]).Length_L2())) {
                    next = i;
                }
            }
    
            current = next;
        } while (current !== leftmost);
    
        return hullIndices;
    }
    static GetCellInPolygon(polygon: Array<Cell>) : Array<Cell> {
        // ищем прямоугольник для полигона
        var LD = new Cell(polygon[0].X, polygon[0].Y);
        var RU = new Cell(polygon[0].X, polygon[0].Y);
        for (var i = 1; i < polygon.length; i++) {
            LD.X = Math.min(LD.X, polygon[i].X);
            LD.Y = Math.min(LD.Y, polygon[i].Y);
            RU.X = Math.max(RU.X, polygon[i].X);
            RU.Y = Math.max(RU.Y, polygon[i].Y);
        }

        // ищем внутренние точки
        var insideCells = new Array<Cell>();

        for (var x = LD.X; x <= RU.X; x++) {
            for (var y = LD.Y; y <= RU.Y; y++) {
                var cell   = new Cell(x, y);
                var inside = true;
                for (var polygon_curr = 0, polygon_prev = polygon.length - 1; polygon_curr < polygon.length; polygon_prev = polygon_curr, polygon_curr++) {
                    if (polygon[polygon_curr].Minus(cell).VectProd(polygon[polygon_prev].Minus(cell)) > 0) {
                        inside = false;
                        break;
                    }
                }
                if (inside) {
                    insideCells.push(cell);
                }
            }
        }

        return insideCells;
    }
}
