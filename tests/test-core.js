var assert = require('assert');
var Core = require('../src/core.js');

// setKey only touches the value
var sample = '// header\r\nFoo = "1"\r\nRendererWorkerCount = "16"\r\nBar = "x y"\r\n';
var r = Core.setKey(sample, 'RendererWorkerCount', 8);
assert(r.found && r.changed && r.old === '16');
assert.strictEqual(r.text, '// header\r\nFoo = "1"\r\nRendererWorkerCount = "8"\r\nBar = "x y"\r\n');
assert.strictEqual(Core.setKey(r.text, 'RendererWorkerCount', 8).changed, false);
assert.strictEqual(Core.setKey('nothing here', 'RendererWorkerCount', 8).found, false);
assert.strictEqual(Core.getKey(sample), '16');
assert(Core.hasKey('RendererWorkerCount="4"'));
assert(!Core.hasKey('RendererWorkerCountX = 4'));

// CPU detection
var a = Core.cpuAdvice('13th Gen Intel(R) Core(TM) i9-13900K', 24, 32);   // 8P+16E
assert(a.hybrid && a.pcores === 8);
a = Core.cpuAdvice('12th Gen Intel(R) Core(TM) i7-12700K', 12, 20);       // 8P+4E
assert(a.hybrid && a.pcores === 8);
a = Core.cpuAdvice('13th Gen Intel(R) Core(TM) i5-13600K', 14, 20);       // 6P+8E
assert(a.hybrid && a.pcores === 6);
a = Core.cpuAdvice('Intel(R) Core(TM) i7-9700K', 8, 8);                   // no HT, ambiguous
assert(!a.confident && a.pcores === 8);
a = Core.cpuAdvice('Intel(R) Core(TM) i7-10700K', 8, 16);
assert(!a.hybrid && a.pcores === 8 && a.confident);
a = Core.cpuAdvice('AMD Ryzen 7 7800X3D 8-Core Processor', 8, 16);
assert(!a.hybrid && a.pcores === 8);
a = Core.cpuAdvice('AMD Ryzen 9 7950X 16-Core Processor', 16, 32);
assert.strictEqual(Core.recommend(a.pcores, 'rec'), 8);
assert.strictEqual(Core.recommend(6, 'rec'), 6);
assert.strictEqual(Core.recommend(6, 'minus1'), 5);
assert.strictEqual(Core.recommend(8, 'minus1'), 7);
assert.strictEqual(Core.recommend(4, 'rec'), 4);
assert.strictEqual(Core.gameCode('options.4.cod25.cst'), 'cod25');
assert.strictEqual(Core.gameCode('s.1.0.cod26.txt'), 'cod26');
assert.strictEqual(Core.gameCode('random.txt'), null);

assert.deepStrictEqual(Core.classifyGpu('NVIDIA GeForce RTX 3070'), { vendor: 'nvidia', integrated: false });
assert.strictEqual(Core.classifyGpu('AMD Radeon RX 7800 XT').vendor, 'amd');
assert(!Core.classifyGpu('AMD Radeon RX 7800 XT').integrated);
assert(Core.classifyGpu('AMD Radeon(TM) Graphics').integrated);
assert(Core.classifyGpu('Intel(R) UHD Graphics 770').integrated);
assert(!Core.classifyGpu('Intel(R) Arc(TM) A770 Graphics').integrated);
var g = Core.pickGpu([{ name: 'Intel(R) UHD Graphics 770', vramGB: 2 }, { name: 'NVIDIA GeForce RTX 4060', vramGB: 8 }, { name: 'Microsoft Basic Render Driver', vramGB: 0 }]);
assert.strictEqual(g.name, 'NVIDIA GeForce RTX 4060');
assert.strictEqual(Core.pickGpu([]), null);
assert.strictEqual(Core.bytesToGB(8589934592), 8);
assert(Core.isLowVram(8) && !Core.isLowVram(12) && !Core.isLowVram(0));
assert.strictEqual(Core.vramScaleFor('mw4', false), '0.80');
assert.strictEqual(Core.vramScaleFor('bo7', true), '0.70');
assert.strictEqual(Core.compareVersions('v1.2.0', '1.10.0'), -1);
assert.strictEqual(Core.compareVersions('2.0', '2.0.0'), 0);
assert.strictEqual(Core.compareVersions('1.0.1', '1.0.0'), 1);
assert(Core.validRepo('someone/cod-configurator') && !Core.validRepo('YOUR-USER/cod-configurator') && !Core.validRepo('a b/c'));
assert(Core.trustedDownload('https://github.com/a/b/releases/download/v1/x.hta') && !Core.trustedDownload('https://evil.example/x.hta') && !Core.trustedDownload('http://github.com/x'));
assert.strictEqual(Core.scaleMode(2160), 'Balanced');
var v = Core.setKey('VideoMemoryScale = "0.9"\r\n', Core.VRAM_KEY, '0.80');
assert(v.found && v.text === 'VideoMemoryScale = "0.80"\r\n');
// key must not match inside a longer name
assert(!Core.hasKey('XRendererWorkerCount = "4"'));
assert(!Core.hasKey('My_RendererWorkerCount = "4"'));
assert(Core.hasKey('\tRendererWorkerCount = "4"') && Core.getKey('\tRendererWorkerCount = "4"') === '4');
assert.strictEqual(Core.setKey('Foo = "1"\nRendererWorkerCount = "9"', 'RendererWorkerCount', 6).text, 'Foo = "1"\nRendererWorkerCount = "6"');
console.log('core tests passed');

