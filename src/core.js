/* core.js - pure logic (ES5, no ActiveX). Unit-tested in node, inlined into the HTA at build time.

   SETTINGS FILE FORMAT
   The Call of Duty settings files are plain text, one setting per line. The exact shape changed between games:
       RendererWorkerCount:0.0 = "4" // -1 to 16                      (Modern Warfare II era, options.3.cod22.cst)
       RendererWorkerCount@0;51989;59387 = 16 // -1 to 16              (MW III / Black Ops 6 / Black Ops 7, s.1.0.codNN.txt0/1)
       RendererWorkerCount = "8"                                       (how some guides write it)
   The parser below understands all three, ignores commented-out lines, keeps the quote style, the suffix after the
   key and the trailing comment exactly as they were, and only ever replaces the value itself. */
var Core = (function () {
  var KEY = 'RendererWorkerCount';
  var VRAM_KEY = 'VideoMemoryScale';

  function reEsc(s) { return String(s).replace(/[.*+?\^${}()|\[\]\\\/]/g, '\\$&'); }

  // groups: 1 indent, 2 key, 3 suffix (":0.0" or "@0;1;2"), 4 " = ", 5 open quote, 6 value, 7 close quote, 8 rest of line (comment)
  function lineRe(key) {
    return new RegExp('^([ \\t]*)(' + reEsc(key) + ')((?:[:@][^\\s="\']*)?)([ \\t]*=[ \\t]*)(["\']?)([^"\'\\s\\/]*)(["\']?)(.*)$');
  }

  // "-1 to 16" in the line's comment is the range the game accepts
  function rangeOf(rest) {
    var m = /\/\/.*?(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/i.exec(rest || '');
    return m ? { min: parseFloat(m[1]), max: parseFloat(m[2]) } : null;
  }

  // Splits text into lines while remembering each line ending, so the file can be put back together byte for byte.
  function splitLines(text) {
    var parts = String(text).split('\n'), out = [], i, l;
    for (i = 0; i < parts.length; i++) {
      l = parts[i];
      if (l.charAt(l.length - 1) === '\r') out.push({ body: l.substr(0, l.length - 1), cr: true });
      else out.push({ body: l, cr: false });
    }
    return out;
  }
  function joinLines(lines) {
    var s = [], i;
    for (i = 0; i < lines.length; i++) s.push(lines[i].body + (lines[i].cr ? '\r' : ''));
    return s.join('\n');
  }

  // Every live (not commented-out) occurrence of a key.
  function findKey(text, key) {
    var re = lineRe(key || KEY), lines = splitLines(text), out = [], i, m;
    for (i = 0; i < lines.length; i++) {
      m = re.exec(lines[i].body);
      if (!m) continue;
      if (m[5] !== m[7]) continue;                       // unbalanced quotes: not a line we understand, leave it alone
      out.push({ line: i, value: m[6], quote: m[5], suffix: m[3], range: rangeOf(m[8]) });
    }
    return out;
  }

  function hasKey(text, key) { return findKey(text, key).length > 0; }
  function getKey(text, key) { var f = findKey(text, key); return f.length ? f[0].value : null; }

  // Summary used by the file scan: value, how many times the key appears, whether all copies agree, allowed range.
  function inspect(text, key) {
    var f = findKey(text, key), i, same = true;
    for (i = 1; i < f.length; i++) if (f[i].value !== f[0].value) same = false;
    return { found: f.length > 0, count: f.length, value: f.length ? f[0].value : null, consistent: same, range: f.length ? f[0].range : null };
  }

  // Replaces only the value on every live line of that key. Every other byte of the file is left untouched.
  function setKey(text, key, value) {
    key = key || KEY;
    var re = lineRe(key), lines = splitLines(text), i, m, old = null, count = 0, changed = false, v = String(value);
    for (i = 0; i < lines.length; i++) {
      m = re.exec(lines[i].body);
      if (!m || m[5] !== m[7]) continue;
      if (old === null) old = m[6];
      if (m[6] !== v) changed = true;
      lines[i].body = m[1] + m[2] + m[3] + m[4] + m[5] + v + m[7] + m[8];
      count++;
    }
    if (!count) return { text: text, found: false, changed: false, old: null, count: 0 };
    return { text: changed ? joinLines(lines) : text, found: true, changed: changed, old: old, count: count };
  }

  // Only real settings files: options.N.codNN.cst and s.N.N.codNN.txt / .txt0 / .txt1.
  // Copies people make by hand ("... - Copy.txt0", ".bak", ".old") and this app's own temp files never match.
  function isSettingsFile(name) { return /\.cod\d\d\.(txt\d*|cst)$/i.test(String(name || '')); }

  function gameCode(fileName) {
    var m = /\.?(cod\d\d)\./i.exec(fileName);
    return m ? m[1].toLowerCase() : null;
  }

  // ---------- CPU ----------
  // Parses what Windows reports per logical processor (GetSystemCpuSetInformation), one entry per thread:
  //   "group:core:efficiencyClass:lastLevelCache;"   e.g. "0:0:1:0;0:0:1:0;0:1:1:0;..."
  // Gives the exact number of performance cores (highest efficiency class) and how cores are split across
  // L3 caches (= CCDs on Ryzen). Works for every hybrid design without guessing from the model name.
  function parseCpuSets(str) {
    var parts = String(str || '').split(';'), cores = {}, list = [], i, p, k, maxEff = 0, minEff = 99, c, llc = {}, llcIds = [], threads = 0;
    for (i = 0; i < parts.length; i++) {
      p = parts[i].split(':');
      if (p.length < 4 || p[0] === '' || isNaN(parseInt(p[1], 10))) continue;
      threads++;
      k = p[0] + ':' + p[1];
      if (!cores[k]) { cores[k] = { id: k, eff: parseInt(p[2], 10) || 0, llc: p[0] + ':' + p[3], threads: 0 }; list.push(cores[k]); }
      cores[k].threads++;
    }
    if (!list.length) return null;
    for (i = 0; i < list.length; i++) {
      c = list[i];
      if (c.eff > maxEff) maxEff = c.eff;
      if (c.eff < minEff) minEff = c.eff;
    }
    var out = { cores: list.length, threads: threads, pcores: 0, ecores: 0, hybrid: maxEff !== minEff, ccdCount: 0, ccdCores: 0, map: [] };
    for (i = 0; i < list.length; i++) {
      c = list[i];
      c.p = c.eff === maxEff;
      if (c.p) out.pcores++; else out.ecores++;
      if (!llc.hasOwnProperty(c.llc)) { llc[c.llc] = 0; llcIds.push(c.llc); }
      llc[c.llc]++;
    }
    out.ccdCount = llcIds.length;
    for (i = 0; i < llcIds.length; i++) if (llc[llcIds[i]] > out.ccdCores) out.ccdCores = llc[llcIds[i]];
    for (i = 0; i < list.length; i++) {
      for (k = 0; k < llcIds.length; k++) if (llcIds[k] === list[i].llc) break;
      out.map.push({ p: list[i].p, ccd: k, smt: list[i].threads > 1 });
    }
    return out;
  }

  // Core Ultra 200 chips have no Hyper-Threading, so the thread count cannot reveal the P-core count.
  // Only used when Windows' own core report (parseCpuSets) was not available.
  function ultraPcores(name) {
    var m = /ultra\s*([3579])\s*(2\d\d)([a-z]*)/i.exec(name), n, s;
    if (!m) return 0;
    n = parseInt(m[2], 10); s = m[3].toLowerCase();
    if (s.indexOf('v') >= 0) return 4;                       // Lunar Lake: 4P + 4E
    if (s.indexOf('u') >= 0) return 2;                       // Arrow Lake U: 2P
    if (s.indexOf('h') >= 0) return n >= 255 ? 6 : 4;        // Arrow Lake H: 285H/255H 6P, 235H/225H 4P
    return n >= 265 ? 8 : 6;                                 // desktop: 285/265 8P, 245/235/225 6P
  }

  // Works out how many PERFORMANCE cores the CPU has.
  //  1. Windows' core report (topo), when available: exact for every CPU.
  //  2. Otherwise from WMI counts. Intel hybrid with Hyper-Threading: logical = 2P + E and cores = P + E, so P = logical - cores.
  function cpuAdvice(name, cores, logical, topo) {
    name = String(name || '');
    cores = parseInt(cores, 10) || 0;
    logical = parseInt(logical, 10) || 0;
    var intel = /intel/i.test(name), up;
    var res = { name: name, cores: cores, logical: logical, pcores: cores, ecores: 0, hybrid: false, confident: true, exact: false, ccdCount: 1, ccdCores: 0, map: null, note: '' };

    if (topo && topo.cores > 0) {
      res.exact = true;
      res.cores = topo.cores; res.pcores = topo.pcores; res.ecores = topo.ecores; res.hybrid = topo.hybrid;
      if (!res.logical) res.logical = topo.threads;
      res.ccdCount = topo.ccdCount; res.ccdCores = topo.ccdCount > 1 ? topo.ccdCores : 0; res.map = topo.map;
      if (res.hybrid) res.note = res.pcores + ' performance cores and ' + res.ecores + ' efficiency cores, read from Windows.';
      else if (res.ccdCores) res.note = res.cores + ' cores on ' + res.ccdCount + ' chiplets (' + res.ccdCores + ' cores each), read from Windows.';
      else res.note = res.cores + ' cores, read from Windows.';
      return res;
    }

    if (!cores) { res.confident = false; res.note = 'The processor could not be read. Enter the performance-core count under Settings, Advanced.'; return res; }
    if (intel) {
      if (logical > cores && logical < cores * 2) {
        res.hybrid = true;
        res.pcores = logical - cores; res.ecores = cores - res.pcores;
        res.note = res.pcores + ' performance cores and ' + res.ecores + ' efficiency cores.';
      } else if (logical === cores && (up = ultraPcores(name)) && up < cores) {
        res.hybrid = true;
        res.pcores = up; res.ecores = cores - up;
        res.note = 'Core Ultra: ' + up + ' performance cores and ' + res.ecores + ' efficiency cores.';
      } else if (logical === cores) {
        res.confident = false;
        res.note = 'This Intel CPU reports no Hyper-Threading. If it has efficiency cores, set the performance-core count under Settings, Advanced.';
      } else {
        res.note = cores + ' cores.';
      }
    } else {
      res.note = cores + ' cores.';
    }
    return res;
  }

  // Manual methods from Settings, Advanced. Capped at 8 (sources: 8 for 12+ core chips).
  function recommend(pcores, mode) {
    var n = Math.max(1, parseInt(pcores, 10) || 1);
    var base = Math.min(n, 8);
    if (mode === 'minus1') return Math.max(2, base - 1);
    return Math.max(2, base);
  }

  // Automatic pick (consensus of Hone / Fpstweak / Frozen Tweaks):
  //   Intel hybrid -> performance-core count; other CPUs -> cores minus 1;
  //   Ryzen with two chiplets -> no more than one chiplet's cores (Hone: "keeps threads on one CCD");
  //   never above 8, never below 2.
  function autoWorkers(pcores, hybrid, ccdCores) {
    var p = Math.max(1, parseInt(pcores, 10) || 1), n = hybrid ? p : p - 1, c = parseInt(ccdCores, 10) || 0;
    if (c > 0 && n > c) n = c;
    return Math.max(2, Math.min(8, n));
  }

  function clampToRange(value, range) {
    var v = parseFloat(value);
    if (!range || isNaN(v)) return value;
    if (v > range.max) return String(range.max);
    if (v < range.min) return String(range.min);
    return value;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(d) {
    d = d || new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  // ---------- hardware helpers ----------
  function classifyGpu(name) {
    name = String(name || '');
    var r = { vendor: 'unknown', integrated: false };
    if (/nvidia|geforce|\brtx\b|\bgtx\b|quadro/i.test(name)) r.vendor = 'nvidia';
    else if (/\bamd\b|radeon|\brx\s?\d/i.test(name)) {
      r.vendor = 'amd';
      if (!/\brx\s?\d|\bpro\b|\bxt\b/i.test(name) && /radeon(\(tm\))?\s+graphics|\d{3}m\b|vega/i.test(name)) r.integrated = true;
    } else if (/intel/i.test(name)) {
      r.vendor = 'intel';
      if (!/\barc\b/i.test(name)) r.integrated = true;
    }
    return r;
  }

  // Picks the card the game will most likely use: skip virtual adapters, prefer discrete, then most VRAM.
  function pickGpu(list) {
    var best = null, i, g, c, score, bestScore = -1;
    for (i = 0; i < (list || []).length; i++) {
      g = list[i];
      if (!g || !g.name || /microsoft|basic render|remote|virtual|parsec|displaylink|meta/i.test(g.name)) continue;
      c = classifyGpu(g.name);
      score = (c.integrated ? 0 : 1000000) + (g.vramGB || 0);
      if (score > bestScore) { bestScore = score; best = { name: g.name, vramGB: g.vramGB || 0, vendor: c.vendor, integrated: c.integrated, driver: g.driver || '' }; }
    }
    return best;
  }

  function bytesToGB(b) { b = parseFloat(b) || 0; return b > 0 ? Math.round(b / 1073741824 * 10) / 10 : 0; }

  // Low-VRAM tier: 8 GB or less (guides give separate numbers for these cards).
  function isLowVram(gb) { return gb > 0 && gb <= 8.5; }

  // In-game "VRAM Scale Target" percent maps to the VideoMemoryScale config value (single source: Atriarch).
  function vramScaleFor(gameId, low) { return ((low ? 70 : 80) / 100).toFixed(2); }

  // Numeric compare so "0.8" and "0.80" count as the same value.
  function sameValue(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return false;
    var x = parseFloat(a), y = parseFloat(b);
    if (!isNaN(x) && !isNaN(y) && /^-?\d+(\.\d+)?$/.test(String(a)) && /^-?\d+(\.\d+)?$/.test(String(b))) return Math.abs(x - y) < 1e-9;
    return String(a) === String(b);
  }

  function compareVersions(a, b) {
    function parts(v) { return String(v || '0').replace(/^v/i, '').split(/[.\-]/).map(function (x) { return parseInt(x, 10) || 0; }); }
    var x = parts(a), y = parts(b), i, n = Math.max(x.length, y.length);
    for (i = 0; i < n; i++) { if ((x[i] || 0) > (y[i] || 0)) return 1; if ((x[i] || 0) < (y[i] || 0)) return -1; }
    return 0;
  }

  function validRepo(r) { return /^[A-Za-z0-9_.\-]+\/[A-Za-z0-9_.\-]+$/.test(String(r || '')) && !/^YOUR-USER\//.test(r); }
  function trustedDownload(u) { return /^https:\/\/(github\.com|objects\.githubusercontent\.com|api\.github\.com)\//.test(String(u || '')); }

  function scaleMode(heightPx) { return heightPx >= 2160 ? 'Balanced' : 'Quality'; }

  return {
    KEY: KEY, VRAM_KEY: VRAM_KEY,
    findKey: findKey, hasKey: hasKey, getKey: getKey, setKey: setKey, inspect: inspect, isSettingsFile: isSettingsFile, gameCode: gameCode,
    parseCpuSets: parseCpuSets, cpuAdvice: cpuAdvice, recommend: recommend, autoWorkers: autoWorkers, clampToRange: clampToRange,
    classifyGpu: classifyGpu, pickGpu: pickGpu, bytesToGB: bytesToGB, isLowVram: isLowVram, vramScaleFor: vramScaleFor, sameValue: sameValue,
    compareVersions: compareVersions, validRepo: validRepo, trustedDownload: trustedDownload, scaleMode: scaleMode, stamp: stamp
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
