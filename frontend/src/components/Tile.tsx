import { Tile as TileType } from '../types/grid';
import { EMOJI_MAN, EMOJI_WOMAN, EMOJI_CHILD, EMOJI_NEUTRAL } from '../constants/emojis';
import './Tile.css';

interface TileProps {
  tile: TileType;
  onClick: () => void;
  isEligible: boolean;
  isSelected: boolean;
  playerEmoji?: string;
  colIndex: number;
  gridWidth: number;
  doorsOpen: boolean;
  isPlatformCaution?: boolean;
  editMode?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  draggable?: boolean;
}

export default function Tile({ tile, onClick, isEligible, isSelected, playerEmoji, colIndex, gridWidth, doorsOpen, isPlatformCaution = false, editMode = false, onDragStart, onDragOver, onDrop, draggable = false }: TileProps) {
  const handleClick = () => {
    if (isEligible) {
      onClick();
    }
  };

  const getTileClasses = () => {
    const classes = ['tile'];
    
    if (tile.type === 'floor') {
      classes.push('tile-floor');
    } else if (tile.type === 'barrier') {
      classes.push('tile-barrier');
    } else {
      classes.push('tile-default');
    }
    
    if (isEligible) {
      classes.push('tile-eligible');
    }
    
    if (isSelected) {
      classes.push('tile-selected');
    }
    
    if (tile.occupied) {
      classes.push('tile-occupied');
    }
    
    if (tile.isStanchion) {
      classes.push('tile-stanchion');
    }
    
    if (tile.isDoor && !doorsOpen) {
      classes.push('tile-door');
      // Add specific class for outer edges (only when doors are closed)
      if (colIndex === 0) {
        classes.push('tile-door-left');
      }
      if (colIndex === gridWidth - 1) {
        classes.push('tile-door-right');
      }
    }
    
    if (isPlatformCaution) {
      classes.push('tile-platform-caution');
    }

    return classes.join(' ');
  };

  return (
    <div
      className={getTileClasses()}
      onClick={handleClick}
      role={isEligible ? 'button' : undefined}
      tabIndex={isEligible ? 0 : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-label={
        isEligible
          ? `Available ${tile.type === 'floor' ? 'floor' : tile.type === 'barrier' ? 'barrier' : 'seat'} - click to select`
          : tile.occupied
          ? `Occupied ${tile.type === 'floor' ? 'floor' : tile.type === 'barrier' ? 'barrier' : 'seat'}`
          : tile.type === 'floor'
          ? 'Floor'
          : tile.type === 'barrier'
          ? 'Barrier'
          : 'Seat'
      }
    >
      {isSelected && playerEmoji && (
        <span className="tile-person" aria-label="You">
          {playerEmoji}
        </span>
      )}
      {!isSelected && tile.occupied && tile.person && (
        <span className="tile-person" aria-label={tile.person}>
          {tile.person === 'man' ? EMOJI_MAN : tile.person === 'woman' ? EMOJI_WOMAN : tile.person === 'neutral' ? EMOJI_NEUTRAL : EMOJI_CHILD}
        </span>
      )}
    </div>
  );
}

