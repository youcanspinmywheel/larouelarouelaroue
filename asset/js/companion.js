'use strict';

/**
 * Gère le petit compagnon interactif (Tamagotchi style)
 */
class Companion {
  constructor() {
    this.summonBtn = document.getElementById('companion-btn');
    this.companion = null;
    this.isActive = false;
    
    // États
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.isMoving = false;
    this.isDragging = false;
    this.direction = 1; // 1 = droite, -1 = gauche
    this.speed = 2;
    this.state = 'idle'; // idle, walk, jump, sleep, dragged, spin
    
    // Timers
    this.moveTimer = null;
    this.clickCount = 0;
    this.clickTimer = null;
    this.zzzInterval = null;
    this.inactivityTimer = null; // Timer d'inactivité
    this.peekTimer = null; // Timer pour l'animation peekaboo
    this.currentExpression = 'neutral';
    
    // Système de besoins (Tamagotchi-like)
    this.needs = {
      happiness: 100, // 0-100
      hunger: 50,     // 0-100 (plus haut = moins faim)
      energy: 100,    // 0-100
      lastUpdate: Date.now()
    };
    
    // Jeu de rapidité
    this.quickClickGame = {
      active: false,
      timeout: null,
      success: false
    };
    
    
    this.init();
  }

  init() {
    if (this.summonBtn) {
      this.summonBtn.addEventListener('click', () => this.toggleCompanion());
    }
    
    // Détecter l'activité utilisateur globale
    ['mousemove', 'click', 'keydown', 'scroll'].forEach(event => {
      document.addEventListener(event, () => {
        if (this.isActive) {
          this.resetInactivityTimer();
          this.updateNeeds('activity');
        }
      });
    });
    
  }

  toggleCompanion() {
    if (this.isActive) {
      this.despawn();
    } else {
      this.spawn();
      this.resetInactivityTimer();
    }
  }

  spawn() {
    if (this.companion) return;

    this.isActive = true;
    this.summonBtn.classList.add('active');

    // Créer l'élément avec le VISAGE (sans pupilles)
    this.companion = document.createElement('div');
    this.companion.id = 'pixel-companion';
    this.companion.innerHTML = `
      <div class="companion-wrapper">
        <div class="companion-body">
          <div class="companion-sprite">🍑</div>
          <div class="companion-face">
            <div class="eye left"></div>
            <div class="eye right"></div>
            <div class="mouth"></div>
          </div>
        </div>
      </div>
      <div class="companion-shadow"></div>
      <div class="companion-bubble">
        <span class="bubble-text">Coucou !</span>
        <i class="fa-solid fa-sparkles companion-sparkles"></i>
      </div>
    `;
    document.body.appendChild(this.companion);

    this.x = window.innerWidth / 2;
    // Position : 120px du bas pour être visible mais pas trop haut
    this.y = window.innerHeight - 120;
    this.updatePosition();

    // Animation d'apparition
    this.companion.style.transform = 'scale(0)';
    requestAnimationFrame(() => {
      this.companion.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      this.companion.style.transform = 'scale(1)';
    });

    // Events internes et globaux
    this.bindEvents();
    
    // Créer le panneau de soins (caché par défaut)
    this.createCarePanel();
    
    // Démarrer le cycle de vie
    this.startLifeCycle();
    this.setExpression('happy');
    
    // Jeu de rapidité à l'invocation (30% de chance)
    if (Math.random() < 0.3) {
      setTimeout(() => this.startQuickClickGame(), 1500);
    }
    
    const spawnPhrases = [
      "Kakou kakou",
      "Ouais c'est michel",
      "Coucou ! C'est moi !",
      "Me revoilà ! 🍑",
      "Salut ! Prête à tourner ?",
      "Kakou kakou ! On y va ?"
    ];
    this.say(spawnPhrases[Math.floor(Math.random() * spawnPhrases.length)]);
    
    // Démarrer la gestion des besoins
    this.startNeedsSystem();
    
    // Revenir à neutre après un moment
    setTimeout(() => this.setExpression('neutral'), 2000);
  }

