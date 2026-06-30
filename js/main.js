/* =========================================================
   main.js — orquestra preloader, reveals, cursor, nav e
   microinterações. Vanilla, sem dependências.
   ========================================================= */
(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ---------- 1. Preloader ---------- */
  const preloader = $("#preloader");
  const counter = $("#preloaderCount");

  function runPreloader() {
    if (prefersReduced) { finishPreload(); return; }
    let n = 0;
    const tick = () => {
      n += Math.floor(Math.random() * 12) + 4;
      if (n >= 100) { n = 100; counter.textContent = n; setTimeout(finishPreload, 350); return; }
      counter.textContent = n;
      setTimeout(tick, Math.random() * 140 + 60);
    };
    tick();
  }

  function finishPreload() {
    preloader.classList.add("is-done");
    document.body.classList.remove("is-locked");
    revealHero();
  }

  /* ---------- 2. Reveal do hero (split lines) ---------- */
  function revealHero() {
    const lines = $$(".hero [data-split]");
    lines.forEach((el, i) => {
      el.style.setProperty("--line-delay", `${i * 0.09}s`);
      requestAnimationFrame(() => el.classList.add("is-revealed"));
    });
    // reveals normais do hero
    $$(".hero [data-reveal]").forEach(applyRevealDelay);
    $$(".hero [data-reveal]").forEach((el) => el.classList.add("is-visible"));
  }

  function applyRevealDelay(el) {
    const d = el.dataset.delay;
    if (d) el.style.setProperty("--reveal-delay", `${d}s`);
  }

  /* ---------- 3. IntersectionObserver: reveals on scroll ---------- */
  const revealEls = $$("[data-reveal]").filter((el) => !el.closest(".hero"));
  revealEls.forEach(applyRevealDelay);

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));

    // Split lines fora do hero (ex.: contato)
    const splitIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const lines = $$("[data-split]", entry.target);
            lines.forEach((el, i) => {
              el.style.setProperty("--line-delay", `${i * 0.1}s`);
              el.classList.add("is-revealed");
            });
            splitIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    $$(".footer-cta__title").forEach((el) => splitIO.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
    $$("[data-split]").forEach((el) => el.classList.add("is-revealed"));
  }

  /* ---------- 4. Contadores animados (about) ---------- */
  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || "";
    if (prefersReduced) { el.textContent = target + suffix; return; }
    const dur = 1400;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    const countIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { animateCount(entry.target); countIO.unobserve(entry.target); }
        });
      },
      { threshold: 0.6 }
    );
    $$("[data-count]").forEach((el) => countIO.observe(el));
  }

  /* ---------- 5. Header: estado ao rolar ---------- */
  const header = $("#header");
  let lastScroll = 0;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 40);
    lastScroll = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 6. Menu mobile ---------- */
  const menuToggle = $("#menuToggle");
  const nav = $("#nav");
  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      menuToggle.classList.toggle("is-open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      document.body.classList.toggle("is-locked", open);
    });
    $$(".nav__link", nav).forEach((link) =>
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        menuToggle.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("is-locked");
      })
    );
  }

  /* ---------- 6b. Toggle de tema claro/escuro ---------- */
  const themeToggle = $("#themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* ---------- 7. Cursor customizado (apenas desktop) ---------- */
  if (isFinePointer && !prefersReduced) {
    const cursor = $("#cursor");
    const dot = $("#cursorDot");
    let mx = 0, my = 0, cx = 0, cy = 0;

    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    });

    const render = () => {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(render);
    };
    render();

    $$("[data-cursor]").forEach((el) => {
      const type = el.dataset.cursor;
      el.addEventListener("mouseenter", () => cursor.classList.add(type === "view" ? "is-view" : "is-hover"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-view", "is-hover"));
    });
  }

  /* ---------- 8. Botões magnéticos (desktop) ---------- */
  if (isFinePointer && !prefersReduced) {
    $$("[data-magnetic]").forEach((el) => {
      const strength = 0.35;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- 9. Smooth scroll para âncoras ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length <= 1) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    });
  });

  /* ---------- 9b. Copiar e-mail (rodapé) ---------- */
  const copyEmail = $("#copyEmail");
  if (copyEmail && navigator.clipboard) {
    const label = copyEmail.querySelector("span");
    const original = label.textContent;
    copyEmail.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(copyEmail.dataset.email);
        copyEmail.classList.add("is-copied");
        label.textContent = "Copiado!";
        setTimeout(() => {
          copyEmail.classList.remove("is-copied");
          label.textContent = original;
        }, 1800);
      } catch (e) {}
    });
  }

  /* ---------- 10. Ano no rodapé ---------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Boot ---------- */
  document.body.classList.add("is-locked");
  if (document.readyState === "complete") runPreloader();
  else window.addEventListener("load", runPreloader);
})();
