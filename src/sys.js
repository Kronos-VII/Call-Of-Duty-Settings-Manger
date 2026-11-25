/* sys.js - the only file that touches Windows (FSO / ADODB / WMI / registry reads / HTTP).
   Hardware detection uses built-in Windows APIs only: no drivers are installed or loaded.
   Falls back to an in-memory mock in a normal browser so the UI can be previewed and tested. ES5. */
var Sys = (function () {
  var real = false, fso = null, shell = null;
  try { fso = new ActiveXObject('Scripting.FileSystemObject'); shell = new ActiveXObject('WScript.Shell'); real = true; } catch (e) { real = false; }

  var HKLM = 2147483650;
  // Only these Windows pages can ever be opened from the app.
  var SETTINGS_PAGES = {
    gamemode: 'ms-settings:gaming-gamemode',
    power: 'ms-settings:powersleep',
    hags: 'ms-settings:display-advancedgraphics',
    gamebar: 'ms-settings:gaming-gamebar',
    coreiso: 'windowsdefender://coreisolation',
    tpm: 'tpm.msc'
  };
  var GPU_CLASS = 'SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11cd-bfc1-08002be10318}';

  // ---------- mock (browser preview only) ----------
  var mockFiles = {
    'options.3.cod24.cst': 'SomeSetting = "1"\r\nRendererWorkerCount = "16"\r\nVideoMemoryScale = "0.9"\r\n',
    'options.4.cod25.cst': 'A = "1"\r\nRendererWorkerCount = "16"\r\nVideoMemoryScale = "0.9"\r\nB = "2"\r\n',
    's.1.0.cod25.txt': 'NoWorkerKeyHere = "1"\r\n',
    'options.5.cod26.cst': 'RendererWorkerCount = "12"\r\nVideoMemoryScale = "0.9"\r\n'
  };
  var mockRO = {}, mockBackups = [], mockSettings = {};

  // ---------- real helpers ----------
  function docsDir() { return shell.SpecialFolders('MyDocuments'); }
  function playersDir() { return docsDir() + '\\Call of Duty\\players'; }
  function localPlayersDir() { return shell.ExpandEnvironmentStrings('%LOCALAPPDATA%') + '\\Activision\\Call of Duty\\players'; }
  // Guides name two places for the settings file, so both are checked.
  function locations() { return [{ loc: 'docs', dir: playersDir() }, { loc: 'local', dir: localPlayersDir() }]; }
  function backupDir() {
    var d = dataDir() + '\\backups';
    if (!fso.FolderExists(d)) fso.CreateFolder(d);
    return d;
  }
  function regRead(p) { try { return shell.RegRead(p); } catch (e) { return null; } }
  function shellOut(cmd) {
    try {
      var tmp = shell.ExpandEnvironmentStrings('%TEMP%') + '\\cod_cfg_out.txt';
      shell.Run('cmd /c ' + cmd + ' > "' + tmp + '" 2>nul', 0, true);
      if (!fso.FileExists(tmp)) return '';
      var ts = fso.OpenTextFile(tmp, 1), txt = ts.AtEndOfStream ? '' : ts.ReadAll(); ts.Close(); fso.DeleteFile(tmp, true);
      return txt;
    } catch (e) { return ''; }
  }

  function appDir() {
    try {
      var p = decodeURIComponent(location.pathname || '').replace(/\//g, '\\').replace(/^\\(?=[A-Za-z]:)/, '');
      return p.substr(0, p.lastIndexOf('\\'));
    } catch (e) { return ''; }
  }
  function dataDir() {
    var d = shell.ExpandEnvironmentStrings('%APPDATA%') + '\\CoDConfigurator';
    if (!fso.FolderExists(d)) fso.CreateFolder(d);
    return d;
  }

  function readRaw(path) {
    var s = new ActiveXObject('ADODB.Stream');
    s.Type = 2; s.Charset = 'iso-8859-1'; s.Open(); s.LoadFromFile(path);
    var latin = s.ReadText(); s.Close();
    var hasBom = latin.substr(0, 3) === '\u00EF\u00BB\u00BF';
    var u = new ActiveXObject('ADODB.Stream');
    u.Type = 2; u.Charset = 'utf-8'; u.Open(); u.LoadFromFile(path);
    var text = u.ReadText(); u.Close();
    return { text: text, bom: hasBom, bad: text.indexOf('\uFFFD') >= 0 };
  }

  function writeRaw(path, text, bom) {
    var a = new ActiveXObject('ADODB.Stream');
    a.Type = 2; a.Charset = 'utf-8'; a.Open(); a.WriteText(text);
    if (bom) { a.SaveToFile(path, 2); a.Close(); return; }
    a.Position = 0; a.Type = 1; a.Position = 3;       // ADODB always writes a BOM for utf-8: skip 3 bytes
    var b = new ActiveXObject('ADODB.Stream');
    b.Type = 1; b.Open(); a.CopyTo(b); a.Close();
    b.SaveToFile(path, 2); b.Close();
  }

  function isRO(path) { return (fso.GetFile(path).Attributes & 1) === 1; }
  function setRO(path, on) {
    var f = fso.GetFile(path);
    if (on) f.Attributes = f.Attributes | 1; else if (f.Attributes & 1) f.Attributes = f.Attributes - 1;
  }

  // ----- detection helpers (all read-only) -----
  // Three independent routes are tried in order so one broken route never leaves the app blind:
  //   1. WMI (built into Windows)   2. a read-only PowerShell query   3. plain registry / reg.exe reads
  var detLog = [], svcCache = {}, psCache, probeCache = null;
  function note(s) { detLog.push(s); }
  function errText(e) { return String((e && (e.message || e.description)) || e); }

  function connect(ns) {
    if (svcCache[ns]) return svcCache[ns];
    var s = null;
    try { s = new ActiveXObject('WbemScripting.SWbemLocator').ConnectServer('.', ns); } catch (e1) {
      try { s = GetObject('winmgmts:\\\\.\\' + ns); } catch (e2) { note('WMI could not connect to ' + ns + ': ' + errText(e2)); }
    }
    svcCache[ns] = s;
    return s;
  }
  // Returns plain JS objects (property name -> value) so callers never touch COM objects directly.
  function wmiRows(query, ns) {
    var svc = connect(ns || 'root\\cimv2'), out = [], e, it, o, pe, p;
    if (!svc) throw new Error('WMI unavailable');
    e = new Enumerator(svc.ExecQuery(query));
    for (; !e.atEnd(); e.moveNext()) {
      it = e.item(); o = {}; pe = new Enumerator(it.Properties_);
      for (; !pe.atEnd(); pe.moveNext()) { p = pe.item(); try { o[p.Name] = p.Value; } catch (e3) { } }
      out.push(o);
    }
    return out;
  }

  var PS_SCRIPT = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$r = @{}",
    "$r.cpu = @(Get-CimInstance Win32_Processor | ForEach-Object { @{ Name = $_.Name; Cores = [int]$_.NumberOfCores; Logical = [int]$_.NumberOfLogicalProcessors } })",
    "$r.gpu = @(Get-CimInstance Win32_VideoController | ForEach-Object { @{ Name = $_.Name; Ram = [string]$_.AdapterRAM; Driver = $_.DriverVersion; Hz = [int]$_.CurrentRefreshRate; W = [int]$_.CurrentHorizontalResolution; H = [int]$_.CurrentVerticalResolution } })",
    "$r.ram = [string](Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
    "$r.os = [string](Get-CimInstance Win32_OperatingSystem).Caption",
    "$r.vram = @(Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11cd-bfc1-08002be10318}' | ForEach-Object { $p = Get-ItemProperty $_.PSPath; if ($p.DriverDesc) { $m = $p.'HardwareInformation.qwMemorySize'; if ($m -is [byte[]]) { $m = [BitConverter]::ToUInt64($m, 0) }; @{ Desc = $p.DriverDesc; Mem = [string]$m } } })",
    "$r | ConvertTo-Json -Depth 5 -Compress"
  ].join('\r\n');

  function psData() {
    if (psCache !== undefined) return psCache;
    psCache = null;
    var tmp = shell.ExpandEnvironmentStrings('%TEMP%'), ps1 = tmp + '\\cod_cfg_probe.ps1', out = tmp + '\\cod_cfg_probe.json', txt = '', f, ts;
    try {
      f = fso.CreateTextFile(ps1, true, false); f.Write(PS_SCRIPT); f.Close();
      shell.Run('cmd /c powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ps1 + '" > "' + out + '" 2>nul', 0, true);
      if (fso.FileExists(out)) { ts = fso.OpenTextFile(out, 1, false); txt = ts.AtEndOfStream ? '' : ts.ReadAll(); ts.Close(); }
      txt = txt.replace(/^[^{]*/, '');
      if (txt) psCache = JSON.parse(txt); else note('PowerShell returned nothing');
    } catch (e) { note('PowerShell probe failed: ' + errText(e)); }
    try { if (fso.FileExists(ps1)) fso.DeleteFile(ps1, true); if (fso.FileExists(out)) fso.DeleteFile(out, true); } catch (e2) { }
    return psCache;
  }
  function arr(x) { return x == null ? [] : (Object.prototype.toString.call(x) === '[object Array]' ? x : [x]); }

  // Route 3: registry only. reg.exe is used because WScript's RegRead cannot read 64-bit (QWORD) values.
  function regQuery(key, name) {
    var txt = shellOut('reg query "' + key + '" /v ' + name), m = new RegExp(name.replace(/\./g, '\\.') + '\\s+REG_\\w+\\s+(.+)', 'i').exec(txt);
    return m ? m[1].replace(/\s+$/, '') : null;
  }
  function regGpus() {
    var out = [], i, k, d, mem, base = 'HKLM\\' + GPU_CLASS;
    for (i = 0; i < 12; i++) {
      k = base + '\\' + ('000' + i).slice(-4);
      d = regRead(k + '\\DriverDesc');
      if (!d) continue;
      mem = regQuery(k, 'HardwareInformation.qwMemorySize');
      out.push({ name: String(d), vramGB: mem && /^0x/i.test(mem) ? Core.bytesToGB(parseInt(mem, 16)) : 0, driver: String(regRead(k + '\\DriverVersion') || '') });
    }
    return out;
  }
  function regCpuName() { var n = regRead('HKLM\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0\\ProcessorNameString'); return n ? String(n).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '') : ''; }
  function regOsName() {
    var n = regRead('HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProductName'), b = parseInt(regRead('HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\CurrentBuild'), 10) || 0;
    if (!n) return '';
    n = String(n);
    if (b >= 22000) n = n.replace('Windows 10', 'Windows 11');
    return 'Microsoft ' + n;
  }

  // Runs every probe once and remembers the answer (Sys.resetProbe() forces a fresh run).
  function runProbe() {
    var P = { cpu: { name: '', cores: 0, logical: 0, source: 'none' }, gpuList: [], display: { w: 0, h: 0, hz: 0 }, ramGB: 0, os: '', src: { cpu: 'none', gpu: 'none', display: 'none', ram: 'none', os: 'none' } }, rows, i, ps, vr, list, g;
    detLog = []; psCache = undefined; svcCache = {};

    // --- route 1: WMI ---
    try {
      rows = wmiRows('select Name,NumberOfCores,NumberOfLogicalProcessors from Win32_Processor');
      for (i = 0; i < rows.length; i++) { if (!P.cpu.name) P.cpu.name = String(rows[i].Name || ''); P.cpu.cores += rows[i].NumberOfCores || 0; P.cpu.logical += rows[i].NumberOfLogicalProcessors || 0; }
      if (P.cpu.cores) P.src.cpu = 'WMI';
    } catch (e1) { note('WMI processor query failed: ' + errText(e1)); }
    try {
      rows = wmiRows('select Name,AdapterRAM,DriverVersion,CurrentRefreshRate,CurrentHorizontalResolution,CurrentVerticalResolution from Win32_VideoController');
      for (i = 0; i < rows.length; i++) {
        P.gpuList.push({ name: String(rows[i].Name || ''), vramGB: Core.bytesToGB(rows[i].AdapterRAM), driver: String(rows[i].DriverVersion || '') });
        if (rows[i].CurrentHorizontalResolution && rows[i].CurrentRefreshRate && !P.display.hz) P.display = { w: rows[i].CurrentHorizontalResolution, h: rows[i].CurrentVerticalResolution, hz: rows[i].CurrentRefreshRate };
        else if (rows[i].CurrentHorizontalResolution && !P.display.w) P.display = { w: rows[i].CurrentHorizontalResolution, h: rows[i].CurrentVerticalResolution, hz: 0 };
      }
      if (P.gpuList.length) { P.src.gpu = 'WMI'; if (P.display.w) P.src.display = 'WMI'; }
    } catch (e2) { note('WMI video query failed: ' + errText(e2)); }
    try { rows = wmiRows('select TotalPhysicalMemory from Win32_ComputerSystem'); if (rows.length) { P.ramGB = Math.round(Core.bytesToGB(rows[0].TotalPhysicalMemory)); if (P.ramGB) P.src.ram = 'WMI'; } } catch (e3) { note('WMI memory query failed: ' + errText(e3)); }
    try { rows = wmiRows('select Caption from Win32_OperatingSystem'); if (rows.length) { P.os = String(rows[0].Caption || ''); if (P.os) P.src.os = 'WMI'; } } catch (e4) { note('WMI OS query failed: ' + errText(e4)); }

    // --- route 2: PowerShell, only for what route 1 could not read (also gives the real 64-bit VRAM size) ---
    if (!P.cpu.cores || !P.gpuList.length || !P.ramGB || !P.display.hz || !P.os) {
      ps = psData();
      if (ps) {
        if (!P.cpu.cores) { rows = arr(ps.cpu); for (i = 0; i < rows.length; i++) { if (!P.cpu.name) P.cpu.name = String(rows[i].Name || ''); P.cpu.cores += rows[i].Cores || 0; P.cpu.logical += rows[i].Logical || 0; } if (P.cpu.cores) P.src.cpu = 'PowerShell'; }
        if (!P.gpuList.length) { rows = arr(ps.gpu); for (i = 0; i < rows.length; i++) P.gpuList.push({ name: String(rows[i].Name || ''), vramGB: Core.bytesToGB(rows[i].Ram), driver: String(rows[i].Driver || '') }); if (P.gpuList.length) P.src.gpu = 'PowerShell'; }
        if (!P.display.hz) { rows = arr(ps.gpu); for (i = 0; i < rows.length; i++) if (rows[i].W && rows[i].Hz) { P.display = { w: rows[i].W, h: rows[i].H, hz: rows[i].Hz }; P.src.display = 'PowerShell'; break; } }
        if (!P.ramGB && ps.ram) { P.ramGB = Math.round(Core.bytesToGB(ps.ram)); if (P.ramGB) P.src.ram = 'PowerShell'; }
        if (!P.os && ps.os) { P.os = String(ps.os); P.src.os = 'PowerShell'; }
      }
    }

    // --- route 3: registry ---
    if (!P.cpu.name) P.cpu.name = regCpuName();
    if (!P.cpu.cores) {
      P.cpu.logical = parseInt(shell.ExpandEnvironmentStrings('%NUMBER_OF_PROCESSORS%'), 10) || 0;
      if (P.cpu.logical) {
        // physical core count is not in the registry: assume Hyper-Threading / SMT (true for nearly every current CPU). Flagged as an estimate.
        P.cpu.cores = Math.max(1, Math.round(P.cpu.logical / 2)); P.src.cpu = 'estimate'; note('CPU core count is an estimate (WMI and PowerShell were both unavailable)');
      }
    } else if (!P.cpu.name) P.cpu.name = '';
    if (!P.gpuList.length) { try { P.gpuList = regGpus(); if (P.gpuList.length) P.src.gpu = 'registry'; } catch (e5) { note('Registry GPU read failed: ' + errText(e5)); } }
    if (!P.os) { P.os = regOsName(); if (P.os) P.src.os = 'registry'; }
    if (!P.display.w) { try { P.display = { w: Math.round(screen.width * ((screen.deviceXDPI || 96) / 96)), h: Math.round(screen.height * ((screen.deviceYDPI || 96) / 96)), hz: 0 }; P.src.display = 'estimate'; } catch (e6) { } }

    // --- real VRAM size: the driver's 64-bit value beats WMI's 4 GB-capped field ---
    try {
      vr = (psCache && psCache.vram) ? arr(psCache.vram) : null;
      if (!vr) { vr = []; list = regGpus(); for (i = 0; i < list.length; i++) vr.push({ Desc: list[i].name, Mem: list[i].vramGB * 1073741824 }); }
      for (i = 0; i < P.gpuList.length; i++) {
        for (g = 0; g < vr.length; g++) if (String(vr[g].Desc) === P.gpuList[i].name && parseFloat(vr[g].Mem) > 0) { P.gpuList[i].vramGB = Core.bytesToGB(vr[g].Mem); break; }
      }
    } catch (e7) { note('VRAM read failed: ' + errText(e7)); }
    return P;
  }
  function probe() {
    if (!probeCache) {
      try { probeCache = runProbe(); } catch (e) {
        note('Detection crashed: ' + errText(e));
        probeCache = { cpu: { name: '', cores: 0, logical: 0 }, gpuList: [], display: { w: 0, h: 0, hz: 0 }, ramGB: 0, os: '', src: { cpu: 'none', gpu: 'none', display: 'none', ram: 'none', os: 'none' } };
      }
    }
    return probeCache;
  }

  // nvidia-smi ships with NVIDIA drivers; output is captured to a temp file so no console window flashes.
  function nvidiaSmiVram() {
    try {
      var tmp = shell.ExpandEnvironmentStrings('%TEMP%') + '\\cod_cfg_smi.txt';
      shell.Run('cmd /c nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits > "' + tmp + '" 2>nul', 0, true);
      if (!fso.FileExists(tmp)) return null;
      var ts = fso.OpenTextFile(tmp, 1), txt = ts.AtEndOfStream ? '' : ts.ReadAll(); ts.Close(); fso.DeleteFile(tmp, true);
      var m = /,\s*(\d+)\s*$/m.exec(txt);
      return m ? Math.round(parseInt(m[1], 10) / 102.4) / 10 : null;
    } catch (e) { return null; }
  }

  return {
    isReal: function () { return real; },
    appDir: function () { return real ? appDir() : '(browser preview)'; },

    // ---------- hardware ----------
    resetProbe: function () { probeCache = null; },
    detectLog: function () { return detLog.slice(0); },
    sources: function () { return real ? probe().src : { cpu: 'preview', gpu: 'preview', display: 'preview', ram: 'preview', os: 'preview' }; },

    cpu: function () {
      if (!real) return { name: '12th Gen Intel(R) Core(TM) i7-12700K', cores: 12, logical: 20 };
      var c = probe().cpu;
      return { name: String(c.name || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''), cores: c.cores, logical: c.logical };
    },

    // returns { gpu:{name,vramGB,vendor,integrated,driver}|null, display:{w,h,hz}, ramGB, secureBoot, os, detected:bool }
    hardware: function () {
      if (!real) {
        return { gpu: { name: 'NVIDIA GeForce RTX 3070', vramGB: 8, vendor: 'nvidia', integrated: false, driver: '32.0.15.8' }, display: { w: 2560, h: 1440, hz: 165 }, ramGB: 32, secureBoot: true, os: 'Microsoft Windows 11 Pro', detected: true };
      }
      var P = probe(), hw = { gpu: Core.pickGpu(P.gpuList), display: P.display, ramGB: P.ramGB, secureBoot: null, os: P.os, detected: false };
      try { if (hw.gpu && hw.gpu.vendor === 'nvidia' && hw.gpu.vramGB <= 4) { var sm = nvidiaSmiVram(); if (sm) hw.gpu.vramGB = sm; } } catch (e1) { }
      try { hw.secureBoot = shell.RegRead('HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State\\UEFISecureBootEnabled') === 1; } catch (e4) { hw.secureBoot = null; }
      hw.detected = !!hw.gpu;
      return hw;
    },

    gameRunning: function () {
      if (!real) return false;
      try {
        return wmiRows("select Name from Win32_Process where Name = 'cod.exe' or Name like 'BlackOps%' or Name like 'ModernWarfare%' or Name like 'Warzone%'").length > 0;
      } catch (err) {
        // WMI not usable: fall back to tasklist
        try { return /cod\.exe|BlackOps|ModernWarfare|Warzone/i.test(shellOut('tasklist /fo csv /nh')); } catch (e2) { return false; }
      }
    },

    // ---------- app settings (JSON in %APPDATA%\CoDConfigurator) ----------
    loadSettings: function () {
      if (!real) return mockSettings;
      try {
        var p = dataDir() + '\\settings.json';
        if (!fso.FileExists(p)) return {};
        var raw = readRaw(p);
        return raw.bad ? {} : JSON.parse(raw.text);
      } catch (e) { return {}; }
    },
    saveSettings: function (obj) {
      if (!real) { mockSettings = obj; return true; }
      try { writeRaw(dataDir() + '\\settings.json', JSON.stringify(obj), false); return true; } catch (e) { return false; }
    },

    // ---------- custom art (drop images into the assets folder next to the app) ----------
    assetsDir: function () { return real ? appDir() + '\\assets' : '(browser preview)\\assets'; },
    imageFor: function (name) {
      var ext = ['jpg', 'jpeg', 'png'], i;
      if (!real) return 'assets/' + name + '.jpg';   // browser preview only
      for (i = 0; i < ext.length; i++) if (fso.FileExists(appDir() + '\\assets\\' + name + '.' + ext[i])) return 'assets/' + name + '.' + ext[i];
      return null;
    },
    openAssets: function () {
      if (!real) return;
      try { var d = appDir() + '\\assets'; if (!fso.FolderExists(d)) fso.CreateFolder(d); shell.Run('explorer.exe "' + d + '"'); } catch (e) { }
    },

    // ---------- config files ----------
    folder: function () { return real ? playersDir() : 'C:\\Users\\Preview\\Documents\\Call of Duty\\players'; },
    backupFolder: function () { return real ? backupDir() : 'C:\\Users\\Preview\\AppData\\Roaming\\CoDConfigurator\\backups'; },

    scan: function () {
      var out = { ok: true, folder: this.folder(), files: [], error: '' }, k, L, j;
      function info(loc, name, path, code, text, ro) {
        return { loc: loc, name: name, path: path, code: code, hasKey: Core.hasKey(text), value: Core.getKey(text),
          hasVram: Core.hasKey(text, Core.VRAM_KEY), vramValue: Core.getKey(text, Core.VRAM_KEY), ro: ro };
      }
      if (!real) {
        for (k in mockFiles) if (mockFiles.hasOwnProperty(k)) out.files.push(info('docs', k, k, Core.gameCode(k), mockFiles[k], !!mockRO[k]));
        return out;
      }
      try {
        L = locations();
        var any = false;
        for (j = 0; j < L.length; j++) {
          if (!fso.FolderExists(L[j].dir)) continue;
          any = true;
          var en = new Enumerator(fso.GetFolder(L[j].dir).Files);
          for (; !en.atEnd(); en.moveNext()) {
            var f = en.item(), code = Core.gameCode(f.Name);
            if (!code) continue;
            var rec = { loc: L[j].loc, name: f.Name, path: f.Path, code: code, hasKey: false, value: null, hasVram: false, vramValue: null, ro: (f.Attributes & 1) === 1 };
            try { var r = readRaw(f.Path); if (!r.bad) rec = info(L[j].loc, f.Name, f.Path, code, r.text, rec.ro); } catch (e2) { }
            out.files.push(rec);
          }
        }
        if (!any) { out.ok = false; out.error = 'No Call of Duty settings folder found yet. Launch a game once, reach the main menu, close it, then press Re-detect.'; }
      } catch (err) { out.ok = false; out.error = String(err.message || err); }
      return out;
    },

    // ---------- read-only Windows checks (nothing is changed) ----------
    winChecks: function () {
      var out = [], v, t, rows;
      if (!real) {
        return [
          { id: 'gamemode', label: 'Game Mode', state: 'ok', text: 'On', open: 'gamemode' },
          { id: 'power', label: 'Power plan', state: 'warn', text: 'Balanced. Guides want Best performance (Win 11) or High performance.', open: 'power' },
          { id: 'hags', label: 'Hardware GPU scheduling', state: 'info', text: 'On. Hone says On, Tier1Settings says test both.', open: 'hags' },
          { id: 'gamebar', label: 'Game Bar background recording', state: 'warn', text: 'On. Frozen Tweaks says turn it off.', open: 'gamebar' },
          { id: 'ram', label: 'Memory speed', state: 'warn', text: 'Running at 2133 MT/s. Enable XMP / EXPO in BIOS if your kit is faster.', open: '' },
          { id: 'secure', label: 'Secure Boot', state: 'ok', text: 'On (MW4 requires it)', open: '' },
          { id: 'tpm', label: 'TPM 2.0', state: 'ok', text: 'Present (MW4 requires it)', open: 'tpm' },
          { id: 'vbs', label: 'Memory Integrity / VBS', state: 'info', text: 'On. Some guides turn it off for FPS but that lowers security, so the app leaves it alone.', open: 'coreiso' }
        ];
      }
      v = regRead('HKCU\\Software\\Microsoft\\GameBar\\AutoGameModeEnabled');
      out.push({ id: 'gamemode', label: 'Game Mode', state: v === 0 ? 'warn' : 'ok', text: v === 0 ? 'Off. Guides say turn it On.' : 'On', open: 'gamemode' });

      t = shellOut('powercfg /getactivescheme');
      if (t) {
        // GUIDs are the same on every language of Windows
        v = /8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c|e9a42b02-d5df-448d-aa00-03f14749eb61/i.test(t) ? 'high' : (/381b4222-f694-41f0-9685-ff5bb260df2e/i.test(t) ? 'balanced' : (/a1841308-3541-4fab-bc81-f71556f20b4a/i.test(t) ? 'saver' : 'other'));
        out.push({ id: 'power', label: 'Power plan', state: v === 'high' ? 'ok' : (v === 'other' ? 'info' : 'warn'), text: v === 'high' ? 'High performance' : (v === 'other' ? 'Custom plan' : (v === 'balanced' ? 'Balanced. Guides want Best performance (Win 11 power mode) or the High performance plan.' : 'Power saver. Guides want Best performance or High performance.')), open: 'power' });
      }

      v = regRead('HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\HwSchMode');
      out.push({ id: 'hags', label: 'Hardware GPU scheduling', state: 'info', text: v === 2 ? 'On. Hone says On, Tier1Settings says test both.' : (v === 1 ? 'Off. Hone says On, Tier1Settings says test both.' : 'Not supported by this GPU or driver'), open: v === null ? '' : 'hags' });

      v = regRead('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR\\AppCaptureEnabled');
      if (v !== null) out.push({ id: 'gamebar', label: 'Game Bar background recording', state: v === 1 ? 'warn' : 'ok', text: v === 1 ? 'On. Frozen Tweaks says turn it off.' : 'Off', open: 'gamebar' });

      try {
        rows = wmiRows('select ConfiguredClockSpeed,SMBIOSMemoryType from Win32_PhysicalMemory');
        if (rows.length) {
          var spd = rows[0].ConfiguredClockSpeed || 0, typ = rows[0].SMBIOSMemoryType, slow = (typ === 34 && spd <= 4800) || (typ === 26 && spd <= 2666) || (typ !== 34 && typ !== 26 && spd <= 2133);
          if (spd) out.push({ id: 'ram', label: 'Memory speed', state: slow ? 'warn' : 'ok', text: 'Running at ' + spd + ' MT/s.' + (slow ? ' If your kit is rated faster, enable XMP / EXPO in BIOS.' : ''), open: '' });
        }
      } catch (e1) { }

      v = regRead('HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State\\UEFISecureBootEnabled');
      out.push({ id: 'secure', label: 'Secure Boot', state: v === 1 ? 'ok' : (v === 0 ? 'warn' : 'info'), text: v === 1 ? 'On (MW4 requires it)' : (v === 0 ? 'Off. MW4 requires it for online play.' : 'Could not read it'), open: '' });

      try {
        var tr = wmiRows('select SpecVersion,IsEnabled_InitialValue from Win32_Tpm', 'root\\cimv2\\Security\\MicrosoftTpm'), tv = tr.length ? tr[0] : null;
        out.push({ id: 'tpm', label: 'TPM 2.0', state: tv && /^2\.0/.test(String(tv.SpecVersion)) && tv.IsEnabled_InitialValue ? 'ok' : (tv ? 'warn' : 'info'), text: tv ? (/^2\.0/.test(String(tv.SpecVersion)) ? 'Present (MW4 requires it)' : 'Not 2.0. MW4 requires TPM 2.0.') : 'Could not read it', open: 'tpm' });
      } catch (e2) { out.push({ id: 'tpm', label: 'TPM 2.0', state: 'info', text: 'Could not read it here. Open tpm.msc to check.', open: 'tpm' }); }

      try {
        var dr = wmiRows('select VirtualizationBasedSecurityStatus from Win32_DeviceGuard', 'root\\Microsoft\\Windows\\DeviceGuard');
        if (dr.length) out.push({ id: 'vbs', label: 'Memory Integrity / VBS', state: 'info', text: dr[0].VirtualizationBasedSecurityStatus === 2 ? 'On. Some guides turn it off for FPS but that lowers security, so the app leaves it alone.' : 'Off', open: 'coreiso' });
      } catch (e3) { }
      return out;
    },

    openSetting: function (id) {
      if (!real || !SETTINGS_PAGES.hasOwnProperty(id)) return;
      try { shell.Run(SETTINGS_PAGES[id]); } catch (e) { }
    },

    backup: function (file) {
      var stamp = Core.stamp();
      if (!real) { mockBackups.push({ name: file.name, stamp: stamp, text: mockFiles[file.name] }); return file.name + '.' + stamp + '.bak'; }
      var dest = backupDir() + '\\' + (file.loc || 'docs') + '__' + file.name + '.' + stamp + '.bak';
      fso.CopyFile(file.path, dest, false);
      try { setRO(dest, false); } catch (e) { }
      return dest;
    },

    // pairs = [{ key, value }]. Writes only those values, verifies by re-reading, returns { ok, changes:[{key,before,after}], error }
    applyValues: function (file, pairs, lock) {
      var i, res, text, changes = [];
      if (!real) {
        text = mockFiles[file.name];
        for (i = 0; i < pairs.length; i++) {
          res = Core.setKey(text, pairs[i].key, pairs[i].value);
          if (!res.found) return { ok: false, error: pairs[i].key + ' not found.' };
          text = res.text; changes.push({ key: pairs[i].key, before: res.old, after: pairs[i].value });
        }
        mockFiles[file.name] = text; mockRO[file.name] = !!lock;
        return { ok: true, changes: changes };
      }
      try {
        if (isRO(file.path)) setRO(file.path, false);
        var raw = readRaw(file.path);
        if (raw.bad) return { ok: false, error: 'File is not plain UTF-8 text; refusing to edit it.' };
        text = raw.text;
        for (i = 0; i < pairs.length; i++) {
          res = Core.setKey(text, pairs[i].key, pairs[i].value);
          if (!res.found) return { ok: false, error: pairs[i].key + ' not found in this file; nothing changed.' };
          text = res.text; changes.push({ key: pairs[i].key, before: res.old, after: pairs[i].value });
        }
        writeRaw(file.path, text, raw.bom);
        var check = readRaw(file.path);
        for (i = 0; i < pairs.length; i++) {
          if (String(Core.getKey(check.text, pairs[i].key)) !== String(pairs[i].value)) return { ok: false, error: 'Verification failed for ' + pairs[i].key + '. Restore the backup.' };
        }
        if (lock) setRO(file.path, true);
        return { ok: true, changes: changes };
      } catch (err) { return { ok: false, error: String(err.message || err) }; }
    },

    latestBackup: function (file) {
      var best = null, i;
      if (!real) { for (i = 0; i < mockBackups.length; i++) if (mockBackups[i].name === file.name) best = mockBackups[i]; return best ? best.stamp : null; }
      try {
        var pre = (file.loc || 'docs') + '__' + file.name + '.';
        var en = new Enumerator(fso.GetFolder(backupDir()).Files), bestName = '';
        for (; !en.atEnd(); en.moveNext()) {
          var n = en.item().Name;
          if (n.indexOf(pre) === 0 && /\.bak$/.test(n) && n > bestName) bestName = n;
        }
        return bestName ? bestName : null;
      } catch (e) { return null; }
    },

    restore: function (file) {
      if (!real) {
        var b = null, i; for (i = 0; i < mockBackups.length; i++) if (mockBackups[i].name === file.name) b = mockBackups[i];
        if (!b) return { ok: false, error: 'No backup found.' };
        mockFiles[file.name] = b.text; mockRO[file.name] = false; return { ok: true, from: b.stamp };
      }
      try {
        var name = this.latestBackup(file);
        if (!name) return { ok: false, error: 'No backup found for this file.' };
        if (isRO(file.path)) setRO(file.path, false);
        fso.CopyFile(backupDir() + '\\' + name, file.path, true);
        try { setRO(file.path, false); } catch (e) { }
        return { ok: true, from: name };
      } catch (err) { return { ok: false, error: String(err.message || err) }; }
    },

    setLock: function (file, on) {
      if (!real) { mockRO[file.name] = on; return { ok: true }; }
      try { setRO(file.path, on); return { ok: true }; } catch (err) { return { ok: false, error: String(err.message || err) }; }
    },

    // ---------- updates (GitHub releases API; nothing is ever executed automatically) ----------
    latestRelease: function (repo) {
      if (!Core.validRepo(repo)) return { ok: false, error: 'Enter your GitHub repo as owner/name first.' };
      if (!real) {
        return { ok: true, tag: window.__mockTag || 'v1.1.0', name: 'Preview release', body: 'Preview notes: updated presets for the latest season.', url: 'https://github.com/' + repo + '/releases/latest',
          assetUrl: 'https://github.com/' + repo + '/releases/download/v1.1.0/CoD-Configurator.hta' };
      }
      try {
        var x = new ActiveXObject('MSXML2.ServerXMLHTTP.6.0');
        x.setTimeouts(5000, 5000, 10000, 15000);
        x.open('GET', 'https://api.github.com/repos/' + repo + '/releases/latest', false);
        x.setRequestHeader('User-Agent', 'CoD-Configurator');
        x.setRequestHeader('Accept', 'application/vnd.github+json');
        x.send();
        if (x.status === 404) return { ok: false, error: 'No published release found for ' + repo + ' yet.' };
        if (x.status !== 200) return { ok: false, error: 'GitHub answered HTTP ' + x.status + '.' };
        var j = JSON.parse(x.responseText), asset = '', i;
        for (i = 0; j.assets && i < j.assets.length; i++) if (/\.hta$/i.test(j.assets[i].name)) { asset = j.assets[i].browser_download_url; break; }
        return { ok: true, tag: j.tag_name || '', name: j.name || '', body: String(j.body || ''), url: j.html_url || '', assetUrl: asset };
      } catch (e) { return { ok: false, error: 'Could not reach GitHub: ' + String(e.message || e) }; }
    },

    // Saves the new .hta next to the app under a new versioned name (so the art folder is found). Never overwrites or launches anything.
    downloadUpdate: function (url, tag) {
      if (!Core.trustedDownload(url)) return { ok: false, error: 'Refusing to download from an untrusted address.' };
      if (!real) return { ok: true, path: 'CoD-Configurator-' + tag + '.hta' };
      try {
        var x = new ActiveXObject('MSXML2.ServerXMLHTTP.6.0');
        x.setTimeouts(5000, 5000, 15000, 30000);
        x.open('GET', url, false); x.setRequestHeader('User-Agent', 'CoD-Configurator'); x.send();
        if (x.status !== 200) return { ok: false, error: 'Download failed (HTTP ' + x.status + ').' };
        var dir = appDir();
        var dest = dir + '\\CoD-Configurator-' + String(tag).replace(/[^0-9A-Za-z.\-]/g, '_') + '.hta';
        var s = new ActiveXObject('ADODB.Stream'); s.Type = 1; s.Open(); s.Write(x.responseBody); s.SaveToFile(dest, 2); s.Close();
        var chk = readRaw(dest);
        if (chk.text.indexOf('HTA:APPLICATION') < 0 || chk.text.length < 10000) { fso.DeleteFile(dest, true); return { ok: false, error: 'The downloaded file does not look like this app. Deleted it.' }; }
        return { ok: true, path: dest };
      } catch (e) { return { ok: false, error: String(e.message || e) }; }
    },

    openFolder: function (which) {
      if (!real) { return; }
      try {
        var d = which === 'backups' ? backupDir() : playersDir();
        if (which !== 'backups' && !fso.FolderExists(d) && fso.FolderExists(localPlayersDir())) d = localPlayersDir();
        shell.Run('explorer.exe "' + d + '"');
      } catch (e) { }
    },
    openPath: function (path) {
      if (!real) return;
      try { shell.Run('explorer.exe /select,"' + path + '"'); } catch (e) { }
    },

    openUrl: function (url) {
      if (!/^https:\/\//.test(url)) return;
      if (real) { try { shell.Run(url); } catch (e) { } } else { window.open(url); }
    },

    copy: function (text) {
      try { if (window.clipboardData) { window.clipboardData.setData('Text', text); return true; } } catch (e) { }
      try { if (navigator.clipboard) { navigator.clipboard.writeText(text); return true; } } catch (e2) { }
      return false;
    }
  };
})();
