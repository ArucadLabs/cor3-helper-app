(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/content/auto-send.js
  var auto_send_exports = {};
  __export(auto_send_exports, {
    MAX_COLLECT_RETRIES: () => MAX_COLLECT_RETRIES,
    MAX_MERC_RETRIES: () => MAX_MERC_RETRIES,
    _autoSendMercRetryCount: () => _autoSendMercRetryCount,
    _autoSendUsolSkipped: () => _autoSendUsolSkipped,
    _initialFetchDone: () => _initialFetchDone,
    autoSellCheapestItems: () => autoSellCheapestItems,
    autoSendAwaitingMercenaries: () => autoSendAwaitingMercenaries,
    autoSendAwaitingUsolMercs: () => autoSendAwaitingUsolMercs,
    autoSendCollectRetries: () => autoSendCollectRetries,
    autoSendDeferredWaiting: () => autoSendDeferredWaiting,
    autoSendExpeditionBlocked: () => autoSendExpeditionBlocked,
    autoSendExpeditionId: () => autoSendExpeditionId,
    autoSendInProgress: () => autoSendInProgress,
    checkAutoSendOnExpeditionData: () => checkAutoSendOnExpeditionData,
    disableAutoSendDueToStashFull: () => disableAutoSendDueToStashFull,
    initialMercsReady: () => initialMercsReady,
    proceedWithMerc: () => proceedWithMerc,
    setAutoSendAwaitingMercenaries: () => setAutoSendAwaitingMercenaries,
    setAutoSendAwaitingUsolMercs: () => setAutoSendAwaitingUsolMercs,
    setAutoSendCollectRetries: () => setAutoSendCollectRetries,
    setAutoSendDeferredWaiting: () => setAutoSendDeferredWaiting,
    setAutoSendExpeditionBlocked: () => setAutoSendExpeditionBlocked,
    setAutoSendExpeditionId: () => setAutoSendExpeditionId,
    setAutoSendInProgress: () => setAutoSendInProgress,
    setAutoSendMercRetryCount: () => setAutoSendMercRetryCount,
    setAutoSendUsolSkipped: () => setAutoSendUsolSkipped,
    setInitialFetchDone: () => setInitialFetchDone,
    setInitialMercsReady: () => setInitialMercsReady
  });
  function setInitialFetchDone(v) {
    _initialFetchDone = v;
  }
  function setAutoSendInProgress(v) {
    autoSendInProgress = v;
  }
  function setAutoSendExpeditionId(v) {
    autoSendExpeditionId = v;
  }
  function setAutoSendAwaitingMercenaries(v) {
    autoSendAwaitingMercenaries = v;
  }
  function setAutoSendAwaitingUsolMercs(v) {
    autoSendAwaitingUsolMercs = v;
  }
  function setInitialMercsReady(v) {
    initialMercsReady = v;
  }
  function setAutoSendDeferredWaiting(v) {
    autoSendDeferredWaiting = v;
  }
  function setAutoSendExpeditionBlocked(v) {
    autoSendExpeditionBlocked = v;
  }
  function setAutoSendCollectRetries(v) {
    autoSendCollectRetries = v;
  }
  function setAutoSendUsolSkipped(v) {
    _autoSendUsolSkipped = v;
  }
  function setAutoSendMercRetryCount(v) {
    _autoSendMercRetryCount = v;
  }
  function autoSellCheapestItems(items, count, callback) {
    if (!items || count <= 0) {
      if (callback) callback();
      return;
    }
    const sellable = items.filter((i) => i.canSell && i.sellPrice && i.sellPrice > 0).sort((a, b) => a.sellPrice - b.sellPrice);
    const toSell = sellable.slice(0, Math.max(count, 1));
    if (toSell.length === 0) {
      console.log("[COR3 Helper] Auto-sell: no sellable items found");
      if (callback) callback();
      return;
    }
    console.log("[COR3 Helper] Auto-sell: selling", toSell.length, "item(s):", toSell.map((i) => i.name + " (" + i.sellPrice + ")").join(", "));
    let idx = 0;
    function sellNext() {
      if (idx >= toSell.length) {
        if (callback) callback();
        return;
      }
      const item = toSell[idx++];
      window.postMessage({ type: "COR3_SELL_ITEM", itemId: item.id, quantity: 1, skipStashRefresh: true }, "*");
      setTimeout(sellNext, 1200 + Math.floor(Math.random() * 300));
    }
    sellNext();
  }
  function disableAutoSendDueToStashFull() {
    chrome.storage.sync.get("autoSendMerc", (settings) => {
      if (settings.autoSendMerc) {
        chrome.storage.sync.set({
          autoSendMerc: {
            ...settings.autoSendMerc,
            enabled: false,
            disabledReason: "stash_full"
          }
        });
      }
    });
    window.postMessage({
      type: "COR3_STASH_FULL_WARNING",
      message: "Stash is full. Clear stash before claiming more items. Auto-send mercenary disabled."
    }, "*");
    autoSendInProgress = false;
    _automationFinish("auto-send");
    autoSendExpeditionId = null;
  }
  function checkAutoSendOnExpeditionData(expeditions) {
    if (!expeditions || !Array.isArray(expeditions) || autoSendInProgress) return;
    if (!_initialFetchDone) {
      console.log("[COR3 Helper] Auto-send: deferred \u2014 initial data fetch still in progress");
      return;
    }
    if (autoSendExpeditionBlocked) {
      var hasActive = expeditions.some((e) => e.status !== "COMPLETED" && e.status !== "FAILED");
      if (hasActive) {
        console.log("[COR3 Helper] Auto-send: still blocked \u2014 active expedition in progress");
        return;
      }
      console.log("[COR3 Helper] Auto-send: active expedition finished \u2014 unblocking");
      autoSendExpeditionBlocked = false;
      chrome.storage.local.remove("autoSendExpeditionBlocked");
    }
    const _automationActive2 = getAutomationActive();
    const _automationQueue2 = getAutomationQueue();
    if (_automationActive2 && _automationActive2.type !== "auto-send") {
      if (!_automationQueue2.some((q) => q.type === "auto-send")) {
        console.log("[COR3 Helper] Auto-send: queued (waiting for", _automationActive2.type, "to finish)");
        _automationQueue2.push({ type: "auto-send", run: function() {
          chrome.storage.local.get("expeditionsData", (result) => {
            setAutomationActive(null);
            if (result.expeditionsData) {
              checkAutoSendOnExpeditionData(result.expeditionsData);
            } else {
              Promise.resolve().then(() => (init_helpers(), helpers_exports)).then((m) => m._automationProcessNext());
            }
          });
        } });
        _broadcastQueueStatus();
      } else {
        console.log("[COR3 Helper] Auto-send: already queued (waiting for", _automationActive2.type, ")");
      }
      return;
    }
    chrome.storage.sync.get("autoSendMerc", (settings) => {
      if (!settings.autoSendMerc || !settings.autoSendMerc.enabled) return;
      if (!settings.autoSendMerc.mercenaryId && !settings.autoSendMerc.autoChooseMerc) return;
      const hasActiveExpeditions = expeditions.length > 0;
      if (!hasActiveExpeditions) {
        if (!initialMercsReady) {
          let onInitialMercsDone = function(evt) {
            if (evt.data && evt.data.type === "COR3_USOL_MERCS_DONE") {
              window.removeEventListener("message", onInitialMercsDone);
              clearTimeout(deferTimeout);
              autoSendDeferredWaiting = false;
              console.log("[COR3 Helper] Auto-send: Initial mercs now ready \u2014 re-checking expeditions");
              initialMercsReady = true;
              chrome.storage.local.get("expeditionsData", (result) => {
                if (result.expeditionsData) {
                  checkAutoSendOnExpeditionData(result.expeditionsData);
                }
              });
            }
          };
          if (autoSendDeferredWaiting) {
            console.log("[COR3 Helper] Auto-send: Already waiting for initial mercs \u2014 skipping duplicate deferral");
            return;
          }
          autoSendDeferredWaiting = true;
          console.log("[COR3 Helper] Auto-send: No active expeditions but initial mercs not ready \u2014 deferring");
          window.addEventListener("message", onInitialMercsDone);
          var deferTimeout = setTimeout(() => {
            window.removeEventListener("message", onInitialMercsDone);
            autoSendDeferredWaiting = false;
            initialMercsReady = true;
            console.log("[COR3 Helper] Auto-send: Deferred merc wait timed out \u2014 proceeding");
            chrome.storage.local.get("expeditionsData", (result) => {
              if (result.expeditionsData) {
                checkAutoSendOnExpeditionData(result.expeditionsData);
              }
            });
          }, 6e4);
          return;
        }
        console.log("[COR3 Helper] Auto-send: No active expeditions, refreshing mercs (CORE + USOL) before launch");
        autoSendInProgress = true;
        if (!getAutomationActive()) setAutomationActive({ type: "auto-send", startedAt: Date.now() });
        _broadcastQueueStatus();
        autoSendExpeditionId = null;
        autoSendAwaitingMercenaries = false;
        autoSendAwaitingUsolMercs = true;
        var mercDelay = 2500 + Math.floor(Math.random() * 1e3);
        setTimeout(() => {
          if (!autoSendInProgress || getAutomationActive() && getAutomationActive().type !== "auto-send") {
            console.log("[COR3 Helper] Auto-send: merc refresh skipped (no longer active or another automation took over)");
            return;
          }
          window.postMessage({ type: "COR3_REQUEST_MERCENARIES" }, "*");
        }, mercDelay);
        return;
      }
      for (const exp of expeditions) {
        if (exp.status === "COMPLETED" && !exp.completedAt) {
          autoSendInProgress = true;
          if (!getAutomationActive()) setAutomationActive({ type: "auto-send", startedAt: Date.now() });
          _broadcastQueueStatus();
          autoSendExpeditionId = exp.id;
          if (!exp.containerOpenedAt) {
            console.log("[COR3 Helper] Auto-send: Detected COMPLETED expedition:", exp.id, "- opening container in 10s");
            setTimeout(() => {
              window.postMessage({ type: "COR3_OPEN_CONTAINER", expeditionId: exp.id }, "*");
            }, 1e4 + Math.floor(Math.random() * 500));
          } else {
            console.log("[COR3 Helper] Auto-send: Detected COMPLETED expedition:", exp.id, "- container already open, collecting in 10s");
            setTimeout(() => {
              window.postMessage({ type: "COR3_COLLECT_ALL", expeditionId: exp.id }, "*");
            }, 1e4 + Math.floor(Math.random() * 500));
          }
          return;
        }
      }
    });
  }
  function proceedWithMerc(mercId, allMercs, settings, localData) {
    if (!mercId) {
      console.log("[COR3 Helper] Auto-send: no mercenary selected, aborting");
      autoSendInProgress = false;
      _automationFinish("auto-send");
      return;
    }
    const selectedMerc = allMercs.find((m) => m.id === mercId);
    if (!selectedMerc || selectedMerc.status !== "AVAILABLE") {
      console.log("[COR3 Helper] Auto-send: selected mercenary not AVAILABLE (status: " + (selectedMerc ? selectedMerc.status : "not found") + "), aborting");
      autoSendInProgress = false;
      _automationFinish("auto-send");
      return;
    }
    const isUsol = selectedMerc._market === "usol" || selectedMerc.faction && selectedMerc.faction.key === "usol_employment";
    const configKey = isUsol ? "usolExpeditionConfigData" : "expeditionConfigData";
    const marketId = isUsol ? "019e4065-6ae8-760d-8724-58ab4f2cf7d7" : "019d3ea4-85bd-7389-904d-8f7c85841134";
    const config = localData[configKey];
    if (!config || !config.locations || config.locations.length === 0) {
      console.log("[COR3 Helper] Auto-send: no expedition config available for " + (isUsol ? "USOL" : "CORE") + ", aborting");
      autoSendInProgress = false;
      _automationFinish("auto-send");
      return;
    }
    const DEFAULT_LOCATION_NAMES = ["Skylift Remains", "Koute Mining and Reprocessing Outpost"];
    let loc = config.locations.find((l) => DEFAULT_LOCATION_NAMES.includes(l.name));
    if (!loc) loc = config.locations[0];
    const zone = loc.zones && loc.zones[0] ? loc.zones[0] : null;
    const goal = zone && zone.goals && zone.goals[0] ? zone.goals[0] : null;
    if (!zone || !goal) {
      console.log("[COR3 Helper] Auto-send: missing zone/goal config, aborting");
      autoSendInProgress = false;
      _automationFinish("auto-send");
      return;
    }
    const launchConfig = {
      mercenaryId: mercId,
      marketId,
      locationConfigId: loc.id,
      zoneConfigId: zone.id,
      goalId: goal.id,
      hasInsurance: false
    };
    console.log("[COR3 Helper] Auto-send: launching expedition with mercenary:", selectedMerc.callsign, "(" + (isUsol ? "USOL" : "CORE") + ")");
    setTimeout(() => {
      chrome.storage.local.set({ lastExpeditionLaunchData: launchConfig });
      window.postMessage({ type: "COR3_LAUNCH_EXPEDITION", config: launchConfig }, "*");
      autoSendExpeditionBlocked = true;
      chrome.storage.local.set({ autoSendExpeditionBlocked: true });
      autoSendInProgress = false;
      _automationFinish("auto-send");
    }, 1500 + Math.floor(Math.random() * 500));
  }
  var _initialFetchDone, autoSendInProgress, autoSendExpeditionId, autoSendAwaitingMercenaries, autoSendAwaitingUsolMercs, initialMercsReady, autoSendDeferredWaiting, autoSendExpeditionBlocked, autoSendCollectRetries, MAX_COLLECT_RETRIES, _autoSendUsolSkipped, _autoSendMercRetryCount, MAX_MERC_RETRIES;
  var init_auto_send = __esm({
    "src/content/auto-send.js"() {
      init_helpers();
      _initialFetchDone = true;
      autoSendInProgress = false;
      autoSendExpeditionId = null;
      autoSendAwaitingMercenaries = false;
      autoSendAwaitingUsolMercs = false;
      initialMercsReady = false;
      autoSendDeferredWaiting = false;
      autoSendExpeditionBlocked = false;
      autoSendCollectRetries = 0;
      MAX_COLLECT_RETRIES = 3;
      _autoSendUsolSkipped = false;
      _autoSendMercRetryCount = 0;
      MAX_MERC_RETRIES = 3;
    }
  });

  // src/content/helpers.js
  var helpers_exports = {};
  __export(helpers_exports, {
    _automationEnqueue: () => _automationEnqueue,
    _automationFinish: () => _automationFinish,
    _automationProcessNext: () => _automationProcessNext,
    _automationQueueStatus: () => _automationQueueStatus,
    _broadcastQueueStatus: () => _broadcastQueueStatus,
    getAutomationActive: () => getAutomationActive,
    getAutomationQueue: () => getAutomationQueue,
    isContextValid: () => isContextValid,
    setAutomationActive: () => setAutomationActive,
    setAutomationQueue: () => setAutomationQueue
  });
  function isContextValid() {
    try {
      return !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }
  function _automationQueueStatus() {
    return {
      active: _automationActive ? _automationActive.type : null,
      queued: _automationQueue.map((q) => q.type)
    };
  }
  function getAutomationActive() {
    return _automationActive;
  }
  function setAutomationActive(v) {
    _automationActive = v;
  }
  function getAutomationQueue() {
    return _automationQueue;
  }
  function setAutomationQueue(v) {
    _automationQueue = v;
  }
  function _broadcastQueueStatus() {
    if (!isContextValid()) return;
    try {
      chrome.storage.local.set({ automationQueueStatus: _automationQueueStatus() });
    } catch (e) {
    }
  }
  function _automationFinish(type) {
    if (_automationActive && _automationActive.type === type) {
      console.log("[COR3 Helper] Automation finished:", type);
      _automationActive = null;
      _broadcastQueueStatus();
      _automationProcessNext();
    }
  }
  function _automationProcessNext() {
    if (_automationActive) return;
    if (_automationQueue.length === 0) {
      _broadcastQueueStatus();
      setTimeout(() => {
        if (_automationActive || _automationQueue.length > 0) return;
        chrome.storage.local.get("expeditionsData", (result) => {
          if (result.expeditionsData) {
            Promise.resolve().then(() => (init_auto_send(), auto_send_exports)).then((m) => m.checkAutoSendOnExpeditionData(result.expeditionsData));
          }
        });
      }, 3e3);
      return;
    }
    var next = _automationQueue.shift();
    _automationActive = { type: next.type, startedAt: Date.now() };
    console.log("[COR3 Helper] Automation starting:", next.type);
    _broadcastQueueStatus();
    next.run();
  }
  function _automationEnqueue(type, runFn) {
    if (_automationActive && _automationActive.type === type) return "already-running";
    if (_automationQueue.some((q) => q.type === type)) return "already-queued";
    if (!_automationActive) {
      _automationActive = { type, startedAt: Date.now() };
      console.log("[COR3 Helper] Automation starting:", type);
      _broadcastQueueStatus();
      runFn();
      return "started";
    }
    _automationQueue.push({ type, run: runFn });
    console.log("[COR3 Helper] Automation queued:", type, "(waiting for", _automationActive.type, ")");
    _broadcastQueueStatus();
    return "queued";
  }
  var _automationQueue, _automationActive;
  var init_helpers = __esm({
    "src/content/helpers.js"() {
      _automationQueue = [];
      _automationActive = null;
    }
  });

  // src/content/auto-update-markets.js
  var auto_update_markets_exports = {};
  __export(auto_update_markets_exports, {
    _autoJobsActive: () => _autoJobsActive,
    _autoUpdateMarkets: () => _autoUpdateMarkets,
    _autoUpdateMarketsLastRefresh: () => _autoUpdateMarketsLastRefresh,
    _initAutoUpdateMarketsTimer: () => _initAutoUpdateMarketsTimer,
    _marketRefreshInProgress: () => _marketRefreshInProgress,
    _seqRefreshRunning: () => _seqRefreshRunning,
    setAutoJobsActive: () => setAutoJobsActive,
    setAutoUpdateMarkets: () => setAutoUpdateMarkets,
    setAutoUpdateMarketsLastRefresh: () => setAutoUpdateMarketsLastRefresh,
    setMarketRefreshInProgress: () => setMarketRefreshInProgress,
    setSeqRefreshRunning: () => setSeqRefreshRunning
  });
  function setMarketRefreshInProgress(v) {
    _marketRefreshInProgress = v;
  }
  function setAutoUpdateMarketsLastRefresh(v) {
    _autoUpdateMarketsLastRefresh = v;
  }
  function setSeqRefreshRunning(v) {
    _seqRefreshRunning = v;
  }
  function setAutoJobsActive(v) {
    _autoJobsActive = v;
  }
  function setAutoUpdateMarkets(v) {
    _autoUpdateMarkets = v;
  }
  function _initAutoUpdateMarketsTimer() {
    if (!isContextValid()) {
      _autoUpdateMarketsLastRefresh = Date.now();
      return;
    }
    try {
      chrome.storage.local.get(["marketDataUpdatedAt", "darkMarketDataUpdatedAt", "soyuzMarketDataUpdatedAt", "usolMarketDataUpdatedAt"], (result) => {
        const now = Date.now();
        const timestamps = [
          result.marketDataUpdatedAt || 0,
          result.darkMarketDataUpdatedAt || 0,
          result.soyuzMarketDataUpdatedAt || 0,
          result.usolMarketDataUpdatedAt || 0
        ].filter((t) => t > 0);
        if (timestamps.length === 0) {
          _autoUpdateMarketsLastRefresh = 0;
          return;
        }
        const oldestUpdate = Math.min(...timestamps);
        const timeSinceOldest = now - oldestUpdate;
        if (timeSinceOldest >= _AUTO_UPDATE_MARKETS_INTERVAL) {
          _autoUpdateMarketsLastRefresh = 0;
        } else {
          _autoUpdateMarketsLastRefresh = oldestUpdate;
        }
      });
    } catch (e) {
      _autoUpdateMarketsLastRefresh = Date.now();
    }
  }
  var _autoUpdateMarkets, _marketRefreshInProgress, _autoUpdateMarketsLastRefresh, _seqRefreshRunning, _autoJobsActive, _AUTO_UPDATE_MARKETS_INTERVAL;
  var init_auto_update_markets = __esm({
    "src/content/auto-update-markets.js"() {
      init_helpers();
      _autoUpdateMarkets = false;
      _marketRefreshInProgress = false;
      _autoUpdateMarketsLastRefresh = 0;
      _seqRefreshRunning = false;
      _autoJobsActive = false;
      _AUTO_UPDATE_MARKETS_INTERVAL = 10 * 60 * 1e3;
      try {
        chrome.storage.sync.get("autoUpdateMarkets", (data) => {
          if (data.autoUpdateMarkets !== void 0) _autoUpdateMarkets = data.autoUpdateMarkets;
          if (_autoUpdateMarkets) _initAutoUpdateMarketsTimer();
        });
      } catch (e) {
      }
      setInterval(() => {
        if (!_autoUpdateMarkets) return;
        if (!isContextValid()) return;
        if (_marketRefreshInProgress || _seqRefreshRunning || _autoJobsActive) return;
        const now = Date.now();
        if (now - _autoUpdateMarketsLastRefresh < _AUTO_UPDATE_MARKETS_INTERVAL) return;
        _autoUpdateMarketsLastRefresh = now;
        _automationEnqueue("auto-update-markets", () => {
          _marketRefreshInProgress = true;
          console.log("[COR3 Helper] Auto Update Markets: triggering periodic 10-min refresh");
          window.postMessage({ type: "COR3_REFRESH_ALL_MARKETS_SEQ" }, "*");
          setTimeout(() => {
            _marketRefreshInProgress = false;
            _automationFinish("auto-update-markets");
          }, 3e4);
          function onDone(evt) {
            if (evt.data && evt.data.type === "COR3_ALL_MARKETS_REFRESHED") {
              window.removeEventListener("message", onDone);
              _marketRefreshInProgress = false;
              _automationFinish("auto-update-markets");
            }
          }
          window.addEventListener("message", onDone);
        });
      }, 3e4);
    }
  });

  // src/content/index.js
  init_helpers();
  init_auto_update_markets();

  // src/content/auto-choose.js
  var contentAutoChosenDecisions = /* @__PURE__ */ new Set();
  function checkAutoChooseFromContent(decisions) {
    if (!decisions || decisions.length === 0) return;
    chrome.storage.sync.get("decisionModifiers", (result) => {
      const mods = result.decisionModifiers;
      if (!mods || !mods.autoChoose) return;
      const noWait = !!mods.noWaitAutoChoose;
      const baseLootMod = mods.enabled !== false ? mods.loot ?? 3 : 1;
      const baseRiskMod = mods.enabled !== false ? mods.risk ?? -2 : -1;
      const getRidOfVeterans = !!mods.getRidOfVeterans;
      chrome.storage.local.get("expeditionsData", (expResult) => {
        const expeditions = expResult.expeditionsData || [];
        for (const d of decisions) {
          if (d.isResolved || !d.decisionDeadline || !Array.isArray(d.decisionOptions)) continue;
          if (contentAutoChosenDecisions.has(d.messageId)) continue;
          const dl = new Date(d.decisionDeadline);
          const remaining = dl - Date.now();
          if (remaining <= 0) continue;
          if (!noWait && remaining > 6e4) continue;
          let lootMod = baseLootMod;
          let riskMod = baseRiskMod;
          if (getRidOfVeterans && d.expeditionId) {
            const exp = expeditions.find((e) => e.id === d.expeditionId);
            if (exp && exp.mercenary && (exp.mercenary.rank || "").toUpperCase() === "VETERAN") {
              lootMod = 1;
              riskMod = 10;
            }
          }
          let bestOpt = null;
          let bestScore = -Infinity;
          for (const opt of d.decisionOptions) {
            const score = Math.round(opt.lootModifier * lootMod + opt.riskModifier * riskMod * ((d.riskScore + Math.abs(opt.riskModifier)) / 10 || 1));
            if (score > bestScore) {
              bestScore = score;
              bestOpt = opt;
            }
          }
          if (bestOpt) {
            contentAutoChosenDecisions.add(d.messageId);
            console.log('[COR3 Helper] Auto-choose (content): picking "' + bestOpt.label + '" (score: ' + bestScore + ")");
            window.postMessage({
              type: "COR3_RESPOND_DECISION",
              expeditionId: d.expeditionId,
              messageId: d.messageId,
              selectedOption: bestOpt.id
            }, "*");
          }
        }
      });
    });
  }

  // src/content/index.js
  init_auto_send();

  // src/content/alarms.js
  init_helpers();
  var alarms = [];
  var alarmTriggered = {};
  var audioContext = null;
  var continuousInterval = null;
  var isAlarmActive = false;
  var alarmsIntervalId = null;
  chrome.storage.sync.get("alarms", (data) => {
    alarms = data.alarms || [];
  });
  function setAlarms(v) {
    alarms = v;
  }
  function resetAlarmTriggered() {
    alarmTriggered = {};
  }
  function playAlarm(volumePercent) {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(volumePercent / 100, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.5);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(now + 0.5);
  }
  function startContinuousAlarm(volume) {
    if (continuousInterval) clearInterval(continuousInterval);
    isAlarmActive = true;
    chrome.runtime.sendMessage({ action: "alarmActiveStatus", isActive: true }).catch(() => {
    });
    playAlarm(volume);
    continuousInterval = setInterval(() => {
      playAlarm(volume);
    }, 2e3);
  }
  function stopAlarm() {
    if (continuousInterval) {
      clearInterval(continuousInterval);
      continuousInterval = null;
    }
    isAlarmActive = false;
    chrome.runtime.sendMessage({ action: "alarmActiveStatus", isActive: false }).catch(() => {
    });
  }
  function getTimerRemainingSeconds(timerSource) {
    return new Promise((resolve) => {
      if (!isContextValid()) {
        resolve(null);
        return;
      }
      if (timerSource === "daily") {
        chrome.storage.local.get("dailyOpsData", (result) => {
          if (result.dailyOpsData && result.dailyOpsData.nextTaskTime) {
            const diff = new Date(result.dailyOpsData.nextTaskTime).getTime() - Date.now();
            resolve(diff > 0 ? Math.floor(diff / 1e3) : 0);
          } else {
            resolve(null);
          }
        });
      } else if (timerSource === "home_jobs") {
        chrome.storage.local.get("marketData", (result) => {
          if (result.marketData && result.marketData.nextJobsResetAt) {
            const diff = new Date(result.marketData.nextJobsResetAt).getTime() - Date.now();
            resolve(diff > 0 ? Math.floor(diff / 1e3) : 0);
          } else {
            resolve(null);
          }
        });
      } else if (timerSource === "dark_jobs") {
        chrome.storage.local.get("darkMarketData", (result) => {
          if (result.darkMarketData && result.darkMarketData.nextJobsResetAt) {
            const diff = new Date(result.darkMarketData.nextJobsResetAt).getTime() - Date.now();
            resolve(diff > 0 ? Math.floor(diff / 1e3) : 0);
          } else {
            resolve(null);
          }
        });
      } else if (timerSource === "soyuz_jobs") {
        chrome.storage.local.get("soyuzMarketData", (result) => {
          if (result.soyuzMarketData && result.soyuzMarketData.nextJobsResetAt) {
            const diff = new Date(result.soyuzMarketData.nextJobsResetAt).getTime() - Date.now();
            resolve(diff > 0 ? Math.floor(diff / 1e3) : 0);
          } else {
            resolve(null);
          }
        });
      } else if (timerSource === "usol_jobs") {
        chrome.storage.local.get("usolMarketData", (result) => {
          if (result.usolMarketData && result.usolMarketData.nextJobsResetAt) {
            const diff = new Date(result.usolMarketData.nextJobsResetAt).getTime() - Date.now();
            resolve(diff > 0 ? Math.floor(diff / 1e3) : 0);
          } else {
            resolve(null);
          }
        });
      } else if (timerSource.startsWith("exp_")) {
        const expId = timerSource.substring(4);
        chrome.storage.local.get("expeditionsData", (result) => {
          const exps = result.expeditionsData || [];
          const exp = exps.find((e) => e.id === expId);
          if (exp && exp.endTime) {
            const diff = new Date(exp.endTime).getTime() - Date.now();
            resolve(diff > 0 ? Math.floor(diff / 1e3) : 0);
          } else {
            resolve(null);
          }
        });
      } else {
        resolve(null);
      }
    });
  }
  async function checkAlarms() {
    try {
      if (!isContextValid()) return;
      for (const alarm of alarms) {
        if (!alarm.enabled || alarm.thresholdSeconds <= 0) continue;
        const remaining = await getTimerRemainingSeconds(alarm.timerSource);
        if (remaining === null) continue;
        if (remaining <= alarm.thresholdSeconds && remaining > 0 && !alarmTriggered[alarm.id]) {
          alarmTriggered[alarm.id] = true;
          if (alarm.continuous) {
            startContinuousAlarm(alarm.volume);
          } else {
            playAlarm(alarm.volume);
          }
        } else if (remaining > alarm.thresholdSeconds) {
          alarmTriggered[alarm.id] = false;
        }
      }
    } catch (e) {
      if (e.message && e.message.includes("Extension context invalidated")) return;
    }
  }
  alarmsIntervalId = setInterval(() => checkAlarms(), 1e3);

  // src/content/auto-refresh.js
  init_helpers();
  init_auto_update_markets();
  init_auto_send();
  var autoRefreshSettings = { home_jobs: false, dark_jobs: false, soyuz_jobs: false, usol_jobs: false };
  var autoRefreshRetryPending = { home_jobs: false, dark_jobs: false, soyuz_jobs: false, usol_jobs: false };
  var autoRefreshExpiredRetryAt = { home_jobs: 0, dark_jobs: 0, soyuz_jobs: 0, usol_jobs: 0 };
  function setAutoRefreshSettings(v) {
    autoRefreshSettings = v;
  }
  try {
    chrome.storage.sync.get("autoRefresh", (data) => {
      if (data.autoRefresh) autoRefreshSettings = data.autoRefresh;
    });
  } catch (e) {
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.autoRefresh && changes.autoRefresh.newValue) {
        autoRefreshSettings = changes.autoRefresh.newValue;
      }
      if (area === "sync" && changes.autoUpdateMarkets !== void 0) {
        const wasOff = !_autoUpdateMarkets;
        setAutoUpdateMarkets(changes.autoUpdateMarkets.newValue !== false);
        if (_autoUpdateMarkets && wasOff) _initAutoUpdateMarketsTimer();
      }
      if (area === "local") {
        const marketKeyMap = { marketData: "home_jobs", darkMarketData: "dark_jobs", soyuzMarketData: "soyuz_jobs", usolMarketData: "usol_jobs" };
        for (const [storageKey, refreshKey] of Object.entries(marketKeyMap)) {
          if (changes[storageKey] && changes[storageKey].newValue) {
            const resetAt = changes[storageKey].newValue.nextJobsResetAt;
            if (resetAt && new Date(resetAt).getTime() > Date.now()) {
              autoRefreshExpiredRetryAt[refreshKey] = 0;
            }
          }
        }
        if (changes.cor3_console_logs && changes.cor3_console_logs.newValue) {
          const oldLen = (changes.cor3_console_logs.oldValue || []).length;
          const newEntries = changes.cor3_console_logs.newValue.slice(oldLen);
          const bgPopupEntries = newEntries.filter((e) => e.source !== "content");
          if (bgPopupEntries.length > 0) {
            try {
              for (const e of bgPopupEntries) {
                cor3LogEntry("ext-console", "[" + (e.source || "unknown") + "] " + (e.args || ""), e.level || "log");
              }
            } catch (err) {
            }
          }
        }
      }
    });
  } catch (e) {
  }
  function getMarketTimerSeconds(which) {
    return new Promise((resolve) => {
      if (!isContextValid()) {
        resolve(null);
        return;
      }
      try {
        const key = which === "home_jobs" ? "marketData" : which === "usol_jobs" ? "usolMarketData" : which === "soyuz_jobs" ? "soyuzMarketData" : "darkMarketData";
        chrome.storage.local.get(key, (result) => {
          const data = result[key];
          if (data && data.nextJobsResetAt) {
            const diff = new Date(data.nextJobsResetAt).getTime() - Date.now();
            resolve(diff > 0 ? Math.floor(diff / 1e3) : 0);
          } else {
            resolve(null);
          }
        });
      } catch (e) {
        resolve(null);
      }
    });
  }
  async function checkAutoRefresh() {
    try {
      if (!isContextValid()) return;
      if (_seqRefreshRunning || _autoJobsActive || !_initialFetchDone) return;
      let needsRefresh = false;
      let expiredMarkets = [];
      const now = Date.now();
      for (const key of ["home_jobs", "dark_jobs", "soyuz_jobs", "usol_jobs"]) {
        if (!autoRefreshSettings[key]) continue;
        if (autoRefreshRetryPending[key]) continue;
        const sec = await getMarketTimerSeconds(key);
        if (sec !== null && sec <= 0) {
          if (autoRefreshExpiredRetryAt[key] && now < autoRefreshExpiredRetryAt[key]) continue;
          needsRefresh = true;
          expiredMarkets.push(key);
        }
      }
      if (needsRefresh) {
        let onAllDone = function(evt) {
          if (evt.data && evt.data.type === "COR3_ALL_MARKETS_REFRESHED") {
            window.removeEventListener("message", onAllDone);
            setSeqRefreshRunning(false);
            for (const key of ["home_jobs", "dark_jobs", "soyuz_jobs", "usol_jobs"]) {
              autoRefreshRetryPending[key] = false;
            }
          }
        };
        setSeqRefreshRunning(true);
        for (const key of expiredMarkets) {
          autoRefreshRetryPending[key] = true;
          autoRefreshExpiredRetryAt[key] = now + 6e4;
        }
        var order = [];
        if (expiredMarkets.includes("usol_jobs")) order.push("usol");
        if (expiredMarkets.includes("soyuz_jobs")) order.push("soyuz");
        if (expiredMarkets.includes("dark_jobs")) order.push("dark");
        if (expiredMarkets.includes("home_jobs")) order.push("home");
        setMarketRefreshInProgress(true);
        setAutoUpdateMarketsLastRefresh(Date.now());
        var msg = { type: "COR3_REFRESH_ALL_MARKETS_SEQ" };
        if (order.length > 0) msg.order = order;
        window.postMessage(msg, "*");
        setTimeout(() => {
          setSeqRefreshRunning(false);
          for (const key of ["home_jobs", "dark_jobs", "soyuz_jobs", "usol_jobs"]) {
            autoRefreshRetryPending[key] = false;
          }
        }, 3e4);
        window.addEventListener("message", onAllDone);
      }
    } catch (e) {
      if (e.message && e.message.includes("Extension context invalidated")) return;
    }
  }
  var autoRefreshIntervalId = setInterval(() => checkAutoRefresh(), 1e3);

  // src/content/solvers.js
  var decryptSolverInjected = false;
  function injectDecryptSolver() {
    if (decryptSolverInjected) {
      window.postMessage({ type: "COR3_START_DECRYPT_SOLVER" }, "*");
      return;
    }
    decryptSolverInjected = true;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("decrypt-solver.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }
  function stopDecryptSolver() {
    window.postMessage({ type: "COR3_STOP_DECRYPT_SOLVER" }, "*");
    decryptSolverInjected = false;
  }
  var dailyHackInjected = false;
  function injectDailyHackSolver() {
    if (dailyHackInjected) {
      window.postMessage({ type: "COR3_STOP_DAILY_HACK" }, "*");
      dailyHackInjected = false;
      setTimeout(() => injectDailyHackSolver(), 300);
      return;
    }
    dailyHackInjected = true;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("daily-hack-solver.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }
  function stopDailyHackSolver() {
    window.postMessage({ type: "COR3_STOP_DAILY_HACK" }, "*");
    dailyHackInjected = false;
  }
  var iceWallSolverInjected = false;
  function injectIceWallSolver() {
    if (iceWallSolverInjected) {
      window.postMessage({ type: "COR3_START_ICE_WALL_SOLVER" }, "*");
      return;
    }
    iceWallSolverInjected = true;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("ice-wall-solver.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }
  function stopIceWallSolver() {
    window.postMessage({ type: "COR3_STOP_ICE_WALL_SOLVER" }, "*");
    iceWallSolverInjected = false;
  }
  var simpleDecryptSolverInjected = false;
  function injectSimpleDecryptSolver() {
    if (simpleDecryptSolverInjected) {
      window.postMessage({ type: "COR3_START_SIMPLE_DECRYPT_SOLVER" }, "*");
      return;
    }
    simpleDecryptSolverInjected = true;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("simple-decrypt-solver.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }
  function stopSimpleDecryptSolver() {
    window.postMessage({ type: "COR3_STOP_SIMPLE_DECRYPT_SOLVER" }, "*");
    simpleDecryptSolverInjected = false;
  }
  var autoJobSolverInjected = false;
  function injectAutoJobSolver() {
    if (autoJobSolverInjected) return;
    autoJobSolverInjected = true;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("auto-job-solver.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
    console.log("[COR3 Helper] Auto Job Solver engine injected");
  }
  var autoValuableSellerInjected = false;
  function injectAutoValuableSeller() {
    if (autoValuableSellerInjected) return;
    autoValuableSellerInjected = true;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("auto-valuable-seller.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
    console.log("[COR3 Helper] Auto Valuable Seller engine injected");
  }
  function ensureAntiAfkEnabled() {
    window.postMessage({ type: "COR3_ANTI_AFK_TOGGLE", enabled: true }, "*");
  }
  chrome.storage.sync.get(["autoDecryptEnabled", "autoIceWallEnabled", "autoSimpleDecryptEnabled"], (data) => {
    if (data.autoDecryptEnabled) {
      injectDecryptSolver();
    }
    if (data.autoIceWallEnabled) {
      injectIceWallSolver();
    }
    if (data.autoSimpleDecryptEnabled) {
      injectSimpleDecryptSolver();
    }
  });

  // src/content/dom-tweaks.js
  function deleteBackgroundElements() {
    const backgroundElements = [
      "#app-background",
      "#glitch-background",
      "#video-glitch",
      "#video-waves"
    ];
    backgroundElements.forEach((selector) => {
      try {
        const element = document.querySelector(selector);
        if (element) {
          element.remove();
          console.log("[COR3 Helper] Deleted background element:", selector);
        }
      } catch (e) {
      }
    });
  }
  chrome.storage.sync.get("disableBackground", (result) => {
    if (result.disableBackground) {
      setTimeout(() => {
        deleteBackgroundElements();
      }, 1e3);
    }
  });
  var networkFogObserver = null;
  function isNetworkMapVisible() {
    const divs = document.querySelectorAll("div");
    for (const div of divs) {
      if (div.textContent.trim() === "Network map") return true;
    }
    return false;
  }
  function hideNetworkFogVideos() {
    const videos = document.querySelectorAll("video");
    videos.forEach((v) => {
      const src = v.getAttribute("src") || "";
      if (src.includes("/video/network-map/fog.mp4") || src.includes("/video/network-map/fog_layer_2.mp4")) {
        v.style.display = "none";
        v.pause();
        v.setAttribute("data-cor3-fog-hidden", "true");
      }
    });
  }
  function showNetworkFogVideos() {
    const hiddenVideos = document.querySelectorAll('[data-cor3-fog-hidden="true"]');
    hiddenVideos.forEach((v) => {
      v.style.display = "";
      v.removeAttribute("data-cor3-fog-hidden");
      v.play().catch(() => {
      });
    });
  }
  function startNetworkFogObserver() {
    if (networkFogObserver) return;
    networkFogObserver = new MutationObserver(() => {
      if (isNetworkMapVisible()) {
        hideNetworkFogVideos();
      }
    });
    networkFogObserver.observe(document.body, { childList: true, subtree: true });
  }
  function stopNetworkFogObserver() {
    if (networkFogObserver) {
      networkFogObserver.disconnect();
      networkFogObserver = null;
    }
  }
  chrome.storage.sync.get("disableNetworkFog", (result) => {
    if (result.disableNetworkFog) {
      setTimeout(() => {
        hideNetworkFogVideos();
        startNetworkFogObserver();
      }, 1e3);
    }
  });
  var COR3_NOTIF_LEFT_STYLE_ID = "cor3-notifications-left-style";
  function applyNotificationsLeft() {
    if (document.getElementById(COR3_NOTIF_LEFT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = COR3_NOTIF_LEFT_STYLE_ID;
    style.textContent = `
        .Toastify__toast-container--bottom-right {
            left: 16px !important;
            right: auto !important;
            margin-bottom: 35px;
        }
        [data-component-name="NotificationsHistory"] {
            left: 0 !important;
            right: auto !important;
            align-items: flex-start;
        }
        [data-component-name="NotificationsHistory"] > button:first-of-type {
            transform: scaleX(-1);
            display: flex;
        }
        [data-component-name="NotificationsHistory"] .sticker-content {
            color: transparent;               /* hide original text */
            position: relative;
        }
        [data-component-name="NotificationsHistory"] .sticker-content::before {
            content: "Notifications";         /* duplicate the word */
            position: absolute;
            left: 0;
            transform: scaleX(-1);
            color: #FFFFFF;   /* re\u2011apply the original colour */
            white-space: pre;                 /* keep spacing */
        }
        [data-component-name="NotificationsHistory"] .go3673730358,
        [data-component-name="NotificationsHistory"] > div:last-child {
            border-top-left-radius: 0px;
            border-top-right-radius: 16px;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
  }
  function removeNotificationsLeft() {
    const el = document.getElementById(COR3_NOTIF_LEFT_STYLE_ID);
    if (el) el.remove();
  }
  chrome.storage.sync.get("moveNotificationsLeft", (result) => {
    if (result.moveNotificationsLeft) {
      setTimeout(() => {
        applyNotificationsLeft();
      }, 1e3);
    }
  });

  // src/content/log-writers.js
  init_helpers();
  var _autoJobLogQueue = [];
  var _autoJobLogFlushTimer = null;
  var _autoJobLogFlushing = false;
  function _flushAutoJobLogs() {
    _autoJobLogFlushTimer = null;
    if (_autoJobLogFlushing || _autoJobLogQueue.length === 0 || !isContextValid()) return;
    _autoJobLogFlushing = true;
    const pending = _autoJobLogQueue.splice(0);
    chrome.storage.local.get("autoJobsDebugLogs", (result) => {
      if (!isContextValid()) {
        _autoJobLogFlushing = false;
        return;
      }
      const logs = Array.isArray(result.autoJobsDebugLogs) ? result.autoJobsDebugLogs : [];
      for (const entry of pending) logs.push(entry);
      if (logs.length > 200) logs.splice(0, logs.length - 200);
      chrome.storage.local.set({ autoJobsDebugLogs: logs }, () => {
        _autoJobLogFlushing = false;
        if (_autoJobLogQueue.length > 0) {
          _flushAutoJobLogs();
        }
      });
    });
  }
  function queueAutoJobLog(msg, level) {
    _autoJobLogQueue.push({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), msg, level: level || "info" });
    if (!_autoJobLogFlushTimer && !_autoJobLogFlushing) {
      _autoJobLogFlushTimer = setTimeout(_flushAutoJobLogs, 100);
    }
    if (typeof cor3LogEntry === "function") cor3LogEntry("auto-jobs", msg, level || "info");
  }
  var _valuableLogQueue = [];
  var _valuableLogFlushTimer = null;
  var _valuableLogFlushing = false;
  function _flushValuableLogs() {
    _valuableLogFlushTimer = null;
    if (_valuableLogFlushing || _valuableLogQueue.length === 0 || !isContextValid()) return;
    _valuableLogFlushing = true;
    const pending = _valuableLogQueue.splice(0);
    chrome.storage.local.get("valuableDebugLogs", (result) => {
      if (!isContextValid()) {
        _valuableLogFlushing = false;
        return;
      }
      const logs = Array.isArray(result.valuableDebugLogs) ? result.valuableDebugLogs : [];
      for (const entry of pending) logs.push(entry);
      if (logs.length > 200) logs.splice(0, logs.length - 200);
      chrome.storage.local.set({ valuableDebugLogs: logs }, () => {
        _valuableLogFlushing = false;
        if (_valuableLogQueue.length > 0) {
          _flushValuableLogs();
        }
      });
    });
  }
  function queueValuableLog(msg, level) {
    _valuableLogQueue.push({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), msg, level: level || "info" });
    if (!_valuableLogFlushTimer && !_valuableLogFlushing) {
      _valuableLogFlushTimer = setTimeout(_flushValuableLogs, 100);
    }
    if (typeof cor3LogEntry === "function") cor3LogEntry("auto-valuable", msg, level || "info");
  }

  // src/content/ws-relay.js
  init_helpers();
  init_auto_send();
  init_auto_update_markets();
  function fetchDailyRewards(token) {
    fetch("https://svc-corie.cor3.gg/api/user-daily-claim/rewards", {
      headers: { "Authorization": token }
    }).then((r) => r.ok ? r.json() : null).then((data) => {
      if (data && Array.isArray(data)) {
        chrome.storage.local.set({ dailyRewardsData: data });
      }
    }).catch(() => {
    });
  }
  function setupWsRelay() {
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (!isContextValid()) return;
      const now = Date.now();
      if (event.data && event.data.type === "COR3_WS_LOG") {
        cor3LogWsMessage(event.data.direction, event.data.message);
      }
      if (event.data && event.data.type === "COR3_WS_EXPEDITIONS") {
        chrome.storage.local.set({ expeditionsData: event.data.expeditions, expeditionsDataUpdatedAt: now });
        var exps = event.data.expeditions || [];
        var hasActive = exps.some(function(e) {
          return e.status === "IN_PROGRESS";
        });
        if (!hasActive) {
          chrome.storage.local.get("expeditionLaunchError", function(result) {
            if (result.expeditionLaunchError && !result.expeditionLaunchError.noRetry) {
              console.log("[COR3 Helper] No active expeditions \u2014 clearing expedition launch error");
              chrome.storage.local.remove("expeditionLaunchError");
            }
          });
        }
        checkAutoSendOnExpeditionData(event.data.expeditions);
      }
      if (event.data && event.data.type === "COR3_WS_DECISIONS") {
        chrome.storage.local.set({ expeditionDecisions: event.data.decisions });
        checkAutoChooseFromContent(event.data.decisions);
      }
      if (event.data && event.data.type === "COR3_WS_SPECIALISTS") {
        chrome.storage.local.set({ specialistsData: event.data.data, specialistsDataUpdatedAt: now });
      }
      if (event.data && event.data.type === "COR3_WS_STASH") {
        chrome.storage.local.set({ stashData: event.data.stash, stashDataUpdatedAt: now });
        chrome.storage.sync.get("autoSendMerc", (settings) => {
          if (settings.autoSendMerc && settings.autoSendMerc.disabledReason === "stash_full" && !settings.autoSendMerc.enabled) {
            const stash = event.data.stash;
            let hasSpace = false;
            let spaceNeeded = 2;
            if (stash && stash.maxCapacity && stash.currentUsage !== void 0) {
              const availableSpace = stash.maxCapacity - stash.currentUsage;
              hasSpace = availableSpace >= spaceNeeded;
            }
            if (hasSpace) {
              console.log("[COR3 Helper] Stash has space again, re-enabling auto-send mercenary");
              chrome.storage.sync.set({
                autoSendMerc: {
                  ...settings.autoSendMerc,
                  enabled: true,
                  disabledReason: null
                }
              });
              window.postMessage({
                type: "COR3_AUTO_SEND_REENABLED",
                message: "Stash space available. Auto-send mercenary re-enabled."
              }, "*");
            }
          }
        });
      }
      if (event.data && event.data.type === "COR3_WS_MARKET") {
        chrome.storage.local.set({ marketData: event.data.market, marketDataUpdatedAt: now });
      }
      if (event.data && event.data.type === "COR3_WS_DARK_MARKET") {
        chrome.storage.local.set({ darkMarketData: event.data.market, darkMarketAvailable: true, darkMarketDataUpdatedAt: now });
      }
      if (event.data && event.data.type === "COR3_WS_SOYUZ_MARKET") {
        chrome.storage.local.set({ soyuzMarketData: event.data.market, soyuzMarketAvailable: true, soyuzMarketDataUpdatedAt: now });
      }
      if (event.data && event.data.type === "COR3_WS_USOL_MARKET") {
        chrome.storage.local.set({ usolMarketData: event.data.market, usolMarketAvailable: true, usolMarketDataUpdatedAt: now });
      }
      if (event.data && event.data.type === "COR3_WS_LOADOUT") {
        chrome.storage.local.set({ loadoutData: event.data.loadout, loadoutAction: event.data.action, loadoutUpdatedAt: now, loadoutError: null });
      }
      if (event.data && event.data.type === "COR3_WS_LOADOUT_ERROR") {
        chrome.storage.local.set({ loadoutError: event.data.error, loadoutErrorAction: event.data.action, loadoutUpdatedAt: now });
      }
      if (event.data && event.data.type === "COR3_WS_DARK_MARKET_UNREACHABLE") {
        chrome.storage.local.set({ darkMarketAvailable: false, darkMarketDataUpdatedAt: now, darkMarketMaintenanceEndsAt: event.data.maintenanceEndsAt || null, darkMarketBlockerServer: event.data.blockerServerName || null });
      }
      if (event.data && event.data.type === "COR3_WS_SOYUZ_MARKET_UNREACHABLE") {
        chrome.storage.local.set({ soyuzMarketAvailable: false, soyuzMarketDataUpdatedAt: now, soyuzMarketMaintenanceEndsAt: event.data.maintenanceEndsAt || null, soyuzMarketBlockerServer: event.data.blockerServerName || null });
      }
      if (event.data && event.data.type === "COR3_WS_USOL_MARKET_UNREACHABLE") {
        chrome.storage.local.set({ usolMarketAvailable: false, usolMarketDataUpdatedAt: now, usolMarketMaintenanceEndsAt: event.data.maintenanceEndsAt || null, usolMarketBlockerServer: event.data.blockerServerName || null });
      }
      if (event.data && event.data.type === "COR3_BEARER_TOKEN") {
        chrome.storage.local.get("bearerToken", (prev) => {
          const isNew = !prev.bearerToken || prev.bearerToken !== event.data.token;
          chrome.storage.local.set({ bearerToken: event.data.token });
          if (isNew) {
            fetch("https://svc-corie.cor3.gg/api/user-daily-claim", {
              headers: { "Authorization": event.data.token }
            }).then((r) => r.ok ? r.json() : null).then((data) => {
              if (data) chrome.storage.local.set({ dailyOpsData: data, dailyOpsUpdatedAt: Date.now(), dailyOpsError: null });
            }).catch(() => {
            });
          }
        });
      }
      if (event.data && event.data.type === "COR3_WEB_VERSION") {
        chrome.storage.local.set({ webVersion: event.data.version });
      }
      if (event.data && event.data.type === "COR3_SYSTEM_VERSION") {
        chrome.storage.local.set({ systemVersion: event.data.version });
      }
      if (event.data && event.data.type === "COR3_PATCH_VERSION") {
        chrome.storage.local.set({ patchVersion: event.data.version });
      }
      if (event.data && event.data.type === "COR3_DAILY_REWARDS") {
        chrome.storage.local.set({ dailyRewardsData: event.data.rewards });
      }
      if (event.data && event.data.type === "COR3_WS_ARCHIVED_EXPEDITIONS") {
        chrome.storage.local.set({ archivedExpeditionsData: event.data.data, archivedExpeditionsUpdatedAt: now });
      }
      if (event.data && event.data.type === "COR3_WS_MERCENARIES") {
        chrome.storage.local.set({ mercenariesData: event.data.data, mercenariesUpdatedAt: now });
      }
      if (event.data && event.data.type === "COR3_CORE_MERCS_DONE") {
        chrome.storage.local.set({ coreMercsDone: Date.now() });
      }
      if (event.data && event.data.type === "COR3_USOL_MERCS_DONE") {
        chrome.storage.local.set({ usolMercsDone: Date.now() });
        setInitialMercsReady(true);
      }
      if (event.data && event.data.type === "COR3_WS_USOL_MERCENARIES") {
        chrome.storage.local.set({ usolMercenariesData: event.data.data, usolMercenariesUpdatedAt: now });
      }
      if (event.data && event.data.type === "COR3_WS_MERC_CONFIGURE" && event.data.mercenaryId) {
        chrome.storage.local.get("mercConfigData", (result) => {
          const configs = result.mercConfigData || {};
          configs[event.data.mercenaryId] = event.data.data;
          chrome.storage.local.set({ mercConfigData: configs, mercConfigUpdatedAt: now });
        });
      }
      if (event.data && event.data.type === "COR3_CORE_MERCS_DONE" && autoSendAwaitingUsolMercs) {
        setAutoSendAwaitingUsolMercs(false);
        if (!autoSendInProgress || getAutomationActive() && getAutomationActive().type !== "auto-send") {
          console.log("[COR3 Helper] Auto-send: USOL merc refresh skipped (no longer active)");
        } else {
          let onUsolMercsDoneForAutoSend = function(evt) {
            if (_usolMercHandled) return;
            if (evt.data && evt.data.type === "COR3_USOL_MERCS_DONE") {
              _usolMercHandled = true;
              window.removeEventListener("message", onUsolMercsDoneForAutoSend);
              clearTimeout(usolMercsTimeout);
              console.log("[COR3 Helper] Auto-send: USOL mercs refreshed, proceeding to select merc");
              setAutoSendAwaitingMercenaries(true);
              window.postMessage({ type: "COR3_CORE_MERCS_DONE" }, "*");
            }
            if (evt.data && evt.data.type === "COR3_WS_USOL_MARKET_UNREACHABLE") {
              _usolMercHandled = true;
              window.removeEventListener("message", onUsolMercsDoneForAutoSend);
              clearTimeout(usolMercsTimeout);
              console.log("[COR3 Helper] Auto-send: USOL market unreachable \u2014 proceeding with CORE mercs only");
              setAutoSendUsolSkipped(true);
              setAutoSendAwaitingMercenaries(true);
              window.postMessage({ type: "COR3_CORE_MERCS_DONE" }, "*");
            }
          };
          console.log("[COR3 Helper] Auto-send: CORE mercs refreshed, now fetching USOL mercs...");
          setTimeout(() => {
            if (!autoSendInProgress) return;
            window.postMessage({ type: "COR3_REQUEST_USOL_MERCENARIES" }, "*");
          }, 500);
          var _usolMercHandled = false;
          window.addEventListener("message", onUsolMercsDoneForAutoSend);
          var usolMercsTimeout = setTimeout(() => {
            if (_usolMercHandled) return;
            _usolMercHandled = true;
            window.removeEventListener("message", onUsolMercsDoneForAutoSend);
            console.log("[COR3 Helper] Auto-send: USOL mercs timeout \u2014 proceeding with CORE mercs only");
            setAutoSendAwaitingMercenaries(true);
            window.postMessage({ type: "COR3_CORE_MERCS_DONE" }, "*");
          }, 3e4);
        }
      }
      if (event.data && event.data.type === "COR3_CORE_MERCS_DONE" && autoSendAwaitingMercenaries) {
        setAutoSendAwaitingMercenaries(false);
        chrome.storage.sync.get("autoSendMerc", (settings) => {
          if (!settings.autoSendMerc || !settings.autoSendMerc.enabled) {
            console.log("[COR3 Helper] Auto-send: disabled, aborting");
            setAutoSendInProgress(false);
            _automationFinish("auto-send");
            return;
          }
          chrome.storage.local.get(["mercenariesData", "usolMercenariesData", "mercConfigData", "expeditionConfigData", "usolExpeditionConfigData"], (localData) => {
            let coreMercs = [];
            const coreRaw = localData.mercenariesData;
            if (coreRaw) {
              if (coreRaw.mercenaries) coreMercs = coreRaw.mercenaries;
              else if (Array.isArray(coreRaw)) coreMercs = coreRaw;
            }
            coreMercs.forEach((m) => {
              m._market = "core";
            });
            const coreElite = coreRaw && coreRaw.eliteSlots || [];
            coreElite.forEach((es) => {
              if (es.mercenary && !coreMercs.find((m) => m.id === es.mercenary.id)) {
                es.mercenary._market = "core";
                es.mercenary._isElite = true;
                coreMercs.push(es.mercenary);
              }
            });
            let usolMercs = [];
            const usolData = localData.usolMercenariesData;
            if (usolData && !_autoSendUsolSkipped) {
              let raw = usolData;
              if (raw && !Array.isArray(raw) && raw.mercenaries) usolMercs = raw.mercenaries;
              else if (Array.isArray(raw)) usolMercs = raw;
              usolMercs.forEach((m) => {
                m._market = "usol";
              });
              const usolElite = usolData && usolData.eliteSlots || [];
              usolElite.forEach((es) => {
                if (es.mercenary && !usolMercs.find((m) => m.id === es.mercenary.id)) {
                  es.mercenary._market = "usol";
                  es.mercenary._isElite = true;
                  usolMercs.push(es.mercenary);
                }
              });
            } else if (_autoSendUsolSkipped) {
              console.log("[COR3 Helper] Auto-send: USOL mercs skipped (market unreachable)");
            }
            const allMercs = [...coreMercs, ...usolMercs];
            let mercId = settings.autoSendMerc.mercenaryId;
            if (settings.autoSendMerc.autoChooseMerc) {
              const configs = localData.mercConfigData || {};
              const ignoreElite = !!settings.autoSendMerc.ignoreEliteMerc;
              const usolFirst = !!settings.autoSendMerc.autoChooseUsolFirst;
              const eliteIds = /* @__PURE__ */ new Set();
              coreElite.forEach((es) => {
                if (es.mercenary) eliteIds.add(es.mercenary.id);
              });
              const usolElite2 = usolData && usolData.eliteSlots || [];
              usolElite2.forEach((es) => {
                if (es.mercenary) eliteIds.add(es.mercenary.id);
              });
              allMercs.forEach((m) => {
                if (!m._isElite) m._isElite = eliteIds.has(m.id);
              });
              let available = allMercs.filter((m) => m.status === "AVAILABLE" && configs[m.id]);
              if (ignoreElite) available = available.filter((m) => !m._isElite);
              if (settings.autoSendMerc.applyMercCostLimiter) {
                const maxCost = settings.autoSendMerc.maxMercCost ?? 15e3;
                available = available.filter((m) => (configs[m.id].totalCost || 0) <= maxCost);
              }
              if (available.length > 0) {
                available.sort((a, b) => {
                  if (usolFirst) {
                    if (a._market === "usol" && b._market !== "usol") return -1;
                    if (a._market !== "usol" && b._market === "usol") return 1;
                  }
                  const costA = configs[a.id] && configs[a.id].totalCost || Infinity;
                  const costB = configs[b.id] && configs[b.id].totalCost || Infinity;
                  if (costA !== costB) return costA - costB;
                  const riskA = configs[a.id] && configs[a.id].riskScore || 0;
                  const riskB = configs[b.id] && configs[b.id].riskScore || 0;
                  if (riskA !== riskB) return riskA - riskB;
                  if (a._market === "usol" && b._market !== "usol") return -1;
                  if (a._market !== "usol" && b._market === "usol") return 1;
                  return 0;
                });
                mercId = available[0].id;
                console.log("[COR3 Helper] Auto-choose merc: selected", available[0].callsign, "(" + available[0]._market + ") cost:", configs[available[0].id].totalCost);
              } else {
                console.log("[COR3 Helper] Auto-send: no fitting merc available after filtering");
                chrome.storage.local.set({ mercWarning: "No fitting merc available \u2014 all mercs filtered out or unavailable." + (_autoSendUsolSkipped ? " (USOL market unreachable)" : "") });
                setAutoSendUsolSkipped(false);
                setAutoSendMercRetryCount(0);
                setAutoSendInProgress(false);
                _automationFinish("auto-send");
                return;
              }
            }
            setAutoSendUsolSkipped(false);
            proceedWithMerc(mercId, allMercs, settings, localData);
          });
        });
      }
      if (event.data && event.data.type === "COR3_WS_EXPEDITION_ARCHIVED") {
        const archivedId = event.data.data && event.data.data.id;
        if (archivedId) {
          chrome.storage.local.get("expeditionsData", (result) => {
            const exps2 = result.expeditionsData || [];
            const filtered = exps2.filter((e) => e.id !== archivedId);
            chrome.storage.local.set({ expeditionsData: filtered, expeditionsDataUpdatedAt: now });
          });
        }
      }
      if (event.data && event.data.type === "COR3_WS_EXPEDITION_CONFIG") {
        chrome.storage.local.set({ expeditionConfigData: event.data.data });
      }
      if (event.data && event.data.type === "COR3_WS_USOL_EXPEDITION_CONFIG") {
        chrome.storage.local.set({ usolExpeditionConfigData: event.data.data });
      }
      if (event.data && event.data.type === "COR3_WS_CONTAINER_OPENED") {
        if (autoSendInProgress && autoSendExpeditionId) {
          console.log("[COR3 Helper] Auto-send: Container opened, checking inventory space...");
          const containerData = event.data.data;
          let spaceNeeded = 2;
          if (containerData && containerData.items && Array.isArray(containerData.items)) {
            spaceNeeded = containerData.items.length;
            console.log("[COR3 Helper] Container contains", spaceNeeded, "items");
          } else if (containerData && containerData.containerItems && Array.isArray(containerData.containerItems)) {
            spaceNeeded = containerData.containerItems.length;
            console.log("[COR3 Helper] Container contains", spaceNeeded, "items (containerItems)");
          }
          chrome.storage.local.get("stashData", (result) => {
            const stash = result.stashData;
            let hasSpace = true;
            if (stash && stash.maxCapacity && stash.currentUsage !== void 0) {
              const availableSpace = stash.maxCapacity - stash.currentUsage;
              hasSpace = availableSpace >= spaceNeeded;
              console.log("[COR3 Helper] Inventory check:", availableSpace, "available, need", spaceNeeded);
            }
            if (hasSpace) {
              console.log("[COR3 Helper] Auto-send: Sufficient space, collecting all in 10s...");
              setTimeout(() => {
                window.postMessage({ type: "COR3_COLLECT_ALL", expeditionId: autoSendExpeditionId }, "*");
              }, 1e4 + Math.floor(Math.random() * 500));
            } else {
              chrome.storage.sync.get("autoSellCheapest", (sellData) => {
                if (sellData.autoSellCheapest && stash && stash.items) {
                  const availableSpace2 = stash.maxCapacity - stash.currentUsage;
                  const shortfall = spaceNeeded - availableSpace2;
                  console.log("[COR3 Helper] Auto-sell: need", shortfall, "more slot(s), selling cheapest items");
                  autoSellCheapestItems(stash.items, shortfall, () => {
                    window.postMessage({ type: "COR3_REQUEST_STASH" }, "*");
                    setTimeout(() => {
                      console.log("[COR3 Helper] Auto-sell done, collecting all in 10s...");
                      setTimeout(() => {
                        window.postMessage({ type: "COR3_COLLECT_ALL", expeditionId: autoSendExpeditionId }, "*");
                      }, 1e4 + Math.floor(Math.random() * 500));
                    }, 3e3);
                  });
                } else {
                  console.log("[COR3 Helper] Auto-send: Insufficient space, disabling auto-container-claim");
                  chrome.storage.sync.get("autoSendMerc", (settings) => {
                    if (settings.autoSendMerc) {
                      chrome.storage.sync.set({
                        autoSendMerc: {
                          ...settings.autoSendMerc,
                          enabled: false,
                          disabledReason: "stash_full"
                        }
                      });
                    }
                  });
                  setAutoSendInProgress(false);
                  _automationFinish("auto-send");
                }
              });
            }
          });
        }
      }
      if (event.data && event.data.type === "COR3_WS_STASH_FULL") {
        setAutoSendCollectRetries(autoSendCollectRetries + 1);
        console.log("[COR3 Helper] Stash full error detected (attempt", autoSendCollectRetries, "/", MAX_COLLECT_RETRIES, ")");
        if (autoSendCollectRetries > MAX_COLLECT_RETRIES) {
          console.log("[COR3 Helper] Max collect retries reached, giving up");
          setAutoSendCollectRetries(0);
          disableAutoSendDueToStashFull();
          return;
        }
        chrome.storage.sync.get("autoSellCheapest", (sellData) => {
          if (sellData.autoSellCheapest) {
            chrome.storage.local.get("stashData", (result) => {
              const stash = result.stashData;
              if (stash && stash.items) {
                console.log("[COR3 Helper] Auto-sell: selling cheapest items to free space after collect.all stash-full");
                autoSellCheapestItems(stash.items, 2, () => {
                  window.postMessage({ type: "COR3_REQUEST_STASH" }, "*");
                  setTimeout(() => {
                    if (autoSendExpeditionId) {
                      console.log("[COR3 Helper] Auto-sell done, retrying collect all in 10s...");
                      setTimeout(() => {
                        window.postMessage({ type: "COR3_COLLECT_ALL", expeditionId: autoSendExpeditionId }, "*");
                      }, 1e4 + Math.floor(Math.random() * 500));
                    }
                  }, 3e3);
                });
              } else {
                setAutoSendCollectRetries(0);
                disableAutoSendDueToStashFull();
              }
            });
          } else {
            setAutoSendCollectRetries(0);
            disableAutoSendDueToStashFull();
          }
        });
      }
      if (event.data && event.data.type === "COR3_WS_INSUFFICIENT_CREDITS") {
        console.log("[COR3 Helper] Insufficient credits for expedition launch, disabling auto-send mercenary");
        chrome.storage.sync.get("autoSendMerc", (settings) => {
          if (settings.autoSendMerc) {
            chrome.storage.sync.set({
              autoSendMerc: {
                ...settings.autoSendMerc,
                enabled: false,
                disabledReason: "insufficient_credits"
              }
            });
          }
        });
        chrome.storage.local.set({
          expeditionLaunchError: {
            error: "Insufficient credits to launch expedition",
            retryAfter: 0,
            timestamp: Date.now(),
            noRetry: true
          }
        });
        setAutoSendInProgress(false);
        _automationFinish("auto-send");
        setAutoSendExpeditionId(null);
      }
      if (event.data && event.data.type === "COR3_WS_COLLECT_INSUFFICIENT_CREDITS") {
        console.log("[COR3 Helper] Insufficient credits for collect.all, disabling auto-send mercenary");
        chrome.storage.sync.get("autoSendMerc", (settings) => {
          if (settings.autoSendMerc) {
            chrome.storage.sync.set({
              autoSendMerc: {
                ...settings.autoSendMerc,
                enabled: false,
                disabledReason: "insufficient_credits"
              }
            });
          }
        });
        chrome.storage.local.set({
          expeditionLaunchError: {
            error: "Insufficient credits to open reward container. Auto-send disabled.",
            retryAfter: 0,
            timestamp: Date.now(),
            noRetry: true
          }
        });
        setAutoSendInProgress(false);
        _automationFinish("auto-send");
        setAutoSendExpeditionId(null);
      }
      if (event.data && event.data.type === "COR3_WS_COLLECTED_ALL") {
        setAutoSendCollectRetries(0);
        const collectedId = event.data.data && event.data.data.id;
        if (collectedId) {
          chrome.storage.local.get("expeditionsData", (result) => {
            const exps2 = result.expeditionsData || [];
            const filtered = exps2.filter((e) => e.id !== collectedId);
            chrome.storage.local.set({ expeditionsData: filtered, expeditionsDataUpdatedAt: now });
          });
        }
        if (autoSendInProgress && autoSendExpeditionId) {
          console.log("[COR3 Helper] Auto-send: All collected, refreshing mercenaries (CORE + USOL)...");
          setAutoSendExpeditionId(null);
          setTimeout(() => {
            window.postMessage({ type: "COR3_REQUEST_STASH" }, "*");
          }, 500);
          var mercDelay = 2500 + Math.floor(Math.random() * 1e3);
          setTimeout(() => {
            if (!autoSendInProgress || getAutomationActive() && getAutomationActive().type !== "auto-send") {
              console.log("[COR3 Helper] Auto-send: merc refresh skipped (no longer active or another automation took over)");
              return;
            }
            window.postMessage({ type: "COR3_REQUEST_MERCENARIES" }, "*");
          }, mercDelay);
          setAutoSendAwaitingMercenaries(false);
          setAutoSendAwaitingUsolMercs(true);
        }
      }
      if (event.data && event.data.type === "COR3_WS_MERC_NOT_AVAILABLE") {
        setAutoSendMercRetryCount(_autoSendMercRetryCount + 1);
        if (_autoSendMercRetryCount <= MAX_MERC_RETRIES) {
          console.log("[COR3 Helper] Auto-send: Mercenary not available \u2014 retry " + _autoSendMercRetryCount + "/" + MAX_MERC_RETRIES + ", refreshing merc data...");
          setAutoSendExpeditionBlocked(false);
          chrome.storage.local.remove("autoSendExpeditionBlocked");
          setAutoSendInProgress(true);
          if (!getAutomationActive()) setAutomationActive({ type: "auto-send", startedAt: Date.now() });
          _broadcastQueueStatus();
          setAutoSendAwaitingMercenaries(false);
          setAutoSendAwaitingUsolMercs(true);
          setTimeout(() => {
            if (!autoSendInProgress) return;
            window.postMessage({ type: "COR3_REQUEST_MERCENARIES" }, "*");
          }, 2e3 + Math.floor(Math.random() * 1e3));
        } else {
          console.log("[COR3 Helper] Auto-send: Mercenary not available after " + MAX_MERC_RETRIES + " retries \u2014 aborting");
          chrome.storage.local.set({ mercWarning: "Mercenary not available after " + MAX_MERC_RETRIES + " retries. Merc data may be stale." });
          setAutoSendMercRetryCount(0);
          setAutoSendInProgress(false);
          _automationFinish("auto-send");
        }
      }
      if (event.data && event.data.type === "COR3_WS_EXPEDITION_LAUNCHED") {
        console.log("[COR3 Helper] Expedition launched successfully");
        setAutoSendMercRetryCount(0);
      }
      if (event.data && event.data.type === "COR3_WS_EXPEDITION_LAUNCH_ERROR") {
        console.log("[COR3 Helper] Expedition launch error:", event.data.error);
        if (event.data.error === "Maximum 1 active expedition allowed") {
          console.log("[COR3 Helper] Active expedition detected \u2014 blocking auto-send until it completes");
          setAutoSendExpeditionBlocked(true);
          chrome.storage.local.set({ autoSendExpeditionBlocked: true });
          setAutoSendInProgress(false);
          _automationFinish("auto-send");
          setAutoSendExpeditionId(null);
        } else {
          chrome.storage.local.set({
            expeditionLaunchError: {
              error: event.data.error,
              retryAfter: event.data.retryAfter,
              timestamp: Date.now()
            }
          });
          chrome.storage.local.remove("expeditionLaunched");
        }
      }
      if (event.data && event.data.type === "COR3_WS_EXPEDITION_ELITE_REQUIRED") {
        console.log("[COR3 Helper] Elite merc required \u2014 retrying with default location");
        chrome.storage.local.get("lastExpeditionLaunchData", (result) => {
          const launch = result.lastExpeditionLaunchData;
          if (!launch) return;
          const isUsol = launch.marketId === "019e4065-6ae8-760d-8724-58ab4f2cf7d7";
          const configKey = isUsol ? "usolExpeditionConfigData" : "expeditionConfigData";
          chrome.storage.local.get(configKey, (cfgResult) => {
            const cfg = cfgResult[configKey];
            if (!cfg || !cfg.locations || cfg.locations.length === 0) return;
            const DEFAULT_LOC_NAMES = ["Skylift Remains", "Koute Mining and Reprocessing Outpost"];
            const loc = cfg.locations.find((l) => DEFAULT_LOC_NAMES.includes(l.name)) || cfg.locations[0];
            const zone = loc.zones && loc.zones[0] ? loc.zones[0] : null;
            const goal = zone && zone.goals && zone.goals[0] ? zone.goals[0] : null;
            if (!zone || !goal) return;
            if (loc.id === launch.locationConfigId) {
              console.log("[COR3 Helper] Already using default location \u2014 no alternative available");
              return;
            }
            const retryConfig = { ...launch, locationConfigId: loc.id, zoneConfigId: zone.id, goalId: goal.id };
            chrome.storage.local.set({ lastExpeditionLaunchData: retryConfig });
            console.log("[COR3 Helper] Retrying expedition with location:", loc.name || loc.id);
            setTimeout(() => {
              window.postMessage({ type: "COR3_LAUNCH_EXPEDITION", config: retryConfig }, "*");
            }, 2e3 + Math.floor(Math.random() * 1e3));
          });
        });
      }
      if (event.data && event.data.type === "COR3_WS_EXPEDITION_RETRY_LAUNCH") {
        console.log("[COR3 Helper] Retrying expedition launch");
        chrome.storage.local.get("lastExpeditionLaunchData", (result) => {
          if (result.lastExpeditionLaunchData) {
            window.postMessage({
              type: "COR3_RELAUNCH_EXPEDITION",
              data: result.lastExpeditionLaunchData
            }, "*");
          }
        });
      }
      if (event.data && event.data.type === "COR3_DAILY_HACK_LOG") {
        chrome.storage.local.set({
          dailyHackLog: event.data.message,
          dailyHackLogUpdatedAt: Date.now()
        });
      }
      if (event.data && event.data.type === "COR3_DAILY_HACK_DISABLE_TOGGLE") {
        chrome.storage.sync.set({ autoDailyHackEnabled: false });
      }
      if (event.data && event.data.type === "COR3_FETCH_DAILY_OPS") {
        console.log("[COR3 Helper] Requesting daily ops data");
        chrome.storage.local.get("bearerToken", (result) => {
          const token = result.bearerToken;
          if (!token) return;
          fetch("https://svc-corie.cor3.gg/api/user-daily-claim", {
            headers: { "Authorization": token }
          }).then((r) => {
            if (r.ok) return r.json();
            if (r.status === 400 || r.status === 401 || r.status === 403) {
              chrome.storage.local.set({ dailyOpsError: "token_expired", dailyOpsErrorUpdatedAt: Date.now() });
              return null;
            }
            return null;
          }).then((data) => {
            if (data) {
              chrome.storage.local.set({ dailyOpsData: data, dailyOpsUpdatedAt: Date.now(), dailyOpsError: null });
              fetchDailyRewards(token);
            }
          }).catch(() => {
          });
        });
      }
    });
  }

  // src/content/message-listener.js
  init_helpers();
  init_auto_update_markets();
  function fetchDailyRewards2(token) {
    fetch("https://svc-corie.cor3.gg/api/user-daily-claim/rewards", {
      headers: { "Authorization": token }
    }).then((r) => r.ok ? r.json() : null).then((data) => {
      if (data && Array.isArray(data)) {
        chrome.storage.local.set({ dailyRewardsData: data });
      }
    }).catch(() => {
    });
  }
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "updateAlarms") {
        setAlarms(request.alarms || []);
        resetAlarmTriggered();
        sendResponse({ success: true });
      } else if (request.action === "testAlarm") {
        const vol = request.volume !== void 0 ? request.volume : 50;
        if (request.continuous) {
          startContinuousAlarm(vol);
        } else {
          playAlarm(vol);
        }
        sendResponse({ success: true });
      } else if (request.action === "stopAlarm") {
        stopAlarm();
        sendResponse({ success: true });
      } else if (request.action === "requestExpeditions") {
        window.postMessage({ type: "COR3_REQUEST_EXPEDITIONS" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestNetworkMap") {
        window.postMessage({ type: "COR3_REQUEST_NETWORK_MAP" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "devTcTestReachability") {
        window.postMessage({ type: "COR3_DEV_TC_TEST_REACHABILITY", serverId: request.serverId }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestStash") {
        window.postMessage({ type: "COR3_REQUEST_STASH" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestSpecialists") {
        window.postMessage({ type: "COR3_REQUEST_SPECIALISTS" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "purchaseSpecialist") {
        window.postMessage({ type: "COR3_PURCHASE_SPECIALIST", specialistType: request.specialistType, kind: request.kind, level: request.level, priceId: request.priceId }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestLoadout") {
        window.postMessage({ type: "COR3_REQUEST_LOADOUT" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "equipHardware") {
        window.postMessage({ type: "COR3_EQUIP_HARDWARE", moduleConfigId: request.moduleConfigId }, "*");
        sendResponse({ success: true });
      } else if (request.action === "equipSoftware") {
        window.postMessage({ type: "COR3_EQUIP_SOFTWARE", moduleConfigId: request.moduleConfigId }, "*");
        sendResponse({ success: true });
      } else if (request.action === "unequipSoftware") {
        window.postMessage({ type: "COR3_UNEQUIP_SOFTWARE", moduleConfigId: request.moduleConfigId }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestMarket") {
        window.postMessage({ type: "COR3_REQUEST_MARKET" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "refreshMarket") {
        setMarketRefreshInProgress(true);
        setAutoUpdateMarketsLastRefresh(Date.now());
        setTimeout(() => {
          setMarketRefreshInProgress(false);
        }, 1e4);
        window.postMessage({ type: "COR3_REFRESH_MARKET" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestDarkMarket") {
        window.postMessage({ type: "COR3_REQUEST_DARK_MARKET" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "refreshDarkMarket") {
        setMarketRefreshInProgress(true);
        setAutoUpdateMarketsLastRefresh(Date.now());
        setTimeout(() => {
          setMarketRefreshInProgress(false);
        }, 1e4);
        window.postMessage({ type: "COR3_REFRESH_DARK_MARKET" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestSoyuzMarket") {
        window.postMessage({ type: "COR3_REQUEST_SOYUZ_MARKET" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "refreshSoyuzMarket") {
        setMarketRefreshInProgress(true);
        setAutoUpdateMarketsLastRefresh(Date.now());
        setTimeout(() => {
          setMarketRefreshInProgress(false);
        }, 1e4);
        window.postMessage({ type: "COR3_REFRESH_SOYUZ_MARKET" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestUsolMarket") {
        window.postMessage({ type: "COR3_REQUEST_USOL_MARKET" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "refreshUsolMarket") {
        setMarketRefreshInProgress(true);
        setAutoUpdateMarketsLastRefresh(Date.now());
        setTimeout(() => {
          setMarketRefreshInProgress(false);
        }, 1e4);
        window.postMessage({ type: "COR3_REFRESH_USOL_MARKET" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "refreshAllMarketsSeq") {
        setMarketRefreshInProgress(true);
        setAutoUpdateMarketsLastRefresh(Date.now());
        var msg = { type: "COR3_REFRESH_ALL_MARKETS_SEQ" };
        if (request.skipLots) msg.skipLots = true;
        if (request.order) msg.order = request.order;
        window.postMessage(msg, "*");
        sendResponse({ success: true });
      } else if (request.action === "leaveStash") {
        window.postMessage({ type: "COR3_LEAVE_STASH" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "sellItem") {
        window.postMessage({ type: "COR3_SELL_ITEM", itemId: request.itemId, quantity: request.quantity || 1 }, "*");
        sendResponse({ success: true });
      } else if (request.action === "keepWorkerAlive") {
        window.postMessage({ type: "COR3_KEEP_ALIVE" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "updateAutoRefresh") {
        if (request.autoRefresh) {
          setAutoRefreshSettings(request.autoRefresh);
        }
        sendResponse({ success: true });
      } else if (request.action === "toggleDecryptSolver") {
        if (request.enabled) {
          ensureAntiAfkEnabled();
          injectDecryptSolver();
        } else {
          stopDecryptSolver();
        }
        sendResponse({ success: true });
      } else if (request.action === "toggleIceWallSolver") {
        if (request.enabled) {
          ensureAntiAfkEnabled();
          injectIceWallSolver();
        } else {
          stopIceWallSolver();
        }
        sendResponse({ success: true });
      } else if (request.action === "toggleSimpleDecryptSolver") {
        if (request.enabled) {
          ensureAntiAfkEnabled();
          injectSimpleDecryptSolver();
        } else {
          stopSimpleDecryptSolver();
        }
        sendResponse({ success: true });
      } else if (request.action === "toggleDailyHackSolver") {
        if (request.enabled) {
          chrome.storage.local.get("bearerToken", (result2) => {
            const token = result2.bearerToken;
            if (!token) {
              ensureAntiAfkEnabled();
              injectDailyHackSolver();
              return;
            }
            fetch("https://svc-corie.cor3.gg/api/user-daily-claim", { headers: { "Authorization": token } }).then((r) => r.ok ? r.json() : null).then((data) => {
              if (data) {
                chrome.storage.local.set({ dailyOpsData: data, dailyOpsUpdatedAt: Date.now() });
                fetchDailyRewards2(token);
              }
              if (data && data.hasClaimedToday) {
                console.log("[COR3 Helper] Daily already claimed \u2014 skipping solver");
                chrome.storage.sync.set({ autoDailyHackEnabled: false });
                chrome.storage.local.set({ dailyHackLog: "Daily already claimed today \u2014 skipping automation.", dailyHackLogUpdatedAt: Date.now() });
                return;
              }
              ensureAntiAfkEnabled();
              injectDailyHackSolver();
            }).catch(() => {
              ensureAntiAfkEnabled();
              injectDailyHackSolver();
            });
          });
        } else {
          stopDailyHackSolver();
        }
        sendResponse({ success: true });
      } else if (request.action === "respondDecision") {
        window.postMessage({
          type: "COR3_RESPOND_DECISION",
          expeditionId: request.expeditionId,
          messageId: request.messageId,
          selectedOption: request.selectedOption
        }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestArchivedExpeditions") {
        window.postMessage({ type: "COR3_REQUEST_ARCHIVED_EXPEDITIONS" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestMercenaries") {
        window.postMessage({ type: "COR3_REQUEST_MERCENARIES" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestUsolMercenaries") {
        window.postMessage({ type: "COR3_REQUEST_USOL_MERCENARIES" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "requestExpeditionConfig") {
        window.postMessage({ type: "COR3_REQUEST_EXPEDITION_CONFIG", mercenaryId: request.mercenaryId }, "*");
        sendResponse({ success: true });
      } else if (request.action === "launchExpedition") {
        chrome.storage.local.set({ lastExpeditionLaunchData: request.config });
        window.postMessage({ type: "COR3_LAUNCH_EXPEDITION", config: request.config }, "*");
        sendResponse({ success: true });
      } else if (request.action === "openContainer") {
        window.postMessage({ type: "COR3_OPEN_CONTAINER", expeditionId: request.expeditionId }, "*");
        sendResponse({ success: true });
      } else if (request.action === "collectAll") {
        window.postMessage({ type: "COR3_COLLECT_ALL", expeditionId: request.expeditionId }, "*");
        sendResponse({ success: true });
      } else if (request.action === "fetchDailyOps") {
        chrome.storage.local.get("bearerToken", (result2) => {
          const token = result2.bearerToken;
          if (!token) {
            sendResponse({ error: "no token" });
            return;
          }
          fetch("https://svc-corie.cor3.gg/api/user-daily-claim", {
            headers: { "Authorization": token }
          }).then((r) => {
            if (r.ok) return r.json();
            if (r.status === 400 || r.status === 401 || r.status === 403) return r.json().then((d) => {
              throw new Error(d.message || "token_expired");
            }).catch(() => {
              throw new Error("token_expired");
            });
            return null;
          }).then((data) => {
            if (data) {
              chrome.storage.local.set({ dailyOpsData: data, dailyOpsUpdatedAt: Date.now() });
              fetchDailyRewards2(token);
            }
            sendResponse({ data });
          }).catch((e) => {
            cor3LogError("content.js", e, { action: "fetchDailyOps" });
            sendResponse({ error: e.message || "fetch failed" });
          });
        });
        return true;
      } else if (request.action === "disableBackground") {
        chrome.storage.sync.set({ disableBackground: true });
        deleteBackgroundElements();
        console.log("[COR3 Helper] Background elements deleted");
        sendResponse({ success: true });
      } else if (request.action === "enableBackground") {
        chrome.storage.sync.set({ disableBackground: false });
        console.log("[COR3 Helper] Background elements will be restored on page reload");
        sendResponse({ success: true });
      } else if (request.action === "disableNetworkFog") {
        chrome.storage.sync.set({ disableNetworkFog: true });
        startNetworkFogObserver();
        hideNetworkFogVideos();
        console.log("[COR3 Helper] Network fog disabled");
        sendResponse({ success: true });
      } else if (request.action === "enableNetworkFog") {
        chrome.storage.sync.set({ disableNetworkFog: false });
        stopNetworkFogObserver();
        showNetworkFogVideos();
        console.log("[COR3 Helper] Network fog re-enabled");
        sendResponse({ success: true });
      } else if (request.action === "moveNotificationsLeft") {
        chrome.storage.sync.set({ moveNotificationsLeft: true });
        applyNotificationsLeft();
        console.log("[COR3 Helper] Notifications moved to left");
        sendResponse({ success: true });
      } else if (request.action === "moveNotificationsRight") {
        chrome.storage.sync.set({ moveNotificationsLeft: false });
        removeNotificationsLeft();
        console.log("[COR3 Helper] Notifications moved back to right");
        sendResponse({ success: true });
      } else if (request.action === "getVersionFallbacks") {
        sendResponse({
          webVersion: window.__cor3WebVersion,
          systemVersion: window.__cor3SystemVersion,
          patchVersion: window.__cor3PatchVersion
        });
      } else if (request.action === "startAutoJobs") {
        ensureAntiAfkEnabled();
        const jobs = request.jobs;
        const settings = request.settings || {};
        const result2 = _automationEnqueue("auto-jobs", () => {
          setAutoJobsActive(true);
          injectAutoJobSolver();
          setTimeout(() => {
            chrome.storage.local.get("autoJobsLockedJobs", (lockData) => {
              var lockedJobs = lockData.autoJobsLockedJobs;
              if (lockedJobs && lockedJobs.length > 0) {
                var now = Date.now();
                var stillLocked = lockedJobs.filter((j) => j.lockExpiresAt && new Date(j.lockExpiresAt).getTime() > now);
                var expired = lockedJobs.length - stillLocked.length;
                settings.lockedJobs = stillLocked;
                chrome.storage.local.set({ autoJobsLockedJobs: stillLocked });
                if (expired > 0) console.log("[COR3 Helper] Pruned " + expired + " expired lock(s) from autoJobsLockedJobs");
                if (stillLocked.length > 0) console.log("[COR3 Helper] Passing " + stillLocked.length + " locked job(s) to solver");
              }
              window.postMessage({ type: "COR3_AUTOJOB_START", jobs, settings }, "*");
            });
          }, 500);
        });
        sendResponse({ success: true, queueResult: result2, queueStatus: Promise.resolve().then(() => (init_helpers(), helpers_exports)).then((m) => m._automationQueueStatus()) });
      } else if (request.action === "stopAutoJobs") {
        setAutoJobsActive(false);
        setAutomationQueue(getAutomationQueue().filter((q) => q.type !== "auto-jobs"));
        window.postMessage({ type: "COR3_AUTOJOB_STOP" }, "*");
        _automationFinish("auto-jobs");
        sendResponse({ success: true });
      } else if (request.action === "enableHackSolvers") {
        ensureAntiAfkEnabled();
        injectDecryptSolver();
        injectIceWallSolver();
        injectSimpleDecryptSolver();
        sendResponse({ success: true });
      } else if (request.action === "dismissFailedJobs") {
        var dismissJobs = request.jobs || [];
        var dismissMarketKey = request.marketKey || "";
        var dismissStorageKey = { home: "marketData", dark: "darkMarketData", soyuz: "soyuzMarketData", usol: "usolMarketData" }[dismissMarketKey] || "";
        var dismissRefreshType = { home: "COR3_REFRESH_MARKET", dark: "COR3_REFRESH_DARK_MARKET", soyuz: "COR3_REFRESH_SOYUZ_MARKET", usol: "COR3_REFRESH_USOL_MARKET" }[dismissMarketKey] || "";
        var result = _automationEnqueue("clear-failed-jobs", function() {
          (async function() {
            try {
              for (var i = 0; i < dismissJobs.length; i++) {
                window.postMessage({ type: "COR3_AUTOJOB_CMD", cmd: "job.dismiss", data: dismissJobs[i] }, "*");
                if (dismissStorageKey) {
                  var fresh = await chrome.storage.local.get(dismissStorageKey);
                  var freshMd = fresh[dismissStorageKey];
                  if (freshMd && freshMd.recentJobs) {
                    freshMd.recentJobs = freshMd.recentJobs.filter(function(j) {
                      return j.id !== dismissJobs[i].jobId;
                    });
                    await chrome.storage.local.set({ [dismissStorageKey]: freshMd });
                  }
                }
                await new Promise(function(r) {
                  setTimeout(r, 500);
                });
              }
              await new Promise(function(r) {
                setTimeout(r, 2e3);
              });
              if (dismissRefreshType) {
                setMarketRefreshInProgress(true);
                setAutoUpdateMarketsLastRefresh(Date.now());
                setTimeout(function() {
                  setMarketRefreshInProgress(false);
                }, 1e4);
                window.postMessage({ type: dismissRefreshType }, "*");
              }
            } catch (e) {
              console.log("[COR3 Helper] dismissFailedJobs error:", e);
            } finally {
              _automationFinish("clear-failed-jobs");
            }
          })();
        });
        sendResponse({ success: true, queueResult: result });
      } else if (request.action === "devtoolsSendWs") {
        window.postMessage({ type: "COR3_DEVTOOLS_WS_SEND", message: request.message }, "*");
        sendResponse({ success: true });
      } else if (request.action === "startValuableSearch") {
        ensureAntiAfkEnabled();
        const result2 = _automationEnqueue("auto-valuable", () => {
          injectAutoValuableSeller();
          setTimeout(() => {
            window.postMessage({ type: "COR3_VALUABLE_START_SEARCH" }, "*");
          }, 500);
        });
        sendResponse({ success: true, queueResult: result2 });
      } else if (request.action === "startValuableSeller") {
        ensureAntiAfkEnabled();
        const selServers = request.selectedServers || [];
        const selDownloads = request.selectedDownloads || [];
        const result2 = _automationEnqueue("auto-valuable", () => {
          injectAutoValuableSeller();
          setTimeout(() => {
            window.postMessage({
              type: "COR3_VALUABLE_START_SELLER",
              selectedServers: selServers,
              selectedDownloads: selDownloads
            }, "*");
          }, 500);
        });
        sendResponse({ success: true, queueResult: result2 });
      } else if (request.action === "stopValuable") {
        setAutomationQueue(getAutomationQueue().filter((q) => q.type !== "auto-valuable"));
        window.postMessage({ type: "COR3_VALUABLE_STOP" }, "*");
        _automationFinish("auto-valuable");
        sendResponse({ success: true });
      } else if (request.action === "forceMaintenanceBatch") {
        injectAutoValuableSeller();
        setTimeout(() => {
          window.postMessage({
            type: "COR3_VALUABLE_FORCE_MAINTENANCE_BATCH",
            servers: request.servers
          }, "*");
        }, 500);
        sendResponse({ success: true });
      } else if (request.action === "startIpSearch") {
        window.postMessage({ type: "COR3_IP_SEARCH_START" }, "*");
        sendResponse({ success: true });
      } else if (request.action === "fetchDailyOps") {
        window.postMessage({ type: "COR3_FETCH_DAILY_OPS" }, "*");
        sendResponse({ success: true });
      }
    });
  }

  // src/content/engine-relay.js
  init_helpers();
  init_auto_update_markets();
  init_auto_send();
  function setupEngineRelay() {
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (!isContextValid()) return;
      if (event.data && event.data.type === "COR3_AUTOJOB_ENABLE_DECRYPT_SOLVER") {
        chrome.storage.sync.get("autoDecryptEnabled", (result) => {
          if (!result.autoDecryptEnabled) {
            chrome.storage.sync.set({ autoDecryptEnabled: true });
            console.log("[COR3 Helper] Auto Job: Enabling decrypt solver for minigame");
          }
          injectDecryptSolver();
        });
      }
      if (event.data && event.data.type === "COR3_ICE_WALL_STATUS") {
        chrome.storage.local.set({
          iceWallSolverStatus: {
            message: event.data.message,
            level: event.data.level || "info",
            timestamp: Date.now()
          }
        });
      }
      if (event.data && event.data.type === "COR3_SIMPLE_DECRYPT_STATUS") {
        chrome.storage.local.set({
          simpleDecryptSolverStatus: {
            message: event.data.message,
            level: event.data.level || "info",
            timestamp: Date.now()
          }
        });
      }
      if (event.data && event.data.type === "COR3_AUTOJOB_ENABLE_SIMPLE_DECRYPT_SOLVER") {
        chrome.storage.sync.get("autoSimpleDecryptEnabled", (result) => {
          if (!result.autoSimpleDecryptEnabled) {
            chrome.storage.sync.set({ autoSimpleDecryptEnabled: true });
            console.log("[COR3 Helper] Auto Job: Enabling Simple Decrypt solver for minigame");
          }
          injectSimpleDecryptSolver();
        });
      }
      if (event.data && event.data.type === "COR3_AUTOJOB_ENABLE_ICE_WALL_SOLVER") {
        chrome.storage.sync.get("autoIceWallEnabled", (result) => {
          if (!result.autoIceWallEnabled) {
            chrome.storage.sync.set({ autoIceWallEnabled: true });
            console.log("[COR3 Helper] Auto Job: Enabling ICE Wall solver for minigame");
          }
          injectIceWallSolver();
        });
      }
      if (event.data && event.data.type === "COR3_AUTOJOB_LOG") {
        queueAutoJobLog(event.data.msg, event.data.level);
      }
      if (event.data && event.data.type === "COR3_WS_NETWORK_MAP") {
        chrome.storage.local.set({ serverMaintenanceMap: event.data.servers });
      }
      if (event.data && event.data.type === "COR3_DEV_TC_REACH_PROGRESS") {
        chrome.storage.local.set({ _devTcReachProgress: { log: event.data.log || [] } });
      }
      if (event.data && event.data.type === "COR3_DEV_TC_REACH_RESULT") {
        chrome.storage.local.set({ _devTcReachResult: { reachable: event.data.reachable, reason: event.data.reason || null, log: event.data.log || [] } });
      }
      if (event.data && event.data.type === "COR3_IP_SEARCH_LOG") {
        if (isContextValid()) {
          try {
            chrome.storage.local.set({ secretFinderLog: event.data.html });
          } catch (e) {
          }
        }
      }
      if (event.data && event.data.type === "COR3_IP_SEARCH_DONE") {
        if (isContextValid()) {
          try {
            chrome.storage.local.set({ secretFinderLog: event.data.html });
            chrome.storage.sync.set({ secretFinderEnabled: false });
          } catch (e) {
          }
        }
      }
      if (event.data && event.data.type === "COR3_AUTOJOB_TRACKER_UPDATE") {
        chrome.storage.local.set({ autoJobsTracker: event.data.tracker });
      }
      if (event.data && event.data.type === "COR3_AUTOJOB_DONE") {
        setAutoJobsActive(false);
        chrome.storage.local.set({ autoJobsRunning: false });
        _automationFinish("auto-jobs");
      }
      if (event.data && event.data.type === "COR3_AUTOJOB_ICE_WALL_RELOAD") {
        var lockedJob = event.data.lockedJob;
        console.log("[COR3 Helper] ICE Wall stuck \u2014 saving locked job and reloading page");
        chrome.storage.local.get("autoJobsLockedJobs", (prev) => {
          var lockedList = prev.autoJobsLockedJobs || [];
          if (lockedJob && lockedJob.jobId) {
            lockedList = lockedList.filter((j) => j.jobId !== lockedJob.jobId);
            lockedList.push(lockedJob);
          }
          chrome.storage.local.set({ autoJobsLockedJobs: lockedList }, () => {
            window.location.reload();
          });
        });
      }
      if (event.data && event.data.type === "COR3_ALL_MARKETS_REFRESHED") {
        setMarketRefreshInProgress(false);
        chrome.storage.local.set({ _allMarketsRefreshed: Date.now() });
      }
      if (event.data && event.data.type === "COR3_TOKEN_EXPIRED") {
        setMarketRefreshInProgress(false);
        Promise.resolve().then(() => (init_auto_update_markets(), auto_update_markets_exports)).then((m) => m.setSeqRefreshRunning(false));
        setInitialFetchDone(false);
        chrome.storage.local.remove("initialFetchDoneAt");
        if (autoSendInProgress) {
          console.log("[COR3 Helper] Token expired \u2014 aborting in-progress auto-send");
          setAutoSendInProgress(false);
          setAutoSendExpeditionId(null);
          setAutoSendAwaitingMercenaries(false);
          setAutoSendAwaitingUsolMercs(false);
          setAutoSendDeferredWaiting(false);
          setAutoSendUsolSkipped(false);
          setAutoSendMercRetryCount(0);
          _automationFinish("auto-send");
        }
        console.log("[COR3 Helper] Token expired \u2014 cleared market refresh flags, gating automations until initial fetch done");
      }
      if (event.data && event.data.type === "COR3_INITIAL_FETCH_DONE") {
        setInitialFetchDone(true);
        chrome.storage.local.set({ initialFetchDoneAt: Date.now() });
        console.log("[COR3 Helper] Initial fetch done \u2014 automations unblocked");
        chrome.storage.local.get("expeditionsData", (result) => {
          if (result.expeditionsData) {
            checkAutoSendOnExpeditionData(result.expeditionsData);
          }
        });
      }
      if (event.data && event.data.type === "COR3_AUTOJOB_SAVE_COMPLETED") {
        chrome.storage.local.get("autoJobsCompletedResults", (result) => {
          const existing = result.autoJobsCompletedResults || [];
          const incoming = event.data.jobs || [];
          const merged = [...existing];
          for (const job of incoming) {
            const idx = merged.findIndex((j) => j.jobId === job.jobId);
            if (idx >= 0) merged[idx] = job;
            else merged.push(job);
          }
          chrome.storage.local.set({ autoJobsCompletedResults: merged });
        });
      }
      if (event.data && event.data.type === "COR3_VALUABLE_LOG") {
        queueValuableLog(event.data.msg, event.data.level);
      }
      if (event.data && event.data.type === "COR3_VALUABLE_SERVERS_UPDATE") {
        chrome.storage.local.set({ valuableServersData: event.data.data });
      }
      if (event.data && event.data.type === "COR3_VALUABLE_DOWNLOADS_UPDATE") {
        chrome.storage.local.set({ valuableDownloadsData: event.data.data });
      }
      if (event.data && event.data.type === "COR3_VALUABLE_MAINTENANCE_UPDATE") {
        chrome.storage.local.set({ valuableMaintenanceData: event.data.data });
      }
      if (event.data && event.data.type === "COR3_VALUABLE_FORCE_MAINT_BATCH_PROGRESS") {
        chrome.storage.local.get("forceMaintenanceInProgress", function(res) {
          var fm = res.forceMaintenanceInProgress;
          if (fm && fm.batch) {
            fm.currentServerId = event.data.currentServerId;
            fm.serverIds = event.data.serverIds;
            chrome.storage.local.set({ forceMaintenanceInProgress: fm });
          }
        });
      }
      if (event.data && event.data.type === "COR3_VALUABLE_FORCE_MAINT_SERVER_DONE") {
        chrome.storage.local.set({ valuableForceMaintenanceServerDone: { serverId: event.data.serverId, serverName: event.data.serverName, ts: Date.now() } });
        chrome.storage.local.get("valuableMaintenanceData", function(res) {
          var mData = res.valuableMaintenanceData;
          if (mData && mData.servers) {
            for (var si = 0; si < mData.servers.length; si++) {
              if (mData.servers[si].id === event.data.serverId) {
                mData.servers[si].maintenanceEndsAt = mData.servers[si].maintenanceEndsAt || new Date(Date.now() + 36e5).toISOString();
                mData.servers[si].timeUntilMaintenance = null;
                break;
              }
            }
            chrome.storage.local.set({ valuableMaintenanceData: mData });
          }
        });
      }
      if (event.data && event.data.type === "COR3_VALUABLE_FORCE_MAINT_DONE") {
        var fmDoneData = { done: true };
        if (event.data.error) {
          fmDoneData.error = event.data.error;
          fmDoneData.blockerName = event.data.blockerName || null;
          fmDoneData.remainingMs = event.data.remainingMs || null;
          fmDoneData.targetServer = event.data.targetServer || null;
        }
        chrome.storage.local.set({ valuableForceMaintenanceDone: fmDoneData });
        chrome.storage.local.remove("forceMaintenanceInProgress");
      }
      if (event.data && event.data.type === "COR3_VALUABLE_DONE") {
        chrome.storage.local.set({ valuableSearchRunning: false, valuableSellerRunning: false });
        _automationFinish("auto-valuable");
      }
    });
  }

  // src/content/index.js
  init_auto_send();
  setupWsRelay();
  setupMessageListener();
  setupEngineRelay();
  setTimeout(() => {
    chrome.storage.local.get("expeditionsData", (result) => {
      if (result.expeditionsData) {
        console.log("[COR3 Helper] Page load: checking cached expedition data for auto-send");
        checkAutoSendOnExpeditionData(result.expeditionsData);
      }
    });
  }, 5e3);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.autoSendMerc) return;
    const newVal = changes.autoSendMerc.newValue;
    if (newVal && newVal.enabled) {
      console.log("[COR3 Helper] Auto-send mercenary enabled \u2014 checking expedition data");
      chrome.storage.local.get("expeditionsData", (result) => {
        if (result.expeditionsData) {
          checkAutoSendOnExpeditionData(result.expeditionsData);
        }
      });
    }
  });
  window.addEventListener("error", (e) => {
    if (typeof cor3LogEntry === "function") {
      cor3LogEntry("error-logs", (e.filename || "") + ":" + (e.lineno || 0) + " " + (e.message || ""), "error");
    }
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (typeof cor3LogEntry === "function") {
      var msg = e.reason ? e.reason.stack || e.reason.message || String(e.reason) : "Unhandled rejection";
      cor3LogEntry("error-logs", msg, "error");
    }
  });
  chrome.storage.local.remove("initialFetchDoneAt");
  chrome.storage.local.get("autoJobsRunning", (data) => {
    if (data.autoJobsRunning) {
      console.log("[COR3 Helper] Page reloaded \u2014 clearing stale auto-jobs state");
      chrome.storage.local.set({ autoJobsRunning: false, autoJobsQueue: [] });
    }
  });
})();
