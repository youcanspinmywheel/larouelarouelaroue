'use strict';

    // ========================================
    // CLASSE DRAGDROPMANAGER
    // ========================================
    class DragDropManager {
      constructor(wheelInstance) {
        this.wheel = wheelInstance;
        this.draggedElement = null;
        this.draggedIndex = null;
        this.placeholder = null;
        
        // Observer pour détecter les changements dans la liste
        this.setupMutationObserver();
      }

      /**
       * Configure un observateur pour détecter les nouveaux éléments
       */
      setupMutationObserver() {
        const optionsList = document.querySelector('.wheel-options-list');
        if (!optionsList) return;

        const observer = new MutationObserver(() => {
          this.bindDragEvents();
        });

        observer.observe(optionsList, {
          childList: true,
          subtree: false
        });

        // Initialiser les événements pour les éléments existants
        this.bindDragEvents();
      }

      /**
       * Attache les événements de drag & drop à tous les items
       */
      bindDragEvents() {
        const items = document.querySelectorAll('.wheel-options-list .wheel-option-item');
        
        items.forEach((item, index) => {
          // Éviter de ré-attacher les événements
          if (item.hasAttribute('data-drag-enabled')) return;
          item.setAttribute('data-drag-enabled', 'true');
          
          // Rendre l'élément draggable
          item.setAttribute('draggable', 'true');
          
          // Événements de drag
          item.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
          item.addEventListener('dragend', (e) => this.handleDragEnd(e));
          item.addEventListener('dragover', (e) => this.handleDragOver(e));
          item.addEventListener('drop', (e) => this.handleDrop(e, index));
          item.addEventListener('dragenter', (e) => this.handleDragEnter(e));
          item.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        });
      }

      /**
       * Début du drag
       */
      handleDragStart(e, index) {
        this.draggedElement = e.currentTarget;
        this.draggedIndex = index;
        
        // Style visuel
        e.currentTarget.style.opacity = '0.4';
        e.currentTarget.classList.add('dragging');
        
        // Données de transfert
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
      }

      /**
       * Fin du drag
       */
      handleDragEnd(e) {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.classList.remove('dragging');
        
        // Nettoyer tous les indicateurs visuels
        document.querySelectorAll('.wheel-option-item').forEach(item => {
          item.classList.remove('drag-over');
        });
        
        this.draggedElement = null;
        this.draggedIndex = null;
      }

      /**
       * Survol pendant le drag
       */
      handleDragOver(e) {
        if (e.preventDefault) {
          e.preventDefault();
        }
        
        e.dataTransfer.dropEffect = 'move';
        return false;
      }

      /**
       * Entrée dans une zone de drop
       */
      handleDragEnter(e) {
        if (e.currentTarget !== this.draggedElement) {
          e.currentTarget.classList.add('drag-over');
        }
      }

      /**
       * Sortie d'une zone de drop
       */
      handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
      }

      /**
       * Drop de l'élément
       */
      handleDrop(e, targetIndex) {
        if (e.stopPropagation) {
          e.stopPropagation();
        }
        
        e.currentTarget.classList.remove('drag-over');
        
        // Ne rien faire si on drop sur soi-même
        if (this.draggedIndex === targetIndex) {
          return false;
        }
        
        // Réorganiser les options dans le modèle
        this.reorderOptions(this.draggedIndex, targetIndex);
        
        return false;
      }

      /**
       * Réorganise les options dans le tableau
       */
      reorderOptions(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        
        // Extraire l'élément à déplacer
        const movedOption = this.wheel.baseOptions.splice(fromIndex, 1)[0];
        
        // L'insérer à la nouvelle position
        this.wheel.baseOptions.splice(toIndex, 0, movedOption);
        
        // Mettre à jour l'affichage
        this.wheel.applySuspenseMultiplier();
        
        // Notifier l'historique
        document.dispatchEvent(new CustomEvent('wheel:stateChanged', { detail: 'reorder' }));
        
        // Notification visuelle
        this.showNotification('Option déplacée ⇅');
      }

      /**
       * Affiche une notification temporaire
       */
      showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: #e3b9ff;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          border: 2px solid rgba(255, 255, 255, 0.5);
          font-size: 13px;
          font-weight: 600;
          z-index: 10001;
          box-shadow: 0 4px 12px rgba(203, 97, 163, 0.4);
          animation: slideUp 0.3s ease-out;
          pointer-events: none;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transition = 'opacity 0.3s';
          setTimeout(() => {
            if (notification.parentNode) {
              document.body.removeChild(notification);
            }
          }, 300);
        }, 1500);
      }
    }

