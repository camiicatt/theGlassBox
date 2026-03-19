import Phaser from "phaser";
import { encodeNeighborhood, type Tile } from "../../game/stateEncoding";
import { knnPredict } from "../../ai/knn";
import { useGameStore } from "../../app/store/useGameStore";
import type { Action } from "../../app/store/useGameStore";
import { ACTIONS } from "../../game/actions";

const W = 12;
const H = 12;
const HERO_MAX_HP = 5;

const TRAINING_ROUNDS_BEFORE_AI_RUN = 5;

const HEAL_AMOUNT = 2;
const HEAL_COOLDOWN_TURNS = 2;

function uid() {
  return Math.random().toString(16).slice(2);
}

type EnemyKind = "slime" | "bigSlime" | "spider";

type Enemy = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  kind: EnemyKind;
  damage: number;
  hitChance: number;
};

type DungeonTemplate = {
  map: string[];
  enemyKind: EnemyKind;
};

export default class DungeonScene extends Phaser.Scene {
  private grid!: Tile[][];
  private hero = { x: 1, y: 1, hp: HERO_MAX_HP };

  private enemy: Enemy = {
    x: 8,
    y: 8,
    hp: 2,
    maxHp: 2,
    kind: "slime",
    damage: 1,
    hitChance: 0.65,
  };

  private goal = { x: 10, y: 10 };

  private graphics!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;
  private combatText!: Phaser.GameObjects.Text;
  private healthBarSprite!: Phaser.GameObjects.Image;

  private heroSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;

  private lastStepAt = 0;
  private enemySkipTurns = 0;
  private healCooldown = 0;
  private hiddenTurns = 0;
  private autoHeroWalk = false;
  private heroAutoStepAt = 0;
  private heroWanderCooldownMs = 450;
  private invulnTurns = 0;
  private lastRestartToken = 0;
  private inBattleEncounter = false;
  private battleJustStarted = false;
  private trainingRoundsCompleted = 0;
  private combatMessage = "";

  private enemiesRemainingThisRound = 1;

  private lastAiAction: Action | null = null;
  private recentHeroPositions: { x: number; y: number }[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private dungeonTemplates: DungeonTemplate[] = [
    {
      enemyKind: "slime",
      map: [
        "############",
        "#S.....#...#",
        "#...#..#.#.#",
        "#...#..#.#.#",
        "###.#..#.#.#",
        "#...#....#.#",
        "#.######.#.#",
        "#......#.#.#",
        "#.####.#.#.#",
        "#.####.#...#",
        "#.######.EG#",
        "############",
      ],
    },
    {
      enemyKind: "bigSlime",
      map: [
        "############",
        "#S...#.....#",
        "#.#.#.###..#",
        "#.#.#...#..#",
        "#.#.###.#.##",
        "#.#.....#..#",
        "#.#####.##.#",
        "#.....#....#",
        "#####.####.#",
        "#.....#..E.#",
        "#.#####.##G#",
        "############",
      ],
    },
    {
      enemyKind: "spider",
      map: [
        "############",
        "#S.....#...#",
        "#.###.##.#.#",
        "#.#...#..#.#",
        "#.#.###.##.#",
        "#.#...#....#",
        "#.###.####.#",
        "#...#......#",
        "###.######.#",
        "#......#...#",
        "#.####.#.EG#",
        "############",
      ],
    },
    {
      enemyKind: "bigSlime",
      map: [
        "############",
        "#S...#.....#",
        "#.#.#.###..#",
        "#.#.#...#..#",
        "#.#.###.#.##",
        "#E#.....#..#",
        "#.#####.##.#",
        "#.....#....#",
        "#####.####.#",
        "#.....#....#",
        "#.#####.##G#",
        "############",
      ],
    },
    {
      enemyKind: "spider",
      map: [
        "############",
        "#S.........#",
        "#.########.#",
        "#.#......#.#",
        "#.#.####.#.#",
        "#.#.####.#.#",
        "#...####...#",
        "###.####.###",
        "#...#....#.#",
        "#.###.##.#.#",
        "#.....#..EG#",
        "############",
      ],
    },
  ];

  constructor() {
    super("DungeonScene");
  }

  preload() {
    this.load.image("slime", "/src/assets/monsters/slimeGreen.png");
    this.load.image("big-slime", "/src/assets/monsters/big-slime.png");
    this.load.image("spider-blue", "/src/assets/monsters/spiderBlue.png");
    this.load.image("hero", "/src/assets/hero.png");

    this.load.image("health0", "/src/assets/healthBar/health0.png");
    this.load.image("health1", "/src/assets/healthBar/health1.png");
    this.load.image("health2", "/src/assets/healthBar/health2.png");
    this.load.image("health3", "/src/assets/healthBar/health3.png");
    this.load.image("health4", "/src/assets/healthBar/health4.png");
    this.load.image("health5", "/src/assets/healthBar/health5.png");
  }

  create() {
    this.graphics = this.add.graphics();

    this.text = this.add.text(10, 10, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#ffffff",
    }).setDepth(30);

    this.combatText = this.add.text(10, 10, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#f8fafc",
      backgroundColor: "#7f1d1d",
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
      wordWrap: { width: 360 },
    }).setDepth(40).setVisible(false);

