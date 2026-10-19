// Opening, in four scroll phases (like a planet site, but with a real forest):
//   1. a round forest "world" peeks up under the title, with two smaller worlds at the edges
//   2. the world slides to the right while the story text slides in on the left
//   3. the camera dives into the canopy until the forest fills the screen
//   4. a short caption rises over the forest, then the page continues
(function () {
  const stage = document.getElementById("intro");
  const el = name => stage.querySelector(`[data-move="${name}"]`);
  const world = el("world"), center = el("center"), left = el("left"), right = el("right"),
        copy = el("copy"), final = el("final"), cue = el("cue");
  let ticking = false;

  const clamp = x => Math.min(1, Math.max(0, x));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // progress of p inside [a, b], eased
  const seg = (p, a, b) => ease(clamp((p - a) / (b - a)));
  const mix = (a, b, t) => a + (b - a) * t;

  function update() {
    ticking = false;
    const W = window.innerWidth, H = window.innerHeight, narrow = W < 760;
    const range = stage.offsetHeight - H;
    const p = range > 0 ? clamp(window.scrollY / range) : 1;

    // forest world: size, then three key positions (centre x, centre y, scale)
    const D = Math.min(Math.max(W * .62, H * .42), H * .95);
    world.style.width = world.style.height = `${D}px`;
    const A = { x: W / 2, y: H * .66 + D / 2, s: 1 };
    const B = narrow ? { x: W / 2, y: H * .74, s: .78 } : { x: W * .7, y: H * .53, s: Math.min(.66, W * .42 / D) };
    const C = { x: W / 2, y: H / 2, s: Math.hypot(W, H) / D * 1.45 };
    const t1 = seg(p, .04, .32), t2 = seg(p, .42, .74);
    const x = t2 ? mix(mix(A.x, B.x, t1), C.x, t2) : mix(A.x, B.x, t1);
    const y = t2 ? mix(mix(A.y, B.y, t1), C.y, t2) : mix(A.y, B.y, t1);
    const sc = t2 ? mix(B.s, C.s, t2) : mix(A.s, B.s, t1);
    world.style.transform = `translate(${x - D / 2}px, ${y - D / 2}px) scale(${sc})`;
    world.style.setProperty("--dim", seg(p, .5, .76).toFixed(3));

    // title block lifts away, side worlds drift out, story text slides in then out
    center.style.setProperty("--ty", `${-H * .95 * seg(p, .02, .28)}px`);
    left.style.setProperty("--tx", `${-W * .3 * seg(p, .02, .22)}px`);
    right.style.setProperty("--tx", `${W * .3 * seg(p, .02, .22)}px`);
    copy.style.setProperty("--tx", `${mix(-W * 1.1, 0, seg(p, .12, .34)) - W * 1.1 * seg(p, .44, .62)}px`);
    final.style.setProperty("--ty", `${mix(H * .7, 0, seg(p, .72, .86))}px`);
    cue.style.setProperty("--ty", `${160 * seg(p, 0, .06)}px`);

    document.body.classList.toggle("past-intro", p > .985);
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

  function reveal() { analyzer.hidden = false; if (window.kodonRevealCheck) setTimeout(window.kodonRevealCheck, 0); }

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
