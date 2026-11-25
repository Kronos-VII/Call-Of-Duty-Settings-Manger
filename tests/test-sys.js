// Runs the REAL Windows code paths of sys.js against a fake Windows (fake ActiveX objects), to prove the fallbacks work.
var fs = require('fs'), vm = require('vm'), os = require('os'), path = require('path'), assert = require('assert');
var root = path.join(__dirname, '..', 'src');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codcfg-'));

function load(opts) {
  function Enumerator(c) { this.a = (c && c.__items) || []; this.i = 0; }
  Enumerator.prototype.atEnd = function () { return this.i >= this.a.length; };
  Enumerator.prototype.moveNext = function () { this.i++; };
  Enumerator.prototype.item = function () { return this.a[this.i]; };
  function wobj(o) { var items = []; for (var k in o) items.push({ Name: k, Value: o[k] }); return { Properties_: { __items: items } }; }
  var fsoMock = {
    FileExists: function (p) { return fs.existsSync(p) && fs.statSync(p).isFile(); }, FolderExists: function (p) { return fs.existsSync(p) && fs.statSync(p).isDirectory(); },
    CreateFolder: function (p) { fs.mkdirSync(p, { recursive: true }); }, DeleteFile: function (p) { try { fs.unlinkSync(p); } catch (e) { } },
    CreateTextFile: function (p) { return { Write: function (s) { fs.writeFileSync(p, s); }, Close: function () { } }; },
    OpenTextFile: function (p) { var s = fs.readFileSync(p, 'utf8'); return { AtEndOfStream: !s, ReadAll: function () { return s; }, Close: function () { } }; }
  };
  var regs = opts.regs || {};
  var shellMock = {
    ExpandEnvironmentStrings: function (s) { return s.replace('%TEMP%', tmp).replace('%APPDATA%', tmp).replace('%LOCALAPPDATA%', tmp).replace('%NUMBER_OF_PROCESSORS%', '16'); },
    RegRead: function (k) { if (regs.hasOwnProperty(k)) return regs[k]; throw new Error('no key'); },
    SpecialFolders: function () { return tmp; },
    Run: function (cmd) {
      var m = /> "([^"]+)"/.exec(cmd);
      if (/powershell/.test(cmd)) { if (opts.ps) fs.writeFileSync(m[1], opts.ps); }
      else if (/reg query/.test(cmd) && opts.regq) { var k = /\/v (\S+)/.exec(cmd)[1], key = /reg query "([^"]+)"/.exec(cmd)[1]; if (opts.regq[key + '|' + k]) fs.writeFileSync(m[1], '\r\n' + key + '\r\n    ' + k + '    ' + opts.regq[key + '|' + k] + '\r\n'); }
      return 0;
    }
  };
  var ctx = {
    Enumerator: Enumerator, JSON: JSON, console: console, screen: { width: 2560, height: 1440 }, location: { pathname: '/C:/app/x.hta' }, decodeURIComponent: decodeURIComponent,
    ActiveXObject: function (name) {
      if (name === 'Scripting.FileSystemObject') return fsoMock;
      if (name === 'WScript.Shell') return shellMock;
      if (name === 'WbemScripting.SWbemLocator') {
        if (opts.noWmi) throw new Error('Automation server cannot create object');
        return { ConnectServer: function (h, ns) { return { ExecQuery: function (q) { var r = (opts.wmi || {})[q.split(' from ')[1].split(' ')[0]]; return { __items: (r || []).map(wobj) }; } }; } };
      }
      throw new Error('unsupported ' + name);
    },
    GetObject: function () { throw new Error('GetObject failed'); }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'core.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'sys.js'), 'utf8'), ctx);
  return ctx.Sys;
}

