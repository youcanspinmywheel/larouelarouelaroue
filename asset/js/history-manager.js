'use strict';

    // ========================================
    // CLASSE HISTORYMANAGER (UNDO/REDO)
    // ========================================
    class HistoryManager {
      constructor(wheelInstance, maxHistorySize = 50) {
        this.wheel = wheelInstance;
        this.maxHistorySize = maxHistorySize;
        
        // Piles d'historique
        this.undoStack = [];
        this.redoStack = [];
        
        // État actuel
        this.isRestoring = false;
        
        // Sauvegarder l'état initial
        this.saveState('initial');
        
        // Écouter les changements d'état de la roue
        this.bindWheelEvents();
        
        // Écouter les raccourcis clavier
        this.bindKeyboardShortcuts();
      }

      /**
       * Écoute les événements de changement d'état de la roue
       */
      bindWheelEvents() {
        document.addEventListener('wheel:stateChanged', (e) => {
          this.saveState(e.detail || 'modify');
        });
      }

      /**
       * Sauvegarde l'état actuel dans l'historique
       */
      saveState(actionType = 'modify') {
        // Ne pas sauvegarder si on est en train de restaurer un état
        if (this.isRestoring) return;
        
        const state = {
          timestamp: Date.now(),
          actionType: actionType,
          options: JSON.parse(JSON.stringify(this.wheel.baseOptions)),
          usesDefaultOptions: this.wheel.usesDefaultOptions,
          suspenseMultiplier: this.wheel.suspenseMultiplier
        };
        
        // Ne pas sauvegarder un état identique au dernier
        if (this.undoStack.length > 0) {
          const lastState = this.undoStack[this.undoStack.length - 1];
          if (JSON.stringify(lastState.options) === JSON.stringify(state.options) &&
              lastState.usesDefaultOptions === state.usesDefaultOptions) {
            return;
          }
        }
        
        this.undoStack.push(state);
        
        // Limiter la taille de l'historique
        if (this.undoStack.length > this.maxHistorySize) {
          this.undoStack.shift();
        }
        
        // Vider la pile redo quand une nouvelle action est effectuée
        this.redoStack = [];
        
        this.updateUI();
      }

      /**
       * Annule la dernière action (Undo)
       */
      undo() {
        if (!this.canUndo()) {
          return;
        }
        
        // Sauvegarder l'état actuel dans la pile redo
        const currentState = {
          timestamp: Date.now(),
          actionType: 'current',
          options: JSON.parse(JSON.stringify(this.wheel.baseOptions)),
          usesDefaultOptions: this.wheel.usesDefaultOptions,
          suspenseMultiplier: this.wheel.suspenseMultiplier
        };
        this.redoStack.push(currentState);
        
        // Retirer l'état actuel de la pile undo
        this.undoStack.pop();
        
        // Restaurer l'état précédent
        const previousState = this.undoStack[this.undoStack.length - 1];
        this.restoreState(previousState);
        
        this.showNotification('Action annulée ↶');
        this.updateUI();
      }

      /**
       * Refait la dernière action annulée (Redo)
       */
      redo() {
        if (this.redoStack.length === 0) {
          this.showNotification('Aucune action à refaire', true);
          return;
        }
        
        // Récupérer l'état à restaurer
        const nextState = this.redoStack.pop();
        
        // Ajouter l'état actuel à la pile undo
        this.undoStack.push(nextState);
        
        // Restaurer l'état
        this.restoreState(nextState);
        
        this.showNotification('Action refaite ↷');
        this.updateUI();
      }

      /**
       * Restaure un état donné
       */
      restoreState(state) {
        this.isRestoring = true;
        
        // Si l'état est le mode par défaut (DRAMAS)
        if (state.usesDefaultOptions) {
          this.wheel.usesDefaultOptions = true;
          this.wheel.baseOptions = this.wheel.defaultOptions.map((opt) => ({ ...opt }));
        } else {
          this.wheel.usesDefaultOptions = false;
          this.wheel.baseOptions = JSON.parse(JSON.stringify(state.options));
        }
        
        this.wheel.suspenseMultiplier = state.suspenseMultiplier || 1;
        
        // Mettre à jour le slider de suspense
        const slider = document.getElementById('suspense-slider');
        const valueDisplay = document.getElementById('suspense-value');
        if (slider) {
          slider.value = this.wheel.suspenseMultiplier;
        }
        if (valueDisplay) {
          valueDisplay.textContent = `x${this.wheel.suspenseMultiplier}`;
        }
        
        this.wheel.applySuspenseMultiplier();
        
        this.isRestoring = false;
      }

      /**
       * Vide l'historique
       */
      clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.saveState('initial');
        this.updateUI();
      }

      /**
       * Met à jour l'interface (boutons undo/redo)
       */
      updateUI() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
          const canUndo = this.canUndo();
          undoBtn.disabled = !canUndo;
          undoBtn.style.opacity = canUndo ? '1' : '0.2';
        }
        
        if (redoBtn) {
          redoBtn.disabled = this.redoStack.length === 0;
          redoBtn.style.opacity = this.redoStack.length === 0 ? '0.2' : '1';
        }
      }

      /**
       * Vérifie si on peut annuler (sans revenir à un état vide)
       */
      canUndo() {
        // Besoin d'au moins 2 états pour pouvoir annuler
        if (this.undoStack.length <= 1) {
          return false;
        }
        
        // Si on est actuellement en mode par défaut, on ne peut pas annuler
        if (this.wheel.usesDefaultOptions) {
          return false;
        }
        
        return true;
      }

      /**
       * Écoute les raccourcis clavier (Ctrl+Z, Ctrl+Y)
       */
      bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
          // Ignorer si on est dans un input ou textarea
          if (e.target.tagName === 'INPUT' || 
              e.target.tagName === 'TEXTAREA' || 
              e.target.isContentEditable) {
            return;
          }
          
          // Ctrl+Z ou Cmd+Z : Undo
          if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
          }
          
          // Ctrl+Y ou Cmd+Y ou Ctrl+Shift+Z : Redo
          if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            this.redo();
          }
        });
      }

      /**
       * Affiche une notification temporaire
       */
      showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: ${isError ? '#f496ad' : '#e3b9ff'};
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          border: 2px solid rgba(255, 255, 255, 0.5);
          font-size: 14px;
          font-weight: 600;
          z-index: 10001;
          box-shadow: 0 4px 12px rgba(203, 97, 163, 0.4);
          animation: slideUp 0.3s ease-out;
        `;

        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transition = 'opacity 0.3s';
          setTimeout(() => {
            document.body.removeChild(notification);
            document.head.removeChild(style);
          }, 300);
        }, 2000);
      }
    }

