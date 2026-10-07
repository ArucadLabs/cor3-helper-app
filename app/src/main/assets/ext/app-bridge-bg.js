// Android app only (not part of the upstream extension).
// Forwards the loader state from app-bridge.js to the Android app through native messaging.
// The app is the only receiver; nothing leaves the device.
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  api.runtime.onMessage.addListener((request) => {
    if (!request || request.type !== "cor3app-loader") return;
    try {
      const p = api.runtime.sendNativeMessage("cor3app", { state: request.state });
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
    }
  });
})();
