// Reading and writing real settings files through the REAL Windows code in sys.js (fake Windows objects, real files).
// Checks: every file shape, encodings kept byte for byte, read-only kept, failed writes rolled back, backups pruned.
var assert = require('assert'), fs = require('fs'), path = require('path');
var fw = require('./fake-windows.js'), norm = fw.norm;
var Core = require('../src/core.js');

var Sys = fw.load({});
var T = Sys.__tmp, PL = T + '\\docs\\Call of Duty\\players', LP = T + '\\local\\Activision\\Call of Duty\\players';
function p(x) { return norm(x); }
fs.mkdirSync(p(PL + '\\sub'), { recursive: true });
fs.mkdirSync(p(LP), { recursive: true });

var BO6 = '// Thread count for handling the job queue\r\nRendererWorkerCount@0;51989;59387 = 16 // -1 to 16\r\n// Fraction of GPU memory used for loading textures\r\nVideoMemoryScale@0;19140;20302 = 0.85 // 0.0 to 2.0\r\n//RendererWorkerCount@0;1;2 = 3\r\n';
var MW2 = 'RendererWorkerCount:0.0 = "4" // -1 to 16\nVideoMemoryScale:0.0 = "0.9"\n';
fs.writeFileSync(p(PL + '\\s.1.0.cod24.txt0'), BO6);                                                   // utf-8, no BOM
fs.writeFileSync(p(PL + '\\s.1.0.cod24.txt1'), Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(BO6)]));   // utf-8 with BOM
fs.writeFileSync(p(PL + '\\s.1.0.cod24 - Copy.txt0'), BO6);                                            // a hand-made copy: must be ignored
fs.writeFileSync(p(PL + '\\s.1.0.cod24.txt0.bak'), BO6);                                               // must be ignored
fs.writeFileSync(p(PL + '\\sub\\options.3.cod22.cst'), MW2);                                          // MW II shape, in a sub-folder
fs.writeFileSync(p(LP + '\\options.4.cod25.cst'), Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(BO6, 'utf16le')]));  // UTF-16
fs.writeFileSync(p(PL + '\\s.1.0.cod25.txt0'), 'Nothing = 1\r\n');                                      // no key yet

// ---- scan ----
var sc = Sys.scan(), byName = {};
sc.files.forEach(function (f) { byName[f.name] = f; });
assert.ok(sc.ok);
assert.deepStrictEqual(Object.keys(byName).sort(), ['options.3.cod22.cst', 'options.4.cod25.cst', 's.1.0.cod24.txt0', 's.1.0.cod24.txt1', 's.1.0.cod25.txt0']);
assert.strictEqual(byName['s.1.0.cod24.txt0'].value, '16');
assert.strictEqual(byName['s.1.0.cod24.txt0'].count, 1);                     // the commented-out copy is not counted
assert.deepStrictEqual(JSON.parse(JSON.stringify(byName['s.1.0.cod24.txt0'].range)), { min: -1, max: 16 });
assert.strictEqual(byName['s.1.0.cod24.txt0'].vramValue, '0.85');
assert.strictEqual(byName['s.1.0.cod24.txt1'].value, '16');                  // BOM handled
assert.strictEqual(byName['options.4.cod25.cst'].value, '16');               // UTF-16 handled
assert.strictEqual(byName['options.4.cod25.cst'].loc, 'local');
assert.strictEqual(byName['options.3.cod22.cst'].value, '4');                // ":0.0" shape, sub-folder
assert.strictEqual(byName['options.3.cod22.cst'].sub, 'sub');
assert.strictEqual(byName['s.1.0.cod25.txt0'].hasKey, false);
console.log('scan ok');

// ---- apply keeps every other byte and the encoding ----
function bytes(x) { return fs.readFileSync(p(x)); }
var f0 = byName['s.1.0.cod24.txt0'];
Sys.backup(f0);
var r = Sys.applyValues(f0, [{ key: Core.KEY, value: 8 }, { key: Core.VRAM_KEY, value: '0.80' }], 'keep');
assert.ok(r.ok, r.error);
assert.strictEqual(bytes(f0.path).toString('latin1'), BO6.replace('= 16 //', '= 8 //').replace('= 0.85 //', '= 0.80 //'));
assert.strictEqual(r.changes[0].before, '16'); assert.strictEqual(r.changes[0].after, '8');

var f1 = byName['s.1.0.cod24.txt1'];
r = Sys.applyValues(f1, [{ key: Core.KEY, value: 8 }], 'keep'); assert.ok(r.ok, r.error);
var b1 = bytes(f1.path);
assert.ok(b1[0] === 0xEF && b1[1] === 0xBB && b1[2] === 0xBF && b1[3] !== 0xEF, 'exactly one BOM kept');
assert.strictEqual(b1.slice(3).toString('utf8'), BO6.replace('= 16 //', '= 8 //'));

var fu = byName['options.4.cod25.cst'];
r = Sys.applyValues(fu, [{ key: Core.KEY, value: 6 }], 'keep'); assert.ok(r.ok, r.error);
var bu = bytes(fu.path);
assert.ok(bu[0] === 0xFF && bu[1] === 0xFE); assert.strictEqual(bu.slice(2).toString('utf16le'), BO6.replace('= 16 //', '= 6 //'));

