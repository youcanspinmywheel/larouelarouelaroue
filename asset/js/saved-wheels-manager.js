'use strict';

    // ========================================
    // CLASSE SAVEDWHEELSMANAGER
    // ========================================
    class SavedWheelsManager {
      constructor(wheelInstance) {
        if (!wheelInstance) {
          throw new Error('Instance Wheel requise pour SavedWheelsManager');
        }

        this.wheel = wheelInstance;
        this.storageKey = STORAGE_KEYS.SAVED_WHEELS;
        
        // Éléments DOM
        this.savedList = document.querySelector('.saved-wheels');
        this.saveBtn = document.getElementById('save-wheel');
        this.addNewBtn = document.getElementById('add-new-wheel');
        this.importBtn = document.getElementById('import-wheel');
        this.exportBtn = document.getElementById('export-wheel');
        
        // État
        this.savedWheels = [];
        this.currentSavedId = null;
        this.templateItem = null;
        this.lastSavedState = null;

        if (this.savedList) {
          this.init();
        }
      }

      init() {
        // Récupère un template à partir du premier item statique
        const existingItem = this.savedList.querySelector('.saved-wheel');
        if (existingItem) {
          this.templateItem = existingItem.cloneNode(true);
        }

        this.loadFromStorage();
        this.renderList();
        this.bindEvents();
        
        // Vérifier s'il y a des modifications non sauvegardées après un reload
        this.checkUnsavedStateOnLoad();
      }

      /**
       * Vérifie s'il y a un état non sauvegardé après un reload de page
       * Ne s'affiche QUE si une option avait été ajoutée
       */
      checkUnsavedStateOnLoad() {
        const unsavedState = Utils.storage.get(STORAGE_KEYS.UNSAVED_STATE);
        
        // Seulement si un état existe (c'est-à-dire qu'une option avait été ajoutée)
        if (unsavedState && unsavedState.options && unsavedState.options.length > 0) {
          // Afficher la modal pour proposer de sauvegarder
          setTimeout(() => {
            this.showUnsavedChangesModal(
              () => {
                // Sauvegarder les modifications
                this.wheel.setOptions(unsavedState.options);
                this.saveCurrentWheel();
                Utils.storage.set(STORAGE_KEYS.UNSAVED_STATE, null);
              },
              () => {
                // Ne pas sauvegarder, supprimer l'état
                Utils.storage.set(STORAGE_KEYS.UNSAVED_STATE, null);
              }
            );
          }, 500);
        } else {
          // Pas d'état sauvegardé, nettoyer juste au cas où
          Utils.storage.set(STORAGE_KEYS.UNSAVED_STATE, null);
        }
      }

      /**
       * Sauvegarde l'état actuel avant un reload (appelé via beforeunload)
       * Uniquement si une nouvelle option a été ajoutée
       */
      saveUnsavedState() {
        if (this.wheel.hasAddedNewOption && this.hasUnsavedChanges() && !this.wheel.usesDefaultOptions) {
          const state = {
            options: this.wheel.baseOptions,
            isDefault: this.wheel.usesDefaultOptions,
            timestamp: Date.now()
          };
          Utils.storage.set(STORAGE_KEYS.UNSAVED_STATE, state);
        }
      }

      loadFromStorage() {
        const wheels = Utils.storage.get(this.storageKey, []);
        if (Array.isArray(wheels)) {
          this.savedWheels = wheels;
        }
      }

      saveToStorage() {
        Utils.storage.set(this.storageKey, this.savedWheels);
      }

      getNextWheelNumber() {
        let maxNum = 0;
        this.savedWheels.forEach((w) => {
          const match = w.name && w.name.match(/^Roue (\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });
        return maxNum + 1;
      }

      createWheelSnapshot() {
        const id = this.currentSavedId || Date.now();
        let name;
        
        if (this.currentSavedId) {
          // Si on modifie une roue existante, garder son nom
          const existing = this.savedWheels.find((w) => w.id === this.currentSavedId);
          name = existing ? existing.name : `Roue ${this.getNextWheelNumber()}`;
        } else {
          // Nouvelle roue : nom incrémental
          name = `Roue ${this.getNextWheelNumber()}`;
        }

        // Utiliser baseOptions pour éviter de sauvegarder les duplicatas du slider suspense
        return {
          id,
          name,
          options: this.wheel.baseOptions.map((opt) => ({
            text: opt.text,
            boosted: !!opt.boosted,
            multiplier: opt.multiplier && opt.multiplier > 0 ? opt.multiplier : 1,
            enabled: opt.enabled !== false, // Sauvegarder l'état enabled (true par défaut)
          })),
        };
      }

      renderList() {
        this.savedList.innerHTML = '';
        if (!this.templateItem) return;

        this.savedWheels.forEach((wheelData) => {
          const li = this.createWheelListItem(wheelData);
          this.savedList.appendChild(li);
        });
        
        // Mettre à jour le compteur de roues
        this.updateWheelsCounter();
      }

      updateWheelsCounter() {
        const counterElement = document.getElementById('wheels-counter');
        const counterValue = document.querySelector('#wheels-counter .counter-value');
        
        if (counterElement && counterValue) {
          const count = this.savedWheels.length;
          counterValue.textContent = count;
          
          // Afficher le compteur seulement s'il y a au moins 1 roue
          if (count > 0) {
            counterElement.classList.add('show');
          } else {
            counterElement.classList.remove('show');
          }
        }
      }

      createWheelListItem(wheelData) {
        const li = this.templateItem.cloneNode(true);
        li.dataset.wheelId = wheelData.id;
        
        const nameSpan = li.querySelector('.saved-wheel-name');
        if (nameSpan) {
          nameSpan.textContent = wheelData.name || 'Roue';
          nameSpan.oninput = null;
          nameSpan.addEventListener('input', () => {
            wheelData.name = nameSpan.textContent.trim() || 'Roue';
            this.saveToStorage();
          });
        }

        const [loadBtn, deleteBtn] = li.querySelectorAll('.saved-wheel-btn.btn-little');

        if (loadBtn) {
          loadBtn.onclick = null;
          loadBtn.addEventListener('click', () => this.loadWheel(wheelData));
        }

        if (deleteBtn) {
          deleteBtn.onclick = null;
          deleteBtn.addEventListener('click', () => this.deleteWheel(wheelData.id));
        }

        return li;
      }

      hasUnsavedChanges() {
        if (!this.lastSavedState) return false;
        
        // Utiliser baseOptions pour comparer (sans les duplicatas du slider suspense)
        const currentState = JSON.stringify({
          options: this.wheel.baseOptions.map((opt) => ({
            text: opt.text,
            boosted: !!opt.boosted,
            multiplier: opt.multiplier || 1,
            enabled: opt.enabled !== false,
          })),
        });
        
        return currentState !== this.lastSavedState;
      }

      updateLastSavedState() {
        // Utiliser baseOptions (sans les duplicatas du slider suspense)
        this.lastSavedState = JSON.stringify({
          options: this.wheel.baseOptions.map((opt) => ({
            text: opt.text,
            boosted: !!opt.boosted,
            multiplier: opt.multiplier || 1,
            enabled: opt.enabled !== false,
          })),
        });
      }

      showUnsavedChangesModal(onSave, onDiscard) {
        const modal = document.getElementById('unsaved-changes-modal');
        const saveBtn = document.getElementById('modal-save-btn');
        const discardBtn = document.getElementById('modal-discard-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        if (!modal) return;

        // Fonction pour fermer la modal
        const closeModal = () => {
          modal.classList.remove('show');
          setTimeout(() => {
            modal.style.display = 'none';
          }, 300);
        };

        // Gestionnaires d'événements
        const handleSave = () => {
          closeModal();
          onSave();
        };

        const handleDiscard = () => {
          closeModal();
          onDiscard();
        };

        const handleCancel = () => {
          closeModal();
        };

        // Nettoyer les anciens listeners (cloner pour supprimer tous les listeners)
        const newSaveBtn = saveBtn.cloneNode(true);
        const newDiscardBtn = discardBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        discardBtn.parentNode.replaceChild(newDiscardBtn, discardBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        // Attacher les nouveaux listeners
        newSaveBtn.addEventListener('click', handleSave);
        newDiscardBtn.addEventListener('click', handleDiscard);
        newCancelBtn.addEventListener('click', handleCancel);

        // Afficher la modal avec animation
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
      }

      loadWheel(wheelData) {
        if (this.hasUnsavedChanges()) {
          this.showUnsavedChangesModal(
            () => {
              // Sauvegarder puis charger
              this.saveCurrentWheel();
              this.performLoadWheel(wheelData);
            },
            () => {
              // Ne pas sauvegarder, charger directement
              this.performLoadWheel(wheelData);
            }
          );
        } else {
          this.performLoadWheel(wheelData);
        }
      }

      resetSuspenseSlider() {
        const slider = document.getElementById('suspense-slider');
        const valueDisplay = document.getElementById('suspense-value');
        
        if (slider) {
          slider.value = 1;
        }
        if (valueDisplay) {
          valueDisplay.textContent = 'x1';
        }
        // Réinitialiser le multiplicateur de suspense dans la roue
        this.wheel.setSuspenseMultiplier(1);
      }

      performLoadWheel(wheelData) {
        this.currentSavedId = wheelData.id;
        this.wheel.usesDefaultOptions = false;
        
        // S'assurer que toutes les options sont activées par défaut lors du chargement
        const optionsWithEnabled = (wheelData.options || []).map(opt => ({
          text: opt.text || '',
          boosted: !!opt.boosted,
          multiplier: opt.multiplier && opt.multiplier > 0 ? opt.multiplier : 1,
          enabled: true // Toujours activer toutes les options lors du chargement
        }));
        
        this.wheel.setOptions(optionsWithEnabled);
        // Réinitialiser le slider à 1 pour chaque nouvelle roue chargée
        this.resetSuspenseSlider();
        this.updateLastSavedState();
        // Réinitialiser le flag d'ajout de nouvelle option
        this.wheel.hasAddedNewOption = false;
      }

      deleteWheel(wheelId) {
        this.savedWheels = this.savedWheels.filter((w) => w.id !== wheelId);
        if (this.currentSavedId === wheelId) {
          this.currentSavedId = null;
        }
        this.saveToStorage();
        this.renderList();
      }

      saveCurrentWheel() {
        const snapshot = this.createWheelSnapshot();
        const existingIndex = this.savedWheels.findIndex((w) => w.id === this.currentSavedId);
        
        if (existingIndex >= 0) {
          // Mise à jour d'une roue existante
          this.savedWheels[existingIndex] = snapshot;
        } else {
          // Création d'une nouvelle entrée (si liste vide ou aucune roue sélectionnée)
          if (this.savedWheels.length === 0 || !this.currentSavedId) {
            this.savedWheels.push(snapshot);
            this.currentSavedId = snapshot.id;
          } else {
            // Il y a des roues mais aucune n'est sélectionnée
            this.showNotification('Aucune roue sélectionnée. Cliquez sur une roue dans la liste ou utilisez "START A NEW WHEEL".', true);
            return;
          }
        }
        
        this.saveToStorage();
        this.renderList();
        this.updateLastSavedState();
        this.showNotification('Roue sauvegardée ! 💾');
        
        // Réinitialiser le flag d'ajout de nouvelle option
        this.wheel.hasAddedNewOption = false;
      }

      addNewWheel() {
        if (this.hasUnsavedChanges()) {
          this.showUnsavedChangesModal(
            () => {
              // Sauvegarder puis créer nouvelle roue
              this.saveCurrentWheel();
              this.performAddNewWheel();
            },
            () => {
              // Ne pas sauvegarder, créer nouvelle roue directement
              this.performAddNewWheel();
            }
          );
        } else {
          this.performAddNewWheel();
        }
      }

      performAddNewWheel() {
        // Créer un nouvel item dans la liste avec les options par défaut (DRAMAS)
        const newWheelId = Date.now();
        const newWheel = {
          id: newWheelId,
          name: `Roue ${this.getNextWheelNumber()}`,
          options: this.wheel.defaultOptions.map((opt) => ({
            text: typeof opt === 'string' ? opt : opt.text,
            boosted: false,
            multiplier: 1,
            enabled: true, // Par défaut toutes les options sont activées
          })),
        };

        this.savedWheels.push(newWheel);
        this.currentSavedId = newWheelId;
        this.saveToStorage();
        this.renderList();

        // Charger cette nouvelle roue (état par défaut DRAMAS)
        // Cacher le slider AVANT de charger les options pour éviter qu'il apparaisse brièvement
        const sliderContainer = document.getElementById('suspense-slider-container');
        if (sliderContainer) {
          sliderContainer.style.display = 'none';
        }
        
        this.wheel.usesDefaultOptions = true;
        this.wheel.setOptions(newWheel.options);
        // Réinitialiser le slider à 1 pour chaque nouvelle roue créée
        this.resetSuspenseSlider();
        // S'assurer que le slider de suspense est bien caché pour les options par défaut
        this.wheel.updateSuspenseSliderVisibility();
        this.updateLastSavedState();
        // Réinitialiser le flag d'ajout de nouvelle option
        this.wheel.hasAddedNewOption = false;
      }

      async exportWheel() {
        try {
          // Créer un snapshot de la roue actuelle
          // Utiliser baseOptions pour éviter d'exporter les duplicatas du slider suspense
          const wheelData = {
            name: this.currentSavedId 
              ? this.savedWheels.find((w) => w.id === this.currentSavedId)?.name || 'Roue exportée'
              : 'Roue exportée',
            options: this.wheel.baseOptions.map((opt) => ({
              text: opt.text,
              boosted: !!opt.boosted,
              multiplier: opt.multiplier && opt.multiplier > 0 ? opt.multiplier : 1,
              enabled: opt.enabled !== false, // Sauvegarder l'état enabled (true par défaut)
            })),
          };

          const json = JSON.stringify(wheelData, null, 2);
          
          // Copier dans le presse-papier
          await navigator.clipboard.writeText(json);
          
          // Notification visuelle
          this.showNotification('Roue exportée dans le presse-papier ! 📋');
        } catch (e) {
          console.error('Erreur lors de l\'export :', e);
          this.showNotification('Erreur lors de l\'export ❌', true);
        }
      }

      async importWheel() {
        try {
          // Lire depuis le presse-papier
          const clipboardText = await navigator.clipboard.readText();
          
          if (!clipboardText) {
            this.showNotification('Presse-papier vide ❌', true);
            return;
          }

          // Parser le JSON
          const wheelData = JSON.parse(clipboardText);
          
          // Valider la structure
          if (!wheelData.options || !Array.isArray(wheelData.options)) {
            this.showNotification('Format invalide ❌', true);
            return;
          }

          // Déterminer le nom de la roue importée
          let wheelName;
          if (wheelData.name) {
            // Vérifier si le nom existe déjà
            const nameExists = this.savedWheels.some((w) => w.name === wheelData.name);
            if (nameExists) {
              // Si le nom existe, utiliser l'incrémentation
              wheelName = `Roue ${this.getNextWheelNumber()}`;
            } else {
              // Sinon, utiliser le nom importé
              wheelName = wheelData.name;
            }
          } else {
            // Pas de nom fourni, utiliser l'incrémentation
            wheelName = `Roue ${this.getNextWheelNumber()}`;
          }

          // Créer une nouvelle entrée dans la liste
          const newWheelId = Date.now();
          const newWheel = {
            id: newWheelId,
            name: wheelName,
            options: wheelData.options.map((opt) => ({
              text: opt.text || '',
              boosted: !!opt.boosted,
              multiplier: opt.multiplier && opt.multiplier > 0 ? opt.multiplier : 1,
              enabled: true, // Toujours activer toutes les options lors de l'import
            })),
          };

          this.savedWheels.push(newWheel);
          this.saveToStorage();
          this.renderList();

          // Charger la roue importée
          this.currentSavedId = newWheelId;
          this.wheel.usesDefaultOptions = false;
          this.wheel.setOptions(newWheel.options);
          // Réinitialiser le slider à 1 pour chaque roue importée
          this.resetSuspenseSlider();
          this.updateLastSavedState();

          this.showNotification('Roue importée avec succès ! ✅');
        } catch (e) {
          console.error('Erreur lors de l\'import :', e);
          this.showNotification('Erreur lors de l\'import (JSON invalide ?) ❌', true);
        }
      }

      showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: ${isError ? '#f496ad' : '#e3b9ff'};
          color: white;
          padding: 15px 30px;
          border-radius: 12px;
          border: 3px solid rgba(255, 255, 255, 0.5);
          font-size: 16px;
          font-weight: 600;
          z-index: 10001;
          box-shadow: 0 4px 12px rgba(203, 97, 163, 0.4);
          animation: slideDown 0.3s ease-out;
        `;

        // Animation CSS
        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Supprimer après 3 secondes
        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transition = 'opacity 0.3s';
          setTimeout(() => {
            document.body.removeChild(notification);
            document.head.removeChild(style);
          }, 300);
        }, 3000);
      }

      bindEvents() {
        if (this.saveBtn) {
          this.saveBtn.addEventListener('click', () => this.saveCurrentWheel());
        }

        if (this.addNewBtn) {
          this.addNewBtn.addEventListener('click', () => this.addNewWheel());
        }

        // Boutons Import/Export
        const importBtn = document.getElementById('import-wheel');
        const exportBtn = document.getElementById('export-wheel');

        if (importBtn) {
          importBtn.addEventListener('click', () => this.importWheel());
        }

        if (exportBtn) {
          exportBtn.addEventListener('click', () => this.exportWheel());
        }

        // Sauvegarder l'état avant un reload/fermeture de page
        window.addEventListener('beforeunload', () => {
          this.saveUnsavedState();
        });
      }
    }

    /**
     * Point d'entrée principal de l'application.
     */
