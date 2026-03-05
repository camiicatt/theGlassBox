import Phaser from "phaser";
import { encodeNeighborhood, type Tile } from "../../game/stateEncoding";
import { knnPredict } from "../../ai/knn";
import { useGameStore } from "../../app/ui/store/useGameStore";
import type { Action } from "../../app/ui/store/useGameStore";

const W = 12;
const H = 12;

function uid() {
  return Math.random().toString(16).slice(2);
}

type EnemyKind = "small" | "big";
type Enemy = { x: number; y: number; hp: number; maxHp: number; kind: EnemyKind };

export default class DungeonScene extends Phaser.Scene {
  private grid!: Tile[][];
  private hero = { x: 1, y: 1, hp: 1 };

  private enemy: Enemy = { x: 8, y: 8, hp: 2, maxHp: 2, kind: "small" };
  private goal = { x: 10, y: 10 };

  private graphics!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;

  private lastStepAt = 0;

  private enemySkipTurns = 0;

  // HEAL/HIDE anytime
  private healCooldown = 0; // turns remaining (0..3)
  private hiddenTurns = 0;  // turns remaining (0..2)

  // Optional: auto-walk in TRAINING (set true if you want)
  private autoHeroWalk = false;
  private heroAutoStepAt = 0;
  private heroWanderCooldownMs = 450;

  private invulnTurns = 0;

  private lastRestartToken = 0;

  constructor() {
    super("DungeonScene");
  }

  create() {
    this.graphics = this.add.graphics();
    this.text = this.add.text(10, 10, "", { fontFamily: "monospace", fontSize: "14px" });

    // keyboard focus
    this.game.canvas.setAttribute("tabindex", "0");
    this.game.canvas.focus();
    this.input.on("pointerdown", () => this.game.canvas.focus());

    this.grid = this.makeLevel1();

    this.input.keyboard?.on("keydown-ESC", () => {
      const st = useGameStore.getState();
      if (st.mode === "AI_RUN") st.setMode("TRAINING");
    });

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {

      const st = useGameStore.getState();
      const action = this.keyToAction(e.key);
      if (!action) return;

      if (action === "HEAL" || action === "HIDE") {
        this.step(action, /*recordExample*/ st.mode === "TRAINING");
        return;
      }

      // Movement/attack only when TRAINING (so AI_RUN isn't interrupted by WASD)
      if (st.mode !== "TRAINING") return;

      this.step(action, /*recordExample*/ true);
    });

