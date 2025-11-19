import { createPoint, Point2D } from "library/common/primitives";

/**
 * @class Cell
 * @description Представляет клетку (ячейку) на игровой карте с координатами X и Y.
 * Предоставляет методы для векторной арифметики и геометрических вычислений.
 */
export class Cell {
    X: number;
    Y: number;

    /**
     * @constructor
     * @param {number} X - Координата X.
     * @param {number} Y - Координата Y.
     */
    constructor(X: number, Y: number) {
        this.X = X;
        this.Y = Y;
    }

    /**
     * @method Add
     * @description Складывает текущую клетку с другой.
     * @param {Cell} cell - Клетка для сложения.
     * @returns {Cell} - Новая клетка, являющаяся результатом сложения.
     */
    Add(cell: Cell) : Cell {
        return new Cell(this.X + cell.X, this.Y + cell.Y);
    }

    /**
     * @method Minus
     * @description Вычитает другую клетку из текущей.
     * @param {Cell} cell - Клетка для вычитания.
     * @returns {Cell} - Новая клетка, являющаяся результатом вычитания.
     */
    Minus(cell: Cell) : Cell {
        return new Cell(this.X - cell.X, this.Y - cell.Y);
    }

    /**
     * @method Scale
     * @description Масштабирует координаты клетки на заданный коэффициент.
     * @param {number} b - Коэффициент масштабирования.
     * @returns {Cell} - Новая масштабированная клетка.
     */
    Scale(b: number) : Cell {
        return new Cell(this.X * b, this.Y * b);
    }

    /**
     * @method Length_L2
     * @description Вычисляет евклидово расстояние (L2 норму) от начала координат.
     * @returns {number} - Длина вектора.
     */
    Length_L2() : number {
        return Math.sqrt(this.X*this.X + this.Y*this.Y);
    }

    /**
     * @method Length_L2_2
     * @description Вычисляет квадрат евклидова расстояния от начала координат.
     * @returns {number} - Квадрат длины вектора.
     */
    Length_L2_2() : number {
        return this.X*this.X + this.Y*this.Y;
    }

    /**
     * @method Length_Chebyshev
     * @description Вычисляет расстояние Чебышёва (L∞ норму) от начала координат.
     * @returns {number} - Расстояние Чебышёва.
     */
    Length_Chebyshev() : number {
        return Math.max(Math.abs(this.X), Math.abs(this.Y));
    }

    /**
     * @method Angle
     * @description Вычисляет угол между текущей точкой и точкой 'a' относительно оси X.
     * @param {Cell} a - Вторая точка.
     * @returns {number} - Угол в радианах.
     */
    Angle(a: Cell) : number {
        var angle = Math.atan2(a.Y - this.Y, a.X - this.X);
        if (angle < 0) {
            angle += 2*Math.PI;
        }
        return angle;
    }

    /**
     * @method VectProd
     * @description Вычисляет векторное произведение (псевдоскалярное) с другим вектором-клеткой.
     * @param {Cell} a - Второй вектор (клетка).
     * @returns {number} - Результат векторного произведения.
     */
    VectProd(a: Cell) : number {
        return this.X * a.Y - this.Y * a.X;
    }

    /**
     * @method Round
     * @description Округляет координаты клетки до ближайших целых чисел.
     * @returns {Cell} - Новая клетка с округленными координатами.
     */
    Round() {
        return new Cell(Math.round(this.X), Math.round(this.Y));
    }

    /**
     * @method Rotate
     * @description Поворачивает вектор клетки на заданный угол вокруг начала координат.
     * @param {number} angle - Угол поворота в радианах.
     * @returns {Cell} - Новая повернутая клетка.
     */
    Rotate(angle: number) {
        var cosA = Math.cos(angle);
        var sinA = Math.sin(angle);
        return new Cell(this.X * cosA - this.Y * sinA, this.X * sinA + this.Y * cosA);
    }

    /**
     * @method ToHordePoint
     * @description Конвертирует объект Cell в стандартный Point2D движка.
     * @returns {Point2D} - Объект Point2D.
     */
    ToHordePoint() : Point2D {
        return createPoint(this.X, this.Y);
    }

    /**
     * @method Hash
     * @description Вычисляет хэш для клетки, используя ее координаты.
     * @returns {number} - Хэш-значение.
     */
    Hash() : number {
        return 10000*this.X + this.Y;
    }

    /**
     * @method IsEquals
     * @description Проверяет, равны ли две клетки с учетом погрешности.
     * @static
     * @param {Cell} a - Первая клетка.
     * @param {Cell} b - Вторая клетка.
     * @returns {boolean} - true, если клетки равны, иначе false.
     */
    static IsEquals(a: Cell, b: Cell): boolean {
        return Math.abs(a.X - b.X) < 1e-6 && Math.abs(a.Y - b.Y) < 1e-6;
    }

    /**
     * @method ConvertHordePoint
     * @description Конвертирует стандартную точку движка (Point2D) в объект Cell.
     * @static
     * @param {HordeResurrection.Basic.Primitives.Geometry.Point2D} cell - Точка движка.
     * @returns {Cell} - Новый объект Cell.
     */
    static ConvertHordePoint(cell: HordeResurrection.Basic.Primitives.Geometry.Point2D) {
        return new Cell(cell.X, cell.Y);
    }

    static ConvertPreciseFractionVector(cell: HordeResurrection.Basic.Primitives.Geometry.PreciseFractionVector) {
        return this.ConvertHordePoint(cell.ToPoint2D());
    }

    /**
     * @method GetConvexPolygon
     * @description Строит выпуклую оболочку для набора точек с помощью алгоритма Monotone Chain (Andrew's algorithm).
     * @static
     * @param {Cell[]} points - Массив точек.
     * @returns {number[]} - Массив индексов точек, образующих выпуклую оболочку.
     */
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

    /**
     * @method GetCellInPolygon
     * @description Находит все целочисленные клетки, находящиеся внутри заданного выпуклого многоугольника.
     * @static
     * @param {Array<Cell>} polygon - Массив вершин многоугольника (должны образовывать выпуклую оболочку).
     * @returns {Array<Cell>} - Массив клеток внутри многоугольника.
     */
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
