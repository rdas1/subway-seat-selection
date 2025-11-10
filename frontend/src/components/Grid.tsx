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
}

export default function Grid({ grid, onTileClick, selectedTile, playerGender, doorsOpen, animationState = 'idle', isTrack = false }: GridProps) {
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
            isEligible={!isTrack && grid.isEligibleSeat(rowIndex, colIndex)}
            isSelected={!isTrack && isSelected(rowIndex, colIndex)}
            playerEmoji={!isTrack && isSelected(rowIndex, colIndex) ? getPlayerEmoji(playerGender) : undefined}
            colIndex={colIndex}
            gridWidth={grid.width}
            doorsOpen={doorsOpen}
          />
        ))
      )}
    </div>
  );
}

