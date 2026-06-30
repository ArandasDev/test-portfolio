/* =========================================================
   particles.js — campo de "traços" coloridos em <canvas>.
   Inspirado no Google Antigravity:
   - parte das partículas forma uma SILHUETA (amostrada de um glifo);
   - todas têm vida própria (wobble contínuo) mesmo com o mouse parado;
   - são repelidas pelo cursor (mouse/toque) e voltam à base com mola.
   Mobile-first: menos partículas em telas pequenas; consciente do tema;
   render estático em prefers-reduced-motion.
   ========================================================= */
(() => {
  "use strict";

  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // data-shape vazio = distribuição uniforme; com glifo = forma silhueta.
  const SHAPE = (canvas.dataset.shape || "").trim();

  // Paleta de "confetes" (Google) + neutros (a maioria é neutra).
  const COLORS = ["#4285f4", "#ea4335", "#fbbc05", "#34a853", "#8b5cff"];
  function neutralColor() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "rgba(232,232,238,0.5)"
      : "rgba(20,20,20,0.55)";
  }
  let NEUTRAL = neutralColor();

  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let raf = null;

  const mouse = { x: -9999, y: -9999, active: false };

  function rand(min, max) { return Math.random() * (max - min) + min; }

  // Quantidade: ~1 traço a cada 7000px² (mais denso que antes), com teto.
  function targetCount() {
    const base = (W * H) / (7000 * dpr * dpr);
    const cap = window.innerWidth < 720 ? 150 : 420;
    return Math.min(Math.round(base), cap);
  }

  /* ---------- Amostra os pontos de uma silhueta a partir de um glifo ---------- */
  function sampleShape() {
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const o = off.getContext("2d");
    const size = Math.min(W, H) * (W > 760 * dpr ? 0.62 : 0.5);
    // Desktop: silhueta à direita (texto fica à esquerda). Mobile: centralizada.
    const cx = W * (W > 760 * dpr ? 0.72 : 0.5);
    const cy = H * 0.5;
    o.fillStyle = "#000";
    o.textAlign = "center";
    o.textBaseline = "middle";
    o.font = `${size}px "Sora", system-ui, sans-serif`;
    o.fillText(SHAPE, cx, cy);

    const data = o.getImageData(0, 0, W, H).data;
    const step = Math.max(4, Math.round(size / 42)); // densidade da amostragem
    const pts = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 130) pts.push({ x, y });
      }
    }
    // embaralha para distribuir bem
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  }

  function makeParticle(bx, by, inShape) {
    const colored = Math.random() < (inShape ? 0.5 : 0.42);
    return {
      bx, by,                        // âncora (na silhueta ou aleatória)
      x: bx + rand(-40, 40), y: by + rand(-40, 40),
      vx: 0, vy: 0,
      vis: 0,                        // visibilidade (0..1): revelada perto do cursor
      len: rand(inShape ? 5 : 6, inShape ? 11 : 15) * dpr,
      angle: rand(0, Math.PI),
      amp: rand(inShape ? 1.2 : 3, inShape ? 3.5 : 8) * dpr, // wobble
      phase: rand(0, Math.PI * 2),
      neutral: !colored,
      // deslocamento de matiz por posição: faz a cor "varrer" o espaço como
      // a borda em gradiente girante dos cards
      hueOffset: (bx + by) * 0.18,
      width: (colored ? rand(1.6, 2.6) : rand(1, 1.7)) * dpr,
      alpha: colored ? rand(0.75, 1) : rand(0.28, 0.55),
    };
  }

  // Distribuição UNIFORME: grade com "jitter" cobre toda a view por igual
  // (evita os aglomerados aleatórios de Math.random puro).
  function evenPositions(n) {
    const cols = Math.max(1, Math.round(Math.sqrt(n * (W / H))));
    const rows = Math.max(1, Math.ceil(n / cols));
    const cw = W / cols, ch = H / rows;
    const pts = [];
    for (let r = 0; r < rows && pts.length < n; r++) {
      for (let c = 0; c < cols && pts.length < n; c++) {
        pts.push({
          x: (c + 0.5 + rand(-0.45, 0.45)) * cw,
          y: (r + 0.5 + rand(-0.45, 0.45)) * ch,
        });
      }
    }
    return pts;
  }

  function build() {
    const total = targetCount();
    particles = [];
    if (SHAPE) {
      // (opcional) silhueta + ambiente uniforme ao redor
      const shapePts = sampleShape();
      const shapeCount = Math.min(shapePts.length, Math.floor(total * 0.55));
      for (let i = 0; i < shapeCount; i++) {
        particles.push(makeParticle(shapePts[i].x, shapePts[i].y, true));
      }
      const rest = evenPositions(total - shapeCount);
      for (const p of rest) particles.push(makeParticle(p.x, p.y, false));
    } else {
      // padrão: tudo distribuído por igual em toda a view
      const pts = evenPositions(total);
      for (const p of pts) particles.push(makeParticle(p.x, p.y, false));
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(canvas.clientWidth * dpr));
    H = Math.max(1, Math.round(canvas.clientHeight * dpr));
    canvas.width = W;
    canvas.height = H;
    build();
    if (prefersReduced) drawStatic();
  }

  // velocidade do ciclo de cor (graus/seg) — igual em espírito à borda girante
  const HUE_SPEED = 45;
  let clock = 0; // tempo atual (s), atualizado no tick

  function drawDash(p) {
    const dx = Math.cos(p.angle) * p.len * 0.5;
    const dy = Math.sin(p.angle) * p.len * 0.5;
    ctx.globalAlpha = p.alpha * p.vis;
    // traços coloridos trocam de cor continuamente (matiz girando no tempo +
    // offset por posição = a cor "varre" a tela, como o gradiente do card)
    ctx.strokeStyle = p.neutral
      ? NEUTRAL
      : `hsl(${(clock * HUE_SPEED + p.hueOffset) % 360}, 85%, 60%)`;
    ctx.lineWidth = p.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - dx, p.y - dy);
    ctx.lineTo(p.x + dx, p.y + dy);
    ctx.stroke();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) { p.x = p.bx; p.y = p.by; p.vis = 1; drawDash(p); }
    ctx.globalAlpha = 1;
  }

  /* ---------- Física: onda coletiva + ondulação de "gota" + mola ---------- */
  const SPRING = 0.07;    // força da mola de retorno
  const FRICTION = 0.84;  // amortecimento (mantém o movimento suave)
  // campo de fluxo: a direção depende da posição (vizinhos se movem juntos)
  const WAVE_SCALE = 0.005;  // "comprimento" da onda no espaço
  const WAVE_SPEED = 0.5;    // velocidade com que a onda viaja no tempo
  // os traços só existem EM VOLTA do cursor; revelam ao aproximar e somem
  // (com rastro) ao afastar — imitando o Antigravity.
  const REVEAL_RADIUS = 320; // raio em que os traços aparecem (px CSS)
  const PULL = 0.35;         // atração suave em direção ao cursor (0..1)
  const WAVE_LEN = 65;       // distância entre cristas da onda radial (px CSS)
  const WAVE_AMP = 16;       // deslocamento da onda (px CSS)
  const FOLLOW_WAVE_SPEED = 5;

  function tick(now) {
    ctx.clearRect(0, 0, W, H);
    const t = now * 0.001;
    clock = t;
    const mx = mouse.x * dpr;
    const my = mouse.y * dpr;
    const rr = REVEAL_RADIUS * dpr;
    const wk = (Math.PI * 2) / (WAVE_LEN * dpr);
    const wamp = WAVE_AMP * dpr;

    for (const p of particles) {
      // movimento de base "vivo" (onda de fluxo suave)
      const flow = Math.sin(p.bx * WAVE_SCALE + t * WAVE_SPEED) +
                   Math.cos(p.by * WAVE_SCALE + t * WAVE_SPEED * 0.9);
      let ang = flow * 1.6 + p.phase * 0.2;
      let tx = p.bx + Math.cos(ang) * p.amp;
      let ty = p.by + Math.sin(ang) * p.amp;

      // REVELAÇÃO + ONDA ao redor do cursor
      let targetVis = 0;
      if (mouse.active) {
        const dx = mx - p.bx;
        const dy = my - p.by;
        const d = Math.hypot(dx, dy);
        if (d < rr && d > 0.01) {
          const u = 1 - d / rr;
          targetVis = u * u * (3 - 2 * u); // smoothstep: borda macia
          // onda radial viajante sobre o cluster (o "efeito de onda neles")
          const phase = d * wk - t * FOLLOW_WAVE_SPEED;
          const wave = Math.sin(phase);
          // atração suave para o cursor + deslocamento da onda
          const pull = u * u * PULL;
          tx += dx * pull + (dx / d) * wave * wamp * u;
          ty += dy * pull + (dy / d) * wave * wamp * u;
          // traço alinhado à direção do cursor, ondulando
          ang = Math.atan2(dy, dx) + wave * 0.6;
        }
      }
      p.angle = ang;

      // visibilidade: aparece rápido, some devagar (rastro)
      const ease = targetVis > p.vis ? 0.2 : 0.045;
      p.vis += (targetVis - p.vis) * ease;

      p.vx += (tx - p.x) * SPRING;
      p.vy += (ty - p.y) * SPRING;
      p.vx *= FRICTION;
      p.vy *= FRICTION;
      p.x += p.vx;
      p.y += p.vy;

      if (p.vis > 0.02) drawDash(p);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }

  /* ---------- Ponteiro (coords relativas ao canvas) ---------- */
  function onMove(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      mouse.x = x; mouse.y = y; mouse.active = true;
    } else {
      mouse.active = false;
    }
  }
  function onLeave() { mouse.active = false; }

  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener("mouseout", onLeave);
  window.addEventListener("touchmove", (e) => {
    const tt = e.touches[0];
    if (tt) onMove(tt.clientX, tt.clientY);
  }, { passive: true });
  window.addEventListener("touchend", onLeave);

  /* ---------- Tema: atualiza cor dos traços neutros ---------- */
  window.addEventListener("themechange", () => { NEUTRAL = neutralColor(); });

  /* ---------- Pausa quando a aba não está visível ---------- */
  function start() { if (!raf && !prefersReduced) raf = requestAnimationFrame(tick); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else start();
  });

  /* ---------- Boot ---------- */
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });

  resize();
  if (prefersReduced) drawStatic();
  else start();
})();
