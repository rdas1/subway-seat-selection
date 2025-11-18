import { SubwayGrid } from '../classes/SubwayGrid';
import { PlayerGender } from '../App';
import { getPlayerEmoji } from '../constants/emojis';
import Tile from './Tile';
import './Grid.css';

interface PlatformProps {
  grid: SubwayGrid;
  onTileClick: (row: number, col: number) => void;
  selectedTile?: { row: number; col: number } | null;
  playerGender: PlayerGender;
  doorsOpen: boolean;
  animationState?: 'idle' | 'slidingIn' | 'slidingOut';
  hideUserIndicator?: boolean;
}

export default function Platform({ grid, onTileClick, selectedTile, playerGender, doorsOpen, animationState = 'idle', hideUserIndicator = false }: PlatformProps) {
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
      className={`grid-container platform-container hide-scrollbar ${getAnimationClass()}`}
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
            onClick={() => onTileClick(rowIndex, colIndex)}
            isEligible={grid.isEligibleSeat(rowIndex, colIndex)}
            isSelected={!hideUserIndicator && isSelected(rowIndex, colIndex)}
            playerEmoji={!hideUserIndicator && isSelected(rowIndex, colIndex) ? getPlayerEmoji(playerGender) : undefined}
            colIndex={colIndex}
            gridWidth={grid.width}
            doorsOpen={doorsOpen}
            isPlatformCaution={colIndex === 0}
          />
        ))
      )}
    </div>
  );
}

