import { SubwayGrid } from '../classes/SubwayGrid';
import { Tile } from '../types/grid';

// Sample grid: 20 rows x 4 columns
// Columns 0 and 3: benches (vertical - 3 seats, gap 2, 10 seats, gap 2, 3 seats)
// Columns 1 and 2: aisle (all floor tiles)
const createSampleGrid1 = (): SubwayGrid => {
  const tiles: Tile[][] = [];
  
  // Create 20 rows
  for (let row = 0; row < 20; row++) {
    const rowTiles: Tile[] = [];
    
    // Column 0: First bench column (seats in rows 0-2, 5-14, 17-19; floor in rows 3-4, 15-16)
    if (row >= 0 && row <= 2) {
      // First 3-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: row === 1,
        person: row === 1 ? 'woman' : undefined
      });
    } else if (row >= 3 && row <= 4) {
      // Door gap - left side (rows 3-4, column 0)
      rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
    } else if (row >= 5 && row <= 14) {
      // 10-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: row === 6 || row === 9,
        person: row === 6 ? 'man' : row === 9 ? 'child' : undefined
      });
    } else if (row >= 15 && row <= 16) {
      // Door gap - left side (rows 15-16, column 0)
      rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
    } else if (row >= 17 && row <= 19) {
      // Last 3-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: row === 18,
        person: row === 18 ? 'woman' : undefined
      });
    }
    
    // Columns 1 and 2: Aisle (all floor tiles)
    rowTiles.push({ type: 'floor', occupied: false });
    rowTiles.push({ type: 'floor', occupied: false });
    
    // Column 3: Last bench column (seats in rows 0-2, 5-14, 17-19; floor in rows 3-4, 15-16)
    if (row >= 0 && row <= 2) {
      // First 3-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: row === 2,
        person: row === 2 ? 'man' : undefined
      });
    } else if (row >= 3 && row <= 4) {
      // Door gap - right side (rows 3-4, column 3)
      rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
    } else if (row >= 5 && row <= 14) {
      // 10-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: row === 8,
        person: row === 8 ? 'woman' : undefined
      });
    } else if (row >= 15 && row <= 16) {
      // Door gap - right side (rows 15-16, column 3)
      rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
    } else if (row >= 17 && row <= 19) {
      // Last 3-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: false
      });
    }
    
    tiles.push(rowTiles);
  }

  return new SubwayGrid(20, 4, tiles);
};

export const sampleGrid = createSampleGrid1();
