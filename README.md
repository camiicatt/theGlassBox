# The Glass Box

An RPG dungeon crawler that teaches middle-schoolers how machine learning works — by
letting the game's AI learn to play *like them*, using a model you can actually see
inside. It runs in the browser; a live demo link will go here.

The child plays a hero through a dungeon. Every move they make becomes a labeled
training example, and an AI hero learns to imitate their playstyle. The twist is
the model: instead of an opaque neural network, it uses **k-nearest neighbors**, so
the AI's reasoning is fully transparent — you can point at the exact past moments
that drove any decision. That interpretability is the whole point, and the name.

## How it works

- **Every move is a training example.** Each decision is stored as `(state, action)` —
  the situation the player was in, and what they chose.
- **State encoding** (`src/game/stateEncoding.ts`). Each situation becomes a
  29-dimensional feature vector: a 5×5 grid of tiles around the hero (empty, wall,
  enemy, goal) plus status features (hero health, heal cooldown, turns hidden,
  nearest enemy health). Health is scaled to match the tile range so it carries
  comparable weight in the distance metric.
- **The model** (`src/ai/knn.ts`). To pick the AI hero's next move, it finds the `k`
  nearest past situations (k = 7, Euclidean distance) and takes a distance-weighted
  vote over the actions taken there, returning a probability per action plus a
  confidence score.
- **Explainability** (`src/app/ui/HeroBrainPanel.tsx`). The AI's "brain" is just the
  set of examples the player created, so the UI can show *why* it acted.

## Stack

- **Phaser** — game engine / dungeon rendering
- **React + Vite + TypeScript** — app shell and UI
- **Zustand** — game and model state
- **Supabase** — play-session logging and persistence

## Run it locally

```bash
pnpm install
pnpm dev
```

Other scripts:

```bash
pnpm build     # type-check and build for production
pnpm preview   # preview the production build
pnpm lint      # run ESLint
```

## Project layout

```
src/
  ai/knn.ts            k-nearest-neighbors classifier
  game/stateEncoding.ts   situation -> feature vector
  game/actions.ts      the action space
  phaser/              Phaser scenes and game setup
  app/                 React pages and UI (incl. HeroBrainPanel)
  lib/                 Supabase logging, CSV export, backups
```
