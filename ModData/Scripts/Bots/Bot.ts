import { IHero } from "../Heroes/IHero";
import { GameField } from "../Core/GameField";
import { Cell } from "../Core/Cell";
import { UnitCommand, ACommandArgs } from "library/game-logic/horde-types";
import { ActiveScena } from "library/game-logic/scena";
import { Unit } from "library/game-logic/horde-types";
import { PlayerSettlement } from "../Core/PlayerSettlement";
import { GameSettlement } from "../Core/GameSettlement";
import { DiplomacyStatus } from "library/game-logic/horde-types";

export class Bot {
    private hero: IHero;
    private gameField: GameField;
    private playerSettlement: PlayerSettlement;
    private enemySettlement: GameSettlement;
    private nextActionTick: number = 0;
    private actionInterval: number = 50; // Every 50 ticks

    constructor(hero: IHero, gameField: GameField, playerSettlement: PlayerSettlement, enemySettlement: GameSettlement) {
        this.hero = hero;
        this.gameField = gameField;
        this.playerSettlement = playerSettlement;
        this.enemySettlement = enemySettlement;
    }

    public OnEveryTick(gameTickNum: number): void {
        if (gameTickNum < this.nextActionTick) return;
        this.nextActionTick = gameTickNum + this.actionInterval;

        if (this.hero.IsDead()) return;

        const currentCircle = this.gameField.CurrentCircle();
        if (!currentCircle) return;

        const heroCell = Cell.ConvertHordePoint(this.hero.hordeUnit.Cell);

        // Priority 1: Stay in center of circle
        if (heroCell.Minus(currentCircle.center).Length_L2() > currentCircle.radius * 0.8) {
            this.MoveTo(currentCircle.center);
            return;
        }

        // Priority 2: Destroy nearby barracks (enemy buildings)
        const nearestBarrack = this.FindNearestEnemyBuilding();
        if (nearestBarrack) {
            this.AttackUnit(nearestBarrack);
            return;
        }

        // Priority 3: Use abilities if possible
        this.UseAbilities();

        // Priority 4: Attack nearby enemies
        const nearestEnemy = this.FindNearestEnemy();
        if (nearestEnemy) {
            this.AttackUnit(nearestEnemy);
            return;
        }

        // Default: Move to center
        this.MoveTo(currentCircle.center);
    }

    private MoveTo(targetCell: Cell): void {
        this.hero.hordeUnit.GiveOrder(UnitCommand.SmartMove, targetCell.ToHordePoint());
    }

    private AttackUnit(target: Unit): void {
        this.hero.hordeUnit.GiveOrder(UnitCommand.Attack, target.Cell);
    }

    private FindNearestEnemyBuilding(): Unit | null {
        let nearest: Unit | null = null;
        let minDist = Infinity;
        const enumerator = ActiveScena.GetRealScena().UnitsMap.GetEnumerator();
        while (enumerator.MoveNext()) {
            const unit = enumerator.Current;
            if (unit && unit.Owner.Uid === this.enemySettlement.hordeSettlement.Uid && unit.Cfg.IsBuilding) {
                const dist = Cell.ConvertHordePoint(this.hero.hordeUnit.Cell).Minus(Cell.ConvertHordePoint(unit.Cell)).Length_L2();
                if (dist < minDist) {
                    minDist = dist;
                    nearest = unit;
                }
            }
        }
        enumerator.Dispose();
        return nearest;
    }

    private FindNearestEnemy(): Unit | null {
        let nearest: Unit | null = null;
        let minDist = Infinity;
        const enumerator = ActiveScena.GetRealScena().UnitsMap.GetEnumerator();
        while (enumerator.MoveNext()) {
            const unit = enumerator.Current;
            if (unit && unit.Owner.Uid !== this.playerSettlement.hordeSettlement.Uid && !unit.IsDead && !unit.Cfg.IsBuilding && unit.Owner.Diplomacy.GetStatus(this.playerSettlement.hordeSettlement) === DiplomacyStatus.War) {
                const dist = Cell.ConvertHordePoint(this.hero.hordeUnit.Cell).Minus(Cell.ConvertHordePoint(unit.Cell)).Length_L2();
                if (dist < minDist && dist < this.hero.hordeConfig.Sight * 32) {
                    minDist = dist;
                    nearest = unit;
                }
            }
        }
        enumerator.Dispose();
        return nearest;
    }

    private UseAbilities(): void {
        const nearestEnemy = this.FindNearestEnemy();
        if (nearestEnemy) {
            // Simple: Try to use a spell command if allowed
            // Assuming spells use custom command types, but for example use UnitCommand.CastSpell or similar
            // Since specific, perhaps hardcode common spell commands
            const spellCommands = [UnitCommand.CastSpell1, UnitCommand.CastSpell2]; // Placeholder
            for (const cmd of spellCommands) {
                if (this.hero.hordeUnit.AllowedCommands.ContainsKey(cmd)) {
                    this.hero.hordeUnit.GiveOrder(cmd, nearestEnemy.Cell);
                    break;
                }
            }
        }
    }
} 