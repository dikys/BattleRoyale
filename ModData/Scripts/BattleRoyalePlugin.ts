import { LogLevel } from "library/common/logging";
import { generateCellInSpiral, generateRandomCellInRect } from "library/common/position-tools";
import { isReplayMode } from "library/game-logic/game-tools";
import { BattleController, Settlement, UnitDirection, UnitHurtType } from "library/game-logic/horde-types";
import { spawnUnits } from "library/game-logic/unit-spawn";
import HordePluginBase from "plugins/base-plugin";
import { Factory_Slavyane } from "./Units/Factory_Slavyane";
import { GameField } from "./Core/GameField";
import { createHordeColor } from "library/common/primitives";
import { broadcastMessage, createGameMessageWithNoSound } from "library/common/messages";
import { ScriptData_Building } from "./Core/ScriptData_Building";
import { PlayerSettlement } from "./Core/PlayerSettlement";
import { GameSettlement } from "./Core/GameSettlement";
import { Cell } from "./Core/Cell";
import { IUnit } from "./Units/IUnit";
import { Priest } from "./Units/Priest";
import { BuildingTemplate, IFactory } from "./Units/IFactory";
import { Tavern } from "./Units/Tavern";
import { IHero } from "./Heroes/IHero";
import { SpellGlobalRef } from "./Spells/ISpell";

const PeopleIncomeLevel = HordeClassLibrary.World.Settlements.Modules.Misc.PeopleIncomeLevel;
type PeopleIncomeLevel = HordeClassLibrary.World.Settlements.Modules.Misc.PeopleIncomeLevel;

enum GameState {
    INIT = 0,
    SELECT = 1,
    PLACE = 2,
    RUN = 3,
    END
}

// var spellsTypes : Array<typeof ISpell> = [
//     Spell_Arrows_Volley,
//     Spell_Fireball,
//     Spell_golden_barracks_summon,
//     Spell_healing_aura,
//     Spell_teleportation_mark,
//     Spell_Teleportation
// ];

export class BattleRoyalePlugin extends HordePluginBase {
    _playerHordeSettlements: Array<Settlement>;
    _playerSettlements:    Array<PlayerSettlement>;
    _neutralSettlement:    GameSettlement;
    _enemySettlement:      GameSettlement;
    _gameField:            GameField;
    _gameState:            GameState;
    _buildingsTemplate:    Array<BuildingTemplate>;
    _playerTaverns:        Array<Tavern>;

    _playerUidToSettlement: Map<number, number>;

    _units:                Array<IUnit>;

    public constructor() {
        super("Королевская битва");

        this.log.logLevel = LogLevel.Debug;
        this._gameState     = GameState.INIT;

        this._playerSettlements = new Array<PlayerSettlement>();
        this._buildingsTemplate = new Array<BuildingTemplate>();

        this._units = new Array<IUnit>();
        this._playerUidToSettlement = new Map<number, number>();
        //this._spells = new Array<ISpell>();
    }

    public onFirstRun() {
        
    }

    public onEveryTick(gameTickNum: number) {
        if (this._gameState == GameState.RUN) {
            this._Run(gameTickNum);
        } else if (gameTickNum == 1) {
            broadcastMessage("Подготовка карты", createHordeColor(255, 255, 55, 55));
        } else if (this._gameState == GameState.INIT && gameTickNum > 10) {
            this._Init(gameTickNum);
            this._gameState = GameState.SELECT;
        } else if (this._gameState == GameState.PLACE) {
            this._Place(gameTickNum);
            this._gameState = GameState.RUN;
        } else if (this._gameState == GameState.SELECT) {
            this._Select(gameTickNum);
        }
    }