// ---- automatic worker count (v1.2) ----
assert.strictEqual(Core.autoWorkers(8, true), 8);    // Intel hybrid 8 P-cores
assert.strictEqual(Core.autoWorkers(6, true), 6);
assert.strictEqual(Core.autoWorkers(6, false), 5);   // 6-core Ryzen
assert.strictEqual(Core.autoWorkers(8, false), 7);
assert.strictEqual(Core.autoWorkers(12, false), 8);  // capped
assert.strictEqual(Core.autoWorkers(16, false), 8);
assert.strictEqual(Core.autoWorkers(4, false), 3);
assert.strictEqual(Core.autoWorkers(2, false), 2);   // never below 2
assert.strictEqual(Core.autoWorkers('', false), 2);

// ---- every game builds a table with no non-ASCII text ----
var Data = require('../src/data.js');
global.Core = Core;
var presets = ['fps', 'balanced'];
Data.GAMES.forEach(function (g) {
  presets.forEach(function (p) {
    [true, false].forEach(function (low) {
      var rows = Data.rows(g, p, { vendor: 'amd', lowVram: low, hz: 144, h: 1440 });
      assert.ok(rows.length > 20, g.id + ' has rows');
      rows.forEach(function (r) { assert.ok(/^[\x20-\x7e]*$/.test(r.setting + r.value + r.note), 'ascii: ' + r.setting + ' | ' + r.value + ' | ' + r.note); });
    });
  });
});
var mwRows = Data.rows(Data.GAMES[3], 'fps', { vendor: 'nvidia', lowVram: true, hz: 240, h: 1080 });
function val(rows, s) { for (var i = 0; i < rows.length; i++) if (rows[i].setting === s) return rows[i].value; return null; }
assert.strictEqual(val(mwRows, 'VRAM Scale Target'), '70');
assert.strictEqual(val(mwRows, 'Texture Resolution'), 'Medium');
assert.strictEqual(val(mwRows, 'Gameplay Frame Rate Limit'), 'Custom: 237');
assert.strictEqual(Data.GAMES[3].config, false);   // no sourced config edit for MW4
console.log('v1.2 tests ok');

// ---- file formats seen in guides: quoted, unquoted, json-ish ----
assert.strictEqual(Core.getKey('RendererWorkerCount = 7\r\n'), '7');
assert.strictEqual(Core.setKey('A = 1\r\nRendererWorkerCount = 7\r\nB = 2', 'RendererWorkerCount', 8).text, 'A = 1\r\nRendererWorkerCount = 8\r\nB = 2');
assert.strictEqual(Core.setKey('RendererWorkerCount=7', 'RendererWorkerCount', 8).text, 'RendererWorkerCount=8');
assert.strictEqual(Core.setKey('"RendererWorkerCount": "7",', 'RendererWorkerCount', 8).text, '"RendererWorkerCount": "8",');
assert.strictEqual(Core.setKey("RendererWorkerCount = '7'", 'RendererWorkerCount', 8).text, "RendererWorkerCount = '8'");
assert.strictEqual(Core.setKey('RendererWorkerCount = "16" ; x', 'RendererWorkerCount', 8).text, 'RendererWorkerCount = "8" ; x');
assert.strictEqual(Core.hasKey('XRendererWorkerCount = 7'), false);
assert.strictEqual(Core.hasKey('# RendererWorkerCountExtra = 7'), false);
assert.strictEqual(Core.getKey('VideoMemoryScale = "0.9"', 'VideoMemoryScale'), '0.9');
// Core Ultra (no hyper-threading)
var u9 = Core.cpuAdvice('Intel(R) Core(TM) Ultra 9 285K', 24, 24); assert.strictEqual(u9.pcores, 8); assert.strictEqual(u9.hybrid, true);
var u5 = Core.cpuAdvice('Intel(R) Core(TM) Ultra 5 245K', 14, 14); assert.strictEqual(u5.pcores, 6);
var a14 = Core.cpuAdvice('Intel(R) Core(TM) i9-14900K', 24, 32); assert.strictEqual(a14.pcores, 8);
var r5 = Core.cpuAdvice('AMD Ryzen 5 5600X 6-Core Processor', 6, 12); assert.strictEqual(Core.autoWorkers(r5.pcores, r5.hybrid), 5);
var r9 = Core.cpuAdvice('AMD Ryzen 9 7950X3D 16-Core Processor', 16, 32); assert.strictEqual(Core.autoWorkers(r9.pcores, r9.hybrid), 8);
var i5 = Core.cpuAdvice('Intel(R) Core(TM) i5-12400F', 6, 12); assert.strictEqual(i5.hybrid, false); assert.strictEqual(Core.autoWorkers(i5.pcores, i5.hybrid), 5);
console.log('format tests ok');