var WMI = {
  Win32_Processor: [{ Name: '  AMD Ryzen 7 5800X3D 8-Core Processor   ', NumberOfCores: 8, NumberOfLogicalProcessors: 16 }],
  Win32_VideoController: [{ Name: 'NVIDIA GeForce RTX 4070', AdapterRAM: 4293918720, DriverVersion: '31.0.15.5', CurrentRefreshRate: 144, CurrentHorizontalResolution: 2560, CurrentVerticalResolution: 1440 }],
  Win32_ComputerSystem: [{ TotalPhysicalMemory: '34171277312' }],
  Win32_OperatingSystem: [{ Caption: 'Microsoft Windows 11 Home' }]
};

// 1) everything through WMI
var s = load({ wmi: WMI });
assert.ok(s.isReal());
var c = s.cpu(), h = s.hardware();
assert.strictEqual(c.name, 'AMD Ryzen 7 5800X3D 8-Core Processor'); assert.strictEqual(c.cores, 8); assert.strictEqual(c.logical, 16);
assert.strictEqual(h.gpu.name, 'NVIDIA GeForce RTX 4070'); assert.strictEqual(h.gpu.vendor, 'nvidia');
assert.strictEqual(h.display.hz, 144); assert.strictEqual(h.ramGB, 32); assert.strictEqual(h.os, 'Microsoft Windows 11 Home');
assert.strictEqual(s.sources().cpu, 'WMI');
console.log('route 1 (WMI) ok');

// 2) WMI unavailable -> PowerShell JSON (also supplies real 12 GB VRAM)
var psJson = JSON.stringify({ cpu: [{ Name: 'Intel(R) Core(TM) i5-13600K', Cores: 14, Logical: 20 }], gpu: [{ Name: 'NVIDIA GeForce RTX 4070', Ram: '4293918720', Driver: '31.0.15.5', Hz: 165, W: 2560, H: 1440 }], ram: '34171277312', os: 'Microsoft Windows 11 Pro', vram: [{ Desc: 'NVIDIA GeForce RTX 4070', Mem: '12884901888' }] });
s = load({ noWmi: true, ps: '\ufeff' + psJson });
c = s.cpu(); h = s.hardware();
assert.strictEqual(c.cores, 14); assert.strictEqual(c.logical, 20);
assert.strictEqual(h.gpu.vramGB, 12); assert.strictEqual(h.display.hz, 165); assert.strictEqual(h.ramGB, 32); assert.strictEqual(s.sources().cpu, 'PowerShell');
var adv = require('../src/core.js').cpuAdvice(c.name, c.cores, c.logical); assert.strictEqual(adv.pcores, 6);
console.log('route 2 (PowerShell) ok');

// 3) WMI + PowerShell both unavailable -> registry only
var G = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11cd-bfc1-08002be10318}\\0000';
s = load({ noWmi: true, regs: {
  'HKLM\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0\\ProcessorNameString': 'AMD Ryzen 5 5600X 6-Core Processor        ',
  [G + '\\DriverDesc']: 'AMD Radeon RX 6700 XT', [G + '\\DriverVersion']: '31.0.21001',
  'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProductName': 'Windows 10 Pro', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\CurrentBuild': '22631' },
  regq: { [G + '|HardwareInformation.qwMemorySize']: 'REG_QWORD    0x300000000' } });
c = s.cpu(); h = s.hardware();
assert.strictEqual(c.name, 'AMD Ryzen 5 5600X 6-Core Processor'); assert.strictEqual(c.logical, 16); assert.strictEqual(s.sources().cpu, 'estimate');
assert.strictEqual(h.gpu.name, 'AMD Radeon RX 6700 XT'); assert.strictEqual(h.gpu.vendor, 'amd'); assert.strictEqual(h.gpu.vramGB, 12);
assert.strictEqual(h.os, 'Microsoft Windows 11 Pro');
assert.ok(s.detectLog().length > 0);
console.log('route 3 (registry) ok');

// 4) nothing works at all -> no crash
s = load({ noWmi: true });
c = s.cpu(); h = s.hardware();
assert.ok(c.logical === 16); assert.strictEqual(h.gpu, null);
console.log('degraded mode ok');
