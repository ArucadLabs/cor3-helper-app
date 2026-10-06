(() => {
  // src/content-early/state.js
  var OrigWebSocket = window.WebSocket;
  var trackedSockets = [];
  var socketLastActivity = /* @__PURE__ */ new Map();
  var _activeSocket = null;
  function getActiveSocket() {
    return _activeSocket;
  }
  function setActiveSocket(ws) {
    _activeSocket = ws;
  }
  var _capturedBearerToken = null;
  function getCapturedBearerToken() {
    return _capturedBearerToken;
  }
  function setCapturedBearerToken(token) {
    _capturedBearerToken = token;
  }
  var pendingRetryOps = [];
  var tokenExpiredFlag = false;
  function setTokenExpiredFlag(val) {
    tokenExpiredFlag = val;
  }
  function setPendingRetryOps(val) {
    pendingRetryOps = val;
  }
  var _marketRefreshAbortId = 0;
  function getMarketRefreshAbortId() {
    return _marketRefreshAbortId;
  }
  function bumpMarketRefreshAbortId() {
    return ++_marketRefreshAbortId;
  }
  var HOME_MARKET_ID = "019d3ea4-85bd-7389-904d-8f7c85841134";
  var DARK_MARKET_ID = "019d3ea4-85bd-7389-904d-908ba9194aa0";
  var DARK_SERVER_ID = "019d29c5-4b37-79bf-b23e-304d8ea03c15";
  var SOYUZ_MARKET_ID = "019da731-2db5-7d76-9447-1ea3b9b78001";
  var SOYUZ_SERVER_ID = "019da6f1-16f7-75a6-b6d3-0b1d5f92a108";
  var USOL_MARKET_ID = "019e4065-6ae8-760d-8724-58ab4f2cf7d7";
  var USOL_SERVER_ID = "019e4052-c317-7388-9d71-883ffb1560cd";
  window.__cor3UnreachableMarkets = {};
  window.__cor3IsMarketUnreachable = function(marketType) {
    var entry = window.__cor3UnreachableMarkets[marketType];
    if (!entry) return null;
    if (entry.maintenanceEndsAt) {
      var endsAt = new Date(entry.maintenanceEndsAt).getTime();
      if (Date.now() >= endsAt) {
        delete window.__cor3UnreachableMarkets[marketType];
        return null;
      }
    }
    return entry;
  };
  window.__cor3InitialFetchInProgress = false;

  // src/content-early/ws-proxy.js
  function decodeBinaryMsg(raw, cb) {
    var codec = window.__cor3MsgpackCodec;
    if (!codec) {
      cb(null);
      return;
    }
    if (raw instanceof Blob) {
      raw.arrayBuffer().then(function(buf) {
        try {
          var pkt2 = codec.decode(new Uint8Array(buf));
          cb(codec.packetToString(pkt2));
        } catch (e) {
          cb(null);
        }
      }).catch(function() {
        cb(null);
      });
      return;
    }
    try {
      var u8 = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw;
      var pkt = codec.decode(u8);
      cb(codec.packetToString(pkt));
    } catch (e) {
      cb(null);
    }
  }
  function installWebSocketProxy(handleWsMessage2) {
    const WebSocketProxy = new Proxy(OrigWebSocket, {
      construct(target, args) {
        const ws = new target(...args);
        const url = args[0] || "";
        var isMinigameSocket = url.includes("ice-wall-break") || url.includes("minigame") || url.includes("hack") || url.includes("games");
        ws.__cor3IsMinigame = isMinigameSocket;
        if (url.includes("cor3") || url.includes("corie")) {
          console.log("[COR3 Helper] Tracking WebSocket:", url, isMinigameSocket ? "(minigame \u2014 excluded from active tracking)" : "");
          ws.__cor3Url = url;
          if (!isMinigameSocket) {
            trackedSockets.push(ws);
          }
          var origSend = ws.send.bind(ws);
          ws.send = function(data) {
            try {
              if (typeof data === "string") {
                if (data.indexOf("40{") === 0) {
                  try {
                    var connectPayload = JSON.parse(data.substring(2));
                    if (connectPayload.token && connectPayload.token.startsWith("Bearer ")) {
                      setCapturedBearerToken(connectPayload.token);
                      window.postMessage({ type: "COR3_BEARER_TOKEN", token: connectPayload.token }, "*");
                    }
                  } catch (e) {
                  }
                }
                window.postMessage({ type: "COR3_WS_LOG", direction: "sent", message: data }, "*");
              } else if (data instanceof ArrayBuffer || typeof Uint8Array !== "undefined" && ArrayBuffer.isView(data)) {
                decodeBinaryMsg(data, function(str) {
                  if (str) {
                    window.postMessage({ type: "COR3_WS_LOG", direction: "sent", message: str }, "*");
                    if (str.indexOf("40{") === 0) {
                      try {
                        var cp = JSON.parse(str.substring(2));
                        if (cp.token && cp.token.startsWith("Bearer ")) {
                          setCapturedBearerToken(cp.token);
                          window.postMessage({ type: "COR3_BEARER_TOKEN", token: cp.token }, "*");
                        }
                      } catch (e) {
                      }
                    }
                  }
                });
              } else if (data instanceof Blob) {
                decodeBinaryMsg(data, function(str) {
                  if (str) {
                    window.postMessage({ type: "COR3_WS_LOG", direction: "sent", message: str }, "*");
                    if (str.indexOf("40{") === 0) {
                      try {
                        var cp = JSON.parse(str.substring(2));
                        if (cp.token && cp.token.startsWith("Bearer ")) {
                          setCapturedBearerToken(cp.token);
                          window.postMessage({ type: "COR3_BEARER_TOKEN", token: cp.token }, "*");
                        }
                      } catch (e) {
                      }
                    }
                  }
                });
              }
            } catch (e) {
            }
            return origSend(data);
          };
          ws.addEventListener("message", function(event) {
            try {
              if (!isMinigameSocket) {
                if (getActiveSocket() !== ws) {
                  console.log("[COR3 Helper] Active socket changed to:", ws.__cor3Url);
                  setActiveSocket(ws);
                }
                socketLastActivity.set(ws, Date.now());
              }
              var raw = event.data;
              if (raw instanceof ArrayBuffer || raw instanceof Blob || typeof Uint8Array !== "undefined" && ArrayBuffer.isView(raw) && !(raw instanceof DataView)) {
                decodeBinaryMsg(raw, function(str) {
                  if (str) handleWsMessage2(str, ws);
                });
              } else {
                handleWsMessage2(raw, ws);
              }
            } catch (e) {
            }
          });
          ws.addEventListener("open", function() {
            console.log("[COR3 Helper] WS connected \u2014 scheduling initial data fetch");
            setTimeout(function() {
              if (tokenExpiredFlag || pendingRetryOps.length > 0) {
                console.log("[COR3 Helper] Clearing pending retries (initial fetch will cover them):", pendingRetryOps.join(", "));
                setPendingRetryOps([]);
                setTokenExpiredFlag(false);
              }
              window.__cor3InitialFetch && window.__cor3InitialFetch();
            }, 3e3);
          });
          ws.addEventListener("close", function() {
            console.log("[COR3 Helper] WS closed");
            const idx = trackedSockets.indexOf(ws);
            if (idx !== -1) trackedSockets.splice(idx, 1);
            socketLastActivity.delete(ws);
            if (getActiveSocket() === ws) setActiveSocket(null);
            if (ws.__cor3IsMinigame && ws.__cor3Url && ws.__cor3Url.indexOf("ice-wall-break") !== -1) {
              window.postMessage({ type: "COR3_ICE_WALL_GAME_ENDED" }, "*");
            }
          });
        }
        return ws;
      },
      get(target, prop, receiver) {
        return Reflect.get(target, prop, receiver);
      }
    });
    Object.defineProperty(WebSocketProxy, "prototype", {
      value: OrigWebSocket.prototype,
      writable: false,
      configurable: false
    });
    window.WebSocket = WebSocketProxy;
  }

  // src/content-early/ws-send.js
  var WS_THROTTLE_MS = 250;
  var wsSendLastTime = 0;
  var wsSendQueue = [];
  var wsSendFlushTimer = null;
  var WS_QUEUE_MAX = 50;
  var _ceChannel = typeof MessageChannel !== "undefined" ? new MessageChannel() : null;
  var _ceCbs = [];
  if (_ceChannel) {
    _ceChannel.port1.onmessage = function() {
      var cbs = _ceCbs.slice();
      _ceCbs.length = 0;
      for (var i = 0; i < cbs.length; i++) cbs[i]();
    };
  }
  function ceNextTick(fn) {
    if (_ceChannel) {
      _ceCbs.push(fn);
      _ceChannel.port2.postMessage(0);
    } else {
      setTimeout(fn, 0);
    }
  }
  function scheduleFlush(delayMs) {
    if (wsSendFlushTimer) return;
    if (delayMs <= 0) {
      ceNextTick(wsSendFlush);
      wsSendFlushTimer = true;
      return;
    }
    var target = Date.now() + delayMs;
    function tick() {
      if (Date.now() >= target) {
        wsSendFlush();
        return;
      }
      var rem = target - Date.now();
      if (rem > 200) {
        setTimeout(function() {
          ceNextTick(tick);
        }, Math.min(rem - 50, 500));
      } else {
        ceNextTick(tick);
      }
    }
    wsSendFlushTimer = true;
    ceNextTick(tick);
  }
  function wsSendRaw(msg) {
    var toSend = msg;
    var codec = window.__cor3MsgpackCodec;
    if (codec && codec.isReady() && typeof msg === "string") {
      var buf = codec.stringToPacketBuffer(msg);
      if (buf) toSend = buf;
    }
    var activeSocket = getActiveSocket();
    if (activeSocket && activeSocket.readyState === OrigWebSocket.OPEN) {
      activeSocket.send(toSend);
      wsSendLastTime = Date.now();
      return true;
    }
    let bestSocket = null;
    let bestTime = 0;
    for (const ws of trackedSockets) {
      if (ws.readyState === OrigWebSocket.OPEN) {
        const lastActivity = socketLastActivity.get(ws) || 0;
        if (lastActivity > bestTime) {
          bestTime = lastActivity;
          bestSocket = ws;
        }
      }
    }
    if (bestSocket) {
      setActiveSocket(bestSocket);
      bestSocket.send(toSend);
      wsSendLastTime = Date.now();
      return true;
    }
    console.log("[COR3 Helper] No active WebSocket found \u2014 re-queuing message for retry");
    if (wsSendQueue.length < WS_QUEUE_MAX) {
      wsSendQueue.unshift(msg);
      scheduleFlush(2e3);
    } else {
      console.log("[COR3 Helper] No active WebSocket and queue full \u2014 message dropped");
    }
    return false;
  }
  function wsSendFlush() {
    wsSendFlushTimer = null;
    if (wsSendQueue.length === 0) return;
    var now = Date.now();
    var elapsed = now - wsSendLastTime;
    if (elapsed >= WS_THROTTLE_MS) {
      var next = wsSendQueue.shift();
      wsSendRaw(next);
      if (wsSendQueue.length > 0) {
        scheduleFlush(WS_THROTTLE_MS);
      }
    } else {
      scheduleFlush(WS_THROTTLE_MS - elapsed);
    }
  }
  function wsSend(msg) {
    var now = Date.now();
    var elapsed = now - wsSendLastTime;
    if (elapsed >= WS_THROTTLE_MS && wsSendQueue.length === 0) {
      wsSendRaw(msg);
    } else {
      wsSendQueue.push(msg);
      if (wsSendQueue.length > WS_QUEUE_MAX) {
        var dropped = wsSendQueue.length - WS_QUEUE_MAX;
        wsSendQueue = wsSendQueue.slice(dropped);
        console.log("[COR3 Helper] WS send queue overflow \u2014 dropped " + dropped + " oldest message(s)");
      }
      if (!wsSendFlushTimer) {
        scheduleFlush(Math.max(0, WS_THROTTLE_MS - elapsed));
      }
    }
    return true;
  }
  function queueRetryOp(opName) {
    if (!pendingRetryOps.includes(opName)) {
      pendingRetryOps.push(opName);
    }
  }
  function humanDelay() {
    return 400 + Math.floor(Math.random() * 500);
  }
  var joinedRooms = /* @__PURE__ */ new Set();
  function delay(ms) {
    return new Promise(function(resolve) {
      var target = Date.now() + ms;
      function check() {
        if (Date.now() >= target) {
          resolve();
          return;
        }
        var remaining = target - Date.now();
        if (remaining > 200) {
          setTimeout(function() {
            ceNextTick(check);
          }, Math.min(remaining - 50, 500));
        } else {
          ceNextTick(check);
        }
      }
      ceNextTick(check);
    });
  }
  function leaveRoom(room) {
    if (!joinedRooms.has(room)) return false;
    wsSend('42["leave-room",{"room":"' + room + '"}]');
    joinedRooms.delete(room);
    return true;
  }
  function sendJoin(room) {
    var joinData = { room };
    var capturedBearerToken = getCapturedBearerToken();
    if (capturedBearerToken) {
      var jwt = capturedBearerToken;
      if (jwt.startsWith("Bearer ")) jwt = jwt.substring(7);
      joinData.jwtToken = jwt;
    }
    if (window.__cor3WebVersion) {
      joinData.clientVersion = window.__cor3WebVersion;
    }
    wsSend('42["join-room",' + JSON.stringify(joinData) + "]");
    joinedRooms.add(room);
  }
  function leaveRoomsInOrder(rooms) {
    var chain = Promise.resolve();
    rooms.forEach(function(room) {
      chain = chain.then(function() {
        if (leaveRoom(room)) {
          return delay(humanDelay());
        }
      });
    });
    return chain;
  }
  function joinRoomsInOrder(rooms) {
    var chain = Promise.resolve();
    rooms.forEach(function(room) {
      chain = chain.then(function() {
        sendJoin(room);
        return delay(humanDelay());
      });
    });
    return chain;
  }
  function enterRooms(rooms) {
    var toLeave = rooms.slice().reverse().filter(function(r) {
      return joinedRooms.has(r);
    });
    return leaveRoomsInOrder(toLeave).then(function() {
      return joinRoomsInOrder(rooms);
    });
  }

  // src/content-early/http-intercept.js
  var webVersion = null;
  function parsePollingForDesktopOptions(responseText) {
    if (!responseText || typeof responseText !== "string") return;
    var startIdx = 0;
    while (startIdx < responseText.length) {
      var msgStart = responseText.indexOf('42["desktop"', startIdx);
      if (msgStart === -1) break;
      var jsonStart = msgStart + 2;
      try {
        var bracketDepth = 0;
        var inString = false;
        var escape = false;
        var end = -1;
        for (var ci = jsonStart; ci < responseText.length; ci++) {
          var ch = responseText[ci];
          if (escape) {
            escape = false;
            continue;
          }
          if (ch === "\\" && inString) {
            escape = true;
            continue;
          }
          if (ch === '"') {
            inString = !inString;
            continue;
          }
          if (inString) continue;
          if (ch === "[" || ch === "{") bracketDepth++;
          else if (ch === "]" || ch === "}") {
            bracketDepth--;
            if (bracketDepth === 0) {
              end = ci + 1;
              break;
            }
          }
        }
        if (end > jsonStart) {
          var jsonStr = responseText.substring(jsonStart, end);
          var parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed[0] === "desktop" && parsed[1]) {
            var payload = parsed[1];
            if (payload.event && payload.event.action === "get.options" && payload.data) {
              console.log("[COR3 Helper] Desktop get.options found in polling response \u2014 folders:", payload.data.folders ? payload.data.folders.length : 0);
              if (payload.data.folders) {
                var dlf = payload.data.folders.find(function(f) {
                  return f.name === "Downloads";
                });
                if (dlf) {
                  window.__cor3DownloadFolderId = dlf.id;
                  console.log("[COR3 Helper] Cached Downloads folder ID from polling:", dlf.id);
                }
              }
              window.postMessage({ type: "COR3_AUTOJOB_DESKTOP_OPTIONS", data: payload.data, error: payload.error || null }, "*");
            }
            if (payload.event && (payload.event.action === "update.file" || payload.event.action === "open.file" || payload.event.action === "decrypt.file") && (payload.data || payload.error)) {
              var pollFileError = payload.error || null;
              if (!pollFileError && payload.data && payload.data.kind === "insufficient_power") {
                pollFileError = { message: "insufficient_power", kind: "insufficient_power", ability: payload.data.ability, required: payload.data.required, available: payload.data.available };
              }
              window.postMessage({ type: "COR3_AUTOJOB_DESKTOP_FILE", data: payload.data || null, error: pollFileError }, "*");
              if (payload.event.action === "update.file") {
                window.postMessage({ type: "COR3_AUTOJOB_DESKTOP_UPDATE_FILE", data: payload.data || null, error: payload.error || null }, "*");
              }
            }
          }
        }
      } catch (e) {
      }
      startIdx = msgStart + 1;
    }
  }
  function installHttpIntercept() {
    const OrigFetch = window.fetch;
    window.fetch = function() {
      const args = arguments;
      const input = args[0];
      try {
        const url = typeof input === "string" ? input : input && input.url ? input.url : "";
        if (url.includes("translation.json")) {
          try {
            const parsedUrl = new URL(url, window.location.origin);
            if (!webVersion) {
              webVersion = parsedUrl.searchParams.get("v");
            }
            console.log("[COR3 Helper] Captured web version from translation.json:", webVersion);
            window.__cor3WebVersion = webVersion;
            setTimeout(function() {
              window.postMessage({ type: "COR3_WEB_VERSION", version: webVersion }, "*");
            }, 250);
          } catch (e) {
            console.log("[COR3 Helper] Error parsing version:", e);
          }
        }
      } catch (e) {
      }
      var result = OrigFetch.apply(this, args);
      try {
        var fetchUrl = typeof input === "string" ? input : input && input.url ? input.url : "";
        if (fetchUrl.includes("socket.io") && fetchUrl.includes("transport=polling")) {
          result.then(function(resp) {
            if (resp && resp.ok) {
              resp.clone().text().then(function(text) {
                parsePollingForDesktopOptions(text);
              }).catch(function() {
              });
            }
          }).catch(function() {
          });
        }
        if (fetchUrl.includes("api/users/me")) {
          result.then(function(resp) {
            if (resp && resp.ok) {
              resp.clone().json().then(function(data) {
                if (data && data.systemVersion !== void 0) {
                  console.log("[COR3 Helper] Captured system version from api/users/me:", data.systemVersion);
                  window.__cor3SystemVersion = data.systemVersion;
                  window.postMessage({ type: "COR3_SYSTEM_VERSION", version: data.systemVersion }, "*");
                }
              }).catch(function() {
              });
            }
          }).catch(function() {
          });
        }
        if (fetchUrl.includes("api/user-daily-claim/rewards")) {
          result.then(function(resp) {
            if (resp && resp.ok) {
              resp.clone().json().then(function(data) {
                if (Array.isArray(data)) {
                  window.postMessage({ type: "COR3_DAILY_REWARDS", rewards: data }, "*");
                }
              }).catch(function() {
              });
            }
          }).catch(function() {
          });
        }
      } catch (e) {
      }
      return result;
    };
    const OrigXHROpen = XMLHttpRequest.prototype.open;
    const OrigXHRSend = XMLHttpRequest.prototype.send;
    const OrigXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function() {
      this.__cor3Url = arguments[1] || "";
      return OrigXHROpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
      if ((name === "Authorization" || name === "authorization") && value && value.startsWith("Bearer ") && (this.__cor3Url && (this.__cor3Url.includes("cor3") || this.__cor3Url.includes("corie")))) {
        setCapturedBearerToken(value);
        window.postMessage({ type: "COR3_BEARER_TOKEN", token: value }, "*");
      }
      return OrigXHRSetHeader.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      var xhr = this;
      if (xhr.__cor3Url && xhr.__cor3Url.includes("socket.io") && xhr.__cor3Url.includes("transport=polling")) {
        xhr.addEventListener("load", function() {
          try {
            if (xhr.responseText) {
              parsePollingForDesktopOptions(xhr.responseText);
            }
          } catch (e) {
          }
        });
      }
      return OrigXHRSend.apply(this, arguments);
    };
  }

  // src/content-early/ws-message-handler.js
  var __cor3PostUnreachable = null;
  function setPostUnreachable(fn) {
    __cor3PostUnreachable = fn;
  }
  function handleWsMessage(rawData, socket) {
    if (typeof rawData !== "string") return;
    window.postMessage({ type: "COR3_WS_LOG", direction: "received", message: rawData }, "*");
    if (!rawData.startsWith("42")) return;
    const jsonStr = rawData.substring(2);
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      return;
    }
    if (!Array.isArray(parsed) || parsed.length < 2) return;
    const eventName = parsed[0];
    const payload = parsed[1];
    if (eventName === "error" && payload && payload.message === "token-expired") {
      console.log("[COR3 Helper] Token expired detected \u2014 closing sockets to force reconnect");
      setTokenExpiredFlag(true);
      var newAbortId = bumpMarketRefreshAbortId();
      console.log("[COR3 Helper] Bumped market refresh abort ID to", newAbortId);
      if (window.__cor3ResetInitialFetch) window.__cor3ResetInitialFetch();
      queueRetryOp("expeditions");
      queueRetryOp("stash");
      queueRetryOp("dailyOps");
      window.postMessage({ type: "COR3_TOKEN_EXPIRED" }, "*");
      var socketsToClose = trackedSockets.slice();
      for (var i = 0; i < socketsToClose.length; i++) {
        try {
          socketsToClose[i].close();
        } catch (e) {
        }
      }
      setTimeout(function() {
        if (trackedSockets.length === 0) {
          console.log("[COR3 Helper] No new WebSocket connected after token-expired close \u2014 game may need page refresh");
        } else {
          console.log("[COR3 Helper] WebSocket reconnected after token-expired");
        }
      }, 15e3);
      return;
    }
    if (eventName === "specialists" && payload && payload.data) {
      window.postMessage({
        type: "COR3_WS_SPECIALISTS",
        data: payload.data
      }, "*");
    }
    if (eventName === "stash" && payload && payload.data) {
      window.postMessage({
        type: "COR3_WS_STASH",
        stash: payload.data
      }, "*");
    }
    if (eventName === "loadout" && payload) {
      var loadoutAction = payload.event ? payload.event.action : null;
      if (payload.error) {
        window.postMessage({
          type: "COR3_WS_LOADOUT_ERROR",
          action: loadoutAction,
          error: payload.error
        }, "*");
      }
      if (payload.data) {
        window.postMessage({
          type: "COR3_WS_LOADOUT",
          action: loadoutAction,
          loadout: payload.data
        }, "*");
        window.__cor3LoadoutData = payload.data;
        window.postMessage({
          type: "COR3_AUTOJOB_LOADOUT",
          action: loadoutAction,
          data: payload.data,
          error: null
        }, "*");
      }
      if (payload.error) {
        window.postMessage({
          type: "COR3_AUTOJOB_LOADOUT",
          action: loadoutAction,
          data: null,
          error: payload.error
        }, "*");
      }
    }
    if (eventName === "expeditions" && payload && payload.event && payload.event.action === "get.mercenaries") {
      var mercFactionKey = null;
      if (payload.data && payload.data.mercenaries && payload.data.mercenaries.length > 0) {
        var firstMerc = payload.data.mercenaries[0];
        if (firstMerc.faction && firstMerc.faction.key) mercFactionKey = firstMerc.faction.key;
      }
      if (!mercFactionKey && payload.data && payload.data.eliteSlots && payload.data.eliteSlots.length > 0) {
        var firstElite = payload.data.eliteSlots[0];
        if (firstElite.mercenary && firstElite.mercenary.faction && firstElite.mercenary.faction.key) mercFactionKey = firstElite.mercenary.faction.key;
        if (!mercFactionKey && firstElite.marketId === USOL_MARKET_ID) mercFactionKey = "usol_employment";
      }
      if (mercFactionKey === "usol_employment") {
        window.postMessage({ type: "COR3_WS_USOL_MERCENARIES", data: payload.data }, "*");
      } else {
        if (payload.data && payload.data.mercenaries) {
          window.__cor3CachedMercIds = payload.data.mercenaries.map(function(m) {
            return m.id;
          });
        }
        window.postMessage({ type: "COR3_WS_MERCENARIES", data: payload.data }, "*");
      }
      return;
    }
    if (eventName === "expeditions" && payload && payload.event && payload.event.action === "get.config") {
      var isUsolConfig = !!window.__cor3UsolMercFetchInProgress;
      if (payload.data && payload.data.locations && payload.data.locations.length > 0) {
        var picked = window.__cor3PickLocationConfig(payload.data.locations);
        if (isUsolConfig) {
          window.__cor3UsolExpConfigIds = picked;
        } else {
          window.__cor3ExpConfigIds = picked;
        }
      }
      if (isUsolConfig) {
        window.postMessage({ type: "COR3_WS_USOL_EXPEDITION_CONFIG", data: payload.data }, "*");
      } else {
        window.postMessage({ type: "COR3_WS_EXPEDITION_CONFIG", data: payload.data }, "*");
      }
      return;
    }
    if (eventName === "expeditions" && payload && payload.event && payload.event.action === "open.container") {
      window.postMessage({
        type: "COR3_WS_CONTAINER_OPENED",
        data: payload.data
      }, "*");
      if (payload.data && payload.data.id) {
        window.postMessage({
          type: "COR3_WS_EXPEDITIONS",
          expeditions: [payload.data]
        }, "*");
      }
      return;
    }
    if (eventName === "expeditions" && payload && payload.event && payload.event.action === "collect.all") {
      if (payload.error && (payload.error.message === "Insufficient stash capacity" || payload.error.message === "stash.error.insufficient_capacity")) {
        window.postMessage({
          type: "COR3_WS_STASH_FULL",
          error: payload.error.message,
          requestId: payload.requestId
        }, "*");
      } else if (payload.error && payload.error.message === "insufficient-credits") {
        console.log("[COR3 Helper] collect.all failed: insufficient credits");
        window.postMessage({
          type: "COR3_WS_COLLECT_INSUFFICIENT_CREDITS",
          error: payload.error.message
        }, "*");
      } else if (payload.error) {
        console.log("[COR3 Helper] collect.all failed with unexpected error:", payload.error.message);
        window.postMessage({
          type: "COR3_WS_STASH_FULL",
          error: payload.error.message,
          requestId: payload.requestId
        }, "*");
      } else {
        window.postMessage({
          type: "COR3_WS_COLLECTED_ALL",
          data: payload.data
        }, "*");
      }
      return;
    }
    if (eventName === "expeditions" && payload && payload.event && payload.event.action === "insert.archive") {
      window.postMessage({
        type: "COR3_WS_EXPEDITION_ARCHIVED",
        data: payload.data
      }, "*");
      return;
    }
    if (eventName === "expeditions" && payload && payload.event && payload.event.action === "launch") {
      if (payload.error && payload.error.message === "Maximum 1 active expedition allowed") {
        console.log("[COR3 Helper] Expedition launch failed: Maximum 1 active expedition allowed");
        window.postMessage({
          type: "COR3_WS_EXPEDITION_LAUNCH_ERROR",
          error: payload.error.message
        }, "*");
        return;
      }
      if (payload.error && payload.error.message === "This location requires an elite mercenary") {
        console.log("[COR3 Helper] Expedition launch failed: quest location requires elite mercenary \u2014 will retry with default location");
        window.postMessage({
          type: "COR3_WS_EXPEDITION_ELITE_REQUIRED",
          error: payload.error.message
        }, "*");
        return;
      }
      if (payload.error && payload.error.message === "Mercenary is not available") {
        console.log("[COR3 Helper] Expedition launch failed: Mercenary is not available");
        window.postMessage({
          type: "COR3_WS_MERC_NOT_AVAILABLE",
          error: payload.error.message
        }, "*");
        return;
      }
      if (payload.error && payload.error.message === "insufficient-credits") {
        console.log("[COR3 Helper] Expedition launch failed: insufficient credits");
        window.postMessage({
          type: "COR3_WS_INSUFFICIENT_CREDITS",
          error: payload.error.message
        }, "*");
        return;
      }
      window.postMessage({
        type: "COR3_WS_EXPEDITION_LAUNCHED",
        data: payload.data
      }, "*");
      window.postMessage({
        type: "COR3_WS_DECISIONS",
        decisions: []
        // Clear decisions by sending empty array
      }, "*");
      window.postMessage({
        type: "COR3_WS_EXPEDITIONS",
        expeditions: [payload.data]
      }, "*");
      return;
    }
    if (eventName === "expeditions" && payload && payload.event && payload.event.action === "configure") {
      var mercId = window.__cor3PendingMercConfigures && window.__cor3PendingMercConfigures.length > 0 ? window.__cor3PendingMercConfigures.shift() : null;
      window.postMessage({
        type: "COR3_WS_MERC_CONFIGURE",
        mercenaryId: mercId,
        data: payload.data
      }, "*");
      return;
    }
    if (eventName === "market" && payload && payload.data) {
      let resolveMarketType = function(id) {
        if (id === "019d3ea4-85bd-7389-904d-908ba9194aa0") return "dark";
        if (id === "019da731-2db5-7d76-9447-1ea3b9b78001") return "soyuz";
        if (id === "019e4065-6ae8-760d-8724-58ab4f2cf7d7") return "usol";
        return "home";
      }, marketCacheKey = function(type) {
        return type === "dark" ? "__cor3DarkMarketCache" : type === "soyuz" ? "__cor3SoyuzMarketCache" : type === "usol" ? "__cor3UsolMarketCache" : "__cor3HomeMarketCache";
      }, marketMsgType = function(type) {
        return type === "dark" ? "COR3_WS_DARK_MARKET" : type === "soyuz" ? "COR3_WS_SOYUZ_MARKET" : type === "usol" ? "COR3_WS_USOL_MARKET" : "COR3_WS_MARKET";
      }, postMarketUpdate = function(type, cache) {
        window.postMessage({ type: marketMsgType(type), market: cache }, "*");
      };
      var mktAction = payload.event ? payload.event.action : null;
      var mkt = payload.data.market;
      if (mktAction === "get.options" && mkt && mkt.marketName) {
        var marketType = resolveMarketType(mkt.id);
        var cacheKey = marketCacheKey(marketType);
        window.__cor3CurrentMarketFetch = mkt.id;
        var prevJobs = window[cacheKey] ? window[cacheKey].jobs : void 0;
        var prevRecentJobs = window[cacheKey] ? window[cacheKey].recentJobs : void 0;
        var prevNextJobsResetAt = window[cacheKey] ? window[cacheKey].nextJobsResetAt : void 0;
        var prevLots = window[cacheKey] ? window[cacheKey].lots : void 0;
        window[cacheKey] = Object.assign({}, payload.data);
        if (prevJobs !== void 0) window[cacheKey].jobs = prevJobs;
        if (prevRecentJobs !== void 0) window[cacheKey].recentJobs = prevRecentJobs;
        if (prevNextJobsResetAt !== void 0) window[cacheKey].nextJobsResetAt = prevNextJobsResetAt;
        if (prevLots !== void 0) window[cacheKey].lots = prevLots;
        postMarketUpdate(marketType, window[cacheKey]);
        if (marketType === "home") window.__cor3LastMarketId = mkt.id;
      }
      if (mktAction === "get.lots" && payload.data.lots) {
        var lotsMarketId = window.__cor3CurrentMarketFetch;
        var lotsType = resolveMarketType(lotsMarketId);
        var lotsCacheKey = marketCacheKey(lotsType);
        if (window[lotsCacheKey]) {
          window[lotsCacheKey].lots = payload.data.lots;
          postMarketUpdate(lotsType, window[lotsCacheKey]);
        }
      }
      if (mktAction === "get.jobs") {
        var jobsMarketId = window.__cor3CurrentMarketFetch;
        var jobsType = resolveMarketType(jobsMarketId);
        var jobsCacheKey = marketCacheKey(jobsType);
        if (window[jobsCacheKey]) {
          window[jobsCacheKey].jobs = payload.data.jobs || [];
          window[jobsCacheKey].recentJobs = payload.data.recentJobs || [];
          window[jobsCacheKey].nextJobsResetAt = payload.data.nextJobsResetAt || window[jobsCacheKey].nextJobsResetAt;
          postMarketUpdate(jobsType, window[jobsCacheKey]);
          window.postMessage({ type: "COR3_MARKET_FETCH_COMPLETE", marketId: jobsMarketId, marketType: jobsType }, "*");
        }
      }
      if (!mktAction && mkt && mkt.marketName) {
        var legacyType = resolveMarketType(mkt.id);
        postMarketUpdate(legacyType, payload.data);
        if (legacyType === "home") window.__cor3LastMarketId = mkt.id;
      }
    }
    if (eventName === "updater" && payload && payload.data) {
      var sv = payload.data.selectedVersion;
      if (sv) {
        console.log("[COR3 Helper] Captured patch version from updater:", sv);
        window.__cor3PatchVersion = sv;
        window.postMessage({ type: "COR3_PATCH_VERSION", version: sv }, "*");
      }
    }
    if (eventName === "network-map" && payload && payload.event) {
      if (payload.event.action === "set.endpoint") {
        var errMsg = payload.error && payload.error.message;
        var isUnreachableErr = errMsg === "no-path-to-server" || errMsg === "server-in-maintenance" || errMsg === "market-not-reachable";
        if (payload.error && isUnreachableErr) {
          console.log("[COR3 Helper] Server unreachable: " + errMsg + " (dark-pt: " + !!window.__cor3DarkMarketPathThrough + ", dark-pend: " + !!window.__cor3DarkMarketPending + ", soyuz-pt: " + !!window.__cor3SoyuzMarketPathThrough + ", soyuz-pend: " + !!window.__cor3SoyuzMarketPending + ", usol-pt: " + !!window.__cor3UsolMarketPathThrough + ", usol-pend: " + !!window.__cor3UsolMarketPending + ", devTc: " + !!window.__cor3DevTcReachActive + ")");
          if (window.__cor3DevTcReachActive || window.__cor3DarkMarketPathThrough || window.__cor3SoyuzMarketPathThrough || window.__cor3UsolMarketPathThrough) {
            window.postMessage({
              type: "COR3_WS_ENDPOINT_RESULT",
              success: false,
              error: payload.error,
              serverId: payload.error.serverId || null
            }, "*");
          } else if (window.__cor3UsolMarketPending) {
            __cor3PostUnreachable("usol", null);
          } else if (window.__cor3SoyuzMarketPending) {
            __cor3PostUnreachable("soyuz", null);
          } else if (window.__cor3DarkMarketPending) {
            __cor3PostUnreachable("dark", null);
          } else {
            window.postMessage({
              type: "COR3_WS_ENDPOINT_RESULT",
              success: false,
              error: payload.error,
              serverId: payload.error.serverId || null
            }, "*");
          }
        } else {
          var success = !payload.error;
          var epServerId = payload.error && payload.error.serverId || null;
          window.postMessage({
            type: "COR3_WS_ENDPOINT_RESULT",
            success,
            data: payload.data,
            error: payload.error || null,
            serverId: epServerId
          }, "*");
        }
      }
      if (payload.event.action === "get.map" && payload.data && payload.data.servers) {
        var servers = payload.data.servers;
        var maintenanceInfo = {};
        var serverTypeMap = {};
        for (var si = 0; si < servers.length; si++) {
          var srv = servers[si];
          maintenanceInfo[srv.id] = {
            serverName: srv.serverName,
            isInMaintenance: !!srv.isInMaintenance,
            maintenanceEndsAt: srv.maintenanceEndsAt || null,
            timeUntilMaintenance: srv.timeUntilMaintenance || null
          };
          serverTypeMap[srv.id] = {
            serverName: srv.serverName,
            serverTypeName: srv.serverTypeName || null,
            serverDefenceRate: srv.serverDefenceRate || 0
          };
        }
        window.__cor3ServerTypeMap = serverTypeMap;
        window.postMessage({ type: "COR3_WS_NETWORK_MAP", servers: maintenanceInfo }, "*");
        window.postMessage({ type: "COR3_WS_MAP_DATA", servers: payload.data.servers, connections: payload.data.connections || [] }, "*");
      }
      if (payload.event.action === "maintenance" && payload.data) {
        window.postMessage({ type: "COR3_WS_MAINTENANCE_STARTED", data: payload.data }, "*");
      }
    }
    if (eventName === "sai" && payload && payload.event) {
      var action = payload.event.action;
      if (action === "get.login.status") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_LOGIN_STATUS", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "login.with-access") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_LOGIN_RESULT", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "hack.start") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_HACK_START", data: payload.data || null, error: payload.error || null }, "*");
        return;
      }
      if (action === "update") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_UPDATE", data: payload.data }, "*");
        return;
      }
      if (action === "get.files") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_FILES", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "file.download") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_FILE_DOWNLOAD", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "get.logs") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_LOGS", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "log.delete") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_LOG_DELETE", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "log.download") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_LOG_DOWNLOAD", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "get.transit") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_TRANSIT", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "transit.add") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_TRANSIT_ADD", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "transit.remove") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_TRANSIT_REMOVE", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "file.delete") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_FILE_DELETE", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "file.upload") {
        window.postMessage({ type: "COR3_AUTOJOB_SAI_FILE_UPLOAD", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "file.search-valuable") {
        window.postMessage({ type: "COR3_VALUABLE_FILE_SEARCH", data: payload.data, error: payload.error || null }, "*");
        return;
      }
      if (action === "log.search-valuable") {
        window.postMessage({ type: "COR3_VALUABLE_LOG_SEARCH", data: payload.data, error: payload.error || null }, "*");
        return;
      }
    }
    if (eventName === "desktop" && payload && payload.event) {
      var dAction = payload.event.action;
      console.log("[COR3 Helper] Desktop event:", dAction);
      if (dAction === "open.folder") {
        window.postMessage({ type: "COR3_AUTOJOB_DESKTOP_FOLDER", data: payload.data, error: payload.error || null }, "*");
      }
      if (dAction === "update.file" || dAction === "open.file" || dAction === "decrypt.file") {
        var fileError = payload.error || null;
        if (!fileError && payload.data && payload.data.kind === "insufficient_power") {
          fileError = { message: "insufficient_power", kind: "insufficient_power", ability: payload.data.ability, required: payload.data.required, available: payload.data.available };
        }
        window.postMessage({ type: "COR3_AUTOJOB_DESKTOP_FILE", data: payload.data, error: fileError }, "*");
        if (dAction === "update.file") {
          window.postMessage({ type: "COR3_AUTOJOB_DESKTOP_UPDATE_FILE", data: payload.data, error: payload.error || null }, "*");
        }
      }
      if (dAction === "get.file.analysis") {
        window.postMessage({ type: "COR3_AUTOJOB_FILE_ANALYSIS", data: payload.data, error: payload.error || null }, "*");
      }
      if (dAction === "get.options") {
        console.log("[COR3 Helper] Desktop get.options received \u2014 folders:", payload.data && payload.data.folders ? payload.data.folders.length : 0);
        if (payload.data && payload.data.folders) {
          var dlf = payload.data.folders.find(function(f) {
            return f.name === "Downloads";
          });
          if (dlf) {
            window.__cor3DownloadFolderId = dlf.id;
            console.log("[COR3 Helper] Cached Downloads folder ID:", dlf.id);
          }
        }
        window.postMessage({ type: "COR3_AUTOJOB_DESKTOP_OPTIONS", data: payload.data, error: payload.error || null }, "*");
      }
    }
    if (eventName === "minigames" && payload && payload.event && payload.event.action === "start.minigame") {
      if (payload.data && payload.data.lockExpiresAt && !payload.data.token) {
        window.postMessage({ type: "COR3_AUTOJOB_MINIGAME_LOCKED", data: payload.data }, "*");
      } else {
        window.postMessage({ type: "COR3_AUTOJOB_MINIGAME_START", data: payload.data }, "*");
        if (payload.data && payload.data.type === "EXTERNAL" && payload.data.url && payload.data.url.indexOf("ice-wall-break") !== -1) {
          window.postMessage({ type: "COR3_ICE_WALL_MINIGAME_START", data: payload.data }, "*");
        }
      }
    }
    if (eventName === "profile" && payload && payload.event && payload.event.action === "receive.progress") {
      window.postMessage({ type: "COR3_AUTOJOB_PROFILE_PROGRESS", data: payload.data }, "*");
    }
    if (eventName === "profile" && payload && payload.event && payload.event.action === "receive.credits") {
      window.postMessage({ type: "COR3_AUTOJOB_PROFILE_CREDITS", data: payload.data }, "*");
    }
    if (eventName === "market" && payload && payload.event) {
      if (payload.event.action === "job.take") {
        window.postMessage({ type: "COR3_AUTOJOB_JOB_TAKEN", data: payload.data, error: payload.error || null }, "*");
      }
      if (payload.event.action === "job.complete") {
        console.log("[COR3 Helper] AutoJob: job.complete intercepted", JSON.stringify(payload.data));
        window.postMessage({ type: "COR3_AUTOJOB_JOB_COMPLETED", data: payload.data, error: payload.error || null }, "*");
      }
      if (payload.event.action === "job.can-complete") {
        window.postMessage({ type: "COR3_AUTOJOB_JOB_CAN_COMPLETE", data: payload.data, error: payload.error || null }, "*");
      }
      if (payload.event.action === "get.sellable-items") {
        window.postMessage({ type: "COR3_VALUABLE_SELLABLE_ITEMS", data: payload.data, error: payload.error || null }, "*");
      }
      if (payload.event.action === "sell.items") {
        window.postMessage({ type: "COR3_VALUABLE_SELL_RESULT", data: payload.data, error: payload.error || null }, "*");
      }
    }
    if (eventName === "expeditions" && payload && payload.event && payload.event.action === "update") {
      console.log("[COR3 Helper] Expedition update event detected - data will flow through existing handlers");
      return;
    }
    if (eventName === "expeditions" && payload && payload.data) {
      if (payload.event && payload.event.action === "get.archived") {
        window.postMessage({
          type: "COR3_WS_ARCHIVED_EXPEDITIONS",
          data: payload.data
        }, "*");
        return;
      }
      var expAction = payload.event && payload.event.action;
      if (expAction === "get.mercenaries" || expAction === "get.config" || expAction === "configure") {
        return;
      }
      const expeditions = Array.isArray(payload.data) ? payload.data : [payload.data];
      window.postMessage({
        type: "COR3_WS_EXPEDITIONS",
        expeditions
      }, "*");
      const decisionsFound = [];
      for (const expedition of expeditions) {
        if (!expedition.messages) continue;
        for (const msg of expedition.messages) {
          if (msg.decisionOptions && msg.decisionOptions !== null) {
            decisionsFound.push({
              expeditionId: expedition.id,
              mercenaryCallsign: expedition.mercenary ? expedition.mercenary.callsign : "Unknown",
              locationName: expedition.locationName || "",
              zoneName: expedition.zoneName || "",
              riskScore: expedition.riskScore || 0,
              messageId: msg.id,
              content: msg.content,
              decisionOptions: msg.decisionOptions,
              selectedOption: msg.selectedOption,
              decisionDeadline: msg.decisionDeadline,
              isResolved: msg.isResolved,
              isAutoResolved: msg.isAutoResolved || false,
              createdAt: msg.createdAt
            });
          }
        }
      }
      if (decisionsFound.length > 0) {
        window.postMessage({
          type: "COR3_WS_DECISIONS",
          decisions: decisionsFound
        }, "*");
      }
    }
  }

  // src/content-early/ws-commands.js
  window.__cor3RequestStash = function() {
    console.log("[COR3 Helper] Requesting stash data");
    enterRooms(["stash"]);
    return true;
  };
  window.__cor3SellItem = function(itemId, quantity, skipStashRefresh) {
    quantity = quantity || 1;
    console.log("[COR3 Helper] Selling item:", itemId, "qty:", quantity);
    var msg = '42["event",{"event":{"name":"stash","action":"sell.item"},"data":{"itemId":"' + itemId + '","quantity":' + quantity + "}}]";
    wsSend(msg);
    if (!skipStashRefresh) {
      setTimeout(function() {
        window.__cor3RequestStash();
      }, 1500);
    }
    return true;
  };
  window.__cor3RequestSpecialists = function() {
    console.log("[COR3 Helper] Requesting specialists data");
    var msg = '42["event",{"event":{"name":"specialists","action":"get.state"},"data":{}}]';
    wsSend(msg);
    return true;
  };
  window.__cor3PurchaseSpecialist = function(specialistType, kind, level, priceId) {
    console.log("[COR3 Helper] Purchasing specialist service:", specialistType, kind, level, priceId);
    var msg = '42["event",{"event":{"name":"specialists","action":"purchase"},"data":{"specialistType":"' + specialistType + '","kind":"' + kind + '","level":' + level + ',"priceId":"' + priceId + '"}}]';
    wsSend(msg);
    return true;
  };
  window.__cor3RequestLoadout = function() {
    console.log("[COR3 Helper] Requesting loadout data");
    var msg = '42["event",{"event":{"name":"loadout","action":"get.options"}}]';
    wsSend(msg);
    return true;
  };
  window.__cor3EquipHardware = function(moduleConfigId) {
    console.log("[COR3 Helper] Equipping hardware:", moduleConfigId);
    var msg = '42["event",{"event":{"name":"loadout","action":"equip.hardware"},"data":{"moduleConfigId":"' + moduleConfigId + '"}}]';
    wsSend(msg);
  };
  window.__cor3EquipSoftware = function(moduleConfigId) {
    console.log("[COR3 Helper] Equipping software:", moduleConfigId);
    var msg = '42["event",{"event":{"name":"loadout","action":"equip.software"},"data":{"moduleConfigId":"' + moduleConfigId + '"}}]';
    wsSend(msg);
  };
  window.__cor3UnequipSoftware = function(moduleConfigId) {
    console.log("[COR3 Helper] Unequipping software:", moduleConfigId);
    var msg = '42["event",{"event":{"name":"loadout","action":"unequip.software"},"data":{"moduleConfigId":"' + moduleConfigId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobTake = function(marketId, jobId) {
    var msg = '42["event",{"event":{"name":"market","action":"job.take"},"data":{"marketId":"' + marketId + '","jobId":"' + jobId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobComplete = function(marketId, jobId) {
    var msg = '42["event",{"event":{"name":"market","action":"job.complete"},"data":{"marketId":"' + marketId + '","jobId":"' + jobId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobDismiss = function(marketId, jobId) {
    var msg = '42["event",{"event":{"name":"market","action":"job.dismiss"},"data":{"marketId":"' + marketId + '","jobId":"' + jobId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobGetMarketOptions = function(marketId) {
    window.__cor3CurrentMarketFetch = marketId;
    var msg = '42["event",{"event":{"name":"market","action":"get.jobs"},"data":{"marketId":"' + marketId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobSetEndpoint = function(serverId) {
    var msg = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + serverId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobGetLoginStatus = function(serverId) {
    var msg = '42["event",{"event":{"name":"sai","action":"get.login.status"},"data":{"serverId":"' + serverId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobLoginWithAccess = function(serverId, accessGrantId) {
    var msg = '42["event",{"event":{"name":"sai","action":"login.with-access"},"data":{"serverId":"' + serverId + '","accessGrantId":"' + accessGrantId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobHackStart = function(serverId) {
    var msg = '42["event",{"event":{"name":"sai","action":"hack.start"},"data":{"serverId":"' + serverId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobGetFiles = function(serverId) {
    var msg = '42["event",{"event":{"name":"sai","action":"get.files"},"data":{"serverId":"' + serverId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobFileDownload = function(serverId, fileId) {
    var msg = '42["event",{"event":{"name":"sai","action":"file.download"},"data":{"serverId":"' + serverId + '","fileId":"' + fileId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobGetLogs = function(serverId) {
    var msg = '42["event",{"event":{"name":"sai","action":"get.logs"},"data":{"serverId":"' + serverId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobLogDelete = function(serverId, seq) {
    var msg = '42["event",{"event":{"name":"sai","action":"log.delete"},"data":{"serverId":"' + serverId + '","seq":' + seq + "}}]";
    wsSend(msg);
  };
  window.__cor3AutoJobLogDownload = function(serverId, seq) {
    var msg = '42["event",{"event":{"name":"sai","action":"log.download"},"data":{"serverId":"' + serverId + '","seq":' + seq + "}}]";
    wsSend(msg);
  };
  window.__cor3AutoJobGetTransit = function(serverId) {
    var msg = '42["event",{"event":{"name":"sai","action":"get.transit"},"data":{"serverId":"' + serverId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobTransitAdd = function(serverId, ip, description) {
    description = description || "";
    var msg = '42["event",{"event":{"name":"sai","action":"transit.add"},"data":{"serverId":"' + serverId + '","ip":"' + ip + '","description":"' + description + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobOpenFolder = function(folderId) {
    var msg = '42["event",{"event":{"name":"desktop","action":"open.folder"},"data":{"folderId":"' + folderId + '","source":"desktop"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobGetDesktopOptions = function() {
    var msg = '42["event",{"event":{"name":"desktop","action":"get.options"},"data":{}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobDecryptFile = function(fileId) {
    var msg = '42["event",{"event":{"name":"desktop","action":"decrypt.file"},"data":{"fileId":"' + fileId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobGetNetworkMap = function() {
    var msg = '42["event",{"event":{"name":"network-map","action":"get.map"},"data":{}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobFileDelete = function(serverId, fileId) {
    var msg = '42["event",{"event":{"name":"sai","action":"file.delete"},"data":{"serverId":"' + serverId + '","fileId":"' + fileId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobFileUpload = function(serverId, name, sizeMb) {
    var msg = '42["event",{"event":{"name":"sai","action":"file.upload"},"data":{"serverId":"' + serverId + '","name":"' + name + '","sizeMb":' + (sizeMb || 0) + "}}]";
    wsSend(msg);
  };
  window.__cor3AutoJobTransitRemove = function(serverId, ip) {
    var msg = '42["event",{"event":{"name":"sai","action":"transit.remove"},"data":{"serverId":"' + serverId + '","ip":"' + ip + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobGetFileAnalysis = function(fileId) {
    var msg = '42["event",{"event":{"name":"desktop","action":"get.file.analysis"},"data":{"fileId":"' + fileId + '","source":"desktop"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobRequestLoadout = function() {
    var msg = '42["event",{"event":{"name":"loadout","action":"get.options"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobEquipHardware = function(moduleConfigId) {
    var msg = '42["event",{"event":{"name":"loadout","action":"equip.hardware"},"data":{"moduleConfigId":"' + moduleConfigId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobEquipSoftware = function(moduleConfigId) {
    var msg = '42["event",{"event":{"name":"loadout","action":"equip.software"},"data":{"moduleConfigId":"' + moduleConfigId + '"}}]';
    wsSend(msg);
  };
  window.__cor3AutoJobUnequipSoftware = function(moduleConfigId) {
    var msg = '42["event",{"event":{"name":"loadout","action":"unequip.software"},"data":{"moduleConfigId":"' + moduleConfigId + '"}}]';
    wsSend(msg);
  };
  window.__cor3ValuableFileSearch = function(serverId) {
    var msg = '42["event",{"event":{"name":"sai","action":"file.search-valuable"},"data":{"serverId":"' + serverId + '"}}]';
    wsSend(msg);
  };
  window.__cor3ValuableLogSearch = function(serverId) {
    var msg = '42["event",{"event":{"name":"sai","action":"log.search-valuable"},"data":{"serverId":"' + serverId + '"}}]';
    wsSend(msg);
  };
  window.__cor3ValuableGetSellableItems = function(marketId) {
    var msg = '42["event",{"event":{"name":"market","action":"get.sellable-items"},"data":{"marketId":"' + marketId + '"}}]';
    wsSend(msg);
  };
  window.__cor3ValuableSellItems = function(marketId, items) {
    var msg = '42["event",{"event":{"name":"market","action":"sell.items"},"data":{"marketId":"' + marketId + '","items":' + JSON.stringify(items) + "}}]";
    wsSend(msg);
  };
  window.__cor3RequestUpdater = function() {
    console.log("[COR3 Helper] Requesting updater data");
    var msg = '42["event",{"event":{"name":"updater","action":"get.patches"},"data":{}}]';
    wsSend(msg);
  };

  // src/content-early/market-requests.js
  function trackMarketRequest(marketId) {
    window.__cor3CurrentMarketFetch = marketId;
  }
  function __cor3WaitForMsg(eventType, timeoutMs) {
    return new Promise(function(resolve, reject) {
      var timer;
      function handler(evt) {
        if (evt.data && evt.data.type === eventType) {
          window.removeEventListener("message", handler);
          clearTimeout(timer);
          resolve(evt.data);
        }
      }
      window.addEventListener("message", handler);
      timer = setTimeout(function() {
        window.removeEventListener("message", handler);
        reject(new Error("Timeout waiting for " + eventType));
      }, timeoutMs || 1e4);
    });
  }
  function __cor3EnsureServerAccess(serverId, serverName) {
    return new Promise(function(resolve, reject) {
      console.log("[COR3 Helper] Path-through: checking access to " + serverName);
      var getLoginStatus = '42["event",{"event":{"name":"sai","action":"get.login.status"},"data":{"serverId":"' + serverId + '"}}]';
      wsSend(getLoginStatus);
      __cor3WaitForMsg("COR3_AUTOJOB_SAI_LOGIN_STATUS", 1e4).then(function(loginData) {
        if (loginData.data && loginData.data.activeAccesses && loginData.data.activeAccesses.length > 0) {
          console.log("[COR3 Helper] Path-through: " + serverName + " already has access");
          resolve();
          return;
        }
        console.log("[COR3 Helper] Path-through: " + serverName + " no access \u2014 hacking...");
        window.postMessage({ type: "COR3_AUTOJOB_ENABLE_DECRYPT_SOLVER" }, "*");
        var hackStart = '42["event",{"event":{"name":"sai","action":"hack.start"},"data":{"serverId":"' + serverId + '"}}]';
        wsSend(hackStart);
        __cor3WaitForMsg("COR3_AUTOJOB_SAI_HACK_START", 3e4).then(function(hackData) {
          if (hackData.error) {
            reject(new Error(serverName + " hack failed: " + (hackData.error.message || JSON.stringify(hackData.error))));
            return;
          }
          console.log("[COR3 Helper] Path-through: " + serverName + " hack started, waiting for solver...");
          __cor3WaitForMsg("COR3_AUTOJOB_SAI_UPDATE", 5e3).catch(function() {
          }).then(function() {
            var retries = 3;
            function checkAccess(attempt) {
              console.log("[COR3 Helper] Path-through: " + serverName + " checking access (attempt " + attempt + "/" + retries + ")");
              wsSend(getLoginStatus);
              __cor3WaitForMsg("COR3_AUTOJOB_SAI_LOGIN_STATUS", 5e3).then(function(data) {
                if (data.data && data.data.activeAccesses && data.data.activeAccesses.length > 0) {
                  console.log("[COR3 Helper] Path-through: " + serverName + " access confirmed");
                  resolve();
                } else if (attempt < retries) {
                  setTimeout(function() {
                    checkAccess(attempt + 1);
                  }, 3e3);
                } else {
                  reject(new Error(serverName + " no access after hack"));
                }
              }).catch(function() {
                if (attempt < retries) {
                  setTimeout(function() {
                    checkAccess(attempt + 1);
                  }, 3e3);
                } else {
                  reject(new Error(serverName + " login status timeout"));
                }
              });
            }
            setTimeout(function() {
              checkAccess(1);
            }, 1500);
          });
        }).catch(function(e) {
          reject(new Error(serverName + " hack start timeout"));
        });
      }).catch(function() {
        reject(new Error(serverName + " login status timeout"));
      });
    });
  }
  var MARKET_CONFIG = {
    dark: { serverId: DARK_SERVER_ID, marketId: DARK_MARKET_ID, flag: "__cor3DarkMarketPathThrough", unreachableMsg: "COR3_WS_DARK_MARKET_UNREACHABLE" },
    soyuz: { serverId: SOYUZ_SERVER_ID, marketId: SOYUZ_MARKET_ID, flag: "__cor3SoyuzMarketPathThrough", unreachableMsg: "COR3_WS_SOYUZ_MARKET_UNREACHABLE" },
    usol: { serverId: USOL_SERVER_ID, marketId: USOL_MARKET_ID, flag: "__cor3UsolMarketPathThrough", unreachableMsg: "COR3_WS_USOL_MARKET_UNREACHABLE" }
  };
  function __cor3FetchMapData() {
    return new Promise(function(resolve) {
      var getMap = '42["event",{"event":{"name":"network-map","action":"get.map"},"data":{}}]';
      wsSend(getMap);
      var done = false;
      function onMap(evt) {
        if (done) return;
        if (evt.data && evt.data.type === "COR3_WS_MAP_DATA" && evt.data.servers) {
          done = true;
          window.removeEventListener("message", onMap);
          clearTimeout(mapTimer);
          resolve({ servers: evt.data.servers, connections: evt.data.connections || [] });
        }
      }
      window.addEventListener("message", onMap);
      var mapTimer = setTimeout(function() {
        if (!done) {
          done = true;
          window.removeEventListener("message", onMap);
          resolve(null);
        }
      }, 1e4);
    });
  }
  function __cor3FindPathsToServer(servers, connections, targetServerId) {
    var serverLookup = {};
    var adjacency = {};
    var homeId = null;
    for (var i = 0; i < servers.length; i++) {
      var s = servers[i];
      serverLookup[s.id] = s;
      adjacency[s.id] = [];
      if (s.serverTypeName === "Home" || s.serverName === "Home Server") {
        homeId = s.id;
      }
    }
    for (var j = 0; j < connections.length; j++) {
      var c = connections[j];
      if (adjacency[c.serverA] && adjacency[c.serverB]) {
        adjacency[c.serverA].push(c.serverB);
        adjacency[c.serverB].push(c.serverA);
      }
    }
    if (!homeId) return [];
    var allPaths = [];
    var visited = {};
    var now = Date.now();
    function dfs(currentId, path) {
      if (currentId === targetServerId) {
        allPaths.push(path.slice());
        return;
      }
      var neighbors = adjacency[currentId] || [];
      for (var ni = 0; ni < neighbors.length; ni++) {
        var nb = neighbors[ni];
        if (!visited[nb]) {
          if (nb !== targetServerId) {
            var nbInfo = serverLookup[nb];
            if (nbInfo && nbInfo.isInMaintenance) {
              var mEnd = nbInfo.maintenanceEndsAt ? new Date(nbInfo.maintenanceEndsAt).getTime() - now : 0;
              if (mEnd > 0) continue;
            }
          }
          visited[nb] = true;
          var nbSrv = serverLookup[nb];
          path.push({ id: nb, name: nbSrv ? nbSrv.serverName : nb.substring(0, 8) });
          dfs(nb, path);
          path.pop();
          visited[nb] = false;
        }
      }
    }
    visited[homeId] = true;
    dfs(homeId, []);
    allPaths.sort(function(a, b) {
      return a.length - b.length;
    });
    return allPaths;
  }
  function __cor3FindMaintenanceBlocker(servers, connections, targetServerId) {
    var serverLookup = {};
    var adjacency = {};
    var homeId = null;
    for (var i = 0; i < servers.length; i++) {
      var s = servers[i];
      serverLookup[s.id] = s;
      adjacency[s.id] = [];
      if (s.serverTypeName === "Home" || s.serverName === "Home Server") homeId = s.id;
    }
    for (var j = 0; j < connections.length; j++) {
      var c = connections[j];
      if (adjacency[c.serverA] && adjacency[c.serverB]) {
        adjacency[c.serverA].push(c.serverB);
        adjacency[c.serverB].push(c.serverA);
      }
    }
    if (!homeId) return null;
    var visited = {};
    var queue = [homeId];
    var parent = {};
    visited[homeId] = true;
    while (queue.length > 0) {
      var cur = queue.shift();
      if (cur === targetServerId) break;
      var nbrs = adjacency[cur] || [];
      for (var ni = 0; ni < nbrs.length; ni++) {
        if (!visited[nbrs[ni]]) {
          visited[nbrs[ni]] = true;
          parent[nbrs[ni]] = cur;
          queue.push(nbrs[ni]);
        }
      }
    }
    if (!visited[targetServerId]) return { blockerName: "no-path", maintenanceEndsAt: null };
    var pathIds = [];
    var at = targetServerId;
    while (at && at !== homeId) {
      pathIds.unshift(at);
      at = parent[at];
    }
    var now = Date.now();
    for (var pi = 0; pi < pathIds.length; pi++) {
      var srv = serverLookup[pathIds[pi]];
      if (srv && srv.isInMaintenance) {
        var rem = srv.maintenanceEndsAt ? new Date(srv.maintenanceEndsAt).getTime() - now : 0;
        if (rem > 0) return { blockerName: srv.serverName, maintenanceEndsAt: srv.maintenanceEndsAt };
      }
    }
    return null;
  }
  function __cor3PostUnreachable2(marketType, serverName) {
    var cfg = MARKET_CONFIG[marketType];
    var msgType = cfg ? cfg.unreachableMsg : "COR3_WS_DARK_MARKET_UNREACHABLE";
    var targetServerId = cfg ? cfg.serverId : null;
    __cor3FetchMapData().then(function(mapData) {
      var blocker = null;
      if (mapData && targetServerId) {
        blocker = __cor3FindMaintenanceBlocker(mapData.servers, mapData.connections, targetServerId);
      }
      if (blocker) {
        window.__cor3UnreachableMarkets[marketType] = {
          blockerName: blocker.blockerName,
          maintenanceEndsAt: blocker.maintenanceEndsAt,
          detectedAt: Date.now()
        };
        console.log("[COR3 Helper] Cached unreachable " + marketType + ": " + blocker.blockerName + " maintenance until " + (blocker.maintenanceEndsAt || "unknown"));
      }
      window.postMessage({
        type: msgType,
        error: "no-path-to-server",
        blockerServerName: blocker ? blocker.blockerName : serverName || null,
        maintenanceEndsAt: blocker ? blocker.maintenanceEndsAt : null
      }, "*");
    });
  }
  window.__cor3DarkMarketPathThrough = false;
  window.__cor3SoyuzMarketPathThrough = false;
  window.__cor3UsolMarketPathThrough = false;
  function __cor3MarketPathThroughRetry(marketType) {
    var cfg = MARKET_CONFIG[marketType];
    if (!cfg) return;
    var label = marketType.toUpperCase();
    window[cfg.flag] = true;
    console.log("[COR3 Helper] Path-through: fetching network map for " + label + " dynamic pathing");
    __cor3FetchMapData().then(function(mapData) {
      if (!mapData) {
        window[cfg.flag] = false;
        console.log("[COR3 Helper] Path-through: map data timeout \u2014 aborting " + label);
        __cor3PostUnreachable2(marketType, null);
        return;
      }
      var paths = __cor3FindPathsToServer(mapData.servers, mapData.connections, cfg.serverId);
      if (paths.length === 0) {
        window[cfg.flag] = false;
        console.log("[COR3 Helper] Path-through: no viable paths to " + label + " (all blocked by maintenance)");
        __cor3PostUnreachable2(marketType, null);
        return;
      }
      console.log("[COR3 Helper] Path-through: found " + paths.length + " viable path(s) to " + label);
      var pathIdx = 0;
      function tryNextPath() {
        if (pathIdx >= paths.length) {
          window[cfg.flag] = false;
          console.log("[COR3 Helper] Path-through: all " + paths.length + " path(s) exhausted for " + label);
          __cor3PostUnreachable2(marketType, null);
          return;
        }
        var currentPath = paths[pathIdx];
        pathIdx++;
        var intermediates = currentPath.length > 1 ? currentPath.slice(0, currentPath.length - 1) : [];
        if (intermediates.length === 0) {
          retryTargetEndpoint();
          return;
        }
        var pathNames = currentPath.map(function(s) {
          return s.name;
        }).join(" \u2192 ");
        console.log("[COR3 Helper] Path-through: trying path " + pathIdx + "/" + paths.length + ": " + pathNames);
        var stepIdx = 0;
        function nextStep() {
          if (stepIdx >= intermediates.length) {
            retryTargetEndpoint();
            return;
          }
          var server = intermediates[stepIdx];
          stepIdx++;
          console.log("[COR3 Helper] Path-through: step " + stepIdx + "/" + intermediates.length + ": setting endpoint to " + server.name);
          var setEp = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + server.id + '"}}]';
          wsSend(setEp);
          var epDone = false;
          function onEndpoint(evt) {
            if (epDone) return;
            if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
              epDone = true;
              window.removeEventListener("message", onEndpoint);
              clearTimeout(epTimer);
              if (evt.data.success === false) {
                var errMsg = evt.data.error && evt.data.error.message ? evt.data.error.message : "unknown";
                if (errMsg === "server-in-maintenance") {
                  console.log("[COR3 Helper] Path-through: " + server.name + " in maintenance \u2014 trying next path");
                  tryNextPath();
                } else {
                  console.log("[COR3 Helper] Path-through: " + server.name + " unreachable (" + errMsg + ") \u2014 trying next path");
                  tryNextPath();
                }
                return;
              }
              __cor3EnsureServerAccess(server.id, server.name).then(function() {
                setTimeout(nextStep, 500);
              }).catch(function(e) {
                console.log("[COR3 Helper] Path-through: " + server.name + " access failed \u2014 " + e.message + " \u2014 trying next path");
                tryNextPath();
              });
            }
          }
          window.addEventListener("message", onEndpoint);
          var epTimer = setTimeout(function() {
            if (!epDone) {
              epDone = true;
              window.removeEventListener("message", onEndpoint);
              __cor3EnsureServerAccess(server.id, server.name).then(function() {
                setTimeout(nextStep, 500);
              }).catch(function() {
                tryNextPath();
              });
            }
          }, 1e4);
        }
        nextStep();
      }
      function retryTargetEndpoint() {
        window[cfg.flag] = false;
        console.log("[COR3 Helper] Path-through: all intermediates done, retrying " + label + " endpoint");
        var setEndpoint = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + cfg.serverId + '"}}]';
        wsSend(setEndpoint);
        var retryDone = false;
        function onRetryResult(evt) {
          if (retryDone) return;
          if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
            retryDone = true;
            window.removeEventListener("message", onRetryResult);
            clearTimeout(retryTimer);
            if (evt.data.success === false) {
              var retryErr = evt.data.error && evt.data.error.message ? evt.data.error.message : "unknown";
              console.log("[COR3 Helper] Path-through: " + label + " endpoint retry failed (" + retryErr + ")");
              __cor3PostUnreachable2(marketType, null);
              return;
            }
            console.log("[COR3 Helper] Path-through: " + label + " endpoint set successfully");
            var getOptions = '42["event",{"event":{"name":"market","action":"get.options"},"data":{"marketId":"' + cfg.marketId + '"}}]';
            wsSend(getOptions);
          }
          if (evt.data && evt.data.type === cfg.unreachableMsg) {
            retryDone = true;
            window.removeEventListener("message", onRetryResult);
            clearTimeout(retryTimer);
            console.log("[COR3 Helper] Path-through: " + label + " endpoint still unreachable after path-through");
          }
        }
        window.addEventListener("message", onRetryResult);
        var retryTimer = setTimeout(function() {
          if (!retryDone) {
            retryDone = true;
            window.removeEventListener("message", onRetryResult);
          }
        }, 1e4);
      }
      tryNextPath();
    });
  }
  window.__cor3RequestMarket = function(callback) {
    var myAbortId = getMarketRefreshAbortId();
    console.log("[COR3 Helper] Requesting HOME market (batch: options+lots+jobs)");
    trackMarketRequest(HOME_MARKET_ID);
    var getOptions = '42["event",{"event":{"name":"market","action":"get.options"},"data":{"marketId":"' + HOME_MARKET_ID + '"}}]';
    var getLots = '42["event",{"event":{"name":"market","action":"get.lots"},"data":{"marketId":"' + HOME_MARKET_ID + '"}}]';
    var getJobs = '42["event",{"event":{"name":"market","action":"get.jobs"},"data":{"marketId":"' + HOME_MARKET_ID + '"}}]';
    wsSend(getOptions);
    wsSend(getLots);
    wsSend(getJobs);
    function onComplete(evt) {
      if (!evt.data) return;
      if (myAbortId !== getMarketRefreshAbortId()) {
        window.removeEventListener("message", onComplete);
        clearTimeout(homeTimer);
        console.log("[COR3 Helper] HOME market fetch aborted (token-expired)");
        return;
      }
      if (evt.data.type === "COR3_MARKET_FETCH_COMPLETE" && evt.data.marketType === "home") {
        window.removeEventListener("message", onComplete);
        clearTimeout(homeTimer);
        console.log("[COR3 Helper] HOME market fetch complete");
        if (callback) callback();
      }
    }
    window.addEventListener("message", onComplete);
    var homeTimer = setTimeout(function() {
      window.removeEventListener("message", onComplete);
      console.log("[COR3 Helper] HOME market fetch timeout");
      if (callback) callback();
    }, 15e3);
    return true;
  };
  window.__cor3RequestDarkMarket = function(callback) {
    var cachedUnreachable = window.__cor3IsMarketUnreachable("dark");
    if (cachedUnreachable) {
      console.log("[COR3 Helper] D4RK market known unreachable (" + cachedUnreachable.blockerName + " maintenance) \u2014 skipping set.endpoint");
      window.postMessage({
        type: "COR3_WS_DARK_MARKET_UNREACHABLE",
        error: "no-path-to-server",
        blockerServerName: cachedUnreachable.blockerName,
        maintenanceEndsAt: cachedUnreachable.maintenanceEndsAt,
        cached: true
      }, "*");
      if (callback) callback();
      return true;
    }
    var myAbortId = getMarketRefreshAbortId();
    console.log("[COR3 Helper] Setting D4RK endpoint");
    var setEndpoint = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + DARK_SERVER_ID + '"}}]';
    window.__cor3DarkMarketPending = true;
    wsSend(setEndpoint);
    function fetchDarkBatch(cb) {
      if (myAbortId !== getMarketRefreshAbortId()) {
        console.log("[COR3 Helper] D4RK market fetch aborted (token-expired)");
        return;
      }
      console.log("[COR3 Helper] Requesting D4RK market (batch: options+lots+jobs)");
      trackMarketRequest(DARK_MARKET_ID);
      var getOptions = '42["event",{"event":{"name":"market","action":"get.options"},"data":{"marketId":"' + DARK_MARKET_ID + '"}}]';
      var getLots = '42["event",{"event":{"name":"market","action":"get.lots"},"data":{"marketId":"' + DARK_MARKET_ID + '"}}]';
      var getJobs = '42["event",{"event":{"name":"market","action":"get.jobs"},"data":{"marketId":"' + DARK_MARKET_ID + '"}}]';
      wsSend(getOptions);
      wsSend(getLots);
      wsSend(getJobs);
      function onComplete(evt) {
        if (!evt.data) return;
        if (myAbortId !== getMarketRefreshAbortId()) {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          console.log("[COR3 Helper] D4RK market fetch aborted (token-expired)");
          return;
        }
        if (evt.data.type === "COR3_MARKET_FETCH_COMPLETE" && evt.data.marketType === "dark") {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          console.log("[COR3 Helper] D4RK market fetch complete");
          if (cb) cb();
        }
      }
      window.addEventListener("message", onComplete);
      var tmr = setTimeout(function() {
        window.removeEventListener("message", onComplete);
        console.log("[COR3 Helper] D4RK market fetch timeout");
        if (cb) cb();
      }, 15e3);
    }
    var handled = false;
    function onDarkEndpoint(evt) {
      if (handled) return;
      if (myAbortId !== getMarketRefreshAbortId()) {
        handled = true;
        window.removeEventListener("message", onDarkEndpoint);
        clearTimeout(darkEpTimer);
        window.__cor3DarkMarketPending = false;
        console.log("[COR3 Helper] D4RK endpoint aborted (token-expired)");
        return;
      }
      if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
        handled = true;
        window.removeEventListener("message", onDarkEndpoint);
        clearTimeout(darkEpTimer);
        window.__cor3DarkMarketPending = false;
        fetchDarkBatch(callback);
      }
      if (evt.data && evt.data.type === "COR3_WS_DARK_MARKET_UNREACHABLE") {
        handled = true;
        window.removeEventListener("message", onDarkEndpoint);
        clearTimeout(darkEpTimer);
        window.__cor3DarkMarketPending = false;
        console.log("[COR3 Helper] D4RK endpoint unreachable \u2014 attempting path-through");
        __cor3MarketPathThroughRetry("dark");
        if (callback) callback();
      }
    }
    window.addEventListener("message", onDarkEndpoint);
    var darkEpTimer = setTimeout(function() {
      if (!handled) {
        handled = true;
        window.removeEventListener("message", onDarkEndpoint);
        window.__cor3DarkMarketPending = false;
        console.log("[COR3 Helper] D4RK endpoint timeout \u2014 requesting market data anyway");
        fetchDarkBatch(callback);
      }
    }, 5e3);
    return true;
  };
  window.__cor3RefreshMarket = function(callback) {
    window.__cor3RequestMarket(callback);
    return true;
  };
  window.__cor3RefreshDarkMarket = function(callback) {
    window.__cor3RequestDarkMarket(callback);
    return true;
  };
  window.__cor3RequestSoyuzMarket = function(callback) {
    var cachedUnreachable = window.__cor3IsMarketUnreachable("soyuz");
    if (cachedUnreachable) {
      console.log("[COR3 Helper] SOYUZ market known unreachable (" + cachedUnreachable.blockerName + " maintenance) \u2014 skipping set.endpoint");
      window.postMessage({
        type: "COR3_WS_SOYUZ_MARKET_UNREACHABLE",
        error: "no-path-to-server",
        blockerServerName: cachedUnreachable.blockerName,
        maintenanceEndsAt: cachedUnreachable.maintenanceEndsAt,
        cached: true
      }, "*");
      if (callback) callback();
      return true;
    }
    var myAbortId = getMarketRefreshAbortId();
    console.log("[COR3 Helper] Setting SOYUZ endpoint");
    var setEndpoint = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + SOYUZ_SERVER_ID + '"}}]';
    window.__cor3SoyuzMarketPending = true;
    wsSend(setEndpoint);
    function fetchSoyuzBatch(cb) {
      if (myAbortId !== getMarketRefreshAbortId()) {
        console.log("[COR3 Helper] SOYUZ market fetch aborted (token-expired)");
        return;
      }
      console.log("[COR3 Helper] Requesting SOYUZ market (batch: options+lots+jobs)");
      trackMarketRequest(SOYUZ_MARKET_ID);
      var getOptions = '42["event",{"event":{"name":"market","action":"get.options"},"data":{"marketId":"' + SOYUZ_MARKET_ID + '"}}]';
      var getLots = '42["event",{"event":{"name":"market","action":"get.lots"},"data":{"marketId":"' + SOYUZ_MARKET_ID + '"}}]';
      var getJobs = '42["event",{"event":{"name":"market","action":"get.jobs"},"data":{"marketId":"' + SOYUZ_MARKET_ID + '"}}]';
      wsSend(getOptions);
      wsSend(getLots);
      wsSend(getJobs);
      function onComplete(evt) {
        if (!evt.data) return;
        if (myAbortId !== getMarketRefreshAbortId()) {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          console.log("[COR3 Helper] SOYUZ market fetch aborted (token-expired)");
          return;
        }
        if (evt.data.type === "COR3_MARKET_FETCH_COMPLETE" && evt.data.marketType === "soyuz") {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          console.log("[COR3 Helper] SOYUZ market fetch complete");
          if (cb) cb();
        }
      }
      window.addEventListener("message", onComplete);
      var tmr = setTimeout(function() {
        window.removeEventListener("message", onComplete);
        console.log("[COR3 Helper] SOYUZ market fetch timeout");
        if (cb) cb();
      }, 15e3);
    }
    var handled = false;
    function onSoyuzEndpoint(evt) {
      if (handled) return;
      if (myAbortId !== getMarketRefreshAbortId()) {
        handled = true;
        window.removeEventListener("message", onSoyuzEndpoint);
        clearTimeout(soyuzEpTimer);
        window.__cor3SoyuzMarketPending = false;
        console.log("[COR3 Helper] SOYUZ endpoint aborted (token-expired)");
        return;
      }
      if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
        handled = true;
        window.removeEventListener("message", onSoyuzEndpoint);
        clearTimeout(soyuzEpTimer);
        window.__cor3SoyuzMarketPending = false;
        fetchSoyuzBatch(callback);
      }
      if (evt.data && evt.data.type === "COR3_WS_SOYUZ_MARKET_UNREACHABLE") {
        handled = true;
        window.removeEventListener("message", onSoyuzEndpoint);
        clearTimeout(soyuzEpTimer);
        window.__cor3SoyuzMarketPending = false;
        console.log("[COR3 Helper] SOYUZ endpoint unreachable \u2014 attempting path-through");
        __cor3MarketPathThroughRetry("soyuz");
        if (callback) callback();
      }
    }
    window.addEventListener("message", onSoyuzEndpoint);
    var soyuzEpTimer = setTimeout(function() {
      if (!handled) {
        handled = true;
        window.removeEventListener("message", onSoyuzEndpoint);
        window.__cor3SoyuzMarketPending = false;
        console.log("[COR3 Helper] SOYUZ endpoint timeout");
        if (callback) callback();
      }
    }, 1e4);
    return true;
  };
  window.__cor3RefreshSoyuzMarket = function(callback) {
    window.__cor3RequestSoyuzMarket(callback);
    return true;
  };
  window.__cor3RequestUsolMarket = function(callback) {
    var cachedUnreachable = window.__cor3IsMarketUnreachable("usol");
    if (cachedUnreachable) {
      console.log("[COR3 Helper] USOL market known unreachable (" + cachedUnreachable.blockerName + " maintenance) \u2014 skipping set.endpoint");
      window.postMessage({
        type: "COR3_WS_USOL_MARKET_UNREACHABLE",
        error: "no-path-to-server",
        blockerServerName: cachedUnreachable.blockerName,
        maintenanceEndsAt: cachedUnreachable.maintenanceEndsAt,
        cached: true
      }, "*");
      if (callback) callback();
      return true;
    }
    var myAbortId = getMarketRefreshAbortId();
    console.log("[COR3 Helper] Setting USOL endpoint");
    var setEndpoint = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + USOL_SERVER_ID + '"}}]';
    window.__cor3UsolMarketPending = true;
    wsSend(setEndpoint);
    function fetchUsolBatch(cb) {
      if (myAbortId !== getMarketRefreshAbortId()) {
        console.log("[COR3 Helper] USOL market fetch aborted (token-expired)");
        return;
      }
      console.log("[COR3 Helper] Requesting USOL market (batch: options+lots+jobs)");
      trackMarketRequest(USOL_MARKET_ID);
      var getOptions = '42["event",{"event":{"name":"market","action":"get.options"},"data":{"marketId":"' + USOL_MARKET_ID + '"}}]';
      var getLots = '42["event",{"event":{"name":"market","action":"get.lots"},"data":{"marketId":"' + USOL_MARKET_ID + '"}}]';
      var getJobs = '42["event",{"event":{"name":"market","action":"get.jobs"},"data":{"marketId":"' + USOL_MARKET_ID + '"}}]';
      wsSend(getOptions);
      wsSend(getLots);
      wsSend(getJobs);
      function onComplete(evt) {
        if (!evt.data) return;
        if (myAbortId !== getMarketRefreshAbortId()) {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          console.log("[COR3 Helper] USOL market fetch aborted (token-expired)");
          return;
        }
        if (evt.data.type === "COR3_MARKET_FETCH_COMPLETE" && evt.data.marketType === "usol") {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          console.log("[COR3 Helper] USOL market fetch complete");
          if (cb) cb();
        }
      }
      window.addEventListener("message", onComplete);
      var tmr = setTimeout(function() {
        window.removeEventListener("message", onComplete);
        console.log("[COR3 Helper] USOL market fetch timeout");
        if (cb) cb();
      }, 15e3);
    }
    var handled = false;
    function onUsolEndpoint(evt) {
      if (handled) return;
      if (myAbortId !== getMarketRefreshAbortId()) {
        handled = true;
        window.removeEventListener("message", onUsolEndpoint);
        clearTimeout(usolEpTimer);
        window.__cor3UsolMarketPending = false;
        console.log("[COR3 Helper] USOL endpoint aborted (token-expired)");
        return;
      }
      if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
        handled = true;
        window.removeEventListener("message", onUsolEndpoint);
        clearTimeout(usolEpTimer);
        window.__cor3UsolMarketPending = false;
        fetchUsolBatch(callback);
      }
      if (evt.data && evt.data.type === "COR3_WS_USOL_MARKET_UNREACHABLE") {
        handled = true;
        window.removeEventListener("message", onUsolEndpoint);
        clearTimeout(usolEpTimer);
        window.__cor3UsolMarketPending = false;
        console.log("[COR3 Helper] USOL endpoint unreachable \u2014 attempting path-through");
        __cor3MarketPathThroughRetry("usol");
        if (callback) callback();
      }
    }
    window.addEventListener("message", onUsolEndpoint);
    var usolEpTimer = setTimeout(function() {
      if (!handled) {
        handled = true;
        window.removeEventListener("message", onUsolEndpoint);
        window.__cor3UsolMarketPending = false;
        console.log("[COR3 Helper] USOL endpoint timeout");
        if (callback) callback();
      }
    }, 1e4);
    return true;
  };
  window.__cor3RefreshUsolMarket = function(callback) {
    window.__cor3RequestUsolMarket(callback);
    return true;
  };
  window.__cor3RefreshAllMarketsSequential = function(callback, opts) {
    opts = opts || {};
    var order = opts.order || ["usol", "soyuz", "dark", "home"];
    var skipLots = !!opts.skipLots;
    var idx = 0;
    var myAbortId = getMarketRefreshAbortId();
    function refreshNext() {
      if (myAbortId !== getMarketRefreshAbortId()) {
        console.log("[COR3 Helper] Sequential refresh aborted (token-expired)");
        window.postMessage({ type: "COR3_ALL_MARKETS_REFRESHED" }, "*");
        return;
      }
      if (idx >= order.length) {
        console.log("[COR3 Helper] Sequential refresh: all markets done");
        window.postMessage({ type: "COR3_ALL_MARKETS_REFRESHED" }, "*");
        if (callback) callback();
        return;
      }
      var market = order[idx];
      idx++;
      console.log("[COR3 Helper] Sequential refresh: starting " + market.toUpperCase());
      if (market === "usol") {
        if (skipLots) {
          window.__cor3RequestUsolMarketJobsOnly(function() {
            refreshNext();
          });
        } else {
          window.__cor3RequestUsolMarket(function() {
            refreshNext();
          });
        }
      } else if (market === "soyuz") {
        if (skipLots) {
          window.__cor3RequestSoyuzMarketJobsOnly(function() {
            refreshNext();
          });
        } else {
          window.__cor3RequestSoyuzMarket(function() {
            refreshNext();
          });
        }
      } else if (market === "dark") {
        if (skipLots) {
          window.__cor3RequestDarkMarketJobsOnly(function() {
            refreshNext();
          });
        } else {
          window.__cor3RequestDarkMarket(function() {
            refreshNext();
          });
        }
      } else {
        if (skipLots) {
          window.__cor3RequestMarketJobsOnly(function() {
            refreshNext();
          });
        } else {
          window.__cor3RequestMarket(function() {
            refreshNext();
          });
        }
      }
    }
    refreshNext();
    return true;
  };
  window.__cor3RequestMarketJobsOnly = function(callback) {
    var myAbortId = getMarketRefreshAbortId();
    console.log("[COR3 Helper] Requesting HOME market (batch: options+jobs, jobs-only)");
    trackMarketRequest(HOME_MARKET_ID);
    var getOptions = '42["event",{"event":{"name":"market","action":"get.options"},"data":{"marketId":"' + HOME_MARKET_ID + '"}}]';
    var getJobs = '42["event",{"event":{"name":"market","action":"get.jobs"},"data":{"marketId":"' + HOME_MARKET_ID + '"}}]';
    wsSend(getOptions);
    wsSend(getJobs);
    function onComplete(evt) {
      if (!evt.data) return;
      if (myAbortId !== getMarketRefreshAbortId()) {
        window.removeEventListener("message", onComplete);
        clearTimeout(tmr);
        return;
      }
      if (evt.data.type === "COR3_MARKET_FETCH_COMPLETE" && evt.data.marketType === "home") {
        window.removeEventListener("message", onComplete);
        clearTimeout(tmr);
        console.log("[COR3 Helper] HOME market jobs-only fetch complete");
        if (callback) callback();
      }
    }
    window.addEventListener("message", onComplete);
    var tmr = setTimeout(function() {
      window.removeEventListener("message", onComplete);
      console.log("[COR3 Helper] HOME market jobs-only fetch timeout");
      if (callback) callback();
    }, 15e3);
  };
  window.__cor3RequestDarkMarketJobsOnly = function(callback) {
    var cachedUnreachable = window.__cor3IsMarketUnreachable("dark");
    if (cachedUnreachable) {
      console.log("[COR3 Helper] D4RK market known unreachable (" + cachedUnreachable.blockerName + " maintenance) \u2014 skipping jobs-only");
      window.postMessage({ type: "COR3_WS_DARK_MARKET_UNREACHABLE", error: "no-path-to-server", blockerServerName: cachedUnreachable.blockerName, maintenanceEndsAt: cachedUnreachable.maintenanceEndsAt, cached: true }, "*");
      if (callback) callback();
      return true;
    }
    var myAbortId = getMarketRefreshAbortId();
    console.log("[COR3 Helper] Setting D4RK endpoint (jobs-only)");
    var setEndpoint = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + DARK_SERVER_ID + '"}}]';
    window.__cor3DarkMarketPending = true;
    wsSend(setEndpoint);
    function fetchDarkJobsBatch(cb) {
      if (myAbortId !== getMarketRefreshAbortId()) {
        console.log("[COR3 Helper] D4RK market jobs-only fetch aborted (token-expired)");
        return;
      }
      console.log("[COR3 Helper] Requesting D4RK market (batch: options+jobs, jobs-only)");
      trackMarketRequest(DARK_MARKET_ID);
      var getOptions = '42["event",{"event":{"name":"market","action":"get.options"},"data":{"marketId":"' + DARK_MARKET_ID + '"}}]';
      var getJobs = '42["event",{"event":{"name":"market","action":"get.jobs"},"data":{"marketId":"' + DARK_MARKET_ID + '"}}]';
      wsSend(getOptions);
      wsSend(getJobs);
      function onComplete(evt) {
        if (!evt.data) return;
        if (myAbortId !== getMarketRefreshAbortId()) {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          return;
        }
        if (evt.data.type === "COR3_MARKET_FETCH_COMPLETE" && evt.data.marketType === "dark") {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          console.log("[COR3 Helper] D4RK market jobs-only fetch complete");
          if (cb) cb();
        }
      }
      window.addEventListener("message", onComplete);
      var tmr = setTimeout(function() {
        window.removeEventListener("message", onComplete);
        console.log("[COR3 Helper] D4RK market jobs-only fetch timeout");
        if (cb) cb();
      }, 15e3);
    }
    var handled = false;
    function onEndpoint(evt) {
      if (handled) return;
      if (myAbortId !== getMarketRefreshAbortId()) {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        clearTimeout(epTmr);
        window.__cor3DarkMarketPending = false;
        return;
      }
      if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        clearTimeout(epTmr);
        window.__cor3DarkMarketPending = false;
        fetchDarkJobsBatch(callback);
      }
      if (evt.data && evt.data.type === "COR3_WS_DARK_MARKET_UNREACHABLE") {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        clearTimeout(epTmr);
        window.__cor3DarkMarketPending = false;
        console.log("[COR3 Helper] D4RK endpoint unreachable (jobs-only) \u2014 attempting path-through");
        __cor3MarketPathThroughRetry("dark");
        if (callback) callback();
      }
    }
    window.addEventListener("message", onEndpoint);
    var epTmr = setTimeout(function() {
      if (!handled) {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        window.__cor3DarkMarketPending = false;
        console.log("[COR3 Helper] D4RK endpoint timeout (jobs-only) \u2014 requesting data anyway");
        fetchDarkJobsBatch(callback);
      }
    }, 5e3);
  };
  window.__cor3RequestSoyuzMarketJobsOnly = function(callback) {
    var cachedUnreachable = window.__cor3IsMarketUnreachable("soyuz");
    if (cachedUnreachable) {
      console.log("[COR3 Helper] SOYUZ market known unreachable (" + cachedUnreachable.blockerName + " maintenance) \u2014 skipping jobs-only");
      window.postMessage({ type: "COR3_WS_SOYUZ_MARKET_UNREACHABLE", error: "no-path-to-server", blockerServerName: cachedUnreachable.blockerName, maintenanceEndsAt: cachedUnreachable.maintenanceEndsAt, cached: true }, "*");
      if (callback) callback();
      return true;
    }
    var myAbortId = getMarketRefreshAbortId();
    console.log("[COR3 Helper] Setting SOYUZ endpoint (jobs-only)");
    var setEndpoint = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + SOYUZ_SERVER_ID + '"}}]';
    window.__cor3SoyuzMarketPending = true;
    wsSend(setEndpoint);
    function fetchSoyuzJobsBatch(cb) {
      if (myAbortId !== getMarketRefreshAbortId()) {
        console.log("[COR3 Helper] SOYUZ market jobs-only fetch aborted (token-expired)");
        return;
      }
      console.log("[COR3 Helper] Requesting SOYUZ market (batch: options+jobs, jobs-only)");
      trackMarketRequest(SOYUZ_MARKET_ID);
      var getOptions = '42["event",{"event":{"name":"market","action":"get.options"},"data":{"marketId":"' + SOYUZ_MARKET_ID + '"}}]';
      var getJobs = '42["event",{"event":{"name":"market","action":"get.jobs"},"data":{"marketId":"' + SOYUZ_MARKET_ID + '"}}]';
      wsSend(getOptions);
      wsSend(getJobs);
      function onComplete(evt) {
        if (!evt.data) return;
        if (myAbortId !== getMarketRefreshAbortId()) {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          return;
        }
        if (evt.data.type === "COR3_MARKET_FETCH_COMPLETE" && evt.data.marketType === "soyuz") {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          console.log("[COR3 Helper] SOYUZ market jobs-only fetch complete");
          if (cb) cb();
        }
      }
      window.addEventListener("message", onComplete);
      var tmr = setTimeout(function() {
        window.removeEventListener("message", onComplete);
        console.log("[COR3 Helper] SOYUZ market jobs-only fetch timeout");
        if (cb) cb();
      }, 15e3);
    }
    var handled = false;
    function onEndpoint(evt) {
      if (handled) return;
      if (myAbortId !== getMarketRefreshAbortId()) {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        clearTimeout(epTmr);
        window.__cor3SoyuzMarketPending = false;
        return;
      }
      if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        clearTimeout(epTmr);
        window.__cor3SoyuzMarketPending = false;
        fetchSoyuzJobsBatch(callback);
      }
      if (evt.data && evt.data.type === "COR3_WS_SOYUZ_MARKET_UNREACHABLE") {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        clearTimeout(epTmr);
        window.__cor3SoyuzMarketPending = false;
        console.log("[COR3 Helper] SOYUZ endpoint unreachable (jobs-only) \u2014 attempting path-through");
        __cor3MarketPathThroughRetry("soyuz");
        if (callback) callback();
      }
    }
    window.addEventListener("message", onEndpoint);
    var epTmr = setTimeout(function() {
      if (!handled) {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        window.__cor3SoyuzMarketPending = false;
        console.log("[COR3 Helper] SOYUZ endpoint timeout (jobs-only)");
        if (callback) callback();
      }
    }, 1e4);
  };
  window.__cor3RequestUsolMarketJobsOnly = function(callback) {
    var cachedUnreachable = window.__cor3IsMarketUnreachable("usol");
    if (cachedUnreachable) {
      console.log("[COR3 Helper] USOL market known unreachable (" + cachedUnreachable.blockerName + " maintenance) \u2014 skipping jobs-only");
      window.postMessage({ type: "COR3_WS_USOL_MARKET_UNREACHABLE", error: "no-path-to-server", blockerServerName: cachedUnreachable.blockerName, maintenanceEndsAt: cachedUnreachable.maintenanceEndsAt, cached: true }, "*");
      if (callback) callback();
      return true;
    }
    var myAbortId = getMarketRefreshAbortId();
    console.log("[COR3 Helper] Setting USOL endpoint (jobs-only)");
    var setEndpoint = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + USOL_SERVER_ID + '"}}]';
    window.__cor3UsolMarketPending = true;
    wsSend(setEndpoint);
    function fetchUsolJobsBatch(cb) {
      if (myAbortId !== getMarketRefreshAbortId()) {
        console.log("[COR3 Helper] USOL market jobs-only fetch aborted (token-expired)");
        return;
      }
      console.log("[COR3 Helper] Requesting USOL market (batch: options+jobs, jobs-only)");
      trackMarketRequest(USOL_MARKET_ID);
      var getOptions = '42["event",{"event":{"name":"market","action":"get.options"},"data":{"marketId":"' + USOL_MARKET_ID + '"}}]';
      var getJobs = '42["event",{"event":{"name":"market","action":"get.jobs"},"data":{"marketId":"' + USOL_MARKET_ID + '"}}]';
      wsSend(getOptions);
      wsSend(getJobs);
      function onComplete(evt) {
        if (!evt.data) return;
        if (myAbortId !== getMarketRefreshAbortId()) {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          return;
        }
        if (evt.data.type === "COR3_MARKET_FETCH_COMPLETE" && evt.data.marketType === "usol") {
          window.removeEventListener("message", onComplete);
          clearTimeout(tmr);
          console.log("[COR3 Helper] USOL market jobs-only fetch complete");
          if (cb) cb();
        }
      }
      window.addEventListener("message", onComplete);
      var tmr = setTimeout(function() {
        window.removeEventListener("message", onComplete);
        console.log("[COR3 Helper] USOL market jobs-only fetch timeout");
        if (cb) cb();
      }, 15e3);
    }
    var handled = false;
    function onEndpoint(evt) {
      if (handled) return;
      if (myAbortId !== getMarketRefreshAbortId()) {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        clearTimeout(epTmr);
        window.__cor3UsolMarketPending = false;
        return;
      }
      if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        clearTimeout(epTmr);
        window.__cor3UsolMarketPending = false;
        fetchUsolJobsBatch(callback);
      }
      if (evt.data && evt.data.type === "COR3_WS_USOL_MARKET_UNREACHABLE") {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        clearTimeout(epTmr);
        window.__cor3UsolMarketPending = false;
        console.log("[COR3 Helper] USOL endpoint unreachable (jobs-only) \u2014 attempting path-through");
        __cor3MarketPathThroughRetry("usol");
        if (callback) callback();
      }
    }
    window.addEventListener("message", onEndpoint);
    var epTmr = setTimeout(function() {
      if (!handled) {
        handled = true;
        window.removeEventListener("message", onEndpoint);
        window.__cor3UsolMarketPending = false;
        console.log("[COR3 Helper] USOL endpoint timeout (jobs-only)");
        if (callback) callback();
      }
    }, 1e4);
  };

  // src/content-early/expeditions.js
  var DEFAULT_LOCATION_NAMES = ["Skylift Remains", "Koute Mining and Reprocessing Outpost"];
  window.__cor3PickDefaultLocation = function(locations) {
    if (!locations || locations.length === 0) return null;
    if (locations.length === 1) return locations[0];
    var def = null;
    for (var i = 0; i < locations.length; i++) {
      if (DEFAULT_LOCATION_NAMES.indexOf(locations[i].name) !== -1) {
        def = locations[i];
        break;
      }
    }
    return def || locations[0];
  };
  window.__cor3PickLocationConfig = function(locations) {
    var loc = window.__cor3PickDefaultLocation(locations);
    if (!loc) return { locationConfigId: null, zoneConfigId: null, goalId: null };
    var zone0 = loc.zones && loc.zones[0] ? loc.zones[0] : null;
    var goal0 = zone0 && zone0.goals && zone0.goals[0] ? zone0.goals[0] : null;
    return { locationConfigId: loc.id, zoneConfigId: zone0 ? zone0.id : null, goalId: goal0 ? goal0.id : null };
  };
  window.__cor3WebVersion = null;
  window.__cor3SystemVersion = null;
  window.__cor3PatchVersion = null;
  window.__cor3DownloadFolderId = null;
  window.__cor3RequestExpeditions = function() {
    console.log("[COR3 Helper] Requesting expedition data");
    var gotData = false;
    var onExpData = function(evt) {
      if (evt.data && evt.data.type === "COR3_WS_EXPEDITIONS") {
        gotData = true;
        window.removeEventListener("message", onExpData);
      }
    };
    window.addEventListener("message", onExpData);
    enterRooms(["expeditions"]).then(function() {
      setTimeout(function() {
        window.removeEventListener("message", onExpData);
        if (!gotData) {
          var msg = '42["event",{"event":{"name":"expeditions","action":"get.active"}}]';
          wsSend(msg);
        }
      }, 2e3);
    });
    return true;
  };
  window.__cor3RespondDecision = function(expeditionId, messageId, selectedOption) {
    var payload = JSON.stringify({
      expeditionId,
      messageId,
      selectedOption
    });
    var msg = '42["event",{"event":{"name":"expeditions","action":"respond.event"},"data":' + payload + "}]";
    console.log("[COR3 Helper] Sending decision response:", selectedOption);
    var sent = wsSend(msg);
    if (!sent) {
      queueRetryOp("decision:" + payload);
    }
    return sent;
  };
  window.__cor3RequestArchivedExpeditions = function() {
    console.log("[COR3 Helper] Requesting archived expeditions");
    var msg = '42["event",{"event":{"name":"expeditions","action":"get.archived"},"data":{"cursor":null,"limit":20}}]';
    wsSend(msg);
    return true;
  };
  var coreMercAbort = null;
  window.__cor3RequestMercenaries = function(marketId, callback) {
    if (window.__cor3CoreMercFetchInProgress) {
      console.log("[COR3 Helper] CORE merc fetch already in progress \u2014 aborting previous");
      if (coreMercAbort) coreMercAbort();
    }
    var mid = marketId || window.__cor3LastMarketId || "019d3ea4-85bd-7389-904d-8f7c85841134";
    console.log("[COR3 Helper] Starting CORE mercenary data fetch for market:", mid);
    window.__cor3CoreMercFetchInProgress = true;
    var aborted = false;
    coreMercAbort = function() {
      aborted = true;
      window.__cor3CoreMercFetchInProgress = false;
      window.removeEventListener("message", onCoreData);
      clearTimeout(coreTimer);
      coreMercAbort = null;
    };
    var getMercs = '42["event",{"event":{"name":"expeditions","action":"get.mercenaries"},"data":{"marketId":"' + mid + '"}}]';
    wsSend(getMercs);
    setTimeout(function() {
      if (aborted) return;
      var getConfig = '42["event",{"event":{"name":"expeditions","action":"get.config"},"data":{"marketId":"' + mid + '"}}]';
      wsSend(getConfig);
    }, humanDelay());
    var coreMercData = null;
    var coreConfigData = null;
    var coreDone = false;
    function onCoreData(evt) {
      if (aborted || coreDone) return;
      if (!evt.data) return;
      if (evt.data.type === "COR3_WS_MERCENARIES") {
        coreMercData = evt.data.data;
        checkAndConfigureCore();
      }
      if (evt.data.type === "COR3_WS_EXPEDITION_CONFIG") {
        coreConfigData = window.__cor3PickLocationConfig(evt.data.data && evt.data.data.locations);
        window.__cor3ExpConfigIds = coreConfigData;
        checkAndConfigureCore();
      }
    }
    function checkAndConfigureCore() {
      if (!coreMercData || !coreConfigData) return;
      coreDone = true;
      window.removeEventListener("message", onCoreData);
      clearTimeout(coreTimer);
      var configIds = coreConfigData;
      var allMercIds = [];
      if (coreMercData.mercenaries) {
        allMercIds = coreMercData.mercenaries.map(function(m) {
          return m.id;
        });
      }
      if (coreMercData.eliteSlots) {
        coreMercData.eliteSlots.forEach(function(es) {
          if (es.mercenary && allMercIds.indexOf(es.mercenary.id) === -1) {
            allMercIds.push(es.mercenary.id);
          }
        });
      }
      console.log("[COR3 Helper] Configuring " + allMercIds.length + " CORE mercs");
      (function configureNext(i) {
        if (aborted || i >= allMercIds.length) {
          window.__cor3CoreMercFetchInProgress = false;
          coreMercAbort = null;
          if (!aborted) {
            console.log("[COR3 Helper] CORE merc configure complete");
            if (callback) callback();
          }
          return;
        }
        window.__cor3RequestMercConfigure(allMercIds[i], mid, configIds.locationConfigId, configIds.zoneConfigId, configIds.goalId);
        function onConfigResponse(evt3) {
          if (aborted) {
            window.removeEventListener("message", onConfigResponse);
            return;
          }
          if (evt3.data && evt3.data.type === "COR3_WS_MERC_CONFIGURE") {
            window.removeEventListener("message", onConfigResponse);
            clearTimeout(configTimeout);
            setTimeout(function() {
              configureNext(i + 1);
            }, 200);
          }
        }
        window.addEventListener("message", onConfigResponse);
        var configTimeout = setTimeout(function() {
          window.removeEventListener("message", onConfigResponse);
          configureNext(i + 1);
        }, 5e3);
      })(0);
    }
    window.addEventListener("message", onCoreData);
    var coreTimer = setTimeout(function() {
      if (!coreDone && !aborted) {
        coreDone = true;
        window.removeEventListener("message", onCoreData);
        window.__cor3CoreMercFetchInProgress = false;
        coreMercAbort = null;
        console.log("[COR3 Helper] CORE merc data fetch timeout");
        if (callback) callback();
      }
    }, 3e4);
    return true;
  };
  window.__cor3RequestExpeditionConfig = function(marketId) {
    var mid = marketId || window.__cor3LastMarketId || "019d3ea4-85bd-7389-904d-8f7c85841134";
    console.log("[COR3 Helper] Requesting expedition config for market:", mid);
    var msg = '42["event",{"event":{"name":"expeditions","action":"get.config"},"data":{"marketId":"' + mid + '"}}]';
    wsSend(msg);
    return true;
  };
  window.__cor3PendingMercConfigures = [];
  window.__cor3RequestMercConfigure = function(mercenaryId, marketId, locationConfigId, zoneConfigId, goalId) {
    var mid = marketId || window.__cor3LastMarketId || "019d3ea4-85bd-7389-904d-8f7c85841134";
    console.log("[COR3 Helper] Requesting configure for mercenary:", mercenaryId);
    window.__cor3PendingMercConfigures.push(mercenaryId);
    var data = {
      mercenaryId,
      marketId: mid,
      locationConfigId,
      zoneConfigId,
      goalId,
      hasInsurance: false
    };
    var msg = '42["event",{"event":{"name":"expeditions","action":"configure"},"data":' + JSON.stringify(data) + "}]";
    wsSend(msg);
    return true;
  };
  var usolMercAbort = null;
  window.__cor3RequestUsolMercenaries = function(callback) {
    var cachedUnreachable = window.__cor3IsMarketUnreachable("usol");
    if (cachedUnreachable) {
      console.log("[COR3 Helper] USOL market known unreachable (" + cachedUnreachable.blockerName + " maintenance) \u2014 skipping merc fetch");
      window.postMessage({
        type: "COR3_WS_USOL_MARKET_UNREACHABLE",
        error: "no-path-to-server",
        blockerServerName: cachedUnreachable.blockerName,
        maintenanceEndsAt: cachedUnreachable.maintenanceEndsAt,
        cached: true
      }, "*");
      if (callback) callback();
      return true;
    }
    if (window.__cor3UsolMercFetchInProgress) {
      console.log("[COR3 Helper] USOL merc fetch already in progress \u2014 aborting previous");
      if (usolMercAbort) usolMercAbort();
    }
    console.log("[COR3 Helper] Starting USOL mercenary data fetch");
    window.__cor3UsolMercFetchInProgress = true;
    var aborted = false;
    usolMercAbort = function() {
      aborted = true;
      window.__cor3UsolMercFetchInProgress = false;
      usolMercAbort = null;
    };
    var setEndpoint = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + USOL_SERVER_ID + '"}}]';
    wsSend(setEndpoint);
    function fetchMercData() {
      setTimeout(function() {
        if (aborted) return;
        console.log("[COR3 Helper] Requesting USOL mercenaries");
        var getMercs = '42["event",{"event":{"name":"expeditions","action":"get.mercenaries"},"data":{"marketId":"' + USOL_MARKET_ID + '"}}]';
        wsSend(getMercs);
        setTimeout(function() {
          if (aborted) return;
          var getConfig = '42["event",{"event":{"name":"expeditions","action":"get.config"},"data":{"marketId":"' + USOL_MARKET_ID + '"}}]';
          wsSend(getConfig);
        }, humanDelay());
      }, humanDelay());
      var usolMercData = null;
      var usolConfigData = null;
      var usolDone = false;
      function onUsolData(evt2) {
        if (usolDone || aborted) return;
        if (!evt2.data) return;
        if (evt2.data.type === "COR3_WS_USOL_MERCENARIES") {
          usolMercData = evt2.data.data;
          checkAndConfigure();
        }
        if (evt2.data.type === "COR3_WS_USOL_EXPEDITION_CONFIG") {
          usolConfigData = window.__cor3PickLocationConfig(evt2.data.data && evt2.data.data.locations);
          window.__cor3UsolExpConfigIds = usolConfigData;
          checkAndConfigure();
        }
      }
      function checkAndConfigure() {
        if (!usolMercData || !usolConfigData) return;
        usolDone = true;
        window.removeEventListener("message", onUsolData);
        clearTimeout(usolTimer);
        var configIds = usolConfigData;
        var allMercIds = [];
        if (usolMercData.mercenaries) {
          allMercIds = usolMercData.mercenaries.map(function(m) {
            return m.id;
          });
        }
        if (usolMercData.eliteSlots) {
          usolMercData.eliteSlots.forEach(function(es) {
            if (es.mercenary && allMercIds.indexOf(es.mercenary.id) === -1) {
              allMercIds.push(es.mercenary.id);
            }
          });
        }
        console.log("[COR3 Helper] Configuring " + allMercIds.length + " USOL mercs");
        (function configureNext(i) {
          if (aborted || i >= allMercIds.length) {
            window.__cor3UsolMercFetchInProgress = false;
            usolMercAbort = null;
            if (!aborted) {
              console.log("[COR3 Helper] USOL merc configure complete");
              if (callback) callback();
            }
            return;
          }
          window.__cor3RequestMercConfigure(allMercIds[i], USOL_MARKET_ID, configIds.locationConfigId, configIds.zoneConfigId, configIds.goalId);
          function onConfigResponse(evt3) {
            if (aborted) {
              window.removeEventListener("message", onConfigResponse);
              return;
            }
            if (evt3.data && evt3.data.type === "COR3_WS_MERC_CONFIGURE") {
              window.removeEventListener("message", onConfigResponse);
              clearTimeout(configTimeout);
              setTimeout(function() {
                configureNext(i + 1);
              }, 200);
            }
          }
          window.addEventListener("message", onConfigResponse);
          var configTimeout = setTimeout(function() {
            window.removeEventListener("message", onConfigResponse);
            configureNext(i + 1);
          }, 5e3);
        })(0);
      }
      window.addEventListener("message", onUsolData);
      var usolTimer = setTimeout(function() {
        if (!usolDone && !aborted) {
          usolDone = true;
          window.removeEventListener("message", onUsolData);
          window.__cor3UsolMercFetchInProgress = false;
          usolMercAbort = null;
          console.log("[COR3 Helper] USOL merc data fetch timeout");
          if (callback) callback();
        }
      }, 3e4);
    }
    function startPathThroughThenRetry() {
      console.log("[COR3 Helper] USOL merc: endpoint unreachable \u2014 starting dynamic path-through");
      __cor3FetchMapData().then(function(mapData) {
        if (aborted) return;
        if (!mapData) {
          console.log("[COR3 Helper] USOL merc path-through: map data timeout \u2014 giving up");
          window.__cor3UsolMercFetchInProgress = false;
          usolMercAbort = null;
          __cor3PostUnreachable2("usol", null);
          if (callback) callback();
          return;
        }
        var paths = __cor3FindPathsToServer(mapData.servers, mapData.connections, USOL_SERVER_ID);
        if (paths.length === 0) {
          console.log("[COR3 Helper] USOL merc path-through: no viable paths (maintenance blocked)");
          window.__cor3UsolMercFetchInProgress = false;
          usolMercAbort = null;
          __cor3PostUnreachable2("usol", null);
          if (callback) callback();
          return;
        }
        console.log("[COR3 Helper] USOL merc path-through: found " + paths.length + " path(s)");
        var pathIdx = 0;
        function tryNextPath() {
          if (aborted) return;
          if (pathIdx >= paths.length) {
            console.log("[COR3 Helper] USOL merc path-through: all paths exhausted");
            window.__cor3UsolMercFetchInProgress = false;
            usolMercAbort = null;
            __cor3PostUnreachable2("usol", null);
            if (callback) callback();
            return;
          }
          var currentPath = paths[pathIdx];
          pathIdx++;
          var intermediates = currentPath.length > 1 ? currentPath.slice(0, currentPath.length - 1) : [];
          if (intermediates.length === 0) {
            retryEndpoint();
            return;
          }
          var pathNames = currentPath.map(function(s) {
            return s.name;
          }).join(" \u2192 ");
          console.log("[COR3 Helper] USOL merc path-through: trying path " + pathIdx + "/" + paths.length + ": " + pathNames);
          var stepIdx = 0;
          function nextStep() {
            if (aborted) return;
            if (stepIdx >= intermediates.length) {
              retryEndpoint();
              return;
            }
            var server = intermediates[stepIdx];
            stepIdx++;
            var setEp = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + server.id + '"}}]';
            wsSend(setEp);
            __cor3WaitForMsg("COR3_WS_ENDPOINT_RESULT", 1e4).then(function(epData) {
              if (aborted) return;
              if (epData.success === false) {
                console.log("[COR3 Helper] USOL merc path-through: " + server.name + " unreachable \u2014 trying next path");
                tryNextPath();
                return;
              }
              __cor3EnsureServerAccess(server.id, server.name).then(function() {
                if (aborted) return;
                setTimeout(nextStep, 500);
              }).catch(function() {
                tryNextPath();
              });
            }).catch(function() {
              __cor3EnsureServerAccess(server.id, server.name).then(function() {
                if (aborted) return;
                setTimeout(nextStep, 500);
              }).catch(function() {
                tryNextPath();
              });
            });
          }
          nextStep();
        }
        function retryEndpoint() {
          if (aborted) return;
          console.log("[COR3 Helper] USOL merc path-through: retrying endpoint");
          var setEp2 = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + USOL_SERVER_ID + '"}}]';
          wsSend(setEp2);
          __cor3WaitForMsg("COR3_WS_ENDPOINT_RESULT", 1e4).then(function(retryData) {
            if (aborted) return;
            if (retryData.success === false) {
              console.log("[COR3 Helper] USOL merc path-through: endpoint retry failed");
              window.__cor3UsolMercFetchInProgress = false;
              usolMercAbort = null;
              __cor3PostUnreachable2("usol", null);
              if (callback) callback();
              return;
            }
            console.log("[COR3 Helper] USOL merc path-through: endpoint set \u2014 fetching merc data");
            fetchMercData();
          }).catch(function() {
            window.__cor3UsolMercFetchInProgress = false;
            usolMercAbort = null;
            console.log("[COR3 Helper] USOL merc path-through: retry timeout");
            if (callback) callback();
          });
        }
        tryNextPath();
      });
    }
    var handled = false;
    function onEndpointResult(evt) {
      if (handled || aborted) return;
      if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
        handled = true;
        window.removeEventListener("message", onEndpointResult);
        clearTimeout(epTimer);
        if (evt.data.success === false) {
          startPathThroughThenRetry();
          return;
        }
        fetchMercData();
      }
      if (evt.data && evt.data.type === "COR3_WS_USOL_MARKET_UNREACHABLE") {
        handled = true;
        window.removeEventListener("message", onEndpointResult);
        clearTimeout(epTimer);
        startPathThroughThenRetry();
      }
    }
    window.addEventListener("message", onEndpointResult);
    var epTimer = setTimeout(function() {
      if (!handled && !aborted) {
        handled = true;
        window.removeEventListener("message", onEndpointResult);
        window.__cor3UsolMercFetchInProgress = false;
        usolMercAbort = null;
        console.log("[COR3 Helper] USOL merc endpoint timeout");
        if (callback) callback();
      }
    }, 1e4);
    return true;
  };
  window.__cor3LaunchExpedition = function(configData) {
    console.log("[COR3 Helper] Launching expedition with config:", configData);
    var marketId = configData.marketId;
    var needsEndpoint = marketId && marketId !== "019d3ea4-85bd-7389-904d-8f7c85841134";
    var serverId = null;
    if (marketId === USOL_MARKET_ID) serverId = USOL_SERVER_ID;
    function doConfigureAndLaunch() {
      var configureMsg = '42["event",{"event":{"name":"expeditions","action":"configure"},"data":' + JSON.stringify(configData) + "}]";
      wsSend(configureMsg);
      setTimeout(function() {
        var launchMsg = '42["event",{"event":{"name":"expeditions","action":"launch"},"data":' + JSON.stringify(configData) + "}]";
        wsSend(launchMsg);
        console.log("[COR3 Helper] Expedition launch sent");
      }, humanDelay() + 500);
    }
    if (needsEndpoint && serverId) {
      let onEpResult = function(evt) {
        if (epHandled) return;
        if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
          epHandled = true;
          window.removeEventListener("message", onEpResult);
          clearTimeout(epTimeout);
          if (evt.data.success === false) {
            console.log("[COR3 Helper] Endpoint unreachable for launch, aborting");
            return;
          }
          setTimeout(doConfigureAndLaunch, humanDelay());
        }
      };
      console.log("[COR3 Helper] Setting endpoint to market server before launch:", serverId);
      var setEp = '42["event",{"event":{"name":"network-map","action":"set.endpoint"},"data":{"serverId":"' + serverId + '"}}]';
      wsSend(setEp);
      var epHandled = false;
      window.addEventListener("message", onEpResult);
      var epTimeout = setTimeout(function() {
        if (!epHandled) {
          epHandled = true;
          window.removeEventListener("message", onEpResult);
          console.log("[COR3 Helper] Endpoint timeout for launch, proceeding anyway");
          doConfigureAndLaunch();
        }
      }, 8e3);
    } else {
      doConfigureAndLaunch();
    }
    return true;
  };
  window.__cor3OpenContainer = function(expeditionId) {
    console.log("[COR3 Helper] Opening container for expedition:", expeditionId);
    var msg = '42["event",{"event":{"name":"expeditions","action":"open.container"},"data":{"expeditionId":"' + expeditionId + '"}}]';
    wsSend(msg);
    return true;
  };
  window.__cor3CollectAll = function(expeditionId) {
    console.log("[COR3 Helper] Collecting all from expedition:", expeditionId);
    var msg = '42["event",{"event":{"name":"expeditions","action":"collect.all"},"data":{"expeditionId":"' + expeditionId + '"}}]';
    wsSend(msg);
    return true;
  };

  // src/content-early/initial-fetch.js
  var initialFetchDone = false;
  window.__cor3ResetInitialFetch = function() {
    initialFetchDone = false;
    console.log("[COR3 Helper] Reset initial fetch flag for reconnect");
  };
  window.__cor3InitialMercsFetchDone = false;
  window.__cor3InitialFetch = function() {
    if (initialFetchDone) return;
    initialFetchDone = true;
    window.__cor3InitialMercsFetchDone = false;
    window.__cor3InitialFetchInProgress = true;
    console.log("[COR3 Helper] Running initial data fetch (page load)");
    window.postMessage({ type: "COR3_FETCH_DAILY_OPS" }, "*");
    window.__cor3RequestMarket(function() {
      console.log("[COR3 Helper] Initial: HOME done, starting D4RK");
      window.__cor3RequestDarkMarket(function() {
        console.log("[COR3 Helper] Initial: D4RK done, starting SOYUZ");
        window.__cor3RequestSoyuzMarket(function() {
          console.log("[COR3 Helper] Initial: SOYUZ done, starting USOL");
          window.__cor3RequestUsolMarket(function() {
            console.log("[COR3 Helper] Initial: All markets fetched");
            window.postMessage({ type: "COR3_WS_EXPEDITIONS_READY" }, "*");
            setTimeout(function() {
              window.__cor3RequestStash();
            }, humanDelay());
            setTimeout(function() {
              window.__cor3RequestSpecialists();
            }, humanDelay() + 500);
            setTimeout(function() {
              console.log("[COR3 Helper] Initial: Starting CORE mercs");
              window.__cor3RequestMercenaries(null, function() {
                window.postMessage({ type: "COR3_CORE_MERCS_DONE" }, "*");
                console.log("[COR3 Helper] Initial: CORE mercs done, starting USOL mercs");
                setTimeout(function() {
                  window.__cor3RequestUsolMercenaries(function() {
                    window.postMessage({ type: "COR3_USOL_MERCS_DONE" }, "*");
                    window.__cor3InitialMercsFetchDone = true;
                    console.log("[COR3 Helper] Initial: All mercs done");
                    setTimeout(function() {
                      window.__cor3RequestArchivedExpeditions();
                    }, humanDelay());
                    setTimeout(function() {
                      window.__cor3RequestLoadout();
                    }, 2e3);
                    setTimeout(function() {
                      window.__cor3RequestUpdater();
                      window.__cor3InitialFetchInProgress = false;
                      console.log("[COR3 Helper] Initial data fetch complete");
                      window.postMessage({ type: "COR3_INITIAL_FETCH_DONE" }, "*");
                    }, 3500);
                  });
                }, humanDelay());
              });
            }, 2500);
          });
        });
      });
    });
  };
  window.__cor3KeepAlive = function() {
    console.log("[COR3 Helper] Keeping service worker alive!");
  };

  // src/shared/loadout-resolver.js
  var RESOURCE_KEYS = ["cpu_frequency", "cpu_cores", "gpu_power", "gpu_memory", "ram_frequency", "ram_memory"];
  function parseConsuming(vals) {
    if (!vals || !Array.isArray(vals) || vals.length < 2) return null;
    if (vals.length === 2) return { base: 0, min: vals[0], max: vals[1] };
    return { base: vals[0], min: vals[1], max: vals[2] };
  }
  function normSpecs(sw) {
    if (!sw || !sw.specs) return [];
    return Array.isArray(sw.specs) ? sw.specs : [sw.specs];
  }
  function calculateAnalysis(loadout, softwareIds) {
    var hw = loadout.equippedHardware || {};
    var allSoftware = loadout.ownedSoftware || [];
    var installed = allSoftware.filter(function(sw2) {
      return softwareIds.indexOf(sw2.id) >= 0;
    });
    var supply = {};
    if (hw.cpu) {
      supply.cpu_frequency = hw.cpu.specs.cpuFrequency || 0;
      supply.cpu_cores = hw.cpu.specs.cpuCores || 0;
    }
    if (hw.gpu) {
      supply.gpu_power = hw.gpu.specs.gpuPower || 0;
      supply.gpu_memory = hw.gpu.specs.gpuMemory || 0;
    }
    if (hw.ram) {
      supply.ram_frequency = hw.ram.specs.ramFrequency || 0;
      supply.ram_memory = hw.ram.specs.ramMemory || 0;
    }
    if (hw.psu) {
      supply.psu_power = hw.psu.specs.psuPower || 0;
    }
    var parsed = {};
    for (var si = 0; si < installed.length; si++) {
      var sw = installed[si];
      parsed[sw.id] = {};
      for (var ri = 0; ri < RESOURCE_KEYS.length; ri++) {
        var rk = RESOURCE_KEYS[ri];
        var p = parseConsuming(sw.consuming && sw.consuming[rk]);
        if (p) parsed[sw.id][rk] = p;
      }
    }
    var demand = {};
    for (var ri2 = 0; ri2 < RESOURCE_KEYS.length; ri2++) {
      var rk2 = RESOURCE_KEYS[ri2];
      var totalBase = 0, highestMinUplift = 0;
      for (var si2 = 0; si2 < installed.length; si2++) {
        var pc = parsed[installed[si2].id][rk2];
        if (pc) {
          totalBase += pc.base;
          highestMinUplift = Math.max(highestMinUplift, pc.min - pc.base);
        }
      }
      demand[rk2] = totalBase + highestMinUplift;
    }
    var psuDemand = 0;
    if (hw.cpu) psuDemand += hw.cpu.specs.cpuConsuming || 0;
    if (hw.gpu) psuDemand += hw.gpu.specs.gpuConsuming || 0;
    demand.psu_total = psuDemand;
    var hasAllHw = !!(hw.cpu && hw.gpu && hw.ram && hw.psu);
    var canBoot = hasAllHw;
    if (canBoot) {
      for (var ri3 = 0; ri3 < RESOURCE_KEYS.length; ri3++) {
        if ((supply[RESOURCE_KEYS[ri3]] || 0) < demand[RESOURCE_KEYS[ri3]]) {
          canBoot = false;
          break;
        }
      }
      if (canBoot && (supply.psu_power || 0) < demand.psu_total) canBoot = false;
    }
    var swAnalysis = {};
    for (var si3 = 0; si3 < installed.length; si3++) {
      var sw3 = installed[si3];
      var lowestRatio = 1, bottleneck = null;
      for (var ri4 = 0; ri4 < RESOURCE_KEYS.length; ri4++) {
        var rk4 = RESOURCE_KEYS[ri4];
        var pc4 = parsed[sw3.id][rk4];
        if (!pc4) continue;
        var otherBase = 0;
        for (var oi = 0; oi < installed.length; oi++) {
          if (installed[oi].id !== sw3.id) {
            var opc = parsed[installed[oi].id][rk4];
            if (opc) otherBase += opc.base;
          }
        }
        var avail = (supply[rk4] || 0) - otherBase;
        var ratio;
        if (pc4.max > pc4.min) {
          ratio = (avail - pc4.min) / (pc4.max - pc4.min);
          ratio = Math.max(0, Math.min(1, ratio));
        } else {
          ratio = avail >= pc4.min ? 1 : 0;
        }
        if (ratio < lowestRatio || ratio === lowestRatio && bottleneck === null) {
          lowestRatio = ratio;
          bottleneck = rk4;
        }
      }
      var specs = normSpecs(sw3);
      var abilities = specs.map(function(sp) {
        return {
          type: sp.type,
          computedPower: Math.floor(sp.power[0] + lowestRatio * (sp.power[1] - sp.power[0])),
          pMin: sp.power[0],
          pMax: sp.power[1],
          serverTypes: sp.serverTypes || null,
          fileTypes: sp.fileTypes || null
        };
      });
      swAnalysis[sw3.id] = { name: sw3.name, ratio: lowestRatio, bottleneck, abilities };
    }
    return { supply, demand, canBoot, swAnalysis, installed };
  }
  function findHackSoftwareForServerType(allSoftware, serverTypeName) {
    var candidates = [];
    for (var i = 0; i < allSoftware.length; i++) {
      var specs = normSpecs(allSoftware[i]);
      for (var j = 0; j < specs.length; j++) {
        if (specs[j].type === "HACK" && specs[j].serverTypes && specs[j].serverTypes.indexOf(serverTypeName) >= 0) {
          candidates.push({ sw: allSoftware[i], spec: specs[j] });
        }
      }
    }
    candidates.sort(function(a, b) {
      return b.spec.power[1] - a.spec.power[1];
    });
    return candidates;
  }
  function findBestHardware(loadout, softwareIds) {
    var owned = loadout.ownedHardware || [];
    var byCat = { CPU: [], GPU: [], RAM: [], PSU: [] };
    for (var i = 0; i < owned.length; i++) {
      var cat = (owned[i].category || "").toUpperCase();
      if (byCat[cat]) byCat[cat].push(owned[i]);
    }
    if (byCat.CPU.length === 0 || byCat.GPU.length === 0 || byCat.RAM.length === 0 || byCat.PSU.length === 0) return null;
    var bestHw = null;
    var bestPower = -1;
    for (var ci = 0; ci < byCat.CPU.length; ci++) {
      for (var gi = 0; gi < byCat.GPU.length; gi++) {
        var psuNeed = (byCat.CPU[ci].specs.cpuConsuming || 0) + (byCat.GPU[gi].specs.gpuConsuming || 0);
        for (var pi = 0; pi < byCat.PSU.length; pi++) {
          if ((byCat.PSU[pi].specs.psuPower || 0) < psuNeed) continue;
          for (var rmi = 0; rmi < byCat.RAM.length; rmi++) {
            var testHw = { cpu: byCat.CPU[ci], gpu: byCat.GPU[gi], ram: byCat.RAM[rmi], psu: byCat.PSU[pi] };
            var testLoadout = JSON.parse(JSON.stringify(loadout));
            testLoadout.equippedHardware = testHw;
            var analysis = calculateAnalysis(testLoadout, softwareIds);
            if (!analysis.canBoot) continue;
            var totalPower = 0;
            for (var swId in analysis.swAnalysis) {
              var ab = analysis.swAnalysis[swId].abilities;
              for (var ai = 0; ai < ab.length; ai++) totalPower += ab[ai].computedPower;
            }
            if (totalPower > bestPower) {
              bestPower = totalPower;
              bestHw = testHw;
            }
          }
          break;
        }
      }
    }
    return bestHw;
  }
  function getServerTypeName(serverId) {
    var map = typeof window !== "undefined" && window.__cor3ServerTypeMap;
    if (map && map[serverId]) return map[serverId].serverTypeName;
    return null;
  }

  // src/content-early/message-listener.js
  function installSocketHealthCheck() {
    setInterval(function() {
      const now = Date.now();
      var activeSocket = getActiveSocket();
      for (var i = trackedSockets.length - 1; i >= 0; i--) {
        var ws = trackedSockets[i];
        if (ws.readyState === OrigWebSocket.CLOSED || ws.readyState === OrigWebSocket.CLOSING) {
          console.log("[COR3 Helper] Cleaning up dead socket");
          trackedSockets.splice(i, 1);
          socketLastActivity.delete(ws);
          if (activeSocket === ws) setActiveSocket(null);
        }
      }
      activeSocket = getActiveSocket();
      if (activeSocket) {
        var lastActivity = socketLastActivity.get(activeSocket) || 0;
        if (now - lastActivity > 9e4) {
          console.log("[COR3 Helper] Active socket stale (no messages for 90s) \u2014 may need reconnect");
        }
      }
    }, 6e4);
  }
  function installMessageListener() {
    window.addEventListener("message", function(event) {
      if (event.source !== window) return;
      if (event.data && event.data.type === "COR3_REQUEST_EXPEDITIONS") {
        window.__cor3RequestExpeditions();
      }
      if (event.data && event.data.type === "COR3_REQUEST_NETWORK_MAP") {
        window.__cor3AutoJobGetNetworkMap();
      }
      if (event.data && event.data.type === "COR3_DEV_TC_TEST_REACHABILITY") {
        (function(serverId) {
          var logLines = [];
          function addLog(msg2, color) {
            logLines.push({ msg: msg2, color: color || null });
            window.postMessage({ type: "COR3_DEV_TC_REACH_PROGRESS", log: logLines.slice() }, "*");
          }
          function sendResult(reachable, reason) {
            window.__cor3DevTcReachActive = false;
            window.postMessage({ type: "COR3_DEV_TC_REACH_RESULT", reachable, reason: reason || null, log: logLines }, "*");
          }
          window.__cor3DevTcReachActive = true;
          var serverName = serverId;
          if (window.__cor3ServerTypeMap && window.__cor3ServerTypeMap[serverId]) {
            serverName = window.__cor3ServerTypeMap[serverId].serverName || serverId;
          }
          function sendSetEndpoint(targetId) {
            return new Promise(function(resolve) {
              var handled = false;
              function onEpResult(evt) {
                if (handled) return;
                if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
                  handled = true;
                  clearTimeout(epTimer);
                  window.removeEventListener("message", onEpResult);
                  if (evt.data.success === false && evt.data.error) {
                    var errMsg = evt.data.error.message || "";
                    if (errMsg === "no-path-to-server") {
                      resolve({ ok: false, noPath: true, errorMsg: errMsg });
                    } else if (errMsg === "server-in-maintenance") {
                      resolve({ ok: false, maintenance: true, errorMsg: errMsg });
                    } else {
                      resolve({ ok: false, errorMsg: errMsg || JSON.stringify(evt.data.error) });
                    }
                  } else {
                    resolve({ ok: true });
                  }
                }
              }
              window.addEventListener("message", onEpResult);
              var epTimer = setTimeout(function() {
                if (!handled) {
                  handled = true;
                  window.removeEventListener("message", onEpResult);
                  resolve({ ok: true, timeout: true });
                }
              }, 1e4);
              window.__cor3AutoJobSetEndpoint(targetId);
            });
          }
          function waitForDevTcMsg(eventType, timeoutMs) {
            return new Promise(function(resolve, reject) {
              var done = false;
              var timer = setTimeout(function() {
                if (!done) {
                  done = true;
                  window.removeEventListener("message", handler);
                  reject(new Error("Timeout waiting for " + eventType));
                }
              }, timeoutMs || 1e4);
              function handler(evt) {
                if (done) return;
                if (evt.data && evt.data.type === eventType) {
                  done = true;
                  clearTimeout(timer);
                  window.removeEventListener("message", handler);
                  resolve(evt.data);
                }
              }
              window.addEventListener("message", handler);
            });
          }
          function ensureDevTcHackLoadout(targetId, targetName) {
            return new Promise(function(resolve) {
              var serverTypeName = getServerTypeName(targetId);
              if (!serverTypeName) {
                addLog("\u26A1 Loadout: cannot determine server type \u2014 skipping loadout");
                resolve(true);
                return;
              }
              addLog("\u26A1 Loadout: fetching data for " + serverTypeName + "...");
              window.__cor3AutoJobRequestLoadout();
              waitForDevTcMsg("COR3_AUTOJOB_LOADOUT", 1e4).then(function(resp) {
                if (!resp || !resp.data) {
                  addLog("\u26A1 Loadout: no data \u2014 proceeding without loadout");
                  resolve(true);
                  return;
                }
                var loadout = resp.data;
                var allSw = loadout.ownedSoftware || [];
                var equippedSwIds = (loadout.equippedSoftware || []).map(function(s) {
                  return s.id;
                });
                var hackCandidates = findHackSoftwareForServerType(allSw, serverTypeName);
                addLog("\u26A1 Loadout: found " + hackCandidates.length + " hack candidate(s) for " + serverTypeName + (hackCandidates.length > 0 ? " \u2014 best: " + hackCandidates[0].sw.name : ""));
                if (hackCandidates.length === 0) {
                  addLog("\u26A1 Loadout: no hack software for " + serverTypeName + " \u2014 proceeding anyway");
                  resolve(true);
                  return;
                }
                var bestHack = hackCandidates[0];
                var targetSwIds = [bestHack.sw.id];
                var alreadyBest = equippedSwIds.length === 1 && equippedSwIds[0] === bestHack.sw.id;
                if (alreadyBest) {
                  addLog('\u26A1 Loadout: best hack software "' + bestHack.sw.name + '" already equipped');
                  resolve(true);
                  return;
                }
                var currentHw = loadout.equippedHardware || {};
                var analysis = calculateAnalysis(loadout, targetSwIds);
                var targetHw = currentHw;
                if (!analysis.canBoot) {
                  var betterHw = findBestHardware(loadout, targetSwIds);
                  if (betterHw) {
                    targetHw = betterHw;
                  } else {
                    addLog("\u26A1 Loadout: cannot boot hack software \u2014 skipping");
                    resolve(true);
                    return;
                  }
                }
                addLog('\u26A1 Loadout: equipping hack software "' + bestHack.sw.name + '" for ' + serverTypeName);
                applyDevTcLoadout(loadout, targetHw, targetSwIds).then(function() {
                  resolve(true);
                });
              }).catch(function() {
                addLog("\u26A1 Loadout: fetch timed out \u2014 proceeding without loadout");
                resolve(true);
              });
            });
          }
          function applyDevTcLoadout(loadout, targetHw, targetSwIds) {
            var currentHw = loadout.equippedHardware || {};
            var currentSwIds = (loadout.equippedSoftware || []).map(function(s) {
              return s.id;
            });
            var steps = [];
            for (var ui = 0; ui < currentSwIds.length; ui++) {
              if (targetSwIds.indexOf(currentSwIds[ui]) < 0) {
                steps.push({ action: "unequip-sw", id: currentSwIds[ui] });
              }
            }
            var hwSlots = ["cpu", "gpu", "ram", "psu"];
            for (var hi = 0; hi < hwSlots.length; hi++) {
              var slot = hwSlots[hi];
              var curId = currentHw[slot] ? currentHw[slot].id : null;
              var tgtId = targetHw[slot] ? targetHw[slot].id : null;
              if (tgtId && tgtId !== curId) {
                steps.push({ action: "equip-hw", id: tgtId });
              }
            }
            for (var ei = 0; ei < targetSwIds.length; ei++) {
              if (currentSwIds.indexOf(targetSwIds[ei]) < 0) {
                steps.push({ action: "equip-sw", id: targetSwIds[ei] });
              }
            }
            var idx = 0;
            function doStep() {
              if (idx >= steps.length) return Promise.resolve();
              var step = steps[idx++];
              if (step.action === "unequip-sw") {
                window.__cor3AutoJobUnequipSoftware(step.id);
              } else if (step.action === "equip-hw") {
                window.__cor3AutoJobEquipHardware(step.id);
              } else if (step.action === "equip-sw") {
                window.__cor3AutoJobEquipSoftware(step.id);
              }
              return waitForDevTcMsg("COR3_AUTOJOB_LOADOUT", 8e3).catch(function() {
              }).then(function() {
                return new Promise(function(r) {
                  setTimeout(r, 500);
                });
              }).then(doStep);
            }
            return doStep();
          }
          function loginToServer(targetId, targetName) {
            return new Promise(function(resolve) {
              addLog("\u26A1 Checking login status for " + targetName);
              var loginHandled = false;
              function onLoginStatus(evt) {
                if (loginHandled) return;
                if (evt.data && evt.data.type === "COR3_AUTOJOB_SAI_LOGIN_STATUS") {
                  loginHandled = true;
                  clearTimeout(loginTimer);
                  window.removeEventListener("message", onLoginStatus);
                  if (evt.data.error) {
                    resolve({ ok: false, error: "Login status error: " + (evt.data.error.message || JSON.stringify(evt.data.error)) });
                    return;
                  }
                  var data = evt.data.data;
                  if (data && data.activeAccesses && data.activeAccesses.length > 0) {
                    let onLoginResult = function(evt2) {
                      if (loginResultHandled) return;
                      if (evt2.data && evt2.data.type === "COR3_AUTOJOB_SAI_LOGIN_RESULT") {
                        loginResultHandled = true;
                        clearTimeout(loginResultTimer);
                        window.removeEventListener("message", onLoginResult);
                        if (evt2.data.error || !(evt2.data.data && evt2.data.data.success)) {
                          resolve({ ok: false, error: "Login with access failed on " + targetName });
                        } else {
                          addLog("\u26A1 Logged in to " + targetName + " (" + accessType + ")");
                          resolve({ ok: true });
                        }
                      }
                    };
                    var access = data.activeAccesses[0];
                    var accessType = access.accessType || access.type || "unknown";
                    addLog("\u26A1 Using existing " + accessType + " access on " + targetName);
                    window.__cor3AutoJobLoginWithAccess(targetId, access.id);
                    var loginResultHandled = false;
                    window.addEventListener("message", onLoginResult);
                    var loginResultTimer = setTimeout(function() {
                      if (!loginResultHandled) {
                        loginResultHandled = true;
                        window.removeEventListener("message", onLoginResult);
                        resolve({ ok: false, error: "Login with access timed out on " + targetName });
                      }
                    }, 1e4);
                  } else {
                    addLog("\u26A1 No active access on " + targetName + " \u2014 equipping hack loadout");
                    ensureDevTcHackLoadout(targetId, targetName).then(function() {
                      addLog("\u26A1 Starting hack on " + targetName);
                      window.postMessage({ type: "COR3_AUTOJOB_ENABLE_DECRYPT_SOLVER" }, "*");
                      window.postMessage({ type: "COR3_AUTOJOB_ENABLE_ICE_WALL_SOLVER" }, "*");
                      window.postMessage({ type: "COR3_AUTOJOB_ENABLE_SIMPLE_DECRYPT_SOLVER" }, "*");
                      setTimeout(function() {
                        startHackWithRetry(targetId, targetName, resolve, 0);
                      }, 300);
                    });
                  }
                }
              }
              window.addEventListener("message", onLoginStatus);
              var loginTimer = setTimeout(function() {
                if (!loginHandled) {
                  loginHandled = true;
                  window.removeEventListener("message", onLoginStatus);
                  resolve({ ok: false, error: "Login status timed out on " + targetName });
                }
              }, 1e4);
              window.__cor3AutoJobGetLoginStatus(targetId);
            });
          }
          function startHackWithRetry(targetId, targetName, resolve, attempt) {
            var MAX_HACK_ATTEMPTS = 3;
            window.__cor3AutoJobHackStart(targetId);
            var hackHandled = false;
            function onHackEvent(evt3) {
              if (hackHandled) return;
              if (evt3.data && evt3.data.type === "COR3_AUTOJOB_SAI_HACK_START") {
                hackHandled = true;
                clearTimeout(hackTimer);
                window.removeEventListener("message", onHackEvent);
                if (evt3.data.error) {
                  var errMsg = evt3.data.error.message || JSON.stringify(evt3.data.error);
                  if ((errMsg.indexOf("sai-no-hack-software") >= 0 || errMsg.indexOf("sai-hack-impossible") >= 0) && attempt < MAX_HACK_ATTEMPTS) {
                    addLog("\u26A1 Hack error: " + errMsg + " \u2014 retrying with loadout swap (attempt " + (attempt + 1) + "/" + MAX_HACK_ATTEMPTS + ")");
                    ensureDevTcHackLoadout(targetId, targetName).then(function() {
                      setTimeout(function() {
                        startHackWithRetry(targetId, targetName, resolve, attempt + 1);
                      }, 1e3);
                    });
                    return;
                  }
                  resolve({ ok: false, error: "Hack error on " + targetName + ": " + errMsg });
                  return;
                }
                if (evt3.data.data && evt3.data.data.autoHacked) {
                  addLog("\u26A1 Auto-hacked " + targetName + " (no minigame)");
                  pollAccessAfterHack(targetId, targetName, resolve);
                } else {
                  addLog("\u26A1 Hack minigame started on " + targetName + " \u2014 waiting for solver...");
                  waitForHackComplete(targetId, targetName, resolve);
                }
              }
              if (evt3.data && evt3.data.type === "COR3_AUTOJOB_MINIGAME_START") {
                hackHandled = true;
                clearTimeout(hackTimer);
                window.removeEventListener("message", onHackEvent);
                addLog("\u26A1 Hack minigame started on " + targetName + " \u2014 waiting for solver...");
                waitForHackComplete(targetId, targetName, resolve);
              }
              if (evt3.data && evt3.data.type === "COR3_AUTOJOB_MINIGAME_LOCKED") {
                hackHandled = true;
                clearTimeout(hackTimer);
                window.removeEventListener("message", onHackEvent);
                resolve({ ok: false, error: "Hack minigame locked on " + targetName });
              }
            }
            window.addEventListener("message", onHackEvent);
            var hackTimer = setTimeout(function() {
              if (!hackHandled) {
                hackHandled = true;
                window.removeEventListener("message", onHackEvent);
                resolve({ ok: false, error: "Hack start timed out on " + targetName });
              }
            }, 3e4);
          }
          function waitForHackComplete(targetId, targetName, resolve) {
            var saiHandled = false;
            function onSaiUpdate(evt) {
              if (saiHandled) return;
              if (evt.data && evt.data.type === "COR3_AUTOJOB_SAI_UPDATE") {
                saiHandled = true;
                clearTimeout(saiTimer);
                window.removeEventListener("message", onSaiUpdate);
                addLog("\u26A1 Hack completed on " + targetName);
                pollAccessAfterHack(targetId, targetName, resolve);
              }
            }
            window.addEventListener("message", onSaiUpdate);
            var saiTimer = setTimeout(function() {
              if (!saiHandled) {
                saiHandled = true;
                window.removeEventListener("message", onSaiUpdate);
                addLog("\u26A1 Hack solver timeout on " + targetName + " \u2014 checking access anyway");
                pollAccessAfterHack(targetId, targetName, resolve);
              }
            }, 12e4);
          }
          function pollAccessAfterHack(targetId, targetName, resolve) {
            var pollCount = 0;
            var MAX_POLLS = 5;
            function doPoll() {
              pollCount++;
              var pollHandled = false;
              function onPollStatus(evt) {
                if (pollHandled) return;
                if (evt.data && evt.data.type === "COR3_AUTOJOB_SAI_LOGIN_STATUS") {
                  pollHandled = true;
                  clearTimeout(pollTimer);
                  window.removeEventListener("message", onPollStatus);
                  if (evt.data.data && evt.data.data.activeAccesses && evt.data.data.activeAccesses.length > 0) {
                    let onLR = function(evt2) {
                      if (lrHandled) return;
                      if (evt2.data && evt2.data.type === "COR3_AUTOJOB_SAI_LOGIN_RESULT") {
                        lrHandled = true;
                        clearTimeout(lrTimer);
                        window.removeEventListener("message", onLR);
                        resolve({ ok: true });
                      }
                    };
                    var acc = evt.data.data.activeAccesses[0];
                    var accType = acc.accessType || acc.type || "unknown";
                    addLog("\u26A1 Got " + accType + " access on " + targetName + " \u2014 logging in");
                    window.__cor3AutoJobLoginWithAccess(targetId, acc.id);
                    var lrHandled = false;
                    window.addEventListener("message", onLR);
                    var lrTimer = setTimeout(function() {
                      if (!lrHandled) {
                        lrHandled = true;
                        window.removeEventListener("message", onLR);
                        resolve({ ok: true });
                      }
                    }, 1e4);
                  } else {
                    if (pollCount < MAX_POLLS) {
                      addLog("\u26A1 No access yet after hack on " + targetName + " (poll " + pollCount + "/" + MAX_POLLS + ")");
                      setTimeout(doPoll, 3e3);
                    } else {
                      resolve({ ok: false, error: "No access granted after hack on " + targetName });
                    }
                  }
                }
              }
              window.addEventListener("message", onPollStatus);
              var pollTimer = setTimeout(function() {
                if (!pollHandled) {
                  pollHandled = true;
                  window.removeEventListener("message", onPollStatus);
                  resolve({ ok: false, error: "Poll login status timed out on " + targetName });
                }
              }, 8e3);
              window.__cor3AutoJobGetLoginStatus(targetId);
            }
            setTimeout(doPoll, 1500);
          }
          addLog("Setting endpoint to " + serverName + " (" + serverId.substring(0, 8) + ")...");
          sendSetEndpoint(serverId).then(function(result) {
            if (result.ok) {
              if (result.timeout) {
                addLog("Endpoint set (timeout \u2014 may already be set)");
              } else {
                addLog("Endpoint set successfully");
              }
              sendResult(true);
              return;
            }
            if (result.maintenance) {
              addLog("Server " + serverName + " is in maintenance", "var(--accent-orange)");
              sendResult(false, "server-in-maintenance");
              return;
            }
            if (result.noPath) {
              let onMapData = function(evt) {
                if (mapHandled) return;
                if (evt.data && evt.data.type === "COR3_WS_MAP_DATA" && evt.data.servers) {
                  mapHandled = true;
                  clearTimeout(mapTimer);
                  window.removeEventListener("message", onMapData);
                  try {
                    let dfs = function(currentId, path) {
                      if (currentId === serverId) {
                        allPaths.push(path.slice());
                        return;
                      }
                      var neighbors = adjacency[currentId] || [];
                      for (var ni = 0; ni < neighbors.length; ni++) {
                        var nb = neighbors[ni];
                        if (!visited[nb]) {
                          if (nb !== serverId) {
                            var nbInfo = serverLookup[nb];
                            if (nbInfo && nbInfo.isInMaintenance) {
                              var mEnd = nbInfo.maintenanceEndsAt ? new Date(nbInfo.maintenanceEndsAt).getTime() - now : 0;
                              if (mEnd > 0) continue;
                            }
                          }
                          visited[nb] = true;
                          var nbSrv = serverLookup[nb];
                          path.push({ id: nb, name: nbSrv ? nbSrv.serverName : nb.substring(0, 8) });
                          dfs(nb, path);
                          path.pop();
                          visited[nb] = false;
                        }
                      }
                    }, tryNextPath = function() {
                      if (pathIdx >= allPaths.length) {
                        addLog("All " + allPaths.length + " path(s) exhausted \u2014 server unreachable", "var(--accent-red)");
                        sendResult(false, "all-paths-failed");
                        return;
                      }
                      var currentPath = allPaths[pathIdx];
                      pathIdx++;
                      if (currentPath.length <= 1) {
                        tryNextPath();
                        return;
                      }
                      var intermediates = currentPath.slice(0, currentPath.length - 1);
                      var pathNames = currentPath.map(function(s2) {
                        return s2.name;
                      }).join(" \u2192 ");
                      addLog("\u26A1 Trying path " + pathIdx + "/" + allPaths.length + ": " + pathNames);
                      var stepIdx = 0;
                      function nextStep() {
                        if (stepIdx >= intermediates.length) {
                          addLog("\u26A1 Path-through complete \u2014 retrying endpoint to " + serverName + "...");
                          sendSetEndpoint(serverId).then(function(retryResult) {
                            if (retryResult.ok) {
                              addLog("Endpoint set successfully after path-through");
                              sendResult(true);
                            } else if (retryResult.maintenance) {
                              addLog("Server " + serverName + " is in maintenance", "var(--accent-orange)");
                              sendResult(false, "server-in-maintenance");
                            } else {
                              addLog("\u26A1 Still unreachable after path " + pathIdx + " \u2014 trying next path", "var(--accent-orange)");
                              tryNextPath();
                            }
                          });
                          return;
                        }
                        var intermediate = intermediates[stepIdx];
                        stepIdx++;
                        addLog("\u26A1 Path step " + stepIdx + "/" + intermediates.length + ": setting endpoint to " + intermediate.name);
                        sendSetEndpoint(intermediate.id).then(function(intResult) {
                          if (intResult.ok || intResult.timeout) {
                            setTimeout(function() {
                              loginToServer(intermediate.id, intermediate.name).then(function(loginResult) {
                                if (loginResult.ok) {
                                  setTimeout(nextStep, 1e3);
                                } else {
                                  addLog("\u26A1 Login/hack failed on " + intermediate.name + ": " + loginResult.error + " \u2014 trying next path", "var(--accent-orange)");
                                  tryNextPath();
                                }
                              });
                            }, 1e3);
                          } else if (intResult.maintenance) {
                            addLog("\u26A1 " + intermediate.name + " is in maintenance \u2014 trying next path", "var(--accent-orange)");
                            tryNextPath();
                          } else {
                            addLog("\u26A1 " + intermediate.name + " unreachable \u2014 trying next path", "var(--accent-orange)");
                            tryNextPath();
                          }
                        });
                      }
                      nextStep();
                    };
                    var servers = evt.data.servers || [];
                    var connections = evt.data.connections || [];
                    var homeId = null;
                    var serverLookup = {};
                    var adjacency = {};
                    for (var i = 0; i < servers.length; i++) {
                      var s = servers[i];
                      serverLookup[s.id] = s;
                      adjacency[s.id] = [];
                      if (s.serverTypeName === "Home" || s.serverName === "Home Server") {
                        homeId = s.id;
                      }
                    }
                    for (var j = 0; j < connections.length; j++) {
                      var c = connections[j];
                      if (adjacency[c.serverA] && adjacency[c.serverB]) {
                        adjacency[c.serverA].push(c.serverB);
                        adjacency[c.serverB].push(c.serverA);
                      }
                    }
                    if (!homeId) {
                      addLog("Could not find Home Server in map data", "var(--accent-red)");
                      sendResult(false, "no-home-server-in-map");
                      return;
                    }
                    var allPaths = [];
                    var visited = {};
                    var now = Date.now();
                    visited[homeId] = true;
                    dfs(homeId, []);
                    allPaths.sort(function(a, b) {
                      return a.length - b.length;
                    });
                    if (allPaths.length === 0) {
                      addLog("No viable paths from Home to " + serverName + " (all paths blocked by maintenance)", "var(--accent-red)");
                      sendResult(false, "all-paths-blocked-by-maintenance");
                      return;
                    }
                    addLog("Found " + allPaths.length + " viable path(s) to " + serverName + " (maintenance servers excluded)");
                    var pathIdx = 0;
                    tryNextPath();
                  } catch (ex) {
                    addLog("Path resolution error: " + ex.message, "var(--accent-red)");
                    sendResult(false, "path-resolution-error");
                  }
                }
              };
              addLog("No direct path to " + serverName + " \u2014 attempting path-through hack...");
              addLog("Fetching network map for path resolution...");
              window.__cor3AutoJobGetNetworkMap();
              var mapHandled = false;
              window.addEventListener("message", onMapData);
              var mapTimer = setTimeout(function() {
                if (!mapHandled) {
                  mapHandled = true;
                  window.removeEventListener("message", onMapData);
                  addLog("Timeout waiting for map data (12s)", "var(--accent-red)");
                  sendResult(false, "map-timeout");
                }
              }, 12e3);
              return;
            }
            addLog("Endpoint error: " + result.errorMsg);
            sendResult(false, result.errorMsg);
          });
        })(event.data.serverId);
      }
      if (event.data && event.data.type === "COR3_REQUEST_STASH") {
        window.__cor3RequestStash();
      }
      if (event.data && event.data.type === "COR3_REQUEST_SPECIALISTS") {
        window.__cor3RequestSpecialists();
      }
      if (event.data && event.data.type === "COR3_PURCHASE_SPECIALIST") {
        window.__cor3PurchaseSpecialist(event.data.specialistType, event.data.kind, event.data.level, event.data.priceId);
      }
      if (event.data && event.data.type === "COR3_REQUEST_LOADOUT") {
        window.__cor3RequestLoadout();
      }
      if (event.data && event.data.type === "COR3_EQUIP_HARDWARE") {
        window.__cor3EquipHardware(event.data.moduleConfigId);
      }
      if (event.data && event.data.type === "COR3_EQUIP_SOFTWARE") {
        window.__cor3EquipSoftware(event.data.moduleConfigId);
      }
      if (event.data && event.data.type === "COR3_UNEQUIP_SOFTWARE") {
        window.__cor3UnequipSoftware(event.data.moduleConfigId);
      }
      if (event.data && event.data.type === "COR3_REQUEST_MARKET") {
        window.__cor3RequestMarket();
      }
      if (event.data && event.data.type === "COR3_REQUEST_DARK_MARKET") {
        window.__cor3RequestDarkMarket();
      }
      if (event.data && event.data.type === "COR3_REQUEST_SOYUZ_MARKET") {
        window.__cor3RequestSoyuzMarket();
      }
      if (event.data && event.data.type === "COR3_REQUEST_USOL_MARKET") {
        window.__cor3RequestUsolMarket();
      }
      if (event.data && event.data.type === "COR3_REFRESH_MARKET") {
        window.__cor3RefreshMarket();
      }
      if (event.data && event.data.type === "COR3_REFRESH_DARK_MARKET") {
        window.__cor3RefreshDarkMarket();
      }
      if (event.data && event.data.type === "COR3_REFRESH_SOYUZ_MARKET") {
        window.__cor3RefreshSoyuzMarket();
      }
      if (event.data && event.data.type === "COR3_REFRESH_USOL_MARKET") {
        window.__cor3RefreshUsolMarket();
      }
      if (event.data && event.data.type === "COR3_REFRESH_ALL_MARKETS_SEQ") {
        var opts = {};
        if (event.data.skipLots) opts.skipLots = true;
        if (event.data.order) opts.order = event.data.order;
        window.__cor3RefreshAllMarketsSequential(null, opts);
      }
      if (event.data && event.data.type === "COR3_LEAVE_STASH") {
        leaveRoom("stash");
      }
      if (event.data && event.data.type === "COR3_SELL_ITEM") {
        window.__cor3SellItem(event.data.itemId, event.data.quantity || 1, event.data.skipStashRefresh);
      }
      if (event.data && event.data.type === "COR3_RESPOND_DECISION") {
        window.__cor3RespondDecision(event.data.expeditionId, event.data.messageId, event.data.selectedOption);
      }
      if (event.data && event.data.type === "COR3_REQUEST_ARCHIVED_EXPEDITIONS") {
        window.__cor3RequestArchivedExpeditions();
      }
      if (event.data && event.data.type === "COR3_REQUEST_MERCENARIES") {
        window.__cor3RequestMercenaries(null, function() {
          window.postMessage({ type: "COR3_CORE_MERCS_DONE" }, "*");
        });
      }
      if (event.data && event.data.type === "COR3_REQUEST_USOL_MERCENARIES") {
        window.__cor3RequestUsolMercenaries(function() {
          window.postMessage({ type: "COR3_USOL_MERCS_DONE" }, "*");
        });
      }
      if (event.data && event.data.type === "COR3_REQUEST_EXPEDITION_CONFIG") {
        window.__cor3RequestExpeditionConfig();
      }
      if (event.data && event.data.type === "COR3_LAUNCH_EXPEDITION") {
        window.__cor3LaunchExpedition(event.data.config);
      }
      if (event.data && event.data.type === "COR3_RELAUNCH_EXPEDITION") {
        console.log("[COR3 Helper] Relaunching expedition with stored data");
        window.__cor3LaunchExpedition(event.data.data);
      }
      if (event.data && event.data.type === "COR3_OPEN_CONTAINER") {
        window.__cor3OpenContainer(event.data.expeditionId);
      }
      if (event.data && event.data.type === "COR3_COLLECT_ALL") {
        window.__cor3CollectAll(event.data.expeditionId);
      }
      if (event.data && event.data.type === "COR3_STOP_DECRYPT_SOLVER") {
        window.__solverAbort = true;
      }
      if (event.data && event.data.type === "COR3_STOP_DAILY_HACK") {
        window.__dailyHackAbort = true;
        window.__dailyHackActive = false;
      }
      if (event.data && event.data.type === "COR3_START_DECRYPT_SOLVER") {
        if (window.__solverActive && !window.__solverAbort) return;
        window.__solverAbort = false;
        window.__solverActive = false;
      }
      if (event.data && event.data.type === "COR3_STOP_ICE_WALL_SOLVER") {
        window.__iceWallSolverAbort = true;
      }
      if (event.data && event.data.type === "COR3_START_ICE_WALL_SOLVER") {
        if (window.__iceWallSolverActive && !window.__iceWallSolverAbort) return;
        window.__iceWallSolverAbort = false;
        window.__iceWallSolverActive = false;
      }
      if (event.data && event.data.type === "COR3_KEEP_ALIVE") {
        window.__cor3KeepAlive();
      }
      if (event.data && event.data.type === "COR3_AUTOJOB_CMD") {
        var cmd = event.data.cmd;
        var d = event.data.data || {};
        if (cmd === "job.take") window.__cor3AutoJobTake(d.marketId, d.jobId);
        else if (cmd === "job.complete") window.__cor3AutoJobComplete(d.marketId, d.jobId);
        else if (cmd === "job.dismiss") window.__cor3AutoJobDismiss(d.marketId, d.jobId);
        else if (cmd === "get.jobs") window.__cor3AutoJobGetMarketOptions(d.marketId);
        else if (cmd === "get.options") window.__cor3AutoJobGetMarketOptions(d.marketId);
        else if (cmd === "set.endpoint") window.__cor3AutoJobSetEndpoint(d.serverId);
        else if (cmd === "get.login.status") window.__cor3AutoJobGetLoginStatus(d.serverId);
        else if (cmd === "login.with-access") window.__cor3AutoJobLoginWithAccess(d.serverId, d.accessGrantId);
        else if (cmd === "hack.start") window.__cor3AutoJobHackStart(d.serverId);
        else if (cmd === "get.files") window.__cor3AutoJobGetFiles(d.serverId);
        else if (cmd === "file.download") window.__cor3AutoJobFileDownload(d.serverId, d.fileId);
        else if (cmd === "get.logs") window.__cor3AutoJobGetLogs(d.serverId);
        else if (cmd === "log.delete") window.__cor3AutoJobLogDelete(d.serverId, d.seq);
        else if (cmd === "log.download") window.__cor3AutoJobLogDownload(d.serverId, d.seq);
        else if (cmd === "get.transit") window.__cor3AutoJobGetTransit(d.serverId);
        else if (cmd === "transit.add") window.__cor3AutoJobTransitAdd(d.serverId, d.ip, d.description);
        else if (cmd === "open.folder") window.__cor3AutoJobOpenFolder(d.folderId);
        else if (cmd === "decrypt.file") window.__cor3AutoJobDecryptFile(d.fileId);
        else if (cmd === "get.map") window.__cor3AutoJobGetNetworkMap();
        else if (cmd === "desktop.get.options") window.__cor3AutoJobGetDesktopOptions();
        else if (cmd === "file.delete") window.__cor3AutoJobFileDelete(d.serverId, d.fileId);
        else if (cmd === "file.upload") window.__cor3AutoJobFileUpload(d.serverId, d.name, d.sizeMb);
        else if (cmd === "transit.remove") window.__cor3AutoJobTransitRemove(d.serverId, d.ip);
        else if (cmd === "get.file.analysis") window.__cor3AutoJobGetFileAnalysis(d.fileId);
        else if (cmd === "loadout.get") window.__cor3AutoJobRequestLoadout();
        else if (cmd === "loadout.equip.hardware") window.__cor3AutoJobEquipHardware(d.moduleConfigId);
        else if (cmd === "loadout.equip.software") window.__cor3AutoJobEquipSoftware(d.moduleConfigId);
        else if (cmd === "loadout.unequip.software") window.__cor3AutoJobUnequipSoftware(d.moduleConfigId);
        else if (cmd === "file.search-valuable") window.__cor3ValuableFileSearch(d.serverId);
        else if (cmd === "log.search-valuable") window.__cor3ValuableLogSearch(d.serverId);
        else if (cmd === "get.sellable-items") window.__cor3ValuableGetSellableItems(d.marketId);
        else if (cmd === "sell.items") window.__cor3ValuableSellItems(d.marketId, d.items);
      }
      if (event.data && event.data.type === "COR3_IP_SEARCH_START") {
        (function runSecretFinder() {
          var DELAY_MS = 2500;
          var HARD_TIMEOUT_MS = 18e4;
          var aborted = false;
          var getMapMsg = '42["event",{"event":{"name":"network-map","action":"get.map"},"data":{}}]';
          function logMsg(html) {
            window.postMessage({ type: "COR3_IP_SEARCH_LOG", html }, "*");
          }
          function doneMsg(html) {
            window.postMessage({ type: "COR3_IP_SEARCH_DONE", html }, "*");
          }
          var hardTimer = setTimeout(function() {
            if (!aborted) {
              aborted = true;
              doneMsg('<span style="color:var(--accent-orange);">\u23F1\uFE0F Search timed out after 3 minutes \u2014 auto-disabled</span>');
            }
          }, HARD_TIMEOUT_MS);
          function waitForMap(timeout) {
            return new Promise(function(resolve) {
              var done = false;
              function onMsg(evt) {
                if (done) return;
                if (evt.data && evt.data.type === "COR3_WS_MAP_DATA") {
                  done = true;
                  window.removeEventListener("message", onMsg);
                  clearTimeout(timer);
                  resolve(evt.data);
                }
              }
              window.addEventListener("message", onMsg);
              var timer = setTimeout(function() {
                if (!done) {
                  done = true;
                  window.removeEventListener("message", onMsg);
                  resolve(null);
                }
              }, timeout || 1e4);
            });
          }
          function connectIp(ip) {
            wsSend('42["event",{"event":{"name":"network-map","action":"connect.ip"},"data":{"ipAddress":"' + ip + '"}}]');
          }
          logMsg('<span style="color:var(--accent-cyan);">Fetching network map...</span>');
          wsSend(getMapMsg);
          waitForMap(1e4).then(function(mapData1) {
            if (aborted) return;
            if (!mapData1 || !mapData1.servers || !mapData1.connections) {
              clearTimeout(hardTimer);
              doneMsg('<span style="color:var(--accent-red);">Failed to fetch initial map data</span>');
              return;
            }
            var oldConnections = new Set(mapData1.connections.map(function(c) {
              return c.id;
            }));
            var oldServerIds = new Set(mapData1.servers.map(function(s) {
              return s.id;
            }));
            var serverIps = mapData1.servers.map(function(s) {
              return s.serverIp;
            }).filter(Boolean);
            var serverNameMap = {};
            mapData1.servers.forEach(function(s) {
              serverNameMap[s.id] = s.serverName;
            });
            var total = serverIps.length;
            var idx = 0;
            logMsg('<span style="color:var(--accent-cyan);">Found ' + total + " IPs to scan. Starting...</span>");
            function connectNext() {
              if (aborted) return;
              if (idx >= total) {
                logMsg('<span style="color:var(--accent-cyan);">Scanning complete. Fetching updated map...</span>');
                setTimeout(function() {
                  if (aborted) return;
                  wsSend(getMapMsg);
                  waitForMap(1e4).then(function(mapData2) {
                    clearTimeout(hardTimer);
                    if (aborted) return;
                    if (!mapData2 || !mapData2.connections) {
                      doneMsg('<span style="color:var(--accent-red);">Failed to fetch updated map data</span>');
                      return;
                    }
                    if (mapData2.servers) {
                      mapData2.servers.forEach(function(s) {
                        serverNameMap[s.id] = s.serverName;
                      });
                    }
                    var newConns = mapData2.connections.filter(function(c) {
                      return !oldConnections.has(c.id);
                    });
                    var newServers = (mapData2.servers || []).filter(function(s) {
                      return !oldServerIds.has(s.id);
                    });
                    var parts = [];
                    if (newConns.length > 0) {
                      parts.push('<div style="color:var(--accent-green);font-weight:bold;">Found ' + newConns.length + " new connection(s):</div>");
                      newConns.forEach(function(c) {
                        var a = serverNameMap[c.serverA] || c.serverA;
                        var b = serverNameMap[c.serverB] || c.serverB;
                        parts.push('<div style="padding:1px 0;margin-left:8px;color:var(--accent-cyan);">' + a + " \u2194 " + b + (c.isHidden ? ' <span style="color:var(--accent-orange);">(hidden)</span>' : "") + "</div>");
                      });
                    }
                    if (newServers.length > 0) {
                      parts.push('<div style="color:var(--accent-green);font-weight:bold;margin-top:4px;">Found ' + newServers.length + " new server(s):</div>");
                      newServers.forEach(function(s) {
                        parts.push('<div style="padding:1px 0;margin-left:8px;color:var(--accent-cyan);">\u{1F5A5}\uFE0F ' + (s.serverName || s.id) + "</div>");
                      });
                    }
                    if (newConns.length === 0 && newServers.length === 0) {
                      parts.push(`<span style="color:var(--accent-orange);">Couldn't find anything new... (` + total + " IPs scanned)</span>");
                    } else {
                      parts.push('<div style="margin-top:4px;color:var(--text-dim);">Scanned ' + total + " IPs</div>");
                    }
                    doneMsg(parts.join(""));
                  });
                }, 3e3);
                return;
              }
              var ip = serverIps[idx];
              idx++;
              logMsg('<span style="color:var(--accent-cyan);">Connecting ' + idx + "/" + total + ": " + ip + "</span>");
              connectIp(ip);
              setTimeout(connectNext, DELAY_MS);
            }
            connectNext();
          });
        })();
      }
      if (event.data && event.data.type === "COR3_ANTI_AFK_TOGGLE") {
        if (event.data.enabled) {
          if (!window.__cor3AntiAfkTimer) {
            let antiAfkClick = function() {
              var target = document.querySelector('div[data-component-name="DesktopWrapperBorder"]');
              if (!target) return;
              var rect = target.getBoundingClientRect();
              var cx = Math.floor(rect.left + rect.width / 2);
              var cy = Math.floor(rect.top + rect.height / 2);
              var opts2 = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window };
              target.dispatchEvent(new MouseEvent("mouseenter", opts2));
              target.dispatchEvent(new MouseEvent("mousemove", opts2));
              target.dispatchEvent(new MouseEvent("click", opts2));
              target.dispatchEvent(new MouseEvent("mouseleave", opts2));
            };
            var ANTI_AFK_INTERVAL = 3 * 60 * 1e3;
            antiAfkClick();
            window.__cor3AntiAfkTimer = setInterval(antiAfkClick, ANTI_AFK_INTERVAL);
            console.log("[COR3 Helper] Anti-AFK Clicker enabled (3 min interval)");
          }
        } else {
          if (window.__cor3AntiAfkTimer) {
            clearInterval(window.__cor3AntiAfkTimer);
            window.__cor3AntiAfkTimer = null;
            console.log("[COR3 Helper] Anti-AFK Clicker disabled");
          }
        }
      }
      if (event.data && event.data.type === "COR3_DEVTOOLS_WS_SEND") {
        var msg = event.data.message;
        if (msg && typeof msg === "string") {
          wsSendRaw(msg);
        }
      }
    });
  }
  function scheduleVersionRepost() {
    function repostVersions() {
      if (window.__cor3WebVersion) {
        window.postMessage({ type: "COR3_WEB_VERSION", version: window.__cor3WebVersion }, "*");
      }
      if (window.__cor3SystemVersion) {
        window.postMessage({ type: "COR3_SYSTEM_VERSION", version: window.__cor3SystemVersion }, "*");
      }
      if (window.__cor3PatchVersion) {
        window.postMessage({ type: "COR3_PATCH_VERSION", version: window.__cor3PatchVersion }, "*");
      }
    }
    setTimeout(repostVersions, 3e3);
    setTimeout(repostVersions, 8e3);
  }

  // src/content-early/index.js
  if (window.__cor3WsInterceptorActive) throw new Error("COR3 already active");
  window.__cor3WsInterceptorActive = true;
  (function() {
    setPostUnreachable(__cor3PostUnreachable2);
    installWebSocketProxy(handleWsMessage);
    installHttpIntercept();
    installSocketHealthCheck();
    installMessageListener();
    scheduleVersionRepost();
    console.log("[COR3 Helper] WebSocket interceptor installed");
  })();
})();
