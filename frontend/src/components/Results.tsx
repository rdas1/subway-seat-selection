import { SubwayGrid } from '../classes/SubwayGrid';
import Tile from './Tile';
import './Grid.css';

interface ResultsProps {
  grid: SubwayGrid;
  selection: { row: number; col: number } | null;
}

export default function Results({ grid, selection }: ResultsProps) {
  const isSelected = (row: number, col: number): boolean => {
    return selection !== null && 
           selection !== undefined && 
           selection.row === row && 
           selection.col === col;
  };

  return (
    <div 
      className="grid-container hide-scrollbar results-container"
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
            onClick={() => {}} // No-op for results view
            isEligible={false} // Not clickable in results
            isSelected={isSelected(rowIndex, colIndex)}
            playerEmoji={undefined} // No emoji in results view
            colIndex={colIndex}
            gridWidth={grid.width}
            doorsOpen={false}
          />
        ))
      )}
    </div>
  );
}

