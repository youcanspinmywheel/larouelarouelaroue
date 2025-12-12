'use strict';

    // ========================================
    // CLASSE WHEELAPP (ORCHESTRATEUR)
    // ========================================
    class WheelApp {
      constructor() {
        this.canvas = document.getElementById('wheel');
        this.defaultOptions = ['D', 'R', 'A', 'M', 'A', 'S'];
        
        if (this.canvas) {
          this.init();
        }
      }

      init() {
        this.setupCanvas();
        this.createWheel();
        this.createControllers();
      }

      setupCanvas() {
        const displayWidth = this.canvas.clientWidth || 
          (this.canvas.parentElement && this.canvas.parentElement.clientWidth) || 500;
        const displayHeight = this.canvas.clientHeight || 
          (this.canvas.parentElement && this.canvas.parentElement.clientHeight) || 500;
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
      }

      createWheel() {
        // true => ces options sont considérées comme "par défaut"
        this.wheel = new Wheel(this.canvas, this.defaultOptions, true);
        this.wheel.draw();
        this.wheel.startAutoRotate(); // rotation lente par défaut

        // Synchronise les options avec la liste du panneau droit
        const optionsList = document.querySelector('.wheel-options-list');
        if (optionsList) {
          this.wheel.attachOptionsList(optionsList);
        }
      }

      createControllers() {
        // Initialise tous les contrôleurs
        this.optionInputController = new OptionInputController(this.wheel);
        this.suspenseSliderController = new SuspenseSliderController(this.wheel);
        this.spinController = new SpinController(this.wheel);
        this.savedWheelsManager = new SavedWheelsManager(this.wheel);
        this.historyManager = new HistoryManager(this.wheel);
        this.dragDropManager = new DragDropManager(this.wheel);
        this.resultsHistory = new ResultsHistory();
        
        // Connecter les boutons Undo/Redo
        this.bindHistoryButtons();
      }

      bindHistoryButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
          undoBtn.addEventListener('click', () => this.historyManager.undo());
        }
        
        if (redoBtn) {
          redoBtn.addEventListener('click', () => this.historyManager.redo());
        }
      }
    }

    /**
     * Gère le background aléatoire avec mise en cache et chargement optimisé.
     */
    // ========================================
    // CLASSE BACKGROUNDMANAGER
    // ========================================
    class BackgroundManager {
      constructor() {
        this.storageKey = STORAGE_KEYS.LAST_BACKGROUND;
        this.storageTitleKey = STORAGE_KEYS.LAST_TITLE;
        
        // Chaque background est associé à son titre correspondant
        // Extensions des backgrounds (certains sont .jpeg, d'autres .png)
        const bgExtensions = {
          5: 'jpeg', 12: 'jpeg', 13: 'jpeg', 14: 'jpeg', 15: 'jpeg',
          16: 'jpeg', 17: 'jpeg', 19: 'jpeg', 20: 'jpeg', 22: 'jpeg'
        };
        
        this.backgrounds = Array.from({ length: 24 }, (_, idx) => {
          const i = idx + 1;
          const bgExt = bgExtensions[i] || 'png';
          return {
            bg: `asset/images/backgrounds/${i}.${bgExt}`,
            title: `asset/images/titles/${i}.png`,
          };
        });
        
        this.init();
      }

      init() {
        const appLayout = document.querySelector('.app-layout');
        const wheelTitle = document.querySelector('.wheel-title');
        if (!appLayout) return;

        // Récupérer et afficher immédiatement le background et titre précédents s'ils existent
        const lastBg = this.getLastBackground();
        const lastTitle = this.getLastTitle();
        if (lastBg) {
          appLayout.style.backgroundImage = `url('${lastBg}')`;
        } else {
          // Première visite : couleur de fond
          appLayout.classList.add('loading');
        }
        if (lastTitle && wheelTitle) {
          wheelTitle.innerHTML = `<img src="${lastTitle}" alt="Titre">`;
        }

        // Choisir un nouveau background aléatoire à chaque rechargement
        const randomIndex = Math.floor(Math.random() * this.backgrounds.length);
        const selected = this.backgrounds[randomIndex];
        
        // Sauvegarder pour la prochaine fois
        this.saveLastBackground(selected.bg);
        this.saveLastTitle(selected.title);
        
        // Charger et appliquer avec transition douce
        this.loadBackgroundWithTransition(selected.bg, selected.title);
      }

      getLastBackground() {
        return Utils.storage.getString(this.storageKey);
      }

      getLastTitle() {
        return Utils.storage.getString(this.storageTitleKey);
      }

      saveLastBackground(url) {
        Utils.storage.setString(this.storageKey, url);
      }

      saveLastTitle(url) {
        Utils.storage.setString(this.storageTitleKey, url);
      }

      loadBackgroundWithTransition(bgUrl, titleUrl) {
        const appLayout = document.querySelector('.app-layout');
        const wheelTitle = document.querySelector('.wheel-title');
        if (!appLayout) return;

        // Images locales : transition simple avec fondu
        appLayout.style.transition = 'opacity 0.4s ease-in-out';
        appLayout.style.opacity = '0.7';
        
        setTimeout(() => {
          appLayout.style.backgroundImage = `url('${bgUrl}')`;
          appLayout.classList.remove('loading');
          
          if (wheelTitle && titleUrl) {
            wheelTitle.innerHTML = `<img src="${titleUrl}" alt="Titre">`;
          }
          
          setTimeout(() => {
            appLayout.style.opacity = '1';
            setTimeout(() => appLayout.style.transition = '', 400);
          }, 50);
        }, 400);
      }
    }

    /**
     * Gère le mode plein écran
     */
    // ========================================
    // CLASSE FULLSCREENMANAGER
    // ========================================
    class FullscreenManager {
      constructor() {
        this.isFullscreen = false;
        this.appLayout = document.querySelector('.app-layout');
        this.toggleBtn = document.getElementById('fullscreen-toggle');
        
        if (this.toggleBtn) {
          this.toggleBtn.addEventListener('click', () => this.toggle());
        }
      }

      toggle() {
        this.isFullscreen = !this.isFullscreen;
        
        if (this.isFullscreen) {
          this.appLayout.classList.add('fullscreen-mode');
          this.toggleBtn.textContent = '✕';
          this.toggleBtn.title = 'Quitter le plein écran';
        } else {
          this.appLayout.classList.remove('fullscreen-mode');
          this.toggleBtn.textContent = '⛶';
          this.toggleBtn.title = 'Mode plein écran';
        }
      }
    }

    /**
     * Gère le menu mobile pour le left-panel
     */
    // ========================================
    // CLASSE MOBILEMENUMANAGER
    // ========================================
    class MobileMenuManager {
      constructor() {
        this.menuBtn = document.getElementById('mobile-menu-btn');
        this.overlay = document.getElementById('mobile-menu-overlay');
        this.leftPanel = document.querySelector('.left-panel');
        
        if (this.menuBtn && this.overlay && this.leftPanel) {
          this.menuBtn.addEventListener('click', () => this.open());
          this.overlay.addEventListener('click', () => this.close());
        }
      }

      open() {
        this.leftPanel.classList.add('open');
        this.overlay.classList.add('active');
      }

      close() {
        this.leftPanel.classList.remove('open');
        this.overlay.classList.remove('active');
      }
    }

    /**
     * Gère l'ouverture/fermeture du panel de notes
     */
    // ========================================
    // CLASSE NOTEPANELMANAGER
    // ========================================
    class NotePanelManager {
      constructor() {
        this.noteTab = document.getElementById('note-tab');
        this.sideNote = document.getElementById('side-note');
        this.overlay = document.getElementById('side-note-overlay');
        this.closeBtn = document.getElementById('side-note-close');
        this.isOpen = false;
        
        if (this.noteTab && this.sideNote) {
          this.noteTab.addEventListener('click', () => this.toggle());
          
          if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
            this.closeBtn.addEventListener('mousedown', (e) => {
              e.target.style.transform = 'scale(0.85)';
            });
            this.closeBtn.addEventListener('mouseup', (e) => {
              e.target.style.transform = 'scale(1)';
            });
          }
          
          // Fermer en cliquant sur l'overlay
          if (this.overlay) {
            this.overlay.addEventListener('click', () => this.close());
          }
          
          // Empêcher la fermeture quand on clique dans le panel
          this.sideNote.addEventListener('click', (e) => {
            e.stopPropagation();
          });
          
        }
      }

      toggle() {
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      }

      open() {
        this.sideNote.classList.add('open');
        if (this.overlay) {
          this.overlay.classList.add('active');
        }
        this.isOpen = true;
      }

      close() {
        this.sideNote.classList.remove('open');
        if (this.overlay) {
          this.overlay.classList.remove('active');
        }
        this.isOpen = false;
      }

    }

    // Démarrage de l'application
    document.addEventListener('DOMContentLoaded', () => {
      new BackgroundManager();
      window.wheelAppInstance = new WheelApp();
      new FullscreenManager();
      new NotePanelManager();
      new MobileMenuManager();
      new Companion();
    });
