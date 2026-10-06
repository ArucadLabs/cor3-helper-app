(() => {
  // src/shared/ws-utils.js
  function humanDelay() {
    return 800 + Math.floor(Math.random() * 700);
  }
  function createSendCmd(messageType) {
    messageType = messageType || "COR3_AUTOJOB_CMD";
    return function sendCmd2(cmd, data) {
      window.postMessage({ type: messageType, cmd, data: data || {} }, "*");
    };
  }
  var _mcChannel = typeof MessageChannel !== "undefined" ? new MessageChannel() : null;
  var _mcCallbacks = [];
  if (_mcChannel) {
    _mcChannel.port1.onmessage = function() {
      var cbs = _mcCallbacks.slice();
      _mcCallbacks.length = 0;
      for (var i = 0; i < cbs.length; i++) cbs[i]();
    };
  }
  function nextTick(fn) {
    if (_mcChannel) {
      _mcCallbacks.push(fn);
      _mcChannel.port2.postMessage(0);
    } else {
      setTimeout(fn, 0);
    }
  }
  var _safeTimeoutId = 0;
  var _safeTimeouts = {};
  function safeTimeout(fn, ms) {
    var id = ++_safeTimeoutId;
    var target = Date.now() + ms;
    _safeTimeouts[id] = true;
    function tick() {
      if (!_safeTimeouts[id]) return;
      if (Date.now() >= target) {
        delete _safeTimeouts[id];
        fn();
        return;
      }
      var rem = target - Date.now();
      if (rem > 200) {
        setTimeout(function() {
          nextTick(tick);
        }, Math.min(rem - 50, 1e3));
      } else {
        nextTick(tick);
      }
    }
    nextTick(tick);
    return id;
  }
  function safeClearTimeout(id) {
    delete _safeTimeouts[id];
  }
  function createDelay(abortFlagFn) {
    return function delay2(ms) {
      return new Promise(function(resolve, reject) {
        var target = Date.now() + ms;
        function check() {
          if (abortFlagFn && abortFlagFn()) {
            reject(new Error("Aborted"));
            return;
          }
          if (Date.now() >= target) {
            resolve();
            return;
          }
          var remaining = target - Date.now();
          if (remaining > 200) {
            setTimeout(function() {
              nextTick(check);
            }, Math.min(remaining - 50, 1e3));
          } else {
            nextTick(check);
          }
        }
        nextTick(check);
      });
    };
  }
  function createWaitForEvent(abortFlagFn) {
    return function waitForEvent2(eventType, timeoutMs) {
      timeoutMs = timeoutMs || 15e3;
      return new Promise(function(resolve, reject) {
        var done = false;
        var deadline = Date.now() + timeoutMs;
        function handler(evt) {
          if (evt.data && evt.data.type === eventType) {
            if (done) return;
            done = true;
            window.removeEventListener("message", handler);
            resolve(evt.data);
          }
        }
        window.addEventListener("message", handler);
        function checkTimeout() {
          if (done) return;
          if (abortFlagFn && abortFlagFn()) {
            done = true;
            window.removeEventListener("message", handler);
            reject(new Error("Aborted"));
            return;
          }
          if (Date.now() >= deadline) {
            done = true;
            window.removeEventListener("message", handler);
            reject(new Error("Timeout waiting for " + eventType));
            return;
          }
          var remaining = deadline - Date.now();
          if (remaining > 200) {
            setTimeout(function() {
              nextTick(checkTimeout);
            }, Math.min(remaining - 50, 1e3));
          } else {
            nextTick(checkTimeout);
          }
        }
        nextTick(checkTimeout);
      });
    };
  }
  function createLogger(prefix, messageType) {
    return function log2(msg, level) {
      level = level || "info";
      console.log(prefix, msg);
      window.postMessage({ type: messageType, msg, level }, "*");
    };
  }

  // src/shared/hack-utils.js
  function detectHackType(pollMs) {
    pollMs = pollMs || 5e3;
    return new Promise(function(resolve) {
      var elapsed = 0;
      var interval = 200;
      function check() {
        if (document.querySelector('[data-component-name="WallBoard"]') || document.querySelector('[data-component-name="IceWallBreakApplication"]') || document.querySelector('[data-sentry-component="IceWallBreakApplication"]')) return resolve("ice-wall");
        if (document.querySelector('[data-sentry-component="ConfigHackApplication"]')) return resolve("decrypt");
        if (document.querySelector('[data-component-name="SimpleDecryptApplication"]') || document.querySelector('[data-sentry-component="SimpleDecryptApplication"]')) return resolve("simple-decrypt");
        elapsed += interval;
        if (elapsed >= pollMs) return resolve(null);
        safeTimeout(check, interval);
      }
      check();
    });
  }
  function isHackMinigameOpen() {
    return !!(document.querySelector('[data-component-name="IceWallBreakApplication"]') || document.querySelector('[data-sentry-component="IceWallBreakApplication"]') || document.querySelector('[data-component-name="WallBoard"]') || document.querySelector('[data-sentry-component="ConfigHackApplication"]') || document.querySelector('[data-component-name="SimpleDecryptApplication"]') || document.querySelector('[data-sentry-component="SimpleDecryptApplication"]'));
  }
  function waitForHackMinigameClose(waitMs) {
    waitMs = waitMs || 12e4;
    return new Promise(function(resolve) {
      var elapsed = 0;
      var interval = 300;
      function check() {
        if (!isHackMinigameOpen()) return resolve(true);
        elapsed += interval;
        if (elapsed >= waitMs) return resolve(false);
        safeTimeout(check, interval);
      }
      check();
    });
  }
  function createWaitForHackToBeDone(logFn, abortFlagFn) {
    return async function waitForHackToBeDone2() {
      logFn("Hack minigame started, waiting for solver to complete...");
      var hackSolverTimeout = 6e4;
      var hackType = await detectHackType(5e3);
      if (hackType === "ice-wall") {
        hackSolverTimeout = 12e4;
        logFn("ICE Wall hack detected \u2014 waiting up to 2 minutes");
      } else if (hackType) {
        logFn(hackType + " hack detected \u2014 waiting up to 60s");
      } else {
        logFn("Could not detect hack type \u2014 using default 60s timeout", "warn");
      }
      var saiUpdateReceived = false;
      var canPollClose = !!hackType;
      try {
        await new Promise(function(resolve, reject) {
          var done = false;
          function onEvent(evt) {
            if (evt.data && evt.data.type === "COR3_AUTOJOB_SAI_UPDATE") {
              if (!done) {
                done = true;
                window.removeEventListener("message", onEvent);
                safeClearTimeout(pollTimerId);
                safeClearTimeout(timeoutTimerId);
                saiUpdateReceived = true;
                resolve();
              }
            }
          }
          window.addEventListener("message", onEvent);
          var pollTimerId = 0;
          function pollClose() {
            if (done) return;
            if (abortFlagFn && abortFlagFn()) {
              if (!done) {
                done = true;
                window.removeEventListener("message", onEvent);
                safeClearTimeout(timeoutTimerId);
                reject(new Error("Aborted"));
              }
              return;
            }
            if (canPollClose && !isHackMinigameOpen()) {
              if (!done) {
                done = true;
                window.removeEventListener("message", onEvent);
                safeClearTimeout(timeoutTimerId);
                resolve();
              }
            } else {
              pollTimerId = safeTimeout(pollClose, 500);
            }
          }
          pollTimerId = safeTimeout(pollClose, 500);
          var timeoutTimerId = safeTimeout(function() {
            if (!done) {
              done = true;
              window.removeEventListener("message", onEvent);
              safeClearTimeout(pollTimerId);
              reject(new Error("timeout"));
            }
          }, hackSolverTimeout);
        });
      } catch (e) {
        if (abortFlagFn && abortFlagFn()) {
          logFn("Hack wait aborted by user", "warn");
          return;
        }
        logFn("Hack solver did not complete in " + hackSolverTimeout / 1e3 + "s \u2014 checking login status directly", "warn");
      }
      if (saiUpdateReceived) {
        logFn("Hack completed (SAI update)", "success");
      } else if (canPollClose && !isHackMinigameOpen()) {
        logFn("Hack completed (minigame closed)", "success");
      }
      if (isHackMinigameOpen()) {
        logFn("Waiting for hack minigame dialog to close...");
        await waitForHackMinigameClose(3e4);
      }
    };
  }
  function ensureDecryptSolverEnabled() {
    window.postMessage({ type: "COR3_AUTOJOB_ENABLE_DECRYPT_SOLVER" }, "*");
  }
  function ensureIceWallSolverEnabled() {
    window.postMessage({ type: "COR3_AUTOJOB_ENABLE_ICE_WALL_SOLVER" }, "*");
  }
  function ensureSimpleDecryptSolverEnabled() {
    window.postMessage({ type: "COR3_AUTOJOB_ENABLE_SIMPLE_DECRYPT_SOLVER" }, "*");
  }

  // src/shared/server-constants.js
  var HOME_SERVER_ID = "019c0a5b-eeeb-7d3e-b9c9-fd5c2ba7d399";
  var MARKET_IDS = {
    home: "019d3ea4-85bd-7389-904d-8f7c85841134",
    dark: "019d3ea4-85bd-7389-904d-908ba9194aa0",
    soyuz: "019da731-2db5-7d76-9447-1ea3b9b78001",
    usol: "019e4065-6ae8-760d-8724-58ab4f2cf7d7"
  };
  var MARKET_SERVER_IDS = {
    dark: "019d29c5-4b37-79bf-b23e-304d8ea03c15",
    soyuz: "019da6f1-16f7-75a6-b6d3-0b1d5f92a108",
    usol: "019e4052-c317-7388-9d71-883ffb1560cd"
  };
  var MARKET_SELL_ORDER = [
    { name: "USOL", id: MARKET_IDS.usol, serverId: MARKET_SERVER_IDS.usol },
    { name: "SOYUZ", id: MARKET_IDS.soyuz, serverId: MARKET_SERVER_IDS.soyuz },
    { name: "D4RK", id: MARKET_IDS.dark, serverId: MARKET_SERVER_IDS.dark },
    { name: "HOME", id: MARKET_IDS.home, serverId: null }
  ];
  var MARKET_RESET_DURATIONS_MS = {
    home: 6 * 60 * 60 * 1e3,
    dark: 12 * 60 * 60 * 1e3,
    soyuz: 10 * 60 * 60 * 1e3,
    usol: 8 * 60 * 60 * 1e3
  };

  // src/shared/server-map.js
  function ServerMap() {
    this._servers = {};
    this._adjacency = {};
    this._homeId = null;
    this._ready = false;
    this._pathCache = {};
    this._serverPriority = null;
  }
  ServerMap.prototype.update = function(mapData) {
    if (!mapData || !mapData.servers || !mapData.connections) return;
    this._servers = {};
    this._adjacency = {};
    this._pathCache = {};
    this._serverPriority = null;
    this._homeId = null;
    var servers = Array.isArray(mapData.servers) ? mapData.servers : [];
    var connections = Array.isArray(mapData.connections) ? mapData.connections : [];
    for (var i = 0; i < servers.length; i++) {
      var s = servers[i];
      this._servers[s.id] = {
        id: s.id,
        name: s.serverName,
        ip: s.serverIp,
        typeName: s.serverTypeName || null,
        cluster: s.serverCluster || null,
        faction: s.faction || null,
        defenceRate: s.serverDefenceRate || 0,
        isInMaintenance: !!s.isInMaintenance,
        maintenanceEndsAt: s.maintenanceEndsAt || null,
        timeUntilMaintenance: s.timeUntilMaintenance || null,
        isDiscovered: s.isDiscovered !== false,
        isAccessible: !!s.isAccessible,
        isReachable: !!s.isReachable,
        accessType: s.accessType || "none",
        hasAdminAccess: !!s.hasAdminAccess,
        isEndpoint: !!s.isEndpoint,
        canSetEndpoint: s.canSetEndpoint !== false,
        marketId: s.marketId || null,
        transitType: s.transitType || null
      };
      this._adjacency[s.id] = [];
      if (s.serverTypeName === "Home" || s.serverName === "Home Server" || s.id === HOME_SERVER_ID) {
        this._homeId = s.id;
      }
    }
    for (var j = 0; j < connections.length; j++) {
      var c = connections[j];
      if (this._adjacency[c.serverA] && this._adjacency[c.serverB]) {
        this._adjacency[c.serverA].push({ targetId: c.serverB, connectionId: c.id, isHidden: !!c.isHidden });
        this._adjacency[c.serverB].push({ targetId: c.serverA, connectionId: c.id, isHidden: !!c.isHidden });
      }
    }
    this._ready = true;
  };
  ServerMap.prototype.isReady = function() {
    return this._ready;
  };
  ServerMap.prototype.getServer = function(serverId) {
    return this._servers[serverId] || null;
  };
  ServerMap.prototype.getServerByName = function(name) {
    for (var id in this._servers) {
      if (this._servers[id].name === name) return this._servers[id];
    }
    return null;
  };
  ServerMap.prototype.getServerIdByName = function(name) {
    var s = this.getServerByName(name);
    return s ? s.id : null;
  };
  ServerMap.prototype.getAllServers = function() {
    return this._servers;
  };
  ServerMap.prototype.getHomeId = function() {
    return this._homeId;
  };
  ServerMap.prototype.findAllPaths = function(targetId, opts) {
    if (!this._ready || !this._homeId) return [];
    if (targetId === this._homeId) return [[]];
    var skipMaintenance = !opts || opts.skipMaintenance !== false;
    var maintFp = skipMaintenance ? this.getMaintenanceFingerprint() : "";
    var cacheKey = targetId + "|" + (skipMaintenance ? "sm:" + maintFp : "all");
    if (this._pathCache[cacheKey]) return this._pathCache[cacheKey];
    var allPaths = [];
    var visited = {};
    var self = this;
    function dfs(currentId, path) {
      if (currentId === targetId) {
        allPaths.push(path.slice());
        return;
      }
      var neighbors = self._adjacency[currentId];
      if (!neighbors) return;
      for (var i = 0; i < neighbors.length; i++) {
        var nb = neighbors[i];
        if (!visited[nb.targetId]) {
          if (skipMaintenance && nb.targetId !== targetId) {
            var srv = self._servers[nb.targetId];
            if (srv && srv.isInMaintenance) {
              var remaining = srv.maintenanceEndsAt ? new Date(srv.maintenanceEndsAt).getTime() - Date.now() : 0;
              if (remaining > 0) continue;
            }
          }
          visited[nb.targetId] = true;
          path.push({ id: nb.targetId, name: (self._servers[nb.targetId] || {}).name || nb.targetId, isHidden: nb.isHidden });
          dfs(nb.targetId, path);
          path.pop();
          visited[nb.targetId] = false;
        }
      }
    }
    visited[this._homeId] = true;
    dfs(this._homeId, []);
    allPaths.sort(function(a, b) {
      return a.length - b.length;
    });
    this._pathCache[cacheKey] = allPaths;
    return allPaths;
  };
  ServerMap.prototype.getShortestPath = function(targetId) {
    var paths = this.findAllPaths(targetId);
    return paths.length > 0 ? paths[0] : null;
  };
  ServerMap.prototype.getShortestPathByName = function(serverName) {
    var id = this.getServerIdByName(serverName);
    if (!id) return null;
    return this.getShortestPath(id);
  };
  ServerMap.prototype.findAllPathsByName = function(serverName) {
    var id = this.getServerIdByName(serverName);
    if (!id) return [];
    return this.findAllPaths(id);
  };
  ServerMap.prototype.checkPathMaintenance = function(targetServerNameOrId) {
    if (!this._ready) return { blocked: false };
    var targetId = this._servers[targetServerNameOrId] ? targetServerNameOrId : this.getServerIdByName(targetServerNameOrId);
    if (!targetId) return { blocked: false };
    var reachablePaths = this.findAllPaths(targetId);
    if (reachablePaths.length > 0) return { blocked: false, usedPath: reachablePaths[0] };
    var allPaths = this.findAllPaths(targetId, { skipMaintenance: false });
    if (allPaths.length === 0) return { blocked: true, blockerName: "no-path", endsAt: null, remainingMs: 0 };
    var firstBlocker = null;
    var firstPath = allPaths[0];
    for (var bi = 0; bi < firstPath.length; bi++) {
      var bsrv = this._servers[firstPath[bi].id];
      if (bsrv && bsrv.isInMaintenance) {
        var bRemaining = bsrv.maintenanceEndsAt ? new Date(bsrv.maintenanceEndsAt).getTime() - Date.now() : 0;
        if (bRemaining > 0) {
          firstBlocker = { blocked: true, blockerName: bsrv.name, endsAt: bsrv.maintenanceEndsAt, remainingMs: bRemaining };
          break;
        }
      }
    }
    return firstBlocker || { blocked: true, blockerName: "unknown", endsAt: null, remainingMs: 0 };
  };
  ServerMap.prototype.findBestReachablePath = function(targetServerNameOrId) {
    if (!this._ready) return null;
    var targetId = this._servers[targetServerNameOrId] ? targetServerNameOrId : this.getServerIdByName(targetServerNameOrId);
    if (!targetId) return null;
    var allPaths = this.findAllPaths(targetId);
    return allPaths.length > 0 ? allPaths[0] : null;
  };
  ServerMap.prototype.getMaintenanceFingerprint = function() {
    var parts = [];
    for (var id in this._servers) {
      var s = this._servers[id];
      if (s.isInMaintenance) {
        parts.push(id + ":M:" + (s.maintenanceEndsAt || ""));
      } else if (s.timeUntilMaintenance) {
        parts.push(id + ":U:" + s.timeUntilMaintenance);
      }
    }
    parts.sort();
    return parts.join("|");
  };
  ServerMap.prototype.getServerPriority = function() {
    if (this._serverPriority) return this._serverPriority;
    if (!this._ready || !this._homeId) return [];
    var result = [];
    for (var id in this._servers) {
      if (id === this._homeId) continue;
      var s = this._servers[id];
      var path = this.getShortestPath(id);
      if (path) {
        result.push({ id, name: s.name, pathLength: path.length });
      }
    }
    result.sort(function(a, b) {
      return b.pathLength - a.pathLength;
    });
    this._serverPriority = result.map(function(r) {
      return r.name;
    });
    return this._serverPriority;
  };
  ServerMap.prototype.getServerPriorityIndex = function(serverName) {
    if (!serverName || serverName === "None") return -1;
    var priority = this.getServerPriority();
    var idx = priority.indexOf(serverName);
    return idx >= 0 ? idx : priority.length;
  };
  ServerMap.prototype.getMaintenanceInfo = function() {
    var info = {};
    for (var id in this._servers) {
      var s = this._servers[id];
      info[id] = {
        serverName: s.name,
        isInMaintenance: s.isInMaintenance,
        maintenanceEndsAt: s.maintenanceEndsAt,
        timeUntilMaintenance: s.timeUntilMaintenance
      };
    }
    return info;
  };
  ServerMap.prototype.getServerTypeMap = function() {
    var map = {};
    for (var id in this._servers) {
      var s = this._servers[id];
      map[id] = {
        serverName: s.name,
        serverTypeName: s.typeName,
        serverDefenceRate: s.defenceRate
      };
    }
    return map;
  };
  ServerMap.prototype.toJSON = function() {
    return {
      servers: this._servers,
      adjacency: this._adjacency,
      homeId: this._homeId,
      ready: this._ready
    };
  };
  ServerMap.prototype.fromJSON = function(json) {
    if (!json) return;
    this._servers = json.servers || {};
    this._adjacency = json.adjacency || {};
    this._homeId = json.homeId || null;
    this._ready = !!json.ready;
    this._pathCache = {};
    this._serverPriority = null;
  };
  ServerMap.prototype.getPathForServer = function(serverName) {
    if (this._ready) {
      var id = this.getServerIdByName(serverName);
      if (id) {
        var path = this.getShortestPath(id);
        if (path) return path;
      }
    }
    return FALLBACK_PATH_MAP[serverName] || null;
  };
  ServerMap.prototype.getServerNameById = function(serverId) {
    if (this._ready) {
      var s = this._servers[serverId];
      if (s) return s.name;
    }
    for (var name in FALLBACK_PATH_MAP) {
      var path = FALLBACK_PATH_MAP[name];
      for (var i = 0; i < path.length; i++) {
        if (path[i].id === serverId) return path[i].name;
      }
    }
    return null;
  };
  ServerMap.prototype.getPathForServerId = function(serverId) {
    if (this._ready) {
      var path = this.getShortestPath(serverId);
      if (path) return path;
    }
    for (var name in FALLBACK_PATH_MAP) {
      var path = FALLBACK_PATH_MAP[name];
      if (path.length > 0 && path[path.length - 1].id === serverId) {
        return path;
      }
    }
    return null;
  };
  ServerMap.prototype.getServerIdByNameOrFallback = function(serverName) {
    if (this._ready) {
      var id = this.getServerIdByName(serverName);
      if (id) return id;
    }
    var fb = FALLBACK_PATH_MAP[serverName];
    if (fb && fb.length > 0) return fb[fb.length - 1].id;
    return null;
  };
  ServerMap.prototype.getAllServerIds = function() {
    if (this._ready) {
      var result = {};
      for (var id in this._servers) {
        result[id] = this._servers[id].name;
      }
      return result;
    }
    var result = {};
    for (var name in FALLBACK_PATH_MAP) {
      var path = FALLBACK_PATH_MAP[name];
      var last = path[path.length - 1];
      result[last.id] = name;
    }
    return result;
  };
  ServerMap.prototype.getPathLength = function(serverId) {
    if (this._ready) {
      var path = this.getShortestPath(serverId);
      if (path) return path.length;
    }
    for (var name in FALLBACK_PATH_MAP) {
      var p = FALLBACK_PATH_MAP[name];
      var last = p[p.length - 1];
      if (last.id === serverId) return p.length;
    }
    return 0;
  };
  var FALLBACK_PATH_MAP = {
    "RM7-E1L3": [
      { name: "RM7-E1L3", id: "019d1b0a-13a9-77dd-b41f-33f06f2df284" }
    ],
    "RM7-E1L5": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" }
    ],
    "RM7-E1L2CT": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1L2CT", id: "019d53aa-5101-7f08-b3dd-378b0ddcf7d0" }
    ],
    "RM7-E1SCP": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" }
    ],
    "RM7-S4L4": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "RM7-S4L4", id: "019d1b0a-13a9-77dd-b41f-3ffb5f671742" }
    ],
    "D4RK RM7CE": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "D4RK RM7CE", id: "019d29c5-4b37-7436-aef9-89af09560af3" }
    ],
    "D4RK RM7MI": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "D4RK RM7CE", id: "019d29c5-4b37-7436-aef9-89af09560af3" },
      { name: "D4RK RM7MI", id: "019d29c5-4b37-79bf-b23e-304d8ea03c15" }
    ],
    "D4RK 2IV2": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "D4RK RM7CE", id: "019d29c5-4b37-7436-aef9-89af09560af3" },
      { name: "D4RK 2IV2", id: "019d29c5-4b37-7de9-b46c-022179bcb5eb" }
    ],
    "RM7-N2ECP": [
      { name: "RM7-E1L3", id: "019d1b0a-13a9-77dd-b41f-33f06f2df284" },
      { name: "RM7-N2ECP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a105" }
    ],
    "RM7-N2L2": [
      { name: "RM7-E1L3", id: "019d1b0a-13a9-77dd-b41f-33f06f2df284" },
      { name: "RM7-N2ECP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a105" },
      { name: "RM7-N2L2", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a101" }
    ],
    "RM7-N2L3": [
      { name: "RM7-E1L3", id: "019d1b0a-13a9-77dd-b41f-33f06f2df284" },
      { name: "RM7-N2ECP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a105" },
      { name: "RM7-N2L2", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a101" },
      { name: "RM7-N2L3", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a102" }
    ],
    "RM7-W3NCP": [
      { name: "RM7-E1L3", id: "019d1b0a-13a9-77dd-b41f-33f06f2df284" },
      { name: "RM7-N2ECP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a105" },
      { name: "RM7-N2L2", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a101" },
      { name: "RM7-N2L3", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a102" },
      { name: "RM7-W3NCP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a106" }
    ],
    "RM7-N1L1": [
      { name: "RM7-E1L3", id: "019d1b0a-13a9-77dd-b41f-33f06f2df284" },
      { name: "RM7-N2ECP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a105" },
      { name: "RM7-N2L2", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a101" },
      { name: "RM7-N2L3", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a102" },
      { name: "RM7-W3NCP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a106" },
      { name: "RM7-N1L1", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a104" }
    ],
    "RM7-S4L2": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "RM7-S4L2", id: "019e4052-c316-73aa-81f6-38c323c58eb2" }
    ],
    "RM7-S4L3": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "RM7-S4L2", id: "019e4052-c316-73aa-81f6-38c323c58eb2" },
      { name: "RM7-S4L3", id: "019e4052-c316-73aa-81f6-3dcef4d6873e" }
    ],
    "RM7-S4L1": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "RM7-S4L4", id: "019d1b0a-13a9-77dd-b41f-3ffb5f671742" },
      { name: "RM7-S4L1", id: "019e4052-c315-71df-80da-4e334b96c9e6" }
    ],
    "RM7-S4WCP": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "RM7-S4L2", id: "019e4052-c316-73aa-81f6-38c323c58eb2" },
      { name: "RM7-S4WCP", id: "019e4052-c316-73aa-81f6-448645a38c9e" }
    ],
    "D4RK RM7EG": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "D4RK RM7CE", id: "019d29c5-4b37-7436-aef9-89af09560af3" },
      { name: "D4RK RM7MI", id: "019d29c5-4b37-79bf-b23e-304d8ea03c15" },
      { name: "D4RK RM7EG", id: "019e4052-c316-73aa-81f6-483e50247e61" }
    ],
    "B43271N": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1L2CT", id: "019d53aa-5101-7f08-b3dd-378b0ddcf7d0" },
      { name: "B43271N", id: "019e4052-c316-73aa-81f6-567c9a8f5738" }
    ],
    "B43272N": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1L2CT", id: "019d53aa-5101-7f08-b3dd-378b0ddcf7d0" },
      { name: "B43271N", id: "019e4052-c316-73aa-81f6-567c9a8f5738" },
      { name: "B43272N", id: "019e4052-c316-73aa-81f6-5aa82fc72bdd" }
    ],
    "B43274N": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "D4RK RM7CE", id: "019d29c5-4b37-7436-aef9-89af09560af3" },
      { name: "D4RK RM7MI", id: "019d29c5-4b37-79bf-b23e-304d8ea03c15" },
      { name: "D4RK RM7EG", id: "019e4052-c316-73aa-81f6-483e50247e61" },
      { name: "B43274N", id: "019e4052-c316-73aa-81f6-60ec61b61f0a" }
    ],
    "URM7-S5L2": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "RM7-S4L2", id: "019e4052-c316-73aa-81f6-38c323c58eb2" },
      { name: "RM7-S4L3", id: "019e4052-c316-73aa-81f6-3dcef4d6873e" },
      { name: "URM7-S5L2", id: "019e4052-c317-7388-9d71-85b98a02d5fb" }
    ],
    "URM7-M": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "RM7-S4L2", id: "019e4052-c316-73aa-81f6-38c323c58eb2" },
      { name: "RM7-S4L3", id: "019e4052-c316-73aa-81f6-3dcef4d6873e" },
      { name: "URM7-S5L2", id: "019e4052-c317-7388-9d71-85b98a02d5fb" },
      { name: "URM7-M", id: "019e4052-c317-7388-9d71-883ffb1560cd" }
    ],
    "URM7-H": [
      { name: "RM7-E1L5", id: "019d1b0a-13a9-77dd-b41f-374ee144bd07" },
      { name: "RM7-E1SCP", id: "019d1b0a-13a9-77dd-b41f-3a21d490cb2d" },
      { name: "RM7-S4L4", id: "019d1b0a-13a9-77dd-b41f-3ffb5f671742" },
      { name: "RM7-S4L1", id: "019e4052-c315-71df-80da-4e334b96c9e6" },
      { name: "URM7-H", id: "019e4052-c317-7388-9d71-8fed6faaaf99" }
    ],
    "SRM7-M": [
      { name: "RM7-E1L3", id: "019d1b0a-13a9-77dd-b41f-33f06f2df284" },
      { name: "RM7-N2ECP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a105" },
      { name: "RM7-N2L2", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a101" },
      { name: "RM7-N2L3", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a102" },
      { name: "RM7-W3NCP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a106" },
      { name: "RM7-N1L1", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a104" },
      { name: "RM7-N3L1", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a107" },
      { name: "SRM7-M", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a108" }
    ],
    "SRM7-N3L2": [
      { name: "RM7-E1L3", id: "019d1b0a-13a9-77dd-b41f-33f06f2df284" },
      { name: "RM7-N2ECP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a105" },
      { name: "RM7-N2L2", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a101" },
      { name: "RM7-N2L3", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a102" },
      { name: "RM7-W3NCP", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a106" },
      { name: "RM7-N1L1", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a104" },
      { name: "RM7-N3L1", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a107" },
      { name: "SRM7-M", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a108" },
      { name: "SRM7-N3L2", id: "019da6f1-16f7-75a6-b6d3-0b1d5f92a109" }
    ]
  };

  // src/auto-valuable-seller/state.js
  var running = false;
  var mode = null;
  function setRunning(v) {
    running = v;
  }
  function setMode(v) {
    mode = v;
  }
  function isAborted() {
    return !running;
  }
  var _cachedMapData = null;
  var _lastServersData = null;
  var _fileAnalysisCache = {};
  var _loginStatusCache = {};
  var LOGIN_STATUS_CACHE_TTL = 3e3;
  var _desktopToServerMap = {};
  function setCachedMapData(v) {
    _cachedMapData = v;
  }
  function setLastServersData(v) {
    _lastServersData = v;
  }
  function clearDesktopToServerMap() {
    _desktopToServerMap = {};
  }
  var _cachedLoadout = null;
  var _cachedLoadoutAt = 0;
  var LOADOUT_COOLDOWN_MS = 2e3;
  var _lastLoadoutFetchAt = 0;
  function setCachedLoadout(v) {
    _cachedLoadout = v;
    _cachedLoadoutAt = v ? Date.now() : 0;
  }
  function setLastLoadoutFetchAt(v) {
    _lastLoadoutFetchAt = v;
  }
  function invalidateLoadoutCache() {
    _cachedLoadout = null;
    _cachedLoadoutAt = 0;
  }
  var _forceMaintenanceRunning = false;
  function setForceMaintenanceRunning(v) {
    _forceMaintenanceRunning = v;
  }
  var sendCmd = createSendCmd("COR3_AUTOJOB_CMD");
  var delay = createDelay(isAborted);
  var waitForEvent = createWaitForEvent(isAborted);
  var log = createLogger("[COR3 ValuableSeller]", "COR3_VALUABLE_LOG");
  var waitForHackToBeDone = createWaitForHackToBeDone(log, isAborted);
  function ensureSolversEnabled() {
    ensureDecryptSolverEnabled();
    ensureIceWallSolverEnabled();
    ensureSimpleDecryptSolverEnabled();
  }
  var MARKET_SELL_ORDER2 = MARKET_SELL_ORDER;
  var SERVER_PATH_MAP = FALLBACK_PATH_MAP;
  var ALL_SERVERS = {};
  for (sName in SERVER_PATH_MAP) {
    path = SERVER_PATH_MAP[sName];
    last = path[path.length - 1];
    ALL_SERVERS[last.id] = sName;
  }
  var path;
  var last;
  var sName;
  function getServerName(serverId) {
    if (ALL_SERVERS[serverId]) return ALL_SERVERS[serverId];
    var map = window.__cor3ServerTypeMap;
    if (map && map[serverId] && map[serverId].serverName) return map[serverId].serverName;
    return serverId.substring(0, 8);
  }
  function getServerPathLength(serverId) {
    for (var sName in SERVER_PATH_MAP) {
      var p = SERVER_PATH_MAP[sName];
      var last = p[p.length - 1];
      if (last.id === serverId) return p.length;
    }
    return 0;
  }
  function signalDone() {
    running = false;
    mode = null;
    window.postMessage({ type: "COR3_VALUABLE_DONE" }, "*");
  }
  function updateServersUI(serversData) {
    window.postMessage({ type: "COR3_VALUABLE_SERVERS_UPDATE", data: serversData }, "*");
  }
  function updateDownloadsUI(downloadsData) {
    window.postMessage({ type: "COR3_VALUABLE_DOWNLOADS_UPDATE", data: downloadsData }, "*");
  }
  function updateMaintenanceUI(maintData) {
    window.postMessage({ type: "COR3_VALUABLE_MAINTENANCE_UPDATE", data: maintData }, "*");
  }

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
  function findSearchSoftwareForServerType(allSoftware, serverTypeName) {
    var candidates = [];
    for (var i = 0; i < allSoftware.length; i++) {
      var specs = normSpecs(allSoftware[i]);
      for (var j = 0; j < specs.length; j++) {
        if (specs[j].type === "SEARCH" && specs[j].serverTypes && specs[j].serverTypes.indexOf(serverTypeName) >= 0) {
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

  // src/auto-valuable-seller/loadout.js
  async function getLoadoutData(forceRefresh) {
    if (!forceRefresh && _cachedLoadout && Date.now() - _cachedLoadoutAt < 6e4) {
      return _cachedLoadout;
    }
    var sinceLastFetch = Date.now() - _lastLoadoutFetchAt;
    if (sinceLastFetch < LOADOUT_COOLDOWN_MS && _cachedLoadout) {
      return _cachedLoadout;
    }
    log("Loadout: requesting fresh data via WS...");
    setLastLoadoutFetchAt(Date.now());
    sendCmd("loadout.get", {});
    try {
      var resp = await waitForEvent("COR3_AUTOJOB_LOADOUT", 15e3);
      if (resp.data) {
        setCachedLoadout(resp.data);
        return resp.data;
      }
    } catch (e) {
      log("Loadout: fetch timeout", "warn");
    }
    return _cachedLoadout || null;
  }
  async function applyLoadoutChange(loadout, targetHw, targetSwIds) {
    log("Loadout: applying change \u2014 target sw count: " + targetSwIds.length);
    var currentHw = loadout.equippedHardware || {};
    var currentSwIds = (loadout.equippedSoftware || []).map(function(s) {
      return s.id;
    });
    var changed = false;
    for (var ui = 0; ui < currentSwIds.length; ui++) {
      if (targetSwIds.indexOf(currentSwIds[ui]) >= 0) continue;
      var unequipName = currentSwIds[ui];
      var eqSw = loadout.equippedSoftware || [];
      for (var un = 0; un < eqSw.length; un++) {
        if (eqSw[un].id === currentSwIds[ui]) {
          unequipName = eqSw[un].name + " (" + currentSwIds[ui] + ")";
          break;
        }
      }
      log("Loadout: unequipping software " + unequipName);
      sendCmd("loadout.unequip.software", { moduleConfigId: currentSwIds[ui] });
      await waitForEvent("COR3_AUTOJOB_LOADOUT", 8e3);
      await delay(500);
      changed = true;
    }
    var hwChanges = [];
    var hwSlots = ["cpu", "gpu", "ram", "psu"];
    for (var hci = 0; hci < hwSlots.length; hci++) {
      var hSlot = hwSlots[hci];
      var hCurId = currentHw[hSlot] ? currentHw[hSlot].id : null;
      var hTgtId = targetHw[hSlot] ? targetHw[hSlot].id : null;
      if (hTgtId && hTgtId !== hCurId) {
        var curConsume = 0, tgtConsume = 0;
        if (hSlot === "cpu") {
          curConsume = currentHw.cpu ? currentHw.cpu.specs.cpuConsuming || 0 : 0;
          tgtConsume = targetHw.cpu.specs.cpuConsuming || 0;
        }
        if (hSlot === "gpu") {
          curConsume = currentHw.gpu ? currentHw.gpu.specs.gpuConsuming || 0 : 0;
          tgtConsume = targetHw.gpu.specs.gpuConsuming || 0;
        }
        hwChanges.push({ slot: hSlot, id: hTgtId, name: targetHw[hSlot].name || hTgtId, delta: tgtConsume - curConsume, isPsu: hSlot === "psu" });
      }
    }
    var psuUpgrade = hwChanges.find(function(c) {
      return c.isPsu && targetHw.psu && currentHw.psu && (targetHw.psu.specs.psuPower || 0) > (currentHw.psu.specs.psuPower || 0);
    });
    var orderedHwChanges = [];
    if (psuUpgrade) orderedHwChanges.push(psuUpgrade);
    hwChanges.sort(function(a, b) {
      return a.delta - b.delta;
    });
    for (var hoi = 0; hoi < hwChanges.length; hoi++) {
      if (hwChanges[hoi] !== psuUpgrade) orderedHwChanges.push(hwChanges[hoi]);
    }
    for (var hi = 0; hi < orderedHwChanges.length; hi++) {
      var hc = orderedHwChanges[hi];
      log("Loadout: equipping " + hc.slot.toUpperCase() + " \u2192 " + hc.name);
      sendCmd("loadout.equip.hardware", { moduleConfigId: hc.id });
      await waitForEvent("COR3_AUTOJOB_LOADOUT", 8e3);
      await delay(500);
      changed = true;
    }
    for (var ei = 0; ei < targetSwIds.length; ei++) {
      var swName = "";
      var allSw = loadout.ownedSoftware || [];
      for (var k = 0; k < allSw.length; k++) {
        if (allSw[k].id === targetSwIds[ei]) {
          swName = allSw[k].name;
          break;
        }
      }
      log("Loadout: equipping software " + swName + " (" + targetSwIds[ei] + ")");
      sendCmd("loadout.equip.software", { moduleConfigId: targetSwIds[ei] });
      await waitForEvent("COR3_AUTOJOB_LOADOUT", 8e3);
      await delay(500);
      changed = true;
    }
    if (changed) {
      return await getLoadoutData(true);
    }
    return loadout;
  }
  async function ensureHackOnlyLoadout(serverId, getLoginStatusFn) {
    var serverTypeName = getServerTypeName(serverId);
    if (!serverTypeName) {
      log("Loadout: cannot determine server type for " + getServerName(serverId) + " \u2014 skipping hack loadout");
      return { ok: false, reason: "unknown-server-type" };
    }
    var serverDefenceRate = 0;
    try {
      var preLoginData = await getLoginStatusFn(serverId);
      if (preLoginData && preLoginData.serverDefenceRate) {
        serverDefenceRate = preLoginData.serverDefenceRate;
      }
    } catch (e) {
    }
    invalidateLoadoutCache();
    var loadout = await getLoadoutData(true);
    if (!loadout) {
      log("Loadout: could not fetch loadout data \u2014 proceeding without hack loadout", "warn");
      return { ok: false, reason: "no-loadout-data" };
    }
    var allSw = loadout.ownedSoftware || [];
    var equippedSwIds = (loadout.equippedSoftware || []).map(function(s) {
      return s.id;
    });
    var hackCandidates = findHackSoftwareForServerType(allSw, serverTypeName);
    log("Loadout: found " + hackCandidates.length + " hack candidate(s) for " + serverTypeName + (hackCandidates.length > 0 ? " \u2014 best: " + hackCandidates[0].sw.name + " (power " + (hackCandidates[0].spec.power || []).join("-") + ")" : ""));
    if (hackCandidates.length === 0) {
      log("Loadout: no HACK software available for " + serverTypeName, "warn");
      return { ok: false, reason: "no-hack-software" };
    }
    var bestHack = hackCandidates[0];
    var targetSwIds = [bestHack.sw.id];
    var currentHw = loadout.equippedHardware || {};
    var analysis = calculateAnalysis(loadout, targetSwIds);
    var targetHw = currentHw;
    var alreadyBest = equippedSwIds.length === 1 && equippedSwIds[0] === bestHack.sw.id;
    if (alreadyBest) {
      log('Loadout: best HACK software "' + bestHack.sw.name + '" already equipped alone');
    }
    if (!analysis.canBoot) {
      log("Loadout: current hardware cannot boot hack software \u2014 finding compatible hardware");
      var betterHw = findBestHardware(loadout, targetSwIds);
      if (betterHw) {
        targetHw = betterHw;
      } else {
        log("Loadout: cannot boot hack software \u2014 skipping loadout change", "warn");
        return { ok: false, reason: "cannot-boot" };
      }
    }
    var checkLoadout = JSON.parse(JSON.stringify(loadout));
    checkLoadout.equippedHardware = targetHw;
    var checkAnalysis = calculateAnalysis(checkLoadout, targetSwIds);
    var computedHackPower = 0;
    var hackSa = checkAnalysis.swAnalysis[bestHack.sw.id];
    if (hackSa) {
      for (var ai = 0; ai < hackSa.abilities.length; ai++) {
        if (hackSa.abilities[ai].type === "HACK") {
          computedHackPower = hackSa.abilities[ai].computedPower;
          break;
        }
      }
    }
    if (serverDefenceRate > 0) {
      log("Loadout: hack power comparison \u2014 hackPower: " + computedHackPower + " vs serverDefenceRate: " + serverDefenceRate + (computedHackPower >= serverDefenceRate ? " \u2713" : " \u2717 INSUFFICIENT"));
    } else {
      log("Loadout: computed hack power: " + computedHackPower + " (serverDefenceRate unknown)");
    }
    if (serverDefenceRate > 0 && computedHackPower < serverDefenceRate) {
      log("Loadout: hack power insufficient \u2014 trying hardware upgrade to boost power");
      var hwUpgrade = findBestHardware(loadout, targetSwIds);
      if (hwUpgrade) {
        var upgradeLoadout = JSON.parse(JSON.stringify(loadout));
        upgradeLoadout.equippedHardware = hwUpgrade;
        var upgradeAnalysis = calculateAnalysis(upgradeLoadout, targetSwIds);
        var upgradedPower = 0;
        var upgradeSa = upgradeAnalysis.swAnalysis[bestHack.sw.id];
        if (upgradeSa) {
          for (var uai = 0; uai < upgradeSa.abilities.length; uai++) {
            if (upgradeSa.abilities[uai].type === "HACK") {
              upgradedPower = upgradeSa.abilities[uai].computedPower;
              break;
            }
          }
        }
        if (upgradedPower > computedHackPower) {
          targetHw = hwUpgrade;
          computedHackPower = upgradedPower;
          log("Loadout: hardware upgrade found \u2014 hack power: " + upgradedPower + " vs serverDefenceRate: " + serverDefenceRate + (upgradedPower >= serverDefenceRate ? " \u2713" : " \u2717 still insufficient"));
          if (upgradedPower < serverDefenceRate) {
            log("Loadout: cannot reach required hack power (" + serverDefenceRate + ") \u2014 best achievable: " + upgradedPower, "error");
            return { ok: false, reason: "insufficient-power", hackPower: upgradedPower, defenceRate: serverDefenceRate };
          }
        } else {
          log("Loadout: no better hardware available \u2014 best hack power: " + computedHackPower, "warn");
          return { ok: false, reason: "insufficient-power", hackPower: computedHackPower, defenceRate: serverDefenceRate };
        }
      } else {
        log("Loadout: no hardware upgrade available", "warn");
        return { ok: false, reason: "insufficient-power", hackPower: computedHackPower, defenceRate: serverDefenceRate };
      }
    }
    if (!alreadyBest || targetHw !== currentHw) {
      log('Loadout: equipping HACK software "' + bestHack.sw.name + '" (power ' + (bestHack.spec.power || []).join("-") + ") for " + serverTypeName);
      await applyLoadoutChange(loadout, targetHw, targetSwIds);
    }
    return { ok: true, hackPower: computedHackPower, defenceRate: serverDefenceRate };
  }
  async function ensureSearchOnlyLoadout(serverId) {
    var serverTypeName = getServerTypeName(serverId);
    if (!serverTypeName) {
      log("Loadout: cannot determine server type for " + getServerName(serverId) + " \u2014 skipping search loadout");
      return;
    }
    invalidateLoadoutCache();
    var loadout = await getLoadoutData(true);
    if (!loadout) {
      log("Loadout: could not fetch loadout data \u2014 proceeding without search loadout", "warn");
      return;
    }
    var allSw = loadout.ownedSoftware || [];
    var equippedSwIds = (loadout.equippedSoftware || []).map(function(s) {
      return s.id;
    });
    var searchCandidates = findSearchSoftwareForServerType(allSw, serverTypeName);
    if (searchCandidates.length === 0) {
      log("Loadout: no SEARCH software available for " + serverTypeName);
      return;
    }
    var bestSearch = searchCandidates[0];
    var targetSwIds = [bestSearch.sw.id];
    var bestHw = findBestHardware(loadout, targetSwIds);
    var targetHw = bestHw || loadout.equippedHardware || {};
    var finalAnalysis = calculateAnalysis(
      Object.assign({}, loadout, { equippedHardware: targetHw }),
      targetSwIds
    );
    if (!finalAnalysis.canBoot) {
      log("Loadout: cannot boot search software \u2014 skipping loadout change", "warn");
      return;
    }
    var searchPower = 0;
    for (var swId in finalAnalysis.swAnalysis) {
      var ab = finalAnalysis.swAnalysis[swId].abilities;
      for (var ai = 0; ai < ab.length; ai++) {
        if (ab[ai].type === "SEARCH") searchPower = ab[ai].computedPower;
      }
    }
    var swAlreadyOk = equippedSwIds.length === 1 && equippedSwIds[0] === bestSearch.sw.id;
    var curHw = loadout.equippedHardware || {};
    var hwAlreadyOk = !bestHw || (curHw.cpu && curHw.cpu.id) === (targetHw.cpu && targetHw.cpu.id) && (curHw.gpu && curHw.gpu.id) === (targetHw.gpu && targetHw.gpu.id) && (curHw.ram && curHw.ram.id) === (targetHw.ram && targetHw.ram.id) && (curHw.psu && curHw.psu.id) === (targetHw.psu && targetHw.psu.id);
    if (swAlreadyOk && hwAlreadyOk) {
      log('Loadout: best SEARCH software "' + bestSearch.sw.name + '" already equipped with optimal hardware (power: ' + searchPower + "/" + bestSearch.spec.power[1] + ")");
      return searchPower;
    }
    log('Loadout: equipping SEARCH software "' + bestSearch.sw.name + '" (computed power: ' + searchPower + "/" + bestSearch.spec.power[1] + ") for " + serverTypeName);
    await applyLoadoutChange(loadout, targetHw, targetSwIds);
    return searchPower;
  }
  async function tryHackLoadoutSwap(serverId, getLoginStatusFn) {
    invalidateLoadoutCache();
    var loadout = await getLoadoutData(true);
    if (!loadout) {
      log("Loadout: cannot retry \u2014 no loadout data available", "warn");
      return false;
    }
    var serverTypeName = getServerTypeName(serverId);
    if (!serverTypeName) {
      log("Loadout: cannot determine server type for " + getServerName(serverId), "warn");
      return false;
    }
    var allSw = loadout.ownedSoftware || [];
    var equippedSwIds = (loadout.equippedSoftware || []).map(function(s) {
      return s.id;
    });
    var hackCandidates = findHackSoftwareForServerType(allSw, serverTypeName);
    if (hackCandidates.length === 0) {
      log("Loadout: no hack software available for " + serverTypeName, "warn");
      return false;
    }
    var bestHack = hackCandidates[0];
    var targetSwIds = [bestHack.sw.id];
    var serverDefenceRate = 0;
    try {
      var loginStatus = await getLoginStatusFn(serverId, true);
      if (loginStatus && loginStatus.serverDefenceRate) {
        serverDefenceRate = loginStatus.serverDefenceRate;
      }
    } catch (e) {
    }
    if (equippedSwIds.length === 1 && equippedSwIds[0] === bestHack.sw.id) {
      log('Loadout: best hack software "' + bestHack.sw.name + '" already equipped alone \u2014 trying hardware upgrade');
      var currentAnalysis = calculateAnalysis(loadout, targetSwIds);
      var currentHackPower = 0;
      var curSa = currentAnalysis.swAnalysis[bestHack.sw.id];
      if (curSa) {
        for (var chi = 0; chi < curSa.abilities.length; chi++) {
          if (curSa.abilities[chi].type === "HACK") {
            currentHackPower = curSa.abilities[chi].computedPower;
            break;
          }
        }
      }
      if (serverDefenceRate > 0) {
        log("Loadout: current hack power: " + currentHackPower + " vs serverDefenceRate: " + serverDefenceRate);
      }
      var betterHw = findBestHardware(loadout, targetSwIds);
      if (!betterHw) {
        log("Loadout: no hardware upgrade available \u2014 cannot improve hack power" + (serverDefenceRate > 0 ? " (need " + serverDefenceRate + ", have " + currentHackPower + ")" : ""), "error");
        return false;
      }
      var testLoadout = JSON.parse(JSON.stringify(loadout));
      testLoadout.equippedHardware = betterHw;
      var hwAnalysis = calculateAnalysis(testLoadout, targetSwIds);
      if (!hwAnalysis.canBoot) {
        log("Loadout: cannot boot with better hardware \u2014 giving up", "error");
        return false;
      }
      var upgradedHackPower = 0;
      var hwSa = hwAnalysis.swAnalysis[bestHack.sw.id];
      if (hwSa) {
        for (var uhi = 0; uhi < hwSa.abilities.length; uhi++) {
          if (hwSa.abilities[uhi].type === "HACK") {
            upgradedHackPower = hwSa.abilities[uhi].computedPower;
            break;
          }
        }
      }
      log("Loadout: with hardware upgrade, hack power: " + upgradedHackPower + (serverDefenceRate > 0 ? " vs serverDefenceRate: " + serverDefenceRate : ""));
      if (upgradedHackPower <= currentHackPower) {
        log("Loadout: hardware upgrade does not improve hack power \u2014 giving up", "error");
        return false;
      }
      if (serverDefenceRate > 0 && upgradedHackPower < serverDefenceRate) {
        log("Loadout: hardware upgrade still insufficient \u2014 need " + serverDefenceRate + ", best achievable: " + upgradedHackPower, "error");
        return false;
      }
      log("Loadout: swapping hardware to boost hack power for " + serverTypeName);
      await applyLoadoutChange(loadout, betterHw, targetSwIds);
      return true;
    }
    var currentHw = loadout.equippedHardware || {};
    var analysis = calculateAnalysis(loadout, targetSwIds);
    var targetHw = currentHw;
    if (!analysis.canBoot) {
      var betterHw2 = findBestHardware(loadout, targetSwIds);
      if (betterHw2) {
        targetHw = betterHw2;
      } else {
        log("Loadout: cannot boot hack-only software \u2014 giving up", "warn");
        return false;
      }
    }
    var preCheckLoadout = JSON.parse(JSON.stringify(loadout));
    preCheckLoadout.equippedHardware = targetHw;
    var preCheck = calculateAnalysis(preCheckLoadout, targetSwIds);
    var projectedPower = 0;
    var preSa = preCheck.swAnalysis[bestHack.sw.id];
    if (preSa) {
      for (var phi = 0; phi < preSa.abilities.length; phi++) {
        if (preSa.abilities[phi].type === "HACK") {
          projectedPower = preSa.abilities[phi].computedPower;
          break;
        }
      }
    }
    log("Loadout: projected hack power with new loadout: " + projectedPower + (serverDefenceRate > 0 ? " vs serverDefenceRate: " + serverDefenceRate : ""));
    if (serverDefenceRate > 0 && projectedPower < serverDefenceRate) {
      var hwRetry = findBestHardware(loadout, targetSwIds);
      if (hwRetry) {
        var testLoadout2 = JSON.parse(JSON.stringify(loadout));
        testLoadout2.equippedHardware = hwRetry;
        var hwCheck = calculateAnalysis(testLoadout2, targetSwIds);
        var retryPower = 0;
        var retrySa = hwCheck.swAnalysis[bestHack.sw.id];
        if (retrySa) {
          for (var rhi = 0; rhi < retrySa.abilities.length; rhi++) {
            if (retrySa.abilities[rhi].type === "HACK") {
              retryPower = retrySa.abilities[rhi].computedPower;
              break;
            }
          }
        }
        if (retryPower >= serverDefenceRate) {
          targetHw = hwRetry;
          log("Loadout: found better hardware \u2014 hack power: " + retryPower);
        } else {
          log("Loadout: best achievable hack power: " + retryPower + " \u2014 still below serverDefenceRate (" + serverDefenceRate + ")", "error");
          return false;
        }
      } else {
        log("Loadout: no hardware upgrade available \u2014 cannot reach serverDefenceRate (" + serverDefenceRate + ")", "error");
        return false;
      }
    }
    log('Loadout: equipping HACK-only "' + bestHack.sw.name + '" for retry');
    await applyLoadoutChange(loadout, targetHw, targetSwIds);
    return true;
  }

  // src/auto-valuable-seller/server-access.js
  async function checkPathMaintenance(serverName) {
    var path = SERVER_PATH_MAP[serverName];
    if (!path || path.length === 0) return { blocked: false };
    var mapData = _cachedMapData;
    if (!mapData) {
      sendCmd("get.map", {});
      try {
        mapData = await waitForEvent("COR3_WS_NETWORK_MAP", 1e4);
        setCachedMapData(mapData);
      } catch (e) {
        log("\u26A0\uFE0F Could not fetch network map: " + e.message, "warn");
        return { blocked: false };
      }
    }
    if (mapData && mapData.servers) {
      for (var i = 0; i < path.length; i++) {
        var srv = path[i];
        var info = mapData.servers[srv.id];
        if (info && info.isInMaintenance) {
          var remaining = info.maintenanceEndsAt ? new Date(info.maintenanceEndsAt).getTime() - Date.now() : 0;
          if (remaining > 0) {
            return { blocked: true, blockerName: srv.name, remainingMs: remaining };
          }
        }
      }
    }
    return { blocked: false };
  }
  async function _sendSetEndpoint(serverId) {
    sendCmd("set.endpoint", { serverId });
    return await new Promise(function(resolve) {
      var timer;
      function endpointHandler(evt) {
        if (evt.data && evt.data.type === "COR3_WS_ENDPOINT_RESULT") {
          cleanup();
          if (evt.data.success === false && evt.data.error && (evt.data.error.message === "no-path-to-server" || evt.data.error.message === "server-in-maintenance")) {
            resolve({ ok: false, unreachable: true, errorMsg: evt.data.error.message });
          } else {
            resolve({ ok: true, data: evt.data });
          }
        }
        if (evt.data && (evt.data.type === "COR3_WS_DARK_MARKET_UNREACHABLE" || evt.data.type === "COR3_WS_SOYUZ_MARKET_UNREACHABLE" || evt.data.type === "COR3_WS_USOL_MARKET_UNREACHABLE")) {
          cleanup();
          resolve({ ok: false, unreachable: true });
        }
      }
      function cleanup() {
        window.removeEventListener("message", endpointHandler);
        clearTimeout(timer);
      }
      window.addEventListener("message", endpointHandler);
      timer = setTimeout(function() {
        window.removeEventListener("message", endpointHandler);
        resolve({ ok: true, timeout: true });
      }, 1e4);
    });
  }
  function getPathForServerName(serverName) {
    var path = SERVER_PATH_MAP[serverName];
    if (path && path.length > 0) return path;
    return null;
  }
  async function setEndpoint(serverId) {
    var name = getServerName(serverId);
    log("Setting endpoint to " + name);
    var raceResult = await _sendSetEndpoint(serverId);
    if (raceResult.unreachable) {
      if (raceResult.errorMsg === "server-in-maintenance") {
        log(name + " is in maintenance \u2014 skipping", "error");
        return false;
      }
      var path = getPathForServerName(name);
      if (!path || path.length <= 1) {
        var noPathCheck = await checkPathMaintenance(name);
        if (noPathCheck.blocked) {
          var nMins = Math.ceil(noPathCheck.remainingMs / 6e4);
          log(name + " unreachable (" + noPathCheck.blockerName + " in maintenance, ~" + nMins + "m remaining)", "error");
          return false;
        }
        log(name + " unreachable (no path to server)", "error");
        return false;
      }
      log("\u26A1 Server unreachable \u2014 attempting path-through hack (" + path.length + " servers on path)");
      for (var pi = 0; pi < path.length - 1; pi++) {
        var intermediate = path[pi];
        log("\u26A1 Path-through: setting endpoint to " + intermediate.name + " (" + (pi + 1) + "/" + (path.length - 1) + ")");
        var intResult = await _sendSetEndpoint(intermediate.id);
        if (intResult.unreachable) {
          var intCheck = await checkPathMaintenance(intermediate.name);
          var intMsg = intermediate.name + " unreachable";
          if (intCheck.blocked) {
            var iMins = Math.ceil(intCheck.remainingMs / 6e4);
            intMsg += " (" + intCheck.blockerName + " in maintenance, ~" + iMins + "m remaining)";
          }
          log("\u26A1 Path-through: " + intMsg, "warn");
          return false;
        }
        await delay(humanDelay());
        if (!await loginOrHack(intermediate.id)) {
          log("\u26A1 Path-through: login/hack failed on " + intermediate.name, "warn");
          return false;
        }
        await delay(humanDelay());
      }
      log("\u26A1 Path-through complete \u2014 retrying endpoint to target server");
      raceResult = await _sendSetEndpoint(serverId);
      if (raceResult.unreachable) {
        if (raceResult.errorMsg === "server-in-maintenance") {
          log(name + " is in maintenance \u2014 aborting path-through", "error");
          return false;
        }
        var finalCheck = await checkPathMaintenance(name);
        if (finalCheck.blocked) {
          var fMins = Math.ceil(finalCheck.remainingMs / 6e4);
          log(name + " still unreachable after path-through (" + finalCheck.blockerName + " in maintenance, ~" + fMins + "m remaining)", "error");
        } else {
          log(name + " still unreachable after path-through hack", "error");
        }
        return false;
      }
    }
    if (raceResult.timeout) {
      log("Endpoint set timeout (may already be set)", "warn");
    }
    await delay(humanDelay());
    return true;
  }
  async function getLoginStatus(serverId, forceRefresh) {
    if (!forceRefresh) {
      var cached = _loginStatusCache[serverId];
      if (cached && Date.now() - cached.ts < LOGIN_STATUS_CACHE_TTL) {
        return cached.data;
      }
    }
    sendCmd("get.login.status", { serverId });
    try {
      var resp = await waitForEvent("COR3_AUTOJOB_SAI_LOGIN_STATUS", 1e4);
      if (resp.error) return null;
      var data = resp.data || null;
      _loginStatusCache[serverId] = { data, ts: Date.now() };
      return data;
    } catch (e) {
      return null;
    }
  }
  async function _attemptHack(serverId, name) {
    log("Starting hack on " + name);
    ensureSolversEnabled();
    await delay(300);
    sendCmd("hack.start", { serverId });
    var hackResult;
    try {
      hackResult = await new Promise(function(resolve, reject) {
        var done = false;
        var timer = setTimeout(function() {
          if (!done) {
            done = true;
            window.removeEventListener("message", onMsg);
            reject(new Error("Timeout"));
          }
        }, 3e4);
        function onMsg(evt) {
          if (!evt.data) return;
          if (evt.data.type === "COR3_AUTOJOB_SAI_HACK_START") {
            if (!done) {
              done = true;
              clearTimeout(timer);
              window.removeEventListener("message", onMsg);
              resolve(evt.data);
            }
          } else if (evt.data.type === "COR3_AUTOJOB_MINIGAME_START") {
            if (!done) {
              done = true;
              clearTimeout(timer);
              window.removeEventListener("message", onMsg);
              resolve({ data: { minigameStarted: true }, error: null });
            }
          }
        }
        window.addEventListener("message", onMsg);
      });
    } catch (e) {
      log("Hack start event timed out \u2014 checking if hack already completed...", "warn");
      var fallbackLogin = await getLoginStatus(serverId, true);
      if (fallbackLogin && fallbackLogin.activeAccesses && fallbackLogin.activeAccesses.length > 0) {
        var fbAccess = fallbackLogin.activeAccesses[0];
        log("Hack already completed (found " + (fbAccess.accessType || fbAccess.type || "unknown") + " access after timeout) \u2014 logging in", "success");
        sendCmd("login.with-access", { serverId, accessGrantId: fbAccess.id });
        try {
          await waitForEvent("COR3_AUTOJOB_SAI_LOGIN_RESULT", 1e4);
        } catch (e2) {
        }
        await delay(humanDelay());
        return true;
      }
      log(name + ": hack start timed out", "error");
      return false;
    }
    if (hackResult.error) {
      var errMsg = hackResult.error.message || JSON.stringify(hackResult.error);
      log("Hack returned error: " + errMsg + " \u2014 checking access...", "warn");
      var errLogin = await getLoginStatus(serverId, true);
      if (errLogin && errLogin.activeAccesses && errLogin.activeAccesses.length > 0) {
        var errAccess = errLogin.activeAccesses[0];
        log("Already have " + (errAccess.accessType || errAccess.type || "unknown") + " access despite hack error \u2014 logging in", "success");
        sendCmd("login.with-access", { serverId, accessGrantId: errAccess.id });
        try {
          await waitForEvent("COR3_AUTOJOB_SAI_LOGIN_RESULT", 1e4);
        } catch (e2) {
        }
        await delay(humanDelay());
        return true;
      }
      if (errMsg.indexOf("sai-hack-impossible") >= 0 || errMsg.indexOf("sai-no-hack-software") >= 0) {
        return "retry-loadout";
      }
      log(name + ": hack failed: " + errMsg, "error");
      return false;
    }
    if (hackResult.data && hackResult.data.autoHacked) {
      log("Server auto-hacked (no minigame) \u2014 skipping solver wait", "success");
    } else if (hackResult.data && hackResult.data.minigameStarted) {
      log("Hack minigame detected via minigame event");
      await waitForHackToBeDone();
    } else {
      await waitForHackToBeDone();
    }
    await delay(humanDelay());
    var maxRetries = 3;
    for (var attempt = 0; attempt < maxRetries; attempt++) {
      var postHackLogin = await getLoginStatus(serverId, true);
      if (postHackLogin && postHackLogin.activeAccesses && postHackLogin.activeAccesses.length > 0) {
        var postHackAccess = postHackLogin.activeAccesses[0];
        var postHackType = postHackAccess.accessType || postHackAccess.type || "unknown";
        sendCmd("login.with-access", { serverId, accessGrantId: postHackAccess.id });
        try {
          await waitForEvent("COR3_AUTOJOB_SAI_LOGIN_RESULT", 1e4);
        } catch (e) {
        }
        log("Logged in to " + name + " (" + postHackType + ")", "success");
        return true;
      } else {
        log("No active access after hack (attempt " + (attempt + 1) + "/" + maxRetries + "), retrying...", "warn");
        await delay(5e3);
      }
    }
    log(name + ": no active access after hack (" + maxRetries + " attempts) \u2014 hack may have failed", "error");
    return false;
  }
  async function loginOrHack(serverId) {
    var name = getServerName(serverId);
    log("Checking login status for " + name);
    var loginData = await getLoginStatus(serverId);
    if (loginData && loginData.activeAccesses && loginData.activeAccesses.length > 0) {
      var accessObj = loginData.activeAccesses[0];
      var accessId = accessObj.id;
      var accessType = accessObj.accessType || accessObj.type || "unknown";
      log("Using existing access on " + name + " (" + accessType + ")");
      sendCmd("login.with-access", { serverId, accessGrantId: accessId });
      try {
        var loginResult = await waitForEvent("COR3_AUTOJOB_SAI_LOGIN_RESULT", 1e4);
        if (loginResult.error || !(loginResult.data && loginResult.data.success)) {
          log(name + ": login with access failed", "warn");
          return false;
        }
      } catch (e) {
        log(name + ": login with access timed out", "warn");
        return false;
      }
      log("Logged in via existing access to " + name, "success");
      return true;
    }
    var loginDefenceRate = loginData && loginData.serverDefenceRate ? loginData.serverDefenceRate : 0;
    var loginHackPower = 0;
    if (loginData && loginData.hackTools && loginData.hackTools.length > 0) {
      loginHackPower = loginData.hackTools[0].hackPower || 0;
      log("Hack info \u2014 serverDefenceRate: " + loginDefenceRate + ", equipped hackPower: " + loginHackPower + " (" + (loginData.hackTools[0].name || "unknown") + ")" + (loginDefenceRate > 0 ? loginHackPower >= loginDefenceRate ? " \u2713" : " \u2717 INSUFFICIENT" : ""));
    } else if (loginDefenceRate > 0) {
      log("Hack info \u2014 serverDefenceRate: " + loginDefenceRate + ", no hack tools equipped", "warn");
    }
    log("No active access to " + name + " \u2014 equipping hack loadout");
    var loadoutResult = await ensureHackOnlyLoadout(serverId, getLoginStatus);
    if (loadoutResult && !loadoutResult.ok && loadoutResult.reason === "insufficient-power") {
      log(name + ": skipping (hack power " + loadoutResult.hackPower + " < serverDefenceRate " + loadoutResult.defenceRate + ")", "error");
      return false;
    }
    await delay(humanDelay());
    var MAX_HACK_ATTEMPTS = 6;
    for (var hackAttempt = 1; hackAttempt <= MAX_HACK_ATTEMPTS; hackAttempt++) {
      if (!running) {
        return false;
      }
      if (hackAttempt > 1) {
        log("Hack attempt " + hackAttempt + "/" + MAX_HACK_ATTEMPTS + " on " + name, "warn");
      }
      var hackAttemptResult = await _attemptHack(serverId, name);
      if (hackAttemptResult === true) return true;
      if (hackAttemptResult === "retry-loadout") {
        log(name + ": hack failed with sai-hack-impossible \u2014 trying loadout swap and retry");
        var swapResult = await tryHackLoadoutSwap(serverId, getLoginStatus);
        if (!swapResult) {
          log(name + ": loadout swap failed \u2014 skipping (no access)", "error");
          return false;
        }
        await delay(humanDelay());
        continue;
      }
      if (hackAttempt < MAX_HACK_ATTEMPTS) {
        log(name + ": hack failed \u2014 will retry (" + hackAttempt + "/" + MAX_HACK_ATTEMPTS + ")", "warn");
        await delay(2e3);
        continue;
      }
    }
    log(name + ": hack failed after " + MAX_HACK_ATTEMPTS + " attempts \u2014 no access granted", "error");
    return false;
  }
  async function ensureServerAccess(serverId) {
    var name = getServerName(serverId);
    log("Ensuring access to " + name);
    if (SERVER_PATH_MAP[name]) {
      var maint = await checkPathMaintenance(name);
      if (maint.blocked) {
        log("\u26A0\uFE0F " + name + " unreachable \u2014 " + maint.blockerName + " in maintenance", "warn");
        return false;
      }
    }
    if (!await setEndpoint(serverId)) return false;
    return await loginOrHack(serverId);
  }

  // src/auto-valuable-seller/operations.js
  async function getServerFiles(serverId) {
    sendCmd("get.files", { serverId });
    try {
      var resp = await waitForEvent("COR3_AUTOJOB_SAI_FILES", 15e3);
      if (resp.error) {
        var errMsg = resp.error.message || resp.error.kind || JSON.stringify(resp.error);
        if (errMsg.indexOf("sai-files-not-available") >= 0) {
          log("Files not available on this server (sai-files-not-available)", "warn");
          return [];
        }
        log("Get files error: " + errMsg, "error");
        return [];
      }
      return resp.data && resp.data.files || [];
    } catch (e) {
      log("Get files timeout", "warn");
      return [];
    }
  }
  async function getServerLogs(serverId) {
    sendCmd("get.logs", { serverId });
    try {
      var resp = await waitForEvent("COR3_AUTOJOB_SAI_LOGS", 15e3);
      if (resp.error) {
        var errMsg = resp.error.message || resp.error.kind || JSON.stringify(resp.error);
        if (errMsg.indexOf("sai-logs-not-available") >= 0) {
          return [];
        }
        log("Get logs error: " + errMsg, "error");
        return [];
      }
      return resp.data && resp.data.logs || [];
    } catch (e) {
      log("Get logs timeout", "warn");
      return [];
    }
  }
  function filterValuableFiles(files) {
    return files.filter(function(f) {
      return f.basePrice > 0 && f.tags && f.tags.length > 0;
    });
  }
  function filterValuableLogs(logs) {
    return logs.filter(function(l) {
      return l.basePrice > 0 && l.tags && l.tags.length > 0;
    });
  }
  async function getDownloadsFolder() {
    var folderId = window.__cor3DownloadFolderId;
    if (!folderId) {
      log("Downloads folder ID not cached \u2014 requesting desktop options");
      sendCmd("desktop.get.options", {});
      try {
        var optResp = await waitForEvent("COR3_AUTOJOB_DESKTOP_OPTIONS", 1e4);
        if (optResp.data && optResp.data.folders) {
          var dlf = optResp.data.folders.find(function(f) {
            return f.name === "Downloads";
          });
          if (dlf) {
            folderId = dlf.id;
            window.__cor3DownloadFolderId = folderId;
          }
        }
      } catch (e) {
      }
    }
    if (!folderId) {
      log("Could not find Downloads folder ID", "error");
      return [];
    }
    sendCmd("open.folder", { folderId, source: "desktop" });
    try {
      var resp = await waitForEvent("COR3_AUTOJOB_DESKTOP_FOLDER", 15e3);
      if (resp.error) {
        log("Open folder error: " + JSON.stringify(resp.error), "error");
        return [];
      }
      return resp.data && resp.data.files || [];
    } catch (e) {
      log("Open folder timeout", "warn");
      return [];
    }
  }
  async function getFileAnalysis(fileId) {
    if (_fileAnalysisCache[fileId]) {
      return _fileAnalysisCache[fileId];
    }
    sendCmd("get.file.analysis", { fileId });
    try {
      var resp = await waitForEvent("COR3_AUTOJOB_FILE_ANALYSIS", 1e4);
      if (resp.error) return null;
      var result = resp.data || null;
      if (result) _fileAnalysisCache[fileId] = result;
      return result;
    } catch (e) {
      return null;
    }
  }
  async function searchValuableFiles(serverId) {
    sendCmd("file.search-valuable", { serverId });
    try {
      var resp = await waitForEvent("COR3_VALUABLE_FILE_SEARCH", 3e4);
      if (resp.error) {
        log("File search-valuable error: " + JSON.stringify(resp.error), "error");
        return null;
      }
      return resp.data || null;
    } catch (e) {
      log("File search-valuable timeout", "warn");
      return null;
    }
  }
  async function searchValuableLogs(serverId) {
    sendCmd("log.search-valuable", { serverId });
    try {
      var resp = await waitForEvent("COR3_VALUABLE_LOG_SEARCH", 3e4);
      if (resp.error) {
        var errMsg = resp.error.message || resp.error.kind || JSON.stringify(resp.error);
        if (errMsg.indexOf("sai-logs-not-available") >= 0) {
          return null;
        }
        log("Log search-valuable error: " + errMsg, "error");
        return null;
      }
      return resp.data || null;
    } catch (e) {
      log("Log search-valuable timeout", "warn");
      return null;
    }
  }
  async function downloadFile(serverId, fileId) {
    var desktopFileId = null;
    function onUpdateFile(evt) {
      if (evt.data && evt.data.type === "COR3_AUTOJOB_DESKTOP_UPDATE_FILE" && evt.data.data && evt.data.data.file) {
        desktopFileId = evt.data.data.file.id;
      }
    }
    window.addEventListener("message", onUpdateFile);
    sendCmd("file.download", { serverId, fileId });
    try {
      var resp = await waitForEvent("COR3_AUTOJOB_SAI_FILE_DOWNLOAD", 3e4);
      window.removeEventListener("message", onUpdateFile);
      if (resp.error) {
        log("File download error: " + JSON.stringify(resp.error), "error");
        return false;
      }
      if (desktopFileId) {
        _desktopToServerMap[desktopFileId] = { serverId, type: "file", originalId: fileId };
      }
      return true;
    } catch (e) {
      window.removeEventListener("message", onUpdateFile);
      log("File download timeout", "warn");
      return false;
    }
  }
  async function downloadLog(serverId, logSeq) {
    var desktopFileId = null;
    function onUpdateFile(evt) {
      if (evt.data && evt.data.type === "COR3_AUTOJOB_DESKTOP_UPDATE_FILE" && evt.data.data && evt.data.data.file) {
        desktopFileId = evt.data.data.file.id;
      }
    }
    window.addEventListener("message", onUpdateFile);
    sendCmd("log.download", { serverId, seq: logSeq });
    try {
      var resp = await waitForEvent("COR3_AUTOJOB_SAI_LOG_DOWNLOAD", 3e4);
      window.removeEventListener("message", onUpdateFile);
      if (resp.error) {
        log("Log download error: " + JSON.stringify(resp.error), "error");
        return false;
      }
      if (desktopFileId) {
        _desktopToServerMap[desktopFileId] = { serverId, type: "log", originalId: logSeq };
      }
      return true;
    } catch (e) {
      window.removeEventListener("message", onUpdateFile);
      log("Log download timeout", "warn");
      return false;
    }
  }
  async function getSellableItems(marketId) {
    sendCmd("get.sellable-items", { marketId });
    try {
      var resp = await waitForEvent("COR3_VALUABLE_SELLABLE_ITEMS", 15e3);
      if (resp.error) {
        log("Get sellable items error: " + JSON.stringify(resp.error), "error");
        return { items: [], totalPrice: 0, totalRepGain: 0 };
      }
      var d = resp.data || {};
      return {
        items: d.items || [],
        totalPrice: d.totalPrice || 0,
        totalRepGain: d.totalRepGain || 0
      };
    } catch (e) {
      log("Get sellable items timeout", "warn");
      return { items: [], totalPrice: 0, totalRepGain: 0 };
    }
  }
  async function sellItems(marketId, items, onSold) {
    var sold = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      sendCmd("sell.items", { marketId, items: [{ itemType: item.itemType, itemId: item.itemId }] });
      try {
        var resp = await waitForEvent("COR3_VALUABLE_SELL_RESULT", 15e3);
        if (resp.error) {
          log("Sell item error (" + item.itemId + "): " + JSON.stringify(resp.error), "error");
          continue;
        }
        sold++;
        if (onSold) onSold(item);
      } catch (e) {
        log("Sell item timeout (" + item.itemId + ")", "warn");
        continue;
      }
      if (i < items.length - 1) await delay(humanDelay());
    }
    return sold;
  }

  // src/auto-valuable-seller/maintenance.js
  async function fetchMaintenanceData() {
    log("Fetching maintenance data...");
    setCachedMapData(null);
    sendCmd("get.map", {});
    try {
      var mapData = await waitForEvent("COR3_WS_NETWORK_MAP", 1e4);
      setCachedMapData(mapData);
      if (!mapData || !mapData.servers) return;
      var maintServers = [];
      for (var sid in mapData.servers) {
        var srv = mapData.servers[sid];
        if (srv.timeUntilMaintenance || srv.maintenanceEndsAt) {
          maintServers.push({
            id: sid,
            serverName: srv.serverName,
            timeUntilMaintenance: srv.timeUntilMaintenance || null,
            maintenanceEndsAt: srv.maintenanceEndsAt || null
          });
        }
      }
      maintServers.sort(function(a, b) {
        var aInMaint = a.maintenanceEndsAt ? 0 : 1;
        var bInMaint = b.maintenanceEndsAt ? 0 : 1;
        if (aInMaint !== bInMaint) return aInMaint - bInMaint;
        var tA = a.timeUntilMaintenance || a.maintenanceEndsAt || "";
        var tB = b.timeUntilMaintenance || b.maintenanceEndsAt || "";
        return tA < tB ? -1 : tA > tB ? 1 : 0;
      });
      log("Maintenance: " + maintServers.length + " server(s) with upcoming/active maintenance");
      updateMaintenanceUI({ servers: maintServers });
    } catch (e) {
      log("Maintenance data fetch timeout", "warn");
    }
  }
  async function forceMaintenanceBatch(servers) {
    if (_forceMaintenanceRunning) {
      log("Force maintenance already in progress", "warn");
      return;
    }
    setForceMaintenanceRunning(true);
    setRunning(true);
    servers.sort(function(a, b) {
      return getServerPathLength(b.id) - getServerPathLength(a.id);
    });
    var serverIds = servers.map(function(s) {
      return s.id;
    });
    log("\u{1F527} Batch force maintenance: " + servers.length + " server(s) \u2014 order: " + servers.map(function(s) {
      return s.name;
    }).join(", "));
    var completed = 0;
    var failed = [];
    for (var i = 0; i < servers.length; i++) {
      var srv = servers[i];
      window.postMessage({ type: "COR3_VALUABLE_FORCE_MAINT_BATCH_PROGRESS", currentServerId: srv.id, serverIds }, "*");
      log("\u{1F527} Batch [" + (i + 1) + "/" + servers.length + "]: " + srv.name + " \u2014 equipping search software...");
      try {
        var searchPower = await ensureSearchOnlyLoadout(srv.id);
        if (!searchPower) {
          log("\u{1F527} Batch [" + (i + 1) + "/" + servers.length + "]: could not equip search software for " + srv.name, "error");
          failed.push(srv.name);
          if (i < servers.length - 1) await delay(2e3);
          continue;
        }
        log("\u{1F527} Batch [" + (i + 1) + "/" + servers.length + "]: " + srv.name + " \u2014 sending search-valuable requests...");
        var MAX_ATTEMPTS = 50;
        var maintStarted = false;
        for (var j = 0; j < MAX_ATTEMPTS; j++) {
          if (!running) {
            log("Batch force maintenance stopped", "warn");
            break;
          }
          sendCmd("file.search-valuable", { serverId: srv.id });
          var searchResult = await new Promise(function(resolve) {
            var done = false;
            var timer = setTimeout(function() {
              if (done) return;
              done = true;
              window.removeEventListener("message", onMsg);
              resolve("timeout");
            }, 15e3);
            function onMsg(evt) {
              if (done) return;
              if (evt.data && evt.data.type === "COR3_WS_MAINTENANCE_STARTED") {
                done = true;
                clearTimeout(timer);
                window.removeEventListener("message", onMsg);
                resolve("maintenance");
              } else if (evt.data && evt.data.type === "COR3_VALUABLE_FILE_SEARCH") {
                done = true;
                clearTimeout(timer);
                window.removeEventListener("message", onMsg);
                var errMsg = evt.data.error && evt.data.error.message;
                if (errMsg === "sai-access-denied") {
                  resolve("access-denied");
                } else {
                  resolve("ok");
                }
              }
            }
            window.addEventListener("message", onMsg);
          });
          if (searchResult === "maintenance") {
            maintStarted = true;
            break;
          }
          if (searchResult === "access-denied") {
            setCachedMapData(null);
            sendCmd("get.map", {});
            try {
              var mapCheck = await waitForEvent("COR3_WS_NETWORK_MAP", 1e4);
              setCachedMapData(mapCheck);
              if (mapCheck && mapCheck.servers && mapCheck.servers[srv.id] && mapCheck.servers[srv.id].maintenanceEndsAt) {
                log("\u{1F527} Batch [" + (i + 1) + "/" + servers.length + "]: " + srv.name + " \u2014 confirmed in maintenance", "success");
                maintStarted = true;
                break;
              }
              var reachOk = await setEndpoint(srv.id);
              if (!reachOk) {
                var pathBlock = await checkPathMaintenance(getServerName(srv.id));
                if (pathBlock.blocked) {
                  var bMins = Math.ceil(pathBlock.remainingMs / 6e4);
                  log("\u{1F527} Batch [" + (i + 1) + "/" + servers.length + "]: cannot reach " + srv.name + " \u2014 " + pathBlock.blockerName + " in maintenance (~" + bMins + "m)", "error");
                  failed.push(srv.name + " (blocked by " + pathBlock.blockerName + ")");
                  break;
                }
                log("\u{1F527} Batch [" + (i + 1) + "/" + servers.length + "]: cannot reach " + srv.name + " \u2014 path-through failed", "error");
                failed.push(srv.name + " (unreachable)");
                break;
              }
              await delay(humanDelay());
            } catch (e) {
              log("\u{1F527} Batch: map check failed for " + srv.name + " \u2014 retrying...", "warn");
            }
            continue;
          }
          await delay(humanDelay());
        }
        if (maintStarted) {
          completed++;
          log("\u{1F527} Batch [" + (i + 1) + "/" + servers.length + "]: " + srv.name + " \u2014 maintenance started!", "success");
          window.postMessage({ type: "COR3_VALUABLE_FORCE_MAINT_SERVER_DONE", serverId: srv.id, serverName: srv.name }, "*");
        } else if (running) {
          log("\u{1F527} Batch [" + (i + 1) + "/" + servers.length + "]: " + srv.name + " \u2014 did not trigger after " + MAX_ATTEMPTS + " attempts", "warn");
          failed.push(srv.name + " (max attempts)");
        }
      } catch (e) {
        log("\u{1F527} Batch [" + (i + 1) + "/" + servers.length + "]: " + srv.name + " \u2014 error: " + e.message, "error");
        failed.push(srv.name + " (error)");
      }
      if (!running) break;
      if (i < servers.length - 1) await delay(2e3);
    }
    log("\u{1F527} Batch force maintenance complete: " + completed + "/" + servers.length + " succeeded" + (failed.length > 0 ? " \u2014 failed: " + failed.join(", ") : ""), completed === servers.length ? "success" : "warn");
    await delay(1500);
    await fetchMaintenanceData();
    setForceMaintenanceRunning(false);
    setRunning(false);
    window.postMessage({ type: "COR3_VALUABLE_FORCE_MAINT_DONE", success: failed.length === 0 }, "*");
  }

  // src/auto-valuable-seller/search-mode.js
  async function runSearch() {
    log("=== Valuable Search Started ===", "info");
    setCachedMapData(null);
    var serversData = { servers: [] };
    setLastServersData(serversData);
    var downloadsData = { files: [] };
    log("Fetching network map...");
    sendCmd("get.map", {});
    var mapServers = [];
    try {
      var mapData = await waitForEvent("COR3_WS_NETWORK_MAP", 1e4);
      setCachedMapData(mapData);
      if (mapData && mapData.servers) {
        for (var sid in mapData.servers) {
          var sInfo = mapData.servers[sid];
          var sName = ALL_SERVERS[sid];
          if (sName && !sInfo.isInMaintenance) {
            mapServers.push({ id: sid, name: sName, isAccessible: sInfo.isAccessible || false });
          }
        }
      }
    } catch (e) {
      log("Network map timeout \u2014 using hardcoded server list", "warn");
      for (var sId in ALL_SERVERS) {
        mapServers.push({ id: sId, name: ALL_SERVERS[sId], isAccessible: false });
      }
    }
    mapServers.sort(function(a, b) {
      var pathA = SERVER_PATH_MAP[a.name] || [];
      var pathB = SERVER_PATH_MAP[b.name] || [];
      return pathB.length - pathA.length;
    });
    log("Found " + mapServers.length + " reachable servers to scan (furthest first)");
    for (var i = 0; i < mapServers.length; i++) {
      if (!running) {
        log("Search stopped by user.", "warn");
        break;
      }
      var server = mapServers[i];
      log("Scanning server " + (i + 1) + "/" + mapServers.length + ": " + server.name);
      var serverEntry = {
        id: server.id,
        name: server.name,
        status: "OPEN",
        files: [],
        logs: [],
        selected: false
      };
      if (!await ensureServerAccess(server.id)) {
        log(server.name + ": skipping (no access)", "warn");
        serverEntry.status = "SKIPPED";
        serversData.servers.push(serverEntry);
        updateServersUI(serversData);
        continue;
      }
      await delay(humanDelay());
      var files = await getServerFiles(server.id);
      var valuableFiles = filterValuableFiles(files);
      for (var fi = 0; fi < valuableFiles.length; fi++) {
        var f = valuableFiles[fi];
        var tags = (f.tags || []).map(function(t) {
          return typeof t === "string" ? { key: t, label: t } : t;
        });
        serverEntry.files.push({
          fileId: f.fileId,
          name: f.name,
          basePrice: f.basePrice,
          detectRate: f.detectRate,
          tags
        });
      }
      await delay(humanDelay());
      var logs = await getServerLogs(server.id);
      var valuableLogs = filterValuableLogs(logs);
      for (var li = 0; li < valuableLogs.length; li++) {
        var l = valuableLogs[li];
        var ltags = (l.tags || []).map(function(t) {
          return typeof t === "string" ? { key: t, label: t } : t;
        });
        serverEntry.logs.push({
          seq: l.seq,
          message: l.message,
          basePrice: l.basePrice,
          detectRate: l.detectRate,
          tags: ltags
        });
      }
      var total = serverEntry.files.length + serverEntry.logs.length;
      if (total > 0) {
        serverEntry.status = "OPEN";
        log(server.name + ": found " + serverEntry.files.length + " valuable file(s), " + serverEntry.logs.length + " valuable log(s)", "success");
      } else {
        serverEntry.status = "DONE";
        log(server.name + ": no valuables found");
        serverEntry.selected = false;
      }
      serversData.servers.push(serverEntry);
      updateServersUI(serversData);
      await delay(humanDelay());
    }
    if (running) {
      log("Scanning downloads folder...");
      var dlFiles = await getDownloadsFolder();
      var valuableDlFiles = dlFiles.filter(function(f2) {
        return f2.isValuable;
      });
      for (var di = 0; di < valuableDlFiles.length; di++) {
        if (!running) break;
        var dlFile = valuableDlFiles[di];
        log("Analyzing download: " + dlFile.name);
        var analysis = await getFileAnalysis(dlFile.id);
        var dlTags = [];
        var dlSource = "\u2014";
        if (analysis) {
          dlTags = (analysis.tags || []).map(function(t) {
            return typeof t === "string" ? { key: t, label: t } : t;
          });
          dlSource = analysis.source || "\u2014";
        }
        if (dlTags.length === 0) {
          continue;
        }
        downloadsData.files.push({
          id: dlFile.id,
          name: dlFile.name,
          source: dlSource,
          tags: dlTags,
          status: "OPEN",
          selected: false
        });
        updateDownloadsUI(downloadsData);
        await delay(humanDelay());
      }
      log("Downloads folder: found " + downloadsData.files.length + " valuable file(s)", "success");
    }
    await fetchMaintenanceData();
    log("=== Valuable Search Complete ===", "success");
    signalDone();
  }

  // src/auto-valuable-seller/seller-mode.js
  async function runSeller(selectedServers, selectedDownloads) {
    log("=== Valuable Seller Started ===", "info");
    setCachedMapData(null);
    clearDesktopToServerMap();
    selectedServers = selectedServers.slice().sort(function(a, b) {
      var nameA = getServerName(a);
      var nameB = getServerName(b);
      var pathA = SERVER_PATH_MAP[nameA] || [];
      var pathB = SERVER_PATH_MAP[nameB] || [];
      return pathB.length - pathA.length;
    });
    log("Selected: " + selectedServers.length + " server(s), " + selectedDownloads.length + " download(s) (processing furthest first)");
    var _sellerDownloadsData = { files: [] };
    for (var si = 0; si < selectedServers.length; si++) {
      if (!running) {
        log("Seller stopped by user.", "warn");
        break;
      }
      var serverId = selectedServers[si];
      var serverName = getServerName(serverId);
      log("Processing server " + (si + 1) + "/" + selectedServers.length + ": " + serverName);
      if (!await ensureServerAccess(serverId)) {
        log(serverName + ": skipping (no access)", "warn");
        continue;
      }
      await delay(humanDelay());
      var searchPhaseEntry = _lastServersData ? _lastServersData.servers.find(function(s) {
        return s.id === serverId;
      }) : null;
      var hasSearchFiles = !searchPhaseEntry || searchPhaseEntry.files && searchPhaseEntry.files.length > 0;
      var hasSearchLogs = !searchPhaseEntry || searchPhaseEntry.logs && searchPhaseEntry.logs.length > 0;
      if (hasSearchFiles || hasSearchLogs) {
        await ensureSearchOnlyLoadout(serverId);
        await delay(humanDelay());
      }
      var detectedFileIds = {};
      if (hasSearchFiles) {
        log(serverName + ": searching for valuable files...");
        var fileSearchResult = await searchValuableFiles(serverId);
        if (fileSearchResult && fileSearchResult.found) {
          var valuableFound = fileSearchResult.found.filter(function(f) {
            return f.basePrice > 0;
          });
          for (var dfi = 0; dfi < valuableFound.length; dfi++) {
            detectedFileIds[valuableFound[dfi].id] = true;
          }
          log(serverName + ": file search-valuable completed \u2014 detected " + valuableFound.length + " file(s)" + (valuableFound.length < fileSearchResult.found.length ? " (" + (fileSearchResult.found.length - valuableFound.length) + " skipped, basePrice=0)" : "") + ", searchPower used: " + (fileSearchResult.searchPowerUsed || "?"), "success");
        }
        await delay(humanDelay());
      } else {
        log(serverName + ": skipping file search-valuable (no valuable files found during scan)");
      }
      var detectedLogIds = {};
      if (hasSearchLogs) {
        log(serverName + ": searching for valuable logs...");
        var logSearchResult = await searchValuableLogs(serverId);
        if (logSearchResult && logSearchResult.found) {
          var valuableLogsFound = logSearchResult.found.filter(function(l) {
            return l.basePrice > 0;
          });
          for (var dli = 0; dli < valuableLogsFound.length; dli++) {
            detectedLogIds[valuableLogsFound[dli].id] = true;
          }
          log(serverName + ": log search-valuable completed \u2014 detected " + valuableLogsFound.length + " log(s)" + (valuableLogsFound.length < logSearchResult.found.length ? " (" + (logSearchResult.found.length - valuableLogsFound.length) + " skipped, basePrice=0)" : ""), "success");
        }
        await delay(humanDelay());
      } else {
        log(serverName + ": skipping log search-valuable (no valuable logs found during scan)");
      }
      var files = await getServerFiles(serverId);
      var valuableFiles = filterValuableFiles(files);
      var hasFileFilter = Object.keys(detectedFileIds).length > 0;
      if (hasFileFilter) {
        var beforeCount = valuableFiles.length;
        valuableFiles = valuableFiles.filter(function(f) {
          return detectedFileIds[f.fileId || f.id];
        });
        if (beforeCount !== valuableFiles.length) {
          log(serverName + ": filtered files: " + valuableFiles.length + " detected of " + beforeCount + " total valuable");
        }
      }
      if (_lastServersData) {
        var srvEntry = _lastServersData.servers.find(function(s) {
          return s.id === serverId;
        });
        if (srvEntry) {
          srvEntry.files = valuableFiles.map(function(f) {
            return { fileId: f.fileId || f.id, name: f.name, tags: f.tags || [], basePrice: f.basePrice || 0 };
          });
          updateServersUI(_lastServersData);
        }
      }
      for (var fi = 0; fi < valuableFiles.length; fi++) {
        if (!running) break;
        var vf = valuableFiles[fi];
        var tagLabels = (vf.tags || []).map(function(t) {
          return typeof t === "string" ? t : t.label || t.key;
        }).join(", ");
        log(serverName + ': downloading file "' + vf.name + '" (tags: ' + tagLabels + ", price: " + vf.basePrice + ")");
        var dlOk = await downloadFile(serverId, vf.fileId);
        if (dlOk) {
          log(serverName + ": file downloaded \u2713", "success");
        } else {
          log(serverName + ": file download failed", "error");
        }
        await delay(humanDelay());
      }
      var logs = await getServerLogs(serverId);
      var valuableLogs = filterValuableLogs(logs);
      var hasLogFilter = Object.keys(detectedLogIds).length > 0;
      if (hasLogFilter) {
        var beforeLogCount = valuableLogs.length;
        valuableLogs = valuableLogs.filter(function(l) {
          return detectedLogIds[String(l.seq)];
        });
        if (beforeLogCount !== valuableLogs.length) {
          log(serverName + ": filtered logs: " + valuableLogs.length + " detected of " + beforeLogCount + " total valuable");
        }
      }
      if (_lastServersData) {
        var srvEntryLogs = _lastServersData.servers.find(function(s) {
          return s.id === serverId;
        });
        if (srvEntryLogs) {
          srvEntryLogs.logs = valuableLogs.map(function(l) {
            return { seq: l.seq, message: l.message, tags: l.tags || [], basePrice: l.basePrice || 0 };
          });
          updateServersUI(_lastServersData);
        }
      }
      for (var li = 0; li < valuableLogs.length; li++) {
        if (!running) break;
        var vl = valuableLogs[li];
        var ltagLabels = (vl.tags || []).map(function(t) {
          return typeof t === "string" ? t : t.label || t.key;
        }).join(", ");
        log(serverName + ': downloading log "' + vl.message + '" (tags: ' + ltagLabels + ", price: " + vl.basePrice + ")");
        var dlLogOk = await downloadLog(serverId, vl.seq);
        if (dlLogOk) {
          log(serverName + ": log downloaded \u2713", "success");
        } else {
          log(serverName + ": log download failed", "error");
        }
        await delay(humanDelay());
      }
      if (_lastServersData) {
        var srvDone = _lastServersData.servers.find(function(s) {
          return s.id === serverId;
        });
        if (srvDone) {
          srvDone.status = "DOWNLOADED";
          updateServersUI(_lastServersData);
        }
      }
      log(serverName + ": refreshing downloads folder...");
      await delay(500);
      var dlFiles = await getDownloadsFolder();
      var valuableDlFiles = dlFiles.filter(function(f) {
        return f.isValuable;
      });
      _sellerDownloadsData = { files: [] };
      for (var di = 0; di < valuableDlFiles.length; di++) {
        var dlFile = valuableDlFiles[di];
        var isCached = !!_fileAnalysisCache[dlFile.id];
        if (!isCached) await delay(300);
        var analysis = await getFileAnalysis(dlFile.id);
        var dlTags = [];
        var dlSource = "\u2014";
        if (analysis) {
          dlTags = (analysis.tags || []).map(function(t) {
            return typeof t === "string" ? { key: t, label: t } : t;
          });
          dlSource = analysis.source || "\u2014";
        }
        if (dlTags.length === 0) {
          continue;
        }
        _sellerDownloadsData.files.push({
          id: dlFile.id,
          name: dlFile.name,
          source: dlSource,
          tags: dlTags,
          status: "OPEN",
          selected: false
        });
      }
      updateDownloadsUI(_sellerDownloadsData);
      log(serverName + ": downloads folder has " + _sellerDownloadsData.files.length + " valuable file(s)");
      log(serverName + ": done processing");
    }
    var grandTotalCredits = 0;
    var grandTotalRep = 0;
    var grandTotalSold = 0;
    if (running) {
      log("--- Selling valuables at markets ---");
      for (var mi = 0; mi < MARKET_SELL_ORDER2.length; mi++) {
        if (!running) break;
        var market = MARKET_SELL_ORDER2[mi];
        log("Checking " + market.name + " market for sellable items...");
        if (market.serverId) {
          log(market.name + ": setting endpoint to market server...");
          var epOk = await _sendSetEndpoint(market.serverId);
          if (!epOk) {
            log(market.name + ": failed to set endpoint \u2014 skipping", "warn");
            continue;
          }
          await delay(humanDelay());
        }
        var sellableResult = await getSellableItems(market.id);
        var sellableItems = sellableResult.items || [];
        if (sellableItems.length === 0) {
          log(market.name + ": no sellable items");
          await delay(humanDelay());
          continue;
        }
        var items = sellableItems.map(function(item) {
          var id = item.itemId || item.id || item.fileId;
          var type = item.itemType || "file";
          return id ? { itemType: type, itemId: id } : null;
        }).filter(Boolean);
        var marketCredits = sellableResult.totalPrice;
        var marketRep = sellableResult.totalRepGain;
        log(market.name + ": found " + items.length + " sellable item(s) (\u{1F4B0}" + marketCredits + " \u2B50" + marketRep + ")");
        if (items.length > 0) {
          await delay(humanDelay());
          log(market.name + ": selling " + items.length + " item(s)...");
          var sold = await sellItems(market.id, items, function(soldItem) {
            var sid = soldItem.itemId;
            _sellerDownloadsData.files = _sellerDownloadsData.files.filter(function(f) {
              return f.id !== sid;
            });
            updateDownloadsUI(_sellerDownloadsData);
            if (_lastServersData) {
              var mapping = _desktopToServerMap[sid];
              if (mapping) {
                var targetSrv = _lastServersData.servers.find(function(s) {
                  return s.id === mapping.serverId;
                });
                if (targetSrv) {
                  if (mapping.type === "file") {
                    targetSrv.files = (targetSrv.files || []).filter(function(f) {
                      return (f.fileId || f.id) !== mapping.originalId;
                    });
                  } else if (mapping.type === "log") {
                    targetSrv.logs = (targetSrv.logs || []).filter(function(l) {
                      return l.seq !== mapping.originalId;
                    });
                  }
                  var remaining = (targetSrv.files || []).length + (targetSrv.logs || []).length;
                  if (remaining === 0 && targetSrv.status === "DOWNLOADED") {
                    targetSrv.status = "DONE";
                  }
                }
                delete _desktopToServerMap[sid];
              }
              updateServersUI(_lastServersData);
            }
          });
          if (sold > 0) {
            log(market.name + ": sold " + sold + "/" + items.length + " item(s) \u2713", "success");
            grandTotalCredits += marketCredits;
            grandTotalRep += marketRep;
            grandTotalSold += sold;
          } else {
            log(market.name + ": sell failed", "error");
          }
          await delay(humanDelay());
        }
      }
    }
    if (grandTotalSold > 0) {
      log("=== Total: " + grandTotalSold + " item(s) sold \u2014 \u{1F4B0}" + grandTotalCredits + " credits, \u2B50" + grandTotalRep + " reputation ===", "success");
    }
    await fetchMaintenanceData();
    log("=== Valuable Seller Complete ===", "success");
    signalDone();
  }

  // src/auto-valuable-seller/index.js
  window.addEventListener("message", function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === "COR3_VALUABLE_START_SEARCH") {
      if (running) {
        log("Already running \u2014 ignoring start request", "warn");
        return;
      }
      setRunning(true);
      setMode("search");
      runSearch().catch(function(err) {
        if (err.message !== "Stopped") log("Search error: " + err.message, "error");
        signalDone();
      });
    }
    if (event.data && event.data.type === "COR3_VALUABLE_START_SELLER") {
      if (running) {
        log("Already running \u2014 ignoring start request", "warn");
        return;
      }
      setRunning(true);
      setMode("seller");
      var sServers = event.data.selectedServers || [];
      var sDownloads = event.data.selectedDownloads || [];
      runSeller(sServers, sDownloads).catch(function(err) {
        if (err.message !== "Stopped") log("Seller error: " + err.message, "error");
        signalDone();
      });
    }
    if (event.data && event.data.type === "COR3_VALUABLE_STOP") {
      if (running) {
        log("Stopping...", "warn");
        setRunning(false);
      }
    }
    if (event.data && event.data.type === "COR3_VALUABLE_FORCE_MAINTENANCE_BATCH") {
      var fmServers = event.data.servers;
      if (fmServers && fmServers.length > 0) {
        forceMaintenanceBatch(fmServers);
      }
    }
  });
  log("Auto Valuable Seller engine loaded", "info");
})();
