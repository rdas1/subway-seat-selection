import { SubwayGrid } from '../classes/SubwayGrid';
import { Tile } from '../types/grid';

// Sample grid: 20 rows x 5 columns
// Columns 0 and 4: benches (vertical - 3 seats, gap 2, 10 seats, gap 2, 3 seats)
// Columns 1, 2, and 3: aisle (all floor tiles)
export const createSampleGrid1 = (percentFilled: number = 0.6): SubwayGrid => {
  const tiles: Tile[][] = [];
  
  // Create 20 rows
  for (let row = 0; row < 20; row++) {
    const rowTiles: Tile[] = [];
    
    // Column 0: First bench column (seats in rows 0-2, 5-14, 17-19; floor in rows 3-4, 15-16)
    if (row >= 0 && row <= 2) {
      // First 3-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: false // Will be populated randomly later
      });
    } else if (row >= 3 && row <= 4) {
      // Door gap - left side (rows 3-4, column 0)
      rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
    } else if (row >= 5 && row <= 14) {
      // 10-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: false // Will be populated randomly later
      });
    } else if (row >= 15 && row <= 16) {
      // Door gap - left side (rows 15-16, column 0)
      rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
    } else if (row >= 17 && row <= 19) {
      // Last 3-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: false // Will be populated randomly later
      });
    }
    
    // Columns 1, 2, and 3: Aisle (all floor tiles)
    rowTiles.push({ type: 'floor', occupied: false });
    
    // Column 2: Middle column with stanchions (roughly every 3 rows)
    const isStanchionRow = row % 3 === 2; // Rows 2, 5, 8, 11, 14, 17 (0-indexed)
    rowTiles.push({ 
      type: 'floor', 
      occupied: false,
      isStanchion: isStanchionRow
    });
    
    rowTiles.push({ type: 'floor', occupied: false });
    
    // Column 4: Last bench column (seats in rows 0-2, 5-14, 17-19; floor in rows 3-4, 15-16)
    if (row >= 0 && row <= 2) {
      // First 3-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: false // Will be populated randomly later
      });
    } else if (row >= 3 && row <= 4) {
      // Door gap - right side (rows 3-4, column 4)
      rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
    } else if (row >= 5 && row <= 14) {
      // 10-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: false // Will be populated randomly later
      });
    } else if (row >= 15 && row <= 16) {
      // Door gap - right side (rows 15-16, column 4)
      rowTiles.push({ type: 'floor', occupied: false, isDoor: true });
    } else if (row >= 17 && row <= 19) {
      // Last 3-seat bench
      rowTiles.push({ 
        type: 'seat', 
        occupied: false // Will be populated randomly later
      });
    }
    
    tiles.push(rowTiles);
  }

  // Now randomly populate seats and floor tiles based on percentFilled
  const personTypes: ('man' | 'woman')[] = ['man', 'woman'];
  const seatTiles: { row: number; col: number; tile: Tile }[] = [];
  const floorTiles: { row: number; col: number; tile: Tile }[] = [];
  
  // Collect all seat tiles and floor tiles (excluding door tiles)
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 5; col++) {
      const tile = tiles[row][col];
      if (tile.type === 'seat') {
        seatTiles.push({ row, col, tile });
      } else if (tile.type === 'floor' && !tile.isDoor && !tile.isStanchion) {
        // Only non-door, non-stanchion floor tiles can be occupied
        floorTiles.push({ row, col, tile });
      }
    }
  }
  
  // Randomly shuffle and select seats to fill
  const numSeatsToFill = Math.floor(seatTiles.length * percentFilled);
  
  // Shuffle seat array using Fisher-Yates algorithm
  for (let i = seatTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [seatTiles[i], seatTiles[j]] = [seatTiles[j], seatTiles[i]];
  }
  
  // Fill the selected seats with random people
  for (let i = 0; i < numSeatsToFill; i++) {
    const { row, col } = seatTiles[i];
    const randomPerson = personTypes[Math.floor(Math.random() * personTypes.length)];
    tiles[row][col] = {
      ...tiles[row][col],
      occupied: true,
      person: randomPerson
    };
  }

  // Randomly populate some floor tiles (fewer than seats - about 10% of floor tiles)
  const floorPercentFilled = 0.1; // 10% of floor tiles
  const numFloorTilesToFill = Math.floor(floorTiles.length * floorPercentFilled);
  
  // Shuffle floor array using Fisher-Yates algorithm
  for (let i = floorTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [floorTiles[i], floorTiles[j]] = [floorTiles[j], floorTiles[i]];
  }
  
  // Fill the selected floor tiles with random people
  for (let i = 0; i < numFloorTilesToFill; i++) {
    const { row, col } = floorTiles[i];
    const randomPerson = personTypes[Math.floor(Math.random() * personTypes.length)];
    tiles[row][col] = {
      ...tiles[row][col],
      occupied: true,
      person: randomPerson
    };
  }

  return new SubwayGrid(20, 5, tiles);
};

export const sampleGrid = createSampleGrid1();