    this.healthBarSprite = this.add
    .image(this.scale.width - 20, 20, "health5")
    .setOrigin(1.5, .3)
    .setDepth(20)
    .setScrollFactor(0);

    this.grid = this.makeTemplateDungeon();
    this.trainingRoundsCompleted = 0;
    this.resetAiMemory();
    useGameStore.getState().setBattleLog("");

    this.heroSprite = this.add.image(0, 0, "hero").setDepth(20).setOrigin(0.5);
    this.enemySprite = this.add.image(0, 0, "slime").setDepth(20).setOrigin(0.5);

    this.setupControls();

    this.scale.on("resize", () => {
      this.render();
    });

    this.publishStateAndPrediction();
    this.rememberHeroPosition();
    this.syncBattlePrompt();
    this.render();
  }

  update(time: number) {
    const st = useGameStore.getState();
    const choice = st.pendingAction;

    if (st.restartToken !== this.lastRestartToken) {
      this.lastRestartToken = st.restartToken;

      this.hero.hp = HERO_MAX_HP;
      this.grid = this.makeTemplateDungeon();

      this.healCooldown = 0;
      this.hiddenTurns = 0;
      this.invulnTurns = 6;
      this.enemySkipTurns = 2;
      this.inBattleEncounter = false;
      this.battleJustStarted = false;
      this.trainingRoundsCompleted = 0;
      st.setBattleLog("");

      this.resetAiMemory();
      st.setHeroDead(false);

      this.publishStateAndPrediction();
      this.rememberHeroPosition();
      this.syncBattlePrompt();
      this.render();
      return;
    }

    if (choice) {
      st.setPendingAction(null);
      this.step(choice, true);
      return;
    }

    if (st.mode === "TRAINING" && this.autoHeroWalk) {
      if (time - this.heroAutoStepAt > this.heroWanderCooldownMs) {
        this.heroAutoStepAt = time;
        this.heroWanderOneStep();
        this.endOfTurn();
        return;
      }
    }

    if (st.mode === "AI_RUN" && time - this.lastStepAt > 250) {
      this.lastStepAt = time;

      const stateVec = st.currentState;
      if (!stateVec) return;

      const pred = knnPredict(stateVec, st.examples, 7);
      st.setPrediction(pred);

      const chosen = this.chooseLegalAction(pred.probs, pred.confidence);
      this.lastAiAction = chosen;
      this.step(chosen, false);
    }
  }

  private setupControls() {
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.wasdKeys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      const st = useGameStore.getState();
      if (st.mode !== "TRAINING") return;
      if (st.heroDead) return;

      const key = event.key.toLowerCase();

      if (key === "arrowup" || key === "w") {
        this.tryManualAction("UP");
      } else if (key === "arrowdown" || key === "s") {
        this.tryManualAction("DOWN");
      } else if (key === "arrowleft" || key === "a") {
        this.tryManualAction("LEFT");
      } else if (key === "arrowright" || key === "d") {
        this.tryManualAction("RIGHT");
      }
    });
  }

  private tryManualAction(action: Action) {
    const st = useGameStore.getState();
    if (st.mode !== "TRAINING") return;

    if (this.inBattleEncounter) {
      this.showCombatText("Use the battle popup while in combat.");
      this.syncBattlePrompt();
      this.render();
      return;
    }

    this.step(action, true);
  }

  private healthTextureFor(hp: number) {
    const clamped = Phaser.Math.Clamp(hp / HERO_MAX_HP, 0, 1);
    const level = Math.round(clamped * 5);
    return `health${level}`;
  }

  private resetAiMemory() {
    this.lastAiAction = null;
    this.recentHeroPositions = [];
  }

  private showCombatText(message: string) {
    this.combatMessage = message;
    useGameStore.getState().setBattleLog(message);
    this.combatText.setText(message);
    this.combatText.setVisible(true);
  }

  private reverseOf(action: Action): Action | null {
    switch (action) {
      case "LEFT":
        return "RIGHT";
      case "RIGHT":
        return "LEFT";
      case "UP":
        return "DOWN";
      case "DOWN":
        return "UP";
      default:
        return null;
    }
  }

  private rememberHeroPosition() {
    const last = this.recentHeroPositions[this.recentHeroPositions.length - 1];
    if (!last || last.x !== this.hero.x || last.y !== this.hero.y) {
      this.recentHeroPositions.push({ x: this.hero.x, y: this.hero.y });
    }
  
    if (this.recentHeroPositions.length > 8) {
      this.recentHeroPositions.shift();
    }
  }

  private isPositionLooping() {
    if (this.recentHeroPositions.length < 4) return false;
  
    const n = this.recentHeroPositions.length;
    const a = this.recentHeroPositions[n - 1];
    const b = this.recentHeroPositions[n - 2];
    const c = this.recentHeroPositions[n - 3];
    const d = this.recentHeroPositions[n - 4];
  
    const twoStepLoop = a.x === c.x && a.y === c.y && b.x === d.x && b.y === d.y;
  
    const repeatedVisits =
      this.recentHeroPositions.filter((p) => p.x === a.x && p.y === a.y).length >= 3;
  
    return twoStepLoop || repeatedVisits;
  }

  private enemiesForTrainingRound(round: number) {
    if (round <= 2) return 3;
    if (round <= 4) return 2;
    return 1;
  }

  private enemyPlanForTrainingRound(round: number) {
    if (round <= 2) {
      return { kind: "slime" as EnemyKind, hp: 2, damage: 1, hitChance: 0.55 };
    }
    if (round <= 4) {
      return round === 3
        ? { kind: "slime" as EnemyKind, hp: 2, damage: 1, hitChance: 0.6 }
        : { kind: "spider" as EnemyKind, hp: 2, damage: 1, hitChance: 0.62 };
    }
    return { kind: "bigSlime" as EnemyKind, hp: 4, damage: 1, hitChance: 0.65 };
  }

  private makeDungeonFromTemplate(template: DungeonTemplate): Tile[][] {
    const g: Tile[][] = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => 0 as Tile)
    );

    let heroSpawn = { x: 1, y: 1 };
    let enemySpawn = { x: 8, y: 8 };
    let goalSpawn = { x: 10, y: 10 };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = template.map[y][x];

        switch (ch) {
          case "#":
            g[y][x] = 1;
            break;
          case "S":
            g[y][x] = 0;
            heroSpawn = { x, y };
            break;
          case "E":
            g[y][x] = 0;
            enemySpawn = { x, y };
            break;
          case "G":
            g[y][x] = 3;
            goalSpawn = { x, y };
            break;
          default:
            g[y][x] = 0;
            break;
        }
      }
    }

    this.hero.x = heroSpawn.x;
    this.hero.y = heroSpawn.y;
    this.goal = goalSpawn;

    const st = useGameStore.getState();
    const round = this.trainingRoundsCompleted + 1;

    if (st.mode === "TRAINING") {
      this.enemiesRemainingThisRound = this.enemiesForTrainingRound(round);
      const plan = this.enemyPlanForTrainingRound(round);
      this.placeEnemyOnGrid(g, enemySpawn.x, enemySpawn.y, plan.kind, plan.hp, plan.damage, plan.hitChance);
    } else {
      const stats = this.enemyStatsFor(template.enemyKind);
      this.enemiesRemainingThisRound = 1;
      this.placeEnemyOnGrid(g, enemySpawn.x, enemySpawn.y, template.enemyKind, stats.maxHp, stats.damage, stats.hitChance);
    }

    this.enemySkipTurns = 0;
    this.healCooldown = 0;
    this.hiddenTurns = 0;
    this.invulnTurns = 0;
    this.inBattleEncounter = false;
    this.battleJustStarted = false;

    return g;
  }

  private makeTemplateDungeon(): Tile[][] {
    const template = Phaser.Utils.Array.GetRandom(this.dungeonTemplates);
    return this.makeDungeonFromTemplate(template);
  }

  private spawnNextEnemyForCurrentRound() {
    const round = this.trainingRoundsCompleted + 1;
    const plan = this.enemyPlanForTrainingRound(round);

    const candidates: { x: number; y: number }[] = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (!this.isWalkable(x, y)) continue;
        if (x === this.hero.x && y === this.hero.y) continue;
        if (x === this.goal.x && y === this.goal.y) continue;
        if (this.manhattan(x, y, this.hero.x, this.hero.y) < 4) continue;
        candidates.push({ x, y });
      }
    }

    if (candidates.length === 0) return;

    const spawn = Phaser.Utils.Array.GetRandom(candidates);
    this.placeEnemyOnGrid(this.grid, spawn.x, spawn.y, plan.kind, plan.hp, plan.damage, plan.hitChance);
    this.enemySkipTurns = 1;
    this.showCombatText(`${this.enemyLabelFor(plan.kind)} appears! ${this.enemiesRemainingThisRound} enemies left this round.`);
  }

  private enemyTextureFor(kind: EnemyKind) {
    switch (kind) {
      case "bigSlime":
        return "big-slime";
      case "spider":
        return "spider-blue";
      case "slime":
      default:
        return "slime";
    }
  }

  private enemyLabelFor(kind: EnemyKind) {
    switch (kind) {
      case "bigSlime":
        return "Big Slime";
      case "spider":
        return "Blue Spider";
      case "slime":
      default:
        return "Slime";
    }
  }

  private enemyStatsFor(kind: EnemyKind) {
    switch (kind) {
      case "bigSlime":
        return { maxHp: 4, damage: 1, hitChance: 0.65 };
      case "spider":
        return { maxHp: 3, damage: 1, hitChance: 0.72 };
      case "slime":
      default:
        return { maxHp: 2, damage: 1, hitChance: 0.7 };
    }
  }

  private syncBattlePrompt(
    extras?: {
      lastAction?: "FIGHT" | "HIDE" | "HEAL" | "RUN" | null;
      heroHit?: boolean;
      enemyHit?: boolean;
      heroDead?: boolean;
      enemyDead?: boolean;
      keepOpen?: boolean;
    }
  ) {
    const st = useGameStore.getState();

    const shouldStayOpen =
      (this.inBattleEncounter && this.enemyAlive()) || extras?.keepOpen;

    if (shouldStayOpen) {
      st.openBattlePrompt({
        enemyName: this.enemyLabelFor(this.enemy.kind),
        enemyKind: this.enemy.kind,
        enemySprite: this.enemyTextureFor(this.enemy.kind),
        heroSprite: "hero",
        enemyHp: Math.max(0, this.enemy.hp),
        enemyMaxHp: this.enemy.maxHp,
        heroHp: this.hero.hp,
        heroMaxHp: HERO_MAX_HP,
        lastAction: extras?.lastAction ?? null,
        heroHit: extras?.heroHit ?? false,
        enemyHit: extras?.enemyHit ?? false,
        heroDead: extras?.heroDead ?? false,
        enemyDead: extras?.enemyDead ?? false,
      });
    } else {
      st.closeBattlePrompt();
    }

    if (this.combatMessage) {
      st.setBattleLog(this.combatMessage);
    } else {
      st.setBattleLog("");
    }
  }

  private getTileSize() {
    const pad = 24;
    const usableW = this.scale.width - pad * 2;
    const usableH = this.scale.height - pad * 2;
    return Math.floor(Math.min(usableW / W, usableH / H));
  }

  private getGridOrigin(tile: number) {
    const gridW = tile * W;
    const gridH = tile * H;
    const ox = Math.floor((this.scale.width - gridW) / 2);
    const oy = Math.floor((this.scale.height - gridH) / 2);
    return { ox, oy };
  }

  private step(action: Action, recordExample: boolean) {
    const st = useGameStore.getState();
    const isMoveAction =
      action === "UP" || action === "DOWN" || action === "LEFT" || action === "RIGHT";
    const isBattleAction =
      action === "FIGHT" || action === "RUN" || action === "HIDE" || action === "HEAL";
  
    if (recordExample && st.currentState) {
      st.addExample({ state: st.currentState.slice(), action });
      st.saveToLocal?.();
    }
  
    if (this.inBattleEncounter && isMoveAction) {
      this.showCombatText("You are in battle. Use the battle popup.");
      this.syncBattlePrompt();
      this.render();
      return;
    }
  
    if (!this.inBattleEncounter && isBattleAction && !this.enemyAlive()) {
      if (action === "HEAL" || action === "HIDE") {
        // allowed outside battle
      } else {
        this.showCombatText("There is no enemy to battle.");
        this.render();
        return;
      }
    }
  
    this.applyGeneralAction(action);
  
    if (action === "FIGHT") {
      this.attackEnemyIfAdjacent();
    } else if (action === "RUN") {
      this.runAway();
    } else if (isMoveAction) {
      const { dx, dy } = this.actionToDelta(action);
      const nx = this.hero.x + dx;
      const ny = this.hero.y + dy;
  
      if (this.isWalkable(nx, ny)) {
        this.hero.x = nx;
        this.hero.y = ny;
  
        if (
          this.enemyAlive() &&
          this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y) <= 1 &&
          this.hasLineOfSight(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y)
        ) {
          this.inBattleEncounter = true;
          this.battleJustStarted = true;
          this.showCombatText(`Encounter! ${this.enemyLabelFor(this.enemy.kind)} blocks your path.`);
        }
      }
    }
  
    this.endOfTurn();
    this.syncBattlePrompt();
  }

  private endOfTurn() {
    if (this.healCooldown > 0) this.healCooldown--;
    if (this.hiddenTurns > 0) this.hiddenTurns--;
    if (this.invulnTurns > 0) this.invulnTurns--;

    if (this.enemyAlive() && !this.inBattleEncounter) {
      if (this.hiddenTurns > 0) {
        this.enemyWander();
      } else if (this.enemySkipTurns > 0) {
        this.enemySkipTurns--;
      } else {
        if (this.canEnemySeeHero(5)) this.enemyChase();
        else this.enemyWander();
      }
    }

    if (
      this.enemyAlive() &&
      this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y) <= 1 &&
      this.hasLineOfSight(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y)
    ) {
      if (!this.inBattleEncounter) {
        this.inBattleEncounter = true;
        this.battleJustStarted = true;
        this.showCombatText(`Encounter! ${this.enemyLabelFor(this.enemy.kind)} spotted you.`);
      }
    }

    if (this.inBattleEncounter && this.enemyAlive()) {
      if (this.battleJustStarted) {
        this.battleJustStarted = false;
      } else if (this.invulnTurns === 0) {
        const didHit = Math.random() < this.enemy.hitChance;

        if (didHit) {
          this.hero.hp = Math.max(0, this.hero.hp - this.enemy.damage);
          this.showCombatText(`${this.enemyLabelFor(this.enemy.kind)} hits for ${this.enemy.damage} HP`);
          this.syncBattlePrompt({
            lastAction: "FIGHT",
            heroHit: true,
            heroDead: this.hero.hp <= 0,
            keepOpen: true,
          });
        } else {
          this.showCombatText(`${this.enemyLabelFor(this.enemy.kind)} missed!`);
          this.syncBattlePrompt({
            lastAction: "FIGHT",
            heroHit: false,
            heroDead: false,
            keepOpen: true,
          });
        }

        this.invulnTurns = 2;
      }
    }

    const st = useGameStore.getState();

    if (this.hero.x === this.goal.x && this.hero.y === this.goal.y) {
      if (st.mode === "TRAINING") {
        if (this.enemyAlive() || this.enemiesRemainingThisRound > 0) {
          this.showCombatText(`You still need to defeat ${this.enemiesRemainingThisRound} enemy${this.enemiesRemainingThisRound === 1 ? "" : "ies"} this round.`);
        } else {
          this.trainingRoundsCompleted += 1;

          if (this.trainingRoundsCompleted >= TRAINING_ROUNDS_BEFORE_AI_RUN) {
            st.setMode("AI_RUN");
            this.showCombatText("Training finished: 5 rounds completed. AI now takes control.");
            this.trainingRoundsCompleted = 0;
          } else {
            const remaining = TRAINING_ROUNDS_BEFORE_AI_RUN - this.trainingRoundsCompleted;
            this.showCombatText(`Round cleared! ${remaining} training rounds left.`);
          }

          this.grid = this.makeTemplateDungeon();
          this.healCooldown = 0;
          this.hiddenTurns = 0;
          this.enemySkipTurns = 1;
          this.inBattleEncounter = false;
          this.battleJustStarted = false;
          this.resetAiMemory();
          this.rememberHeroPosition();
        }
      } else {
        this.grid = this.makeTemplateDungeon();
        this.healCooldown = 0;
        this.hiddenTurns = 0;
        this.enemySkipTurns = 1;
        this.inBattleEncounter = false;
        this.battleJustStarted = false;
        this.resetAiMemory();
        this.rememberHeroPosition();
      }
    }

    if (this.hero.hp <= 0) {
      this.hero.hp = 0;
      this.inBattleEncounter = false;
      this.battleJustStarted = false;
      st.setBattleLog("");

      const moment = {
        id: uid(),
        state: st.currentState ? st.currentState.slice() : [],
        confidence: st.prediction?.confidence ?? 0,
        aiChose: st.prediction?.bestAction ?? "WAIT",
      };

      st.setReviewMoments([...st.reviewMoments, moment]);
      st.setMode("REVIEW");
      st.setHeroDead(true);

      this.publishStateAndPrediction();
      this.render();
      return;
    }

    this.publishStateAndPrediction();
    this.rememberHeroPosition();
    this.syncBattlePrompt();
    this.render();
  }

  private applyGeneralAction(action: Action) {
    if (action === "HEAL") {
      if (this.healCooldown > 0) {
        this.showCombatText("Heal is on cooldown");
        return;
      }

      if (this.hero.hp >= HERO_MAX_HP) {
        this.showCombatText("You are already at full health");
        return;
      }

      const amount = Math.min(HEAL_AMOUNT, HERO_MAX_HP - this.hero.hp);
      this.hero.hp += amount;
      this.healCooldown = HEAL_COOLDOWN_TURNS;
      this.invulnTurns = Math.max(this.invulnTurns, 1);
      this.showCombatText(`You healed ${amount} HP`);
    }

    if (action === "HIDE") {
      this.hiddenTurns = Math.max(this.hiddenTurns, 3);
      this.enemySkipTurns = Math.max(this.enemySkipTurns, 2);
      this.invulnTurns = Math.max(this.invulnTurns, 1);
      this.showCombatText("You hide in the shadows");

      this.inBattleEncounter = false;
      this.battleJustStarted = false;

      this.syncBattlePrompt({ lastAction: "HIDE" });
    }
  }

  private trainingRoundLabel(round: number) {
    switch (round) {
      case 1:
        return "Round 1: Basic Survival";
      case 2:
        return "Round 2: Danger Awareness";
      case 3:
        return "Round 3: Smart Retreat";
      case 4:
        return "Round 4: Resource Use";
      case 5:
        return "Round 5: Final Test";
      default:
        return `Round ${round}`;
    }
  }

  private fightIfAdjacent() {
    this.attackEnemyIfAdjacent();
  }

  private attackEnemyIfAdjacent() {
    if (!this.enemyAlive()) return;

    const distance = this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y);
    if (distance > 1) {
      this.showCombatText("You are too far away to fight.");
      this.syncBattlePrompt({ lastAction: "FIGHT", keepOpen: true });
      return;
    }

    const didHit = Math.random() < 0.85;

    if (!didHit) {
      this.showCombatText(`You missed ${this.enemyLabelFor(this.enemy.kind)}!`);
      this.syncBattlePrompt({
        lastAction: "FIGHT",
        enemyHit: false,
        enemyDead: false,
        keepOpen: true,
      });
      return;
    }

    const dmg = 1;
    this.enemy.hp -= dmg;

    if (this.enemy.hp <= 0) {
      this.enemy.hp = 0;
      this.enemiesRemainingThisRound = Math.max(0, this.enemiesRemainingThisRound - 1);
      this.showCombatText(`You defeated ${this.enemyLabelFor(this.enemy.kind)}!`);

      this.syncBattlePrompt({
        lastAction: "FIGHT",
        enemyHit: true,
        enemyDead: true,
        keepOpen: true,
      });

      this.time.delayedCall(650, () => {
        this.killEnemy();
        this.inBattleEncounter = false;
        this.battleJustStarted = false;

        if (useGameStore.getState().mode === "TRAINING" && this.enemiesRemainingThisRound > 0) {
          this.spawnNextEnemyForCurrentRound();
        }

        this.syncBattlePrompt();
        this.render();
      });

      return;
    }

    this.showCombatText(`You hit ${this.enemyLabelFor(this.enemy.kind)} for ${dmg}`);
    this.syncBattlePrompt({
      lastAction: "FIGHT",
      enemyHit: true,
      enemyDead: false,
      keepOpen: true,
    });
  }

  private runAway() {
    if (!this.enemyAlive()) {
      this.heroWanderOneStep();
      this.showCombatText("You ran away!");
      return;
    }
  
    const candidates = [
      { action: "UP" as Action, ...this.actionToDelta("UP") },
      { action: "DOWN" as Action, ...this.actionToDelta("DOWN") },
      { action: "LEFT" as Action, ...this.actionToDelta("LEFT") },
      { action: "RIGHT" as Action, ...this.actionToDelta("RIGHT") },
    ]
      .map((m) => {
        const nx = this.hero.x + m.dx;
        const ny = this.hero.y + m.dy;
        const dist = this.manhattan(nx, ny, this.enemy.x, this.enemy.y);
        return { ...m, nx, ny, dist };
      })
      .filter(
        (m) =>
          this.isWalkable(m.nx, m.ny) &&
          !(m.nx === this.enemy.x && m.ny === this.enemy.y)
      )
      .sort((a, b) => b.dist - a.dist);
  
    if (candidates.length > 0) {
      this.hero.x = candidates[0].nx;
      this.hero.y = candidates[0].ny;
      this.inBattleEncounter = false;
      this.battleJustStarted = false;
      this.showCombatText("You ran away!");
      return;
    }
  
    this.showCombatText("No path to run!");
  }

  private chooseLegalAction(probs: Record<string, number>, confidence = 0): Action {
  const adjusted = {} as Record<Action, number>;

  for (const a of ACTIONS) {
    adjusted[a] = probs[a] ?? 0;
  }

  const adjacent =
    this.enemyAlive() &&
    this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y) <= 1;

  const moveActions: Action[] = ["UP", "DOWN", "LEFT", "RIGHT"];

  const legalMoves = moveActions.filter((action) => {
    const { dx, dy } = this.actionToDelta(action);
    const nx = this.hero.x + dx;
    const ny = this.hero.y + dy;
    return this.isWalkable(nx, ny);
  });

  if (this.lastAiAction) {
    const reverse = this.reverseOf(this.lastAiAction);
    if (reverse) adjusted[reverse] *= 0.15;
  }

  if (this.isPositionLooping()) {
    for (const a of moveActions) {
      adjusted[a] *= 0.12;
    }

    if (this.lastAiAction && moveActions.includes(this.lastAiAction)) {
      adjusted[this.lastAiAction] *= 0.35;
    }
  }

  if (this.enemyAlive()) {
    const dist = this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y);

    if (adjacent) {
      adjusted["FIGHT"] = Math.max(adjusted["FIGHT"], 1.4);
      adjusted["RUN"] *= 0.75;
    } else if (dist <= 3 && !this.inBattleEncounter) {
      adjusted["RUN"] = Math.max(adjusted["RUN"], adjusted["RUN"] * 1.1);
    }
  }

  if (this.hero.hp <= 2 && this.healCooldown <= 0) {
    adjusted["HEAL"] = Math.max(adjusted["HEAL"], 0.9);
  }

  const legal: { action: Action; score: number }[] = [];

  for (const action of ACTIONS) {
    if (action === "FIGHT" && !adjacent) continue;

    if (action === "HEAL") {
      if (this.healCooldown > 0) continue;
      if (this.hero.hp >= HERO_MAX_HP) continue;
      legal.push({ action, score: adjusted[action] });
      continue;
    }

    if (action === "HIDE") {
      if (this.hiddenTurns > 0) continue;
      legal.push({ action, score: adjusted[action] });
      continue;
    }

    if (action === "RUN") {
      if (!this.enemyAlive()) continue;
      legal.push({ action, score: adjusted[action] });
      continue;
    }

    if (action === "UP" || action === "DOWN" || action === "LEFT" || action === "RIGHT") {
      if (this.inBattleEncounter) continue;

      const { dx, dy } = this.actionToDelta(action);
      const nx = this.hero.x + dx;
      const ny = this.hero.y + dy;

      if (!this.isWalkable(nx, ny)) continue;

      let score = adjusted[action];

      if (this.enemyAlive()) {
        const currentDist = this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y);
        const nextDist = this.manhattan(nx, ny, this.enemy.x, this.enemy.y);

        if (currentDist <= 3) {
          if (nextDist < currentDist) score *= 0.55;
          if (nextDist > currentDist) score *= 1.15;
        }
      }

      if (this.recentHeroPositions.some((p) => p.x === nx && p.y === ny)) {
        score *= 0.2;
      }

      if (this.lastAiAction === action) {
        score *= 0.65;
      }

      legal.push({ action, score });
      continue;
    }

    if (action === "WAIT") {
      let score = adjusted[action] ?? 0;
      if (legalMoves.length > 0) score *= 0.15;
      legal.push({ action, score });
    }
  }

  if (legal.length === 0) {
    if (adjacent) return "FIGHT";
    return "WAIT";
  }

  const positive = legal.filter((x) => x.score > 0);

  if (positive.length === 0) {
    if (adjacent) return "FIGHT";

    const movementFallback = legal.filter(
      (x) =>
        x.action === "UP" ||
        x.action === "DOWN" ||
        x.action === "LEFT" ||
        x.action === "RIGHT"
    );

    if (movementFallback.length > 0) {
      movementFallback.sort((a, b) => Math.random() - 0.5);
      return movementFallback[0].action;
    }

    return "WAIT";
  }

  positive.sort((a, b) => b.score - a.score);

  if (adjacent && positive.some((x) => x.action === "FIGHT")) {
    const fightOption = positive.find((x) => x.action === "FIGHT");
    if (fightOption && fightOption.score >= positive[0].score * 0.7) {
      return "FIGHT";
    }
  }

  return positive[0].action;
}

  private killEnemy() {
    if (this.enemy.x >= 0 && this.enemy.y >= 0) {
      this.grid[this.enemy.y][this.enemy.x] = 0;
    }
    this.enemy.x = -999;
    this.enemy.y = -999;
    this.enemy.hp = 0;
  }

  private enemyAlive() {
    return this.enemy.x >= 0 && this.enemy.y >= 0 && this.enemy.hp > 0;
  }

  private publishStateAndPrediction() {
    const store = useGameStore.getState();
    const enemyHp01 = this.enemyAlive() ? Math.min(1, this.enemy.hp / this.enemy.maxHp) : 0;
    const heroHp01 = Math.min(1, this.hero.hp / HERO_MAX_HP);

    const stateVec = encodeNeighborhood(
      this.grid,
      this.hero.x,
      this.hero.y,
      heroHp01,
      this.healCooldown,
      this.hiddenTurns,
      enemyHp01
    );

    store.setCurrentState(stateVec);

    const pred = knnPredict(stateVec, store.examples, 7);
    store.setPrediction(pred);
  }

  private render() {
    this.graphics.clear();

    const tile = this.getTileSize();
    const { ox, oy } = this.getGridOrigin(tile);

    const centerOf = (x: number, y: number) => ({
      px: ox + x * tile + tile / 2,
      py: oy + y * tile + tile / 2,
    });

    this.healthBarSprite.setTexture(this.healthTextureFor(this.hero.hp));

    const topY = Math.max(8, oy - 54);
    const centerX = ox + (tile * W) / 2;

    const targetWidth = tile * 4.2;
    const naturalWidth = this.healthBarSprite.texture.getSourceImage().width;
    const scale = targetWidth / naturalWidth;

    this.healthBarSprite.setPosition(centerX, topY);
    this.healthBarSprite.setScale(scale);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = this.grid[y][x];
        const fill = t === 1 ? 0x24314f : t === 3 ? 0x2f9e44 : 0x111827;

        this.graphics.fillStyle(fill, 1);
        this.graphics.fillRect(ox + x * tile, oy + y * tile, tile - 1, tile - 1);
      }
    }

    const heroPos = centerOf(this.hero.x, this.hero.y);
    this.heroSprite.setVisible(true);
    this.heroSprite.setPosition(heroPos.px, heroPos.py);
    this.heroSprite.setDisplaySize(tile * 0.8, tile * 0.8);

    if (this.enemyAlive()) {
      const enemyPos = centerOf(this.enemy.x, this.enemy.y);
      this.enemySprite.setVisible(true);
      this.enemySprite.setTexture(this.enemyTextureFor(this.enemy.kind));
      this.enemySprite.setPosition(enemyPos.px, enemyPos.py);
      this.enemySprite.setDisplaySize(tile * 0.8, tile * 0.8);
    } else {
      this.enemySprite.setVisible(false);
    }

    const goalPos = centerOf(this.goal.x, this.goal.y);
    this.graphics.lineStyle(Math.max(2, Math.floor(tile * 0.08)), 0xfbbf24, 1);
    this.graphics.strokeCircle(goalPos.px, goalPos.py, tile * 0.28);
    this.graphics.lineStyle(Math.max(2, Math.floor(tile * 0.05)), 0xf59e0b, 1);
    this.graphics.strokeCircle(goalPos.px, goalPos.py, tile * 0.16);

    if (this.hiddenTurns > 0) {
      this.graphics.lineStyle(Math.max(2, Math.floor(tile * 0.08)), 0x9ca3af, 1);
      this.graphics.strokeCircle(heroPos.px, heroPos.py, tile / 2);
    }

    const st = useGameStore.getState();
    if (st.mode === "TRAINING") {
      const shownRound = Math.min(
        this.trainingRoundsCompleted + 1,
        TRAINING_ROUNDS_BEFORE_AI_RUN
      );
    
      this.text.setText(
        `${this.trainingRoundLabel(shownRound)}`
      );
      this.text.setVisible(true);
    } else {
      this.text.setText("");
      this.text.setVisible(false);
    }

    this.text.setPosition(ox + Math.max(8, tile * 0.3), Math.max(10, oy - 34));
    this.combatText.setPosition(ox + Math.max(40, tile * 2), oy + 8);
  }

  private placeEnemyOnGrid(
    g: Tile[][],
    x: number,
    y: number,
    kind: EnemyKind,
    hp?: number,
    damage?: number,
    hitChance?: number
  ) {
    this.enemy.x = x;
    this.enemy.y = y;
    this.enemy.kind = kind;

    const stats = this.enemyStatsFor(kind);
    this.enemy.maxHp = hp ?? stats.maxHp;
    this.enemy.hp = this.enemy.maxHp;
    this.enemy.damage = damage ?? stats.damage;
    this.enemy.hitChance = hitChance ?? stats.hitChance;

    g[y][x] = 2;
  }

  private enemyWander() {
    if (!this.enemyAlive()) return;

    this.grid[this.enemy.y][this.enemy.x] = 0;

    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    Phaser.Utils.Array.Shuffle(dirs);

    for (const d of dirs) {
      const nx = this.enemy.x + d.dx;
      const ny = this.enemy.y + d.dy;

      if (
        this.isWalkable(nx, ny) &&
        !(nx === this.goal.x && ny === this.goal.y) &&
        !(nx === this.hero.x && ny === this.hero.y)
      ) {
        this.enemy.x = nx;
        this.enemy.y = ny;
        break;
      }
    }

    this.grid[this.enemy.y][this.enemy.x] = 2;
  }

  private enemyChase() {
    if (!this.enemyAlive()) return;

    this.grid[this.enemy.y][this.enemy.x] = 0;

    const dx = Math.sign(this.hero.x - this.enemy.x);
    const dy = Math.sign(this.hero.y - this.enemy.y);

    const tryMove = (nx: number, ny: number) => {
      if (!this.isWalkable(nx, ny)) return false;
      if (nx === this.hero.x && ny === this.hero.y) return false;
      this.enemy.x = nx;
      this.enemy.y = ny;
      return true;
    };

    const options =
      Math.abs(dx) >= Math.abs(dy)
        ? [{ dx, dy: 0 }, { dx: 0, dy }]
        : [{ dx: 0, dy }, { dx, dy: 0 }];

    for (const option of options) {
      if ((option.dx !== 0 || option.dy !== 0) &&
        tryMove(this.enemy.x + option.dx, this.enemy.y + option.dy)) {
        break;
      }
    }

    this.grid[this.enemy.y][this.enemy.x] = 2;
  }

  private heroWanderOneStep() {
    const moves: Action[] = ["UP", "DOWN", "LEFT", "RIGHT"];
    Phaser.Utils.Array.Shuffle(moves);

    for (const m of moves) {
      const { dx, dy } = this.actionToDelta(m);
      const nx = this.hero.x + dx;
      const ny = this.hero.y + dy;

      if (this.isWalkable(nx, ny)) {
        this.hero.x = nx;
        this.hero.y = ny;
        return;
      }
    }
  }

  private isWalkable(x: number, y: number) {
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    return this.grid[y][x] !== 1;
  }

  private hasLineOfSight(x1: number, y1: number, x2: number, y2: number) {
    let x = x1;
    let y = y1;

    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);

    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;

    let err = dx - dy;

    while (!(x === x2 && y === y2)) {
      if (!(x === x1 && y === y1) && !(x === x2 && y === y2)) {
        if (x < 0 || x >= W || y < 0 || y >= H) return false;
        if (this.grid[y][x] === 1) return false;
      }

      const e2 = err * 2;

      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }

      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return true;
  }

  private canEnemySeeHero(range = 5) {
    if (!this.enemyAlive()) return false;

    const dist = this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y);
    if (dist > range) return false;

    return this.hasLineOfSight(this.enemy.x, this.enemy.y, this.hero.x, this.hero.y);
  }

  private actionToDelta(a: Action) {
    switch (a) {
      case "UP":
        return { dx: 0, dy: -1 };
      case "DOWN":
        return { dx: 0, dy: 1 };
      case "LEFT":
        return { dx: -1, dy: 0 };
      case "RIGHT":
        return { dx: 1, dy: 0 };
      default:
        return { dx: 0, dy: 0 };
    }
  }

  private manhattan(x1: number, y1: number, x2: number, y2: number) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
}