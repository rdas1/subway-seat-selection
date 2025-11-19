// Emoji constants for player gender selection
export const EMOJI_MAN = '👨';
export const EMOJI_WOMAN = '👩';
export const EMOJI_NEUTRAL = '🧑';
export const EMOJI_BLANK = '👤';

// Emoji constants for occupied seats (from grid data)
export const EMOJI_CHILD = '👶';

// Utility function to get emoji for player gender
import { PlayerGender } from '../App';

export const getPlayerEmoji = (gender: PlayerGender): string => {
  switch (gender) {
    case 'man':
      return EMOJI_MAN;
    case 'woman':
      return EMOJI_WOMAN;
    case 'neutral':
      return EMOJI_NEUTRAL;
    case 'prefer-not-to-say':
      return EMOJI_BLANK;
    default:
      return EMOJI_BLANK;
  }
};

