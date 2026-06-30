/* =========================================================
   hero-trails.js — campo de TRAÇOS em gravidade zero (estilo
   Google Antigravity). Riscos curtos espalhados que:
   - flutuam suavemente com Math.sin() quando o mouse está parado;
   - seguem o movimento do mouse com física de mola (spring) +
     amortecimento (damping), com retorno suave à âncora;
   - trocam de cor passando por todo o espectro (HSL no tempo).
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
  const STIFFNESS = 0.08;   // rigidez da mola (retorno à âncora / alvo)
  const DAMPING = 0.8;      // amortecimento (inércia/atraso)
  const FOLLOW_RADIUS = 260;// raio em que os traços seguem o mouse (px)
  const FOLLOW_K = 0.55;    // o quanto são puxados em direção ao cursor
  const HUE_SPEED = 26;     // velocidade do ciclo de cor (graus/seg)

  let dashes = [];
  let raf = null;

  const rand = (a, b) => Math.random() * (b - a) + a;

  function count() {
    const base = (W * H) / 9000;
    return Math.min(Math.round(base), window.innerWidth < 720 ? 90 : 320);
  }

  function build() {
    const n = count();
    // distribuição uniforme (grade com jitter)
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
          len: rand(6, 13),
          width: rand(1.3, 2.3),
          baseAngle: rand(0, Math.PI),
          amp: rand(5, 13),           // amplitude do flutuar
          freqX: rand(0.3, 0.8),
          freqY: rand(0.3, 0.8),
          phase: rand(0, Math.PI * 2),
          hueOffset: (bx + by) * 0.25, // matiz varia pelo espaço
          alpha: rand(0.55, 0.95),
        });
      }
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // desenha em px CSS
    build();
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
    const half = p.len * 0.5;
    const dx = Math.cos(p.angle) * half;
    const dy = Math.sin(p.angle) * half;
    ctx.globalAlpha = p.alpha;
    ctx.strokeStyle = `hsl(${hue}, 85%, 58%)`;
    ctx.lineWidth = p.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - dx, p.y - dy);
    ctx.lineTo(p.x + dx, p.y + dy);
    ctx.stroke();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    for (const p of dashes) {
      p.x = p.bx; p.y = p.by; p.angle = p.baseAngle;
      drawDash(p, (p.hueOffset) % 360);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    const t = now * 0.001;
    const hueBase = (t * HUE_SPEED) % 360;
    const followActive = mouse.active && now - mouse.lastMove < 600;

    for (const p of dashes) {
      // alvo: âncora + flutuar suave (gravidade zero)
      let tx = p.bx + Math.sin(t * p.freqX + p.phase) * p.amp;
      let ty = p.by + Math.cos(t * p.freqY + p.phase * 1.3) * p.amp;

      // seguir o mouse (mola): alvo desloca em direção ao cursor por proximidade
      if (followActive) {
        const mdx = mouse.x - p.bx;
        const mdy = mouse.y - p.by;
        const d = Math.hypot(mdx, mdy);
        if (d < FOLLOW_RADIUS) {
          const k = (1 - d / FOLLOW_RADIUS) * FOLLOW_K;
          tx += mdx * k;
          ty += mdy * k;
        }
      }

      // física de mola + amortecimento
      p.vx = (p.vx + (tx - p.x) * STIFFNESS) * DAMPING;
      p.vy = (p.vy + (ty - p.y) * STIFFNESS) * DAMPING;
      p.x += p.vx;
      p.y += p.vy;

      // orientação: aponta na direção do movimento quando se move;
      // senão mantém o ângulo próprio (com leve deriva)
      const sp = p.vx * p.vx + p.vy * p.vy;
      p.angle = sp > 0.6 ? Math.atan2(p.vy, p.vx) : p.baseAngle + Math.sin(t * 0.3 + p.phase) * 0.25;

      drawDash(p, (hueBase + p.hueOffset) % 360);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && !prefersReduced) raf = requestAnimationFrame(frame); }
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
