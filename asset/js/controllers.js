'use strict';

    /**
     * Gère l'input pour ajouter des options à la roue.
     */
    // ========================================
    // CLASSE OPTIONINPUTCONTROLLER
    // ========================================
    class OptionInputController {
      constructor(wheelInstance, inputId = 'entry-input') {
        this.wheel = wheelInstance;
        this.input = document.getElementById(inputId);
        
        if (this.input) {
          this.bindEvents();
        }
      }

      bindEvents() {
        this.input.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;

          const value = this.input.value.trim();
          if (!value) return;

          this.wheel.addOption(value);
          this.input.value = '';
        });
      }
    }

    /**
     * Gère le slider de suspense pour dupliquer les options.
     */
    // ========================================
    // CLASSE SUSPENSESLIDERCONTROLLER
    // ========================================
    class SuspenseSliderController {
      constructor(wheelInstance) {
        this.wheel = wheelInstance;
        this.slider = document.getElementById('suspense-slider');
        this.valueDisplay = document.getElementById('suspense-value');
        
        if (this.slider && this.valueDisplay) {
          this.bindEvents();
        }
      }

      bindEvents() {
        this.slider.addEventListener('input', (event) => {
          const value = parseInt(event.target.value);
          this.valueDisplay.textContent = `x${value}`;
          this.wheel.setSuspenseMultiplier(value);
        });
      }
    }

    /**
     * Gère le bouton de spin et l'affichage du résultat.
     */
    // ========================================
    // CLASSE SPINCONTROLLER
    // ========================================
    class SpinController {
      constructor(wheelInstance) {
        this.wheel = wheelInstance;
        this.spinButton = document.getElementById('spin');
        this.resultContainer = document.getElementById('result');
        this.resultText = document.getElementById('result-text');
        this.resultClose = document.getElementById('result-close');
        this.resultRemove = document.getElementById('result-remove');
        this.entryInput = document.getElementById('entry-input');

        if (this.spinButton && this.resultContainer && this.resultText) {
          this.init();
        }
      }

      init() {
        this.updateSpinButtonState();
        this.wheel.onOptionsChanged = () => this.updateSpinButtonState();
        this.bindEvents();
      }

      updateSpinButtonState() {
        const hasRealOptions = !this.wheel.usesDefaultOptions && this.wheel.options.length > 0;
        this.spinButton.disabled = !hasRealOptions;
      }

      /**
       * Désactive les contrôles d'édition pendant le spin (suppression, ajout, etc.)
       */
      setControlsDisabled(disabled) {
        // Désactiver/activer l'input d'ajout
        if (this.entryInput) {
          this.entryInput.disabled = disabled;
        }

        // Désactiver/activer tous les boutons de suppression dans la liste
        const deleteButtons = document.querySelectorAll('.wheel-options-list .saved-wheel-btn');
        deleteButtons.forEach(btn => {
          btn.disabled = disabled;
          btn.style.opacity = disabled ? '0.5' : '1';
          btn.style.pointerEvents = disabled ? 'none' : 'auto';
        });

        // Désactiver/activer les checkboxes de boost
        const boostCheckboxes = document.querySelectorAll('.wheel-options-list .wheel-option-checkbox');
        boostCheckboxes.forEach(checkbox => {
          checkbox.disabled = disabled;
        });

        // Désactiver/activer le slider de suspense
        const suspenseSlider = document.getElementById('suspense-slider');
        if (suspenseSlider) {
          suspenseSlider.disabled = disabled;
        }

        // Désactiver/activer l'édition des noms d'options
        const optionNames = document.querySelectorAll('.wheel-options-list .wheel-option-name');
        optionNames.forEach(name => {
          name.contentEditable = disabled ? 'false' : 'plaintext-only';
        });
      }

      bindEvents() {
        // Bouton de fermeture du modal résultat
        if (this.resultClose) {
          this.resultClose.addEventListener('click', () => {
            this.hideResult();
          });
        }

        // Bouton pour retirer l'option gagnante de la liste
        if (this.resultRemove) {
          this.resultRemove.addEventListener('click', () => {
            if (typeof this.wheel.lastWinnerIndex === 'number') {
              this.wheel.removeOption(this.wheel.lastWinnerIndex);
              this.hideResult();
            }
          });
        }

        // Bouton de spin
        this.spinButton.addEventListener('click', () => {
          // Désactiver le bouton et les contrôles pendant le spin
          this.spinButton.disabled = true;
          this.setControlsDisabled(true);
          this.wheel.onSpinEnd = (winner) => this.showResult(winner);
          this.wheel.spin();
        });
      }

      showResult(winner) {
        if (!winner) return;
        const resultWinner = this.resultText.querySelector('.result-winner');
        if (resultWinner) {
          resultWinner.textContent = String(winner.text);
        }
        this.resultContainer.classList.add('show');
        this.createConfetti();
        
        // Notifier le compagnon
        const event = new CustomEvent('wheel:result', { detail: winner });
        document.dispatchEvent(event);

        // Désactiver le bouton SPIN pendant l'affichage du résultat
        this.spinButton.disabled = true;
      }

      createConfetti() {
        const { CONFETTI_COUNT, CONFETTI_COLORS } = ANIMATION_CONFIG;
        
        for (let i = 0; i < CONFETTI_COUNT; i++) {
          setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti confetti-animation';
            
            // Style du confetti
            Object.assign(confetti.style, {
              left: `${Math.random() * 100}%`,
              background: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
              width: `${Math.random() * 10 + 5}px`,
              height: `${Math.random() * 10 + 5}px`,
              borderRadius: Math.random() > 0.5 ? '50%' : '0',
              animationDuration: `${Math.random() * 3 + 2}s`,
              animationDelay: `${Math.random() * 0.3}s`
            });
            
            confetti.style.setProperty('--drift', `${(Math.random() - 0.5) * 200}px`);
            
            document.body.appendChild(confetti);
            
            // Nettoyage automatique
            setTimeout(() => confetti.remove(), 6000);
          }, i * 8);
        }
      }

      hideResult() {
        this.resultContainer.classList.remove('show');
        this.wheel.startAutoRotate();
        // Réactiver le bouton SPIN (vérifie automatiquement s'il y a des options valides)
        this.updateSpinButtonState();
        // Réactiver les contrôles d'édition
        this.setControlsDisabled(false);
      }
    }

    /**
     * Gère la persistance et l'affichage des roues sauvegardées.
     */