var fm = byName['options.3.cod22.cst'];
r = Sys.applyValues(fm, [{ key: Core.KEY, value: 7 }], 'keep'); assert.ok(r.ok, r.error);
assert.strictEqual(bytes(fm.path).toString('utf8'), MW2.replace('"4"', '"7"'));
assert.ok(!fs.existsSync(p(f0.path + '.codcfg-tmp')), 'temp file cleaned up');
console.log('apply ok (utf-8, utf-8 BOM, UTF-16, MW II shape)');

// ---- values outside the range the file allows are clamped ----
r = Sys.applyValues(f0, [{ key: Core.KEY, value: 99 }], 'keep'); assert.ok(r.ok);
assert.strictEqual(Core.getKey(bytes(f0.path).toString('utf8')), '16');
Sys.applyValues(f0, [{ key: Core.KEY, value: 8 }], 'keep');

// ---- read-only: kept, locked or unlocked as asked ----
Sys.setLock(f1, true);
r = Sys.applyValues(f1, [{ key: Core.KEY, value: 7 }], 'keep'); assert.ok(r.ok, r.error); assert.strictEqual(r.wasRO, true);
assert.strictEqual(Sys.__ro[p(f1.path)], true, 'still read-only');
r = Sys.applyValues(f1, [{ key: Core.KEY, value: 8 }], 'unlock'); assert.ok(r.ok);
assert.ok(!Sys.__ro[p(f1.path)], 'unlocked');
r = Sys.applyValues(f1, [{ key: Core.KEY, value: 8 }], 'lock'); assert.ok(r.ok);
assert.strictEqual(Sys.__ro[p(f1.path)], true, 'locked');
Sys.setLock(f1, false);
console.log('read-only handling ok');

// ---- a failed write leaves the file exactly as it was ----
var before = bytes(f0.path);
var Sys2 = fw.load({ tmp: T, failWrites: { '.codcfg-tmp': true } });
var f0b = Sys2.scan().files.filter(function (x) { return x.name === 's.1.0.cod24.txt0'; })[0];
r = Sys2.applyValues(f0b, [{ key: Core.KEY, value: 5 }], 'keep');
assert.strictEqual(r.ok, false); assert.ok(/put back/.test(r.error), r.error);
assert.ok(before.equals(bytes(f0.path)), 'untouched after temp-file failure');
var Sys3 = fw.load({ tmp: T, failWrites: { 's.1.0.cod24.txt0': true } });
var f0c = Sys3.scan().files.filter(function (x) { return x.name === 's.1.0.cod24.txt0'; })[0];
r = Sys3.applyValues(f0c, [{ key: Core.KEY, value: 5 }], 'keep');
assert.strictEqual(r.ok, false);
assert.ok(before.equals(bytes(f0.path)), 'untouched after swap failure');
assert.ok(!fs.existsSync(p(f0.path + '.codcfg-tmp')), 'temp file cleaned up after failure');
// key missing: refused, nothing written
var fk = Sys.scan().files.filter(function (x) { return x.name === 's.1.0.cod25.txt0'; })[0];
r = Sys.applyValues(fk, [{ key: Core.KEY, value: 8 }], 'keep');
assert.strictEqual(r.ok, false); assert.strictEqual(bytes(fk.path).toString(), 'Nothing = 1\r\n');
console.log('rollback ok');

// ---- backups: the original is remembered, old ones pruned ----
var orig = Sys.originalValues(f0);
assert.strictEqual(orig[Core.KEY], '16'); assert.strictEqual(orig[Core.VRAM_KEY], '0.85');
for (var i = 0; i < 14; i++) Sys.backup(f0);
assert.strictEqual(Sys.backupCount(f0), 11, 'original + 10 newest');
assert.strictEqual(Sys.originalValues(f0)[Core.KEY], '16', 'original survives pruning');
// undo = put the original values back, nothing else
r = Sys.applyValues(f0, [{ key: Core.KEY, value: orig[Core.KEY] }, { key: Core.VRAM_KEY, value: orig[Core.VRAM_KEY] }], 'unlock');
assert.ok(r.ok); assert.strictEqual(bytes(f0.path).toString('latin1'), BO6);
console.log('backups and undo ok');

// ---- game running check: cod.exe yes, VS Code no ----
var SysR = fw.load({ tmp: T, wmiQuery: function (q) { return /Win32_Process/.test(q) ? [{ Name: 'cod.exe' }] : null; } });
assert.strictEqual(SysR.gameRunning(), true);
var SysN = fw.load({ tmp: T, wmiQuery: function (q) { return /Win32_Process/.test(q) ? [] : null; } });
assert.strictEqual(SysN.gameRunning(), false);
var SysT = fw.load({ tmp: T, noWmi: true, tasklist: '"Code.exe","1","Console","1","100 K"\r\n"vscod.exe","2","Console","1","1 K"\r\n' });
assert.strictEqual(SysT.gameRunning(), false);
SysT = fw.load({ tmp: T, noWmi: true, tasklist: '"cod.exe","1","Console","1","100 K"\r\n' });
assert.strictEqual(SysT.gameRunning(), true);
console.log('game running check ok');

// ---- CPU layout from Windows ----
var sets = '0:0:1:0;0:0:1:0;0:1:1:0;0:1:1:0;0:2:0:0;0:3:0:0;';
assert.strictEqual(fw.load({ tmp: T, cpusets: sets + '\r\n' }).cpuSets(), sets);
assert.strictEqual(fw.load({ tmp: T, cpusets: 'Add-Type : error\r\n' }).cpuSets(), '');
assert.strictEqual(fw.load({ tmp: T }).cpuSets(), '');
console.log('cpu layout read ok');

console.log('file tests passed');
