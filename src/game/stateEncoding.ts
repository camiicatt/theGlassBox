// Tile encoding (simple + explainable)
export type Tile = 0 | 1 | 2 | 3;
// 0 empty, 1 wall, 2 enemy, 3 goal

export function encodeNeighborhood(

  
    grid: Tile[][],
    hx: number,
    hy: number,
    heroHp01: number,
    healCd: number,
    hiddenTurns: number,
    nearestEnemyHp01: number
  ): number[] {
    const vec: number[] = [];
    const R = 2;
  
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = hx + dx;
        const y = hy + dy;
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) vec.push(1);
        else vec.push(grid[y][x]);
      }
    }

    
  
    // extra features (normalized)
    vec.push(heroHp01);                 // 0..1
    vec.push(Math.min(1, healCd / 3));  // 0..1
    vec.push(Math.min(1, hiddenTurns / 2)); // 0..1
    vec.push(nearestEnemyHp01);         // 0..1
  
    return vec; // length 29 now
  }

  