    _nextSpawnSpell: number = 0;
    _nextSpawnBuilding: number = 0;
    private _Run(gameTickNum: number) {
        // for (var spellNum = 0; spellNum < this._spells.length; spellNum++) {
        //     if (this._spells[spellNum].OnEveryTick(gameTickNum)) {
        //         if (this._spells[spellNum].IsEnd()) {
        //             this._spells.splice(spellNum--, 1);
        //         }
        //     }
        // }
        this._playerSettlements.forEach((playerSettlement) => playerSettlement.OnEveryTick(gameTickNum));
        this._gameField.OnEveryTick(gameTickNum);

        for (var unitNum = 0; unitNum < this._units.length; unitNum++) {
            if (this._units[unitNum].OnEveryTick(gameTickNum)) {
                if (this._units[unitNum].hordeUnit.IsDead) {
                    this._units.splice(unitNum--, 1);
                }
            }
        }

        var settlementNum = gameTickNum % 50;
        if (settlementNum < this._playerSettlements.length) {
            if (!this._playerSettlements[settlementNum].isDefeat){
                //  присуждаем  поражение
                if (this._playerSettlements[settlementNum].heroUnit.IsDead()){
                    this._playerSettlements[settlementNum].isDefeat = true;
                    this._playerSettlements[settlementNum].hordeSettlement.Existence.ForceTotalDefeat();
                    this._playerSettlements.forEach((otSettlement, otSettlementNum)=>{
                        if (otSettlementNum ==  settlementNum   ||
                            this._playerSettlements[otSettlementNum].isDefeat)  {
                            return;
                        }

                        this._playerSettlements[settlementNum].hordeSettlement.Diplomacy.DeclareAlliance(otSettlement.hordeSettlement);
                        otSettlement.hordeSettlement.Diplomacy.DeclareAlliance(this._playerSettlements[settlementNum].hordeSettlement);
                    });
                    // удаляем юнитов
                    let enumerator = this._playerSettlements[settlementNum].hordeSettlement.Units.GetEnumerator();
                    while(enumerator.MoveNext()) {
                        var unit = enumerator.Current;
                        if (!unit) continue;
                        
                        unit.Delete();
                    }
                    enumerator.Dispose();
                }
                //  присуждаем    победу
                else{
                    var settlementsInGame = this._playerSettlements.filter((playerSettlement)=>playerSettlement.isDefeat==false).length;
                    if(settlementsInGame==1){
                        this._playerSettlements[settlementNum].hordeSettlement.Existence.ForceVictory();
                        this._gameState=GameState.END;
                    }
                }
            }
        }

        // спавн способностей
        // if (this._nextSpawnSpell < gameTickNum && this._gameField.CurrentCircle()) {
        //     this._nextSpawnSpell = gameTickNum + 50 * 50;

        //     var rnd          = ActiveScena.GetRealScena().Context.Randomizer;
        //     var spellTypeNum = rnd.RandomNumber(0, spellsTypes.length - 1);
        //     var gameFieldRectangle  = this._gameField.GetCurrentRectangle();
        //     var generator           = generateRandomCellInRect(
        //         gameFieldRectangle.LD.X,
        //         gameFieldRectangle.LD.Y,
        //         gameFieldRectangle.RU.X,
        //         gameFieldRectangle.RU.Y);
        //     var spellCell    = generator.next().value;
        //     this._spells.push(
        //         new spellsTypes[spellTypeNum](
        //             new Cell(spellCell.X, spellCell.Y),
        //             this._buildingsTemplate,
        //             this._neutralSettlement,
        //             this._enemySettlement));
        // }

        // спавн строений
        if (this._nextSpawnBuilding < gameTickNum && this._gameField.CurrentCircle()) {
            this._nextSpawnBuilding = gameTickNum + 10*50;

            var rnd                 = ActiveScena.GetRealScena().Context.Randomizer;
            var buildingTemplateNum = rnd.RandomNumber(0, this._buildingsTemplate.length - 1);
            var rarityStart         = 10;
            var rarityValue         = rnd.RandomNumber(0, rarityStart*(Math.pow(2, this._buildingsTemplate[buildingTemplateNum].buildings.length) - 1) / (2 - 1));
            var rarityNum           = this._buildingsTemplate[buildingTemplateNum].buildings.length - 1;
            while (rarityValue > rarityStart) {
                rarityValue -= rarityStart;
                rarityNum--;
                rarityStart*=2;
            }
            var gameFieldRectangle  = this._gameField.GetCurrentRectangle();
            var generator           = generateRandomCellInRect(
                gameFieldRectangle.LD.X,
                gameFieldRectangle.LD.Y,
                gameFieldRectangle.RU.X,
                gameFieldRectangle.RU.Y);
            var units               = spawnUnits(
                this._enemySettlement.hordeSettlement,
                this._buildingsTemplate[buildingTemplateNum].buildings[rarityNum].hordeConfig,
                1,
                UnitDirection.RightDown,
                generator);
            units.forEach((unit) => {
                unit.ScriptData.Building = new ScriptData_Building();
                (unit.ScriptData.Building as ScriptData_Building).templateNum = buildingTemplateNum;
            });
        }

        // наносим  урон    юнитам  вне круга
        var settlementNum = gameTickNum % 25;
        var currentCircle = this._gameField.CurrentCircle();
        if  (currentCircle && settlementNum < this._playerSettlements.length)  {
            let enumerator = this._playerSettlements[settlementNum].hordeSettlement.Units.GetEnumerator();
            while(enumerator.MoveNext()) {
                var unit = enumerator.Current;
                if (!unit) continue;

                var unitCell = new Cell(unit.Position.X, unit.Position.Y);
                if (unitCell.Minus(currentCircle.center).Length_L2() > currentCircle.radius) {
                    unit.BattleMind.TakeDamage(unit.Cfg.Shield + 1, UnitHurtType.Mele);
                }
            }
            enumerator.Dispose();
        }
    }

