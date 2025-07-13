import { ACommandArgs, GeometryCanvas, GeometryVisualEffect, Stride_Color, Stride_Vector2, TileType, Unit, UnitCommand, UnitFlags } from "library/game-logic/horde-types";
import { IConfig } from "../Units/IConfig";
import { spawnGeometry } from "library/game-logic/decoration-spawn";
import { Formation2 } from "../Core/Formation2";
import { BuildingTemplate } from "../Units/IFactory";
import { Cell } from "../Core/Cell";
import { IUnitCaster } from "../Spells/IUnitCaster";
import { IUnit } from "../Units/IUnit";
import { ISpell, SpellState } from "../Spells/ISpell";

export class IHero extends IUnitCaster {
    // способности
    protected static _Spells : Array<typeof ISpell>;
    // настройки формации - начальный радиус
    protected static _FormationStartRadius : number = 3;
    // настройки формации - плотность орбит
    protected static _FormationDestiny : number = 1 / 3;
    
    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        var spellsInfo = "";
        for (var spellNum = 0; spellNum < this._Spells.length; spellNum++) {
            spellsInfo += "Способность " + (spellNum + 1) + ": "
                + this._Spells[spellNum].GetName() + "\n"
                + this._Spells[spellNum].GetDescription() + "\n";
        }

        // формируем описание характеристик

