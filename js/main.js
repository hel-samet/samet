(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Theme toggle ---------- */
  const themeBtn = document.querySelector(".theme-toggle");
  themeBtn?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
  });

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector(".menu-toggle");
  const siteNav = document.querySelector(".site-nav");
  const headerEl = document.querySelector(".site-header");
  const setMenu = (open, moveFocus = false) => {
    document.body.classList.toggle("nav-open", open);
    menuBtn?.setAttribute("aria-expanded", String(open));
    menuBtn?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open && moveFocus) setTimeout(() => siteNav?.querySelector("a")?.focus({ preventScroll: true }), 350);
  };
  const isOpen = () => document.body.classList.contains("nav-open");
  // e.detail is 0 for keyboard-triggered clicks: only then move focus into the drawer
  menuBtn?.addEventListener("click", (e) => setMenu(!isOpen(), e.detail === 0));
  // Tapping the dimmed backdrop (the header's ::before) closes the drawer
  headerEl?.addEventListener("click", (e) => { if (e.target === headerEl && isOpen()) setMenu(false); });
  siteNav?.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) { setMenu(false); menuBtn?.focus(); }
  });
  window.matchMedia("(min-width: 761px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  /* ---------- Header state, scroll progress, back-to-top ---------- */
  const header = document.querySelector(".site-header");
  const progress = document.querySelector(".scroll-progress");
  const toTop = document.querySelector(".to-top");
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header?.classList.toggle("scrolled", y > 10);
    toTop?.classList.toggle("show", y > 600);
    if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();
  toTop?.addEventListener("click", () => window.scrollTo({ top: 0 }));

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Count-up stats ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const runCount = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    if (reduceMotion) { el.textContent = target + suffix; return; }
    const start = performance.now();
    const dur = 1600;
    const step = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { runCount(entry.target); co.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  } else {
    counters.forEach(runCount);
  }

  /* ---------- Typing effect ---------- */
  const typed = document.querySelector(".typed");
  if (typed) {
    const words = JSON.parse(typed.dataset.words || "[]");
    if (reduceMotion || words.length < 2) {
      typed.textContent = words[0] || typed.textContent;
    } else {
      let w = 0, i = words[0].length, deleting = true;
      const tick = () => {
        if (deleting) {
          i--;
          if (i === 0) { deleting = false; w = (w + 1) % words.length; }
        } else {
          i++;
        }
        typed.textContent = words[w].slice(0, i);
        let delay = deleting ? 45 : 90;
        if (!deleting && i === words[w].length) { deleting = true; delay = 2200; }
        setTimeout(tick, delay);
      };
      setTimeout(tick, 2400);
    }
  }

  /* ---------- Card spotlight + tilt ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll(".card, [data-tilt]").forEach((card) => {
      const tilt = card.hasAttribute("data-tilt");
      const strength = Number(card.dataset.tilt) || 8;
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        card.style.setProperty("--mx", `${x}px`);
        card.style.setProperty("--my", `${y}px`);
        if (tilt) {
          const rx = ((y / r.height) - 0.5) * -strength;
          const ry = ((x / r.width) - 0.5) * strength;
          card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
        }
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }

  /* ---------- 3D flip card (tap / Enter to flip; hover handles mouse) ---------- */
  document.querySelectorAll(".flip").forEach((flip) => {
    const toggle = () => flip.classList.toggle("flipped");
    if (!finePointer) flip.addEventListener("click", toggle);
    flip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.25;
        const y = (e.clientY - r.top - r.height / 2) * 0.35;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- Cursor glow ---------- */
  const glow = document.querySelector(".cursor-glow");
  if (glow && finePointer && !reduceMotion) {
    let gx = 0, gy = 0, tx = 0, ty = 0, raf = null;
    const follow = () => {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = `translate(${gx}px, ${gy}px)`;
      raf = Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5 ? requestAnimationFrame(follow) : null;
    };
    window.addEventListener("pointermove", (e) => {
      tx = e.clientX; ty = e.clientY;
      glow.classList.add("on");
      if (!raf) raf = requestAnimationFrame(follow);
    }, { passive: true });
    document.addEventListener("pointerleave", () => glow.classList.remove("on"));
  }

  /* ---------- Contact form (demo until a form service is connected) ---------- */
  const form = document.querySelector(".contact-form");
  form?.addEventListener("submit", (e) => {
    if (form.getAttribute("action") !== "#") return;
    e.preventDefault();
    const status = form.querySelector(".form-status");
    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.firstChild.textContent = "Sending… ";
    setTimeout(() => {
      status.textContent = "Thanks! Your message has been sent. (Demo: connect a form service to receive it.)";
      form.reset();
      btn.disabled = false;
      btn.firstChild.textContent = "Send message ";
    }, 900);
  });

  /* ---------- Soft page transitions ---------- */
  if (!reduceMotion) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.hash || !/\.html?$|\/$/.test(url.pathname)) return;
      e.preventDefault();
      document.body.classList.add("leaving");
      setTimeout(() => { location.href = a.href; }, 220);
    });
    // Restore when coming back via the back/forward cache
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) document.body.classList.remove("leaving");
    });
  }

  /* ---------- Footer year ---------- */
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
