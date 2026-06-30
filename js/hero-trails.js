/* =========================================================
   hero-trails.js — campo de TRAÇOS em gravidade zero (Antigravity).
   - Sem mouse: coreografia que alterna entre ONDA e FORMAR TEXTO
     (nome → onda → profissão → onda…), via amostragem dos pixels do
     texto como alvos; a física de mola faz o morph suave.
   - Com mouse: os traços seguem o cursor (mola + damping) e aplicam a
     regra de tamanho: perto = menor, distância média = maior,
     fora do raio = menor.
   - Cores ciclando por todo o espectro (HSL no tempo).
   Canvas isolado (pointer-events:none); não altera o layout.
   ========================================================= */
(() => {
  "use strict";

  const canvas = document.getElementById("heroTrails");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, dpr = 1;
  const mouse = { x: 0, y: 0, active: false, lastMove: -9999 };

  // ---- parâmetros ----
  const STIFFNESS = 0.085;  // rigidez da mola
  const DAMPING = 0.8;      // amortecimento (inércia/atraso)
  const FOLLOW_RADIUS = 260;// raio de influência do mouse (px)
  const FOLLOW_K = 0.5;     // o quanto seguem o cursor
  const HUE_SPEED = 26;     // velocidade do ciclo de cor (graus/seg)
  // onda coletiva (campo de fluxo): vizinhos se movem juntos → onda visível
  const WAVE_SCALE = 0.006; // "comprimento" da onda no espaço
  const WAVE_SPEED = 0.6;   // velocidade com que a onda viaja no tempo

  const NAME = canvas.dataset.name || "Olá";
  const ROLE = canvas.dataset.role || "Designer";
  const SCENES = [
    { type: "wave", dur: 5000 },
    { type: "text", text: NAME, dur: 5000 },
    { type: "wave", dur: 3500 },
    { type: "text", text: ROLE, dur: 5000 },
  ];

  let dashes = [];
  let raf = null;
  let sceneIdx = 0;
  let sceneClock = 0;
  let lastNow = 0;

  const rand = (a, b) => Math.random() * (b - a) + a;

  function count() {
    const base = (W * H) / 5200;                  // mais recheado
    return Math.min(Math.round(base), window.innerWidth < 720 ? 200 : 660);
  }

  function build() {
    const n = count();
    const cols = Math.max(1, Math.round(Math.sqrt(n * (W / H))));
    const rows = Math.max(1, Math.ceil(n / cols));
    const cw = W / cols, ch = H / rows;
    dashes = [];
    for (let r = 0; r < rows && dashes.length < n; r++) {
      for (let c = 0; c < cols && dashes.length < n; c++) {
        const bx = (c + 0.5 + rand(-0.45, 0.45)) * cw;
        const by = (r + 0.5 + rand(-0.45, 0.45)) * ch;
        dashes.push({
          bx, by, x: bx, y: by, vx: 0, vy: 0,
          tix: bx, tiy: by, inText: false,
          len: rand(7, 13),
          width: rand(1.3, 2.3),
          baseAngle: rand(0, Math.PI),
          amp: rand(13, 24),
          phase: rand(0, Math.PI * 2),
          hueOffset: (bx + by) * 0.25,
          baseAlpha: rand(0.55, 0.95),
          alpha: 0.7,
          size: 1,
        });
      }
    }
  }

  // amostra os pixels de um texto → pontos-alvo (px CSS, centralizados)
  function sampleText(str) {
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d");
    o.fillStyle = "#000";
    o.textAlign = "center";
    o.textBaseline = "middle";
    // posiciona no espaço VAZIO: quadrante inferior-direito no desktop
    // (abaixo do título e à direita do parágrafo/botões); centro-baixo em telas estreitas
    const wide = W > 900;
    const cx = wide ? W * 0.70 : W * 0.5;
    const cy = wide ? H * 0.74 : H * 0.78;
    const maxW = (wide ? 0.54 : 0.88) * W;
    let fs = Math.min(H * 0.22, W * 0.15);
    o.font = `800 ${fs}px "Sora", system-ui, sans-serif`;
    const w = o.measureText(str).width;
    if (w > maxW) { fs *= maxW / w; o.font = `800 ${fs}px "Sora", system-ui, sans-serif`; }
    o.fillText(str, cx, cy);
    const data = o.getImageData(0, 0, W, H).data;
    const step = Math.max(4, Math.round(fs / 30));
    const pts = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) pts.push({ x, y });
      }
    }
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  }

  function enterScene() {
    const sc = SCENES[sceneIdx];
    if (sc.type === "text") {
      const pts = sampleText(sc.text);
      const n = Math.min(pts.length, dashes.length);
      for (let i = 0; i < dashes.length; i++) {
        if (i < n) { dashes[i].tix = pts[i].x; dashes[i].tiy = pts[i].y; dashes[i].inText = true; }
        else dashes[i].inText = false;
      }
    } else {
      for (const p of dashes) p.inText = false;
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    enterScene();
    if (prefersReduced) drawStatic();
  }

  function onMove(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    mouse.x = x; mouse.y = y; mouse.lastMove = performance.now();
    mouse.active = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  }
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  }, { passive: true });

  function drawDash(p, hue) {
    const half = p.len * 0.5 * p.size;
    const dx = Math.cos(p.angle) * half;
    const dy = Math.sin(p.angle) * half;
    ctx.globalAlpha = p.alpha;
    ctx.strokeStyle = `hsl(${hue}, 85%, 58%)`;
    ctx.lineWidth = Math.max(0.6, p.width * (0.55 + p.size * 0.5));
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - dx, p.y - dy);
    ctx.lineTo(p.x + dx, p.y + dy);
    ctx.stroke();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    for (const p of dashes) { p.x = p.bx; p.y = p.by; p.angle = p.baseAngle; p.alpha = p.baseAlpha; p.size = 1; drawDash(p, p.hueOffset % 360); }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = lastNow ? now - lastNow : 16;
    lastNow = now;
    ctx.clearRect(0, 0, W, H);
    const t = now * 0.001;
    const hueBase = (t * HUE_SPEED) % 360;
    const scene = SCENES[sceneIdx];

    // avança a coreografia apenas quando o mouse não está presente
    if (!mouse.active) {
      sceneClock += dt;
      if (sceneClock > scene.dur) {
        sceneClock = 0;
        sceneIdx = (sceneIdx + 1) % SCENES.length;
        enterScene();
      }
    }
    const textMode = !mouse.active && scene.type === "text";

    for (const p of dashes) {
      // ONDA coletiva: direção vinda de um campo de fluxo que viaja no tempo.
      // Depende de (bx,by), então traços vizinhos apontam juntos → onda coerente.
      const flow = Math.sin(p.bx * WAVE_SCALE + t * WAVE_SPEED) +
                   Math.cos(p.by * WAVE_SCALE + t * WAVE_SPEED * 0.85);
      const waveAng = flow * 1.7;
      let tx = p.bx + Math.cos(waveAng) * p.amp;
      let ty = p.by + Math.sin(waveAng) * p.amp;
      let targetAlpha = p.baseAlpha;
      let sizeTarget = 1;

      if (mouse.active) {
        // seguir o cursor + regra de tamanho por distância
        const mdx = mouse.x - p.bx;
        const mdy = mouse.y - p.by;
        const d = Math.hypot(mdx, mdy);
        if (d < FOLLOW_RADIUS) {
          const u = d / FOLLOW_RADIUS;
          tx += mdx * (1 - u) * FOLLOW_K;
          ty += mdy * (1 - u) * FOLLOW_K;
          // perto = menor, meio = maior, borda = menor (sino com seno)
          sizeTarget = 0.45 + 1.0 * Math.sin(u * Math.PI);
        } else {
          sizeTarget = 0.45; // fora do raio = minimizado
        }
      } else if (textMode) {
        if (p.inText) {
          // forma o texto (com leve respiração); marquinhas curtas = legível
          tx = p.tix + Math.sin(t * 0.8 + p.phase) * 1.2;
          ty = p.tiy + Math.cos(t * 0.8 + p.phase) * 1.2;
          sizeTarget = 0.6;
        } else {
          targetAlpha = p.baseAlpha * 0.12; // os demais ficam discretos
          sizeTarget = 0.7;
        }
      }

      // física: mola + amortecimento
      p.vx = (p.vx + (tx - p.x) * STIFFNESS) * DAMPING;
      p.vy = (p.vy + (ty - p.y) * STIFFNESS) * DAMPING;
      p.x += p.vx;
      p.y += p.vy;

      // suaviza alpha e tamanho
      p.alpha += (targetAlpha - p.alpha) * 0.08;
      p.size += (sizeTarget - p.size) * 0.1;

      // orientação: movendo → na direção da velocidade; no texto → horizontal;
      // senão → alinhado ao fluxo da onda (faz a onda ficar visível em faixas)
      const spd = p.vx * p.vx + p.vy * p.vy;
      if (spd > 0.6) p.angle = Math.atan2(p.vy, p.vx);
      else if (textMode && p.inText) p.angle = 0;
      else p.angle = waveAng;

      drawDash(p, (hueBase + p.hueOffset) % 360);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && !prefersReduced) { lastNow = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else start(); });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });

  resize();
  if (prefersReduced) drawStatic(); else start();
})();
