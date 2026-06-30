/* =========================================================
   hero-trails.js — "Rastro Interativo de Ondas em Gravidade Zero"
   Fitas fluidas que seguem o mouse com física de mola (spring) +
   amortecimento (damping), e flutuam com Math.sin() quando parado.
   - Curvas suaves via quadraticCurveTo (pontos médios).
   - Motion blur por frame (destination-out: apaga por opacidade,
     mantendo os dots de fundo visíveis através do canvas).
   - Cores ciclando por todo o espectro (HSL girando no tempo).
   Isolado: canvas com pointer-events:none; não altera o layout.
   ========================================================= */
(() => {
  "use strict";

  const canvas = document.getElementById("heroTrails");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, dpr = 1;
  const mouse = { x: 0, y: 0, active: false, lastMove: -9999 };

  // ---- parâmetros do efeito ----
  const RIBBONS = 5;      // nº de traços sobrepostos
  const POINTS = 26;      // pontos por traço (comprimento do rastro)
  const STIFFNESS = 0.12; // rigidez da mola na "cabeça"
  const DAMPING = 0.78;   // amortecimento (atraso/inércia)
  const FOLLOW = 0.34;    // suavização da corrente (corpo seguindo a cabeça)
  const HUE_SPEED = 0.7;  // velocidade do ciclo de cor (graus/frame)

  let ribbons = [];
  let raf = null;
  let hueBase = 0;

  function makeRibbons() {
    const cx = W / 2, cy = H / 2;
    ribbons = [];
    for (let r = 0; r < RIBBONS; r++) {
      const pts = [];
      for (let i = 0; i < POINTS; i++) pts.push({ x: cx, y: cy });
      ribbons.push({
        pts,
        vx: 0, vy: 0,
        phase: (Math.PI * 2 * r) / RIBBONS + Math.random(),
        hue: (360 / RIBBONS) * r,     // matiz inicial espaçado
        width: 2.4 - r * 0.28,        // larguras variadas
        alpha: 0.55 - r * 0.06,       // opacidades suaves
      });
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
    makeRibbons();
  }

  function onMove(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    mouse.x = x;
    mouse.y = y;
    mouse.lastMove = performance.now();
    mouse.active = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  }
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  }, { passive: true });

  function frame(now) {
    const t = now * 0.001;

    // motion blur: apaga o frame anterior por opacidade (mantém transparência)
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";

    const idle = !mouse.active || now - mouse.lastMove > 120;
    const cx = W / 2, cy = H / 2;
    hueBase = (hueBase + HUE_SPEED) % 360;

    for (const rb of ribbons) {
      const pts = rb.pts;

      // alvo da cabeça: segue o mouse; quando parado, flutua com sin/cos
      let tx, ty;
      if (idle) {
        tx = cx + Math.sin(t * 0.5 + rb.phase) * W * 0.24;
        ty = cy + Math.cos(t * 0.42 + rb.phase * 1.3) * H * 0.24;
      } else {
        tx = mouse.x;
        ty = mouse.y;
      }
      // leve oscilação própria (gravidade zero) mesmo seguindo o mouse
      tx += Math.sin(t * 1.4 + rb.phase * 2) * 38;
      ty += Math.cos(t * 1.1 + rb.phase * 2) * 38;

      // física de mola + damping na cabeça
      rb.vx = (rb.vx + (tx - pts[0].x) * STIFFNESS) * DAMPING;
      rb.vy = (rb.vy + (ty - pts[0].y) * STIFFNESS) * DAMPING;
      pts[0].x += rb.vx;
      pts[0].y += rb.vy;

      // corrente: cada ponto persegue suavemente o anterior (rastro)
      for (let i = 1; i < pts.length; i++) {
        pts[i].x += (pts[i - 1].x - pts[i].x) * FOLLOW;
        pts[i].y += (pts[i - 1].y - pts[i].y) * FOLLOW;
      }

      // curva suave por pontos médios (quadraticCurveTo)
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }

      const hue = (hueBase + rb.hue) % 360;
      ctx.strokeStyle = `hsla(${hue}, 90%, 60%, ${rb.alpha})`;
      ctx.lineWidth = rb.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && !prefersReduced) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else start();
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });

  resize();
  start();
})();
