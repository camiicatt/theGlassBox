import Phaser from "phaser";
import { encodeNeighborhood, type Tile } from "../../game/stateEncoding";
import { knnPredict } from "../../ai/knn";
import { useGameStore } from "../../app/store/useGameStore";
import type { Action } from "../../app/store/useGameStore";
import { ACTIONS } from "../../game/actions";
import {
  closeRun,
  createAiStats,
  createDungeon,
  logAction,
  updateAiStats,
  updatePlayerStats,
} from "../../lib/supabaseLogger";

const W = 12;
const H = 12;
const HERO_MAX_HP = 5;

const HEAL_AMOUNT = 2;
const HEAL_COOLDOWN_TURNS = 2;

function uid() {
  return Math.random().toString(16).slice(2);
}

type EnemyKind = "slime" | "bigSlime" | "spider";

type Enemy = {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  kind: EnemyKind;
  damage: number;
  hitChance: number;
  skipTurns: number;
};

type DungeonTemplate = {
  map: string[];
  minStage: number;
  maxStage: number;
};

type StagePlan = {
  label: string;
  enemyCount: number;
  enemyKinds: EnemyKind[];
};

export default class DungeonScene extends Phaser.Scene {
  private grid!: Tile[][];
  private hero = { x: 1, y: 1, hp: HERO_MAX_HP };
  private goal = { x: 10, y: 10 };

  private enemies: Enemy[] = [];
  private activeEnemyId: string | null = null;

  private graphics!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;
  private combatText!: Phaser.GameObjects.Text;
  private healthBarSprite!: Phaser.GameObjects.Image;

  private heroSprite!: Phaser.GameObjects.Image;
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();

  private lastStepAt = 0;
  private healCooldown = 0;
  private hiddenTurns = 0;
  private invulnTurns = 0;
  private lastRestartToken = 0;
  private initialDungeonCreated = false;
  private dungeonNum = 0;   // increments each new dungeon, resets per run
  private actionNum = 0;    // increments each battle action, resets per dungeon
  private inBattleEncounter = false;
  private battleJustStarted = false;
  private combatMessage = "";
  private stageIndex = 0;

  private lastAiAction: Action | null = null;
  private recentHeroPositions: { x: number; y: number }[] = [];

  private stagePlans: StagePlan[] = [
    {
      label: "Stage 1: Learn with one monster",
      enemyCount: 1,
      enemyKinds: ["slime"],
    },
    {
      label: "Stage 2: One monster, a little harder",
      enemyCount: 1,
      enemyKinds: ["slime"],
    },
    {
      label: "Stage 3: Still one monster, more obstacles",
      enemyCount: 1,
      enemyKinds: ["slime"],
    },
    {
      label: "Stage 4: Two monsters",
      enemyCount: 2,
      enemyKinds: ["slime", "slime"],
    },
    {
      label: "Stage 5: Mixed threats",
      enemyCount: 2,
      enemyKinds: ["slime", "spider"],
    },
    {
      label: "Stage 6: Three monsters",
      enemyCount: 3,
      enemyKinds: ["slime", "spider", "bigSlime"],
    },
  ];

  private dungeonTemplates: DungeonTemplate[] = [
    {
      minStage: 0,
      maxStage: 0,
      map: [
        "############",
        "#S........G#",
        "#..........#",
        "#..........#",
        "#....E.....#",
        "#..........#",
        "#..........#",
        "#..........#",
        "#..........#",
        "#..........#",
        "#..........#",
        "############",
      ],
    },
    {
      minStage: 1,
      maxStage: 1,
      map: [
        "############",
        "#S.....#..G#",
        "#......#...#",
        "#......#...#",
        "#...E..#...#",
        "#..........#",
        "#..........#",
        "#..........#",
        "#..........#",
        "#..........#",
        "#..........#",
        "############",
      ],
    },
    {
      minStage: 2,
      maxStage: 2,
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
      minStage: 3,
      maxStage: 4,
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
      minStage: 5,
      maxStage: 99,
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
  ];

  private aiPreviewLocked = false;
  private aiPreviewAction: Action | null = null;
  private aiPreviewThinking = false;
  private aiPreviewUntil = 0;
  private aiPreviewProbs: Partial<Record<Action, number>> = {};
  private aiPreviewConfidence = 0;

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

    this.combatText = this.add.text(0, 0, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "20px",
      color: "#fff7ed",
      align: "center",
      backgroundColor: "#7c2d12",
      padding: { left: 18, right: 18, top: 10, bottom: 10 },
      wordWrap: { width: 320 },
      stroke: "#431407",
      strokeThickness: 4,
    })
      .setDepth(40)
      .setVisible(false)
      .setOrigin(0.5, 0);

      this.healthBarSprite = this.add
      .image(this.scale.width / 2, 6, "health5")
      .setOrigin(0.5, 0)
      .setDepth(20)
      .setScrollFactor(0);

