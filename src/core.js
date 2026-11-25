/* core.js - pure logic (ES5, no ActiveX). Unit-tested in node, inlined into the HTA at build time. */
var Core = (function () {
  var KEY = 'RendererWorkerCount';
  var VRAM_KEY = 'VideoMemoryScale';

  // Matches:  RendererWorkerCount = "8"   (also tolerates no spaces / single quotes / tabs)
  function keyRegex(key) {
    // group 1 = the character before the key, so "XRendererWorkerCount" can never match
    // tolerates:  Key = "8"   Key = 8   Key=8   "Key": "8",   (quotes kept exactly as the file has them)
    return new RegExp('(^|[^A-Za-z0-9_])(["\']?' + key + '["\']?[ \\t]*[=:][ \\t]*)(["\']?)([^"\'\\s,;]*)(["\']?)');
  }

  function hasKey(text, key) {
    return keyRegex(key || KEY).test(text);
  }

  function getKey(text, key) {
    var m = keyRegex(key || KEY).exec(text);
    return m ? m[4] : null;
  }

  // Replace only the value inside the quotes. Every other byte of the file is left untouched.
  function setKey(text, key, value) {
    key = key || KEY;
    var re = keyRegex(key);
    var m = re.exec(text);
    if (!m) return { text: text, found: false, changed: false, old: null };
    var old = m[4];
    var out = text.replace(re, function (all, pre, a, q1, v, q2) { return pre + a + q1 + String(value) + q2; });
    return { text: out, found: true, changed: old !== String(value), old: old };
  }

  // Work out how many PERFORMANCE cores a CPU has from what Windows WMI reports.
  //  - Intel hybrid (12th gen+ with Hyper-Threading): P-cores have 2 threads, E-cores have 1
  //        logical = 2P + E,  cores = P + E,  so  P = logical - cores
  //  - AMD / non-hybrid Intel: every core counts.
  //  - Intel with logical == cores is ambiguous (HT off, or a Core Ultra chip with no HT): ask the user.
  function cpuAdvice(name, cores, logical) {
    name = String(name || '');
    cores = parseInt(cores, 10) || 0;
    logical = parseInt(logical, 10) || 0;
    var intel = /intel/i.test(name);
    var res = { name: name, cores: cores, logical: logical, pcores: cores, hybrid: false, confident: true, note: '' };
    if (!cores) { res.confident = false; res.note = 'Could not read CPU info - enter your performance-core count manually.'; return res; }
    if (intel) {
      if (logical > cores && logical < cores * 2) {
        res.hybrid = true;
        res.pcores = logical - cores;
        res.note = 'Intel hybrid CPU detected: ' + res.pcores + ' performance cores + ' + (cores - res.pcores) + ' efficiency cores. Only performance cores are counted.';
      } else if (logical === cores && /core\s*\(?tm\)?\s*ultra\s*[579]\s*2\d\d/i.test(name)) {
        // Core Ultra 200 series (no Hyper-Threading): 9/7 have 8 performance cores, 5 has 6
        res.hybrid = true;
        res.pcores = /ultra\s*5/i.test(name) ? 6 : 8;
        res.note = 'Intel Core Ultra detected: ' + res.pcores + ' performance cores. Only performance cores are counted.';
      } else if (logical === cores) {
        res.confident = false;
        res.note = 'Intel CPU without Hyper-Threading reported. If yours has efficiency cores (e.g. Core Ultra), set the performance-core count by hand.';
      } else {
        res.note = 'Standard Intel CPU: ' + cores + ' physical cores.';
      }
    } else {
      res.note = 'Physical cores: ' + cores + ' (SMT threads are not counted).';
    }
    return res;
  }

  // Sources disagree between N and N-1, so both modes are offered. Capped at 8 (sources: 8 or 10 for 12+ core chips;
  // dual-CCD Ryzen advice is to stay inside one chiplet's worth of threads).
  function recommend(pcores, mode) {
    var n = Math.max(1, parseInt(pcores, 10) || 1);
    var base = Math.min(n, 8);
    if (mode === 'minus1') return Math.max(2, base - 1);
    return Math.max(2, base);
  }

  // Automatic pick used by the one-click button (consensus of Hone / Fpstweak / Frozen Tweaks):
  // Intel hybrid -> performance-core count, other CPUs -> cores minus 1, never above 8, never below 2.
  function autoWorkers(pcores, hybrid) {
    var p = Math.max(1, parseInt(pcores, 10) || 1);
    return Math.max(2, Math.min(8, hybrid ? p : p - 1));
  }

  function gameCode(fileName) {
    var m = /cod(\d\d)/i.exec(fileName);
    return m ? 'cod' + m[1] : null;
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
  function vramScaleFor(gameId, low) {
    return ((low ? 70 : 80) / 100).toFixed(2);
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

  return { VRAM_KEY: VRAM_KEY, classifyGpu: classifyGpu, pickGpu: pickGpu, bytesToGB: bytesToGB, isLowVram: isLowVram, vramScaleFor: vramScaleFor, compareVersions: compareVersions, validRepo: validRepo, trustedDownload: trustedDownload, scaleMode: scaleMode, KEY: KEY, hasKey: hasKey, getKey: getKey, setKey: setKey, cpuAdvice: cpuAdvice, recommend: recommend, autoWorkers: autoWorkers, gameCode: gameCode, stamp: stamp };
})();
if (typeof module !== 'undefined') module.exports = Core;
