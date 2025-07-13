import { createResourcesAmount, createPoint, createPF, createHordeColor } from "library/common/primitives";
import { spawnBullet } from "library/game-logic/bullet-spawn";
import { UnitProducerProfessionParams, UnitProfession } from "library/game-logic/unit-professions";
import { Cell } from "../Core/Cell";
import { ISpell } from "../Spells/ISpell";
import { Spell_teleportation_mark } from "../Spells/Spell_teleportation_mark";
import { IUnit } from "../Units/IUnit";
import { BattleController, BulletConfig, GeometryCanvas, GeometryVisualEffect, ShotParams, Stride_Color, Stride_Vector2, Unit, UnitMapLayer } from "library/game-logic/horde-types";
import { IHero } from "./IHero";
import { Spell_Teleportation } from "../Spells/Spell_Teleportation";

export class Hero_Totemist extends IHero {
    protected static CfgUid      : string = this.CfgPrefix + "HeroTotemist";
    protected static BaseCfgUid  : string = "#UnitConfig_Slavyane_Worker1";
    protected static _Spells : Array<typeof ISpell> = [Spell_teleportation_mark, Spell_Teleportation];
    
    private _formation_totems                   : Array<IFormationTotem>;
    private _formation_totems_buildingProgress  : Array<boolean>;
    private _formation_changed                  : boolean;
    private _formation_polygon                  : Array<Cell>; 
    private _formation_visualEffect             : GeometryVisualEffect | null;
    // @ts-expect-error
    private _formation_cells                    : Array<Cell>;
    // @ts-expect-error
    private _formation_generator                : Generator<Cell>;

    private static _peopleIncome_max    : number = 11;
    private static _peopleIncome_period : number = 250;
    private _peopleIncome_next   : number = 0;

    /**
     * @constructor
     * @param {HordeClassLibrary.World.Objects.Units.Unit} hordeUnit - Юнит из движка, который будет представлять этого героя.
     */
    constructor(hordeUnit: HordeClassLibrary.World.Objects.Units.Unit) {
        super(hordeUnit);

        this._formation_totems       = new Array<IFormationTotem>();
        this._formation_totems_buildingProgress = new Array<boolean>();
        this._formation_changed      = true;
        this._formation_visualEffect = null;
        this._formation_polygon      = new Array<Cell>();
    } // </constructor>

