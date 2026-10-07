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

// "Lite" build: the game's intro stacks about 11 videos (three 4K loops plus seven copies of a faint grain
// video, noise.mp4). Mid-range phones can run out of hardware video decoders and show a black screen.
// The grain videos are decoration only, so stop and hide them to free decoders and save battery.
(() => {
  const NOISE = /noise\.mp4/;
  const isNoise = (v) => NOISE.test(v.currentSrc || v.src || v.getAttribute("src") || "");
  function strip(v) {
    try {
      v.pause();
      v.autoplay = false;
      v.removeAttribute("src");
      v.querySelectorAll("source").forEach((s) => s.remove());
      v.load();
      v.style.display = "none";
    } catch (e) {
    }
  }
  function scan() {
    document.querySelectorAll("video").forEach((v) => {
      if (isNoise(v)) strip(v);
    });
  }
  // Catch grain videos the moment they start playing, however late the game creates them.
  document.addEventListener("play", (e) => {
    if (e.target && e.target.tagName === "VIDEO" && isNoise(e.target)) strip(e.target);
  }, true);
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  scan();
})();
