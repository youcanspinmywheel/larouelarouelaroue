'use strict';

    // ========================================
    // CLASSE WHEEL
    // ========================================
    class Wheel {
      /**
       * @param {HTMLCanvasElement} canvas
       * @param {Array<string|{text:string}>} options
       */
      constructor(canvas, options = [], useAsDefaults = false) {
        if (!canvas || !canvas.getContext) {
          throw new Error('Canvas invalide fourni au constructeur Wheel');
        }

        // Canvas et contexte
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Configuration visuelle
        this.colors = WHEEL_CONFIG.COLORS;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        const maxRadius = Math.min(this.centerX, this.centerY);
        this.outsideRadius = maxRadius - 15;
        this.insideRadius = Math.max(25, this.outsideRadius * 0.15);

        // Options
        this.options = (options || []).map(Utils.normalizeOption);
        this.baseOptions = [];
        this.defaultOptions = useAsDefaults ? this.options.map(opt => ({ ...opt })) : [];
        this.usesDefaultOptions = !!useAsDefaults;
        this.hasAddedNewOption = false;

        // Animation et rotation
        this.rotationAngle = 0;
        this.rotationSpeed = WHEEL_CONFIG.ROTATION_SPEED;
        this.isAutoRotating = false;
        this.isSpinning = false;
        this.rainbowTime = 0;

        // Audio
        this.tickSound = new Audio(WHEEL_CONFIG.TICK_SOUND_URL);
        this.tickSound.volume = WHEEL_CONFIG.TICK_SOUND_VOLUME;
        this.lastSegmentIndex = -1;

        // Callbacks et état
        this.onSpinEnd = null;
        this.onOptionsChanged = null;
        this.lastWinnerIndex = null;

        // DOM
        this.optionsListElement = null;
        this.optionItemTemplate = null;
        this.emptyMessageElement = null;

        // Suspense
        this.suspenseMultiplier = 1;
      }

      /**
       * Réinitialise la roue sur ses valeurs par défaut (D R A M A S).
       */
      resetToDefault() {
        if (!this.defaultOptions.length) return;
        this.options = this.defaultOptions.map((opt) => ({ ...opt }));
        this.usesDefaultOptions = true;
        this.draw();
        this.updateOptionsList();
        this.notifyOptionsChanged();
      }

      setOptions(options) {
        this.baseOptions = (options || []).map(Utils.normalizeOption);
        this.applySuspenseMultiplier();
      }
      
      /**
       * Applique le multiplicateur de suspense en dupliquant les options
       */
      applySuspenseMultiplier() {
        if (this.suspenseMultiplier <= 1) {
          this.options = this.baseOptions.map(opt => ({ ...opt }));
        } else {
          this.options = [];
          for (let i = 0; i < this.suspenseMultiplier; i++) {
            this.baseOptions.forEach(opt => {
              this.options.push({ ...opt });
            });
          }
        }
        this.draw();
        this.updateOptionsList();
        this.notifyOptionsChanged();
      }
      
      /**
       * Modifie le multiplicateur de suspense
       */
      setSuspenseMultiplier(multiplier) {
        this.suspenseMultiplier = Math.max(1, Math.min(5, parseInt(multiplier) || 1));
        this.applySuspenseMultiplier();
      }

      /**
       * Ajoute une option. Lors du premier ajout, on supprime les valeurs par défaut.
       */
      addOption(optionLabel) {
        const value = String(optionLabel || '').trim();
        if (!value) return;

        if (this.usesDefaultOptions) {
          this.baseOptions = [];
          this.usesDefaultOptions = false;
        }

        this.baseOptions.push({ text: value, boosted: false, multiplier: 1 });
        this.applySuspenseMultiplier();
        
        // Marquer qu'une nouvelle option a été ajoutée (pour la gestion des sauvegardes)
        this.hasAddedNewOption = true;
        
        // Notifier le compagnon
        document.dispatchEvent(new CustomEvent('wheel:optionAdded', { detail: value }));
      }

      /**
       * Supprime une option par index (pour être aligné avec le style de script.js).
       */
      removeOption(index) {
        // Trouver l'index dans baseOptions (diviser par suspenseMultiplier)
        const baseIndex = Math.floor(index / this.suspenseMultiplier);
        if (baseIndex < 0 || baseIndex >= this.baseOptions.length) return;
        
        this.baseOptions.splice(baseIndex, 1);
        
        // Si tout a été supprimé et qu'on a des valeurs par défaut, on les restaure
        if (!this.baseOptions.length && this.defaultOptions.length) {
          this.baseOptions = this.defaultOptions.map((opt) => ({ ...opt }));
          this.usesDefaultOptions = true;
        }
        
        this.applySuspenseMultiplier();
        
        // Notifier le compagnon
        document.dispatchEvent(new CustomEvent('wheel:optionRemoved'));
      }

      /**
       * Attache la liste DOM (ul.wheel-options-list) pour refléter les options.
       */
      attachOptionsList(element) {
        this.optionsListElement = element;
        // On mémorise un template à partir du premier item existant
        if (!this.optionItemTemplate) {
          const existingItem = element.querySelector('.wheel-option-item');
          if (existingItem) {
            this.optionItemTemplate = existingItem.cloneNode(true);
          }
        }
        // On récupère l'élément de message (en dehors de la liste)
        if (!this.emptyMessageElement && element.parentElement) {
          this.emptyMessageElement = element.parentElement.querySelector('.wheel-options-empty');
        }
        // On vide la liste pour repartir proprement : tout sera régénéré
        this.optionsListElement.innerHTML = '';
        this.updateOptionsList();
      }

      /**
       * Notifie l'UI que les options ont changé (pour, par ex., activer/désactiver le bouton SPIN).
       */
      notifyOptionsChanged() {
        if (typeof this.onOptionsChanged === 'function') {
          this.onOptionsChanged(this);
        }
      }
      
      /**
       * Gère l'affichage du slider de suspense
       */
      updateSuspenseSliderVisibility() {
        const sliderContainer = document.getElementById('suspense-slider-container');
        if (sliderContainer) {
          // Afficher le slider seulement si on a au moins 2 options de base et qu'on n'est pas en mode default
          const shouldShow = !this.usesDefaultOptions && this.baseOptions.length >= 2;
          sliderContainer.style.display = shouldShow ? 'block' : 'none';
        }
      }

      /**
       * Met à jour le panneau de droite (wheel-option-item) à partir des options.
       */
      updateOptionsList() {
        if (!this.optionsListElement) return;

        const list = this.optionsListElement;
        list.innerHTML = '';

        // Si on n'a pas réussi à récupérer un template, on ne fait rien
        if (!this.optionItemTemplate) {
          return;
        }

        const isDefaultState = this.usesDefaultOptions && this.defaultOptions.length;

        // Affichage / masquage du message HTML dédié
        if (this.emptyMessageElement) {
          this.emptyMessageElement.style.display = isDefaultState ? 'block' : 'none';
        }

        // En état par défaut, on n'affiche aucune option dans la liste
        if (isDefaultState) {
          return;
        }

        // Afficher uniquement les options de base (pas les duplicatas)
        this.baseOptions.forEach((opt, index) => {
          // On clone simplement le <li> template
          const li = this.optionItemTemplate.cloneNode(true);

          const nameSpan = li.querySelector('.wheel-option-name');
          if (nameSpan) {
            nameSpan.textContent = opt && opt.text ? opt.text : '';
            
            // Rendre l'option éditable
            nameSpan.setAttribute('contenteditable', 'plaintext-only');
            
            // Sauvegarder les modifications lors de l'édition
            nameSpan.addEventListener('blur', () => {
              const newText = nameSpan.textContent.trim();
              if (newText && newText !== opt.text) {
                opt.text = newText;
                this.applySuspenseMultiplier();
              } else if (!newText) {
                // Si vide, restaurer l'ancien texte
                nameSpan.textContent = opt.text;
              }
            });

            // Valider avec Entrée
            nameSpan.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                nameSpan.blur();
              }
            });
          }

          // Gestion du booster (x2) via la checkbox
          const boosterCheckbox = li.querySelector('.wheel-option-checkbox');
          if (boosterCheckbox) {
            boosterCheckbox.checked = !!opt.boosted;
            boosterCheckbox.onchange = null;
            boosterCheckbox.addEventListener('change', () => {
              if (boosterCheckbox.checked) {
                opt.boosted = true;
                opt.multiplier = 2;
              } else {
                opt.boosted = false;
                opt.multiplier = 1;
              }
              // Appliquer le changement à toutes les copies dupliquées
              this.applySuspenseMultiplier();
            });
          }

          const deleteBtn =
            li.querySelector('.saved-wheel-btn.btn-little') ||
            li.querySelector('.saved-wheel-btn');
          if (deleteBtn) {
            // On ré-associe le handler de suppression
            deleteBtn.onclick = null;
            deleteBtn.addEventListener('click', () => {
              this.removeOption(index);
            });
          }

          list.appendChild(li);
        });
        
        // Gérer l'affichage du slider de suspense
        this.updateSuspenseSliderVisibility();
        
        // Mettre à jour le compteur d'options
        this.updateOptionsCounter();
      }

      updateOptionsCounter() {
        const counterElement = document.getElementById('options-counter');
        const counterValue = document.querySelector('#options-counter .counter-value');
        
        if (counterElement && counterValue) {
          const count = this.usesDefaultOptions ? 0 : this.baseOptions.length;
          counterValue.textContent = count;
          
          // Afficher le compteur seulement s'il y a au moins 1 option
          if (count > 0) {
            counterElement.classList.add('show');
          } else {
            counterElement.classList.remove('show');
          }
        }
      }

      /**
       * Génère une couleur animée avec transition smooth entre les couleurs
       */
      getRainbowColor(time) {
      const colors = [
          { r: 155, g: 246, b: 255 }, // #9bf6ff - bleu clair
          { r: 198, g: 198, b: 237 }, // #c6c6ed - violet clair (transition bleu→rose)
          { r: 241, g: 151, b: 220 }, // #f197dc - rose
          { r: 241, g: 151, b: 220 }, // #f197dc - rose (dupliqué pour rester plus longtemps)
          { r: 255, g: 202, b: 40 },  // #ffca28 - jaune
          { r: 255, g: 202, b: 40 },  // #ffca28 - jaune (dupliqué pour rester plus longtemps)
          { r: 205, g: 224, b: 147 }  // #cde093 - vert clair (transition jaune→bleu)
        ];
        
        // Animation ralentie pour voir toutes les couleurs (multiplier par 0.5)
        const position = (time * 0.5) % colors.length;
        const index = Math.floor(position);
        const nextIndex = (index + 1) % colors.length;
        const blend = position - index; // Valeur entre 0 et 1 pour l'interpolation
        
        // Interpolation linéaire entre deux couleurs
        const r = Math.round(colors[index].r + (colors[nextIndex].r - colors[index].r) * blend);
        const g = Math.round(colors[index].g + (colors[nextIndex].g - colors[index].g) * blend);
        const b = Math.round(colors[index].b + (colors[nextIndex].b - colors[index].b) * blend);
        
        return `rgb(${r}, ${g}, ${b})`;
      }

      draw() {
        const { ctx, canvas } = this;
        if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!this.options.length) return;

        // Calculer la taille totale en tenant compte des multipliers
        const totalWeight = this.options.reduce((sum, opt) => {
          return sum + (opt.multiplier && opt.multiplier > 0 ? opt.multiplier : 1);
        }, 0);

        const baseAngle = this.rotationAngle;
        const count = this.options.length;
        let currentAngle = baseAngle;

        for (let i = 0; i < count; i++) {
          const weight = this.options[i].multiplier && this.options[i].multiplier > 0 
            ? this.options[i].multiplier 
            : 1;
          
          // L'arc de ce segment est proportionnel à son multiplier
          const arc = (2 * Math.PI) * (weight / totalWeight);
          
          // Si l'option est boostée, appliquer l'effet multicolor, sinon couleur normale
          const isBoosted = this.options[i].boosted && this.options[i].multiplier > 1;
          
          if (isBoosted) {
            // Couleur arc-en-ciel simple qui change avec le temps
            ctx.fillStyle = this.getRainbowColor(this.rainbowTime + i * 0.1);
          } else {
            ctx.fillStyle = this.colors[i % this.colors.length];
          }

          // segment plein (pas de trou au centre)
        ctx.beginPath();
          ctx.moveTo(this.centerX, this.centerY);
          ctx.arc(this.centerX, this.centerY, this.outsideRadius, currentAngle, currentAngle + arc, false);
          ctx.closePath();
        ctx.fill();

          // bordure blanche entre les segments (uniquement s'il y a au moins 2 options)
          if (count > 1) {
            ctx.beginPath();
            ctx.moveTo(this.centerX, this.centerY);
            ctx.lineTo(
              this.centerX + this.outsideRadius * Math.cos(currentAngle),
              this.centerY + this.outsideRadius * Math.sin(currentAngle)
            );
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'white';
            ctx.stroke();
          }

          // Texte le long du segment
          const rawLabel = this.options[i] && this.options[i].text ? this.options[i].text : '';
          let label = rawLabel.trim();

          ctx.save();
          ctx.translate(this.centerX, this.centerY);
          // on oriente le repère dans l'axe du segment
          ctx.rotate(currentAngle + arc / 2);
          ctx.fillStyle = '#000';
          
          // Calcul de la taille de police adaptative
          const availableLength = this.outsideRadius - this.insideRadius - 20;
          const arcWidth = arc * (this.outsideRadius * 0.6); // largeur disponible dans l'arc
          
          // Taille de base qui s'adapte à la taille de la roue
          let fontSize = Math.min(16, Math.max(10, this.outsideRadius / 18));
          
          // Ajuster la taille si le texte est trop long
          ctx.font = `bold ${fontSize}px Arial`;
          let textWidth = ctx.measureText(label).width;
          
          // Réduire la police si le texte dépasse
          while (textWidth > availableLength && fontSize > 8) {
            fontSize -= 1;
            ctx.font = `bold ${fontSize}px Arial`;
            textWidth = ctx.measureText(label).width;
          }
          
          // Si toujours trop long, tronquer avec ellipsis
          if (textWidth > availableLength) {
            while (label.length > 1 && ctx.measureText(label + '…').width > availableLength) {
              label = label.slice(0, -1);
            }
            label = label + '…';
          }
          
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Position du texte au milieu du segment (entre le centre et le bord)
          const textRadius = (this.insideRadius + this.outsideRadius) / 2;
          
          ctx.fillText(label, textRadius, 0);

          ctx.restore();
          
          // Passer à l'angle suivant
          currentAngle += arc;
        }

        // bordure blanche autour de toute la roue
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.outsideRadius, 0, 2 * Math.PI);
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'white';
        ctx.stroke();
      }

      /**
       * Renvoie l'option actuellement sous l'aiguille.
       */
      getCurrentSegmentIndex() {
        if (!this.options.length) return -1;

        // Calculer la taille totale en tenant compte des multipliers
        const totalWeight = this.options.reduce((sum, opt) => {
          return sum + (opt.multiplier && opt.multiplier > 0 ? opt.multiplier : 1);
        }, 0);

        let angle = this.rotationAngle % (2 * Math.PI);
        if (angle < 0) angle += 2 * Math.PI;

        // L'aiguille pointe vers le haut (angle 0), on inverse pour trouver le segment
        const normalized = (2 * Math.PI - angle) % (2 * Math.PI);

        // Parcourir les segments pour trouver celui sous l'aiguille
        let currentAngle = 0;
        for (let i = 0; i < this.options.length; i++) {
          const weight = this.options[i].multiplier && this.options[i].multiplier > 0 
            ? this.options[i].multiplier 
            : 1;
          const arc = (2 * Math.PI) * (weight / totalWeight);
          
          if (normalized >= currentAngle && normalized < currentAngle + arc) {
            return i;
          }
          currentAngle += arc;
        }
        return 0;
      }

      getCurrentOption() {
        const index = this.getCurrentSegmentIndex();
        if (index === -1) return null;
        this.lastWinnerIndex = index;
        return this.options[index] || null;
      }

      /**
       * Retourne un index aléatoire pondéré par multiplier (x2, etc.).
       */
      getWeightedRandomIndex() {
        if (!this.options.length) return null;
        const weights = this.options.map((opt) =>
          opt && opt.multiplier && opt.multiplier > 0 ? opt.multiplier : 1
        );
        const total = weights.reduce((sum, w) => sum + w, 0);
        if (total <= 0) return 0;

        let r = Math.random() * total;
        for (let i = 0; i < weights.length; i++) {
          if (r < weights[i]) return i;
          r -= weights[i];
        }
        return 0;
      }

      /**
       * Lance un spin : la roue accélère puis ralentit jusqu'à s'arrêter sur une option.
       */
      spin() {
        if (this.isSpinning || !this.options.length) return;

        // on coupe l'auto-rotation lente pendant le spin
        this.isAutoRotating = false;
        this.isSpinning = true;

        // Notifier le compagnon
        document.dispatchEvent(new CustomEvent('wheel:spinStart'));

        // Jouer le son immédiatement au démarrage du spin
        if (this.tickSound) {
          this.tickSound.currentTime = 0;
          this.tickSound.play().catch(() => {
            // Ignorer les erreurs de lecture (autoplay policy)
          });
        }

        // Initialiser avec le segment actuel pour détecter le prochain changement
        this.lastSegmentIndex = this.getCurrentSegmentIndex();

        const startAngle = this.rotationAngle;
        const n = this.options.length;
        const arc = (2 * Math.PI) / n;

        // Choix de l'index gagnant avec pondération (x2)
        const targetIndex = this.getWeightedRandomIndex() ?? 0;

        // angle qui met le centre du segment gagnant sous l'aiguille
        const targetBaseAngle = (2 * Math.PI - (targetIndex + 0.5) * arc);
        const extraSpins = 4 + Math.random() * 3; // entre 4 et 7 tours complets
        const endAngle = targetBaseAngle + 2 * Math.PI * extraSpins;
        const totalDelta = endAngle - startAngle;
        const duration = 3000; // ms
        const startTime = performance.now();

        const animate = (now) => {
          const t = Math.min(1, (now - startTime) / duration);
          // easing "ease-out" pour un arrêt en douceur
          const eased = 1 - Math.pow(1 - t, 3);
          this.rotationAngle = startAngle + totalDelta * eased;
          this.draw();

          // Détecter le changement de segment pour jouer le son
          const currentSegment = this.getCurrentSegmentIndex();
          if (currentSegment !== -1 && currentSegment !== this.lastSegmentIndex) {
            this.lastSegmentIndex = currentSegment;
            // Jouer le son dès qu'on détecte un segment valide
            if (this.tickSound) {
              this.tickSound.currentTime = 0;
              this.tickSound.play().catch(() => {
                // Ignorer les erreurs de lecture (autoplay policy)
              });
            }
          }

          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            this.isSpinning = false;
            this.lastSegmentIndex = -1; // Reset pour le prochain spin
            const winner = this.getCurrentOption();
            if (typeof this.onSpinEnd === 'function') {
              this.onSpinEnd(winner);
            }
          }
        };

        requestAnimationFrame(animate);
      }

      startAutoRotate() {
        if (this.isAutoRotating) return;
        this.isAutoRotating = true;

        const step = () => {
          if (!this.isAutoRotating) return;
          this.rotationAngle += this.rotationSpeed;
          // évite que l'angle ne grossisse à l'infini
          if (this.rotationAngle > Math.PI * 2) {
            this.rotationAngle -= Math.PI * 2;
          }
          // Incrémenter le temps pour l'animation arc-en-ciel (plus rapide)
          this.rainbowTime += 0.03;
          this.draw();
          requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
      }
    }
