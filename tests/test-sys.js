// Runs the REAL Windows code paths of sys.js against a fake Windows (fake ActiveX objects), to prove the fallbacks work.
var assert = require('assert');
var load = require('./fake-windows.js').load;

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