    private _Init(gameTickNum: number) {
        var scenaSettlements = ActiveScena.GetRealScena().Settlements;

        // инициализируем спавнующие казармы на карте

        var factories : Array<typeof IFactory> = [
            Factory_Slavyane
        ];
        factories.forEach((factory) => {
            this._buildingsTemplate = this._buildingsTemplate.concat(factory.GetBuildings());
        });

        // создаем игровое поле
        this._gameField = new GameField(60*50, 100);

        // настройка поселений

        ForEach(scenaSettlements, (settlement : Settlement) => {
            // удаляем всех юнитов

            let enumerator = settlement.Units.GetEnumerator();
            while(enumerator.MoveNext()) {
                var unit = enumerator.Current;
                if (unit) unit.Delete();
            }
            enumerator.Dispose();

            // отбираем ресурсы

            settlement.Resources.TakeResources(settlement.Resources.GetCopy());

            // включаем кастомные условия поражения

            var existenceRule        = settlement.RulesOverseer.GetExistenceRule();
            var principalInstruction = ScriptUtils.GetValue(existenceRule, "PrincipalInstruction");
            ScriptUtils.SetValue(principalInstruction, "AlmostDefeatCondition", HordeClassLibrary.World.Settlements.Existence.AlmostDefeatCondition.Custom);
            ScriptUtils.SetValue(principalInstruction, "TotalDefeatCondition", HordeClassLibrary.World.Settlements.Existence.TotalDefeatCondition.Custom);
            ScriptUtils.SetValue(principalInstruction, "VictoryCondition", HordeClassLibrary.World.Settlements.Existence.VictoryCondition.Custom);

            // Отключить прирост населения

            let censusModel = ScriptUtils.GetValue(settlement.Census, "Model");
            censusModel.PeopleIncomeLevels.Clear();
            censusModel.PeopleIncomeLevels.Add(new PeopleIncomeLevel(0, 0, -1));
            censusModel.LastPeopleIncomeLevel = 0;

            // Установить период сбора налогов и выплаты жалования (чтобы отключить сбор, необходимо установить 0)
            
            censusModel.TaxAndSalaryUpdatePeriod = 0;
        });

        // поселения - игроки

        var playerSettlementsUid : Array<number> = new Array<number>();
        for (var player of Players) {
            var realPlayer   = player.GetRealPlayer();
            var settlement   = realPlayer.GetRealSettlement();

            if (isReplayMode() && !realPlayer.IsReplay) {
                continue;
            }
            if (playerSettlementsUid.find((settlementUid) => { return (settlementUid == Number.parseInt(settlement.Uid)); })) {
                continue;
            }
            this.log.info("Замечено поселение ", settlement.Uid);
            playerSettlementsUid.push(Number.parseInt(settlement.Uid));
        }
        playerSettlementsUid.sort();
        this._playerHordeSettlements = playerSettlementsUid.map((settlementUid) => scenaSettlements.Item.get(settlementUid + ''));

        // поселение - нейтрал

        this._neutralSettlement = new GameSettlement(scenaSettlements.Item.get('7'));

        // поселение - враг

        this._enemySettlement = new GameSettlement(scenaSettlements.Item.get('6'));

        // настраиваем дипломатию на карте

        for (var playerSettlementNum = 0; playerSettlementNum < this._playerHordeSettlements.length; playerSettlementNum++) {
            for (var otherPlayerSettlementNum = playerSettlementNum + 1; otherPlayerSettlementNum < this._playerHordeSettlements.length; otherPlayerSettlementNum++) {
                this._playerHordeSettlements[playerSettlementNum].Diplomacy.DeclareWar(this._playerHordeSettlements[otherPlayerSettlementNum]);
                this._playerHordeSettlements[otherPlayerSettlementNum].Diplomacy.DeclareWar(this._playerHordeSettlements[playerSettlementNum]);
            }
            this._playerHordeSettlements[playerSettlementNum].Diplomacy.DeclareWar(this._enemySettlement.hordeSettlement);
            this._enemySettlement.hordeSettlement.Diplomacy.DeclareWar(this._playerHordeSettlements[playerSettlementNum]);

            this._playerHordeSettlements[playerSettlementNum].Diplomacy.DeclarePeace(this._neutralSettlement.hordeSettlement);
            this._neutralSettlement.hordeSettlement.Diplomacy.DeclarePeace(this._playerHordeSettlements[playerSettlementNum]);
        }
        this._neutralSettlement.hordeSettlement.Diplomacy.DeclarePeace(this._enemySettlement.hordeSettlement);
        this._enemySettlement.hordeSettlement.Diplomacy.DeclarePeace(this._neutralSettlement.hordeSettlement);

        var that = this;
        // спавним юнитов после уничтожения постройки
        this._enemySettlement.hordeSettlement.Units.UnitsListChanged.connect(
            function (sender, args) {
                if (!args.IsAdded && args.Unit.ScriptData.Building) {
                    var building : ScriptData_Building = args.Unit.ScriptData.Building;

                    var playerSettlement = that._playerSettlements.find((playerSettlement) => playerSettlement.settlementUid == building.lastAttackSettlementUid);

                    if (!playerSettlement) return;

                    // проверяем, что поселение не проиграло
                    if (playerSettlement.isDefeat) {
                        return;
                    }

                    var rarityNum = 0;
                    for (;rarityNum < that._buildingsTemplate[building.templateNum].buildings.length; rarityNum++) {
                        if (that._buildingsTemplate[building.templateNum].buildings[rarityNum].hordeConfig.Uid ==
                            args.Unit.Cfg.Uid
                        ) {
                            break;
                        }
                    }

                    var generator = generateCellInSpiral(args.Unit.Cell.X, args.Unit.Cell.Y);
                    // вызываем событие у героя, возможно он что-то переделает
                    var spawnInfo = playerSettlement.heroUnit.OnDestroyBuilding(
                        that._buildingsTemplate[building.templateNum],
                        rarityNum,
                        that._buildingsTemplate[building.templateNum].units[rarityNum],
                        that._buildingsTemplate[building.templateNum].spawnCount
                    );
                    spawnUnits(
                        playerSettlement.hordeSettlement,
                        spawnInfo[0].hordeConfig,
                        spawnInfo[1],
                        UnitDirection.RightDown,
                        generator);
                }
            }
        );

        // спавним таверны на карте

        var generator   = this._gameField.GeneratorRandomCell();
        this._playerTaverns = new Array<Tavern>(this._playerHordeSettlements.length);
        for (var playerNum = 0; playerNum < this._playerHordeSettlements.length; playerNum++) {
            var units       = spawnUnits(this._playerHordeSettlements[playerNum],
                Tavern.GetHordeConfig(),
                1,
                UnitDirection.RightDown,
                generator);
            this._playerTaverns[playerNum] = new Tavern(units[0]);
        }

        // настраиваем поселения игроков

        for (var playerSettlementNum = 0; playerSettlementNum < this._playerHordeSettlements.length; playerSettlementNum++) {
            this._playerUidToSettlement.set(Number.parseInt(this._playerHordeSettlements[playerSettlementNum].Uid), playerSettlementNum);

            // записываем какое поселение последним атаковало постройку
            this._playerHordeSettlements[playerSettlementNum].Units.UnitCauseDamage.connect(
                function (sender, args) {
                    if (args.VictimUnit.ScriptData.Building) {
                        var building : ScriptData_Building = args.VictimUnit.ScriptData.Building;
                        building.lastAttackSettlementUid = args.TriggeredUnit.Owner.Uid;
                    }
                }
            );
        }

        // перемещаем экран на таверны игроков

        for (var player of Players) {
            if (player.IsLocalHuman) {
                var settlementNum = Number.parseInt(player.GetRealSettlement().Uid);
                if (this._playerUidToSettlement.has(settlementNum)) {
                    var playerSettlementNum = this._playerUidToSettlement.get(settlementNum) as number;
                    BattleController.Camera.SetCenterToCell(this._playerTaverns[playerSettlementNum].hordeUnit.Cell);
                }
            }
        }

        // передаем ссылки в скиллы
        SpellGlobalRef.BuildingsTemplate = this._buildingsTemplate;
        SpellGlobalRef.NeutralSettlement = this._neutralSettlement;
        SpellGlobalRef.EnemySettlement   = this._enemySettlement;
        SpellGlobalRef.GameField         = this._gameField;

        broadcastMessage("Выбери своего героя", createHordeColor(255, 255, 55, 55));
    }