        ScriptUtils.SetValue(this.Cfg, "Description",  this.Cfg.Description +
            (this.Cfg.Description == "" ? "" : "\n") +
            "  здоровье " + this.Cfg.MaxHealth + "\n" +
            "  броня " + this.Cfg.Shield + "\n" +
            (
                this.Cfg.MainArmament
                ? "  атака " + this.Cfg.MainArmament.ShotParams.Damage + "\n" +
                "  радиус атаки " + this.Cfg.MainArmament.Range + "\n"
                : ""
            ) +
            "  скорость бега " + this.Cfg.Speeds.Item.get(TileType.Grass) + " (в лесу " + this.Cfg.Speeds.Item.get(TileType.Forest) + ")" + "\n"
            + (this.Cfg.Flags.HasFlag(UnitFlags.FireResistant) || this.Cfg.Flags.HasFlag(UnitFlags.MagicResistant)
                ? "  иммунитет к " + (this.Cfg.Flags.HasFlag(UnitFlags.FireResistant) ? "огню " : "") + 
                    (this.Cfg.Flags.HasFlag(UnitFlags.MagicResistant) ? "магии " : "") + "\n"
                : "")
            + "  радиус видимости " + this.Cfg.Sight + " (в лесу " + this.Cfg.ForestVision + ")\n"
            + "\n" + spellsInfo);
    }

    // формация
    protected _formation : Formation2;

    /**
     * @constructor
     * @param {Unit} hordeUnit - Юнит из движка, который будет представлять этого героя.
     */
    constructor(hordeUnit: Unit) {
        super(hordeUnit);

        this._frame = null;
        
        // создаем класс формации
        // @ts-expect-error
        this._formation = new Formation2(Cell.ConvertHordePoint(this.hordeUnit.Cell), this.constructor['_FormationStartRadius'], this.constructor['_FormationDestiny']);

        // @ts-expect-error
        var spells = this.constructor["_Spells"] as Array<typeof ISpell>;
        spells.forEach(spell => {
            this.AddSpell(spell);
        });
    } // </constructor>

    /**
     * @method IsDead
     * @description Проверяет, мертв ли герой.
     * @returns {boolean} - true, если юнит героя мертв.
     */
    public IsDead() : boolean {
        return this.hordeUnit.IsDead;
    } // </IsDead>

    /**
     * @method OnDestroyBuilding
     * @description Обработчик события уничтожения здания. Может быть переопределен в дочерних классах.
     * @param {BuildingTemplate} buildingTemplate - Шаблон разрушенного здания.
     * @param {number} rarity - Редкость здания.
     * @param {IConfig} spawnUnitConfig - Конфигурация юнита, который должен был появиться.
     * @param {number} spawnCount - Количество юнитов, которое должно было появиться.
     * @returns {[IConfig, number]} - Возвращает исходные параметры спавна.
     */
    public OnDestroyBuilding(buildingTemplate: BuildingTemplate, rarity: number, spawnUnitConfig: IConfig, spawnCount: number) : [IConfig, number] {
        return [spawnUnitConfig, spawnCount];
    } // </OnDestroyBuilding>

    /**
     * @method AddUnitToFormation
     * @description Добавляет юнита в формацию героя.
     * @param {IUnit} unit - Юнит для добавления.
     */
    public AddUnitToFormation(unit: IUnit) {
        this._formation.AddUnits([ unit ]);
    } // </AddUnitToFormation>

    /**
     * @method SmartMoveTo
     * @description Отдает приказ герою двигаться в указанную точку.
     * @param {Cell} cell - Целевая клетка.
     */
    public SmartMoveTo(cell: Cell) {
        this.GivePointCommand(cell, UnitCommand.MoveToPoint, 0);
    }

    /**
     * @method OnEveryTick
     * @description Вызывается на каждом тике. Обновляет состояние формации, рамки и вызывает базовый обработчик.
     * @param {number} gameTickNum - Текущий тик игры.
     * @returns {boolean} - Возвращает false, если базовый метод вернул false, иначе true.
     */
    public OnEveryTick(gameTickNum: number): boolean {
        this._formation.OnEveryTick(gameTickNum);
        this._UpdateFrame();

        if (!super.OnEveryTick(gameTickNum)) {
            return false;
        }

        this._formation.SetCenter(Cell.ConvertHordePoint(this.hordeUnit.Cell));

        return true;
    } // </OnEveryTick>

    /**
     * @method OnOrder
     * @description Обрабатывает приказы, отданные герою, и транслирует их в команды для формации.
     * @param {ACommandArgs} commandArgs - Аргументы приказа.
     * @returns {boolean} - false, если приказ не был обработан базовым классом, иначе true.
     */
    public OnOrder(commandArgs: ACommandArgs) {
        if (!super.OnOrder(commandArgs)) {
            return false;
        }

        // управление формацией

        if (commandArgs.CommandType == UnitCommand.Attack) {
            // @ts-expect-error
            var targetHordeUnit = ActiveScena.UnitsMap.GetUpperUnit(commandArgs.TargetCell);
            if (targetHordeUnit) {
                this._formation.SetAttackTarget(new IUnit(targetHordeUnit));
            } else {
                // @ts-expect-error
                this._formation.SmartAttackCell(Cell.ConvertHordePoint(commandArgs.TargetCell));
            }
        }
        else if (commandArgs.CommandType == UnitCommand.Cancel) {
            this._formation.SmartMoveToTargetCommand();
        }

        return true;
    } // </OnOrder>

    /**
     * @method ReplaceHordeUnit
     * @description Заменяет юнит движка, которым управляет этот класс.
     * @param {Unit} unit - Новый юнит.
     */
    public ReplaceHordeUnit(unit: Unit): void {
        super.ReplaceHordeUnit(unit);

        // удаляем из формации выбранного лидера
        this._formation.RemoveUnits([ this ]);

        // если конфиг невидимого коня, то прячем рамку
        if (unit.Cfg.Uid == "#UnitConfig_Nature_Invisibility_Horse") {
            this._frameHideFlag = true;
            if (this._frame) {
                this._frame.Visible = false;
            }
        } else {
            this._frameHideFlag = false;
        }
    } // </ReplaceHordeUnit>

    private _frameHideFlag : boolean = false;
    private _frame : GeometryVisualEffect | null;
    private _UpdateFrame() {
        if (this.IsDead()) {
            if (this._frame) {
                this._frame.Free();
                this._frame = null;
            }
            return;
        }

        if (!this._frame) {
            this._MakeFrame();
        } else {
            this._frame.Position = this.hordeUnit.Position;

            // в лесу рамка должна быть невидимой
            let landscapeMap = ActiveScena.GetRealScena().LandscapeMap;
            var tile = landscapeMap.Item.get(this.hordeUnit.Cell);
            if (this._frameHideFlag || tile.Cfg.Type == TileType.Forest) {
                this._frame.Visible = false;
            } else {
                this._frame.Visible = true;
            }
        }
    }
    private _MakeFrame() {
        // Объект для низкоуровневого формирования геометрии
        let geometryCanvas = new GeometryCanvas();
        
        const width  = 32;
        const height = 32;

        var points = host.newArr(Stride_Vector2, 5)  as Stride_Vector2[];;
        points[0] = new Stride_Vector2(Math.round(-0.7*width),  Math.round(-0.7*height));
        points[1] = new Stride_Vector2(Math.round( 0.7*width),  Math.round(-0.7*height));
        points[2] = new Stride_Vector2(Math.round( 0.7*width),  Math.round( 0.7*height));
        points[3] = new Stride_Vector2(Math.round(-0.7*width),  Math.round( 0.7*height));
        points[4] = new Stride_Vector2(Math.round(-0.7*width),  Math.round(-0.7*height));

        geometryCanvas.DrawPolyLine(points,
            new Stride_Color(
                this.hordeUnit.Owner.SettlementColor.R,
                this.hordeUnit.Owner.SettlementColor.G,
                this.hordeUnit.Owner.SettlementColor.B),
            3.0, false);

        let ticksToLive = GeometryVisualEffect.InfiniteTTL;
        this._frame = spawnGeometry(ActiveScena, geometryCanvas.GetBuffers(), this.hordeUnit.Position, ticksToLive);
    }

    /**
     * @method GetAvailableSpellCommands
     * @description Возвращает список доступных для использования команд заклинаний.
     * @returns {UnitCommand[]} - Массив команд.
     */
    public GetAvailableSpellCommands(): UnitCommand[] {
        return this._spells
            .filter(spell => spell.GetState() === SpellState.READY)
            .map(spell => spell.GetUnitCommand());
    } // </GetAvailableSpellCommands>
}