    protected static _InitHordeConfig() {
        ScriptUtils.SetValue(this.Cfg, "Name", "Герой {тотемщик}");
        ScriptUtils.SetValue(this.Cfg, "MaxHealth", 22);
        ScriptUtils.SetValue(this.Cfg, "Shield", 0);
        ScriptUtils.SetValue(this.Cfg.MainArmament.ShotParams, "Damage", 1);

        ScriptUtils.SetValue(this.Cfg, "Weight", 9);
        ScriptUtils.SetValue(this.Cfg, "PressureResist", 20);
    
        // добавляем постройки
        var producerParams = this.Cfg.GetProfessionParams(UnitProducerProfessionParams, UnitProfession.UnitProducer) as UnitProducerProfessionParams;
        var produceList    = producerParams.CanProduceList;
        produceList.Clear();
        var totemDefenceConfig = Totem_defence.GetHordeConfig();
        var formationTotemFireConfig = FormationTotem_fire.GetHordeConfig();
        var formationTotemFireBallConfig = FormationTotem_fireball.GetHordeConfig();
        produceList.Add(totemDefenceConfig);
        produceList.Add(formationTotemFireConfig);
        produceList.Add(formationTotemFireBallConfig);

        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Description", this.Cfg.Description + "\n\n" +
            "Сражается с помощью тотемов защиты (" + totemDefenceConfig.MaxHealth + " здоровья " + totemDefenceConfig.MainArmament.ShotParams.Damage + " урона, требуют "
            + totemDefenceConfig.CostResources.People + " населения) и тотемов формации (" + formationTotemFireConfig.MaxHealth +  " здоровья, требуют " 
            + formationTotemFireConfig.CostResources.People + " населения). Всего тотемщик имеет "
            + this._peopleIncome_max + " населения, скорость прироста " + (this._peopleIncome_period/50) + " сек"
        );
    }

    /**
     * @method AddUnitToFormation
     * @description Добавляет юнита в формацию героя. Специально обрабатывает тотемы формации.
     * @param {IUnit} unit - Юнит для добавления.
     */
    public AddUnitToFormation(unit: IUnit): void {
        super.AddUnitToFormation(unit);

        if (unit.hordeConfig.Uid == FormationTotem_fire.GetHordeConfig().Uid) {
            this._formation_totems.push(new FormationTotem_fire(unit.hordeUnit));
            this._formation_totems_buildingProgress.push(unit.hordeUnit.EffectsMind.BuildingInProgress);
        } else if (unit.hordeConfig.Uid == FormationTotem_fireball.GetHordeConfig().Uid) {
            this._formation_totems.push(new FormationTotem_fireball(unit.hordeUnit));
            this._formation_totems_buildingProgress.push(unit.hordeUnit.EffectsMind.BuildingInProgress);
        } else if (unit.hordeConfig.Uid == FormationTotem_ballista.GetHordeConfig().Uid) {
            this._formation_totems.push(new FormationTotem_ballista(unit.hordeUnit));
            this._formation_totems_buildingProgress.push(unit.hordeUnit.EffectsMind.BuildingInProgress);
        }
    } // </AddUnitToFormation>

    /**
     * @method OnEveryTick
     * @description Вызывается на каждом тике. Управляет приростом населения, состоянием тотемов и обновлением формации.
     * @param {gameTickNum} gameTickNum - Текущий тик игры.
     * @returns {boolean} - Возвращает false, если базовый метод вернул false, иначе true.
     */
    public OnEveryTick(gameTickNum: number): boolean {
        this._formation_totems.forEach((totem) => totem.OnEveryTick(gameTickNum));

        if (!super.OnEveryTick(gameTickNum)) {
            return false;
        }

        // инком людей
        if (this._peopleIncome_next < gameTickNum) {
            this._peopleIncome_next += Hero_Totemist._peopleIncome_period;

            if (this.hordeUnit.Owner.Resources.FreePeople + ScriptUtils.GetValue(this.hordeUnit.Owner.Census, "Model").BusyPeople < Hero_Totemist._peopleIncome_max) {
                var amount = createResourcesAmount(0, 0, 0, 1);
                this.hordeUnit.Owner.Resources.AddResources(amount);
            }
        }

        // удаляем из формации убитые башни
        for (var i = 0; i < this._formation_totems.length; i++) {
            if (this._formation_totems[i].hordeUnit.IsDead) {
                this._formation_totems.splice(i, 1);
                this._formation_totems_buildingProgress.splice(i, 1);
                this._formation_changed = true;
                i--;
            }
        }

        // логика формации
        this._FormationUpdate();

        return true;
    } // </OnEveryTick>

    private _FormationUpdate() {
        var readyForationTotems_num = new Array<number>();
        for (var i = 0; i < this._formation_totems.length; i++) {
            if (!this._formation_totems_buildingProgress[i]) {
                readyForationTotems_num.push(i);
            } else {
                if (!this._formation_totems[i].hordeUnit.EffectsMind.BuildingInProgress) {
                    readyForationTotems_num.push(i);
                    this._formation_totems_buildingProgress[i] = false;
                    this._formation_changed = true;
                }
            }
        }

        if (readyForationTotems_num.length > 2) { // формация активна
            // если в формации произошли изменения, то перестраиваем её
            if (this._formation_changed) {
                this._formation_changed = false;

                // ищем полигон формации - выпуклый многоугольник
                var readyForationTotems_cell = readyForationTotems_num.map((totemNum) => Cell.ConvertHordePoint(this._formation_totems[totemNum].hordeUnit.CellCenter));
                var convexPolygon = Cell.GetConvexPolygon(readyForationTotems_cell);
                this._formation_polygon = convexPolygon.map((num) => readyForationTotems_cell[num]);

                // рисуем графику
                let geometryCanvas = new GeometryCanvas();
                const tileSize  = 32;
                var points = host.newArr(Stride_Vector2, this._formation_polygon.length + 1)  as Stride_Vector2[];
                for (var i = 0; i < this._formation_polygon.length; i++) {
                    var point = this._formation_polygon[i].Scale(tileSize);
                    points[i] = new Stride_Vector2(point.X, point.Y);
                }
                points[this._formation_polygon.length] = points[0];
                geometryCanvas.DrawPolyLine(points,
                    new Stride_Color(
                        this.hordeUnit.Owner.SettlementColor.R,
                        this.hordeUnit.Owner.SettlementColor.G,
                        this.hordeUnit.Owner.SettlementColor.B),
                    3.0, false);
                let ticksToLive = GeometryVisualEffect.InfiniteTTL;
                if (this._formation_visualEffect) {
                    this._formation_visualEffect.Free();
                    this._formation_visualEffect = null;
                }
                //this._formation_visualEffect = spawnGeometry(ActiveScena, geometryCanvas.GetBuffers(), createPoint(0, 0), ticksToLive);

                this._formation_cells     = Cell.GetCellInPolygon(this._formation_polygon);
                this._formation_generator = this._FormationGeneratorRandomCell();
                this._formation_totems.forEach((totem) => totem.formationGenerator = this._formation_generator);
            }
        } else { // формация распалась
            if (this._formation_visualEffect) {
                this._formation_visualEffect.Free();
                this._formation_visualEffect = null;
            }
            this._formation_totems.forEach((totem) => totem.formationGenerator = null);
        }
    }

    protected *_FormationGeneratorRandomCell() : Generator<Cell> {
        // Рандомизатор
        let rnd = ActiveScena.GetRealScena().Context.Randomizer;

        let randomCells = [... this._formation_cells];
    
        while (randomCells.length > 0) {
            let num        = rnd.RandomNumber(0, randomCells.length - 1);
            let randomCell = randomCells[num];
            randomCells.splice(num, 1);

            if (randomCells.length == 0) {
                randomCells = [... this._formation_cells];
            }

            yield randomCell;
        }
    
        return;
    }
}

