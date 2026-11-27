/* ui.js - rendering and handlers. ES5, IE11-safe, ASCII only.
   Design rule: everything is one click and automatic; anything manual lives in Settings, Advanced. */
var UI = (function () {
  var S = {
    tab: 'home', vendor: 'nvidia', lowVram: false, ready: false, src: {}, firstHome: true,
    cpu: null, advice: null, topo: null, hw: null, scan: null, win: [], banner: null, keepBanner: false,
    upd: null, dl: null, checking: false, toastOff: false, lastFocus: 0,
    cfg: { lock: false, checkUpdates: true, applyVram: false, preset: 'fps', mode: 'auto', manualP: '', ticks: {}, applied: {}, autoReapply: true, topo: null, migrated13: false }
  };
  var ART = { wz: 'warzone', bo6: 'bo6', bo7: 'bo7', mw4: 'mw4' };
  // where to aim the crop so faces stay in frame and the artwork's own logo stays out of the title area
  var FOCAL = { wz: '50% 0%', bo6: '62% 8%', bo7: '50% 34%', mw4: '50% 72%' };
  var CARD_FOCAL = { wz: '0% 4%', bo6: '100% 12%', bo7: '42% 14%', mw4: '52% 78%' };
  var LOC = { docs: 'Documents', local: 'AppData' };
  var imgCache = {};

  // ---------- icons (original line icons) ----------
  function ico(path) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>'; }
  var I = {
    home: ico('<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
    win: ico('<rect x="3.5" y="4.5" width="17" height="12" rx="1.5"/><path d="M8 20h8M12 16.5V20"/>'),
    src: ico('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
    set: ico('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'),
    ext: ico('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    gh: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>'
  };
  // brand mark: a reticle (original artwork)
  var MARK = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="#dc372d" stroke-width="2"/><circle cx="16" cy="16" r="2.4" fill="#fff"/>' +
    '<path d="M16 1.5v7M16 23.5v7M1.5 16h7M23.5 16h7" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function game(id) { for (var i = 0; i < Data.GAMES.length; i++) if (Data.GAMES[i].id === id) return Data.GAMES[i]; return null; }
  function gameTitle(g) { return g.name.toLowerCase().replace(/(^|\s)([a-z])/g, function (a, s, c) { return s + c.toUpperCase(); }); }
  function save() { Sys.saveSettings(S.cfg); }
  function ctx() { return { vendor: S.vendor, lowVram: S.lowVram, hz: S.hw ? S.hw.display.hz : 0, h: S.hw ? S.hw.display.h : 0 }; }
  function img(name) { if (!imgCache.hasOwnProperty(name)) imgCache[name] = Sys.imageFor(name); return imgCache[name]; }
  function bgUrl(src) { return "url('" + src + "')"; }
  function btn(label, onclick, cls) { return '<button type="button" class="btn' + (cls ? ' ' + cls : '') + '" onclick="' + onclick + '">' + label + '</button>'; }
  function listJoin(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function cap(s) { s = String(s).toLowerCase(); return s.charAt(0).toUpperCase() + s.substr(1); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ---------- detection ----------
  function detect(fresh) {
    var sig, sets = '';
    S.cpu = Sys.cpu();
    // the exact core layout comes from Windows once per CPU and is remembered (it needs a short PowerShell run)
    sig = S.cpu.name + '|' + S.cpu.logical;
    if (!fresh && S.cfg.topo && S.cfg.topo.sig === sig && S.cfg.topo.sets) sets = S.cfg.topo.sets;
    else {
      sets = Sys.cpuSets();
      if (sets) { S.cfg.topo = { sig: sig, sets: sets }; save(); }
    }
    S.topo = sets ? Core.parseCpuSets(sets) : null;
    S.advice = Core.cpuAdvice(S.cpu.name, S.cpu.cores, S.cpu.logical, S.topo);
    S.hw = Sys.hardware();
    S.src = Sys.sources();
    if (S.src.cpu === 'estimate' && !S.topo) { S.advice.confident = false; S.advice.note = 'The core count could not be read exactly, so it was estimated. If it is wrong, set it under Settings, Advanced.'; }
    S.vendor = 'nvidia'; S.lowVram = false;
    if (S.hw.gpu) {
      if (S.hw.gpu.vendor !== 'unknown') S.vendor = S.hw.gpu.vendor;
      if (S.hw.gpu.vramGB > 0) S.lowVram = Core.isLowVram(S.hw.gpu.vramGB);
    }
    if (S.cfg.vendorOverride) S.vendor = S.cfg.vendorOverride;
    if (S.cfg.vramOverride) S.lowVram = S.cfg.vramOverride === 'lo';
    S.win = Sys.winChecks();
  }
  function rescan() { S.scan = Sys.scan(); }
  // Once, for people coming from 1.2: files changed by the old version have backups but no Undo record yet.
  // The record is rebuilt from the oldest backup, so Undo can still put the original value back.
  function migrate() {
    var f = (S.scan && S.scan.files) || [], i, o;
    if (S.cfg.migrated13) return;
    for (i = 0; i < f.length; i++) {
      if (!f[i].hasKey || S.cfg.applied[f[i].path] || !Sys.backupCount(f[i])) continue;
      o = Sys.originalValues(f[i]);
      if (o && o[Core.KEY] !== null && o[Core.KEY] !== undefined && !Core.sameValue(o[Core.KEY], f[i].value))
        S.cfg.applied[f[i].path] = { orig: (function (v) { var r = {}; r[Core.KEY] = v; return r; })(o[Core.KEY]), wasRO: false, wrote: String(f[i].value), at: '' };
    }
    S.cfg.migrated13 = true; save();
  }

  // ---------- plan: what one click will write ----------
  function pcores() { var p = parseInt(S.cfg.manualP, 10); return p > 0 ? p : S.advice.pcores; }
  function target() {
    var p = pcores();
    if (S.cfg.mode === 'minus1') return Core.recommend(p, 'minus1');
    if (S.cfg.mode === 'match') return Core.recommend(p, 'rec');
    return Core.autoWorkers(p, S.advice.hybrid, S.advice.ccdCores);
  }
  function vramTarget() { return Core.vramScaleFor('', S.lowVram); }
  function fileTarget(f) { return String(Core.clampToRange(String(target()), f.range)); }

  // Files for a game: the newest settings generation that has the key. Also reports files that exist without it.
  function filesFor(g) {
    var out = [], all = (S.scan && S.scan.files) || [], c, i, bare = [];
    if (!g.config) return { files: out, bare: bare };
    for (c = 0; c < g.codes.length && !out.length; c++) {
      for (i = 0; i < all.length; i++) {
        if (all[i].code !== g.codes[c]) continue;
        if (all[i].hasKey) out.push(all[i]); else bare.push(all[i]);
      }
    }
    return { files: out, bare: bare };
  }
  function pairsFor(f) {
    var pairs = [{ key: Core.KEY, value: target() }];
    if (S.cfg.applyVram && f.hasVram) pairs.push({ key: Core.VRAM_KEY, value: vramTarget() });
    return pairs;
  }
  // ok | needs | drift (this app set it, the game changed it back)
  function fileState(f) {
    var rec = S.cfg.applied[f.path], okW = Core.sameValue(f.value, fileTarget(f)) && f.consistent,
      okV = !(S.cfg.applyVram && f.hasVram) || Core.sameValue(f.vramValue, vramTarget());
    if (okW && okV) return 'ok';
    if (rec && rec.wrote !== undefined && !Core.sameValue(f.value, rec.wrote)) return 'drift';
    return 'needs';
  }
  // state: manual (no file tweak for this game) | nofile | nokey | ok | needs | drift
  function status(g) {
    var ff = filesFor(g), files = ff.files, i, st, drift = 0, needs = 0, undo = false;
    if (!g.config) return { state: 'manual', files: files };
    if (!files.length) return { state: ff.bare.length ? 'nokey' : 'nofile', files: files, bare: ff.bare };
    for (i = 0; i < files.length; i++) {
      st = fileState(files[i]);
      if (st === 'drift') drift++; else if (st === 'needs') needs++;
      if (S.cfg.applied[files[i].path]) undo = true;
    }
    return { state: drift ? 'drift' : (needs ? 'needs' : 'ok'), files: files, canUndo: undo };
  }
  var STATE = {
    ok: ['ok', 'Optimized'],
    needs: ['warn', 'Ready to optimize'],
    drift: ['warn', 'The game reset the value'],
    nofile: ['', 'Start the game once'],
    nokey: ['', 'Open the game\'s graphics menu once'],
    manual: ['', 'In-game settings only']
  };
  function dot(st) { return '<span class="sd ' + STATE[st][0] + '"></span>'; }

  // ---------- result message (what the last click did) ----------
  function setBanner(cls, msg, lines, undoId) { S.banner = { cls: cls, msg: msg, lines: lines || [], undo: undoId || null }; }
  function bannerHtml() {
    var b = S.banner, h, i;
    if (!b) return '';
    h = '<div class="res ' + b.cls + '" id="banner">';
    h += '<div class="rb">' + (b.undo ? btn('Undo', 'UI.undo(\'' + b.undo + '\')', 'sm') : '') + btn('Dismiss', 'UI.dismiss()', 'sm quiet') + '</div>';
    h += '<div class="rt">' + esc(b.msg) + '</div>';
    for (i = 0; i < b.lines.length && i < 12; i++) h += '<div class="ln' + (b.lines[i].mono ? ' mono' : '') + '">' + esc(b.lines[i].t || b.lines[i]) + '</div>';
    return h + '</div>';
  }
  function showBanner() { try { if ($('banner')) $('main').scrollTop = 0; } catch (e) { } }

  // ---------- sidebar ----------
  function sideHtml() {
    var logo = img('logo'), h = '<div class="brand">' + (logo ? '<img class="logo" src="' + logo + '" alt="">' : MARK) + '<h2>CoD Configurator</h2><span>Settings manager</span></div><div class="nav">', i, g, st, src, nWarn = 0;
    function item(id, icon, label, extra) {
      return '<button type="button" class="ni' + (S.tab === id ? ' on' : '') + '" onclick="UI.go(\'' + id + '\')" title="' + esc(label) + '">' + icon + '<span class="lbl">' + label + '</span>' + (extra || '') + '</button>';
    }
    h += item('home', '<span class="ic glyph">' + I.home + '</span>', 'Home');
    h += '<div class="nav-h">Games</div>';
    for (i = 0; i < Data.GAMES.length; i++) {
      g = Data.GAMES[i]; src = img(ART[g.id]); st = S.ready ? status(g).state : null;
      h += item(g.id, '<span class="ic" style="' + (src ? 'background-image:' + bgUrl(src) + ';background-position:' + CARD_FOCAL[g.id] : '') + '"></span>', gameTitle(g),
        st ? dot(st) : '');
    }
    h += '<div class="nav-h">Tools</div>';
    for (i = 0; i < S.win.length; i++) if (S.win[i].state === 'warn') nWarn++;
    h += item('windows', '<span class="ic glyph">' + I.win + '</span>', 'Windows check', S.ready && nWarn ? '<span class="badge">' + nWarn + '</span>' : '');
    h += item('about', '<span class="ic glyph">' + I.src + '</span>', 'Sources and safety');
    h += item('settings', '<span class="ic glyph">' + I.set + '</span>', 'Settings', S.upd && S.upd.ok && S.upd.newer ? '<span class="sd bad"></span>' : '');
    h += '</div><div class="side-foot">';
    if (S.ready) {
      h += '<div class="sf-l">This PC</div><div class="sf-v" title="' + esc(S.cpu.name) + '">' + esc(shortCpu(S.cpu.name) || 'Processor not read') + '</div>' +
        '<div class="sf-v" title="' + esc(S.hw.gpu ? S.hw.gpu.name : '') + '">' + esc(S.hw.gpu ? shortGpu(S.hw.gpu.name) : 'Graphics not read') + '</div>';
    } else h += '<div class="sf-l">This PC</div><div class="sf-v"><span class="spin"></span>Reading hardware</div>';
    return h + '</div>';
  }
  function shortCpu(n) { return String(n || '').replace(/\(R\)|\(TM\)|\bCPU\b|\bProcessor\b|@.*$/gi, '').replace(/\d+th Gen /i, '').replace(/\b\d+-Core\b/i, '').replace(/Intel Core/i, 'Intel Core').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''); }
  function shortGpu(n) { return String(n || '').replace(/\(R\)|\(TM\)/gi, '').replace(/NVIDIA GeForce /i, 'GeForce ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''); }

  // ---------- home ----------
  function homeSummary() {
    var i, st, needs = [], drift = [], ok = 0, none = 0, cfg = 0;
    for (i = 0; i < Data.GAMES.length; i++) {
      if (!Data.GAMES[i].config) continue;
      cfg++; st = status(Data.GAMES[i]).state;
      if (st === 'needs') needs.push(gameTitle(Data.GAMES[i]));
      else if (st === 'drift') drift.push(gameTitle(Data.GAMES[i]));
      else if (st === 'ok') ok++;
      else none++;
    }
    if (drift.length) return { t: listJoin(drift) + (drift.length === 1 ? ' reset its' : ' reset their') + ' render threads', act: true };
    if (needs.length) return { t: (needs.length === cfg ? 'Your games are' : plural(needs.length, 'game is', 'games are')) + ' ready to optimize', act: true };
    if (ok && ok + none === cfg && !none) return { t: 'Every game is optimized', act: false };
    if (ok) return { t: plural(ok, 'game', 'games') + ' optimized', act: false, sub: 'Start the other games once so their settings files exist, then press Re-check.' };
    return { t: 'Start a game once to begin', act: false, sub: 'The settings files appear after a game reaches its main menu for the first time. Close the game, then press Re-check.' };
  }

  function coreMap() {
    var a = S.advice, n = target(), map = a.map, i, ccds = [], c, used = 0, h, groups = 0, k, anim = S.firstHome, delay = 0;
    if (!map) {
      map = [];
      for (i = 0; i < a.pcores; i++) map.push({ p: true, ccd: 0 });
      for (i = 0; i < Math.max(0, a.cores - a.pcores); i++) map.push({ p: false, ccd: 0 });
    }
    for (i = 0; i < map.length; i++) { c = map[i].ccd || 0; if (!ccds[c]) { ccds[c] = []; groups++; } ccds[c].push(map[i]); }
    // performance cores first inside each chiplet
    for (k = 0; k < ccds.length; k++) if (ccds[k]) ccds[k].sort(function (x, y) { return (y.p ? 1 : 0) - (x.p ? 1 : 0); });
    // count which cells light up: performance cores in order, spilling into efficiency cores only if a manual count asks for it
    var lit = {}, need = n;
    for (k = 0; k < ccds.length && need > 0; k++) for (i = 0; ccds[k] && i < ccds[k].length && need > 0; i++) if (ccds[k][i].p) { lit[k + ':' + i] = 1; need--; }
    for (k = 0; k < ccds.length && need > 0; k++) for (i = 0; ccds[k] && i < ccds[k].length && need > 0; i++) if (!lit[k + ':' + i]) { lit[k + ':' + i] = 1; need--; }

    h = '<div class="cm"><div class="cm-num"><b class="num">' + n + '</b><span>render threads</span><span class="mono">' + Core.KEY + '</span></div><div class="cm-grid">';
    for (k = 0; k < ccds.length; k++) {
      if (!ccds[k]) continue;
      h += '<div class="ccd' + (groups > 1 ? '' : ' solo') + '">' + (groups > 1 ? '<div class="ccd-l">Chiplet ' + (k + 1) + '</div>' : '') + '<div class="cores">';
      for (i = 0; i < ccds[k].length; i++) {
        var on = !!lit[k + ':' + i];
        h += '<span class="core' + (ccds[k][i].p ? '' : ' e') + (on ? ' use' + (anim ? ' anim' : '') : '') + '"' + (on && anim ? ' style="animation-delay:' + (delay++ * 45) + 'ms"' : '') + '></span>';
      }
      h += '</div></div>';
    }
    h += '<div class="legend"><span><i class="use"></i>Render worker threads</span><span><i></i>' + (a.hybrid ? 'Performance core' : 'Core') + '</span>' + (a.hybrid ? '<span><i class="e"></i>Efficiency core</span>' : '') + '</div>';
    h += '</div></div>';

    var why;
    if (S.cfg.mode !== 'auto' || parseInt(S.cfg.manualP, 10) > 0) why = 'Set by you under Settings, Advanced.';
    else if (a.hybrid) why = '<b>One thread per performance core.</b> Efficiency cores are left for Windows, voice chat and the launcher.';
    else if (a.ccdCores && n >= a.ccdCores) why = '<b>Kept to one chiplet.</b> Your CPU has ' + a.ccdCount + ' chiplets with their own cache; staying on one avoids slow cross-chiplet hops.';
    else if (n === 8 && a.pcores > 9) why = '<b>Capped at 8.</b> Guides agree more render threads than this adds stutter, not frames.';
    else why = '<b>Cores minus one.</b> One core stays free for the game\'s main thread.';
    h += '<div class="cm-why">' + why + ' The grid shows how many threads the game creates; Windows decides which cores run them.' +
      (a.confident ? '' : '<div class="note warn">' + esc(a.note) + '</div>') + '</div>';
    return h;
  }

  function hwReadout() {
    var hw = S.hw, g = hw.gpu, d = hw.display, a = S.advice, h = '';
    function kv(k, v, sub) { return '<div class="kv"><b>' + k + '</b><span>' + v + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</span></div>'; }
    h += kv('Processor', esc(shortCpu(S.cpu.name) || 'Not read'), S.cpu.cores ? a.cores + ' cores, ' + (a.logical || S.cpu.logical) + ' threads' + (a.hybrid ? ' (' + a.pcores + 'P + ' + a.ecores + 'E)' : '') : 'Press Re-check, or set it in Settings');
    h += kv('Graphics', esc(g ? shortGpu(g.name) : 'Not read'), g ? (g.vramGB ? g.vramGB + ' GB video memory' : 'Video memory unknown') + (g.integrated ? ', integrated' : '') : '');
    h += kv('Display', d.w ? d.w + ' x ' + d.h + (d.hz ? ' at ' + d.hz + ' Hz' : '') : 'Not read', d.hz ? '' : 'Refresh rate not reported. Use your monitor\'s highest.');
    h += kv('Memory', hw.ramGB ? hw.ramGB + ' GB' : 'Not read');
    h += kv('Windows', esc(String(hw.os || 'Not read').replace(/^Microsoft /, '')));
    return h;
  }

  function gameCard(g) {
    var st = status(g), src = img(ART[g.id]), f = st.files[0], h;
    h = '<div class="gc-w"><div class="gc" onclick="UI.go(\'' + g.id + '\')">';
    h += '<div class="gc-art"' + (src ? ' style="background-image:' + bgUrl(src) + ';background-position:' + CARD_FOCAL[g.id] + '"' : '') + '><div class="sh"></div><h3 class="disp">' + esc(g.name) + '</h3></div>';
    h += '<div class="gc-b"><div class="gc-st">' + dot(st.state) + STATE[st.state][1] + '</div><div class="gc-v">';
    if (st.state === 'ok') h += '<span class="num">' + esc(f.value) + '</span> render threads';
    else if (st.state === 'needs' || st.state === 'drift') h += '<span class="num">' + esc(f.value) + '</span><span class="ar">to</span><span class="num red">' + fileTarget(f) + '</span>';
    else if (st.state === 'manual') h += 'Checklist for the in-game menu';
    else if (st.state === 'nokey') h += 'The file has no render-thread line yet';
    else h += 'No settings file yet';
    h += '</div></div><div class="gc-a">';
    if (st.state === 'needs' || st.state === 'drift') h += btn(st.state === 'drift' ? 'Re-apply' : 'Optimize', 'event.cancelBubble=true;UI.optimizeGame(\'' + g.id + '\')', 'sm pri');
    else if (st.state === 'ok' && st.canUndo) h += btn('Undo', 'event.cancelBubble=true;UI.undo(\'' + g.id + '\')', 'sm');
    h += btn(st.state === 'manual' ? 'Open checklist' : 'Details', 'event.cancelBubble=true;UI.go(\'' + g.id + '\')', 'sm quiet');
    return h + '</div></div></div>';
  }

  function winSummary() {
    var i, ok = 0, warn = 0;
    for (i = 0; i < S.win.length; i++) { if (S.win[i].state === 'ok') ok++; else if (S.win[i].state === 'warn') warn++; }
    return '<div class="panel strip"><div class="acts">' + btn(warn ? 'Review' : 'Open', 'UI.go(\'windows\')', 'sm') + '</div><div class="st-t"><b>Windows check</b>' +
      '<span class="sd ok"></span>' + ok + ' look good' + (warn ? '<span class="sd warn"></span>' + plural(warn, 'thing', 'things') + ' worth a look' : '') + '</div></div>';
  }

  function homeView() {
    var sum = homeSummary(), h = '', i, cfgGames = 0;
    for (i = 0; i < Data.GAMES.length; i++) if (Data.GAMES[i].config) cfgGames++;
    h += '<div class="ph cf"><div class="acts">' + btn('Re-check', 'UI.redetect()', 'lg') + (sum.act ? btn('Optimize all games', 'UI.optimizeAll()', 'pri lg') : '') + '</div>' +
      '<h1>' + esc(sum.t) + '</h1><p>' + esc(sum.sub || 'Writes the best render-thread count for your CPU into each game\'s settings file. Every file is backed up first, and Undo puts the old value back.') + '</p></div>';
    h += bannerHtml();
    h += '<div class="rowwrap wrap"><div class="row wrap"><div class="cell panel" style="width:62%"><div class="pt">Render threads for your CPU</div><div class="ps">' + esc(S.advice.exact ? 'Core layout read from Windows.' : 'Core layout worked out from the core and thread count.') + '</div>' + coreMap() + '</div>' +
      '<div class="cell panel"><div class="pt">This PC</div><div class="ps">Read with built-in Windows queries. No driver is loaded.</div>' + hwReadout() + '</div></div></div>';
    h += '<div class="games">';
    for (i = 0; i < Data.GAMES.length; i++) h += gameCard(Data.GAMES[i]);
    h += '</div>' + winSummary();
    S.firstHome = false;
    return h;
  }

  // ---------- game page ----------
  function gameBanner(g) {
    var st = status(g), src = img(ART[g.id]), h = '<div class="gb">';
    if (src) h += '<div class="gb-img" style="background-image:' + bgUrl(src) + ';background-position:' + FOCAL[g.id] + '"></div>';
    h += '<div class="gb-sh"></div><div class="gb-sh2"></div><div class="gb-in"><div class="acts">';
    if (st.state === 'needs' || st.state === 'drift') h += btn(st.state === 'drift' ? 'Re-apply' : 'Optimize', 'UI.optimizeGame(\'' + g.id + '\')', 'pri lg');
    else if (st.state === 'ok' && st.canUndo) h += btn('Undo', 'UI.undo(\'' + g.id + '\')', 'lg');
    h += '</div><h1>' + esc(g.name) + '</h1><div class="tag">' + dot(st.state) + STATE[st.state][1] + '<span class="sep"></span>' + esc(g.tag) + '</div></div></div>';
    return h;
  }

  function tweakCard(g) {
    var st = status(g), h = '<div class="panel">', i, f, t, fs;
    if (!g.config) {
      return h + '<div class="pt">Settings file</div><div class="note">' + esc(g.configNote) + '</div></div>';
    }
    h += '<div class="pt">Settings file</div><div class="ps">Sets <span class="mono">' + Core.KEY + '</span> to <b class="red">' + target() + '</b> for ' + esc(shortCpu(S.cpu.name) || 'your CPU') + '. ' + esc(g.blurb) + '</div>';
    if (st.state === 'nofile') h += '<div class="note warn">No settings file for this game yet. Start the game, reach the main menu, close it, then press Re-check.</div>';
    else if (st.state === 'nokey') {
      h += '<div class="note warn">Found ' + plural(st.bare.length, 'settings file', 'settings files') + ' for this game, but without the render-thread line. Start the game, open the graphics settings once, close the game, then press Re-check.</div>';
    } else {
      h += '<div class="fl">';
      for (i = 0; i < st.files.length; i++) {
        f = st.files[i]; t = fileTarget(f); fs = fileState(f);
        h += '<div class="fr"><div class="fv">' + (fs === 'ok' ? '<span class="num">' + esc(f.value) + '</span> <span class="done">set</span>' : '<span class="num">' + esc(f.value) + '</span><span class="ar">to</span><span class="num red">' + t + '</span>') + '</div>' +
          '<div class="fn mono">' + esc(f.name) + '</div><div class="fm">' + (LOC[f.loc] || '') + (f.sub ? ' \\ ' + esc(f.sub) : '') +
          (f.range ? '<span class="tagl">allowed ' + f.range.min + ' to ' + f.range.max + '</span>' : '') + (f.count > 1 ? '<span class="tagl">' + f.count + ' copies</span>' : '') +
          (f.ro ? '<span class="tagl">read-only</span>' : '') + (fs === 'drift' ? '<span class="tagl">reset by the game</span>' : '') + '</div></div>';
      }
      h += '</div>';
      if (S.cfg.applyVram) h += '<div class="small muted" style="margin-top:10px">Also sets ' + Core.VRAM_KEY + ' to ' + vramTarget() + ' where the file has it.</div>';
    }
    h += '<div class="btn-row">';
    if (st.state === 'needs' || st.state === 'drift') h += btn(st.state === 'drift' ? 'Re-apply' : 'Optimize', 'UI.optimizeGame(\'' + g.id + '\')', 'pri');
    if (st.canUndo) h += btn('Undo', 'UI.undo(\'' + g.id + '\')');
    h += btn('Re-check', 'UI.redetect()', 'quiet') + '</div>';
    h += '<div class="small dim" style="margin-top:14px">Guides differ by one on the exact number, so judge by your 1% lows. Undo changes the value back and leaves your other settings alone.</div>';
    return h + '</div>';
  }

  // Modern Warfare 4 only has a Best FPS list for now.
  function presetFor(g) { var p = S.cfg.preset; if (g && g.id === 'mw4') return 'fps'; return p === 'balanced' ? 'balanced' : 'fps'; }
  function tickKey(g, r) { return g.id + '|' + presetFor(g) + '|' + r.setting; }
  function checklistCard(g) {
    var pk = presetFor(g), rows = Data.rows(g, pk, ctx()), h = '', i, last = '', r, done = 0, p = Data.PRESETS[pk], gp = S.hw.gpu, pct, on;
    for (i = 0; i < rows.length; i++) if (S.cfg.ticks[tickKey(g, rows[i])]) done++;
    pct = rows.length ? Math.round(done * 100 / rows.length) : 0;
    h += '<div class="panel"><div class="ck-head">';
    if (g.id !== 'mw4') h += '<div class="seg"><button type="button" class="' + (pk === 'fps' ? 'on' : '') + '" onclick="UI.setPreset(\'fps\')">Best FPS</button><button type="button" class="' + (pk === 'balanced' ? 'on' : '') + '" onclick="UI.setPreset(\'balanced\')">Balanced</button></div>';
    h += '<div class="pt">In-game checklist</div><div class="ps" style="margin:0">' + esc(p.blurb) + '</div></div>';
    if (gp) h += '<div class="small muted" style="margin:-4px 0 14px 0">Matched to ' + esc(shortGpu(gp.name)) + (gp.vramGB ? ' with ' + gp.vramGB + ' GB' : '') + (S.hw.display.hz ? ' on a ' + S.hw.display.h + 'p ' + S.hw.display.hz + ' Hz display' : '') + '.</div>';
    h += '<div class="prog-l"><span class="r" id="pcount">' + done + ' of ' + rows.length + ' set</span>Tick each setting as you change it in the game</div><div class="prog"><i id="pbar" style="width:' + pct + '%"></i></div>';
    h += '<table class="st"><colgroup><col class="c-tk"><col class="c-s"><col class="c-v"><col></colgroup><tr><th></th><th>Setting</th><th>Set to</th><th>Why</th></tr>';
    for (i = 0; i < rows.length; i++) {
      r = rows[i]; on = !!S.cfg.ticks[tickKey(g, r)];
      if (r.group !== last) { h += '<tr class="grp"><td colspan="4">' + esc(cap(r.group)) + '</td></tr>'; last = r.group; }
      h += '<tr id="r' + i + '" class="item' + (on ? ' done' : '') + '" onclick="UI.tick(' + i + ')"><td class="tk"><button type="button" class="bx" aria-label="Done" onclick="event.cancelBubble=true;UI.tick(' + i + ')">&#10003;</button></td><td class="s">' + esc(r.setting) + '</td><td class="v">' + esc(r.value) + '</td><td class="n">' + esc(r.note) + '</td></tr>';
    }
    h += '</table><div class="btn-row">' + btn('Copy as text', 'UI.copyPreset()', 'sm') + btn('Clear ticks', 'UI.clearTicks()', 'sm quiet') + '</div>';
    return h + '</div>';
  }

  function sourcesBlock(g, withTitle) {
    var h = '<div class="panel">' + (withTitle ? '<div class="pt">' + esc(gameTitle(g)) + '</div>' : '<div class="pt">Sources</div>') + '<div class="ps">' + esc(g.sourceNote) + '</div>', i;
    for (i = 0; i < g.sources.length; i++) h += '<a class="src" onclick="UI.open(\'' + g.sources[i][1] + '\')">' + esc(g.sources[i][0]) + I.ext + '</a>';
    return h + '</div>';
  }

  function gameView(g) {
    return gameBanner(g) + bannerHtml() +
      '<div class="rowwrap wrap"><div class="row wrap"><div class="cell stack" style="width:39%">' + tweakCard(g) + sourcesBlock(g) + '</div>' +
      '<div class="cell stack" id="presets">' + checklistCard(g) + '</div></div></div>';
  }

  // ---------- windows check ----------
  function windowsView() {
    var h = '<div class="ph cf"><div class="acts">' + btn('Re-check', 'UI.redetect()') + '</div><h1>Windows check</h1><p>Settings the guides mention, read from Windows. Nothing here is changed by this app. Open takes you to the right Windows page.</p></div>', i, w;
    h += bannerHtml() + '<div class="panel"><table class="wc">';
    if (!S.win.length) h += '<tr><td class="t">Nothing could be read on this PC.</td></tr>';
    for (i = 0; i < S.win.length; i++) {
      w = S.win[i];
      h += '<tr><td class="l">' + esc(w.label) + '</td><td class="s"><span class="stt ' + (w.state === 'ok' ? 'ok' : (w.state === 'warn' ? 'warn' : '')) + '"><span class="sd ' + (w.state === 'ok' ? 'ok' : (w.state === 'warn' ? 'warn' : '')) + '"></span>' +
        (w.state === 'ok' ? 'Good' : (w.state === 'warn' ? 'Worth a look' : 'For info')) + '</span></td><td class="t">' + esc(w.text) + '</td><td class="a">' + (w.open ? btn('Open', 'UI.openSetting(\'' + w.open + '\')', 'sm') : '') + '</td></tr>';
    }
    return h + '</table></div>';
  }

  // ---------- settings ----------
  function updateCard() {
    var u = S.upd, ready = Core.validRepo(Config.REPO), h = '<div class="panel"><div class="pt">Updates</div><div class="ps">Installed version ' + Data.VERSION + (u && u.ok ? '. Latest on GitHub ' + esc(String(u.tag).replace(/^v/i, '')) + '.' : '.') + '</div>';
    if (!ready) return h + '<div class="note warn">Update checks are not set up in this build.</div></div>';
    h += btn(I.gh + (S.checking ? 'Checking' : 'Check for updates'), 'UI.checkUpdate(false)', S.checking ? 'off' : '');
    if (u) {
      if (!u.ok) h += '<div class="note warn">' + esc(u.error) + '</div>';
      else if (u.newer) {
        h += '<div class="note"><b style="color:#fff">' + esc(u.tag) + ' is available</b>' + (u.name ? ': ' + esc(u.name) : '') + '<div class="small" style="margin-top:8px;white-space:pre-wrap">' + esc(u.body.length > 700 ? u.body.substr(0, 700) + '...' : u.body) + '</div></div><div class="btn-row">';
        if (u.assetUrl) h += btn('Download update', 'UI.downloadUpdate()', 'pri');
        h += btn('Release notes', 'UI.open(\'' + esc(u.url) + '\')', 'quiet') + '</div>';
        if (S.dl) h += '<div class="note">' + (S.dl.ok ? 'Saved as <span class="mono">' + esc(S.dl.path) + '</span>. Close this window and open the new file. Your settings and backups carry over. <a class="src" style="border:0;padding:6px 0 0 0" onclick="UI.showDl()">Show in folder</a>' : esc(S.dl.error)) + '</div>';
      } else h += '<div class="note">You have the latest version.</div>';
    }
    h += '<label class="chk"><input type="checkbox" ' + (S.cfg.checkUpdates ? 'checked ' : '') + 'onclick="UI.setCheckUpdates(this.checked)">Check for updates when the app starts<span class="dim">Nothing is installed automatically. A new version is only downloaded when you press the button.</span></label>';
    return h + '</div>';
  }

  function detectCard() {
    var d = S.hw.display, g = S.hw.gpu, log = Sys.detectLog(), i, h = '<div class="panel"><div class="pt">Detection</div><div class="ps">What the app read, and how.</div>', a = S.advice;
    function via(k) { var s = S.src && S.src[k]; return s && s !== 'none' && s !== 'preview' ? '<span class="sub">via ' + esc(s) + '</span>' : ''; }
    h += '<div class="kv"><b>Processor</b><span>' + esc(S.cpu.name || 'not found') + (S.cpu.cores ? '<span class="sub">' + a.cores + ' cores, ' + (a.logical || S.cpu.logical) + ' threads, ' + a.pcores + ' performance cores' + (a.ccdCores ? ', ' + a.ccdCount + ' chiplets' : '') + (a.exact ? ' (layout from Windows)' : ' (estimated layout)') + '</span>' : '') + via('cpu') + '</span></div>';
    h += '<div class="kv"><b>Graphics</b><span>' + (g ? esc(g.name) + (g.vramGB ? ', ' + g.vramGB + ' GB' : '') : 'not found') + via('gpu') + '</span></div>';
    h += '<div class="kv"><b>Display</b><span>' + (d.w ? d.w + ' x ' + d.h + (d.hz ? ' at ' + d.hz + ' Hz' : ', refresh rate not reported') : 'not found') + via('display') + '</span></div>';
    h += '<div class="kv"><b>Memory</b><span>' + (S.hw.ramGB ? S.hw.ramGB + ' GB' : 'not found') + via('ram') + '</span></div>';
    h += '<div class="kv"><b>Windows</b><span>' + esc(S.hw.os || 'not found') + via('os') + '</span></div>';
    h += '<div class="kv"><b>Settings files</b><span>' + plural((S.scan && S.scan.files.length) || 0, 'file', 'files') + ' found' + (S.scan && S.scan.unreadable ? ', ' + S.scan.unreadable + ' not plain text (left alone)' : '') + (S.scan && S.scan.error ? '<span class="sub">' + esc(S.scan.error) + '</span>' : '') + '</span></div>';
    if (log.length) { h += '<div class="small muted" style="margin-top:12px">Notes from the last check</div>'; for (i = 0; i < log.length && i < 8; i++) h += '<div class="small mono dim">' + esc(log[i]) + '</div>'; }
    h += '<div class="btn-row">' + btn('Re-check', 'UI.redetect()', 'sm') + btn('Copy report', 'UI.diag()', 'sm quiet') + '</div>';
    return h + '</div>';
  }

  function opt(v, cur, label) { return '<option value="' + v + '"' + (String(cur || '') === v ? ' selected' : '') + '>' + label + '</option>'; }
  function advancedCard() {
    var g = S.hw.gpu, h = '<div class="panel"><div class="pt">Advanced</div><div class="ps">Everything is detected for you. Change these only if something was read wrong.</div>';
    h += '<div class="two"><div><label class="fl-l">Graphics maker</label><select onchange="UI.setVendor(this.value)">' +
      opt('', S.cfg.vendorOverride, 'Auto (' + (g ? esc(g.vendor === 'nvidia' ? 'NVIDIA' : (g.vendor === 'amd' ? 'AMD' : (g.vendor === 'intel' ? 'Intel' : 'unknown'))) : 'unknown') + ')') +
      opt('nvidia', S.cfg.vendorOverride, 'NVIDIA') + opt('amd', S.cfg.vendorOverride, 'AMD') + opt('intel', S.cfg.vendorOverride, 'Intel Arc') + '</select></div>' +
      '<div><label class="fl-l">Video memory</label><select onchange="UI.setVram(this.value)">' +
      opt('', S.cfg.vramOverride, 'Auto (' + (g && g.vramGB ? g.vramGB + ' GB' : 'unknown') + ')') + opt('hi', S.cfg.vramOverride, '10 GB or more') + opt('lo', S.cfg.vramOverride, '8 GB or less') + '</select></div></div>';
    h += '<div class="two"><div><label class="fl-l">Render-thread method</label><select onchange="UI.setMode(this.value)">' +
      opt('auto', S.cfg.mode, 'Auto (recommended)') + opt('match', S.cfg.mode, 'Match performance cores') + opt('minus1', S.cfg.mode, 'Cores minus 1') + '</select></div>' +
      '<div><label class="fl-l">Performance cores (blank = auto)</label><input type="number" min="1" max="64" value="' + esc(S.cfg.manualP) + '" placeholder="' + S.advice.pcores + '" onchange="UI.setP(this.value)"></div></div>';
    h += '<div class="small muted" style="margin-top:10px">Will write ' + Core.KEY + ' = <b style="color:#fff">' + target() + '</b>.</div>';
    h += '<div class="sep-h"></div>';
    h += '<label class="chk"><input type="checkbox" ' + (S.cfg.autoReapply ? 'checked ' : '') + 'onclick="UI.setAutoReapply(this.checked)">Put the value back automatically when the game resets it<span class="dim">Checked when the app opens and when you switch back to it. Recommended.</span></label>';
    h += '<label class="chk"><input type="checkbox" ' + (S.cfg.lock ? 'checked ' : '') + 'onclick="UI.setLock(this.checked)">Make the files read-only after applying<span class="dim">The game then cannot save any menu change either.</span></label>';
    h += '<label class="chk"><input type="checkbox" ' + (S.cfg.applyVram ? 'checked ' : '') + 'onclick="UI.setApplyVram(this.checked)">Also set ' + Core.VRAM_KEY + ' (' + vramTarget() + ')<span class="dim">Named by one source only.</span></label>';
    h += '<div class="btn-row">' + btn('Settings folder', 'UI.openFolder(\'\')', 'sm') + btn('Backups folder', 'UI.openFolder(\'backups\')', 'sm') + btn('Restore last full backup', 'UI.restoreFull()', 'sm quiet') + '</div>';
    return h + '</div>';
  }

  function artCard() {
    var names = [['logo', 'App logo, top left (png with a transparent background)'], ['warzone', 'Warzone'], ['bo6', 'Black Ops 6'], ['bo7', 'Black Ops 7'], ['mw4', 'Modern Warfare 4']], i, h;
    h = '<div class="panel"><div class="pt">Artwork</div><div class="ps">Game pictures load from the assets folder next to the app. Replace any with your own wide jpg or png under the same name.</div>';
    for (i = 0; i < names.length; i++) h += '<div class="kv"><b class="mono">' + names[i][0] + (names[i][0] === 'logo' ? '.png' : '.jpg') + '</b><span>' + names[i][1] + '<span class="sub">' + (Sys.imageFor(names[i][0]) ? 'In use' : (names[i][0] === 'logo' ? 'Missing, the built-in mark is shown' : 'Missing, a plain panel is shown')) + '</span></span></div>';
    h += '<div class="btn-row">' + btn('Open art folder', 'UI.openAssets()', 'sm') + btn('Reload pictures', 'UI.refreshArt()', 'sm quiet') + '</div>';
    return h + '<div class="small dim" style="margin-top:16px">Your app settings are saved in %APPDATA%\\CoDConfigurator\\settings.json.</div></div>';
  }

  function settingsView() {
    return '<div class="ph"><h1>Settings</h1></div>' + bannerHtml() +
      '<div class="rowwrap wrap"><div class="row wrap"><div class="cell stack">' + updateCard() + detectCard() + '</div><div class="cell stack">' + advancedCard() + artCard() + '</div></div></div>';
  }

  function aboutView() {
    var h = '<div class="ph"><h1>Sources and safety</h1><p>Every claim found while researching, marked with how well it holds up. Guides are written articles from gaming outlets, fetched November 2026.</p></div>', i, f, k;
    h += '<div class="rowwrap wrap"><div class="row wrap"><div class="cell stack" style="width:60%"><div class="panel"><div class="pt">Fact check</div><div class="ps">What the app does with each claim.</div>';
    for (i = 0; i < Data.FACTCHECK.length; i++) {
      f = Data.FACTCHECK[i];
      k = f[0] === 'VERIFIED' ? 'ok' : (f[0] === 'SAFETY' ? '' : 'warn');
      h += '<div class="fc"><span class="tg ' + k + '">' + esc(cap(f[0])) + '</span><div class="ft">' + esc(f[1]) + '</div><div class="fd">' + esc(f[2]) + '</div></div>';
    }
    h += '</div></div><div class="cell stack"><div class="panel"><div class="pt">Where things live</div><div class="ps">Nothing outside these folders is touched.</div>';
    h += '<div class="kv"><b>Settings files</b><span>Documents\\Call of Duty\\players<span class="sub">and %LOCALAPPDATA%\\Activision\\Call of Duty\\players</span></span></div>';
    h += '<div class="kv"><b>Backups</b><span style="word-wrap:break-word">' + esc(Sys.backupFolder()) + '<span class="sub">The original and the 10 newest per file are kept</span></span></div>';
    h += '<div class="btn-row">' + btn('Settings folder', 'UI.openFolder(\'\')', 'sm') + btn('Backups', 'UI.openFolder(\'backups\')', 'sm') + '</div></div>';
    for (i = 0; i < Data.GAMES.length; i++) h += sourcesBlock(Data.GAMES[i], true);
    return h + '</div></div></div>';
  }

  function loadingView() {
    return '<div class="ph"><h1><span class="spin"></span>Checking your PC</h1><p>Reading your processor, graphics card and the games\' settings files. The first start takes a few seconds.</p></div>' +
      '<div class="rowwrap"><div class="row"><div class="cell panel" style="width:62%"><div class="skel" style="width:40%"></div><div class="skel" style="width:70%"></div><div class="skel" style="width:55%"></div></div><div class="cell panel"><div class="skel" style="width:60%"></div><div class="skel"></div><div class="skel" style="width:80%"></div></div></div></div>';
  }

  // ---------- render ----------
  function renderSide() { $('side').innerHTML = sideHtml(); }
  function renderPage() {
    var g = game(S.tab), html;
    if (!S.ready) html = loadingView();
    else if (S.tab === 'home') html = homeView();
    else if (S.tab === 'settings') html = settingsView();
    else if (S.tab === 'about') html = aboutView();
    else if (S.tab === 'windows') html = windowsView();
    else if (g) html = gameView(g);
    else html = homeView();
    $('page').innerHTML = html + '<div class="footer">Changes one value in your own settings files. Never touches the game, its memory or its install folder. Not affiliated with Activision.</div>';
  }
  function renderToast() {
    var u = S.upd;
    $('toast').innerHTML = (u && u.ok && u.newer && !S.toastOff && S.tab !== 'settings')
      ? '<div class="toast"><div class="tt">Update available: ' + esc(u.tag) + '</div><div class="small muted" style="margin-top:2px">You have ' + Data.VERSION + '.</div><div class="btn-row">' + btn('View update', 'UI.go(\'settings\')', 'sm pri') + btn('Later', 'UI.dismissToast()', 'sm quiet') + '</div></div>'
      : '';
  }
  function renderAll() { renderSide(); renderPage(); renderToast(); }
  function refreshAfter() { rescan(); renderAll(); showBanner(); }

  // ---------- applying ----------
  // Changes every file of the given games that needs it. Files shared by two games are handled once.
  function runOptimize(games) {
    var res = { changed: 0, skipped: 0, failed: 0, lines: [], names: [] }, seen = {}, hit = {}, i, j, files, f, r, k, miss = [], rec, orig, ff;
    function addName(n) { var q; for (q = 0; q < res.names.length; q++) if (res.names[q] === n) return; res.names.push(n); }
    for (i = 0; i < games.length; i++) {
      ff = filesFor(games[i]); files = ff.files;
      if (!files.length) miss.push({ n: gameTitle(games[i]), bare: ff.bare.length > 0 });
      for (j = 0; j < files.length; j++) {
        f = files[j];
        if (seen[f.path]) { if (hit[f.path]) addName(gameTitle(games[i])); continue; }
        seen[f.path] = 1;
        if (fileState(f) === 'ok') { res.skipped++; continue; }
        try { Sys.backup(f); } catch (e) { res.failed++; res.lines.push({ t: f.name + ': the backup could not be made, so nothing was changed (' + (e.message || e) + ')' }); continue; }
        r = Sys.applyValues(f, pairsFor(f), S.cfg.lock ? 'lock' : 'keep');
        if (!r.ok) { res.failed++; res.lines.push({ t: r.error }); continue; }
        // remember the value from before this app first touched the file, so Undo can put exactly that back
        rec = S.cfg.applied[f.path];
        if (!rec) {
          orig = Sys.originalValues(f) || {};
          rec = { orig: {}, wasRO: !!r.wasRO };
          for (k = 0; k < r.changes.length; k++) {
            var o = orig[r.changes[k].key];
            rec.orig[r.changes[k].key] = (o !== null && o !== undefined && o !== '') ? o : r.changes[k].before;
          }
        } else {
          for (k = 0; k < r.changes.length; k++) if (!rec.orig.hasOwnProperty(r.changes[k].key)) rec.orig[r.changes[k].key] = r.changes[k].before;
        }
        rec.wrote = String(fileTarget(f)); rec.at = Core.stamp();
        S.cfg.applied[f.path] = rec;
        res.changed++; hit[f.path] = 1; addName(gameTitle(games[i]));
        for (k = 0; k < r.changes.length; k++) res.lines.push({ t: f.name + '    ' + r.changes[k].key + '  ' + r.changes[k].before + '  to  ' + r.changes[k].after + (r.changes[k].copies > 1 ? '  (' + r.changes[k].copies + ' copies)' : ''), mono: true });
      }
    }
    for (k = 0; k < miss.length; k++) res.lines.push({ t: miss[k].n + (miss[k].bare ? ': open the graphics settings in the game once, close it, then Re-check.' : ': no settings file yet. Start it once, reach the main menu, close it, then Re-check.') });
    save();
    return res;
  }
  function finish(res, undoId) {
    if (res.failed) setBanner('bad', res.changed ? 'Some files did not change. Each one that failed was left exactly as it was.' : 'Nothing was changed. The files were left exactly as they were.', res.lines, res.changed ? undoId : null);
    else if (res.changed) setBanner('good', 'Optimized ' + listJoin(res.names) + '. Checked by reading the files back.', res.lines, undoId);
    else if (res.skipped) setBanner('good', 'Already optimized. Nothing needed changing.', res.lines, null);
    else setBanner('warn', 'No settings files to change yet.', res.lines, null);
    refreshAfter();
  }
  // Puts the value back quietly when the game has reset it (on start and when switching back to the app).
  function autoFix() {
    var games = [], i, res;
    if (!S.cfg.autoReapply || !cpuKnown()) return false;
    for (i = 0; i < Data.GAMES.length; i++) if (status(Data.GAMES[i]).state === 'drift') games.push(Data.GAMES[i]);
    if (!games.length || Sys.gameRunning()) return false;
    res = runOptimize(games);
    if (res.changed) { setBanner('good', 'The game had reset its render threads, so they were put back: ' + listJoin(res.names) + '.', res.lines, 'all'); rescan(); return true; }
    return false;
  }
  function cpuKnown() { return !!(S.advice && (S.advice.cores > 0 || parseInt(S.cfg.manualP, 10) > 0)); }
  function blocked() {
    if (!cpuKnown()) { setBanner('warn', 'Your processor could not be read, so nothing was changed. Press Re-check, or enter your performance-core count under Settings, Advanced.', [], null); refreshAfter(); return true; }
    return gameBlocked();
  }
  function gameBlocked() {
    if (Sys.gameRunning()) { setBanner('warn', 'Call of Duty is running. Close the game first, or it will write its own values over the change.', [], null); refreshAfter(); return true; }
    return false;
  }

  // keyboard focus rings only when the keyboard is being used
  function focusMode() {
    document.onkeydown = function (e) { e = e || window.event; if (e.keyCode === 9) document.body.className = 'kb'; };
    document.onmousedown = function () { if (document.body.className) document.body.className = ''; };
  }

  return {
    init: function () {
      try {
        var aw = screen.availWidth || 1360, ah = screen.availHeight || 900, w = Math.min(1360, aw), h = Math.min(900, ah);
        window.resizeTo(w, h); window.moveTo(Math.max(0, (aw - w) / 2), Math.max(0, (ah - h) / 2));
      } catch (e) { }
      var saved = Sys.loadSettings(), k;
      for (k in saved) if (saved.hasOwnProperty(k) && (S.cfg.hasOwnProperty(k) || k === 'vendorOverride' || k === 'vramOverride')) S.cfg[k] = saved[k];
      if (!S.cfg.ticks || typeof S.cfg.ticks !== 'object') S.cfg.ticks = {};
      if (!S.cfg.applied || typeof S.cfg.applied !== 'object') S.cfg.applied = {};
      focusMode();
      renderAll();
      setTimeout(function () {
        detect(false); rescan(); migrate(); S.ready = true;
        S.keepBanner = autoFix();
        UI.go('home');
        if (S.cfg.checkUpdates && Core.validRepo(Config.REPO)) setTimeout(function () { UI.checkUpdate(true); }, 1500);
      }, 60);
      // when you come back from the game, re-read the files so a reset value is noticed
      window.onfocus = function () { UI.refresh(); };
    },
    refresh: function () {
      var now = new Date().getTime();
      if (!S.ready || now - S.lastFocus < 2500) return;
      S.lastFocus = now; rescan();
      if (autoFix()) { renderAll(); showBanner(); return; }
      if (S.tab !== 'settings') { renderSide(); renderPage(); }
    },
    go: function (id) {
      var p = $('page');
      S.tab = id; if (!S.keepBanner) S.banner = null; S.keepBanner = false;
      p.className = ''; renderAll(); $('main').scrollTop = 0;
      try { void p.offsetWidth; } catch (e) { }
      p.className = 'enter';
    },
    dismiss: function () { S.banner = null; var b = $('banner'); if (b) b.parentNode.removeChild(b); },
    setPreset: function (p) {
      S.cfg.preset = p; save();
      var g = game(S.tab); if (g && $('presets')) $('presets').innerHTML = checklistCard(g); else renderPage();
    },
    tick: function (i) {
      var g = game(S.tab), pk = presetFor(g), rows = Data.rows(g, pk, ctx()), k = tickKey(g, rows[i]), row = $('r' + i), j, done = 0, pct;
      if (S.cfg.ticks[k]) delete S.cfg.ticks[k]; else S.cfg.ticks[k] = 1;
      save();
      if (row) row.className = 'item' + (S.cfg.ticks[k] ? ' done' : '');
      for (j = 0; j < rows.length; j++) if (S.cfg.ticks[tickKey(g, rows[j])]) done++;
      pct = rows.length ? Math.round(done * 100 / rows.length) : 0;
      if ($('pcount')) $('pcount').innerHTML = done + ' of ' + rows.length + ' set';
      if ($('pbar')) $('pbar').style.width = pct + '%';
    },
    clearTicks: function () {
      var g = game(S.tab), rows = Data.rows(g, presetFor(g), ctx()), i;
      for (i = 0; i < rows.length; i++) delete S.cfg.ticks[tickKey(g, rows[i])];
      save(); if ($('presets')) $('presets').innerHTML = checklistCard(g); else renderPage();
    },
    setVendor: function (v) { S.cfg.vendorOverride = v; save(); detect(false); renderAll(); },
    setVram: function (v) { S.cfg.vramOverride = v; save(); detect(false); renderAll(); },
    setMode: function (m) { S.cfg.mode = m; save(); renderAll(); },
    setP: function (v) { S.cfg.manualP = String(v).replace(/[^0-9]/g, ''); save(); renderAll(); },
    setLock: function (b) { S.cfg.lock = !!b; save(); renderPage(); },
    setAutoReapply: function (b) { S.cfg.autoReapply = !!b; save(); renderPage(); },
    setApplyVram: function (b) { S.cfg.applyVram = !!b; save(); renderAll(); },
    setCheckUpdates: function (b) { S.cfg.checkUpdates = !!b; save(); },
    // Plain-text report of what the app detected, for troubleshooting. No user name or file contents are included.
    diag: function () {
      var h = S.hw, g = h.gpu, f = (S.scan && S.scan.files) || [], i, w, a = S.advice, t = 'CoD Configurator ' + Data.VERSION + '\r\n', ok;
      t += 'OS: ' + h.os + '  RAM: ' + h.ramGB + ' GB\r\n';
      t += 'CPU: ' + S.cpu.name + ' | cores ' + a.cores + ' | threads ' + (a.logical || S.cpu.logical) + ' | performance cores ' + a.pcores + ' | hybrid ' + a.hybrid + ' | chiplets ' + a.ccdCount + ' | layout ' + (a.exact ? 'from Windows' : 'estimated') + ' | will write ' + target() + '\r\n';
      t += 'GPU: ' + (g ? g.name + ' | ' + g.vramGB + ' GB | ' + g.vendor + ' | driver ' + g.driver : 'not detected') + '\r\n';
      t += 'Display: ' + h.display.w + 'x' + h.display.h + ' @ ' + h.display.hz + ' Hz\r\n';
      t += 'Detected via: cpu ' + S.src.cpu + ', gpu ' + S.src.gpu + ', display ' + S.src.display + ', ram ' + S.src.ram + ', os ' + S.src.os + '\r\n';
      var lg = Sys.detectLog(); for (i = 0; i < lg.length; i++) t += 'Note: ' + lg[i] + '\r\n';
      t += 'Settings files (' + f.length + '):\r\n';
      for (i = 0; i < f.length; i++) t += '  ' + f[i].loc + (f[i].sub ? '\\' + f[i].sub : '') + ' | ' + f[i].name + ' | ' + f[i].code + ' | key ' + f[i].hasKey + ' x' + f[i].count + ' | value ' + f[i].value + (f[i].range ? ' (' + f[i].range.min + '..' + f[i].range.max + ')' : '') + ' | read-only ' + f[i].ro + (f[i].unreadable ? ' | not plain text' : '') + '\r\n';
      if (S.scan && S.scan.error) t += 'Scan note: ' + S.scan.error + '\r\n';
      t += 'Windows checks:\r\n';
      for (i = 0; i < S.win.length; i++) { w = S.win[i]; t += '  ' + w.label + ': ' + w.state + ' - ' + w.text + '\r\n'; }
      ok = Sys.copy(t);
      setBanner(ok ? 'good' : 'warn', ok ? 'Report copied. Paste it into a message to share what the app found.' : 'The clipboard could not be reached.', [], null);
      renderPage(); showBanner();
    },
    open: function (u) { Sys.openUrl(u); },
    openSetting: function (id) { Sys.openSetting(id); },
    openFolder: function (w) { Sys.openFolder(w); },
    openAssets: function () { Sys.openAssets(); },
    refreshArt: function () { imgCache = {}; renderAll(); },
    redetect: function () {
      S.ready = false; renderAll();
      setTimeout(function () {
        Sys.resetProbe(); detect(true); rescan(); S.ready = true;
        var full = !!(S.cpu && S.cpu.cores > 0 && S.hw && S.hw.gpu && S.hw.display.hz > 0 && S.hw.ramGB > 0);
        setBanner(full ? 'good' : 'warn', full ? 'Re-checked your PC and settings files.' : 'Re-checked, but some parts of your PC could not be read. Settings, Detection shows what was tried.', [], null);
        renderAll(); showBanner();
      }, 40);
    },

    optimizeGame: function (id) {
      var g = game(id);
      if (!g || blocked()) return;
      finish(runOptimize([g]), id);
    },
    optimizeAll: function () {
      if (blocked()) return;
      var games = [], i;
      for (i = 0; i < Data.GAMES.length; i++) if (Data.GAMES[i].config) games.push(Data.GAMES[i]);
      finish(runOptimize(games), 'all');
    },
    // Puts back only the values this app changed, as they were before it first touched each file.
    undo: function (id) {
      var games = [], files, i, j, f, r, n = 0, lines = [], seen = {}, bad = 0, rec, pairs, k;
      if (gameBlocked()) return;
      rescan();
      for (i = 0; i < Data.GAMES.length; i++) if (id === 'all' || Data.GAMES[i].id === id) games.push(Data.GAMES[i]);
      for (i = 0; i < games.length; i++) {
        files = filesFor(games[i]).files;
        for (j = 0; j < files.length; j++) {
          f = files[j]; rec = S.cfg.applied[f.path];
          if (seen[f.path] || !rec) continue; seen[f.path] = 1;
          pairs = [];
          for (k in rec.orig) if (rec.orig.hasOwnProperty(k) && rec.orig[k] !== null && rec.orig[k] !== undefined) pairs.push({ key: k, value: rec.orig[k] });
          if (!pairs.length) { delete S.cfg.applied[f.path]; continue; }
          try { Sys.backup(f); } catch (e) { bad++; lines.push({ t: f.name + ': the backup could not be made, so nothing was changed' }); continue; }
          r = Sys.applyValues(f, pairs, rec.wasRO ? 'lock' : 'unlock');
          if (r.ok) {
            n++; delete S.cfg.applied[f.path];
            for (k = 0; k < r.changes.length; k++) lines.push({ t: f.name + '    ' + r.changes[k].key + '  ' + r.changes[k].before + '  to  ' + r.changes[k].after, mono: true });
          } else { bad++; lines.push({ t: r.error }); }
        }
      }
      save();
      if (bad) setBanner('bad', 'Some files could not be changed back. Each one that failed was left as it was.', lines, null);
      else if (n) setBanner('good', 'Undone. The original values are back; your other settings were not touched.', lines, null);
      else setBanner('warn', 'There is nothing to undo.', [], null);
      refreshAfter();
    },
    // Last resort from Settings, Advanced: copies every file's newest full backup back.
    restoreFull: function () {
      var f = (S.scan && S.scan.files) || [], i, r, n = 0, bad = 0, lines = [];
      if (gameBlocked()) return;
      for (i = 0; i < f.length; i++) {
        if (!f[i].hasKey || !Sys.latestBackup(f[i])) continue;
        r = Sys.restore(f[i]);
        if (r.ok) { n++; delete S.cfg.applied[f[i].path]; lines.push({ t: f[i].name + ' restored from ' + r.from, mono: true }); } else { bad++; lines.push({ t: f[i].name + ': ' + r.error }); }
      }
      save();
      if (bad) setBanner('bad', 'Some backups could not be restored.', lines, null);
      else if (n) setBanner('good', 'Restored the newest full backup of ' + plural(n, 'file', 'files') + '.', lines, null);
      else setBanner('warn', 'There are no backups yet.', [], null);
      refreshAfter();
    },
    copyPreset: function () {
      var g = game(S.tab), rows = Data.rows(g, presetFor(g), ctx()), t = gameTitle(g) + ' - ' + Data.PRESETS[presetFor(g)].label + '\r\n', i, last = '', ok;
      for (i = 0; i < rows.length; i++) {
        if (rows[i].group !== last) { t += '\r\n' + cap(rows[i].group) + '\r\n'; last = rows[i].group; }
        t += '  ' + rows[i].setting + ': ' + rows[i].value + '\r\n';
      }
      ok = Sys.copy(t);
      setBanner(ok ? 'good' : 'warn', ok ? 'Checklist copied.' : 'The clipboard could not be reached.', [], null);
      renderPage(); showBanner();
    },

    checkUpdate: function (silent) {
      if (S.checking) return;
      function run() {
        var r = Sys.latestRelease(Config.REPO);
        S.dl = null; S.checking = false;
        if (r.ok) r.newer = Core.compareVersions(r.tag, Data.VERSION) > 0;
        if (silent && (!r.ok || !r.newer)) { if (S.tab === 'settings') renderPage(); return; }
        S.upd = r; renderSide(); renderToast(); if (S.tab === 'settings') renderPage();
      }
      if (silent) { S.checking = true; run(); return; }
      S.checking = true; if (S.tab === 'settings') renderPage();
      setTimeout(run, 40);
    },
    dismissToast: function () { S.toastOff = true; renderToast(); },
    downloadUpdate: function () {
      if (!S.upd || !S.upd.assetUrl) return;
      S.dl = Sys.downloadUpdate(S.upd.assetUrl, S.upd.tag); renderPage();
    },
    showDl: function () { if (S.dl && S.dl.ok) Sys.openPath(S.dl.path); },
    _state: S
  };
})();