  bindEvents() {
    if (!this.companion) return;

    // Drag & Drop
    this.companion.addEventListener('mousedown', (e) => this.startDrag(e));
    window.addEventListener('mousemove', (e) => this.onDrag(e));
    window.addEventListener('mouseup', () => this.stopDrag());

    // Touch support
    this.companion.addEventListener('touchstart', (e) => this.startDrag(e.touches[0]));
    window.addEventListener('touchmove', (e) => this.onDrag(e.touches[0]));
    window.addEventListener('touchend', () => this.stopDrag());

    // Clic simple (si pas drag)
    this.companion.addEventListener('click', (e) => {
      if (!this.isDragging) {
        // Si le compagnon joue à cache-cache, le trouver
        if (this.state === 'peekaboo') {
          this.endPeekaboo("Tu m'as trouvé !");
          return;
        }
        
        // Si le compagnon dort, le réveiller
        if (this.state === 'sleep') {
          this.wakeUp();
          this.startLifeCycle();
          this.say("Je suis réveillé ! 😊");
          return;
        }
        
        // Si le jeu de rapidité est actif, ne pas ouvrir le panneau
        if (!this.quickClickGame.active) {
          // Ouvrir/fermer le panneau de soins
          this.toggleCarePanel();
        }
        // Toujours gérer le clic normal (animations, etc.)
        this.handleClick(e);
      }
    });

    // --- Écouteurs d'événements de la ROUE ---
    const spinBtn = document.getElementById('spin');
    if (spinBtn) {
      spinBtn.addEventListener('click', () => {
        if (this.isActive && !this.isDragging) {
          // Géré par wheel:spinStart
        }
      });
    }

    document.addEventListener('wheel:spinStart', () => {
      if (this.isActive && !this.isDragging) {
        this.reactToSpinStart();
        // Réagir aux sons de la roue (augmenter le bonheur)
        this.updateNeeds('activity');
      }
    });

    document.addEventListener('wheel:result', () => {
      if (this.isActive && !this.isDragging) {
        this.celebrate();
      }
    });

    document.addEventListener('wheel:optionAdded', (e) => {
        if (this.isActive) {
            this.stopLifeCycle();
            this.wakeUp();
            this.setExpression('happy');
            this.jump();
            // Ajouter une option = nourrir un peu le compagnon
            this.updateNeeds('feed');
            const phrases = ["Miam, du drama !", "Ouh ça pique !", "J'adore !", "Encore !"];
            this.say(phrases[Math.floor(Math.random() * phrases.length)]);
            setTimeout(() => {
                this.setExpression('neutral');
                this.startLifeCycle();
            }, 2000);
        }
    });

    document.addEventListener('wheel:optionRemoved', () => {
        if (this.isActive) {
            this.stopLifeCycle();
            this.wakeUp();
            this.setExpression('sad');
            this.say("Oh non... c'était bien...");
            setTimeout(() => {
                this.setExpression('neutral');
                this.startLifeCycle();
            }, 2000);
        }
    });

    document.addEventListener('wheel:optionRemovedFromResult', () => {
        if (this.isActive) {
            this.stopLifeCycle();
            this.wakeUp();
            this.setExpression('happy');
            const phrases = [
                "Voilà, c'est fait !",
                "C'est réglé !",
                "Parfait !",
                "Et voilà ! ✨",
                "C'est dans la poche !"
            ];
            this.say(phrases[Math.floor(Math.random() * phrases.length)]);
            setTimeout(() => {
                this.setExpression('neutral');
                this.startLifeCycle();
            }, 2000);
        }
    });

    document.addEventListener('wheel:optionToggled', (e) => {
        if (this.isActive && e.detail) {
            this.stopLifeCycle();
            this.wakeUp();
            
            if (e.detail.enabled) {
                // Option réactivée
                this.setExpression('happy');
                const phrases = [
                    "Ah, elle revient !",
                    "On la retrouve !",
                    "Elle est de retour ! ✨",
                    "C'est reparti !"
                ];
                this.say(phrases[Math.floor(Math.random() * phrases.length)]);
            } else {
                // Option désactivée (cachée)
                this.setExpression('surprised');
                const phrases = [
                    "Où elle est passée ? 👀",
                    "Elle se cache maintenant !",
                    "Chut... elle dort 😴",
                    "Elle fait la timide !",
                    "Hop, elle disparaît ! ✨",
                    "Elle joue à cache-cache !",
                    "Où est-elle ? 🤔"
                ];
                this.say(phrases[Math.floor(Math.random() * phrases.length)]);
            }
            
            setTimeout(() => {
                this.setExpression('neutral');
                this.startLifeCycle();
            }, 2000);
        }
    });
  }

