import { useState, useEffect } from 'react';
import { SubwayGrid } from '../classes/SubwayGrid';
import { PlayerGender } from '../App';
import Grid from './Grid';
import Platform from './Platform';
import { createPlatformGrid, createSampleGrid1 } from '../data/sampleGrids';

interface SeatSelectionAppProps {
  initialGrid: SubwayGrid | null;
  playerGender: PlayerGender;
  onSelectionChange?: (selectedTile: { row: number; col: number } | null) => void;
  onSelectionTypeChange?: (selectionType: 'train' | 'platform' | null) => void;
  clearSelectionTrigger?: number;
  platformRecreateTrigger?: number;
  animationState?: 'idle' | 'slidingIn' | 'slidingOut';
  showTrain?: boolean;
}

export default function SeatSelectionApp({ initialGrid, playerGender, onSelectionChange, onSelectionTypeChange, clearSelectionTrigger, platformRecreateTrigger, animationState = 'idle', showTrain = true }: SeatSelectionAppProps) {
  const [grid, setGrid] = useState<SubwayGrid | null>(initialGrid);
  const [platformGrid, setPlatformGrid] = useState<SubwayGrid>(() => {
    const height = initialGrid?.height ?? 20; // Default height if no grid
    return createPlatformGrid(height, 3, 0.1);
  });
  
  // Create track grid (transparent placeholder) with same dimensions as train grid
  const getTrackGrid = (): SubwayGrid | null => {
    // Use current grid if available, otherwise use initialGrid, or create default
    const referenceGrid = grid || initialGrid;
    if (referenceGrid) {
      // Create empty grid with same dimensions
      return createSampleGrid1(0); // Empty grid with same structure
    }
    // Use default dimensions if no grid yet
    return createSampleGrid1(0); // Default 20x5 grid for track
  };
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number } | null>(null);
  // Remember last selected platform position (default: row 3, col 2 - 4th row, 3rd column)
  const [lastPlatformPosition, setLastPlatformPosition] = useState<{ row: number; col: number }>({ row: 3, col: 2 });
  // Initialize platform selection with default position
  const [selectedPlatformTile, setSelectedPlatformTile] = useState<{ row: number; col: number } | null>(() => {
    const defaultPos = { row: 3, col: 2 };
    const height = initialGrid?.height ?? 20;
    if (defaultPos.row < height && defaultPos.col < 3) {
      const platformGrid = createPlatformGrid(height, 3, 0.1);
      if (platformGrid.isEligibleSeat(defaultPos.row, defaultPos.col)) {
        return defaultPos;
      }
    }
    return null;
  });
  const [selectionType, setSelectionType] = useState<'train' | 'platform' | null>(selectedPlatformTile ? 'platform' : null);
  
  // Notify parent when selection type changes
  useEffect(() => {
    onSelectionTypeChange?.(selectionType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionType]);
  
  // Initialize platform selection on mount
  useEffect(() => {
    if (selectedPlatformTile) {
      onSelectionChange?.(selectedPlatformTile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Recreate platform when platformRecreateTrigger changes (when train leaves)
  useEffect(() => {
    if (platformRecreateTrigger && platformRecreateTrigger > 0) {
      // Recreate platform grid
      const height = initialGrid?.height ?? platformGrid.height ?? 20;
      const newPlatformGrid = createPlatformGrid(height, 3, 0.1);
      setPlatformGrid(newPlatformGrid);
      
      // Initialize platform selection to last remembered position (or default)
      const defaultRow = lastPlatformPosition.row;
      const defaultCol = lastPlatformPosition.col;
      if (defaultRow < newPlatformGrid.height && defaultCol < newPlatformGrid.width && 
          newPlatformGrid.isEligibleSeat(defaultRow, defaultCol)) {
        setSelectedPlatformTile({ row: defaultRow, col: defaultCol });
        setSelectionType('platform');
        onSelectionChange?.({ row: defaultRow, col: defaultCol });
      } else {
        // Fallback to default position if remembered position is invalid
        const fallbackRow = 3;
        const fallbackCol = 2;
        if (fallbackRow < newPlatformGrid.height && fallbackCol < newPlatformGrid.width && 
            newPlatformGrid.isEligibleSeat(fallbackRow, fallbackCol)) {
          setSelectedPlatformTile({ row: fallbackRow, col: fallbackCol });
          setSelectionType('platform');
          onSelectionChange?.({ row: fallbackRow, col: fallbackCol });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformRecreateTrigger]);

  // Update grid when initialGrid prop changes (when train arrives)
  useEffect(() => {
    setGrid(initialGrid);
    setSelectedTile(null); // Clear train selection when grid changes
    // Don't recreate platform here - only when train leaves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGrid]);

  // Clear selection when clearSelectionTrigger changes
  useEffect(() => {
    if (clearSelectionTrigger && clearSelectionTrigger > 0) {
      setSelectedTile(null);
      // Restore platform selection when clearing
      if (lastPlatformPosition) {
        setSelectedPlatformTile(lastPlatformPosition);
        setSelectionType('platform');
        onSelectionChange?.(lastPlatformPosition);
      } else {
        setSelectedPlatformTile(null);
        setSelectionType(null);
        onSelectionChange?.(null);
      }
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

  // Open doors after train slides in
  useEffect(() => {
    if (animationState === 'slidingIn') {
      // Wait for animation to complete (600ms) then open doors
      const timer = setTimeout(() => {
        console.log('Opening doors');
        openDoors();
      }, 610);
      return () => clearTimeout(timer);
    }
  }, [animationState]);

  const handleTileClick = (row: number, col: number) => {
    if (grid && grid.isEligibleSeat(row, col)) {
      // If clicking the same tile that's already selected, unselect it
      if (selectedTile && selectedTile.row === row && selectedTile.col === col && selectionType === 'train') {
        const newSelection = null;
        setSelectedTile(newSelection);
        // Restore platform selection when unselecting train
        if (lastPlatformPosition) {
          setSelectedPlatformTile(lastPlatformPosition);
          setSelectionType('platform');
          onSelectionChange?.(lastPlatformPosition);
        } else {
          setSelectedPlatformTile(null);
          setSelectionType(null);
          onSelectionChange?.(newSelection);
        }
        console.log(`Unselected seat at row ${row}, col ${col}`);
      } else {
        const newSelection = { row, col };
        setSelectedTile(newSelection);
        // Remember current platform selection before clearing it
        if (selectedPlatformTile) {
          setLastPlatformPosition(selectedPlatformTile);
        }
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
        setLastPlatformPosition(newSelection); // Remember this platform position
        setSelectedTile(null);
        setSelectionType('platform');
        onSelectionChange?.(newSelection);
        // TODO: Send selection to backend API
        console.log(`Selected platform position at row ${row}, col ${col}`);
      }
    }
  };

  const trackGrid = getTrackGrid();
  
  return (
    <div className="seat-selection-app">
      <div className="grids-container">
        {showTrain && grid ? (
          <Grid
            grid={grid}
            onTileClick={handleTileClick}
            selectedTile={selectedTile}
            playerGender={playerGender}
            doorsOpen={doorsOpen}
            animationState={animationState}
          />
        ) : trackGrid ? (
          <Grid
            grid={trackGrid}
            onTileClick={() => {}} // No-op for track
            selectedTile={null}
            playerGender={playerGender}
            doorsOpen={false}
            animationState="idle"
            isTrack={true}
          />
        ) : null}
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

