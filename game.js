(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreValue = document.getElementById("scoreValue");
  const waveValue = document.getElementById("waveValue");
  const shieldPips = document.getElementById("shieldPips");
  const startOverlay = document.getElementById("startOverlay");
  const messageOverlay = document.getElementById("messageOverlay");
  const messageTitle = document.getElementById("messageTitle");
  const messageBody = document.getElementById("messageBody");
  const startButton = document.getElementById("startButton");
  const resumeButton = document.getElementById("resumeButton");
  const pauseButton = document.getElementById("pauseButton");
  const soundButton = document.getElementById("soundButton");

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    lastTime: 0,
    running: false,
    started: false,
    paused: false,
    gameOver: false,
    score: 0,
    wave: 1,
    spawnTimer: 0,
    burstQueue: 0,
    burstTimer: 0,
    bossTimer: 22,
    shake: 0,
    muted: false,
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
    fireHeld: false,
    keys: new Set(),
    stars: [],
    trench: [],
    enemies: [],
    bolts: [],
    enemyBolts: [],
    particles: [],
    messages: [],
  };

  const player = {
    x: 0,
    y: 0,
    radius: 18,
    speed: 470,
    fireCooldown: 0,
    shield: 5,
    maxShield: 5,
    invincible: 0,
    drift: 0,
  };

  let audioContext;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = Math.floor(window.innerWidth);
    state.height = Math.floor(window.innerHeight);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    player.x = player.x || state.width * 0.5;
    player.y = player.y || state.height * 0.78;
    buildScene();
  }

  function buildScene() {
    const starCount = Math.floor(clamp((state.width * state.height) / 5200, 90, 260));
    state.stars = Array.from({ length: starCount }, () => ({
      x: random(0, state.width),
      y: random(0, state.height),
      z: random(0.28, 1),
      glow: random(0.25, 1),
    }));

    const stripeCount = 20;
    state.trench = Array.from({ length: stripeCount }, (_, index) => ({
      y: (index / stripeCount) * state.height,
      offset: random(-40, 40),
      tone: Math.random() > 0.5 ? "cyan" : "gold",
    }));
  }

  function resetGame() {
    state.score = 0;
    state.wave = 1;
    state.spawnTimer = 0.3;
    state.burstQueue = 0;
    state.burstTimer = 0;
    state.bossTimer = 22;
    state.shake = 0;
    state.gameOver = false;
    state.paused = false;
    state.enemies = [];
    state.bolts = [];
    state.enemyBolts = [];
    state.particles = [];
    state.messages = [];
    player.x = state.width * 0.5;
    player.y = state.height * 0.78;
    player.shield = player.maxShield;
    player.invincible = 1.2;
    player.fireCooldown = 0;
    updateHud();
  }

  function updateHud() {
    scoreValue.textContent = String(state.score).padStart(6, "0");
    waveValue.textContent = String(state.wave).padStart(2, "0");
    shieldPips.replaceChildren(
      ...Array.from({ length: player.maxShield }, (_, index) => {
        const pip = document.createElement("span");
        pip.className = index < player.shield ? "active" : "";
        return pip;
      }),
    );
  }

  function ensureAudio() {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
  }

  function tone(type) {
    if (state.muted) {
      return;
    }
    ensureAudio();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);

    if (type === "shoot") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
      filter.frequency.value = 1600;
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "hit") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
      filter.frequency.value = 700;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.start(now);
      osc.stop(now + 0.18);
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.22);
      filter.frequency.value = 900;
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  }

  function spawnEnemy(kind = "fighter") {
    const edgePadding = Math.max(70, state.width * 0.08);
    const enemy = {
      kind,
      x: random(edgePadding, state.width - edgePadding),
      y: -50,
      vx: random(-40, 40),
      vy: random(90, 150 + state.wave * 8),
      phase: random(0, Math.PI * 2),
      fireTimer: random(0.8, 1.8),
      radius: kind === "interceptor" ? 19 : kind === "bomber" ? 30 : 23,
      hp: kind === "interceptor" ? 1 : kind === "bomber" ? 4 : 2,
      score: kind === "interceptor" ? 90 : kind === "bomber" ? 220 : 140,
    };
    state.enemies.push(enemy);
  }

  function spawnWave(dt) {
    state.spawnTimer -= dt;
    state.burstTimer -= dt;
    state.bossTimer -= dt;

    if (state.burstQueue > 0 && state.burstTimer <= 0) {
      const index = state.burstQueue;
      spawnEnemy(index % 3 === 0 ? "bomber" : "fighter");
      state.burstQueue -= 1;
      state.burstTimer = 0.18;
    }

    if (state.spawnTimer <= 0) {
      const roll = Math.random();
      const kind = roll < 0.48 ? "interceptor" : roll < 0.84 ? "fighter" : "bomber";
      spawnEnemy(kind);
      state.spawnTimer = clamp(1.05 - state.wave * 0.055, 0.36, 1.05);
    }

    if (state.bossTimer <= 0) {
      state.wave += 1;
      state.bossTimer = clamp(24 - state.wave, 15, 24);
      state.burstQueue = Math.min(2 + state.wave, 7);
      state.burstTimer = 0;
      addMessage(`WAVE ${String(state.wave).padStart(2, "0")}`, 1.5);
      updateHud();
    }
  }

  function addMessage(text, ttl = 1.2) {
    state.messages.push({ text, ttl, life: ttl });
  }

  function shoot() {
    if (player.fireCooldown > 0 || !state.started || state.paused || state.gameOver) {
      return;
    }
    player.fireCooldown = 0.135;
    const spread = state.fireHeld && state.score > 900 ? 8 : 0;
    state.bolts.push(
      { x: player.x - 12 - spread, y: player.y - 24, vx: -28, vy: -720, radius: 4 },
      { x: player.x + 12 + spread, y: player.y - 24, vx: 28, vy: -720, radius: 4 },
    );
    tone("shoot");
  }

  function enemyShoot(enemy) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = enemy.kind === "bomber" ? 250 : 310;
    state.enemyBolts.push({
      x: enemy.x,
      y: enemy.y + enemy.radius * 0.7,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      radius: 5,
    });
  }

  function explode(x, y, color = "gold", amount = 24) {
    const palette =
      color === "cyan"
        ? ["#63d8ff", "#d8f7ff", "#347aff"]
        : color === "red"
          ? ["#ff4a4a", "#ffd2a6", "#f6c667"]
          : ["#f6c667", "#fff1b8", "#ff7a33"];

    for (let i = 0; i < amount; i += 1) {
      const angle = random(0, Math.PI * 2);
      const speed = random(80, 420);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(0.28, 0.82),
        ttl: random(0.28, 0.82),
        size: random(1.4, 4.5),
        color: palette[Math.floor(random(0, palette.length))],
      });
    }
  }

  function damagePlayer() {
    if (player.invincible > 0 || state.gameOver) {
      return;
    }
    player.shield -= 1;
    player.invincible = 1.15;
    state.shake = 12;
    explode(player.x, player.y, "cyan", 18);
    tone("hit");
    updateHud();

    if (player.shield <= 0) {
      state.gameOver = true;
      state.running = false;
      explode(player.x, player.y, "red", 64);
      showMessage("MISSION FAILED", `SCORE ${String(state.score).padStart(6, "0")}`, "RETRY");
      tone("explode");
    }
  }

  function updatePlayer(dt) {
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.invincible = Math.max(0, player.invincible - dt);
    player.drift += dt;

    let dx = 0;
    let dy = 0;
    if (state.keys.has("arrowleft") || state.keys.has("a")) dx -= 1;
    if (state.keys.has("arrowright") || state.keys.has("d")) dx += 1;
    if (state.keys.has("arrowup") || state.keys.has("w")) dy -= 1;
    if (state.keys.has("arrowdown") || state.keys.has("s")) dy += 1;

    if (state.pointerActive) {
      const follow = 1 - Math.pow(0.001, dt);
      player.x += (state.pointerX - player.x) * follow;
      player.y += (state.pointerY - player.y) * follow;
    }

    const moving = Math.hypot(dx, dy);
    if (moving > 0) {
      const boost = state.keys.has("shift") ? 1.42 : 1;
      player.x += (dx / moving) * player.speed * boost * dt;
      player.y += (dy / moving) * player.speed * boost * dt;
    }

    player.x = clamp(player.x, 42, state.width - 42);
    player.y = clamp(player.y, state.height * 0.32, state.height - 52);

    if (state.fireHeld || state.keys.has(" ")) {
      shoot();
    }
  }

  function updateStars(dt) {
    for (const star of state.stars) {
      star.y += (170 + 420 * star.z + state.wave * 8) * dt;
      star.x += Math.sin((star.y + star.z * 100) * 0.01) * star.z * 0.22;
      if (star.y > state.height + 8) {
        star.y = -8;
        star.x = random(0, state.width);
        star.z = random(0.28, 1);
      }
    }

    for (const stripe of state.trench) {
      stripe.y += (260 + state.wave * 20) * dt;
      stripe.offset += Math.sin(stripe.y * 0.012) * 0.5;
      if (stripe.y > state.height + 80) {
        stripe.y = -60;
        stripe.offset = random(-50, 50);
        stripe.tone = Math.random() > 0.5 ? "cyan" : "gold";
      }
    }
  }

  function updateEnemies(dt) {
    for (const enemy of state.enemies) {
      enemy.phase += dt * 2.4;
      const weave = enemy.kind === "bomber" ? 26 : enemy.kind === "interceptor" ? 64 : 42;
      enemy.x += (enemy.vx + Math.sin(enemy.phase) * weave) * dt;
      enemy.y += enemy.vy * dt;
      enemy.x = clamp(enemy.x, 32, state.width - 32);
      enemy.fireTimer -= dt;

      if (enemy.fireTimer <= 0 && enemy.y > 40 && enemy.y < state.height * 0.72) {
        enemyShoot(enemy);
        enemy.fireTimer = enemy.kind === "bomber" ? random(0.95, 1.45) : random(1.3, 2.2);
      }
    }

    state.enemies = state.enemies.filter((enemy) => {
      if (enemy.y > state.height + 80) {
        return false;
      }
      const hitPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.radius + player.radius;
      if (hitPlayer) {
        enemy.hp = 0;
        damagePlayer();
        explode(enemy.x, enemy.y, "red", 22);
        return false;
      }
      return enemy.hp > 0;
    });
  }

  function updateBolts(dt) {
    for (const bolt of state.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
    }
    for (const bolt of state.enemyBolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
    }

    for (const bolt of state.bolts) {
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        if (Math.hypot(bolt.x - enemy.x, bolt.y - enemy.y) < enemy.radius + bolt.radius) {
          enemy.hp -= 1;
          bolt.dead = true;
          explode(bolt.x, bolt.y, "gold", 6);
          if (enemy.hp <= 0) {
            state.score += enemy.score;
            state.shake = Math.max(state.shake, enemy.kind === "bomber" ? 8 : 4);
            explode(enemy.x, enemy.y, "red", enemy.kind === "bomber" ? 36 : 22);
            tone("explode");
            updateHud();
          }
          break;
        }
      }
    }

    for (const bolt of state.enemyBolts) {
      if (Math.hypot(bolt.x - player.x, bolt.y - player.y) < player.radius + bolt.radius) {
        bolt.dead = true;
        damagePlayer();
      }
    }

    state.bolts = state.bolts.filter((bolt) => !bolt.dead && bolt.y > -50 && bolt.y < state.height + 60);
    state.enemyBolts = state.enemyBolts.filter(
      (bolt) =>
        !bolt.dead &&
        bolt.x > -60 &&
        bolt.x < state.width + 60 &&
        bolt.y > -70 &&
        bolt.y < state.height + 70,
    );
  }

  function updateParticles(dt) {
    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - 1.8 * dt;
      particle.vy *= 1 - 1.8 * dt;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);

    for (const message of state.messages) {
      message.life -= dt;
    }
    state.messages = state.messages.filter((message) => message.life > 0);
    state.shake = Math.max(0, state.shake - 30 * dt);
  }

  function update(dt) {
    updateStars(dt);
    if (!state.running || state.paused || state.gameOver) {
      updateParticles(dt);
      return;
    }
    spawnWave(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateBolts(dt);
    updateParticles(dt);
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
    gradient.addColorStop(0, "#030712");
    gradient.addColorStop(0.48, "#06101e");
    gradient.addColorStop(1, "#130909");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const star of state.stars) {
      const alpha = 0.18 + star.glow * 0.76;
      ctx.fillStyle = `rgba(230, 246, 255, ${alpha})`;
      ctx.fillRect(star.x, star.y, 1.2 + star.z * 2.8, 1.2 + star.z * 7);
    }
    ctx.restore();
  }

  function drawTrench() {
    const horizon = state.height * 0.22;
    const center = state.width * 0.5;
    const leftNear = state.width * 0.08;
    const rightNear = state.width * 0.92;
    const leftFar = state.width * 0.42;
    const rightFar = state.width * 0.58;

    ctx.save();
    ctx.globalAlpha = 0.86;
    const floor = ctx.createLinearGradient(0, horizon, 0, state.height);
    floor.addColorStop(0, "rgba(99, 216, 255, 0.03)");
    floor.addColorStop(1, "rgba(246, 198, 103, 0.11)");
    ctx.fillStyle = floor;
    ctx.beginPath();
    ctx.moveTo(leftFar, horizon);
    ctx.lineTo(rightFar, horizon);
    ctx.lineTo(rightNear, state.height);
    ctx.lineTo(leftNear, state.height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(99, 216, 255, 0.28)";
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i += 1) {
      const nearX = center + i * state.width * 0.12;
      const farX = center + i * state.width * 0.025;
      ctx.beginPath();
      ctx.moveTo(farX, horizon);
      ctx.lineTo(nearX, state.height);
      ctx.stroke();
    }

    for (const stripe of state.trench) {
      const t = clamp((stripe.y - horizon) / (state.height - horizon), 0, 1);
      const width = 45 + t * state.width * 0.9;
      const x = center + stripe.offset * t;
      const color = stripe.tone === "cyan" ? "99, 216, 255" : "246, 198, 103";
      ctx.strokeStyle = `rgba(${color}, ${0.12 + t * 0.42})`;
      ctx.lineWidth = 1 + t * 3;
      ctx.beginPath();
      ctx.moveTo(x - width * 0.5, stripe.y);
      ctx.lineTo(x + width * 0.5, stripe.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    const flicker = player.invincible > 0 && Math.floor(player.invincible * 16) % 2 === 0;
    if (flicker) {
      ctx.globalAlpha = 0.45;
    }

    ctx.shadowColor = "#63d8ff";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(99, 216, 255, 0.78)";
    ctx.beginPath();
    ctx.ellipse(-15, 20, 8, 26, -0.15, 0, Math.PI * 2);
    ctx.ellipse(15, 20, 8, 26, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d8f7ff";
    ctx.strokeStyle = "#63d8ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(26, 20);
    ctx.lineTo(9, 16);
    ctx.lineTo(0, 34);
    ctx.lineTo(-9, 16);
    ctx.lineTo(-26, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0d1b2d";
    ctx.beginPath();
    ctx.ellipse(0, -6, 7, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(246, 198, 103, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-17, 12);
    ctx.lineTo(-33, 21);
    ctx.moveTo(17, 12);
    ctx.lineTo(33, 21);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(Math.sin(enemy.phase) * 0.08);

    if (enemy.kind === "interceptor") {
      ctx.fillStyle = "#202833";
      ctx.strokeStyle = "#ff4a4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 24);
      ctx.lineTo(18, -18);
      ctx.lineTo(5, -12);
      ctx.lineTo(0, -26);
      ctx.lineTo(-5, -12);
      ctx.lineTo(-18, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (enemy.kind === "bomber") {
      ctx.fillStyle = "#2f2935";
      ctx.strokeStyle = "#f6c667";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-27, -18, 54, 36, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff4a4a";
      ctx.fillRect(-20, -26, 7, 52);
      ctx.fillRect(13, -26, 7, 52);
    } else {
      ctx.fillStyle = "#182433";
      ctx.strokeStyle = "#ff4a4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 26);
      ctx.lineTo(24, -7);
      ctx.lineTo(10, -4);
      ctx.lineTo(0, -24);
      ctx.lineTo(-10, -4);
      ctx.lineTo(-24, -7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 74, 74, 0.85)";
    ctx.shadowColor = "#ff4a4a";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 4, enemy.kind === "bomber" ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBolts() {
    ctx.save();
    ctx.lineCap = "round";

    for (const bolt of state.bolts) {
      const beam = ctx.createLinearGradient(bolt.x, bolt.y + 18, bolt.x, bolt.y - 18);
      beam.addColorStop(0, "rgba(99, 216, 255, 0)");
      beam.addColorStop(0.45, "#f8fbff");
      beam.addColorStop(1, "#63d8ff");
      ctx.strokeStyle = beam;
      ctx.lineWidth = 4.5;
      ctx.shadowColor = "#63d8ff";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(bolt.x, bolt.y + 18);
      ctx.lineTo(bolt.x, bolt.y - 18);
      ctx.stroke();
    }

    for (const bolt of state.enemyBolts) {
      ctx.strokeStyle = "#ff4a4a";
      ctx.lineWidth = 5;
      ctx.shadowColor = "#ff4a4a";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(bolt.x - bolt.vx * 0.045, bolt.y - bolt.vy * 0.045);
      ctx.lineTo(bolt.x, bolt.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const particle of state.particles) {
      const alpha = clamp(particle.life / particle.ttl, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMessages() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 34px Inter, system-ui, sans-serif";
    for (const message of state.messages) {
      const alpha = clamp(message.life / message.ttl, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#f6c667";
      ctx.shadowColor = "#f6c667";
      ctx.shadowBlur = 16;
      ctx.fillText(message.text, state.width * 0.5, state.height * 0.28 + (1 - alpha) * -30);
    }
    ctx.restore();
  }

  function render() {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate(random(-state.shake, state.shake), random(-state.shake, state.shake));
    }
    drawBackground();
    drawTrench();
    drawBolts();
    for (const enemy of state.enemies) {
      drawEnemy(enemy);
    }
    drawPlayer();
    drawParticles();
    ctx.restore();
    drawMessages();
  }

  function frame(time) {
    const dt = clamp((time - state.lastTime) / 1000 || 0, 0, 0.033);
    state.lastTime = time;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function startGame() {
    ensureAudio();
    resetGame();
    state.started = true;
    state.running = true;
    startOverlay.hidden = true;
    startOverlay.classList.remove("active");
    hideMessage();
    addMessage("LOCKED IN", 1.2);
  }

  function showMessage(title, body, buttonText = "RESUME") {
    messageTitle.textContent = title;
    messageBody.textContent = body;
    resumeButton.textContent = buttonText;
    messageOverlay.hidden = false;
    messageOverlay.classList.add("active");
  }

  function hideMessage() {
    messageOverlay.hidden = true;
    messageOverlay.classList.remove("active");
  }

  function togglePause() {
    if (!state.started || state.gameOver) {
      return;
    }
    state.paused = !state.paused;
    state.running = !state.paused;
    pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
    if (state.paused) {
      showMessage("PAUSED", `SCORE ${String(state.score).padStart(6, "0")}`);
    } else {
      hideMessage();
    }
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  startButton.addEventListener("click", startGame);
  resumeButton.addEventListener("click", () => {
    if (state.gameOver) {
      startGame();
      return;
    }
    state.paused = false;
    state.running = true;
    pauseButton.textContent = "Ⅱ";
    hideMessage();
  });
  pauseButton.addEventListener("click", togglePause);
  soundButton.addEventListener("click", () => {
    state.muted = !state.muted;
    soundButton.textContent = state.muted ? "×" : "♪";
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
    }
    if (key === "p") {
      togglePause();
      return;
    }
    if (key === "r" && (state.gameOver || !state.started)) {
      startGame();
      return;
    }
    state.keys.add(key);
  });

  window.addEventListener("keyup", (event) => {
    state.keys.delete(event.key.toLowerCase());
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.started) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    state.pointerActive = true;
    state.fireHeld = true;
    state.pointerX = point.x;
    state.pointerY = point.y;
    shoot();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.pointerActive) {
      return;
    }
    const point = pointerPosition(event);
    state.pointerX = point.x;
    state.pointerY = point.y;
  });

  canvas.addEventListener("pointerup", () => {
    state.pointerActive = false;
    state.fireHeld = false;
  });

  canvas.addEventListener("pointercancel", () => {
    state.pointerActive = false;
    state.fireHeld = false;
  });

  window.addEventListener("blur", () => {
    state.keys.clear();
    state.fireHeld = false;
  });
  window.addEventListener("resize", resize);

  resize();
  updateHud();
  requestAnimationFrame(frame);
})();
