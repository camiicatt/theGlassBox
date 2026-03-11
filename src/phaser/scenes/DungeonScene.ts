import Phaser from "phaser";
import { encodeNeighborhood, type Tile } from "../../game/stateEncoding";
import { knnPredict } from "../../ai/knn";
import { useGameStore } from "../../app/ui/store/useGameStore";
import type { Action } from "../../app/ui/store/useGameStore";
import { ACTIONS } from "../../game/actions";

const W = 12;
const H = 12;
const HERO_MAX_HP = 5;
const DUNGEONS_BEFORE_AI_RUN = 5;

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
};

type DungeonTemplate = {
  map: string[];
  enemyKind: EnemyKind;
};

export default class DungeonScene extends Phaser.Scene {
  private grid!: Tile[][];
  private hero = { x: 1, y: 1, hp: HERO_MAX_HP };

  private enemy: Enemy = { x: 8, y: 8, hp: 2, maxHp: 2, kind: "slime" };
  private goal = { x: 10, y: 10 };

  private graphics!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;

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
  private trainingDungeonClears = 0;

  private heroSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;

  private lastAiAction: Action | null = null;
  private recentHeroPositions: { x: number; y: number }[] = [];

  private combatText!: Phaser.GameObjects.Text;
  private combatMessage = "";

  //health bar information:
  private healthBarSprite!: Phaser.GameObjects.Image;

  private dungeonTemplates: DungeonTemplate[] = [
    {
      enemyKind: "slime",
      map: [
        "############",
        "#S.....#...#",
        "#.###..#.#.#",
        "#...#..#.#.#",
        "###.#..#.#.#",
        "#...#....#.#",
        "#.######.#.#",
        "#......#.#.#",
        "#.####.#.#.#",
        "#.#..#.#...#",
        "#.#..###.EG#",
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
        "#.#.#..#.#.#",
        "#...#..#...#",
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

    //health bar
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
      fontSize: "14px",
      color: "#ffffff",
    }).setDepth(30);

    this.combatText = this.add.text(10, 10, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#f8fafc",
      backgroundColor: "#7f1d1d",
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    }).setDepth(40).setVisible(false);

    this.healthBarSprite = this.add.image(0, 0, "health5").setDepth(25).setOrigin(1.5, 0.35);
        
    this.game.canvas.setAttribute("tabindex", "0");
    this.game.canvas.focus();
    this.input.on("pointerdown", () => this.game.canvas.focus());

    this.grid = this.makeTemplateDungeon();
    this.trainingDungeonClears = 0;
    this.resetAiMemory();
    useGameStore.getState().setBattleLog("");

    this.heroSprite = this.add.image(0, 0, "hero").setDepth(20).setOrigin(0.5);
    this.enemySprite = this.add.image(0, 0, "slime").setDepth(20).setOrigin(0.5);

    this.input.keyboard?.on("keydown-ESC", () => {
      const st = useGameStore.getState();
      if (st.mode === "AI_RUN") st.setMode("TRAINING");
    });

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      const st = useGameStore.getState();
      const action = this.keyToAction(e.key);
      if (!action) return;

      if (action === "HEAL" || action === "HIDE") {
        this.step(action, st.mode === "TRAINING");
        return;
      }

      if (st.mode !== "TRAINING") return;

