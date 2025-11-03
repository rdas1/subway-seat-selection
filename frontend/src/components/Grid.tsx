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
}

export default function Grid({ grid, onTileClick, selectedTile, playerGender, doorsOpen }: GridProps) {
  const isSelected = (row: number, col: number): boolean => {
    return selectedTile !== null && 
           selectedTile !== undefined && 
           selectedTile.row === row && 
           selectedTile.col === col;
  };

  return (
    <div 
      className="grid-container hide-scrollbar"
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
            isSelected={isSelected(rowIndex, colIndex)}
            playerEmoji={isSelected(rowIndex, colIndex) ? getPlayerEmoji(playerGender) : undefined}
            colIndex={colIndex}
            gridWidth={grid.width}
            doorsOpen={doorsOpen}
          />
        ))
      )}
    </div>
  );
}

