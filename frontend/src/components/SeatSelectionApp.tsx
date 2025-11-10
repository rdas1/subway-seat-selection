import { useState, useEffect } from 'react';
import { SubwayGrid } from '../classes/SubwayGrid';
import { PlayerGender } from '../App';
import Grid from './Grid';
import Platform from './Platform';
import { createPlatformGrid } from '../data/sampleGrids';

interface SeatSelectionAppProps {
  initialGrid: SubwayGrid;
  playerGender: PlayerGender;
  onSelectionChange?: (selectedTile: { row: number; col: number } | null) => void;
  clearSelectionTrigger?: number;
  animationState?: 'idle' | 'slidingIn' | 'slidingOut';
}

export default function SeatSelectionApp({ initialGrid, playerGender, onSelectionChange, clearSelectionTrigger, animationState = 'idle' }: SeatSelectionAppProps) {
  const [grid, setGrid] = useState<SubwayGrid>(initialGrid);
  const [platformGrid, setPlatformGrid] = useState<SubwayGrid>(createPlatformGrid(initialGrid.height, 3, 0.1));
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number } | null>(null);
  const [selectedPlatformTile, setSelectedPlatformTile] = useState<{ row: number; col: number } | null>(null);
  const [selectionType, setSelectionType] = useState<'train' | 'platform' | null>(null);
  
  // Update grid when initialGrid prop changes
  useEffect(() => {
    setGrid(initialGrid);
    setPlatformGrid(createPlatformGrid(initialGrid.height, 3, 0.1));
    setSelectedTile(null); // Clear selection when grid changes
    setSelectedPlatformTile(null);
    setSelectionType(null);
    onSelectionChange?.(null); // Notify parent that selection is cleared
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGrid]);

  // Clear selection when clearSelectionTrigger changes
  useEffect(() => {
    if (clearSelectionTrigger && clearSelectionTrigger > 0) {
      setSelectedTile(null);
      setSelectedPlatformTile(null);
      setSelectionType(null);
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
      if (selectedTile && selectedTile.row === row && selectedTile.col === col && selectionType === 'train') {
        const newSelection = null;
        setSelectedTile(newSelection);
        setSelectedPlatformTile(null);
        setSelectionType(null);
        onSelectionChange?.(newSelection);
        console.log(`Unselected seat at row ${row}, col ${col}`);
      } else {
        const newSelection = { row, col };
        setSelectedTile(newSelection);
        setSelectedPlatformTile(null);
        setSelectionType('train');
        onSelectionChange?.(newSelection);
        // TODO: Send selection to backend API
        console.log(`Selected seat at row ${row}, col ${col}`);
      }
    }
  };

  const handlePlatformTileClick = (row: number, col: number) => {
    if (platformGrid.isEligibleSeat(row, col)) {
      // If clicking the same tile that's already selected, unselect it
      if (selectedPlatformTile && selectedPlatformTile.row === row && selectedPlatformTile.col === col && selectionType === 'platform') {
        const newSelection = null;
        setSelectedPlatformTile(newSelection);
        setSelectedTile(null);
        setSelectionType(null);
        onSelectionChange?.(newSelection);
        console.log(`Unselected platform position at row ${row}, col ${col}`);
      } else {
        const newSelection = { row, col };
        setSelectedPlatformTile(newSelection);
        setSelectedTile(null);
        setSelectionType('platform');
        onSelectionChange?.(newSelection);
        // TODO: Send selection to backend API
        console.log(`Selected platform position at row ${row}, col ${col}`);
      }
    }
  };

  return (
    <div className="seat-selection-app">
      <div className="grids-container">
        <Grid
          grid={grid}
          onTileClick={handleTileClick}
          selectedTile={selectedTile}
          playerGender={playerGender}
          doorsOpen={doorsOpen}
          animationState={animationState}
        />
        <Platform
          grid={platformGrid}
          onTileClick={handlePlatformTileClick}
          selectedTile={selectedPlatformTile}
          playerGender={playerGender}
          doorsOpen={doorsOpen}
          animationState="idle"
        />
      </div>
      {(selectedTile || selectedPlatformTile) && (
        <div className="selection-info">
          {selectedTile && (
            <p>Selected seat: Row {selectedTile.row + 1}, Column {selectedTile.col + 1}</p>
          )}
          {selectedPlatformTile && (
            <p>Selected platform position: Row {selectedPlatformTile.row + 1}, Column {selectedPlatformTile.col + 1}</p>
          )}
        </div>
      )}
    </div>
  );
}

