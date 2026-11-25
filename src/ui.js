/* ui.js - rendering and handlers. ES5, IE11-safe, ASCII only. Design rule: everything is one click and automatic;
   anything manual lives in Settings > Advanced. */
var UI = (function () {
  var S = {
    tab: 'home', vendor: 'nvidia', lowVram: false, ready: false, src: {},
    cpu: null, advice: null, hw: null, scan: null, win: [], banner: null,
    upd: null, dl: null, checking: false, toastOff: false, bgFlip: false, lastFocus: 0,
    cfg: { lock: false, checkUpdates: true, applyVram: false, preset: 'fps', mode: 'auto', manualP: '', ticks: {}, undone: {}, autoReapply: true }
  };
  var ART = { home: 'home', settings: 'home', about: 'home', wz: 'warzone', bo6: 'bo6', bo7: 'bo7', mw4: 'mw4' };
  // where to aim the crop so each wallpaper's logo and faces stay in frame
  var FOCAL = { home: '50% 25%', settings: '50% 30%', about: '50% 30%', wz: '50% 22%', bo6: '50% 20%', bo7: '50% 100%', mw4: '50% 6%' };
  var GH = '<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
  var MARK = '<svg class="mark" viewBox="0 0 24 24"><path d="M12 1.5l9.5 5.5v10L12 22.5 2.5 17V7z" fill="none" stroke="#ff2a1f" stroke-width="2"/><path d="M8.5 9l3.5 3-3.5 3M13 15h3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var imgCache = {};
  var LOC = { docs: 'Documents', local: 'AppData' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function game(id) { for (var i = 0; i < Data.GAMES.length; i++) if (Data.GAMES[i].id === id) return Data.GAMES[i]; return null; }
  function save() { Sys.saveSettings(S.cfg); }
  function ctx() { return { vendor: S.vendor, lowVram: S.lowVram, hz: S.hw ? S.hw.display.hz : 0, h: S.hw ? S.hw.display.h : 0 }; }
  function img(name) { if (!imgCache.hasOwnProperty(name)) imgCache[name] = Sys.imageFor(name); return imgCache[name]; }
  function bgUrl(src) { return "url('" + src + "')"; }

  // ---------- detection ----------
  function detect() {
    S.cpu = Sys.cpu();
    S.advice = Core.cpuAdvice(S.cpu.name, S.cpu.cores, S.cpu.logical);
    S.hw = Sys.hardware();
    S.src = Sys.sources();
    if (S.src.cpu === 'estimate') { S.advice.confident = false; S.advice.note = 'Your CPU core count could not be read exactly, so it was estimated. If it is wrong, set it under Settings > Advanced.'; }
    if (S.hw.gpu) {
      if (S.hw.gpu.vendor !== 'unknown') S.vendor = S.hw.gpu.vendor;
      if (S.hw.gpu.vramGB > 0) S.lowVram = Core.isLowVram(S.hw.gpu.vramGB);
    }
    if (S.cfg.vendorOverride) S.vendor = S.cfg.vendorOverride;
    if (S.cfg.vramOverride) S.lowVram = S.cfg.vramOverride === 'lo';
    S.win = Sys.winChecks();
  }
  function rescan() {
    var i;
    S.scan = Sys.scan();
    for (i = 0; i < S.scan.files.length; i++) S.scan.files[i].bak = Sys.latestBackup(S.scan.files[i]);
  }

  // ---------- plan: what the one click will do ----------
  function pcores() { var p = parseInt(S.cfg.manualP, 10); return p > 0 ? p : S.advice.pcores; }
  function target() {
    var p = pcores();
    if (S.cfg.mode === 'minus1') return Core.recommend(p, 'minus1');
    if (S.cfg.mode === 'match') return Core.recommend(p, 'rec');
    return Core.autoWorkers(p, S.advice.hybrid);
  }
  function filesFor(g) {
    var out = [], f = (S.scan && S.scan.files) || [], c, i;
    if (!g.config) return out;
    for (c = 0; c < g.codes.length && !out.length; c++) {
      for (i = 0; i < f.length; i++) if (f[i].hasKey && f[i].code === g.codes[c]) out.push(f[i]);
    }
    return out;
  }
  function pairsFor(f) {
    var pairs = [{ key: Core.KEY, value: target() }];
    if (S.cfg.applyVram && f.hasVram) pairs.push({ key: Core.VRAM_KEY, value: Core.vramScaleFor('', S.lowVram) });
    return pairs;
  }
  function fileOk(f) {
    if (String(f.value) !== String(target())) return false;
    if (S.cfg.applyVram && f.hasVram && String(f.vramValue) !== Core.vramScaleFor('', S.lowVram)) return false;
    return true;
  }
  // state: manual (no file tweak for this game) | nofile | ok | drift (was optimized, game changed it back) | needs
  function status(g) {
    var files = filesFor(g), i, bad = 0, hadBak = false;
    if (!g.config) return { state: 'manual', files: files };
    if (!files.length) return { state: 'nofile', files: files };
    for (i = 0; i < files.length; i++) { if (!fileOk(files[i])) bad++; if (files[i].bak && !S.cfg.undone[files[i].path]) hadBak = true; }
    return { state: bad === 0 ? 'ok' : (hadBak ? 'drift' : 'needs'), files: files, hasBak: hadBak, bad: bad };
  }
  function pill(st) {
    if (st === 'ok') return '<span class="pill ok">OPTIMIZED</span>';
    if (st === 'drift') return '<span class="pill warn">GAME RESET IT - RE-APPLY</span>';
    if (st === 'needs') return '<span class="pill warn">READY TO OPTIMIZE</span>';
    if (st === 'manual') return '<span class="pill">IN-GAME SETTINGS ONLY</span>';
    return '<span class="pill warn">LAUNCH GAME ONCE</span>';
  }

  // ---------- banner (result of the last click) ----------
  function setBanner(cls, msg, lines, undoIds) { S.banner = { cls: cls, msg: msg, lines: lines || [], undo: undoIds || null }; }
  function bannerHtml() {
    var b = S.banner, h, i;
    if (!b) return '';
    h = '<div class="banner ' + b.cls + '" id="banner"><b>' + esc(b.msg) + '</b>';
    for (i = 0; i < b.lines.length; i++) h += '<div class="ln">' + esc(b.lines[i]) + '</div>';
    if (b.undo) h += '<a class="btn" onclick="UI.undo(\'' + b.undo + '\')">UNDO</a>';
    return h + '</div>';
  }
  function showBanner() {
    try {
      var el = $('banner'), m = $('main'); if (!el) return;
      var r = el.getBoundingClientRect(), mr = m.getBoundingClientRect();
      if (r.top < mr.top + 10 || r.bottom > mr.bottom - 10) m.scrollTop += r.top - mr.top - 90;
    } catch (e) { }
  }

  // ---------- chrome: backdrop, top bar, hero ----------
  function setBg() {
    var name = ART[S.tab] || 'home', src = img('bg-' + name), next = S.bgFlip ? $('bgB') : $('bgA'), prev = S.bgFlip ? $('bgA') : $('bgB');
    $('app').className = 'g-' + S.tab;
    next.style.backgroundImage = src ? bgUrl(src) : 'none';
    next.className = 'bgimg on'; prev.className = 'bgimg';
    S.bgFlip = !S.bgFlip;
  }

  function tabs() {
    var h = '<div id="brand">' + MARK + 'CoD <b>//</b><span class="bt"> CONFIGURATOR</span></div>', i, g;
    h += '<div class="tab' + (S.tab === 'home' ? ' on' : '') + '" onclick="UI.go(\'home\')">HOME</div>';
    for (i = 0; i < Data.GAMES.length; i++) {
      g = Data.GAMES[i];
      h += '<div class="tab' + (S.tab === g.id ? ' on' : '') + '" onclick="UI.go(\'' + g.id + '\')">' + g.name + '</div>';
    }
    h += '<div id="topr"><div class="tab' + (S.tab === 'settings' ? ' on' : '') + '" onclick="UI.go(\'settings\')">SETTINGS' + (S.upd && S.upd.ok && S.upd.newer ? '<span class="dot"></span>' : '') + '</div>' +
      '<div class="tab' + (S.tab === 'about' ? ' on' : '') + '" onclick="UI.go(\'about\')">SOURCES &amp; SAFETY</div></div>';
    return h;
  }

  function heroHtml() {
    var t = S.tab, g = game(t), src = img(ART[t]), h, cls, title = '', tag = '', body = '';
    if (t === 'home') { cls = 'home'; }
    else if (g) { cls = src ? '' : 'compact'; title = g.name; tag = g.tag; }
    else { cls = 'compact'; title = t === 'settings' ? 'SETTINGS' : 'SOURCES &amp; SAFETY'; tag = t === 'settings' ? 'UPDATES // ADVANCED // ART' : 'WHAT IS VERIFIED // WHAT IS NOT'; }

    h = '<div class="hero ' + cls + '">';
    h += src ? '<div class="hero-img" style="background-image:' + bgUrl(src) + ';background-position:' + FOCAL[t] + '"></div>' : '<div class="hero-fall"></div>';
    if (t === 'home') h += '<div class="hero-side"></div>';
    h += '<div class="hero-shade"></div>';
    if (t === 'home') {
      body = '<div class="eyebrow">' + (!S.ready ? '<span class="spin"></span>DETECTING YOUR PC' : (detectedAll() ? '<span class="live"></span>YOUR PC WAS DETECTED' : '<span class="live warn"></span>PARTLY DETECTED')) + '</div><h1>CALL OF DUTY<br><b>CONFIGURATOR</b></h1>' +
        '<p>One click sets up every game for your PC. Everything is backed up first and undoes with one click.</p>' +
        '<a class="btn pri big' + (S.ready ? '' : ' off') + '" onclick="UI.optimizeAll()">OPTIMIZE ALL GAMES</a><a class="btn big" onclick="UI.redetect()">RE-CHECK</a>';
    } else if (!g || !src) {
      body = '<div class="eyebrow">' + tag + '</div><h1>' + title + '</h1>';
    }
    if (body) h += '<div class="hero-in">' + body + '</div>';
    return h + '</div>';
  }

  // ---------- shared view bits ----------
  function cpuKnown() { return !!(S.advice && (S.advice.cores > 0 || parseInt(S.cfg.manualP, 10) > 0)); }
  function detectedAll() { return !!(S.cpu && S.cpu.cores > 0 && S.hw && S.hw.gpu && S.hw.display.hz > 0 && S.hw.ramGB > 0); }
  function via(k) { var s = S.src && S.src[k]; return s && s !== 'none' && s !== 'preview' ? ' &middot; via ' + esc(s) : ''; }
  function chip(label, main, sub, bad) { return '<div class="chip' + (bad ? ' bad' : '') + '"><div class="chip-in"><i>' + label + '</i><span>' + main + '</span><em>' + sub + '</em></div></div>'; }
  function hwChips() {
    var hw = S.hw, a = S.advice, g = hw.gpu, d = hw.display, h = '<div class="chips cf">';
    h += chip('PROCESSOR', esc(S.cpu.name || 'Not detected'), S.cpu.cores ? S.cpu.cores + ' cores / ' + S.cpu.logical + ' threads' + (a.hybrid ? ' &middot; ' + a.pcores + ' performance cores' : '') + via('cpu') : 'Could not be read', !S.cpu.cores);
    h += chip('GRAPHICS', esc(g ? g.name : 'Not detected'), g ? (g.vramGB ? g.vramGB + ' GB video memory' : 'Video memory unknown') + (g.integrated ? ' &middot; integrated' : '') + via('gpu') : 'Could not be read', !g);
    h += chip('DISPLAY', d.w ? d.w + ' &times; ' + d.h + (d.hz ? ' @ ' + d.hz + ' Hz' : '') : 'Not detected', d.hz ? 'Frame cap is set for you' + via('display') : 'Refresh rate not reported. Use your monitor\'s highest Hz.', !d.hz);
    h += chip('MEMORY', hw.ramGB ? hw.ramGB + ' GB RAM' : 'RAM unknown', esc(hw.os || 'Windows version unknown'), !hw.ramGB);
    h += chip('WORKER COUNT', cpuKnown() ? '' + target() : 'Unknown', cpuKnown() ? 'Picked automatically for your CPU' : 'Needs your CPU. Press RE-CHECK or set it in Settings.', !cpuKnown());
    return h + '</div>';
  }
  function loadingHtml() { return '<div class="wrap"><div class="glass pad"><h3>STARTING UP</h3><div class="muted"><span class="spin"></span>Reading your hardware and settings files. This takes a few seconds.</div></div></div>'; }
  function detectWarn() {
    if (detectedAll()) return '';
    return '<div class="banner warn"><b>Some parts of your PC could not be read.</b><div class="ln">The app still works. Anything missing falls back to a safe default. Press RE-CHECK to try again, or open Settings, Detection to see what was tried.</div>' +
      '<a class="btn" onclick="UI.redetect()">RE-CHECK</a><a class="btn" onclick="UI.diag()">COPY REPORT</a></div>';
  }

  function winCard() {
    var h = '<div class="glass pad rise gap"><h3>WINDOWS CHECK <span>//</span> READ ONLY</h3>' +
      '<div class="small muted" style="margin-bottom:6px">These only look at your settings. Nothing is changed. Press OPEN to jump to the right Windows page.</div>', i, w;
    if (!S.win.length) h += '<div class="small muted">Nothing could be read.</div>';
    for (i = 0; i < S.win.length; i++) {
      w = S.win[i];
      h += '<div class="wc"><div class="wl">' + esc(w.label) + '</div>' + (w.open ? '<div class="wb"><a class="btn" onclick="UI.openSetting(\'' + w.open + '\')">OPEN</a></div>' : '') +
        '<div class="wt"><span class="pill ' + (w.state === 'ok' ? 'ok' : (w.state === 'warn' ? 'warn' : '')) + '">' + (w.state === 'ok' ? 'GOOD' : (w.state === 'warn' ? 'CHECK' : 'INFO')) + '</span>' + esc(w.text) + '</div></div>';
    }
    return h + '</div>';
  }

  // ---------- home ----------
  function homeView() {
    var h = '<div class="wrap">' + bannerHtml() + detectWarn(), i, g, st, src, f;
    h += '<div class="glass pad rise"><h3>YOUR PC <span>//</span> DETECTED</h3>' + hwChips() +
      '<div class="small muted" style="margin-top:4px">Read with built-in Windows queries only. No driver is installed, so nothing here interferes with anti-cheat.</div></div>';
    h += '<div class="tiles cf gap">';
    for (i = 0; i < Data.GAMES.length; i++) {
      g = Data.GAMES[i]; st = status(g); src = img(ART[g.id]);
      h += '<div class="tile-wrap rise"><div class="tile glass" onclick="UI.go(\'' + g.id + '\')"><div class="tile-art">' +
        (src ? '<div class="tile-img" style="background-image:' + bgUrl(src) + ';background-position:' + FOCAL[g.id] + '"></div>' : '<div class="hero-fall"></div>') +
        '<div class="tile-fade"></div><div class="tile-tag">' + g.name + '</div></div><div class="tile-body">';
      h += pill(st.state);
      if (st.state === 'ok' || st.state === 'needs' || st.state === 'drift') {
        f = st.files[0];
        h += '<div class="stat">Worker count <b>' + esc(f.value) + '</b> &rarr; <b style="color:#ff5a50">' + target() + '</b></div>';
      } else if (st.state === 'manual') h += '<div class="stat muted">Follow the checklist in the game tab.</div>';
      else h += '<div class="stat muted">Launch the game once, reach the main menu, close it, then press RE-CHECK.</div>';
      h += '<a class="btn" onclick="event.cancelBubble=true;UI.go(\'' + g.id + '\')">OPEN</a>';
      if (st.state === 'needs' || st.state === 'drift') h += '<a class="btn pri" onclick="event.cancelBubble=true;UI.optimizeGame(\'' + g.id + '\')">' + (st.state === 'drift' ? 'RE-APPLY' : 'OPTIMIZE') + '</a>';
      else if (st.state === 'ok' && st.hasBak) h += '<a class="btn" onclick="event.cancelBubble=true;UI.undo(\'' + g.id + '\')">UNDO</a>';
      h += '</div></div></div>';
    }
    h += '</div>' + winCard();
    return h + '</div>';
  }

  // ---------- game tab ----------
  function barHtml(g) {
    var st = status(g), h = '<div style="padding:0 32px"><div class="bar glass rise cf"><div class="acts">';
    if (st.state === 'needs' || st.state === 'drift') h += '<a class="btn pri" onclick="UI.optimizeGame(\'' + g.id + '\')">' + (st.state === 'drift' ? 'RE-APPLY' : 'OPTIMIZE') + '</a>';
    if (st.state === 'ok' && st.hasBak) h += '<a class="btn" onclick="UI.undo(\'' + g.id + '\')">UNDO</a>';
    if (st.state === 'manual') h += '<a class="btn pri" onclick="UI.jump()">OPEN CHECKLIST</a>';
    else h += '<a class="btn" onclick="UI.jump()">CHECKLIST</a>';
    h += '</div><div style="padding-top:2px"><span class="stat">' + pill(st.state) + '</span>';
    if (st.state === 'drift') h += '<span class="stat">The game changed your value back. One click puts it back.</span>';
    else if (st.state === 'needs') h += '<span class="stat">One click applies the file tweak. A backup is made first.</span>';
    else if (st.state === 'ok') h += '<span class="stat">The file tweak is applied. Now go through the checklist.</span>';
    else if (st.state === 'nofile') h += '<span class="stat">Launch the game once, reach the main menu, close it, then press RE-CHECK.</span>';
    return h + '</div></div></div>';
  }

  function tweakCard(g) {
    var st = status(g), h = '<div class="glass pad"><h3>' + (g.config ? 'FILE TWEAK <span>//</span> ONE CLICK' : 'BEST FPS <span>//</span> IN-GAME ONLY') + '</h3>', i, f;
    if (!g.config) {
      h += '<div class="note">' + esc(g.configNote) + '</div>';
      return h + '</div>';
    }
    h += '<div class="small muted">Sets <b style="color:#fff">' + Core.KEY + '</b> to <b style="color:#ff5a50">' + target() + '</b>, picked automatically for ' + esc(S.cpu.name || 'your CPU') + '. The game spreads its rendering over that many CPU threads.</div>';
    if (!S.advice.confident) h += '<div class="small" style="color:#ffd98a;margin-top:6px">' + esc(S.advice.note) + '</div>';
    if (!st.files.length) {
      h += '<div class="note warn small">No settings file for this game was found yet. Launch the game once, reach the main menu, close it, then press RE-CHECK.</div>';
    } else {
      for (i = 0; i < st.files.length; i++) {
        f = st.files[i];
        h += '<div class="file"><div class="fn">' + esc(f.name) + '</div><div class="fs">' + (LOC[f.loc] || '') + ' &middot; now ' + esc(f.value) + ' &rarr; ' + target() + (f.ro ? ' &middot; locked' : '') + (fileOk(f) ? ' &middot; <span style="color:#7ff0ae">done</span>' : '') + '</div></div>';
      }
    }
    h += '<div style="margin-top:2px">';
    if (st.state === 'needs' || st.state === 'drift') h += '<a class="btn pri" onclick="UI.optimizeGame(\'' + g.id + '\')">' + (st.state === 'drift' ? 'RE-APPLY' : 'OPTIMIZE') + '</a>';
    if (st.hasBak) h += '<a class="btn" onclick="UI.undo(\'' + g.id + '\')">UNDO</a>';
    h += '<a class="btn" onclick="UI.redetect()">RE-CHECK</a></div>';
    h += '<div class="small muted" style="margin-top:12px">Guides differ by one on the exact number, so judge by your 1% lows. UNDO restores the file exactly as it was.</div>';
    return h + '</div>';
  }

  // Modern Warfare 4 only gets the Best FPS list for now; the Quality preset is hidden until a guide publishes one.
  function presetFor(g) { var p = S.cfg.preset; if (g && g.id === 'mw4') return 'fps'; return p === 'balanced' ? 'balanced' : 'fps'; }
  function tickKey(g, r) { return g.id + '|' + presetFor(g) + '|' + r.setting; }
  function checklistCard(g) {
    var pk = presetFor(g), rows = Data.rows(g, pk, ctx()), h = '', i, last = '', r, done = 0, p = Data.PRESETS[pk], gp = S.hw.gpu, pct;
    for (i = 0; i < rows.length; i++) if (S.cfg.ticks[tickKey(g, rows[i])]) done++;
    pct = rows.length ? Math.round(done * 100 / rows.length) : 0;
    h += '<div class="glass pad"><h3>IN-GAME CHECKLIST <span>//</span> ' + p.label + '</h3>';
    if (g.id !== 'mw4') h += '<div class="seg"><div class="' + (pk === 'fps' ? 'on' : '') + '" onclick="UI.setPreset(\'fps\')">BEST FPS</div>' +
      '<div class="' + (pk === 'balanced' ? 'on' : '') + '" onclick="UI.setPreset(\'balanced\')">BALANCED</div></div>';
    h += '<div class="small muted" style="margin-bottom:10px">' + esc(p.blurb) + '</div>';
    if (gp) h += '<div class="note small">Matched to your PC: ' + esc(gp.name) + (gp.vramGB ? ', ' + gp.vramGB + ' GB' : '') + (S.hw.display.hz ? ', ' + S.hw.display.h + 'p @ ' + S.hw.display.hz + ' Hz' : '') + '.</div>';
    h += '<div class="small muted">Click a row to tick it off as you go. <span id="pcount">' + done + ' of ' + rows.length + ' done.</span></div><div class="prog"><i id="pbar" style="width:' + pct + '%"></i></div>';
    h += '<table class="st"><tr><th></th><th>SETTING</th><th>SET TO</th><th>NOTE</th></tr>';
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (r.group !== last) { h += '<tr class="grp"><td colspan="4">' + esc(r.group) + '</td></tr>'; last = r.group; }
      h += '<tr id="r' + i + '" class="item' + (S.cfg.ticks[tickKey(g, r)] ? ' done' : '') + '" onclick="UI.tick(' + i + ')"><td class="tk"><span class="bx">&#10003;</span></td><td>' + esc(r.setting) + '</td><td class="v">' + esc(r.value) + '</td><td class="n">' + esc(r.note) + '</td></tr>';
    }
    h += '</table><a class="btn" onclick="UI.copyPreset()">COPY AS TEXT</a><a class="btn" onclick="UI.clearTicks()">CLEAR TICKS</a>';
    return h + '</div>';
  }

  function sourcesBlock(g) {
    var h = '<div class="glass pad rise"><h3>SOURCES <span>//</span> ' + g.name + '</h3><div class="small muted" style="margin-bottom:8px">' + esc(g.sourceNote) + '</div>', i;
    for (i = 0; i < g.sources.length; i++) h += '<a class="src" onclick="UI.open(\'' + g.sources[i][1] + '\')">&#9656; ' + esc(g.sources[i][0]) + '</a>';
    return h + '</div>';
  }

  function gameView(g) {
    return barHtml(g) + '<div class="wrap">' + bannerHtml() + '<p class="lead rise">' + esc(g.blurb) + '</p>' +
      '<div class="cols cf"><div class="col sm rise">' + tweakCard(g) + '</div><div class="col lg rise" id="presets">' + checklistCard(g) + '</div></div>' + sourcesBlock(g) + '</div>';
  }

  // ---------- settings ----------
  function updateCard() {
    var u = S.upd, ready = Core.validRepo(Config.REPO), h = '<div class="glass pad rise"><h3>UPDATES</h3>';
    h += '<div class="kv"><b>Installed version</b><span>v' + Data.VERSION + '</span></div>';
    if (u && u.ok) h += '<div class="kv"><b>Latest version</b><span>' + esc(u.tag) + '</span></div>';
    if (!ready) {
      h += '<div class="note warn">Update checks are not set up in this build.</div>';
      return h + '<a class="btn big off">' + GH + 'CHECK FOR UPDATES</a></div>';
    }
    h += '<a class="btn pri big' + (S.checking ? ' off' : '') + '" onclick="UI.checkUpdate(false)">' + GH + (S.checking ? 'CHECKING...' : 'CHECK FOR UPDATES') + '</a>';
    if (u) {
      if (!u.ok) h += '<div class="note warn">' + esc(u.error) + '</div>';
      else if (u.newer) {
        h += '<div class="note"><span class="pill ok">UPDATE AVAILABLE</span> <b style="color:#fff">' + esc(u.tag) + '</b>' + (u.name ? ' &middot; ' + esc(u.name) : '') +
          '<div class="small" style="margin-top:8px;white-space:pre-wrap">' + esc(u.body.length > 700 ? u.body.substr(0, 700) + '...' : u.body) + '</div></div>';
        if (u.assetUrl) h += '<a class="btn pri" onclick="UI.downloadUpdate()">DOWNLOAD UPDATE</a>';
        h += '<a class="btn" onclick="UI.open(\'' + esc(u.url) + '\')">' + GH + 'RELEASE NOTES</a>';
        if (S.dl) h += '<div class="note">' + (S.dl.ok ? 'Saved as <span class="mono">' + esc(S.dl.path) + '</span><br>Close this window and open the new file. Your settings and backups carry over.<a class="src" onclick="UI.showDl()">&#9656; Show in folder</a>' : esc(S.dl.error)) + '</div>';
      } else h += '<div class="note"><span class="pill ok">UP TO DATE</span> You have the latest version (' + esc(u.tag) + ').</div>';
    }
    h += '<label class="chk" style="margin-top:16px"><input class="chk" type="checkbox" ' + (S.cfg.checkUpdates ? 'checked ' : '') + 'onclick="UI.setCheckUpdates(this.checked)">Check for updates when the app starts</label>';
    h += '<div class="small muted" style="margin-top:6px">Nothing is installed automatically. A new version is only downloaded when you press the button.</div>';
    return h + '</div>';
  }

  function detectCard() {
    var d = S.hw.display, g = S.hw.gpu, log = Sys.detectLog(), i, h = '<div class="glass pad rise gap"><h3>DETECTION <span>//</span> WHAT THE APP FOUND</h3>';
    h += '<div class="kv"><b>Processor</b><span>' + esc(S.cpu.name || 'not found') + (S.cpu.cores ? ' &middot; ' + S.cpu.cores + ' cores, ' + S.cpu.logical + ' threads' : '') + via('cpu') + '</span></div>';
    h += '<div class="kv"><b>Graphics</b><span>' + (g ? esc(g.name) + (g.vramGB ? ' &middot; ' + g.vramGB + ' GB' : '') : 'not found') + via('gpu') + '</span></div>';
    h += '<div class="kv"><b>Display</b><span>' + (d.w ? d.w + ' x ' + d.h + (d.hz ? ' @ ' + d.hz + ' Hz' : ', refresh rate not reported') : 'not found') + via('display') + '</span></div>';
    h += '<div class="kv"><b>Memory</b><span>' + (S.hw.ramGB ? S.hw.ramGB + ' GB' : 'not found') + via('ram') + '</span></div>';
    h += '<div class="kv"><b>Windows</b><span>' + esc(S.hw.os || 'not found') + via('os') + '</span></div>';
    h += '<div class="kv"><b>Settings files</b><span>' + ((S.scan && S.scan.files.length) || 0) + ' found' + (S.scan && S.scan.error ? ' &middot; ' + esc(S.scan.error) : '') + '</span></div>';
    if (log.length) { h += '<div class="small muted" style="margin-top:10px">Notes from the last check:</div>'; for (i = 0; i < log.length && i < 8; i++) h += '<div class="small mono muted">' + esc(log[i]) + '</div>'; }
    h += '<a class="btn" onclick="UI.redetect()">RE-CHECK</a><a class="btn" onclick="UI.diag()">COPY REPORT</a>';
    return h + '</div>';
  }

  function advancedCard() {
    var g = S.hw.gpu, h = '<div class="glass pad rise gap"><h3>ADVANCED <span>//</span> YOU DO NOT NEED THIS</h3>';
    h += '<div class="small muted" style="margin-bottom:6px">Everything is detected and chosen for you. Only change these if something was detected wrong.</div>';
    h += '<div class="row"><div><label>Graphics maker</label><select onchange="UI.setVendor(this.value)">' +
      '<option value=""' + (!S.cfg.vendorOverride ? ' selected' : '') + '>Auto (' + (g ? esc(g.vendor) : 'unknown') + ')</option>' +
      '<option value="nvidia"' + (S.cfg.vendorOverride === 'nvidia' ? ' selected' : '') + '>NVIDIA</option>' +
      '<option value="amd"' + (S.cfg.vendorOverride === 'amd' ? ' selected' : '') + '>AMD</option>' +
      '<option value="intel"' + (S.cfg.vendorOverride === 'intel' ? ' selected' : '') + '>Intel Arc</option></select></div>' +
      '<div><label>Video memory</label><select onchange="UI.setVram(this.value)">' +
      '<option value=""' + (!S.cfg.vramOverride ? ' selected' : '') + '>Auto (' + (g && g.vramGB ? g.vramGB + ' GB' : 'unknown') + ')</option>' +
      '<option value="hi"' + (S.cfg.vramOverride === 'hi' ? ' selected' : '') + '>10 GB or more</option>' +
      '<option value="lo"' + (S.cfg.vramOverride === 'lo' ? ' selected' : '') + '>8 GB or less</option></select></div></div>';
    h += '<div class="row"><div><label>Worker count method</label><select onchange="UI.setMode(this.value)">' +
      '<option value="auto"' + (S.cfg.mode === 'auto' ? ' selected' : '') + '>Auto (recommended)</option>' +
      '<option value="match"' + (S.cfg.mode === 'match' ? ' selected' : '') + '>Match performance cores</option>' +
      '<option value="minus1"' + (S.cfg.mode === 'minus1' ? ' selected' : '') + '>Cores minus 1</option></select></div>' +
      '<div><label>Performance cores (blank = auto)</label><input type="number" min="1" max="64" value="' + esc(S.cfg.manualP) + '" placeholder="' + S.advice.pcores + '" onchange="UI.setP(this.value)"></div></div>';
    h += '<div class="small muted" style="margin-top:6px">Will write ' + Core.KEY + ' = <b style="color:#fff">' + target() + '</b>.</div>';
    h += '<label class="chk"><input class="chk" type="checkbox" ' + (S.cfg.lock ? 'checked ' : '') + 'onclick="UI.setLock(this.checked)">Lock files read-only after applying (the game then cannot save menu changes)</label>';
    h += '<label class="chk"><input class="chk" type="checkbox" ' + (S.cfg.autoReapply ? 'checked ' : '') + 'onclick="UI.setAutoReapply(this.checked)">Automatically re-apply when the game has reset the value (when the app opens or you switch back to it). Recommended.</label>';
    h += '<label class="chk"><input class="chk" type="checkbox" ' + (S.cfg.applyVram ? 'checked ' : '') + 'onclick="UI.setApplyVram(this.checked)">Also set ' + Core.VRAM_KEY + ' (named by one source only)</label>';
    h += '<a class="btn" onclick="UI.redetect()">RE-CHECK PC</a><a class="btn" onclick="UI.diag()">COPY REPORT</a><a class="btn" onclick="UI.openFolder(\'\')">SETTINGS FOLDER</a><a class="btn" onclick="UI.openFolder(\'backups\')">BACKUPS FOLDER</a>';
    return h + '</div>';
  }

  function settingsView() {
    var names = [['warzone', 'Warzone'], ['bo6', 'Black Ops 6'], ['bo7', 'Black Ops 7'], ['mw4', 'Modern Warfare 4'], ['home', 'Home']], i, h = '<div class="wrap"><div class="cols cf"><div class="col">';
    h += updateCard() + detectCard() + advancedCard() + '</div><div class="col">';
    h += '<div class="glass pad rise"><h3>ARTWORK</h3><div class="small muted" style="margin-bottom:8px">Wallpapers load from the <span class="mono">assets</span> folder next to this app. Replace any of them with your own wide image (jpg or png) using the names below.</div>';
    for (i = 0; i < names.length; i++) h += '<div class="kv"><b class="mono">' + names[i][0] + '.jpg</b><span>' + names[i][1] + ' &middot; ' + (Sys.imageFor(names[i][0]) ? '<span class="pill ok">IN USE</span>' : '<span class="pill">built-in art</span>') + '</span></div>';
    h += '<a class="btn" onclick="UI.openAssets()">OPEN ART FOLDER</a><a class="btn" onclick="UI.refreshArt()">REFRESH</a></div>';
    h += '<div class="small muted" style="margin:14px 4px">Settings are saved in %APPDATA%\\CoDConfigurator\\settings.json.</div>';
    return h + '</div></div></div>';
  }

  function aboutView() {
    var h = '<div class="wrap"><p class="lead rise">The claims below came up while researching. Each is marked with how well it holds up. Guides here are written reviews from gaming outlets fetched in November 2026; creator videos were not readable, so none are cited.</p>', i, f, k;
    h += '<div class="glass pad rise"><h3>FACT CHECK</h3>';
    for (i = 0; i < Data.FACTCHECK.length; i++) {
      f = Data.FACTCHECK[i];
      k = f[0] === 'VERIFIED' ? 'ok' : (f[0] === 'SAFETY' ? '' : 'warn');
      h += '<div class="fc"><span class="pill ' + k + '">' + f[0] + '</span><div class="t">' + esc(f[1]) + '</div><div class="d">' + esc(f[2]) + '</div></div>';
    }
    h += '</div><div class="glass pad rise gap"><h3>BACKUPS <span>//</span> WHERE THINGS LIVE</h3>';
    h += '<div class="kv"><b>Settings files</b><span>Documents\\Call of Duty\\players and %LOCALAPPDATA%\\Activision\\Call of Duty\\players (both are checked)</span></div>';
    h += '<div class="kv"><b>Backups</b><span>' + esc(Sys.backupFolder()) + ' (never deleted by this app)</span></div>';
    h += '<a class="btn" onclick="UI.openFolder(\'\')">OPEN SETTINGS FOLDER</a><a class="btn" onclick="UI.openFolder(\'backups\')">OPEN BACKUPS</a></div>';
    for (i = 0; i < Data.GAMES.length; i++) h += '<div class="gap">' + sourcesBlock(Data.GAMES[i]) + '</div>';
    return h + '</div>';
  }

  // ---------- render ----------
  function renderTop() { $('top').innerHTML = tabs(); }
  function renderBody() {
    var g = game(S.tab);
    if (!S.ready) { $('body').innerHTML = loadingHtml(); return; }
    $('body').innerHTML = S.tab === 'home' ? homeView() : (S.tab === 'settings' ? settingsView() : (S.tab === 'about' ? aboutView() : gameView(g)));
  }
  function renderToast() {
    var u = S.upd;
    $('toast').innerHTML = (u && u.ok && u.newer && !S.toastOff && S.tab !== 'settings')
      ? '<div class="toast"><b>Update available</b> &middot; ' + esc(u.tag) + '<div class="small muted" style="margin-top:4px">You have v' + Data.VERSION + '.</div><a class="btn pri" onclick="UI.go(\'settings\')">VIEW UPDATE</a><a class="btn" onclick="UI.dismissToast()">LATER</a></div>'
      : '';
  }
  function refreshAfter() { rescan(); renderTop(); renderBody(); showBanner(); }

  // ---------- applying ----------
  // Returns { changed, skipped, failed, lines[] } for a list of games. Files shared by two games are only handled once.
  function runOptimize(games) {
    var res = { changed: 0, skipped: 0, failed: 0, lines: [], names: [] }, seen = {}, hit = {}, i, j, files, f, r, k, miss = [];
    function addName(n) { var q; for (q = 0; q < res.names.length; q++) if (res.names[q] === n) return; res.names.push(n); }
    for (i = 0; i < games.length; i++) {
      files = filesFor(games[i]);
      if (!files.length) miss.push(games[i].name);
      for (j = 0; j < files.length; j++) {
        f = files[j];
        if (seen[f.path]) { if (hit[f.path]) addName(games[i].name); continue; }
        seen[f.path] = 1;
        if (fileOk(f)) { res.skipped++; continue; }
        try { Sys.backup(f); } catch (e) { res.failed++; res.lines.push(f.name + ': backup failed, nothing changed (' + (e.message || e) + ')'); continue; }
        r = Sys.applyValues(f, pairsFor(f), S.cfg.lock);
        if (!r.ok) { res.failed++; res.lines.push(f.name + ': ' + r.error); continue; }
        res.changed++; hit[f.path] = 1; addName(games[i].name); delete S.cfg.undone[f.path];
        for (k = 0; k < r.changes.length; k++) res.lines.push(f.name + '   ' + r.changes[k].key + ': ' + r.changes[k].before + ' -> ' + r.changes[k].after);
      }
    }
    for (k = 0; k < miss.length; k++) res.lines.push(miss[k] + ': no settings file yet (launch it once, reach the main menu, close it, then RE-CHECK)');
    save();
    return res;
  }
  function finish(res, undoId) {
    if (res.failed) setBanner('bad', 'Something did not apply. Files are unchanged where it failed.', res.lines, res.changed ? undoId : null);
    else if (res.changed) setBanner('good', 'Done. Optimized: ' + res.names.join(', ') + '. Start the game and enjoy.', res.lines, undoId);
    else if (res.skipped) setBanner('good', 'Already optimized. Nothing needed changing.', res.lines, null);
    else setBanner('warn', 'No settings files found yet. Launch a game once, reach the main menu, close it, then press RE-CHECK.', [], null);
    refreshAfter();
  }
  // optional: quietly put the value back when the game has reset it
  function autoFix() {
    var games = [], i;
    if (!S.cfg.autoReapply || !cpuKnown() || Sys.gameRunning()) return false;
    for (i = 0; i < Data.GAMES.length; i++) if (status(Data.GAMES[i]).state === 'drift') games.push(Data.GAMES[i]);
    if (!games.length) return false;
    var res = runOptimize(games);
    if (res.changed) { setBanner('good', 'The game had reset your settings file, so it was re-applied automatically: ' + res.names.join(', ') + '.', res.lines, 'all'); rescan(); return true; }
    return false;
  }
  function blockedByGame() {
    if (!cpuKnown()) { setBanner('warn', 'Your processor could not be read, so nothing was changed. Press RE-CHECK, or enter your performance-core count under Settings, Advanced.', [], null); refreshAfter(); return true; }
    return gameBlocked();
  }
  function gameBlocked() {
    if (Sys.gameRunning()) { setBanner('warn', 'Call of Duty is running. Close the game, then click again, or it will overwrite the change.', [], null); refreshAfter(); return true; }
    return false;
  }

  return {
    init: function () {
      try {
        var aw = screen.availWidth || 1320, ah = screen.availHeight || 900, w = Math.min(1320, aw), h = Math.min(900, ah);
        window.resizeTo(w, h); window.moveTo(Math.max(0, (aw - w) / 2), Math.max(0, (ah - h) / 2));
      } catch (e) { }
      var saved = Sys.loadSettings(), k;
      for (k in saved) if (saved.hasOwnProperty(k) && (S.cfg.hasOwnProperty(k) || k === 'vendorOverride' || k === 'vramOverride')) S.cfg[k] = saved[k];
      if (!S.cfg.ticks || typeof S.cfg.ticks !== 'object') S.cfg.ticks = {};
      if (!S.cfg.undone || typeof S.cfg.undone !== 'object') S.cfg.undone = {};
      $('foot').innerHTML = '<div class="footer">Edits only the config value shown, in your own settings files. Does not touch the game, its memory, or its install folder. Not affiliated with Activision. v' + Data.VERSION + '</div>';
      S.keepBanner = false; setBg(); renderTop(); $('hero').innerHTML = heroHtml(); renderBody();
      setTimeout(function () {
        detect(); rescan(); S.ready = true;
        var fixed = autoFix();
        S.keepBanner = fixed;
        UI.go('home');
        if (S.cfg.checkUpdates && Core.validRepo(Config.REPO)) setTimeout(function () { UI.checkUpdate(true); }, 1500);
      }, 60);
      // when you come back from the game, re-read the files so a reset value shows up as RE-APPLY
      window.onfocus = function () { UI.refresh(); };
    },
    refresh: function () {
      var now = new Date().getTime();
      if (!S.ready || now - S.lastFocus < 2500 || S.tab === 'settings' || S.tab === 'about') return;
      S.lastFocus = now; rescan(); autoFix(); renderBody();
    },
    go: function (id) {
      S.tab = id; if (!S.keepBanner) S.banner = null; S.keepBanner = false; setBg(); renderTop();
      $('hero').innerHTML = heroHtml();
      var b = $('body'); b.className = 'enter'; renderBody(); renderToast();
      $('main').scrollTop = 0;
      setTimeout(function () { if (S.tab === id) b.className = ''; }, 1300);
    },
    jump: function () {
      try { var r = $('presets').getBoundingClientRect(), m = $('main').getBoundingClientRect(); $('main').scrollTop += r.top - m.top - 16; } catch (e) { }
    },
    setPreset: function (p) {
      S.cfg.preset = p; save();
      var g = game(S.tab); if (g && $('presets')) $('presets').innerHTML = checklistCard(g); else renderBody();
    },
    tick: function (i) {
      var g = game(S.tab), pk = presetFor(g), rows = Data.rows(g, pk, ctx()), k = tickKey(g, rows[i]), row = $('r' + i), j, done = 0, pct;
      if (S.cfg.ticks[k]) delete S.cfg.ticks[k]; else S.cfg.ticks[k] = 1;
      save();
      if (row) row.className = 'item' + (S.cfg.ticks[k] ? ' done' : '');
      for (j = 0; j < rows.length; j++) if (S.cfg.ticks[tickKey(g, rows[j])]) done++;
      pct = rows.length ? Math.round(done * 100 / rows.length) : 0;
      if ($('pcount')) $('pcount').innerHTML = done + ' of ' + rows.length + ' done.';
      if ($('pbar')) $('pbar').style.width = pct + '%';
    },
    clearTicks: function () {
      var g = game(S.tab), rows = Data.rows(g, presetFor(g), ctx()), i;
      for (i = 0; i < rows.length; i++) delete S.cfg.ticks[tickKey(g, rows[i])];
      save(); if ($('presets')) $('presets').innerHTML = checklistCard(g); else renderBody();
    },
    setVendor: function (v) { S.cfg.vendorOverride = v; save(); detect(); renderBody(); },
    setVram: function (v) { S.cfg.vramOverride = v; save(); detect(); renderBody(); },
    setMode: function (m) { S.cfg.mode = m; save(); renderBody(); },
    setP: function (v) { S.cfg.manualP = String(v).replace(/[^0-9]/g, ''); save(); renderBody(); },
    setLock: function (b) { S.cfg.lock = !!b; save(); renderBody(); },
    // Plain-text report of what the app detected, for troubleshooting. No user name or file contents are included.
    diag: function () {
      var h = S.hw, g = h.gpu, f = (S.scan && S.scan.files) || [], i, w, t = 'CoD Configurator v' + Data.VERSION + '\r\n';
      t += 'OS: ' + h.os + '  RAM: ' + h.ramGB + ' GB\r\n';
      t += 'CPU: ' + S.cpu.name + ' | cores ' + S.cpu.cores + ' | threads ' + S.cpu.logical + ' | performance cores ' + S.advice.pcores + ' | hybrid ' + S.advice.hybrid + ' | will write ' + target() + '\r\n';
      t += 'GPU: ' + (g ? g.name + ' | ' + g.vramGB + ' GB | ' + g.vendor + ' | driver ' + g.driver : 'not detected') + '\r\n';
      t += 'Display: ' + h.display.w + 'x' + h.display.h + ' @ ' + h.display.hz + ' Hz\r\n';
      t += 'Detected via: cpu ' + S.src.cpu + ', gpu ' + S.src.gpu + ', display ' + S.src.display + ', ram ' + S.src.ram + ', os ' + S.src.os + '\r\n';
      var lg = Sys.detectLog(); for (i = 0; i < lg.length; i++) t += 'Note: ' + lg[i] + '\r\n';
      t += 'Settings files (' + f.length + '):\r\n';
      for (i = 0; i < f.length; i++) t += '  ' + f[i].loc + ' | ' + f[i].name + ' | ' + f[i].code + ' | key found ' + f[i].hasKey + ' | value ' + f[i].value + ' | read-only ' + f[i].ro + '\r\n';
      if (S.scan && S.scan.error) t += 'Scan note: ' + S.scan.error + '\r\n';
      t += 'Windows checks:\r\n';
      for (i = 0; i < S.win.length; i++) { w = S.win[i]; t += '  ' + w.label + ': ' + w.state + ' - ' + w.text + '\r\n'; }
      setBanner(Sys.copy(t) ? 'good' : 'warn', Sys.copy(t) ? 'Report copied. Paste it into a message to share what the app detected.' : 'Could not access the clipboard.', [], null);
      renderBody(); showBanner();
    },
    setAutoReapply: function (b) { S.cfg.autoReapply = !!b; save(); renderBody(); },
    setApplyVram: function (b) { S.cfg.applyVram = !!b; save(); renderBody(); },
    setCheckUpdates: function (b) { S.cfg.checkUpdates = !!b; save(); },
    open: function (u) { Sys.openUrl(u); },
    openSetting: function (id) { Sys.openSetting(id); },
    openFolder: function (w) { Sys.openFolder(w); },
    openAssets: function () { Sys.openAssets(); },
    refreshArt: function () { imgCache = {}; UI.go(S.tab); },
    redetect: function () {
      S.ready = false; $('hero').innerHTML = heroHtml(); renderBody();
      setTimeout(function () {
        Sys.resetProbe(); detect(); rescan(); S.ready = true;
        setBanner(detectedAll() ? 'good' : 'warn', detectedAll() ? 'Re-checked your PC and settings files.' : 'Re-checked, but some parts still could not be read.', [], null);
        $('hero').innerHTML = heroHtml(); renderTop(); renderBody(); showBanner();
      }, 40);
    },

    optimizeGame: function (id) {
      var g = game(id);
      if (!g || blockedByGame()) return;
      finish(runOptimize([g]), id);
    },
    optimizeAll: function () {
      if (blockedByGame()) return;
      var games = [], i;
      for (i = 0; i < Data.GAMES.length; i++) if (Data.GAMES[i].config) games.push(Data.GAMES[i]);
      finish(runOptimize(games), 'all');
    },
    undo: function (id) {
      var games = [], files, i, j, f, r, n = 0, lines = [], seen = {}, bad = 0;
      if (gameBlocked()) return;
      for (i = 0; i < Data.GAMES.length; i++) if (id === 'all' || Data.GAMES[i].id === id) games.push(Data.GAMES[i]);
      for (i = 0; i < games.length; i++) {
        files = filesFor(games[i]);
        for (j = 0; j < files.length; j++) {
          f = files[j]; if (seen[f.path] || !f.bak) continue; seen[f.path] = 1;
          r = Sys.restore(f);
          if (r.ok) { n++; S.cfg.undone[f.path] = 1; lines.push(f.name + ' restored to the version before the last change'); } else { bad++; lines.push(f.name + ': ' + r.error); }
        }
      }
      if (bad) setBanner('bad', 'Some files could not be restored.', lines, null);
      else if (n) { save(); setBanner('good', 'Undone. The previous version of your settings file is back.', lines, null); }
      else setBanner('warn', 'There is no backup to restore yet.', [], null);
      refreshAfter();
    },
    copyPreset: function () {
      var g = game(S.tab), rows = Data.rows(g, presetFor(g), ctx()), t = g.name + ' - ' + Data.PRESETS[presetFor(g)].label + '\r\n', i;
      for (i = 0; i < rows.length; i++) t += rows[i].setting + ': ' + rows[i].value + '\r\n';
      setBanner(Sys.copy(t) ? 'good' : 'warn', Sys.copy(t) ? 'Settings copied to the clipboard.' : 'Could not access the clipboard.', [], null);
      renderBody(); showBanner();
    },

    checkUpdate: function (silent) {
      if (S.checking) return;
      function run() {
        var r = Sys.latestRelease(Config.REPO);
        S.dl = null; S.checking = false;
        if (r.ok) r.newer = Core.compareVersions(r.tag, Data.VERSION) > 0;
        if (silent && (!r.ok || !r.newer)) { if (S.tab === 'settings') renderBody(); return; }
        S.upd = r; renderTop(); renderToast(); if (S.tab === 'settings') renderBody();
      }
      if (silent) { S.checking = true; run(); return; }
      S.checking = true; if (S.tab === 'settings') renderBody();
      setTimeout(run, 40);
    },
    dismissToast: function () { S.toastOff = true; renderToast(); },
    downloadUpdate: function () {
      if (!S.upd || !S.upd.assetUrl) return;
      S.dl = Sys.downloadUpdate(S.upd.assetUrl, S.upd.tag); renderBody();
    },
    showDl: function () { if (S.dl && S.dl.ok) Sys.openPath(S.dl.path); },
    _state: S
  };
})();
