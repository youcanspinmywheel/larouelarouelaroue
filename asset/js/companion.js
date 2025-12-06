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
    this.state = 'idle'; // idle, walk, jump, sleep, dragged
    
    // Timers
    this.moveTimer = null;
    this.clickCount = 0;
    this.clickTimer = null;
    this.zzzInterval = null;

    this.init();
  }

  init() {
    if (this.summonBtn) {
      this.summonBtn.addEventListener('click', () => this.toggleCompanion());
    }
  }

  toggleCompanion() {
    if (this.isActive) {
      this.despawn();
    } else {
      this.spawn();
    }
  }

  spawn() {
    if (this.companion) return;

    this.isActive = true;
    this.summonBtn.classList.add('active');

    // Créer l'élément
    this.companion = document.createElement('div');
    this.companion.id = 'pixel-companion';
    this.companion.innerHTML = `
      <div class="companion-sprite">🍑</div>
      <div class="companion-shadow"></div>
      <div class="companion-bubble">Coucou !</div>
    `;
    document.body.appendChild(this.companion);

    // Position initiale (centre bas)
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight - 100;
    this.updatePosition();

    // Animation d'apparition
    this.companion.style.transform = 'scale(0)';
    requestAnimationFrame(() => {
      this.companion.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      this.companion.style.transform = 'scale(1)';
    });

    // Events
    this.bindEvents();
    
    // Écouter le bouton Spin
    const spinBtn = document.getElementById('spin');
    if (spinBtn) {
      spinBtn.addEventListener('click', () => {
        if (this.isActive && !this.isDragging) {
          this.reactToSpin();
        }
      });
    }

    // Écouter le résultat de la roue
    document.addEventListener('wheel:result', () => {
      if (this.isActive && !this.isDragging) {
        this.celebrate();
      }
    });
    
    // Démarrer le cycle de vie
    this.startLifeCycle();
    this.say("Kakou kakou");
  }

  reactToSpin() {
    // Annuler l'action en cours
    this.stopLifeCycle();
    
    // Animation spéciale
    this.jump();
    this.say("Chargez !! 🔥");
    
    // Reprendre la vie normale après un moment
    setTimeout(() => {
      this.startLifeCycle();
    }, 2000);
  }

  celebrate() {
    // Annuler l'action en cours
    this.stopLifeCycle();
    
    // Sautiller de joie
    this.state = 'jump';
    this.companion.classList.add('jump');
    this.say("Wooooow ! 🎉");
    
    // Sauter plusieurs fois
    let jumps = 0;
    const jumpInterval = setInterval(() => {
      this.companion.classList.remove('jump');
      // Force reflow
      void this.companion.offsetWidth;
      this.companion.classList.add('jump');
      jumps++;
      
      if (jumps >= 3) {
        clearInterval(jumpInterval);
        this.companion.classList.remove('jump');
        this.state = 'idle';
        this.startLifeCycle();
      }
    }, 600);
  }

  despawn() {
    if (!this.companion) return;

    this.isActive = false;
    this.summonBtn.classList.remove('active');
    
    this.stopLifeCycle();

    this.companion.style.transform = 'scale(0)';
    setTimeout(() => {
      if (this.companion && this.companion.parentNode) {
        this.companion.parentNode.removeChild(this.companion);
      }
      this.companion = null;
    }, 300);
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
        this.handleClick();
      }
    });
  }

  handleClick() {
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

  activateDiscoMode() {
    this.stopLifeCycle();
    this.state = 'disco';
    this.companion.classList.add('disco');
    this.say("DISCO TIME ! 🕺");
    
    setTimeout(() => {
      this.companion.classList.remove('disco');
      this.state = 'idle';
      this.startLifeCycle();
    }, 5000);
  }

  startDrag(e) {
    if (!this.isActive) return;
    this.isDragging = true;
    this.state = 'dragged';
    this.companion.classList.add('dragged');
    this.say("Wiiii !");
    
    // Annuler les mouvements automatiques
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
    
    // Gravité simple : retour au sol si trop haut
    if (this.y < window.innerHeight - 100) {
      this.fallToFloor();
    } else {
      this.state = 'idle';
      this.startLifeCycle();
    }
  }

  fallToFloor() {
    const floorY = window.innerHeight - 100;
    const animate = () => {
      if (this.y < floorY) {
        this.y += 15; // Vitesse de chute
        this.updatePosition();
        requestAnimationFrame(animate);
      } else {
        this.y = floorY;
        this.updatePosition();
        this.say("Ouf !");
        this.state = 'idle';
        this.startLifeCycle();
      }
    };
    animate();
  }

  interact() {
    this.jump();
    
    // 40% de chance d'afficher le code créateur
    if (Math.random() < 0.4) {
      this.say("Code créateur <b>Kapands</b>");
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
  }

  updatePosition() {
    if (this.companion) {
      this.companion.style.left = `${this.x}px`;
      this.companion.style.top = `${this.y}px`;
      
      // Flip horizontal selon la direction
      const sprite = this.companion.querySelector('.companion-sprite');
      if (sprite) {
        sprite.style.transform = `scaleX(${this.direction})`;
      }
    }
  }

  say(text) {
    const bubble = this.companion.querySelector('.companion-bubble');
    if (bubble) {
      bubble.innerHTML = text; // Utiliser innerHTML pour supporter les balises <b>
      bubble.classList.add('show');
      setTimeout(() => {
        bubble.classList.remove('show');
      }, 2000);
    }
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

  startLifeCycle() {
    this.decideNextAction();
  }

  stopLifeCycle() {
    clearTimeout(this.actionTimer);
    cancelAnimationFrame(this.animationFrame);
  }

  decideNextAction() {
    if (!this.isActive || this.isDragging) return;

    // Retirer l'état de sommeil s'il était actif
    this.wakeUp();

    // Parfois un glitch aléatoire
    if (Math.random() < 0.05) {
      this.triggerGlitch();
      return;
    }

    const actions = ['idle', 'walk', 'walk', 'roll', 'jump', 'sleep', 'promote', 'disco', 'talk', 'talk'];
    const nextAction = actions[Math.floor(Math.random() * actions.length)];
    // Pause plus courte (2s à 5s)
    const duration = 2000 + Math.random() * 3000;

    switch (nextAction) {
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
        this.actionTimer = setTimeout(() => this.decideNextAction(), duration);
        break;
    }
  }

  goToSleep() {
    // this.say("Zzz...");
    this.state = 'sleep';
    
    // Ajouter des particules Zzz
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
    clearInterval(this.zzzInterval);
    // Nettoyer les Zzz restants
    const zzzs = this.companion.querySelectorAll('.companion-zzz');
    zzzs.forEach(el => el.parentNode.removeChild(el));
  }

  triggerGlitch() {
    this.state = 'glitch';
    this.companion.classList.add('glitch');
    this.say("Wizzz !");
    
    setTimeout(() => {
      this.companion.classList.remove('glitch');
      this.state = 'idle';
      this.decideNextAction();
    }, 1000);
  }

  pickRandomTarget() {
    // Choisir un point aléatoire sur la largeur de l'écran
    const margin = 50;
    // Éviter la zone du bouton Spin si possible
    const spinBtn = document.getElementById('spin');
    let targetX = 0;
    let attempts = 0;
    let isValid = false;

    while (!isValid && attempts < 5) {
      targetX = margin + Math.random() * (window.innerWidth - margin * 2);
      
      if (spinBtn) {
        const rect = spinBtn.getBoundingClientRect();
        // Si la cible est dans la zone du bouton (avec une marge), on réessaie
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
        // Arrivé
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
    
    const animate = () => {
      if (!this.isActive || this.isDragging || this.state !== 'roll') {
        this.companion.classList.remove('rolling');
        return;
      }

      const dx = this.targetX - this.x;
      if (Math.abs(dx) < 5) {
        // Arrivé
        this.state = 'idle';
        this.companion.classList.remove('rolling');
        this.decideNextAction();
        return;
      }

      // Plus rapide que la marche
      this.x += Math.sign(dx) * (this.speed * 2);
      this.updatePosition();
      this.animationFrame = requestAnimationFrame(animate);
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }
}

