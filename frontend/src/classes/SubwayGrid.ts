import { Tile } from '../types/grid';

export class SubwayGrid {
  height: number;
  width: number;
  tiles: Tile[][];

  constructor(height: number, width: number, tiles: Tile[][]) {
    this.height = height;
    this.width = width;
    this.tiles = tiles;
  }

  getTile(row: number, col: number): Tile | null {
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
      return null;
    }
    return this.tiles[row][col];
  }

  isEligibleSeat(row: number, col: number): boolean {
    const tile = this.getTile(row, col);
    return tile !== null && tile.type !== 'barrier' && !tile.occupied && !tile.isStanchion;
  }
}

