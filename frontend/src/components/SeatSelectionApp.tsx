import { useState } from 'react';
import { SubwayGrid } from '../classes/SubwayGrid';
import { PlayerGender } from '../App';
import Grid from './Grid';

interface SeatSelectionAppProps {
  initialGrid: SubwayGrid;
  playerGender: PlayerGender;
}

export default function SeatSelectionApp({ initialGrid, playerGender }: SeatSelectionAppProps) {
  const [grid] = useState<SubwayGrid>(initialGrid);
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number } | null>(null);
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
        setSelectedTile(null);
        console.log(`Unselected seat at row ${row}, col ${col}`);
      } else {
        setSelectedTile({ row, col });
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
      />
      {selectedTile && (
        <div className="selection-info">
          <p>Selected seat: Row {selectedTile.row + 1}, Column {selectedTile.col + 1}</p>
        </div>
      )}
    </div>
  );
}