    this.heroSprite = this.add.image(0, 0, "hero").setDepth(20).setOrigin(0.5);

    this.grid = this.makeTemplateDungeon();
    this.resetAiMemory();
    useGameStore.getState().setBattleLog("");

    this.setupControls();
    this.publishStateAndPrediction();
    this.rememberHeroPosition();
    this.syncBattlePrompt();
    this.render();
  }

  update(time: number) {
    const st = useGameStore.getState();
    const choice = st.pendingAction;

    // Create the first dungeon row once the player stats ID arrives from NamePage
    if (!this.initialDungeonCreated && st.supabasePlayerStatsId !== null && st.supabaseDungeonId === null) {
      this.initialDungeonCreated = true;
      this.dungeonNum += 1;
      this.actionNum = 0;
      createDungeon({ playerId: st.supabasePlayerStatsId, num: this.dungeonNum }).then((dungeonId) => {
        useGameStore.getState().setSupabaseDungeonId(dungeonId);
      }).catch(() => {});
    }

    if (st.restartToken !== this.lastRestartToken) {
      this.lastRestartToken = st.restartToken;
      this.fullReset();
      return;
    }
  
    if (choice) {
      st.setPendingAction(null);
      this.step(choice, true);
      return;
    }
  
    if (st.mode !== "AI_RUN") return;
    if (time < this.aiPreviewUntil) return;
    if (this.aiPreviewLocked) return;
    if (time - this.lastStepAt < 220) return;
  
    this.lastStepAt = time;
  
    const stateVec = st.currentState;
    if (!stateVec) return;
  
    const pred = knnPredict(stateVec, st.examples, 7);
    st.setPrediction(pred);
  
    const chosen = this.chooseLegalAction(pred.probs, pred.confidence);
  
    if (this.inBattleEncounter && this.getActiveEnemy()) {
      this.startAiBattlePreview(chosen, pred.probs as Partial<Record<Action, number>>, pred.confidence);
      return;
    }
  
    this.lastAiAction = chosen;
    this.step(chosen, false);
  }

  private startAiBattlePreview(
    action: Action,
    probs: Partial<Record<Action, number>>,
    confidence: number
  ) {
    this.aiPreviewLocked = true;
    this.aiPreviewThinking = true;
    this.aiPreviewAction = null;
    this.aiPreviewProbs = probs;
    this.aiPreviewConfidence = confidence;
  
    this.showCombatText("The AI is thinking...", "info");
    this.syncBattlePrompt({ keepOpen: true });
    this.render();
  
    this.aiPreviewUntil = this.time.now + 900;
  
    this.time.delayedCall(900, () => {
      this.aiPreviewThinking = false;
      this.aiPreviewAction = action;
  
      this.showCombatText(`The AI chose ${action}.`, "info");
      this.syncBattlePrompt({ keepOpen: true });
      this.render();
  
      this.aiPreviewUntil = this.time.now + 700;
  
      this.time.delayedCall(700, () => {
        this.lastAiAction = action;
        this.step(action, false);
  
        this.aiPreviewUntil = this.time.now + 450;
  
        this.time.delayedCall(450, () => {
          this.aiPreviewLocked = false;
          this.aiPreviewThinking = false;
          this.aiPreviewAction = null;
          this.aiPreviewProbs = {};
          this.aiPreviewConfidence = 0;
          this.syncBattlePrompt();
          this.render();
        });
      });
    });
  }
  
  private resetAiPreview() {
    this.aiPreviewLocked = false;
    this.aiPreviewAction = null;
    this.aiPreviewThinking = false;
    this.aiPreviewUntil = 0;
    this.aiPreviewProbs = {};
    this.aiPreviewConfidence = 0;
  }

  private setupControls() {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const st = useGameStore.getState();
      if (st.mode !== "TRAINING") return;
      if (st.heroDead) return;

      const key = event.key.toLowerCase();

      if (key === "arrowup" || key === "w") this.tryManualAction("UP");
      else if (key === "arrowdown" || key === "s") this.tryManualAction("DOWN");
      else if (key === "arrowleft" || key === "a") this.tryManualAction("LEFT");
      else if (key === "arrowright" || key === "d") this.tryManualAction("RIGHT");
    });
  }

  private fullReset() {
    const st = useGameStore.getState();

    this.hero.hp = HERO_MAX_HP;
    this.stageIndex = 0;
    this.grid = this.makeTemplateDungeon();

    this.healCooldown = 0;
    this.hiddenTurns = 0;
    this.invulnTurns = 0;
    this.inBattleEncounter = false;
    this.battleJustStarted = false;
    this.activeEnemyId = null;
    this.clearCombatText();

    this.resetAiMemory();
    this.resetAiPreview();

    st.setHeroDead(false);
    st.setBattleLog("");
    st.closeBattlePrompt?.();

    // Let update() create the dungeon once supabasePlayerStatsId is ready
    this.initialDungeonCreated = false;
    this.dungeonNum = 0;
    this.actionNum = 0;

    this.publishStateAndPrediction();
    this.rememberHeroPosition();
    this.syncBattlePrompt();
    this.render();
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

  private currentStagePlan() {
    return this.stagePlans[Math.min(this.stageIndex, this.stagePlans.length - 1)];
  }

  private stageLabel() {
    return this.currentStagePlan().label;
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

  private combatTextTimer?: Phaser.Time.TimerEvent;

  private showCombatText(
    message: string,
    tone: "danger" | "success" | "info" | "warning" = "info"
  ) {
    this.combatMessage = message;
    useGameStore.getState().setBattleLog(message);
  
    const styles = {
      danger: { bg: "#7f1d1d", color: "#f8fafc", stroke: "#450a0a" },
      success: { bg: "#166534", color: "#f0fdf4", stroke: "#14532d" },
      info: { bg: "#1d4ed8", color: "#eff6ff", stroke: "#1e3a8a" },
      warning: { bg: "#92400e", color: "#fffbeb", stroke: "#78350f" },
    };
  
    const style = styles[tone];
  
    this.combatText.setStyle({
      backgroundColor: style.bg,
      color: style.color,
      stroke: style.stroke,
      strokeThickness: 4,
    });
  
    this.combatText.setText(message);
    this.combatText.setVisible(true);
  
    if (this.combatTextTimer) {
      this.combatTextTimer.remove(false);
    }
  
    this.combatTextTimer = this.time.delayedCall(1600, () => {
      if (this.combatMessage === message) {
        this.clearCombatText();
        this.render();
      }
    });
  }

  private clearCombatText() {
    this.combatMessage = "";
    this.combatText.setText("");
    this.combatText.setVisible(false);
  
    if (this.combatTextTimer) {
      this.combatTextTimer.remove(false);
      this.combatTextTimer = undefined;
    }
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

  private enemyPlanForKind(kind: EnemyKind) {
    switch (kind) {
      case "bigSlime":
        return { kind, hp: 4, damage: 1, hitChance: 0.65 };
      case "spider":
        return { kind, hp: 3, damage: 1, hitChance: 0.72 };
      case "slime":
      default:
        return { kind, hp: 2, damage: 1, hitChance: 0.7 };
    }
  }

  private makeTemplateDungeon(): Tile[][] {
    const candidates = this.dungeonTemplates.filter(
      (t) => this.stageIndex >= t.minStage && this.stageIndex <= t.maxStage
    );

    const template =
      candidates.length > 0
        ? Phaser.Utils.Array.GetRandom(candidates)
        : Phaser.Utils.Array.GetRandom(this.dungeonTemplates);

    this.resetAiPreview();

    return this.makeDungeonFromTemplate(template);
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

    this.enemies = [];
    this.activeEnemyId = null;

    const stage = this.currentStagePlan();

    for (let i = 0; i < stage.enemyCount; i++) {
      const kind = stage.enemyKinds[Math.min(i, stage.enemyKinds.length - 1)];
      const stats = this.enemyPlanForKind(kind);

      if (i === 0) {
        this.placeEnemyOnGrid(
          g,
          enemySpawn.x,
          enemySpawn.y,
          stats.kind,
          stats.hp,
          stats.damage,
          stats.hitChance
        );
      } else {
        this.spawnExtraEnemyOnGrid(
          g,
          stats.kind,
          stats.hp,
          stats.damage,
          stats.hitChance
        );
      }
    }

    this.healCooldown = 0;
    this.hiddenTurns = 0;
    this.invulnTurns = 0;
    this.inBattleEncounter = false;
    this.battleJustStarted = false;
    this.clearCombatText();

    return g;
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
    const base = this.enemyPlanForKind(kind);

    const enemy: Enemy = {
      id: uid(),
      x,
      y,
      kind,
      maxHp: hp ?? base.hp,
      hp: hp ?? base.hp,
      damage: damage ?? base.damage,
      hitChance: hitChance ?? base.hitChance,
      skipTurns: 1,
    };

    this.enemies.push(enemy);
    g[y][x] = 2;
  }

  private spawnExtraEnemyOnGrid(
    g: Tile[][],
    kind: EnemyKind,
    hp?: number,
    damage?: number,
    hitChance?: number
  ) {
    const candidates: { x: number; y: number }[] = [];

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (!this.isWalkable(x, y)) continue;
        if (g[y][x] !== 0) continue;
        if (x === this.hero.x && y === this.hero.y) continue;
        if (x === this.goal.x && y === this.goal.y) continue;
        if (this.manhattan(x, y, this.hero.x, this.hero.y) < 4) continue;
        candidates.push({ x, y });
      }
    }

    if (candidates.length === 0) return;

    const spawn = Phaser.Utils.Array.GetRandom(candidates);
    this.placeEnemyOnGrid(g, spawn.x, spawn.y, kind, hp, damage, hitChance);
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

  private getLivingEnemies() {
    return this.enemies.filter((e) => e.hp > 0);
  }

  private getActiveEnemy() {
    if (!this.activeEnemyId) return null;
    return this.enemies.find((e) => e.id === this.activeEnemyId) ?? null;
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
    const enemy = this.getActiveEnemy();

    const allowPromptInTraining = st.mode === "TRAINING";
    const allowPromptInAi =
      st.mode === "AI_RUN" && !!enemy && (this.inBattleEncounter || this.aiPreviewLocked);

    const shouldAllowPrompt = allowPromptInTraining || allowPromptInAi;

    if (!shouldAllowPrompt) {
      st.closeBattlePrompt?.();
      st.setBattleLog(this.combatMessage || "");
      return;
    }

    const shouldStayOpen =
      !!enemy &&
      ((this.inBattleEncounter && !!enemy) || extras?.keepOpen || this.aiPreviewLocked);

    if (!shouldStayOpen || !enemy) {
      st.closeBattlePrompt?.();
      st.setBattleLog(this.combatMessage || "");
      return;
    }

    st.openBattlePrompt?.({
      enemyName: this.enemyLabelFor(enemy.kind),
      enemyKind: enemy.kind,
      enemySprite: this.enemyTextureFor(enemy.kind),
      heroSprite: "hero",
      enemyHp: Math.max(0, enemy.hp),
      enemyMaxHp: enemy.maxHp,
      heroHp: this.hero.hp,
      heroMaxHp: HERO_MAX_HP,
      lastAction: extras?.lastAction ?? null,
      heroHit: extras?.heroHit ?? false,
      enemyHit: extras?.enemyHit ?? false,
      heroDead: extras?.heroDead ?? false,
      enemyDead: extras?.enemyDead ?? false,
      aiMode: st.mode === "AI_RUN",
      aiThinking: this.aiPreviewThinking,
      aiChosenAction: this.aiPreviewAction,
      aiConfidence: this.aiPreviewConfidence,
      aiProbs: this.aiPreviewProbs,
    });

    st.setBattleLog(this.combatMessage || "");
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

    if (!this.inBattleEncounter && isBattleAction && this.getLivingEnemies().length === 0) {
      if (action !== "HEAL" && action !== "HIDE") {
        this.showCombatText("There is no enemy to battle.");
        this.render();
        return;
      }
    }

    if (isBattleAction && st.supabaseDungeonId !== null) {
      const enemy = this.getActiveEnemy();
      this.actionNum += 1;
      logAction(
        st.supabaseDungeonId,
        { fight: action === "FIGHT", hide: action === "HIDE", heal: action === "HEAL", run: action === "RUN" },
        this.hero.hp,
        enemy?.hp ?? 0,
        this.actionNum
      ).catch(() => {});
      if (st.mode === "TRAINING") {
        st.incrementPlayerStat("numActions");
        st.incrementPlayerStat(
          action === "FIGHT" ? "numFight" : action === "HIDE" ? "numHide" : action === "HEAL" ? "numHeal" : "numRun"
        );
      } else {
        st.incrementAiStat("numActions");
        st.incrementAiStat(
          action === "FIGHT" ? "numFight" : action === "HIDE" ? "numHide" : action === "HEAL" ? "numHeal" : "numRun"
        );
      }
    }

    this.applyGeneralAction(action);

    if (action === "FIGHT" || action === "ATTACK") {
      this.attackEnemyIfAdjacent();
    } else if (action === "RUN") {
      this.runAway();
    } else if (isMoveAction) {
      const { dx, dy } = this.actionToDelta(action);
      const nx = this.hero.x + dx;
      const ny = this.hero.y + dy;

      if (this.isWalkable(nx, ny) && !this.isEnemyAt(nx, ny)) {
        this.hero.x = nx;
        this.hero.y = ny;

        const nearby = this.findEncounterEnemyNearHero();
        if (nearby) {
          this.activeEnemyId = nearby.id;
          this.inBattleEncounter = true;
          this.battleJustStarted = true;
          this.showCombatText(`Encounter! ${this.enemyLabelFor(nearby.kind)} blocks your path.`);
        } else {
          this.clearCombatText();
        }
      } else {
        this.showCombatText("That way is blocked.", "warning");
      }
    }

    this.endOfTurn();
    this.syncBattlePrompt();
  }

  private endOfTurn() {
    if (this.healCooldown > 0) this.healCooldown--;
    if (this.hiddenTurns > 0) this.hiddenTurns--;
    if (this.invulnTurns > 0) this.invulnTurns--;

    for (const enemy of this.getLivingEnemies()) {
      if (this.inBattleEncounter && enemy.id !== this.activeEnemyId) {
        continue;
      }

      if (!this.inBattleEncounter) {
        if (enemy.skipTurns > 0) {
          enemy.skipTurns--;
          continue;
        }

        if (this.hiddenTurns > 0) {
          this.enemyWander(enemy);
        } else if (this.canEnemySeeHero(enemy, 5)) {
          this.enemyChase(enemy);
        } else {
          this.enemyWander(enemy);
        }
      }
    }

    const nearby = this.findEncounterEnemyNearHero();
    if (nearby && !this.inBattleEncounter) {
      this.activeEnemyId = nearby.id;
      this.inBattleEncounter = true;
      this.battleJustStarted = true;
      this.showCombatText(`Encounter! ${this.enemyLabelFor(nearby.kind)} spotted you.`);
    }

    const activeEnemy = this.getActiveEnemy();

    if (this.inBattleEncounter && activeEnemy) {
      if (this.battleJustStarted) {
        this.battleJustStarted = false;
      } else if (this.invulnTurns === 0) {
        const didHit = Math.random() < activeEnemy.hitChance;

        if (didHit) {
          this.hero.hp = Math.max(0, this.hero.hp - activeEnemy.damage);
          this.showCombatText(`${this.enemyLabelFor(activeEnemy.kind)} hits for ${activeEnemy.damage} HP`, "danger");

          this.syncBattlePrompt({
            lastAction: "FIGHT",
            heroHit: true,
            heroDead: this.hero.hp <= 0,
            keepOpen: true,
          });
        } else {
          this.showCombatText(`${this.enemyLabelFor(activeEnemy.kind)} missed!`);
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
        st.setMode("AI_RUN");
        this.showCombatText(`${this.stageLabel()} training complete. Now the AI tries.`);
        // Create AI stats row now that we know the run id, then create the AI's dungeon
        if (st.supabaseRunId !== null) {
          createAiStats(st.supabaseRunId).then((aiId) => {
            if (aiId !== null) {
              useGameStore.getState().setSupabaseAiStatsId(aiId);
              this.dungeonNum += 1;
              this.actionNum = 0;
              createDungeon({ aiId, num: this.dungeonNum }).then((dungeonId) => {
                useGameStore.getState().setSupabaseDungeonId(dungeonId);
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      } else {
        st.setMode("TRAINING");
        this.stageIndex += 1;
        this.showCombatText("The next round is harder.");
        // New training dungeon linked to the existing player stats row
        if (st.supabasePlayerStatsId !== null) {
          this.dungeonNum += 1;
          this.actionNum = 0;
          createDungeon({ playerId: st.supabasePlayerStatsId, num: this.dungeonNum }).then((dungeonId) => {
            useGameStore.getState().setSupabaseDungeonId(dungeonId);
          }).catch(() => {});
        }
      }
      
      this.grid = this.makeTemplateDungeon();
      this.healCooldown = 0;
      this.hiddenTurns = 0;
      this.invulnTurns = 0;
      this.inBattleEncounter = false;
      this.battleJustStarted = false;
      this.activeEnemyId = null;
      this.resetAiMemory();
      this.resetAiPreview();
      this.rememberHeroPosition();

    }

    if (this.hero.hp <= 0) {
      this.hero.hp = 0;
      this.inBattleEncounter = false;
      this.battleJustStarted = false;
      this.activeEnemyId = null;
      this.resetAiPreview();
      st.setBattleLog("");
      st.closeBattlePrompt?.();

      const moment = {
        id: uid(),
        state: st.currentState ? st.currentState.slice() : [],
        confidence: st.prediction?.confidence ?? 0,
        aiChose: st.prediction?.bestAction ?? "WAIT",
      };

      st.setReviewMoments([...st.reviewMoments, moment]);
      st.setMode("REVIEW");

      if (st.supabaseRunId !== null && st.runStartTime !== null) {
        const p = st.playerRunStats;
        const a = st.aiRunStats;
        const pId = st.supabasePlayerStatsId;
        const aId = st.supabaseAiStatsId;
        const runId = st.supabaseRunId;
        const runStart = st.runStartTime;
        Promise.all([
          pId !== null ? updatePlayerStats(pId, p) : Promise.resolve(false),
          aId !== null ? updateAiStats(aId, a) : Promise.resolve(false),
        ]).then(() => {
          closeRun(runId, runStart, {
            totalActions: p.numActions + a.numActions,
            totalDungeons: p.numDungeons + a.numDungeons,
            totalScore: 0,
            totalFight: p.numFight + a.numFight,
            totalHide: p.numHide + a.numHide,
            totalHeal: p.numHeal + a.numHeal,
            totalRun: p.numRun + a.numRun,
          }).catch(() => {});
        }).catch(() => {});
        st.resetPlayerRunStats();
        st.resetAiRunStats();
      }

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
      this.syncBattlePrompt({ lastAction: "HEAL", keepOpen: !!this.getActiveEnemy() });
    }

    if (action === "HIDE") {
      this.hiddenTurns = Math.max(this.hiddenTurns, 3);
      this.invulnTurns = Math.max(this.invulnTurns, 1);
      this.inBattleEncounter = false;
      this.battleJustStarted = false;
      this.activeEnemyId = null;
      this.showCombatText("You hide in the shadows");
      this.syncBattlePrompt({ lastAction: "HIDE" });
    }
  }

  private attackEnemyIfAdjacent() {
    const enemy = this.getActiveEnemy();
    if (!enemy) return;

    const distance = this.manhattan(this.hero.x, this.hero.y, enemy.x, enemy.y);
    if (distance > 1) {
      this.showCombatText("You are too far away to fight.");
      this.syncBattlePrompt({ lastAction: "FIGHT", keepOpen: true });
      return;
    }

    const didHit = Math.random() < 0.85;

    if (!didHit) {
      this.showCombatText(`You missed ${this.enemyLabelFor(enemy.kind)}!`);
      this.syncBattlePrompt({
        lastAction: "FIGHT",
        enemyHit: false,
        enemyDead: false,
        keepOpen: true,
      });
      return;
    }

    const dmg = 1;
    enemy.hp -= dmg;

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      this.showCombatText(`You defeated ${this.enemyLabelFor(enemy.kind)}!`, "success");

      this.syncBattlePrompt({
        lastAction: "FIGHT",
        enemyHit: true,
        enemyDead: true,
        keepOpen: true,
      });

      this.time.delayedCall(650, () => {
        this.killEnemy(enemy.id);
        this.inBattleEncounter = false;
        this.battleJustStarted = false;
        this.activeEnemyId = null;

        const nextEnemy = this.findEncounterEnemyNearHero();
        if (nextEnemy) {
          this.activeEnemyId = nextEnemy.id;
          this.inBattleEncounter = true;
          this.battleJustStarted = true;
          this.showCombatText(`Another ${this.enemyLabelFor(nextEnemy.kind)} is nearby!`);
        }

        this.syncBattlePrompt();
        this.render();
      });

      return;
    }

    this.showCombatText(`You hit ${this.enemyLabelFor(enemy.kind)} for ${dmg}`);
    this.syncBattlePrompt({
      lastAction: "FIGHT",
      enemyHit: true,
      enemyDead: false,
      keepOpen: true,
    });
  }

  private runAway() {
    const enemy = this.getActiveEnemy();
  
    if (!enemy) {
      this.inBattleEncounter = false;
      this.battleJustStarted = false;
      this.activeEnemyId = null;
      this.showCombatText("You ran away!");
      this.syncBattlePrompt({ lastAction: "RUN", keepOpen: false });
      return;
    }
  
    const moveOptions: Action[] = ["UP", "DOWN", "LEFT", "RIGHT"];
  
    let moved = 0;
  
    for (let step = 0; step < 2; step++) {
      const candidates = moveOptions
        .map((action) => {
          const { dx, dy } = this.actionToDelta(action);
          const nx = this.hero.x + dx;
          const ny = this.hero.y + dy;
  
          return {
            action,
            nx,
            ny,
            dist: this.manhattan(nx, ny, enemy.x, enemy.y),
          };
        })
        .filter((m) => this.isWalkable(m.nx, m.ny) && !this.isEnemyAt(m.nx, m.ny))
        .sort((a, b) => b.dist - a.dist);
  
      if (candidates.length === 0) break;
  
      const best = candidates[0];
  
      // only take the move if it does not make things worse
      const currentDist = this.manhattan(this.hero.x, this.hero.y, enemy.x, enemy.y);
      if (best.dist < currentDist && moved > 0) break;
  
      this.hero.x = best.nx;
      this.hero.y = best.ny;
      moved++;
    }
  
    this.inBattleEncounter = false;
    this.battleJustStarted = false;
    this.activeEnemyId = null;
  
    if (moved === 0) {
      this.showCombatText("No path to run!");
      this.syncBattlePrompt({ lastAction: "RUN", keepOpen: true });
      return;
    }
  
    this.showCombatText(moved === 2 ? "You ran away!" : "You backed away!");
    this.rememberHeroPosition();
  
    const newEncounter = this.findEncounterEnemyNearHero();
    if (newEncounter) {
      this.activeEnemyId = newEncounter.id;
      this.inBattleEncounter = true;
      this.battleJustStarted = true;
      this.showCombatText(`${this.enemyLabelFor(newEncounter.kind)} caught up to you!`);
      this.syncBattlePrompt({ lastAction: "RUN", keepOpen: true });
      return;
    }
  
    this.syncBattlePrompt({ lastAction: "RUN", keepOpen: false });
  }

  private chooseLegalAction(probs: Record<string, number>, confidence = 0): Action {
    const adjusted = {} as Record<Action, number>;
  
    for (const a of ACTIONS) {
      adjusted[a] = probs[a] ?? 0;
    }
  
    const taughtActions = new Set<Action>(
      useGameStore.getState().examples.map((ex) => ex.action)
    );
  
    const wasTaught = (action: Action) => taughtActions.has(action);
  
    const activeEnemy = this.getActiveEnemy();
    const adjacent =
      !!activeEnemy &&
      this.manhattan(this.hero.x, this.hero.y, activeEnemy.x, activeEnemy.y) <= 1;
  
    const moveActions: Action[] = ["UP", "DOWN", "LEFT", "RIGHT"];
  
    if (this.lastAiAction) {
      const reverse = this.reverseOf(this.lastAiAction);
      if (reverse && wasTaught(reverse)) {
        adjusted[reverse] *= 0.2;
      }
    }
  
    if (this.isPositionLooping()) {
      for (const a of moveActions) {
        if (wasTaught(a)) adjusted[a] *= 0.2;
      }
  
      if (this.lastAiAction && moveActions.includes(this.lastAiAction) && wasTaught(this.lastAiAction)) {
        adjusted[this.lastAiAction] *= 0.4;
      }
    }
  
    const legal: { action: Action; score: number }[] = [];
  
    for (const action of ACTIONS) {
      // hard rule: if it was never taught, the AI cannot use it
      if (!wasTaught(action)) continue;
  
      if (action === "FIGHT" || action === "ATTACK") {
        if (!adjacent) continue;
        legal.push({ action, score: adjusted[action] });
        continue;
      }
  
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
        if (!activeEnemy) continue;
        legal.push({ action, score: adjusted[action] });
        continue;
      }
  
      if (action === "UP" || action === "DOWN" || action === "LEFT" || action === "RIGHT") {
        if (this.inBattleEncounter) continue;
  
        const { dx, dy } = this.actionToDelta(action);
        const nx = this.hero.x + dx;
        const ny = this.hero.y + dy;
  
        if (!this.isWalkable(nx, ny)) continue;
        if (this.isEnemyAt(nx, ny)) continue;
  
        let score = adjusted[action];
  
        if (activeEnemy) {
          const currentDist = this.manhattan(
            this.hero.x,
            this.hero.y,
            activeEnemy.x,
            activeEnemy.y
          );
          const nextDist = this.manhattan(nx, ny, activeEnemy.x, activeEnemy.y);
  
          // mild anti-suicide shaping, but still only using taught actions
          if (currentDist <= 3) {
            if (nextDist < currentDist) score *= 0.7;
            if (nextDist > currentDist) score *= 1.05;
          }
        }
  
        if (this.recentHeroPositions.some((p) => p.x === nx && p.y === ny)) {
          score *= 0.35;
        }
  
        if (this.lastAiAction === action) {
          score *= 0.75;
        }
  
        legal.push({ action, score });
        continue;
      }
  
      if (action === "WAIT") {
        legal.push({ action, score: adjusted[action] });
        continue;
      }
    }
  
    if (legal.length === 0) {
      // strict version: only return something it was actually taught
      if (wasTaught("WAIT")) return "WAIT";
  
      const taughtMoves = moveActions.filter((a) => {
        if (!wasTaught(a)) return false;
        const { dx, dy } = this.actionToDelta(a);
        const nx = this.hero.x + dx;
        const ny = this.hero.y + dy;
        return this.isWalkable(nx, ny) && !this.isEnemyAt(nx, ny);
      });
  
      if (taughtMoves.length > 0) {
        return taughtMoves[Math.floor(Math.random() * taughtMoves.length)];
      }
        return "WAIT";
    }
  
    const positive = legal.filter((x) => x.score > 0);
  
    if (positive.length === 0) {
      legal.sort((a, b) => b.score - a.score);
      return legal[0].action;
    }
  
    positive.sort((a, b) => b.score - a.score);
    return positive[0].action;
  }

  private killEnemy(enemyId: string) {
    const enemy = this.enemies.find((e) => e.id === enemyId);
    if (!enemy) return;

    if (enemy.x >= 0 && enemy.y >= 0) {
      this.grid[enemy.y][enemy.x] = 0;
    }

    const sprite = this.enemySprites.get(enemyId);
    if (sprite) {
      sprite.destroy();
      this.enemySprites.delete(enemyId);
    }

    this.enemies = this.enemies.filter((e) => e.id !== enemyId);
  }

  private publishStateAndPrediction() {
    const store = useGameStore.getState();
    const activeEnemy = this.getActiveEnemy();
    const enemyHp01 = activeEnemy ? Math.min(1, activeEnemy.hp / activeEnemy.maxHp) : 0;
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

    const centerX = this.scale.width / 2;
    const topY = 0;
    const targetWidth = tile * 4.2;
    const naturalWidth = this.healthBarSprite.texture.getSourceImage().width;
    const scale = targetWidth / naturalWidth;
    
    this.healthBarSprite.setOrigin(0.5, 0);
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

    const livingIds = new Set(this.getLivingEnemies().map((e) => e.id));

    for (const enemy of this.getLivingEnemies()) {
      let sprite = this.enemySprites.get(enemy.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, this.enemyTextureFor(enemy.kind)).setDepth(20).setOrigin(0.5);
        this.enemySprites.set(enemy.id, sprite);
      }

      const enemyPos = centerOf(enemy.x, enemy.y);
      sprite.setVisible(true);
      sprite.setTexture(this.enemyTextureFor(enemy.kind));
      sprite.setPosition(enemyPos.px, enemyPos.py);
      sprite.setDisplaySize(tile * 0.8, tile * 0.8);

      if (enemy.id === this.activeEnemyId) {
        this.graphics.lineStyle(Math.max(2, Math.floor(tile * 0.07)), 0xef4444, 1);
        this.graphics.strokeCircle(enemyPos.px, enemyPos.py, tile * 0.42);
      }
    }

    for (const [enemyId, sprite] of this.enemySprites.entries()) {
      if (!livingIds.has(enemyId)) {
        sprite.destroy();
        this.enemySprites.delete(enemyId);
      }
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
    const modeLabel = st.mode === "TRAINING" ? "Training" : "AI Run";

    this.text.setText(
      `${modeLabel}  |  ${this.stageLabel()}  |  Monsters: ${this.getLivingEnemies().length}`
    );
    this.text.setVisible(true);

    this.text.setPosition(ox + Math.max(8, tile * 0.3), Math.max(10, oy - 34));
    const messageY = Math.max(60, oy - 6);
    this.combatText.setPosition(this.scale.width / 2, messageY);
    }

  private enemyWander(enemy: Enemy) {
    if (enemy.hp <= 0) return;

    this.grid[enemy.y][enemy.x] = 0;

    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    Phaser.Utils.Array.Shuffle(dirs);

    for (const d of dirs) {
      const nx = enemy.x + d.dx;
      const ny = enemy.y + d.dy;

      if (
        this.isWalkable(nx, ny) &&
        !this.isEnemyAt(nx, ny, enemy.id) &&
        !(nx === this.goal.x && ny === this.goal.y) &&
        !(nx === this.hero.x && ny === this.hero.y)
      ) {
        enemy.x = nx;
        enemy.y = ny;
        break;
      }
    }

    this.grid[enemy.y][enemy.x] = 2;
  }

  private enemyChase(enemy: Enemy) {
    if (enemy.hp <= 0) return;

    this.grid[enemy.y][enemy.x] = 0;

    const dx = Math.sign(this.hero.x - enemy.x);
    const dy = Math.sign(this.hero.y - enemy.y);

    const tryMove = (nx: number, ny: number) => {
      if (!this.isWalkable(nx, ny)) return false;
      if (this.isEnemyAt(nx, ny, enemy.id)) return false;
      if (nx === this.hero.x && ny === this.hero.y) return false;
      enemy.x = nx;
      enemy.y = ny;
      return true;
    };

    const options =
      Math.abs(dx) >= Math.abs(dy)
        ? [{ dx, dy: 0 }, { dx: 0, dy }]
        : [{ dx: 0, dy }, { dx, dy: 0 }];

    for (const option of options) {
      if ((option.dx !== 0 || option.dy !== 0) &&
          tryMove(enemy.x + option.dx, enemy.y + option.dy)) {
        break;
      }
    }

    this.grid[enemy.y][enemy.x] = 2;
  }

  private isWalkable(x: number, y: number) {
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    return this.grid[y][x] !== 1;
  }

  private isEnemyAt(x: number, y: number, ignoreEnemyId?: string) {
    return this.enemies.some(
      (e) => e.hp > 0 && e.id !== ignoreEnemyId && e.x === x && e.y === y
    );
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

  private canEnemySeeHero(enemy: Enemy, range = 5) {
    if (enemy.hp <= 0) return false;

    const dist = this.manhattan(this.hero.x, this.hero.y, enemy.x, enemy.y);
    if (dist > range) return false;

    return this.hasLineOfSight(enemy.x, enemy.y, this.hero.x, this.hero.y);
  }

  private findEncounterEnemyNearHero() {
    const candidates = this.getLivingEnemies()
      .filter((enemy) => {
        return (
          this.manhattan(this.hero.x, this.hero.y, enemy.x, enemy.y) <= 1 &&
          this.hasLineOfSight(this.hero.x, this.hero.y, enemy.x, enemy.y)
        );
      })
      .sort((a, b) => {
        const da = this.manhattan(this.hero.x, this.hero.y, a.x, a.y);
        const db = this.manhattan(this.hero.x, this.hero.y, b.x, b.y);
        return da - db;
      });

    return candidates[0] ?? null;
  }

  private getTileSize() {
    const pad = 24;
    const usableW = this.scale.width - pad * 2;
    const usableH = this.scale.height - pad * 2;
    return Math.floor(Math.min(usableW / W, usableH / H));
  }

  private hasTaughtAction(action: Action) {
    const examples = useGameStore.getState().examples;
    return examples.some((ex) => ex.action === action);
  }

  private getGridOrigin(tile: number) {
    const gridW = tile * W;
    const gridH = tile * H;
    const ox = Math.floor((this.scale.width - gridW) / 2);
    const oy = Math.floor((this.scale.height - gridH) / 2);
    return { ox, oy };
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