

(() => {
  // src/background/helpers.js
  async function getCor3Tab() {
    try {
      const [tab] = await chrome.tabs.query({ url: "*://*.cor3.gg/*" });
      return tab || null;
    } catch (e) {
      return null;
    }
  }
  var BG_AUTO_JOBS_MAX_LOGS = 200;
  async function bgAutoJobLog(msg, level) {
    const entry = { timestamp: (/* @__PURE__ */ new Date()).toISOString(), msg, level: level || "info" };
    try {
      const data = await chrome.storage.local.get("autoJobsDebugLogs");
      const logs = Array.isArray(data.autoJobsDebugLogs) ? data.autoJobsDebugLogs : [];
      logs.push(entry);
      if (logs.length > BG_AUTO_JOBS_MAX_LOGS) logs.splice(0, logs.length - BG_AUTO_JOBS_MAX_LOGS);
      await chrome.storage.local.set({ autoJobsDebugLogs: logs });
    } catch (e) {
    }
  }

  // src/background/auto-choose.js
  var autoChosenDecisions = /* @__PURE__ */ new Set();
  function calcOptionScoreBg(opt, expeditionRiskScore, lootMod, riskMod) {
    return Math.round(opt.lootModifier * lootMod + opt.riskModifier * riskMod * ((expeditionRiskScore + Math.abs(opt.riskModifier)) / 10 || 1));
  }
  async function checkAutoChooseBackground() {
    try {
      const settings = await chrome.storage.sync.get("decisionModifiers");
      const mods = settings.decisionModifiers || {};
      if (!mods.autoChoose) return;
      const modifiersEnabled = mods.enabled !== false;
      const lootMod = modifiersEnabled ? mods.loot ?? 3 : 1;
      const riskMod = modifiersEnabled ? mods.risk ?? -2 : -1;
      const { expeditionDecisions } = await chrome.storage.local.get("expeditionDecisions");
      const decisions = expeditionDecisions || [];
      if (decisions.length === 0) return;
      for (const d of decisions) {
        if (d.isResolved || !d.decisionDeadline || !Array.isArray(d.decisionOptions)) continue;
        if (autoChosenDecisions.has(d.messageId)) continue;
        const dl = new Date(d.decisionDeadline);
        const remaining = dl - Date.now();
        if (remaining <= 0) continue;
        if (remaining > 6e4) continue;
        let bestOpt = null;
        let bestScore = -Infinity;
        for (const opt of d.decisionOptions) {
          const score = calcOptionScoreBg(opt, d.riskScore, lootMod, riskMod);
          if (score > bestScore) {
            bestScore = score;
            bestOpt = opt;
          }
        }
        if (bestOpt) {
          autoChosenDecisions.add(d.messageId);
          try {
            const tab = await getCor3Tab();
            if (tab) {
              await chrome.tabs.sendMessage(tab.id, {
                action: "respondDecision",
                expeditionId: d.expeditionId,
                messageId: d.messageId,
                selectedOption: bestOpt.id
              });
              console.log(`[COR3 Helper BG] Auto-chose "${bestOpt.label}" (score: ${bestScore})`);
            }
          } catch (e) {
          }
        }
      }
    } catch (e) {
      console.log("[COR3 Helper] Background auto-choose failed:", e);
      cor3LogError("background.js", e, { action: "checkAutoChooseBackground" });
    }
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
  var LOG_JOB_TYPES = ["Log Deletion", "Log Download"];

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
  var FALLBACK_SERVER_PRIORITY = [
    "URM7-H",
    "URM7-M",
    "URM7-S5L2",
    "B43274N",
    "B43272N",
    "B43271N",
    "D4RK RM7EG",
    "SRM7-N3L2",
    "SRM7-M",
    "SRM7-N4L2",
    "SRM7-N3L1",
    "RM7-N1L1",
    "RM7-W3NCP",
    "RM7-N2L3",
    "RM7-N2L2",
    "RM7-N2ECP",
    "D4RK RM7CE",
    "RM7-S4WCP",
    "RM7-S4L3",
    "RM7-S4L1",
    "RM7-S4L4",
    "RM7-S4L2",
    "RM7-E1SCP",
    "RM7-E1L2CT",
    "RM7-E1L5",
    "RM7-E1L3"
  ];
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

  // src/background/auto-finish-jobs.js
  var SUPPORTED_JOB_TYPES_BG = [
    "File Decryption",
    "IP Injection",
    "Data Download",
    "Log Deletion",
    "Log Download",
    "Decrypt & Extract",
    "File Elimination",
    "Data Upload",
    "IP Cleanup"
  ];
  function isJobBuggedBg(job) {
    const sn = job.relatedServers && job.relatedServers[0] ? job.relatedServers[0].serverName : job.serverName || "";
    return sn === "D4RK RM7CE" && LOG_JOB_TYPES.includes(job.name);
  }
  var SERVER_PATH_MAP = FALLBACK_PATH_MAP;
  function resolveRecentJobMarketBg(recentJob, fallbackKey, marketData, darkMarketData, soyuzMarketData, usolMarketData) {
    if (recentJob.marketId) {
      for (const [key, id] of Object.entries(MARKET_IDS)) {
        if (id === recentJob.marketId) return key;
      }
    }
    const jobId = recentJob.id;
    for (const [key, md] of [["home", marketData], ["dark", darkMarketData], ["soyuz", soyuzMarketData], ["usol", usolMarketData]]) {
      if (md && md.jobs) {
        if (md.jobs.find((j) => j.id === jobId)) return key;
      }
    }
    return fallbackKey;
  }
  function collectJobsBg(marketData, darkMarketData, completedResults, serverMaintenanceMap, soyuzMarketData, usolMarketData) {
    const SERVER_PRIORITY = FALLBACK_SERVER_PRIORITY;
    const JOB_TYPE_PRIORITY = ["IP Injection", "IP Cleanup", "Data Upload", "Data Download", "Log Deletion", "Log Download", "File Elimination", "File Decryption", "Decrypt & Extract"];
    const maint = serverMaintenanceMap || {};
    const now = Date.now();
    const skipIds = /* @__PURE__ */ new Set();
    if (completedResults && completedResults.length > 0) {
      for (const cr of completedResults) {
        if (cr.status === "failed" || cr.status === "bugged" || cr.status === "skipped") {
          skipIds.add(cr.jobId);
        }
      }
    }
    function getPathBlocker(serverName) {
      const path = SERVER_PATH_MAP[serverName];
      if (!path) return { blocked: false };
      for (const srv of path) {
        const info = maint[srv.id];
        if (info && info.isInMaintenance) {
          if (!info.maintenanceEndsAt || new Date(info.maintenanceEndsAt).getTime() > now) {
            return { blocked: true, blockerName: srv.name, blockerId: srv.id, maintenanceEndsAt: info.maintenanceEndsAt || null };
          }
        }
      }
      return { blocked: false };
    }
    function getServerId(job) {
      return job.relatedServers && job.relatedServers[0] ? job.relatedServers[0].id : job.conditions && job.conditions.serverConfigId ? job.conditions.serverConfigId : null;
    }
    const jobs = [];
    const skippedMaintenance = [];
    const seenTakenIds = /* @__PURE__ */ new Set();
    for (const marketKey of ["dark", "home", "soyuz", "usol"]) {
      const md = marketKey === "home" ? marketData : marketKey === "dark" ? darkMarketData : marketKey === "usol" ? usolMarketData : soyuzMarketData;
      if (!md) continue;
      const openJobs = (md.jobs || []).filter((j) => !j.isCompleted && !j.isExpired && SUPPORTED_JOB_TYPES_BG.includes(j.name) && !isJobBuggedBg(j) && !skipIds.has(j.id));
      const takenJobs = (md.recentJobs || []).filter((j) => j.status === "TAKEN" && SUPPORTED_JOB_TYPES_BG.includes(j.name) && !isJobBuggedBg(j) && !skipIds.has(j.id));
      for (const job of openJobs) {
        const serverName = job.relatedServers && job.relatedServers[0] ? job.relatedServers[0].serverName : "None";
        const serverId = getServerId(job);
        const blocker = getPathBlocker(serverName);
        if (blocker.blocked) {
          skippedMaintenance.push({ serverName, serverId, blockerName: blocker.blockerName, blockerId: blocker.blockerId, maintenanceEndsAt: blocker.maintenanceEndsAt });
          continue;
        }
        jobs.push({
          jobId: job.id,
          name: job.name,
          type: job.name,
          serverName,
          serverId,
          marketId: MARKET_IDS[marketKey],
          marketKey,
          rewardCredits: job.rewardCredits,
          rewardReputation: job.rewardReputation,
          deposit: job.deposit || 0,
          conditions: job.conditions ? job.conditions.items || job.conditions : [],
          alreadyTaken: false,
          canComplete: false,
          status: "pending"
        });
      }
      for (const job of takenJobs) {
        if (seenTakenIds.has(job.id)) continue;
        seenTakenIds.add(job.id);
        const trueMarketKey = resolveRecentJobMarketBg(job, marketKey, marketData, darkMarketData, soyuzMarketData, usolMarketData);
        const serverName = job.relatedServers && job.relatedServers[0] ? job.relatedServers[0].serverName : "None";
        const serverId = getServerId(job);
        const blocker = getPathBlocker(serverName);
        if (blocker.blocked) {
          skippedMaintenance.push({ serverName, serverId, blockerName: blocker.blockerName, blockerId: blocker.blockerId, maintenanceEndsAt: blocker.maintenanceEndsAt });
          continue;
        }
        jobs.push({
          jobId: job.id,
          name: job.name,
          type: job.name,
          serverName,
          serverId,
          marketId: MARKET_IDS[trueMarketKey],
          marketKey: trueMarketKey,
          rewardCredits: job.rewardCredits,
          rewardReputation: job.rewardReputation,
          deposit: job.deposit || 0,
          conditions: job.conditions ? job.conditions.items || job.conditions : [],
          alreadyTaken: true,
          canComplete: !!job.canComplete,
          status: "pending"
        });
      }
    }
    jobs.sort((a, b) => {
      const idxA = SERVER_PRIORITY.indexOf(a.serverName);
      const idxB = SERVER_PRIORITY.indexOf(b.serverName);
      const spA = a.serverName === "None" || !a.serverName ? -1 : idxA >= 0 ? idxA : SERVER_PRIORITY.length;
      const spB = b.serverName === "None" || !b.serverName ? -1 : idxB >= 0 ? idxB : SERVER_PRIORITY.length;
      const sp = spA - spB;
      if (sp !== 0) return sp;
      const tpA = JOB_TYPE_PRIORITY.indexOf(a.name);
      const tpB = JOB_TYPE_PRIORITY.indexOf(b.name);
      return (tpA >= 0 ? tpA : JOB_TYPE_PRIORITY.length) - (tpB >= 0 ? tpB : JOB_TYPE_PRIORITY.length);
    });
    jobs._skippedMaintenance = skippedMaintenance;
    return jobs;
  }
  var _scheduleAutoFinishDebounceTimer = null;
  function scheduleAutoFinishAllBgDebounced() {
    if (_scheduleAutoFinishDebounceTimer) clearTimeout(_scheduleAutoFinishDebounceTimer);
    _scheduleAutoFinishDebounceTimer = setTimeout(() => {
      _scheduleAutoFinishDebounceTimer = null;
      scheduleAutoFinishAllBg();
    }, 2e3);
  }
  async function scheduleAutoFinishAllBg() {
    const settings = await chrome.storage.sync.get("autoFinishAllJobsEnabled");
    if (!settings.autoFinishAllJobsEnabled) {
      await chrome.alarms.clear("autoFinishAllJobs");
      return;
    }
    const { marketData, darkMarketData, soyuzMarketData, usolMarketData, autoJobsRunning, serverMaintenanceMap } = await chrome.storage.local.get(["marketData", "darkMarketData", "soyuzMarketData", "usolMarketData", "autoJobsRunning", "serverMaintenanceMap"]);
    if (autoJobsRunning) {
      return;
    }
    const { autoJobsCompletedResults: crSched } = await chrome.storage.local.get("autoJobsCompletedResults");
    const availableNow = collectJobsBg(marketData, darkMarketData, crSched || [], serverMaintenanceMap, soyuzMarketData, usolMarketData);
    if (availableNow.length > 0) {
      bgAutoJobLog("\u{1F504} Auto Finish All: jobs available now \u2014 starting in 10s");
      await chrome.alarms.create("autoFinishAllJobs", { delayInMinutes: 10 / 60 });
      return;
    }
    let minWaitMs = Infinity;
    const now = Date.now();
    let scheduledReason = "";
    for (const md of [marketData, darkMarketData, soyuzMarketData, usolMarketData]) {
      if (md && md.nextJobsResetAt) {
        const diff = new Date(md.nextJobsResetAt).getTime() - now;
        if (diff > 0 && diff < minWaitMs) {
          minWaitMs = diff;
          scheduledReason = "job reset";
        }
      }
    }
    const skipped = availableNow._skippedMaintenance || [];
    if (skipped.length > 0) {
      const seenBlockerIds = /* @__PURE__ */ new Set();
      for (const s of skipped) {
        if (seenBlockerIds.has(s.blockerId)) continue;
        seenBlockerIds.add(s.blockerId);
        if (s.maintenanceEndsAt) {
          const diff = new Date(s.maintenanceEndsAt).getTime() + 3 * 60 * 1e3 - now;
          if (diff > 0 && diff < minWaitMs) {
            minWaitMs = diff;
            scheduledReason = `${s.blockerName} maintenance end (+3m buffer)`;
          }
        }
      }
      const blockedPairs = [...new Set(skipped.map(
        (s) => s.blockerName === s.serverName ? s.serverName : `${s.serverName} (blocked by ${s.blockerName})`
      ))].join(", ");
      bgAutoJobLog(`\u{1F504} Auto Finish All: skipped jobs due to maintenance: ${blockedPairs}`, "warn");
    }
    const skippedFromResults = (crSched || []).filter((cr) => cr.status === "skipped");
    if (skippedFromResults.length > 0) {
      let hasEndTimeInfo = false;
      for (const sr of skippedFromResults) {
        if (sr.maintenanceEndsAt) {
          hasEndTimeInfo = true;
          const diff = new Date(sr.maintenanceEndsAt).getTime() + 3 * 60 * 1e3 - now;
          if (diff > 0 && diff < minWaitMs) {
            minWaitMs = diff;
            scheduledReason = `maintenance end (${sr.serverName || "unknown server"}) (+3m buffer)`;
          } else if (diff <= 0 && minWaitMs === Infinity) {
            minWaitMs = 30 * 1e3;
            scheduledReason = `maintenance ended (${sr.serverName || "unknown server"}) \u2014 rechecking`;
          }
        }
      }
      if (!hasEndTimeInfo && minWaitMs === Infinity) {
        minWaitMs = 10 * 60 * 1e3;
        scheduledReason = "maintenance fallback (no end time known)";
        bgAutoJobLog(`\u{1F504} Auto Finish All: ${skippedFromResults.length} job(s) skipped (maintenance) with unknown end time \u2014 waiting 10m`, "warn");
      }
      for (const sr of skippedFromResults) {
        if (sr.lockExpiresAt) {
          const diff = new Date(sr.lockExpiresAt).getTime() - now;
          if (diff > 0 && diff < minWaitMs) {
            minWaitMs = diff;
            scheduledReason = `minigame lock expires (${sr.name || sr.serverName || "unknown"})`;
          }
        }
      }
    }
    if (minWaitMs < Infinity) {
      const waitMs = minWaitMs + 15e3;
      const mins = Math.max(waitMs / 6e4, 0.25);
      bgAutoJobLog(`\u{1F504} Auto Finish All: next run scheduled in ${Math.floor(waitMs / 6e4)}m ${Math.floor(waitMs % 6e4 / 1e3)}s (${scheduledReason})`);
      await chrome.alarms.create("autoFinishAllJobs", { delayInMinutes: mins });
    } else {
      bgAutoJobLog("\u{1F504} Auto Finish All: no reset timer found \u2014 checking again in 5m");
      await chrome.alarms.create("autoFinishAllJobs", { delayInMinutes: 5 });
    }
  }
  async function runAutoFinishAllBg() {
    const settings = await chrome.storage.sync.get("autoFinishAllJobsEnabled");
    if (!settings.autoFinishAllJobsEnabled) return;
    const { autoJobsRunning } = await chrome.storage.local.get("autoJobsRunning");
    if (autoJobsRunning) {
      return;
    }
    const tab = await getCor3Tab();
    if (!tab) {
      bgAutoJobLog("\u{1F504} Auto Finish All: no cor3.gg tab found \u2014 retrying in 1m", "warn");
      await chrome.alarms.create("autoFinishAllJobs", { delayInMinutes: 1 });
      return;
    }
    let fetchWaitAttempts = 0;
    while (fetchWaitAttempts < 24) {
      const { initialFetchDoneAt } = await chrome.storage.local.get("initialFetchDoneAt");
      if (initialFetchDoneAt) break;
      fetchWaitAttempts++;
      if (fetchWaitAttempts === 1) bgAutoJobLog("\u{1F504} Auto Finish All: waiting for initial page load to complete...");
      await new Promise((r) => setTimeout(r, 5e3));
    }
    if (fetchWaitAttempts >= 24) {
      bgAutoJobLog("\u{1F504} Auto Finish All: initial page load not complete after 120s \u2014 proceeding anyway", "warn");
    }
    const { autoJobsCompletedResults: crPre } = await chrome.storage.local.get("autoJobsCompletedResults");
    if (Array.isArray(crPre) && crPre.some((cr) => cr.status === "skipped")) {
      const cleared = crPre.filter((cr) => cr.status !== "skipped");
      await chrome.storage.local.set({ autoJobsCompletedResults: cleared });
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      const runCheck = await chrome.storage.local.get("autoJobsRunning");
      if (runCheck.autoJobsRunning) return;
      const { marketData: mdCheck, darkMarketData: dmdCheck, soyuzMarketData: smdCheck, usolMarketData: umdCheck } = await chrome.storage.local.get(["marketData", "darkMarketData", "soyuzMarketData", "usolMarketData"]);
      const nowCheck = Date.now();
      const expiredMarkets = [];
      if (!mdCheck || !mdCheck.nextJobsResetAt || new Date(mdCheck.nextJobsResetAt).getTime() <= nowCheck) expiredMarkets.push("home");
      if (!dmdCheck || !dmdCheck.nextJobsResetAt || new Date(dmdCheck.nextJobsResetAt).getTime() <= nowCheck) expiredMarkets.push("dark");
      if (!smdCheck || !smdCheck.nextJobsResetAt || new Date(smdCheck.nextJobsResetAt).getTime() <= nowCheck) expiredMarkets.push("soyuz");
      if (!umdCheck || !umdCheck.nextJobsResetAt || new Date(umdCheck.nextJobsResetAt).getTime() <= nowCheck) expiredMarkets.push("usol");
      const refreshOrder = [];
      if (expiredMarkets.includes("usol")) refreshOrder.push("usol");
      if (expiredMarkets.includes("soyuz")) refreshOrder.push("soyuz");
      if (expiredMarkets.includes("dark")) refreshOrder.push("dark");
      if (expiredMarkets.includes("home")) refreshOrder.push("home");
      bgAutoJobLog(`\u{1F504} Auto Finish All: refreshing ${refreshOrder.length > 0 ? refreshOrder.join(", ") : "all"} market data (attempt ${attempt}/3)...`);
      try {
        const refreshMsg = { action: "refreshAllMarketsSeq", skipLots: true };
        if (refreshOrder.length > 0) refreshMsg.order = refreshOrder;
        await chrome.tabs.sendMessage(tab.id, refreshMsg);
      } catch (e) {
        bgAutoJobLog("\u{1F504} Auto Finish All: failed to refresh markets \u2014 " + (e.message || e), "error");
        cor3LogError("background.js", e, { action: "autoFinishAll-refreshMarkets" });
        scheduleAutoFinishAllBg();
        return;
      }
      await new Promise((r) => {
        let done = false;
        const listener = (changes, area) => {
          if (area === "local" && changes._allMarketsRefreshed) {
            done = true;
            chrome.storage.onChanged.removeListener(listener);
            clearTimeout(tmr);
            r();
          }
        };
        chrome.storage.onChanged.addListener(listener);
        const tmr = setTimeout(() => {
          if (!done) {
            chrome.storage.onChanged.removeListener(listener);
            r();
          }
        }, 3e4);
      });
      const { marketData, darkMarketData, soyuzMarketData, usolMarketData, autoJobsCompletedResults: crRun, serverMaintenanceMap } = await chrome.storage.local.get(["marketData", "darkMarketData", "soyuzMarketData", "usolMarketData", "autoJobsCompletedResults", "serverMaintenanceMap"]);
      const jobsToRun = collectJobsBg(marketData, darkMarketData, crRun || [], serverMaintenanceMap, soyuzMarketData, usolMarketData);
      if (jobsToRun.length > 0) {
        const skippedList = jobsToRun._skippedMaintenance || [];
        if (skippedList.length > 0) {
          const blockedPairs = [...new Set(skippedList.map(
            (s) => s.blockerName === s.serverName ? s.serverName : `${s.serverName} (blocked by ${s.blockerName})`
          ))].join(", ");
          bgAutoJobLog(`\u{1F504} Auto Finish All: skipped ${skippedList.length} job(s) due to maintenance: ${blockedPairs}`, "warn");
        }
        bgAutoJobLog(`\u{1F504} Auto Finish All: starting ${jobsToRun.length} job(s)`);
        const { autoJobsTracker: existingTracker } = await chrome.storage.local.get("autoJobsTracker");
        const newJobIds = new Set(jobsToRun.map((j) => j.jobId));
        const previousJobs = (existingTracker || []).filter(
          (j) => !newJobIds.has(j.jobId) && (j.status === "done" || j.status === "failed" || j.status === "skipped" || j.status === "bugged")
        );
        const mergedTracker = [...previousJobs, ...jobsToRun];
        await chrome.storage.local.set({ autoJobsRunning: true, autoJobsQueue: jobsToRun, autoJobsTracker: mergedTracker });
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "startAutoJobs", jobs: jobsToRun });
        } catch (e) {
          bgAutoJobLog("\u{1F504} Auto Finish All: failed to start \u2014 " + (e.message || e), "error");
          cor3LogError("background.js", e, { action: "autoFinishAll-startJobs" });
          await chrome.storage.local.set({ autoJobsRunning: false });
        }
        return;
      }
      const allUnfiltered = [];
      const seenUnfilteredIds = /* @__PURE__ */ new Set();
      for (const md of [marketData, darkMarketData, soyuzMarketData, usolMarketData]) {
        if (!md) continue;
        const open = (md.jobs || []).filter((j) => !j.isCompleted && !j.isExpired && SUPPORTED_JOB_TYPES_BG.includes(j.name));
        const taken = (md.recentJobs || []).filter((j) => j.status === "TAKEN" && SUPPORTED_JOB_TYPES_BG.includes(j.name) && !seenUnfilteredIds.has(j.id));
        allUnfiltered.push(...open);
        for (const j of taken) {
          seenUnfilteredIds.add(j.id);
          allUnfiltered.push(j);
        }
      }
      if (allUnfiltered.length > 0) {
        const skipped = jobsToRun._skippedMaintenance || [];
        if (skipped.length > 0) {
          const blockedPairs = [...new Set(skipped.map(
            (s) => s.blockerName === s.serverName ? s.serverName : `${s.serverName} (blocked by ${s.blockerName})`
          ))].join(", ");
          bgAutoJobLog(`\u{1F504} Auto Finish All: remaining jobs blocked by maintenance: ${blockedPairs} \u2014 scheduling at maintenance end or reset.`, "warn");
        } else {
          bgAutoJobLog("\u{1F504} Auto Finish All: only bugged/failed jobs remain \u2014 waiting for next reset.", "warn");
        }
        scheduleAutoFinishAllBg();
        return;
      }
      if (attempt < 3) {
        const { marketData: mdTimerCheck, darkMarketData: dmdTimerCheck, soyuzMarketData: smdTimerCheck, usolMarketData: umdTimerCheck } = await chrome.storage.local.get(["marketData", "darkMarketData", "soyuzMarketData", "usolMarketData"]);
        const nowTimerCheck = Date.now();
        let allFuture = true;
        let earliestResetMs = Infinity;
        for (const md of [mdTimerCheck, dmdTimerCheck, smdTimerCheck, umdTimerCheck]) {
          if (!md || !md.nextJobsResetAt) {
            allFuture = false;
            break;
          }
          const resetMs = new Date(md.nextJobsResetAt).getTime();
          if (resetMs <= nowTimerCheck) {
            allFuture = false;
            break;
          }
          if (resetMs < earliestResetMs) earliestResetMs = resetMs;
        }
        if (allFuture && earliestResetMs < Infinity) {
          const waitMs = earliestResetMs - nowTimerCheck + 15e3;
          const mins = Math.max(waitMs / 6e4, 0.25);
          bgAutoJobLog(`\u{1F504} Auto Finish All: all markets have future reset timers \u2014 scheduling next run in ${Math.floor(waitMs / 6e4)}m ${Math.floor(waitMs % 6e4 / 1e3)}s`);
          await chrome.alarms.create("autoFinishAllJobs", { delayInMinutes: mins });
          return;
        }
        bgAutoJobLog(`\u{1F504} Auto Finish All: no jobs found yet, retrying in 60s (attempt ${attempt}/3)...`, "warn");
        await new Promise((r) => setTimeout(r, 6e4));
        const recheck = await chrome.storage.sync.get("autoFinishAllJobsEnabled");
        if (!recheck.autoFinishAllJobsEnabled) return;
      }
    }
    bgAutoJobLog("\u{1F504} Auto Finish All: no jobs found after 3 attempts \u2014 scheduling next check at reset");
    scheduleAutoFinishAllBg();
  }

  // src/background/index.js
  async function keepWorkerAlive() {
    try {
      const tab = await getCor3Tab();
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { action: "keepWorkerAlive" });
      }
    } catch (e) {
      console.log("[COR3 Helper] Keep-alive failed:", e);
      cor3LogError("background.js", e, { action: "keepWorkerAlive" });
    }
  }
  keepWorkerAlive();
  setInterval(keepWorkerAlive, 3e4);
  setInterval(checkAutoChooseBackground, 1e4);
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "autoFinishAllJobs") {
      runAutoFinishAllBg();
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.autoJobsRunning) {
      if (!changes.autoJobsRunning.newValue) {
        (async () => {
          try {
            const settings = await chrome.storage.sync.get("autoFinishAllJobsEnabled");
            if (!settings.autoFinishAllJobsEnabled) return;
          } catch (e) {
          }
          scheduleAutoFinishAllBgDebounced();
        })();
      }
    }
    if (area === "local" && (changes.marketData || changes.darkMarketData || changes.soyuzMarketData || changes.usolMarketData)) {
      const now = Date.now();
      const resetChanged = (change, marketKey) => {
        if (!change) return false;
        const oldReset = change.oldValue && change.oldValue.nextJobsResetAt;
        const newReset = change.newValue && change.newValue.nextJobsResetAt;
        if (!newReset) return false;
        if (oldReset) {
          const oldMs = new Date(oldReset).getTime();
          const newMs = new Date(newReset).getTime();
          if (newMs - oldMs > 6e4) return true;
          const cycleDuration = MARKET_RESET_DURATIONS_MS[marketKey] || 0;
          if (oldMs < now && cycleDuration > 0 && now - oldMs < cycleDuration) return true;
        }
        return false;
      };
      const homeReset = resetChanged(changes.marketData, "home");
      const darkReset = resetChanged(changes.darkMarketData, "dark");
      const soyuzReset = resetChanged(changes.soyuzMarketData, "soyuz");
      const usolReset = resetChanged(changes.usolMarketData, "usol");
      if (homeReset || darkReset || soyuzReset || usolReset) {
        chrome.storage.local.get(["autoJobsTracker", "autoJobsCompletedResults"], (result) => {
          let tracker = Array.isArray(result.autoJobsTracker) ? result.autoJobsTracker : [];
          let cr = Array.isArray(result.autoJobsCompletedResults) ? result.autoJobsCompletedResults : [];
          if (homeReset) {
            tracker = tracker.filter((j) => (j.marketKey || "home") !== "home");
            cr = cr.filter((j) => j.marketKey !== "home");
          }
          if (darkReset) {
            tracker = tracker.filter((j) => j.marketKey !== "dark");
            cr = cr.filter((j) => j.marketKey !== "dark");
          }
          if (soyuzReset) {
            tracker = tracker.filter((j) => j.marketKey !== "soyuz");
            cr = cr.filter((j) => j.marketKey !== "soyuz");
          }
          if (usolReset) {
            tracker = tracker.filter((j) => j.marketKey !== "usol");
            cr = cr.filter((j) => j.marketKey !== "usol");
          }
          chrome.storage.local.set({ autoJobsTracker: tracker, autoJobsCompletedResults: cr });
        });
        chrome.storage.sync.get("autoFinishAllJobsEnabled", (data) => {
          if (data.autoFinishAllJobsEnabled) scheduleAutoFinishAllBgDebounced();
        });
      }
    }
    if (area === "local" && changes.initialFetchDoneAt && changes.initialFetchDoneAt.newValue) {
      chrome.storage.sync.get("autoFinishAllJobsEnabled", (data) => {
        if (data.autoFinishAllJobsEnabled) scheduleAutoFinishAllBgDebounced();
      });
    }
  });
  scheduleAutoFinishAllBg();
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "alarmActiveStatus") {
      sendResponse({ success: true });
      return true;
    }
    if (request.action === "scheduleAutoFinishAll") {
      scheduleAutoFinishAllBg();
      sendResponse({ success: true });
      return true;
    }
  });
})();
