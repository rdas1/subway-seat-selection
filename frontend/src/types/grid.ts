export type TileType = 'seat' | 'floor';

export type PersonType = 'man' | 'woman' | 'child' | null;

export interface Tile {
  type: TileType;
  occupied: boolean;
  person?: PersonType;
  isDoor?: boolean; // Indicates if this tile is a door
  isStanchion?: boolean; // Indicates if this tile has a stanchion
}

