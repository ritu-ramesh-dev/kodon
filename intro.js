// Pages: the site is split into Home, Analyzer, How it works and Model.
// Only one [data-view] is shown at a time; the address (#home, #analyzer, ...) picks it,
// so links, the Home button and the browser's back button all work.
(function () {
  const VIEWS = { home: "Kodon", analyzer: "Analyzer · Kodon", how: "How it works · Kodon", model: "Model · Kodon" };
  const parts = document.querySelectorAll("[data-view]");
  const navLinks = document.querySelectorAll("[data-nav]");

  function show(name) {
    if (!(name in VIEWS)) return false;
    parts.forEach(el => { el.hidden = el.dataset.view !== name; });
    document.body.dataset.view = name;
    navLinks.forEach(a => a.dataset.nav === name ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    document.title = VIEWS[name];
    const html = document.documentElement, prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto"; window.scrollTo(0, 0); html.style.scrollBehavior = prev;
    window.dispatchEvent(new Event("resize"));            // lets the opening re-measure itself
    const film = document.querySelector(".cine-video");
    if (film) { if (name === "home") film.play().catch(() => {}); else film.pause(); }
    setTimeout(() => window.kodonRevealCheck && window.kodonRevealCheck(), 30);
    return true;
  }
  window.kodonShow = show;

  window.addEventListener("hashchange", () => show(location.hash.slice(1)));
  if (!show(location.hash.slice(1))) show("home");
})();

// Opening: a cinematic fly-through of a misty pine forest.
//   - a real forest film plays full screen behind letterbox bars
//   - two layers of drifting mist (one behind the title, one in front), soft light rays, film grain
//   - scrolling pushes the camera forward: the title dissolves, three subtitle lines appear one by one,
//     the fog thickens and the scene fades into the site
(function () {
  const stage = document.getElementById("intro");
  const q = sel => stage.querySelector(sel);
  const video = q('[data-cine="video"]'), frame = q('[data-cine="frame"]'), title = q('[data-cine="title"]'),
        fade = q('[data-cine="fade"]'), cue = q('[data-cine="cue"]'), bars = stage.querySelectorAll('[data-cine="bar"]'),
        lines = stage.querySelectorAll("[data-line]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ----- film: pick a size that suits the screen -----
  video.src = window.innerWidth > 1100 ? video.dataset.srcHd : video.dataset.srcSd;
  if (reduce) video.removeAttribute("autoplay");
  else if (document.body.dataset.view === "home") video.play().catch(() => {});
  else video.pause();

  // ----- scroll timeline -----
  const clamp = x => Math.min(1, Math.max(0, x));
  const smooth = t => t * t * (3 - 2 * t);
  const seg = (p, a, b) => smooth(clamp((p - a) / (b - a)));
  // a subtitle line: in over [a, a+.05], holds, out over [b-.05, b]
  const window_ = (p, a, b) => Math.min(seg(p, a, a + .05), 1 - seg(p, b - .05, b));
  let mistBoost = 0, ticking = false;

  function update() {
    ticking = false;
    const H = window.innerHeight;
    const range = stage.offsetHeight - H;
    const p = range > 0 ? clamp(window.scrollY / range) : 1;

    frame.style.transform = `scale(${1.08 + .34 * smooth(p)}) translateY(${-2 * p}vh)`;
    const t = seg(p, .02, .2);
    title.style.opacity = (1 - t).toFixed(3);
    title.style.filter = `blur(${(t * 14).toFixed(1)}px)`;
    title.style.transform = `translate(-50%, -50%) scale(${1 + t * .18})`;
    title.style.pointerEvents = t > .5 ? "none" : "";
    const spans = [[.2, .4], [.42, .64], [.66, .86]];
    lines.forEach((el, i) => {
      const v = window_(p, ...spans[i]);
      el.style.opacity = v.toFixed(3);
      el.style.filter = `blur(${((1 - v) * 10).toFixed(1)}px)`;
      el.style.letterSpacing = `${(.02 + (1 - v) * .12).toFixed(3)}em`;
    });
    mistBoost = seg(p, .7, .97);
    fade.style.opacity = seg(p, .9, 1).toFixed(3);
    bars.forEach(b => { b.style.transform = `scaleY(${(1 - seg(p, .88, 1)).toFixed(3)})`; });
    cue.style.opacity = (1 - seg(p, 0, .05)).toFixed(3);
    document.body.classList.toggle("past-intro", p > .985);
    running = p < 1;
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", () => { sizeMist(); update(); });

  // ----- mist: soft puffs drawn on two half-resolution canvases -----
  const puff = document.createElement("canvas");
  puff.width = puff.height = 256;
  (function drawPuff() {
    const g = puff.getContext("2d");
    for (let k = 0; k < 14; k++) {             // lumpy cloud made of overlapping soft blobs
      const x = 128 + (Math.random() - .5) * 90, y = 128 + (Math.random() - .5) * 50, r = 50 + Math.random() * 60;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(226,232,220,.09)");
      grad.addColorStop(1, "rgba(226,232,220,0)");
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  })();

  const layers = [...stage.querySelectorAll("[data-mist]")].map(c => ({
    c, g: c.getContext("2d"), front: c.dataset.mist === "front", puffs: [],
  }));
  function sizeMist() {
    for (const L of layers) {
      L.c.width = Math.ceil(window.innerWidth / 2); L.c.height = Math.ceil(window.innerHeight / 2);
      const n = L.front ? 6 : 10;
      L.puffs = Array.from({ length: n }, () => ({
        x: Math.random() * L.c.width, y: L.c.height * (L.front ? .7 + Math.random() * .4 : .5 + Math.random() * .5),
        s: (L.front ? 260 : 160) + Math.random() * (L.front ? 320 : 220),
        v: (L.front ? 9 : 4) + Math.random() * (L.front ? 12 : 6),
        a: (L.front ? .1 : .14) + Math.random() * .16, ph: Math.random() * 6.28,
      }));
    }
  }
  sizeMist();

  let running = true, last = performance.now();
  function frameLoop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (running && !document.hidden) {
      for (const L of layers) {
        const { c, g } = L;
        g.clearRect(0, 0, c.width, c.height);
        const boost = L.front ? 1 + mistBoost * 6 : 1 + mistBoost * 2;
        for (const f of L.puffs) {
          if (!reduce) { f.x += f.v * dt * (1 + mistBoost * 2); f.ph += dt * .3; }
          if (f.x - f.s / 2 > c.width) f.x = -f.s / 2;
          g.globalAlpha = Math.min(1, f.a * boost * (.8 + .2 * Math.sin(f.ph)));
          g.drawImage(puff, f.x - f.s / 2, f.y - f.s * .3 + Math.sin(f.ph) * 6, f.s, f.s * .6);
        }
      }
    }
    requestAnimationFrame(frameLoop);
  }
  requestAnimationFrame(frameLoop);

  // ----- film grain: one noise tile, jittered by CSS -----
  (function grain() {
    const c = document.createElement("canvas"); c.width = c.height = 180;
    const g = c.getContext("2d"), img = g.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    q(".grain").style.backgroundImage = `url(${c.toDataURL()})`;
  })();

  update();

  // Start the title reveal once the font is ready, so letters don't jump
  const start = () => document.body.classList.add("intro-ready");
  if (document.fonts && document.fonts.load) {
    document.fonts.load("160px 'Bagel Fat One'").then(start, start);
    setTimeout(start, 1500);
  } else {
    start();
  }
})();

// "Open the analyzer": a mint bubble grows from the button, the logo bounces,
// then the bubble shrinks away to reveal the analyzer.
(function () {
  const portal = document.getElementById("portal");
  const analyzer = document.getElementById("analyzer");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let busy = false;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function jumpTo(el) {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    el.scrollIntoView({ block: "start" });
    html.style.scrollBehavior = prev;
  }

  // switch to the Analyzer page (and record it in the address bar so Back returns here)
  function reveal() {
    if (location.hash !== "#analyzer") history.pushState(null, "", "#analyzer");
    window.kodonShow("analyzer");
  }

  async function open(e) {
    e.preventDefault();
    if (busy) return;
    const seq = document.getElementById("seq");
    if (document.body.dataset.view === "analyzer") { jumpTo(analyzer); seq.focus({ preventScroll: true }); return; }
    if (reduce.matches) { reveal(); seq.focus({ preventScroll: true }); return; }
    busy = true;
    const r = e.currentTarget.getBoundingClientRect();
    portal.style.setProperty("--x", `${r.left + r.width / 2}px`);
    portal.style.setProperty("--y", `${r.top + r.height / 2}px`);
    portal.classList.remove("out");
    void portal.offsetWidth;
    portal.classList.add("in");
    await wait(1150);
    reveal();
    analyzer.classList.remove("arrive");
    void analyzer.offsetWidth;
    analyzer.classList.add("arrive");
    portal.classList.add("out");
    await wait(650);
    portal.classList.remove("in", "out");
    document.getElementById("seq").focus({ preventScroll: true });
    busy = false;
  }

  document.querySelectorAll("[data-open-analyzer]").forEach(a => a.addEventListener("click", open));
})();

// Scroll reveals: each .reveal element slides up out of a mask the first time it enters the screen.
// (Positions are checked on scroll: IntersectionObserver ignores elements whose mask hides them.)
(function () {
  let pending = [...document.querySelectorAll(".reveal")];
  let ticking = false;
  function check() {
    ticking = false;
    const limit = window.innerHeight * 0.92;
    pending = pending.filter(el => {
      if (el.offsetParent === null) return true;           // hidden (e.g. analyzer not opened yet)
      if (el.getBoundingClientRect().top < limit) { el.classList.add("in"); return false; }
      return true;
    });
  }
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  window.kodonRevealCheck = queue;
  check();
  // safety net for jumps that skip scroll events (anchor links, instant scrolls)
  const timer = setInterval(() => { if (!pending.length) clearInterval(timer); else check(); }, 400);
})();