  handleClick(e) {
    if (this.state === 'peekaboo') {
        this.endPeekaboo("Tu m'as trouvé !");
        return;
    }

    this.spawnHeart(e.clientX, e.clientY);
    this.clickCount++;
    
    if (this.clickCount >= 5) {
      this.activateDiscoMode();
      this.clickCount = 0;
      return;
    }

    clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => {
      this.interact();
      this.clickCount = 0;
    }, 300);
  }

  spawnHeart(x, y) {
    const heart = document.createElement('div');
    heart.className = 'click-heart';
    heart.innerHTML = '<i class="fa-solid fa-heart"></i>';
    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;
    document.body.appendChild(heart);

    setTimeout(() => {
        heart.remove();
    }, 1000);
  }

  setExpression(type) {
    if (!this.companion) return;
    
    // Types: 'neutral', 'happy', 'sad', 'angry', 'surprised', 'sleep', 'dizzy'
    const face = this.companion.querySelector('.companion-face');
    if (face) {
      face.className = 'companion-face';
      face.classList.add(type);
      this.currentExpression = type;
    }
  }

  // --- ACTIONS & RÉACTIONS ---

  reactToSpinStart() {
    this.stopLifeCycle();
    
    // Nettoyer tous les états de mouvement potentiels
    this.companion.classList.remove('rolling', 'walking', 'jump');
    
    // Reset de la rotation du body si elle était en cours (rolling)
    const body = this.companion.querySelector('.companion-body');
    if (body) {
        // Force reflow pour arrêter l'animation CSS immédiatement
        body.style.animation = 'none';
        void body.offsetWidth;
        body.style.animation = ''; 
    }

    this.wakeUp();
    this.jump();
    this.setExpression('angry'); // Ou déterminé
    
    const phrases = [
      "Chargez !! 🔥",
      "Allez, tourne ! 💫",
      "Ça va être épique !",
      "Suspense maximum !",
      "Je croise les doigts ! 🤞",
      "C'est parti ! 🎡",
      "Roule ma poule !",
      "On y va ! 🚀",
      "Le moment de vérité !",
      "Ça tourne, ça tourne !",
      "J'ai hâte de voir ! 👀"
    ];
    this.say(phrases[Math.floor(Math.random() * phrases.length)]);
    
    setTimeout(() => {
        this.setExpression('dizzy');
    }, 1000);
  }

  celebrate() {
    this.stopLifeCycle();
    this.wakeUp();
    
    this.state = 'jump';
    this.companion.classList.add('jump');
    this.setExpression('happy');
    
    const phrases = [
      "Wooooow ! 🎉",
      "Incroyable ! ✨",
      "C'est lui ! C'est lui !",
      "Bravo ! 🎊",
      "Gagné ! 🏆",
      "Yes ! C'est le bon !",
      "Parfait ! 🎯",
      "J'adore ce choix !",
      "Excellent ! 🌟",
      "C'est celui-là ! 🎪",
      "Magnifique ! 💫",
      "Top choix ! 👏",
      "Génial ! 🎨",
      "Parfait timing ! ⏰",
      "J'aime bien celui-là ! ❤️"
    ];
    this.say(phrases[Math.floor(Math.random() * phrases.length)]);
    
    let jumps = 0;
    const jumpInterval = setInterval(() => {
      this.companion.classList.remove('jump');
      void this.companion.offsetWidth;
      this.companion.classList.add('jump');
      jumps++;
      
      if (jumps >= 3) {
        clearInterval(jumpInterval);
        this.companion.classList.remove('jump');
        this.state = 'idle';
        this.setExpression('neutral');
        this.startLifeCycle();
      }
    }, 600);
  }

  interact() {
    this.jump();
    this.setExpression('happy');
    
    // 15% de chance (c'est bien dosé)
    if (Math.random() < 0.15) {
      this.say("Code créateur <b>Kapands</b>");
      setTimeout(() => this.setExpression('neutral'), 1500);
      return;
    }

    const phrases = [
      "On fait tourner ?",
      "J'aime les pèches !",
      "C'est calme...",
      "Les problèmes arriveront plus tard...",
      "🍑🍑🍑",
      "Calin si consenti !"
    ];
    this.say(phrases[Math.floor(Math.random() * phrases.length)]);
    setTimeout(() => this.setExpression('neutral'), 1500);
  }

  activateDiscoMode() {
    this.stopLifeCycle();
    this.state = 'disco';
    this.companion.classList.add('disco');
    this.setExpression('cool');
    this.say("DISCO TIME ! 🕺");
    
    setTimeout(() => {
      this.companion.classList.remove('disco');
      
      const sprite = this.companion.querySelector('.companion-sprite');
      if (sprite) {
        sprite.style.animation = 'none';
        void sprite.offsetWidth; 
        sprite.style.animation = ''; 
      }

      this.state = 'idle';
      this.setExpression('neutral');
      this.startLifeCycle();
    }, 5000);
  }

  startDrag(e) {
    if (!this.isActive) return;
    this.isDragging = true;
    this.state = 'dragged';
    this.companion.classList.add('dragged');
    this.setExpression('surprised');
    this.say("Wiiii !");
    
    cancelAnimationFrame(this.animationFrame);
    clearTimeout(this.moveTimer);
  }

  onDrag(e) {
    if (!this.isDragging) return;
    this.x = e.clientX;
    this.y = e.clientY;
    this.updatePosition();
  }

  stopDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.companion.classList.remove('dragged');
    
    // Limite minimale : 120px du bas pour rester visible
    const minY = window.innerHeight - 120;
    // Tolérance de 10px pour éviter les chutes inutiles dues aux arrondis
    if (this.y < minY - 10) {
      // Seulement si vraiment au-dessus de la position minimale
      this.fallToFloor();
    } else {
      // S'assurer que la position est correcte
      if (this.y < minY) {
        this.y = minY;
        this.updatePosition();
      }
      this.state = 'idle';
      this.setExpression('neutral');
      this.startLifeCycle();
    }
  }

  fallToFloor() {
    this.setExpression('surprised');
    // Position finale : 120px du bas pour être visible mais pas trop haut
    const floorY = window.innerHeight - 120;
    
    const animate = () => {
      if (this.y < floorY) {
        this.y += 15;
        // S'assurer qu'on ne dépasse jamais floorY
        if (this.y > floorY) {
          this.y = floorY;
        }
        this.updatePosition();
        requestAnimationFrame(animate);
      } else {
        // S'assurer que la position finale est exactement floorY
        this.y = floorY;
        this.updatePosition();
        this.say("Ouf !");
        
        // Appliquer l'animation de rebond via CSS
        this.companion.classList.add('bounce-landing');
        
        // Retirer la classe une fois l'animation finie
        setTimeout(() => {
            this.companion.classList.remove('bounce-landing');
            this.state = 'idle';
            this.setExpression('neutral');
            this.startLifeCycle();
        }, 600);
      }
    };
    animate();
  }

  updatePosition() {
    if (this.companion) {
      // Exception pour le peekaboo : on peut aller jusqu'en bas de l'écran
      if (this.state !== 'peekaboo') {
        // S'assurer que le compagnon ne dépasse jamais le bas de l'écran
        const maxY = window.innerHeight - 120; // 120px du bas
        if (this.y > maxY) {
          this.y = maxY;
        }
      }
      
      this.companion.style.left = `${this.x}px`;
      this.companion.style.top = `${this.y}px`;
      
      const wrapper = this.companion.querySelector('.companion-wrapper');
      if (wrapper) {
        wrapper.style.transform = `scaleX(${this.direction})`;
      }
    }
  }

  decideNextAction() {
    if (!this.isActive || this.isDragging) return;

    this.wakeUp();
    
    // S'assurer qu'on n'est pas en état "surprised" si on est en idle
    if (this.state === 'idle' && this.currentExpression === 'surprised') {
      this.setExpression('neutral');
    }

    if (Math.random() < 0.05) {
      this.triggerGlitch();
      return;
    }

    // Plus de "idle" pour calmer le jeu, et retrait de "disco" (réservé au clic)
    // peekaboo un peu plus fréquent (2 fois sur ~15 actions)
    const actions = ['idle', 'idle', 'idle', 'idle', 'walk', 'walk', 'walk', 'roll', 'sleep', 'promote', 'talk', 'talk', 'peekaboo', 'peekaboo'];
    const nextAction = actions[Math.floor(Math.random() * actions.length)];
    
    // Pause beaucoup plus longue entre les actions (5 à 10 secondes)
    const duration = 5000 + Math.random() * 5000;

    switch (nextAction) {
      case 'peekaboo':
        this.playPeekaboo();
        break;
      case 'talk':
        this.interact();
        this.actionTimer = setTimeout(() => this.decideNextAction(), 3000);
        break;
      case 'promote':
        this.say("Code créateur <b>Kapands</b>");
        this.actionTimer = setTimeout(() => this.decideNextAction(), 3000);
        break;
      case 'disco':
        this.activateDiscoMode();
        break;
      case 'walk':
        this.pickRandomTarget();
        this.walkToTarget();
        break;
      case 'roll':
        this.pickRandomTarget();
        this.rollToTarget();
        break;
      case 'jump':
        this.jump();
        this.actionTimer = setTimeout(() => this.decideNextAction(), 1500);
        break;
      case 'sleep':
        this.goToSleep();
        this.actionTimer = setTimeout(() => this.decideNextAction(), 5000);
        break;
      default: // idle
        // Toujours réinitialiser à neutral en idle pour éviter les expressions surprises
        this.setExpression('neutral');
        this.state = 'idle';
        this.actionTimer = setTimeout(() => this.decideNextAction(), duration);
        break;
    }
  }

  goToSleep(manualSleep = false) {
    this.state = 'sleep';
    this.setExpression('sleep');
    
    // Arrêter le cycle de vie pendant le sommeil
    this.stopLifeCycle();
    
    // Ajouter la classe sleep pour le style
    this.companion.classList.add('sleeping');
    
    this.zzzInterval = setInterval(() => {
      if (this.state !== 'sleep') {
        clearInterval(this.zzzInterval);
        return;
      }
      const zzz = document.createElement('div');
      zzz.className = 'companion-zzz';
      zzz.textContent = 'Z';
      this.companion.appendChild(zzz);
      
      setTimeout(() => {
        if (zzz.parentNode) zzz.parentNode.removeChild(zzz);
      }, 2000);
    }, 800);
    
    // Durée du sommeil : plus long si c'est manuel (bouton), sinon automatique (court)
    const sleepDuration = manualSleep ? 30000 : 10000; // 30 secondes si manuel, 10 secondes si automatique
    
    // Se réveiller automatiquement après la durée définie
    setTimeout(() => {
      if (this.state === 'sleep') {
        this.wakeUp();
        this.startLifeCycle();
      }
    }, sleepDuration);
  }

  wakeUp() {
    if (this.state === 'sleep') {
      this.state = 'idle';
      this.setExpression('neutral');
      this.companion.classList.remove('sleeping');
    }
    clearInterval(this.zzzInterval);
    const zzzs = this.companion.querySelectorAll('.companion-zzz');
    zzzs.forEach(el => el.parentNode.removeChild(el));
  }

  triggerGlitch() {
    this.state = 'glitch';
    this.companion.classList.add('glitch');
    this.setExpression('surprised');
    this.say("Wizzz !");
    
    setTimeout(() => {
      this.companion.classList.remove('glitch');
      this.state = 'idle';
      this.setExpression('neutral');
      this.decideNextAction();
    }, 1000);
  }

  playPeekaboo() {
    this.state = 'peekaboo';
    
    // Fermer le panneau de soins s'il est ouvert
    this.closeCarePanel();
    
    // Position : Très bas (on ne voit que le haut du crâne)
    const deepHideY = window.innerHeight - 5; 
    
    // 1. On se cache rapidement
    this.companion.style.transition = 'top 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    this.y = deepHideY;
    this.updatePosition();
    this.setExpression('surprised'); 
    
    // Reset transition
    setTimeout(() => {
        this.companion.style.transition = '';
        // Démarrer la boucle d'observation
        this.peekLoop();
    }, 500);
    
    // Fin automatique après 12s si pas trouvé
    this.actionTimer = setTimeout(() => {
        if (this.state === 'peekaboo') {
            this.endPeekaboo("Coucou !");
        }
    }, 12000);
  }

  peekLoop() {
      if (this.state !== 'peekaboo') return;

      // Délai aléatoire avant de regarder
      const nextPeek = 1000 + Math.random() * 2000;

      this.peekTimer = setTimeout(() => {
          if (this.state !== 'peekaboo') return;

          // On sort la tête (Peek UP)
          this.companion.style.transition = 'top 0.3s ease-out';
          this.y = window.innerHeight - 45; // On montre les yeux
          this.updatePosition();
          this.setExpression('surprised'); // "Je te vois !"

          // On redescend après un court instant (Peek DOWN)
          setTimeout(() => {
              if (this.state !== 'peekaboo') return;
              this.y = window.innerHeight - 5; // On se recache
              this.updatePosition();
              
              // On relance la boucle
              this.peekLoop();
          }, 800);

      }, nextPeek);
  }

  endPeekaboo(message) {
      if (this.state !== 'peekaboo') return;
      
      clearTimeout(this.actionTimer);
      clearTimeout(this.peekTimer); // Arrêter l'observation
      
      // Arrêter la boucle peekaboo
      this.peekTimer = null;
      
      // Remonter définitivement à la position normale en bas de l'écran
      this.companion.style.transition = 'top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      
      // Réinitialiser l'état AVANT de changer la position pour que updatePosition() applique la limite normale
      this.state = 'idle';
      
      // Revenir à la position normale (120px du bas pour être visible)
      this.y = window.innerHeight - 120;
      
      // Forcer la mise à jour de la position immédiatement
      if (this.companion) {
        this.companion.style.top = `${this.y}px`;
        // Forcer un reflow pour s'assurer que le changement est appliqué
        void this.companion.offsetHeight;
      }
      
      this.setExpression('happy');
      
      this.jump();
      this.say(message);

      setTimeout(() => {
          this.companion.style.transition = '';
          this.setExpression('neutral');
          this.startLifeCycle();
      }, 2000);
  }

  pickRandomTarget() {
    const margin = 50;
    const spinBtn = document.getElementById('spin');
    let targetX = 0;
    let attempts = 0;
    let isValid = false;

    while (!isValid && attempts < 10) {
      targetX = margin + Math.random() * (window.innerWidth - margin * 2);
      
      if (Math.abs(targetX - this.x) < 50) {
        attempts++;
        continue;
      }

      if (spinBtn) {
        const rect = spinBtn.getBoundingClientRect();
        if (targetX > rect.left - 60 && targetX < rect.right + 60) {
          attempts++;
          continue;
        }
      }
      isValid = true;
    }

    this.targetX = targetX;
    this.direction = this.targetX > this.x ? 1 : -1;
  }

  walkToTarget() {
    this.state = 'walk';
    this.companion.classList.add('walking');
    
    const animate = () => {
      if (!this.isActive || this.isDragging || this.state !== 'walk') {
        this.companion.classList.remove('walking');
        return;
      }

      const dx = this.targetX - this.x;
      if (Math.abs(dx) < 5) {
        this.state = 'idle';
        this.companion.classList.remove('walking');
        this.decideNextAction();
        return;
      }

      this.x += Math.sign(dx) * this.speed;
      this.updatePosition();
      this.animationFrame = requestAnimationFrame(animate);
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }

  rollToTarget() {
    this.state = 'roll';
    this.companion.classList.add('rolling');
    this.setExpression('happy'); // On s'amuse
    
    const animate = () => {
      if (!this.isActive || this.isDragging || this.state !== 'roll') {
        this.companion.classList.remove('rolling');
        return;
      }

      const dx = this.targetX - this.x;
      if (Math.abs(dx) < 5) {
        this.state = 'idle';
        this.companion.classList.remove('rolling');
        this.setExpression('neutral');
        this.decideNextAction();
        return;
      }

      this.x += Math.sign(dx) * (this.speed * 2);
      this.updatePosition();
      this.animationFrame = requestAnimationFrame(animate);
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }

  jump() {
    if (this.state === 'jump') return;
    this.state = 'jump';
    this.companion.classList.add('jump');
    setTimeout(() => {
      this.companion.classList.remove('jump');
      this.state = 'idle';
    }, 500);
  }

  say(text) {
    const bubble = this.companion.querySelector('.companion-bubble');
    if (bubble) {
      const textSpan = bubble.querySelector('.bubble-text');
      const sparkles = bubble.querySelector('.companion-sparkles');
      
      if (textSpan) {
        textSpan.innerHTML = text;
      }
      
      // Ajouter des effets selon le type de message
      if (text.includes('🎉') || text.includes('Wooooow')) {
        if (sparkles) sparkles.className = 'fa-solid fa-sparkles companion-sparkles sparkle-gold';
      } else if (text.includes('🔥') || text.includes('Chargez')) {
        if (sparkles) sparkles.className = 'fa-solid fa-fire companion-sparkles sparkle-fire';
      } else if (text.includes('❤️') || text.includes('Code créateur')) {
        if (sparkles) sparkles.className = 'fa-solid fa-heart companion-sparkles sparkle-heart';
      } else {
        if (sparkles) sparkles.className = 'fa-solid fa-sparkles companion-sparkles';
      }
      
      bubble.classList.add('show');
      setTimeout(() => {
        bubble.classList.remove('show');
      }, 2000);
    }
  }

  stopLifeCycle() {
    clearTimeout(this.actionTimer);
    clearTimeout(this.inactivityTimer);
    clearTimeout(this.peekTimer);
    clearInterval(this.needsInterval);
    cancelAnimationFrame(this.animationFrame);
  }

  startLifeCycle() {
    this.decideNextAction();
    this.resetInactivityTimer();
  }

  resetInactivityTimer() {
    clearTimeout(this.inactivityTimer);
    if (!this.isActive) return;

    this.inactivityTimer = setTimeout(() => {
      this.reactToInactivity();
    }, 60000); // 1 minute
  }

  reactToInactivity() {
    if (!this.isActive || this.state === 'sleep') return;
    
    // Interrompre ce qu'elle faisait
    this.stopLifeCycle();
    this.wakeUp();
    
    this.state = 'idle';
    this.setExpression('sad'); // Un peu triste/ennuyée
    this.say("C'est calme...");
    
    // Soupirer (petite animation jump inversée ?)
    // On reprend la vie normale après
    setTimeout(() => {
        this.setExpression('neutral');
        this.startLifeCycle();
    }, 3000);
  }

  despawn() {
    if (!this.companion) return;

    this.isActive = false;
    this.summonBtn.classList.remove('active');
    this.stopLifeCycle();
    this.wakeUp();
    
    // Supprimer le panneau de soins
    this.removeCarePanel();

    this.companion.style.transform = 'scale(0)';
    setTimeout(() => {
      if (this.companion && this.companion.parentNode) {
        this.companion.parentNode.removeChild(this.companion);
      }
      this.companion = null;
    }, 300);
  }

  // ========================================
  // SYSTÈME DE BESOINS (Tamagotchi)
  // ========================================

  startNeedsSystem() {
    // Mettre à jour les besoins toutes les 30 secondes
    this.needsInterval = setInterval(() => {
      if (this.isActive) {
        this.updateNeeds('time');
      }
    }, 30000);
  }

  updateNeeds(reason) {
    const now = Date.now();
    const elapsed = (now - this.needs.lastUpdate) / 1000; // en secondes
    
    if (reason === 'time') {
      // Diminuer progressivement les besoins avec le temps
      this.needs.hunger = Math.max(0, this.needs.hunger - 0.5);
      this.needs.energy = Math.max(0, this.needs.energy - 0.3);
      
      // Le bonheur diminue si les autres besoins sont bas
      if (this.needs.hunger < 30 || this.needs.energy < 30) {
        this.needs.happiness = Math.max(0, this.needs.happiness - 0.5);
      }
    } else if (reason === 'activity') {
      // L'activité augmente légèrement le bonheur
      this.needs.happiness = Math.min(100, this.needs.happiness + 0.2);
    } else if (reason === 'feed') {
      this.needs.hunger = Math.min(100, this.needs.hunger + 30);
      this.needs.happiness = Math.min(100, this.needs.happiness + 10);
    } else if (reason === 'play') {
      this.needs.happiness = Math.min(100, this.needs.happiness + 20);
      this.needs.energy = Math.max(0, this.needs.energy - 10);
    } else if (reason === 'cuddle') {
      // Les câlins augmentent beaucoup le bonheur sans consommer d'énergie
      this.needs.happiness = Math.min(100, this.needs.happiness + 25);
    } else if (reason === 'sleep') {
      this.needs.energy = Math.min(100, this.needs.energy + 50);
    }
    
    this.needs.lastUpdate = now;
    this.updateCarePanel();
    this.checkNeedsStatus();
  }

  checkNeedsStatus() {
    if (!this.isActive) return;
    
    // Réactions selon les besoins
    if (this.needs.hunger < 20) {
      if (Math.random() < 0.1) { // 10% de chance
        this.setExpression('sad');
        this.say("J'ai faim... 🍑");
        setTimeout(() => this.setExpression('neutral'), 2000);
      }
    }
    
    if (this.needs.energy < 20 && this.state !== 'sleep') {
      if (Math.random() < 0.15) { // 15% de chance
        this.goToSleep();
      }
    }
    
    if (this.needs.happiness < 30) {
      if (Math.random() < 0.1) { // 10% de chance
        this.setExpression('sad');
        this.say("Je m'ennuie...");
        setTimeout(() => this.setExpression('neutral'), 2000);
      }
    }
  }

  // ========================================
  // PANNEAU DE SOINS
  // ========================================

  createCarePanel() {
    if (!this.companion) return;
    
    const carePanel = document.createElement('div');
    carePanel.id = 'companion-care-panel';
    carePanel.className = 'companion-care-panel';
    carePanel.style.display = 'none';
    carePanel.innerHTML = `
      <div class="care-stats">
        <div class="care-stat">
          <i class="fa-solid fa-heart"></i>
          <div class="care-bar">
            <div class="care-bar-fill" id="happiness-bar" style="width: 100%"></div>
          </div>
        </div>
        <div class="care-stat">
          <i class="fa-solid fa-utensils"></i>
          <div class="care-bar">
            <div class="care-bar-fill" id="hunger-bar" style="width: 50%"></div>
          </div>
        </div>
        <div class="care-stat">
          <i class="fa-solid fa-bolt"></i>
          <div class="care-bar">
            <div class="care-bar-fill" id="energy-bar" style="width: 100%"></div>
          </div>
        </div>
      </div>
      <div class="care-actions">
        <button class="care-btn" id="feed-btn" title="Nourrir">
          <i class="fa-solid fa-apple-whole"></i>
        </button>
        <button class="care-btn" id="cuddle-btn" title="Faire un câlin">
          <i class="fa-solid fa-heart"></i>
        </button>
        <button class="care-btn" id="sleep-btn" title="Faire dormir">
          <i class="fa-solid fa-moon"></i>
        </button>
      </div>
    `;
    
    this.companion.appendChild(carePanel);
    
    // Attacher les événements
    document.getElementById('feed-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.feed();
    });
    document.getElementById('cuddle-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.cuddle();
    });
    document.getElementById('sleep-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.sleep();
    });
  }

  toggleCarePanel() {
    const panel = document.getElementById('companion-care-panel');
    if (panel) {
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
      
      // Fermer si on clique ailleurs
      if (!isVisible) {
        setTimeout(() => {
          const closeHandler = (e) => {
            if (!panel.contains(e.target) && !this.companion.contains(e.target)) {
              panel.style.display = 'none';
              document.removeEventListener('click', closeHandler);
            }
          };
          document.addEventListener('click', closeHandler);
        }, 10);
      }
    }
  }

  closeCarePanel() {
    const panel = document.getElementById('companion-care-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  }

  removeCarePanel() {
    const panel = document.getElementById('companion-care-panel');
    if (panel) panel.remove();
  }

  updateCarePanel() {
    if (!this.companion) return;
    
    const happinessBar = document.getElementById('happiness-bar');
    const hungerBar = document.getElementById('hunger-bar');
    const energyBar = document.getElementById('energy-bar');
    
    if (happinessBar) {
      happinessBar.style.width = `${this.needs.happiness}%`;
      happinessBar.style.backgroundColor = this.needs.happiness > 50 ? '#4ecdc4' : '#ff6b6b';
    }
    if (hungerBar) {
      hungerBar.style.width = `${this.needs.hunger}%`;
      hungerBar.style.backgroundColor = this.needs.hunger > 50 ? '#95e1d3' : '#ffa07a';
    }
    if (energyBar) {
      energyBar.style.width = `${this.needs.energy}%`;
      energyBar.style.backgroundColor = this.needs.energy > 50 ? '#ffe66d' : '#ffd93d';
    }
  }

  feed() {
    if (!this.isActive) return;
    this.updateNeeds('feed');
    this.setExpression('happy');
    this.jump();
    const phrases = [
      "Miam ! Merci ! 🍑",
      "C'est bon !",
      "J'adore !",
      "Encore ! Encore !"
    ];
    this.say(phrases[Math.floor(Math.random() * phrases.length)]);
    setTimeout(() => this.setExpression('neutral'), 2000);
  }

  cuddle() {
    if (!this.isActive) return;
    this.updateNeeds('cuddle');
    this.setExpression('happy');
    
    // Animation de câlin (mouvement doux vers le haut puis retour)
    this.companion.style.transition = 'transform 0.3s ease';
    this.companion.style.transform = 'scale(1.1)';
    
    setTimeout(() => {
      this.companion.style.transform = 'scale(1)';
    }, 300);
    
    // Spawn des cœurs
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const heartX = this.x + (Math.random() - 0.5) * 40;
        const heartY = this.y - 20 - Math.random() * 20;
        this.spawnHeart(heartX, heartY);
      }, i * 200);
    }
    
    const phrases = [
      "Aww, merci ! 💕",
      "J'adore les câlins !",
      "C'est si doux !",
      "Encore un câlin ! 🥰",
      "Tu es trop gentil(le) !"
    ];
    this.say(phrases[Math.floor(Math.random() * phrases.length)]);
    setTimeout(() => {
      this.companion.style.transition = '';
      this.setExpression('neutral');
    }, 2000);
  }

  sleep() {
    if (!this.isActive || this.state === 'sleep') return;
    this.updateNeeds('sleep');
    this.goToSleep(true); // true = sommeil manuel (plus long)
    this.say("Bonne nuit... 😴");
  }

  // ========================================
  // JEU DE RAPIDITÉ
  // ========================================

  startQuickClickGame() {
    if (!this.isActive || this.quickClickGame.active) return;
    
    this.quickClickGame.active = true;
    this.setExpression('surprised');
    this.say("Attrape-moi si tu peux ! 👀");
    
    // Le compagnon devient cliquable pendant 3 secondes
    this.companion.style.cursor = 'pointer';
    this.companion.classList.add('quick-click-target');
    
    // Timer : le jeu se termine après 3 secondes
    this.quickClickGame.timeout = setTimeout(() => {
      if (this.quickClickGame.active && !this.quickClickGame.success) {
        this.endQuickClickGame(false);
      }
    }, 3000);
    
    // Écouter le clic
    const clickHandler = (e) => {
      if (this.quickClickGame.active) {
        e.stopPropagation();
        this.endQuickClickGame(true);
        this.companion.removeEventListener('click', clickHandler);
      }
    };
    
    this.companion.addEventListener('click', clickHandler, { once: true });
  }

  endQuickClickGame(success) {
    this.quickClickGame.active = false;
    this.quickClickGame.success = success;
    this.companion.style.cursor = '';
    this.companion.classList.remove('quick-click-target');
    
    if (this.quickClickGame.timeout) {
      clearTimeout(this.quickClickGame.timeout);
    }
    
    if (success) {
      this.setExpression('happy');
      this.jump();
      this.updateNeeds('play');
      const phrases = [
        "Tu m'as eu ! 🎉",
        "Bravo !",
        "Tu es rapide !",
        "Gagné ! ✨"
      ];
      this.say(phrases[Math.floor(Math.random() * phrases.length)]);
    } else {
      this.setExpression('neutral');
      this.say("Trop lent ! 😏");
    }
    
    setTimeout(() => {
      this.setExpression('neutral');
    }, 2000);
  }

}
