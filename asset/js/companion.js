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
    
    this.init();
  }

  init() {
    if (this.summonBtn) {
      this.summonBtn.addEventListener('click', () => this.toggleCompanion());
    }
    
    // Détecter l'activité utilisateur globale
    ['mousemove', 'click', 'keydown', 'scroll'].forEach(event => {
      document.addEventListener(event, () => {
        if (this.isActive) this.resetInactivityTimer();
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
      <div class="companion-bubble">Coucou !</div>
    `;
    document.body.appendChild(this.companion);

    this.x = window.innerWidth / 2;
    this.y = window.innerHeight - 100;
    this.updatePosition();

    // Animation d'apparition
    this.companion.style.transform = 'scale(0)';
    requestAnimationFrame(() => {
      this.companion.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      this.companion.style.transform = 'scale(1)';
    });

    // Events internes et globaux
    this.bindEvents();
    
    // Démarrer le cycle de vie
    this.startLifeCycle();
    this.setExpression('happy');
    this.say("Kakou kakou");
    
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
    heart.textContent = '❤️';
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
    this.say("Chargez !! 🔥");
    
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
    this.say("Wooooow ! 🎉");
    
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
    
    if (this.y < window.innerHeight - 100) {
      this.fallToFloor();
    } else {
      this.state = 'idle';
      this.setExpression('neutral');
      this.startLifeCycle();
    }
  }

  fallToFloor() {
    this.setExpression('surprised');
    const floorY = window.innerHeight - 100;
    const animate = () => {
      if (this.y < floorY) {
        this.y += 15;
        this.updatePosition();
        requestAnimationFrame(animate);
      } else {
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

    if (Math.random() < 0.05) {
      this.triggerGlitch();
      return;
    }

    // Plus de "idle" pour calmer le jeu, et retrait de "disco" (réservé au clic)
    const actions = ['idle', 'idle', 'idle', 'idle', 'walk', 'walk', 'roll', 'sleep', 'promote', 'talk', 'peekaboo'];
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
        this.setExpression('neutral');
        this.actionTimer = setTimeout(() => this.decideNextAction(), duration);
        break;
    }
  }

  goToSleep() {
    this.state = 'sleep';
    this.setExpression('sleep');
    
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
  }

  wakeUp() {
    if (this.state === 'sleep') {
        this.setExpression('neutral');
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
      
      // Remonter définitivement
      this.companion.style.transition = 'top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      this.y = window.innerHeight - 100;
      this.updatePosition();
      
      this.jump();
      this.say(message);
      this.state = 'idle';
      this.setExpression('happy');

      setTimeout(() => {
          this.companion.style.transition = '';
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
      bubble.innerHTML = text;
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

    this.companion.style.transform = 'scale(0)';
    setTimeout(() => {
      if (this.companion && this.companion.parentNode) {
        this.companion.parentNode.removeChild(this.companion);
      }
      this.companion = null;
    }, 300);
  }
}