class Totem_defence extends IUnit {
    protected static CfgUid      : string = this.CfgPrefix + "TotemDefence";
    protected static BaseCfgUid  : string = "#UnitConfig_Slavyane_Tower";

    /**
     * @constructor
     * @param {any} hordeUnit - Юнит из движка, который будет представлять этот тотем.
     */
    constructor(hordeUnit: any) {
        super(hordeUnit);
    } // </constructor>

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Name", "Тотем защиты");
        ScriptUtils.SetValue(this.Cfg, "Description", "Стреляет ядрами во врагов");
        ScriptUtils.SetValue(this.Cfg, "MaxHealth", 40);
        ScriptUtils.SetValue(this.Cfg, "MinHealth", 5);
        ScriptUtils.SetValue(this.Cfg, "Shield", 0);
        ScriptUtils.SetValue(this.Cfg, "ProductionTime", 75);
        ScriptUtils.GetValue(this.Cfg.MainArmament, "BulletConfigRef").SetConfig(HordeContentApi.GetBulletConfig("#BulletConfig_CatapultBomb"));
        ScriptUtils.SetValue(this.Cfg.MainArmament.ShotParams, "Damage", 4);
        ScriptUtils.SetValue(this.Cfg, "ReloadTime", 50);
        ScriptUtils.SetValue(this.Cfg.MainArmament, "ReloadTime", 50);

        ScriptUtils.SetValue(this.Cfg.CostResources, "People", 3);
    }
}

class IFormationTotem extends IUnit {
    protected static BaseCfgUid  : string = "#UnitConfig_Slavyane_Tower";
    // @ts-expect-error
    protected _bulletConfig : BulletConfig;
    // @ts-expect-error
    protected _bulletShotParams : ShotParams;
    // @ts-expect-error
    protected _bulletCount : number;
    // @ts-expect-error
    protected _bulletPeriod : number;
    protected _bulletNextTick : number;

    public formationGenerator : Generator<Cell> | null;

