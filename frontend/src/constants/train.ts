// Train arrival delay constants
export const TRAIN_ARRIVAL_DELAY_MIN = 3; // Minimum seconds before train arrives
export const TRAIN_ARRIVAL_DELAY_MAX = 5; // Maximum seconds before train arrives

/**
 * Generates a random delay for train arrival between min and max seconds (inclusive)
 */
export const getRandomTrainDelay = (): number => {
  return Math.floor(Math.random() * (TRAIN_ARRIVAL_DELAY_MAX - TRAIN_ARRIVAL_DELAY_MIN + 1)) + TRAIN_ARRIVAL_DELAY_MIN;
};

