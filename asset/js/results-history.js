'use strict';

    // ========================================
    // CLASSE RESULTSHISTORY
    // ========================================
    class ResultsHistory {
      constructor() {
        this.storageKey = STORAGE_KEYS.RESULTS_HISTORY || 'resultsHistory';
        this.lastResult = null;
        
        // Charger le dernier résultat depuis le localStorage
        this.loadFromStorage();
        
        // Écouter les événements de résultat
        this.bindWheelEvents();
        
        // Initialiser l'affichage
        this.updateDisplay();
      }

      /**
       * Charge le dernier résultat depuis le localStorage
       */
      loadFromStorage() {
        const stored = Utils.storage.get(this.storageKey);
        
        // Si c'est un ancien format (array d'objets), extraire le texte
        if (Array.isArray(stored) && stored.length > 0 && stored[0].text) {
          this.lastResult = stored[0].text;
          this.saveToStorage(); // Sauvegarder au nouveau format
        } 
        // Si c'est déjà une string, l'utiliser directement
        else if (typeof stored === 'string') {
          this.lastResult = stored;
        }
        // Sinon, pas de résultat
        else {
          this.lastResult = null;
        }
      }

      /**
       * Sauvegarde le dernier résultat dans le localStorage
       */
      saveToStorage() {
        Utils.storage.setString(this.storageKey, this.lastResult || '');
      }

      /**
       * Écoute les événements de résultat de la roue
       */
      bindWheelEvents() {
        document.addEventListener('wheel:result', (e) => {
          if (e.detail && e.detail.text) {
            this.lastResult = e.detail.text;
            this.saveToStorage();
            this.updateDisplay();
          }
        });
        
        // Écouter les changements d'état de la roue pour masquer/afficher le compteur
        document.addEventListener('wheel:stateChanged', () => {
          this.updateDisplay();
        });
      }

      /**
       * Met à jour l'affichage du dernier résultat
       */
      updateDisplay() {
        const counterElement = document.getElementById('last-result-counter');
        const counterValue = document.getElementById('last-result-value');
        
        if (!counterElement || !counterValue) return;

        // Récupérer l'instance de la roue
        const wheelApp = window.wheelAppInstance;
        if (!wheelApp || !wheelApp.wheel) return;

        const wheel = wheelApp.wheel;
        const hasOptions = !wheel.usesDefaultOptions && wheel.baseOptions.length > 0;
        const hasResult = this.lastResult && this.lastResult.trim() !== '';

        // Afficher seulement si on a des options ET un résultat
        if (hasOptions && hasResult) {
          counterValue.textContent = this.lastResult;
          counterElement.classList.add('show');
        } else {
          counterValue.textContent = '-';
          counterElement.classList.remove('show');
        }
      }
    }