    /**
     * @constructor
     * @param {Unit} hordeUnit - Юнит из движка, который будет представлять этот тотем.
     */
    constructor(hordeUnit: Unit) {
        super(hordeUnit);

        this.formationGenerator = null;
        this._bulletNextTick    = BattleController.GameTimer.GameFramesCounter;
    } // </constructor>

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "MaxHealth", 40);
        ScriptUtils.SetValue(this.Cfg, "MinHealth", 5);
        ScriptUtils.SetValue(this.Cfg, "Shield", 0);

        ScriptUtils.SetValue(this.Cfg.MainArmament, "Range", 0);
        ScriptUtils.SetValue(this.Cfg.MainArmament, "ForestRange", 0);

        ScriptUtils.SetValue(this.Cfg.CostResources, "People", 1);
    }

    /**
     * @method OnEveryTick
     * @description Вызывается на каждом тике. Если тотем является частью активной формации, вызывает метод Fire.
     * @param {number} gameTickNum - Текущий тик игры.
     * @returns {boolean} - Всегда возвращает true.
     */
    public OnEveryTick(gameTickNum: number): boolean {
        if (this.formationGenerator) {
            this.Fire();
        }
        return true;
    } // </OnEveryTick>

    /**
     * @method Fire
     * @description Производит выстрел, если прошла перезарядка. Создает снаряды в случайных точках внутри полигона формации.
     */
    public Fire() {
        if (this._bulletNextTick < BattleController.GameTimer.GameFramesCounter) {
            this._bulletNextTick = BattleController.GameTimer.GameFramesCounter + this._bulletPeriod;

            for (var i = 0; i < this._bulletCount; i++) {
                var targetCell = this.formationGenerator?.next().value.Scale(32);
                spawnBullet(
                    this.hordeUnit,  // Игра будет считать, что именно этот юнит запустил снаряд
                    null,
                    null,
                    this._bulletConfig,
                    this._bulletShotParams,
                    this.hordeUnit.Position,
                    createPoint(targetCell.X, targetCell.Y),
                    UnitMapLayer.Main
                );
            }
        }
    } // </Fire>
}

class FormationTotem_fire extends IFormationTotem {
    protected static CfgUid      : string = this.CfgPrefix + "FormationTotemFire";
    
    /**
     * @constructor
     * @param {Unit} hordeUnit - Юнит из движка, который будет представлять этот тотем.
     */
    constructor(hordeUnit: Unit) {
        super(hordeUnit);

        this._bulletConfig = HordeContentApi.GetBulletConfig("#BulletConfig_Slavyane_FireTrap");
        this._bulletShotParams = new ShotParams();
        this._bulletCount = 3;
        this._bulletPeriod = 150;
    } // </constructor>

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Name", "Тотем огненной формации");
        ScriptUtils.SetValue(this.Cfg, "Description", "Активируется, если 3 и более тотемов формации образуют выпуклый многоугольник. Создает огненные ловушки внутри этого многоугольника.");
    }
}

class FormationTotem_ballista extends IFormationTotem {
    protected static CfgUid      : string = this.CfgPrefix + "FormationTotemBallista";
    
    /**
     * @constructor
     * @param {Unit} hordeUnit - Юнит из движка, который будет представлять этот тотем.
     */
    constructor(hordeUnit: Unit) {
        super(hordeUnit);

        this._bulletConfig = HordeContentApi.GetBulletConfig("#BulletConfig_Slavyane_Ballista");
        this._bulletShotParams = new ShotParams();
        this._bulletCount = 1;
        this._bulletPeriod = 75;
    } // </constructor>

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Name", "Тотем балиста-формации");
        ScriptUtils.SetValue(this.Cfg, "Description", "Активируется, если 3 и более тотемов формации образуют выпуклый многоугольник. Выпускает стрелы балисты из случайных точек внутри этого многоугольника.");
    }
}

class FormationTotem_fireball extends IFormationTotem {
    protected static CfgUid      : string = this.CfgPrefix + "FormationTotemFireBall";
    
    /**
     * @constructor
     * @param {Unit} hordeUnit - Юнит из движка, который будет представлять этот тотем.
     */
    constructor(hordeUnit: Unit) {
        super(hordeUnit);

        this._bulletConfig = HordeContentApi.GetBulletConfig("#BulletConfig_Mage_Fireball");
        this._bulletShotParams = new ShotParams();
        this._bulletCount = 2;
        this._bulletPeriod = 100;
    } // </constructor>

    protected static _InitHordeConfig() {
        super._InitHordeConfig();

        ScriptUtils.SetValue(this.Cfg, "Name", "Тотем фаербол-формации");
        ScriptUtils.SetValue(this.Cfg, "Description", "Активируется, если 3 и более тотемов формации образуют выпуклый многоугольник. Выпускает фаерболы из случайных точек внутри этого многоугольника.");
    }
}