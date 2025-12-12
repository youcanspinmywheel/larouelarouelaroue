'use strict';

// ========================================
// CONSTANTES
// ========================================
const STORAGE_KEYS = {
  SAVED_WHEELS: 'toto-saved-wheels',
  LAST_BACKGROUND: 'wheel-last-background',
  LAST_TITLE: 'wheel-last-title',
  UNSAVED_STATE: 'wheel-unsaved-state',
  RESULTS_HISTORY: 'wheel-results-history'
};

const WHEEL_CONFIG = {
  COLORS: [
    '#ece9f9', '#ddd8f0', '#fde4cf', '#ffcfd2', '#f1c0e8', '#cfbaf0',
    '#a3c4f3', '#90dbf4', '#8eecf5', '#98f5e1', '#b9fbc0'
  ],
  ROTATION_SPEED: 0.002,
  SPIN_DURATION: 3000,
  MIN_EXTRA_SPINS: 4,
  MAX_EXTRA_SPINS: 7,
  TICK_SOUND_URL: 'asset/sounds/bip.mp3',
  TICK_SOUND_VOLUME: 0.3
};

const ANIMATION_CONFIG = {
  CONFETTI_COUNT: 150,
  CONFETTI_COLORS: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da', '#fcbad3', '#a8e6cf']
};

