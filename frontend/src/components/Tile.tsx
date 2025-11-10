import { Tile as TileType } from '../types/grid';
import { EMOJI_MAN, EMOJI_WOMAN, EMOJI_CHILD } from '../constants/emojis';
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
}

export default function Tile({ tile, onClick, isEligible, isSelected, playerEmoji, colIndex, gridWidth, doorsOpen, isPlatformCaution = false }: TileProps) {
  const handleClick = () => {
    if (isEligible) {
      onClick();
    }
  };

  const getTileClasses = () => {
    const classes = ['tile'];
    
    if (tile.type === 'floor') {
      classes.push('tile-floor');
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
      aria-label={
        isEligible
          ? `Available ${tile.type === 'floor' ? 'floor' : 'seat'} - click to select`
          : tile.occupied
          ? `Occupied ${tile.type === 'floor' ? 'floor' : 'seat'}`
          : tile.type === 'floor'
          ? 'Floor'
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
          {tile.person === 'man' ? EMOJI_MAN : tile.person === 'woman' ? EMOJI_WOMAN : EMOJI_CHILD}
        </span>
      )}
    </div>
  );
}

