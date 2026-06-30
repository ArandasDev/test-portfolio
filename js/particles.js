/* =========================================================
   particles.js — campo de "traços" coloridos em <canvas>.
   Inspirado no Google Antigravity: os traços são repelidos
   pelo cursor (mouse/toque) e voltam à base com mola.
   Mobile-first: menos partículas em telas menores; estático
   em prefers-reduced-motion.
   ========================================================= */
(() => {
  "use strict";

  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Paleta de "confetes" (Google) + neutros — a maioria é neutra.
  const NEUTRAL = "rgba(20,20,20,0.55)";
  const COLORS = ["#4285f4", "#ea4335", "#fbbc05", "#34a853", "#8b5cff"];

  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let raf = null;

  const mouse = { x: -9999, y: -9999, active: false };

  // Densidade: 1 partícula a cada ~9000px² (mais raro em telas pequenas)
  function targetCount() {
    const base = (W * H) / 9000;
    const cap = window.innerWidth < 720 ? 90 : 260;
    return Math.min(Math.round(base), cap);
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function makeParticle() {
    const colored = Math.random() < 0.32;
    const x = Math.random() * W;
    const y = Math.random() * H;
    return {
      bx: x, by: y,          // posição-base (âncora)
      x, y,                  // posição atual
      vx: 0, vy: 0,          // velocidade
      len: rand(6, 14) * dpr,        // comprimento do traço
      angle: rand(0, Math.PI),       // rotação
      spin: rand(-0.02, 0.02),       // giro sutil quando em movimento
      color: colored ? COLORS[(Math.random() * COLORS.length) | 0] : NEUTRAL,
      width: (colored ? rand(1.6, 2.6) : rand(1, 1.6)) * dpr,
      alpha: colored ? rand(0.7, 1) : rand(0.25, 0.5),
    };
  }

  function build() {
    particles = Array.from({ length: targetCount() }, makeParticle);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth * dpr;
    H = canvas.clientHeight * dpr;
    canvas.width = W;
    canvas.height = H;
    build();
    if (prefersReduced) drawStatic();
  }

  function drawDash(p) {
    const dx = Math.cos(p.angle) * p.len * 0.5;
    const dy = Math.sin(p.angle) * p.len * 0.5;
    ctx.globalAlpha = p.alpha;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - dx, p.y - dy);
    ctx.lineTo(p.x + dx, p.y + dy);
    ctx.stroke();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(drawDash);
    ctx.globalAlpha = 1;
  }

  // Física: repulsão dentro do raio + mola de volta à base
  const RADIUS = 130;          // raio de influência do cursor (em px CSS)
  const FORCE = 5.0;           // intensidade da repulsão
  const SPRING = 0.045;        // força da mola de retorno
  const FRICTION = 0.86;       // amortecimento

  function tick() {
    ctx.clearRect(0, 0, W, H);
    const r = RADIUS * dpr;
    const r2 = r * r;
    const mx = mouse.x * dpr;
    const my = mouse.y * dpr;

    for (const p of particles) {
      if (mouse.active) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (1 - d / r) * FORCE;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
          p.angle += p.spin * 4;   // gira mais ao ser empurrado
        }
      }
      // mola de volta à âncora
      p.vx += (p.bx - p.x) * SPRING;
      p.vy += (p.by - p.y) * SPRING;
      p.vx *= FRICTION;
      p.vy *= FRICTION;
      p.x += p.vx;
      p.y += p.vy;

      drawDash(p);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }

  /* ---------- Eventos de ponteiro ---------- */
  function onMove(x, y) { mouse.x = x; mouse.y = y; mouse.active = true; }
  function onLeave() { mouse.active = false; mouse.x = -9999; mouse.y = -9999; }

  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener("mouseout", onLeave);
  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener("touchend", onLeave);

  /* ---------- Pausa quando a aba/elemento não está visível ---------- */
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