      this.step(action, true);
    });

    this.publishStateAndPrediction();
    this.rememberHeroPosition();
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
      st.setBattleLog("");

      this.resetAiMemory();

      st.setHeroDead(false);

      this.publishStateAndPrediction();
      this.rememberHeroPosition();
      this.render();
      return;
    }

    if (choice) {
      st.setPendingAction(null);

      if (st.mode === "TRAINING" && st.currentState) {
        st.addExample({ state: st.currentState.slice(), action: choice });
        st.saveToLocal?.();
      }

      this.applyGeneralAction(choice);
      this.applyBattleChoice(choice);

      this.endOfTurn();
      this.syncBattlePrompt();
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

  private healthTextureFor(hp: number) {
    const clamped = Phaser.Math.Clamp(hp / HERO_MAX_HP, 0, 1);
    const level = Math.round(clamped * 5); // 0..5 rounding 
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
  
  private clearCombatText() {
    this.combatMessage = "";
    this.combatText.setText("");
    this.combatText.setVisible(false);
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
    this.recentHeroPositions.push({ x: this.hero.x, y: this.hero.y });
    if (this.recentHeroPositions.length > 6) {
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

    return a.x === c.x && a.y === c.y && b.x === d.x && b.y === d.y;
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

    this.placeEnemyOnGrid(g, enemySpawn.x, enemySpawn.y, template.enemyKind);

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
        return { maxHp: 4 };
      case "spider":
        return { maxHp: 3 };
      case "slime":
      default:
        return { maxHp: 2 };
    }
  }

  private syncBattlePrompt() {
    const st = useGameStore.getState();

    if (st.mode !== "TRAINING") {
      if (st.battlePrompt) st.closeBattlePrompt?.();
      st.setBattleLog("");
      return;
    }

    const shouldShow = this.inBattleEncounter && this.enemyAlive();

    if (shouldShow) {
      st.openBattlePrompt({
        enemyName: this.enemyLabelFor(this.enemy.kind),
        enemyHp: this.enemy.hp,
        enemyMaxHp: this.enemy.maxHp,
        heroHp: this.hero.hp,
        heroMaxHp: HERO_MAX_HP,
      });
    } else {
      if (st.battlePrompt) st.closeBattlePrompt?.();
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
      this.showCombatText("You are in battle. Choose Fight, Run, Hide, or Heal.");
      this.syncBattlePrompt();
      this.render();
      return;
    }

    if (!this.inBattleEncounter && isBattleAction && !this.enemyAlive()) {
      this.showCombatText("There is no enemy to battle.");
      this.render();
      return;
    }

    this.applyGeneralAction(action);

    if (action === "FIGHT") {
      this.fightIfAdjacent();
    } else if (action === "RUN") {
      this.runAway();
    } else if (action === "ATTACK") {
      this.attackEnemyIfAdjacent();
    } else if (isMoveAction) {
      const { dx, dy } = this.actionToDelta(action);
      const nx = this.hero.x + dx;
      const ny = this.hero.y + dy;
      if (this.isWalkable(nx, ny)) {
        this.hero.x = nx;
        this.hero.y = ny;
        if (this.enemyAlive() && this.hero.x === this.enemy.x && this.hero.y === this.enemy.y) {
          this.inBattleEncounter = true;
          this.battleJustStarted = true;
          this.showCombatText(`Encounter! ${this.enemyLabelFor(this.enemy.kind)} blocks your path.`);
        }
      }
    }

    if (st.mode === "TRAINING" && this.enemyAlive()) {
      this.syncBattlePrompt();
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
        const dist = this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y);
        if (dist <= 5) this.enemyChase();
        else this.enemyWander();
      }
    }

    if (this.enemyAlive() && this.hero.x === this.enemy.x && this.hero.y === this.enemy.y) {
      if (!this.inBattleEncounter) {
        this.inBattleEncounter = true;
        this.battleJustStarted = true;
      }
    }

    if (this.inBattleEncounter && this.enemyAlive()) {
      if (this.battleJustStarted) {
        this.battleJustStarted = false;
      } else
      if (this.invulnTurns === 0) {
        const hitRoll = Math.random();
        const didHit = hitRoll < 0.8; // 80% accuracy
    
        if (didHit) {
          const dmg = this.enemy.kind === "bigSlime" ? 2 : 1;
          this.hero.hp = Math.max(0, this.hero.hp - dmg);
          this.showCombatText(`${this.enemyLabelFor(this.enemy.kind)} hits for ${dmg} HP`);
        } else {
          this.showCombatText(`${this.enemyLabelFor(this.enemy.kind)} missed!`);
        }

        this.invulnTurns = 2;
      }
    }

    const st = useGameStore.getState();

    if (this.hero.x === this.goal.x && this.hero.y === this.goal.y) {
      if (st.mode === "TRAINING") {
        this.trainingDungeonClears += 1;

        if (this.trainingDungeonClears >= DUNGEONS_BEFORE_AI_RUN) {
          st.setMode("AI_RUN");
          st.setBattleLog("5 dungeons cleared. AI now takes control.");
          this.showCombatText("5 dungeons cleared. AI now takes control.");
          this.trainingDungeonClears = 0;
        } else {
          const remaining = DUNGEONS_BEFORE_AI_RUN - this.trainingDungeonClears;
          this.showCombatText(`Dungeon cleared! ${remaining} to go before AI runs.`);
        }
      }

      this.grid = this.makeTemplateDungeon();
      this.resetAiMemory();
      this.rememberHeroPosition();
    }

    if (this.hero.hp <= 0) {
      this.hero.hp = 0;
      this.inBattleEncounter = false;
      this.battleJustStarted = false;
      if (st.battlePrompt) st.closeBattlePrompt?.();
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
    this.render();
  }

  private applyGeneralAction(action: Action) {
    if (action === "HEAL") {
      if (this.healCooldown === 0) {
        const amount = 1;
        this.hero.hp = Math.min(HERO_MAX_HP, this.hero.hp + amount);
        this.healCooldown = 3;
        this.showCombatText(`You healed ${amount} HP`);
      } else {
        this.showCombatText(`Heal is on cooldown`);
      }
    }
  
    if (action === "HIDE") {
      this.hiddenTurns = 2;
      this.showCombatText(`You hide in the shadows`);
    }
  }

  private applyBattleChoice(choice: Action) {
    switch (choice) {
      case "FIGHT":
        this.fightIfAdjacent();
        break;
      case "RUN":
        this.runAway();
        break;
      case "HIDE":
        this.hiddenTurns = Math.max(this.hiddenTurns, 2);
        this.enemySkipTurns = 1;
        break;
      case "HEAL":
      default:
        break;
    }
  }

  private fightIfAdjacent() {
    this.attackEnemyIfAdjacent();
  }

  private attackEnemyIfAdjacent() {
    if (!this.enemyAlive()) return;
  
    const distance = this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y);
    const canAttack = distance <= 1;
    if (!canAttack) return;
  
    const hitRoll = Math.random();
    const didHit = hitRoll < 0.85;
  
    if (!didHit) {
      this.showCombatText(`You missed ${this.enemyLabelFor(this.enemy.kind)}!`);
      return;
    }
  
    const dmg = 1;
    this.enemy.hp -= dmg;
    this.showCombatText(`You hit ${this.enemyLabelFor(this.enemy.kind)} for ${dmg}`);
  
    if (this.enemy.hp <= 0) {
      this.killEnemy();
      this.inBattleEncounter = false;
      this.battleJustStarted = false;
      this.showCombatText(`You defeated ${this.enemyLabelFor(this.enemy.kind)}!`);
    }
  }

  private runAway() {
    if (!this.enemyAlive()) {
      this.heroWanderOneStep();
      this.showCombatText("You ran away!");
      return;
    }

    const dx = Math.sign(this.hero.x - this.enemy.x);
    const dy = Math.sign(this.hero.y - this.enemy.y);

    const options =
      dx === 0 && dy === 0
        ? [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
          ]
        : [
            { dx, dy: 0 },
            { dx: 0, dy },
            { dx: -dx, dy: 0 },
            { dx: 0, dy: -dy },
          ];

    Phaser.Utils.Array.Shuffle(options);

    for (const o of options) {
      const nx = this.hero.x + o.dx;
      const ny = this.hero.y + o.dy;
      if (this.isWalkable(nx, ny) && !(nx === this.enemy.x && ny === this.enemy.y)) {
        this.hero.x = nx;
        this.hero.y = ny;
        this.inBattleEncounter = false;
        this.battleJustStarted = false;
        this.showCombatText("You ran away!");
        return;
      }
    }
  }

  private chooseLegalAction(probs: Record<string, number>, confidence = 0): Action {
    const adjusted = {} as Record<Action, number>;

    for (const a of ACTIONS) {
      adjusted[a] = probs[a] ?? 0;
    }

    const adjacent =
      this.enemyAlive() &&
      this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y) <= 1;

    if (this.lastAiAction) {
      const reverse = this.reverseOf(this.lastAiAction);
      if (reverse) {
        adjusted[reverse] *= 0.35;
      }
    }

    if (this.isPositionLooping()) {
      for (const a of ["UP", "DOWN", "LEFT", "RIGHT"] as Action[]) {
        adjusted[a] *= 0.7;
      }

      if (this.lastAiAction === "LEFT" || this.lastAiAction === "RIGHT") {
        adjusted["UP"] *= 1.4;
        adjusted["DOWN"] *= 1.4;
      }

      if (this.lastAiAction === "UP" || this.lastAiAction === "DOWN") {
        adjusted["LEFT"] *= 1.4;
        adjusted["RIGHT"] *= 1.4;
      }
    }

    const legal: { action: Action; score: number }[] = [];

    for (const action of ACTIONS) {
      if ((action === "ATTACK" || action === "FIGHT") && !adjacent) continue;

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
        legal.push({ action, score: adjusted[action] });
        continue;
      }

      if (action === "WAIT") {
        legal.push({ action, score: adjusted[action] });
      }
    }

    if (legal.length === 0) return "WAIT";

    const shouldExplore = confidence < 0.55 || this.isPositionLooping();

    if (shouldExplore && Math.random() < 0.3) {
      const movementOnly = legal.filter(
        (x) =>
          x.action === "UP" ||
          x.action === "DOWN" ||
          x.action === "LEFT" ||
          x.action === "RIGHT"
      );

      const pool = movementOnly.length > 0 ? movementOnly : legal;

      let total = 0;
      for (const item of pool) {
        total += Math.max(0.001, item.score);
      }

      let r = Math.random() * total;
      for (const item of pool) {
        r -= Math.max(0.001, item.score);
        if (r <= 0) return item.action;
      }

      return pool[pool.length - 1].action;
    }

    legal.sort((a, b) => b.score - a.score);
    return legal[0].action;
  }

  private killEnemy() {
    if (this.enemyAlive()) {
      this.grid[this.enemy.y][this.enemy.x] = 0;
    }
    this.enemy.x = -999;
    this.enemy.y = -999;
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

    const topY = Math.max(8, oy - 56);
    const centerX = ox + (tile * W) / 2;

    const targetWidth = tile * 4.2;
    const naturalWidth = this.healthBarSprite.texture.getSourceImage().width;
    const scale = targetWidth / naturalWidth;

    this.healthBarSprite.setPosition(centerX, topY);
    this.healthBarSprite.setScale(scale);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = this.grid[y][x];

        const fill =
          t === 1 ? 0x24314f :
          t === 3 ? 0x2f9e44 :
          0x111827;

        this.graphics.fillStyle(fill, 1);
        this.graphics.fillRect(
          ox + x * tile,
          oy + y * tile,
          tile - 1,
          tile - 1
        );
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

    this.graphics.lineStyle(Math.max(2, Math.floor(tile * 0.06)), 0xfbbf24, 0.9);
    this.graphics.strokeRect(
      ox + (this.hero.x - 2) * tile,
      oy + (this.hero.y - 2) * tile,
      tile * 5,
      tile * 5
    );

    if (this.hiddenTurns > 0) {
      this.graphics.lineStyle(Math.max(2, Math.floor(tile * 0.08)), 0x9ca3af, 1);
      this.graphics.strokeCircle(
        ox + this.hero.x * tile + tile / 2,
        oy + this.hero.y * tile + tile / 2,
        tile / 2
      );
    }

    if (this.healCooldown > 0) {
      const inset = Math.floor(tile * 0.15);
      const heroSize = tile - inset * 2;
      const barW = heroSize;
      const barX = ox + this.hero.x * tile + inset;
      const barY = oy + this.hero.y * tile + Math.floor(tile * 0.05);

      this.graphics.fillStyle(0x111827, 1);
      this.graphics.fillRect(barX, barY, barW, Math.max(4, Math.floor(tile * 0.12)));

      const pct = 1 - this.healCooldown / 3;
      this.graphics.fillStyle(0x22c55e, 1);
      this.graphics.fillRect(
        barX,
        barY,
        Math.floor(barW * pct),
        Math.max(4, Math.floor(tile * 0.12))
      );
    }

    this.text.setPosition(ox + 8, oy + 8);
    this.combatText.setPosition(ox + tile * 6, oy + 8);

    // const st = useGameStore.getState();
    // const enemyInfo = this.enemyAlive()
    //   ? `${this.enemyLabelFor(this.enemy.kind)} ${this.enemy.hp}/${this.enemy.maxHp}`
    //   : "none";

    // this.text.setText([
    //   `Hero HP: ${this.hero.hp.toFixed(2)}`,
    //   `Enemy: ${enemyInfo}`,
    //   `Conf: ${st.prediction?.confidence.toFixed(2) ?? "0.00"}`,
    //   "Keys: WASD move, Space attack, H heal, E hide, F fight, R run",
    // ]);
  }

  private placeEnemyOnGrid(g: Tile[][], x: number, y: number, kind: EnemyKind) {
    this.enemy.x = x;
    this.enemy.y = y;
    this.enemy.kind = kind;

    const stats = this.enemyStatsFor(kind);
    this.enemy.maxHp = stats.maxHp;
    this.enemy.hp = this.enemy.maxHp;

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
        ? [
            { dx, dy: 0 },
            { dx: 0, dy },
          ]
        : [
            { dx: 0, dy },
            { dx, dy: 0 },
          ];

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

  private keyToAction(key: string): Action | null {
    const k = key.toLowerCase();

    switch (k) {
      case "arrowup":
      case "w":
        return "UP";
      case "arrowdown":
      case "s":
        return "DOWN";
      case "arrowleft":
      case "a":
        return "LEFT";
      case "arrowright":
      case "d":
        return "RIGHT";
      case " ":
        return "ATTACK";
      case "enter":
        return "WAIT";
      case "h":
        return "HEAL";
      case "e":
        return "HIDE";
      case "r":
        return "RUN";
      case "f":
        return "FIGHT";
      default:
        return null;
    }
  }

  private manhattan(x1: number, y1: number, x2: number, y2: number) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
}
