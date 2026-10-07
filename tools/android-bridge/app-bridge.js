// Android app only (not part of the upstream extension).
// Watches the game's own "Preparing your workspace" loader and tells the app when it is on screen,
// so the app can keep its top bar hidden until the game interface is ready.
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const LOADER = '[data-component-name="LoaderPanel"]';
  const GRACE_MS = 3000;   // no loader this long after page load => treat the page as ready (e.g. login screen)
  let state = null;
  let timer = null;

  function send(next) {
    if (next === state) return;
    state = next;
    try {
      const p = api.runtime.sendMessage({ type: "cor3app-loader", state: next });
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
    }
  }

  function check() {
    timer = null;
    if (document.querySelector(LOADER)) {
      send("loading");
    } else if (state === "loading") {
      send("ready");   // the loader was on screen and is now gone
    }
    // Loader not seen yet: stay silent. The game draws it a moment after load, so reporting "ready"
    // now would flash the bar. The grace timer below covers pages that never show a loader.
  }

  function schedule() {
    if (timer === null) timer = setTimeout(check, 150);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  if (document.querySelector(LOADER)) send("loading");
  setTimeout(() => {
    if (state === null) send("ready");
  }, GRACE_MS);
})();
