import { SubwayGrid } from '../classes/SubwayGrid';
import { PlayerGender } from '../App';
import { getPlayerEmoji } from '../constants/emojis';
import Tile from './Tile';
import './Grid.css';

interface GridProps {
  grid: SubwayGrid;
  onTileClick: (row: number, col: number) => void;
  selectedTile?: { row: number; col: number } | null;
  playerGender: PlayerGender;
  doorsOpen: boolean;
  animationState?: 'idle' | 'slidingIn' | 'slidingOut';
  isTrack?: boolean;
  editMode?: boolean; // If true, all tiles are clickable regardless of eligibility
  onDragStart?: (row: number, col: number, e: React.DragEvent) => void;
  onDragOver?: (row: number, col: number, e: React.DragEvent) => void;
  onDrop?: (row: number, col: number, e: React.DragEvent) => void;
}

export default function Grid({ grid, onTileClick, selectedTile, playerGender, doorsOpen, animationState = 'idle', isTrack = false, editMode = false, onDragStart, onDragOver, onDrop }: GridProps) {
  const isSelected = (row: number, col: number): boolean => {
    return selectedTile !== null && 
           selectedTile !== undefined && 
           selectedTile.row === row && 
           selectedTile.col === col;
  };

  const getAnimationClass = () => {
    if (animationState === 'slidingIn') return 'grid-sliding-in';
    if (animationState === 'slidingOut') return 'grid-sliding-out';
    return '';
  };

  return (
    <div 
      className={`grid-container hide-scrollbar ${getAnimationClass()} ${isTrack ? 'track-container' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
        gridTemplateRows: `repeat(${grid.height}, 1fr)`,
      }}
    >
      {grid.tiles.map((row, rowIndex) =>
        row.map((tile, colIndex) => (
          <Tile
            key={`${rowIndex}-${colIndex}`}
            tile={tile}
            onClick={() => !isTrack && onTileClick(rowIndex, colIndex)}
            isEligible={!isTrack && (editMode || grid.isEligibleSeat(rowIndex, colIndex))}
            isSelected={!isTrack && !editMode && isSelected(rowIndex, colIndex)}
            playerEmoji={!isTrack && !editMode && isSelected(rowIndex, colIndex) ? getPlayerEmoji(playerGender) : undefined}
            colIndex={colIndex}
            gridWidth={grid.width}
            doorsOpen={doorsOpen}
            editMode={editMode}
            draggable={editMode && tile.occupied && tile.person !== undefined}
            onDragStart={editMode && tile.occupied && tile.person !== undefined && onDragStart ? (e) => onDragStart(rowIndex, colIndex, e) : undefined}
            onDragOver={editMode && onDragOver ? (e) => onDragOver(rowIndex, colIndex, e) : undefined}
            onDrop={editMode && onDrop ? (e) => onDrop(rowIndex, colIndex, e) : undefined}
          />
        ))
      )}
    </div>
  );
}