    private _Select(gameTickNum: number) {
        // проверяем, что все выбрали своего героя

        var allSelected = true;
        for (var playerNum = 0; playerNum < this._playerTaverns.length; playerNum++) {
            if (this._playerTaverns[playerNum].selectedHero == null) {
                allSelected = false;
                break;
            }
        }
        if (!allSelected) {
            return;
        }

        this._gameState = GameState.PLACE;
    }

    private _Place(gameTickNum: number) {
        var that = this;
        var rnd         = ActiveScena.GetRealScena().Context.Randomizer;
        var generator   = this._gameField.GeneratorRandomCell();
        var gameFieldArea = this._gameField.StartArea();

        // создаем выбранных героев в случайном месте карты и создаем поселения игроков

        var heroesPosition = this._gameField.GetEquidistantPositions(this._playerHordeSettlements.length);

        for (var playerNum = 0; playerNum < this._playerHordeSettlements.length; playerNum++) {
            var selectedHero = this._playerTaverns[playerNum].selectedHero as typeof IHero;
            var heroCellNum  = rnd.RandomNumber(0, heroesPosition.length - 1);
            var generatorHeroCell = generateCellInSpiral(heroesPosition[heroCellNum].X, heroesPosition[heroCellNum].Y);
            var hero = new selectedHero(spawnUnits(
                this._playerHordeSettlements[playerNum],
                selectedHero.GetHordeConfig(),
                1,
                UnitDirection.RightDown,
                generatorHeroCell)[0]);
            heroesPosition.splice(heroCellNum, 1);

            this._playerSettlements.push(new PlayerSettlement(this._playerHordeSettlements[playerNum], hero));

            // печатаем описание на экран
            this._playerHordeSettlements[playerNum].Messages.AddMessage(
                createGameMessageWithNoSound("Описание героя: " + hero.hordeConfig.Description, createHordeColor(255, 255, 255, 255)));

            // настраиваем добавление в формацию

            this._playerHordeSettlements[playerNum].Units.UnitSpawned.connect(
                function (sender, args) {
                    var unit = new IUnit(args.Unit);
                    var settlementNum = that._playerUidToSettlement.get(Number.parseInt(unit.hordeUnit.Owner.Uid)) as number;
                    that._playerSettlements[settlementNum].heroUnit.AddUnitToFormation(unit);
            });

            // удаляем таверну

            this._playerTaverns[playerNum].hordeUnit.Delete();
        }

        // спавним несколько начальных строений относительно размера карты

        var spawnBuildingsCount = Math.sqrt(gameFieldArea / 15);
        for (var i = 0; i < spawnBuildingsCount; i++) {
            var buildingTemplateNum = rnd.RandomNumber(0, this._buildingsTemplate.length - 1);
            var rarityStart         = 10;
            var rarityValue         = rnd.RandomNumber(0, rarityStart*(Math.pow(2, this._buildingsTemplate[buildingTemplateNum].buildings.length) - 1) / (2 - 1));
            var rarityNum           = this._buildingsTemplate[buildingTemplateNum].buildings.length - 1;
            while (rarityValue > rarityStart) {
                rarityValue -= rarityStart;
                rarityNum--;
                rarityStart*=2;
            }
            var units       = spawnUnits(this._enemySettlement.hordeSettlement,
                this._buildingsTemplate[buildingTemplateNum].buildings[rarityNum].hordeConfig,
                1,
                UnitDirection.RightDown,
                generator);
            units.forEach((unit) => {
                unit.ScriptData.Building = new ScriptData_Building();
                (unit.ScriptData.Building as ScriptData_Building).templateNum = buildingTemplateNum;
            });
        }

        // спавним несколько способностей

        // var spawnSpellsCount = Math.max(6, Math.round(Math.sqrt(gameFieldArea) / 20));
        // for (var i = 0; i < spawnSpellsCount; i++) {
        //     var spellTypeNum = rnd.RandomNumber(0, spellsTypes.length - 1);
        //     var spellCell    = generator.next().value;
        //     this._spells.push(
        //         new spellsTypes[spellTypeNum](
        //             new Cell(spellCell.X, spellCell.Y),
        //             this._buildingsTemplate,
        //             this._neutralSettlement,
        //             this._enemySettlement));
        // }

        // перемещаем экран на героев игроков

        for (var player of Players) {
            if (player.IsLocalHuman) {
                var settlementNum = Number.parseInt(player.GetRealSettlement().Uid);
                if (this._playerUidToSettlement.has(settlementNum)) {
                    var playerSettlementNum = this._playerUidToSettlement.get(settlementNum) as number;
                    BattleController.Camera.SetCenterToCell(this._playerSettlements[playerSettlementNum].heroUnit.hordeUnit.Cell);
                }
            }
        }

        // спавним знахарей на карте

        var priestCount = Math.max(1, Math.round(Math.sqrt(gameFieldArea) / 30));
        var priestHordeUnits = spawnUnits(this._neutralSettlement.hordeSettlement, Priest.GetHordeConfig(), priestCount, UnitDirection.RightDown, generator);
        for (var hordeUnit of priestHordeUnits) {
            this._units.push(new Priest(hordeUnit, this._gameField, this._enemySettlement, this._playerSettlements));
        }
    }

};
