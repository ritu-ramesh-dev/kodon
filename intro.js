// Opening: as you scroll through the intro, the Kodon title shrinks and lifts away,
// then the header (with the small logo) slides in.
(function () {
  const intro = document.getElementById("intro");
  const root = document.documentElement;
  let ticking = false;

  function update() {
    ticking = false;
    const range = intro.offsetHeight - window.innerHeight;
    const p = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 1;
    root.style.setProperty("--p", p.toFixed(4));
    document.body.classList.toggle("past-intro", p > 0.92);
  }

  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("resize", update);
  update();

  // Start the letter animation once the font is ready, so letters don't jump
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

  function reveal() { analyzer.hidden = false; }

  // A direct link to #analyzer opens it straight away
  if (location.hash === "#analyzer") {
    reveal();
    window.addEventListener("load", () => setTimeout(() => jumpTo(analyzer), 50));
  }

  async function open(e) {
    e.preventDefault();
    if (busy) return;
    if (reduce.matches) { reveal(); jumpTo(analyzer); document.getElementById("seq").focus({ preventScroll: true }); return; }
    busy = true;
    const r = e.currentTarget.getBoundingClientRect();
    portal.style.setProperty("--x", `${r.left + r.width / 2}px`);
    portal.style.setProperty("--y", `${r.top + r.height / 2}px`);
    portal.classList.remove("out");
    void portal.offsetWidth;
    portal.classList.add("in");
    await wait(1150);
    reveal();
    jumpTo(analyzer);
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
