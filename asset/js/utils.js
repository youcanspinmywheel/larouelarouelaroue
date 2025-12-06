'use strict';

// ========================================
// UTILITAIRES
// ========================================
const Utils = {
  /**
   * Normalise une option en objet
   */
  normalizeOption(opt) {
    if (typeof opt === 'string') {
      return { text: opt, boosted: false, multiplier: 1 };
    }
    return {
      text: opt.text,
      boosted: !!opt.boosted,
      multiplier: opt.multiplier && opt.multiplier > 0 ? opt.multiplier : 1
    };
  },

  /**
   * Génère un ID unique
   */
  generateId() {
    return `wheel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Gestion sécurisée du localStorage
   */
  storage: {
    get(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (e) {
        console.error(`Erreur lors de la lecture de ${key}:`, e);
        return defaultValue;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.error(`Erreur lors de l'écriture de ${key}:`, e);
        return false;
      }
    },

    getString(key, defaultValue = null) {
      try {
        return localStorage.getItem(key) || defaultValue;
      } catch (e) {
        console.error(`Erreur lors de la lecture de ${key}:`, e);
        return defaultValue;
      }
    },

    setString(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        console.error(`Erreur lors de l'écriture de ${key}:`, e);
        return false;
      }
    }
  }
};