    this.publishStateAndPrediction();
    this.render();
  }

  update(time: number) {
    const st = useGameStore.getState();

// Consume OptionBoard actions whenever they appear (no hard pause)
const choice = st.pendingAction;


if (st.restartToken !== this.lastRestartToken) {
  this.lastRestartToken = st.restartToken;

  // revive the hero
  this.hero.hp = 1;
  this.hero.x = 1;
  this.hero.y = 1;

  // reset turn-based effects (but NOT training examples)
  this.healCooldown = 0;
  this.hiddenTurns = 0;
  this.invulnTurns = 6;     // brief safety so it doesn’t die instantly
  this.enemySkipTurns = 2;  // enemy pauses a moment

  st.setHeroDead(false);

  this.publishStateAndPrediction();
  this.render();
  return;
}

if (choice) {
  st.setPendingAction(null);

  // record training example at this moment
  if (st.mode === "TRAINING" && st.currentState) {
    st.addExample({ state: st.currentState.slice(), action: choice });
    st.saveToLocal?.();
  }

  // apply effects
  this.applyGeneralAction(choice);
  this.applyBattleChoice(choice);

  this.endOfTurn();
  this.syncBattlePrompt();

  
  return;
}

    // optional auto-walk (TRAINING)
    if (st.mode === "TRAINING" && this.autoHeroWalk) {
      if (time - this.heroAutoStepAt > this.heroWanderCooldownMs) {
        this.heroAutoStepAt = time;
        this.heroWanderOneStep();
        this.endOfTurn();
        return;
      }
    }

    // AI RUN
    if (st.mode === "AI_RUN" && time - this.lastStepAt > 250) {
      this.lastStepAt = time;

      const stateVec = st.currentState;
      if (!stateVec) return;

      const pred = knnPredict(stateVec, st.examples, 7);
      st.setPrediction(pred);

      // choose a legal-ish action so AI doesn't stick on walls
      const chosen = this.chooseLegalAction(pred.probs);
      this.step(chosen, /*recordExample*/ false);
    }

  }

  private clearAreaOn(g: Tile[][], cx: number, cy: number, r = 1) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x <= 0 || x >= W - 1 || y <= 0 || y >= H - 1) continue; // keep border
        g[y][x] = 0;
      }
    }
  }

  private syncBattlePrompt() {
    const st = useGameStore.getState();
  
    if (st.mode !== "TRAINING") {
      if (st.battlePrompt) st.closeBattlePrompt?.();
      return;
    }
  
    const adjacent =
      this.enemyAlive() &&
      this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y) === 1;
  
    if (adjacent) {
      st.openBattlePrompt({
        enemyName: this.enemy.kind === "big" ? "Big Slime" : "Slime",
        enemyHp: this.enemy.hp,
      });
    } else {
      if (st.battlePrompt) st.closeBattlePrompt?.();
    }
  }
  
  private getTileSize() {
    // Fit 12x12 grid inside available canvas with padding
    const pad = 24; // pixels
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
    

    // record BEFORE state changes
    if (recordExample && st.currentState) {
      st.addExample({ state: st.currentState.slice(), action });
      st.saveToLocal?.();
    }

    // HEAL/HIDE always valid
    this.applyGeneralAction(action);

    // Allow FIGHT/RUN outside the modal too:
    if (action === "FIGHT") {
      this.fightIfAdjacent();
    } else if (action === "RUN") {
      this.runAway();
    } else if (action === "ATTACK") {
      this.attackEnemyIfAdjacent();
    } else if (action === "UP" || action === "DOWN" || action === "LEFT" || action === "RIGHT") {
      const { dx, dy } = this.actionToDelta(action);
      const nx = this.hero.x + dx;
      const ny = this.hero.y + dy;
      if (this.isWalkable(nx, ny)) {
        this.hero.x = nx;
        this.hero.y = ny;
      }
    } else {
      // WAIT etc.
    }

// TRAINING hook: show option board when adjacent (do NOT pause)
    if (st.mode === "TRAINING" && this.enemyAlive()) {
      this.syncBattlePrompt();

    }

    this.endOfTurn();
    this.syncBattlePrompt();
  }

  private endOfTurn() {
    // tick cooldowns
    if (this.healCooldown > 0) this.healCooldown--;
    if (this.hiddenTurns > 0) this.hiddenTurns--;
    if (this.invulnTurns > 0) this.invulnTurns--;
  
    // enemy move (one clean block)
    if (this.enemyAlive()) {
      if (this.hiddenTurns > 0) {
        this.slimeWander();
      } else if (this.enemySkipTurns > 0) {
        this.enemySkipTurns--;
      } else {
        const dist = this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y);
        if (dist <= 5) this.enemyChase();
        else this.slimeWander();
      }
    }
  
    // overlap damage ONCE (with i-frames + knockback, NO TELEPORT)
    if (this.enemyAlive() && this.hero.x === this.enemy.x && this.hero.y === this.enemy.y) {
      if (this.invulnTurns === 0) {
        this.hero.hp = Math.max(0, this.hero.hp - 0.25);
        this.invulnTurns = 2;
  
        // knockback 1 tile (try a few directions)
        const tries = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        ];
  
        // prefer moving away from enemy (but at overlap awayX/awayY are 0, so just shuffle tries)
        Phaser.Utils.Array.Shuffle(tries);
  
        for (const t of tries) {
          const nx = this.hero.x + t.dx;
          const ny = this.hero.y + t.dy;
          if (this.isWalkable(nx, ny) && !(nx === this.enemy.x && ny === this.enemy.y)) {
            this.hero.x = nx;
            this.hero.y = ny;
            break;
          }
        }
      }
    }
  
    // goal reached
    if (this.hero.x === this.goal.x && this.hero.y === this.goal.y) {
      this.grid = this.makeRandomDungeon();
      this.hero.x = 1;
      this.hero.y = 1;
    }

    const st = useGameStore.getState();
  if (this.hero.hp <= 0) {
    this.hero.hp = 0;

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
    this.render();
  }
  private applyGeneralAction(action: Action) {
    if (action === "HEAL") {
      if (this.healCooldown === 0) {
        this.hero.hp = Math.min(1, this.hero.hp + 0.25);
        this.healCooldown = 3;
      }
    }
    if (action === "HIDE") {
      this.hiddenTurns = 2;
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
    if (!this.enemyAlive()) return;
    const adjacent = this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y) === 1;
    if (!adjacent) return;

    this.enemy.hp -= 1;
    if (this.enemy.hp <= 0) this.killEnemy();
  }

  private runAway() {
    // simple: step away from enemy if alive; else random step
    if (!this.enemyAlive()) {
      this.heroWanderOneStep();
      return;
    }
    const dx = Math.sign(this.hero.x - this.enemy.x);
    const dy = Math.sign(this.hero.y - this.enemy.y);

    // try to move away on x or y
    const options = [
      { dx, dy: 0 },
      { dx: 0, dy },
      { dx: -dx, dy: 0 }, // fallback
      { dx: 0, dy: -dy },
    ];
    for (const o of options) {
      const nx = this.hero.x + o.dx;
      const ny = this.hero.y + o.dy;
      if (this.isWalkable(nx, ny)) {
        this.hero.x = nx;
        this.hero.y = ny;
        return;
      }
    }
  }

  private chooseLegalAction(probs: Record<string, number>): Action {
    const ordered = Object.entries(probs)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([a]) => a as Action);
  
    const adjacent =
      this.enemyAlive() &&
      this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y) === 1;
  
    for (const a of ordered) {
      // Only attack/fight if adjacent
      if ((a === "ATTACK" || a === "FIGHT") && !adjacent) continue;
  
      // HEAL only if it can actually do something
      if (a === "HEAL") {
        if (this.healCooldown > 0) continue;
        if (this.hero.hp >= 0.95) continue;
        return "HEAL";
      }
  
      // HIDE only if not already hidden
      if (a === "HIDE") {
        if (this.hiddenTurns > 0) continue;
        return "HIDE";
      }
  
      // RUN only if enemy exists
      if (a === "RUN") {
        if (!this.enemyAlive()) continue;
        return "RUN";
      }
  
      // Movement must be walkable
      if (a === "UP" || a === "DOWN" || a === "LEFT" || a === "RIGHT") {
        const { dx, dy } = this.actionToDelta(a);
        const nx = this.hero.x + dx;
        const ny = this.hero.y + dy;
        if (this.isWalkable(nx, ny)) return a;
        continue;
      }
  
      if (a === "WAIT") return "WAIT";
    }
  
    // Fallback: any legal move (prevents freezing)
    const moves: Action[] = ["UP", "DOWN", "LEFT", "RIGHT"];
    Phaser.Utils.Array.Shuffle(moves);
    for (const m of moves) {
      const { dx, dy } = this.actionToDelta(m);
      if (this.isWalkable(this.hero.x + dx, this.hero.y + dy)) return m;
    }
    return "WAIT";
  }

  private attackEnemyIfAdjacent() {
    if (!this.enemyAlive()) return;
    const adjacent = this.manhattan(this.hero.x, this.hero.y, this.enemy.x, this.enemy.y) === 1;
    if (!adjacent) return;

    this.enemy.hp -= 1;
    if (this.enemy.hp <= 0) this.killEnemy();
  }

  private killEnemy() {
    if (this.enemyAlive()) this.grid[this.enemy.y][this.enemy.x] = 0;
    this.enemy.x = -999;
    this.enemy.y = -999;
  }

  private enemyAlive() {
    return this.enemy.x >= 0 && this.enemy.y >= 0 && this.enemy.hp > 0;
  }

  private publishStateAndPrediction() {
    const store = useGameStore.getState();
    const enemyHp01 = this.enemyAlive() ? Math.min(1, this.enemy.hp / this.enemy.maxHp) : 0;

    const stateVec = encodeNeighborhood(
      this.grid,
      this.hero.x,
      this.hero.y,
      this.hero.hp,
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
  
    // tiles
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = this.grid[y][x];
        const fill =
          t === 1 ? 0x24314f :
          t === 2 ? 0xb53b3b :
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
  
    // hero
    const inset = Math.floor(tile * 0.15);
    const heroSize = tile - inset * 2;
  
    this.graphics.fillStyle(0x4dabf7, 1);
    this.graphics.fillRect(
      ox + this.hero.x * tile + inset,
      oy + this.hero.y * tile + inset,
      heroSize,
      heroSize
    );
  
    // vision highlight (5x5)
    this.graphics.lineStyle(Math.max(2, Math.floor(tile * 0.06)), 0xfbbf24, 0.9);
    this.graphics.strokeRect(
      ox + (this.hero.x - 2) * tile,
      oy + (this.hero.y - 2) * tile,
      tile * 5,
      tile * 5
    );
  
    // hidden ring
    if (this.hiddenTurns > 0) {
      this.graphics.lineStyle(Math.max(2, Math.floor(tile * 0.08)), 0x9ca3af, 1);
      this.graphics.strokeCircle(
        ox + this.hero.x * tile + tile / 2,
        oy + this.hero.y * tile + tile / 2,
        tile / 2
      );
    }
  
    // heal cooldown bar
    if (this.healCooldown > 0) {
      const barW = heroSize;
      const barX = ox + this.hero.x * tile + inset;
      const barY = oy + this.hero.y * tile + Math.floor(tile * 0.05);
  
      this.graphics.fillStyle(0x111827, 1);
      this.graphics.fillRect(barX, barY, barW, Math.max(4, Math.floor(tile * 0.12)));
  
      const pct = 1 - this.healCooldown / 3;
      this.graphics.fillStyle(0x22c55e, 1);
      this.graphics.fillRect(barX, barY, Math.floor(barW * pct), Math.max(4, Math.floor(tile * 0.12)));
    }
  
    // move debug text inside the grid area
    this.text.setPosition(ox + 8, oy + 8);
  
    const st = useGameStore.getState();
    const slimeInfo = this.enemyAlive()
      ? `${this.enemy.kind} ${this.enemy.hp}/${this.enemy.maxHp}`
      : "none";
  
    this.text.setText([
      `Mode: ${st.mode}`,
      `Examples: ${st.examples.length}`,
      `Hero HP: ${this.hero.hp.toFixed(2)}`,
      `Heal CD: ${this.healCooldown}  Hidden: ${this.hiddenTurns}`,
      `Slime: ${slimeInfo}`,
      `Conf: ${st.prediction?.confidence.toFixed(2) ?? "0.00"}`,
      "Keys: WASD move, Space attack, H heal, E hide",
    ]);
  }

  private makeLevel1(): Tile[][] {
    const g: Tile[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => 0 as Tile));

    for (let x = 0; x < W; x++) { g[0][x] = 1; g[H - 1][x] = 1; }
    for (let y = 0; y < H; y++) { g[y][0] = 1; g[y][W - 1] = 1; }

    for (let x = 3; x <= 8; x++) g[5][x] = 1;

    // place enemy and goal INTO g (not this.grid)
    this.placeEnemyOnGrid(g, 8, 8, "small");
    g[this.goal.y][this.goal.x] = 3;

    return g;
  }

  private makeRandomDungeon(): Tile[][] {
    const g: Tile[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => 0 as Tile));

    for (let x = 0; x < W; x++) { g[0][x] = 1; g[H - 1][x] = 1; }
    for (let y = 0; y < H; y++) { g[y][0] = 1; g[y][W - 1] = 1; }

    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(1, W - 2);
      const y = Phaser.Math.Between(1, H - 2);
      if ((x === 1 && y === 1) || (x === 10 && y === 10)) continue;
      g[y][x] = 1;
    }

        // guarantee spawn/goal aren't boxed in
    this.clearAreaOn(g, 1, 1, 1);
    this.clearAreaOn(g, 10, 10, 1);

    this.goal = { x: 10, y: 10 };
    g[this.goal.y][this.goal.x] = 3;

    const kind: EnemyKind = Phaser.Math.Between(0, 1) === 0 ? "small" : "big";
    const ex = Phaser.Math.Between(6, 10);
    const ey = Phaser.Math.Between(6, 10);

    this.placeEnemyOnGrid(g, ex, ey, kind);

    this.enemySkipTurns = 0;
    this.healCooldown = 0;
    this.hiddenTurns = 0;

    return g;
  }

  private placeEnemyOnGrid(g: Tile[][], x: number, y: number, kind: EnemyKind) {
    this.enemy.x = x;
    this.enemy.y = y;
    this.enemy.kind = kind;
    this.enemy.maxHp = kind === "big" ? 4 : 2;
    this.enemy.hp = this.enemy.maxHp;

    g[y][x] = 2;
  }

  private slimeWander() {
    if (!this.enemyAlive()) return;

    this.grid[this.enemy.y][this.enemy.x] = 0;

    const dirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
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
  
    // clear old tile
    this.grid[this.enemy.y][this.enemy.x] = 0;
  
    const dx = Math.sign(this.hero.x - this.enemy.x);
    const dy = Math.sign(this.hero.y - this.enemy.y);
  
    const tryMove = (nx: number, ny: number) => {
      if (!this.isWalkable(nx, ny)) return false;
      if (nx === this.hero.x && ny === this.hero.y) return false; // don't overlap hero
      this.enemy.x = nx;
      this.enemy.y = ny;
      return true;
    };
  
    // prefer x move, fallback y move
    if (dx !== 0 && tryMove(this.enemy.x + dx, this.enemy.y)) {
      // moved
    } else if (dy !== 0) {
      tryMove(this.enemy.x, this.enemy.y + dy);
    }
  
    // set new tile
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
      case "UP": return { dx: 0, dy: -1 };
      case "DOWN": return { dx: 0, dy: 1 };
      case "LEFT": return { dx: -1, dy: 0 };
      case "RIGHT": return { dx: 1, dy: 0 };
      default: return { dx: 0, dy: 0 };
    }
  }

  private keyToAction(key: string): Action | null {
    const k = key.toLowerCase();
    switch (k) {
      case "arrowup":
      case "w": return "UP";
      case "arrowdown":
      case "s": return "DOWN";
      case "arrowleft":
      case "a": return "LEFT";
      case "arrowright":
      case "d": return "RIGHT";
      case " ": return "ATTACK";
      case "enter": return "WAIT";
      case "h": return "HEAL";
      case "e": return "HIDE"; // MUCH more reliable than Shift
      case "r": return "RUN";
      case "f": return "FIGHT";
      default: return null;
    }
  }

  private manhattan(x1: number, y1: number, x2: number, y2: number) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
}