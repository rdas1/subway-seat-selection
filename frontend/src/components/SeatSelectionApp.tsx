import { useState, useEffect } from 'react';
import { SubwayGrid } from '../classes/SubwayGrid';
import { PlayerGender } from '../App';
import Grid from './Grid';

interface SeatSelectionAppProps {
  initialGrid: SubwayGrid;
  playerGender: PlayerGender;
  onSelectionChange?: (selectedTile: { row: number; col: number } | null) => void;
  clearSelectionTrigger?: number;
  animationState?: 'idle' | 'slidingIn' | 'slidingOut';
}

export default function SeatSelectionApp({ initialGrid, playerGender, onSelectionChange, clearSelectionTrigger, animationState = 'idle' }: SeatSelectionAppProps) {
  const [grid, setGrid] = useState<SubwayGrid>(initialGrid);
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number } | null>(null);
  
  // Update grid when initialGrid prop changes
  useEffect(() => {
    setGrid(initialGrid);
    setSelectedTile(null); // Clear selection when grid changes
    onSelectionChange?.(null); // Notify parent that selection is cleared
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGrid]);

  // Clear selection when clearSelectionTrigger changes
  useEffect(() => {
    if (clearSelectionTrigger && clearSelectionTrigger > 0 && selectedTile !== null) {
      setSelectedTile(null);
      onSelectionChange?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSelectionTrigger]);
  const [doorsOpen, setDoorsOpen] = useState<boolean>(false);

  // Methods to open and close doors
  const openDoors = () => {
    setDoorsOpen(true);
  };

  const closeDoors = () => {
    setDoorsOpen(false);
  };

  // Expose methods globally for testing (you can call these from browser console)
  (window as any).openDoors = openDoors;
  (window as any).closeDoors = closeDoors;

  const handleTileClick = (row: number, col: number) => {
    if (grid.isEligibleSeat(row, col)) {
      // If clicking the same tile that's already selected, unselect it
      if (selectedTile && selectedTile.row === row && selectedTile.col === col) {
        const newSelection = null;
        setSelectedTile(newSelection);
        onSelectionChange?.(newSelection);
        console.log(`Unselected seat at row ${row}, col ${col}`);
      } else {
        const newSelection = { row, col };
        setSelectedTile(newSelection);
        onSelectionChange?.(newSelection);
        // TODO: Send selection to backend API
        console.log(`Selected seat at row ${row}, col ${col}`);
      }
    }
  };

  return (
    <div className="seat-selection-app">
      <Grid
        grid={grid}
        onTileClick={handleTileClick}
        selectedTile={selectedTile}
        playerGender={playerGender}
        doorsOpen={doorsOpen}
        animationState={animationState}
      />
      {selectedTile && (
        <div className="selection-info">
          <p>Selected seat: Row {selectedTile.row + 1}, Column {selectedTile.col + 1}</p>
        </div>
      )}
    </div>
  );
}

