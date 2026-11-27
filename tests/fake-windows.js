// A small fake of the Windows scripting objects sys.js uses (FileSystemObject, WScript.Shell, ADODB.Stream, WMI),
// backed by real files in a temp folder. Lets the REAL Windows code paths of sys.js run under node.
var fs = require('fs'), vm = require('vm'), os = require('os'), path = require('path');
var root = path.join(__dirname, '..', 'src');

function norm(p) { return String(p).replace(/\\/g, '/'); }

function load(opts) {
  opts = opts || {};
  var tmp = opts.tmp || fs.mkdtempSync(path.join(os.tmpdir(), 'codcfg-'));
  var ro = {};                      // read-only flags by normalised path
  var failWrites = opts.failWrites || {};   // path suffix -> true: SaveToFile throws (simulates a disk / lock error)

  function Enumerator(c) { this.a = (c && c.__items) || []; this.i = 0; }
  Enumerator.prototype.atEnd = function () { return this.i >= this.a.length; };
  Enumerator.prototype.moveNext = function () { this.i++; };
  Enumerator.prototype.item = function () { return this.a[this.i]; };
  function wobj(o) { var items = []; for (var k in o) items.push({ Name: k, Value: o[k] }); return { Properties_: { __items: items } }; }
  function guardWrite(p) {
    var n = norm(p), k;
    if (ro[n]) throw new Error('Permission denied');
    for (k in failWrites) if (n.slice(-k.length) === k) throw new Error('Write failed');
  }

  function fileObj(p) {
    var n = norm(p);
    return {
      Name: path.basename(n), Path: p,
      get Attributes() { return ro[n] ? 1 : 0; },
      set Attributes(v) { if (v & 1) ro[n] = true; else delete ro[n]; },
      DateLastModified: fs.statSync(n).mtime
    };
  }
  var fsoMock = {
    FileExists: function (p) { p = norm(p); return fs.existsSync(p) && fs.statSync(p).isFile(); },
    FolderExists: function (p) { p = norm(p); return fs.existsSync(p) && fs.statSync(p).isDirectory(); },
    CreateFolder: function (p) { fs.mkdirSync(norm(p), { recursive: true }); },
    DeleteFile: function (p) { try { fs.unlinkSync(norm(p)); delete ro[norm(p)]; } catch (e) { } },
    CopyFile: function (a, b, over) {
      if (fs.existsSync(norm(b)) && over === false) throw new Error('File already exists');
      guardWrite(b); fs.copyFileSync(norm(a), norm(b));
    },
    GetFile: function (p) { if (!fs.existsSync(norm(p))) throw new Error('File not found'); return fileObj(p); },
    GetFolder: function (p) {
      var n = norm(p), names = fs.readdirSync(n), files = [], subs = [];
      names.forEach(function (x) {
        var full = n + '/' + x, st = fs.statSync(full);
        if (st.isFile()) files.push(fileObj(p + '\\' + x)); else subs.push({ Name: x, Path: p + '\\' + x });
      });
      return { Files: { __items: files }, SubFolders: { __items: subs } };
    },
    CreateTextFile: function (p) { return { Write: function (s) { fs.writeFileSync(norm(p), s); }, Close: function () { } }; },
    OpenTextFile: function (p) { var s = fs.readFileSync(norm(p), 'utf8'); return { AtEndOfStream: !s, ReadAll: function () { return s; }, Close: function () { } }; }
  };

  // ADODB.Stream: byte buffer + charset, like the real one (utf-8 and unicode writes add a BOM, reads skip it).
  function Stream() { this.Type = 1; this.Charset = 'unicode'; this.buf = Buffer.alloc(0); this._pos = 0; }
  Object.defineProperty(Stream.prototype, 'Position', { get: function () { return this._pos; }, set: function (v) { this._pos = v; } });
  Stream.prototype.Open = function () { };
  Stream.prototype.Close = function () { };
  Stream.prototype.LoadFromFile = function (p) { this.buf = fs.readFileSync(norm(p)); this._pos = 0; };
  Stream.prototype.ReadText = function (n) {
    var cs = String(this.Charset).toLowerCase(), b = this.buf, t;
    if (cs === 'iso-8859-1') t = b.toString('latin1');
    else if (cs === 'unicode') { if (b[0] === 0xFF && b[1] === 0xFE) b = b.slice(2); t = b.toString('utf16le'); }
    else { if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) b = b.slice(3); t = b.toString('utf8'); }
    return n === undefined ? t : t.substr(0, n);
  };
  Stream.prototype.WriteText = function (t) {
    var cs = String(this.Charset).toLowerCase(), add;
    if (cs === 'unicode') add = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(t, 'utf16le')]);
    else add = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(t, 'utf8')]);
    this.buf = Buffer.concat([this.buf, add]); this._pos = this.buf.length;
  };
  Stream.prototype.CopyTo = function (o) { o.buf = Buffer.concat([o.buf, this.buf.slice(this._pos)]); };
  Stream.prototype.SaveToFile = function (p) { guardWrite(p); fs.writeFileSync(norm(p), this.buf); };

  var regs = opts.regs || {};
  var shellMock = {
    ExpandEnvironmentStrings: function (s) { return s.replace('%TEMP%', tmp).replace('%APPDATA%', tmp + '\\appdata').replace('%LOCALAPPDATA%', tmp + '\\local').replace('%NUMBER_OF_PROCESSORS%', '16'); },
    RegRead: function (k) { if (regs.hasOwnProperty(k)) return regs[k]; throw new Error('no key'); },
    SpecialFolders: function () { return tmp + '\\docs'; },
    Run: function (cmd) {
      var m = /> "([^"]+)"/.exec(cmd);
      if (/cod_cfg_cpusets/.test(cmd)) { if (opts.cpusets) fs.writeFileSync(norm(m[1]), opts.cpusets); }
      else if (/powershell/.test(cmd)) { if (opts.ps) fs.writeFileSync(norm(m[1]), opts.ps); }
      else if (/reg query/.test(cmd) && opts.regq) { var k = /\/v (\S+)/.exec(cmd)[1], key = /reg query "([^"]+)"/.exec(cmd)[1]; if (opts.regq[key + '|' + k]) fs.writeFileSync(norm(m[1]), '\r\n' + key + '\r\n    ' + k + '    ' + opts.regq[key + '|' + k] + '\r\n'); }
      else if (/tasklist/.test(cmd) && opts.tasklist) fs.writeFileSync(norm(m[1]), opts.tasklist);
      return 0;
    }
  };
  var ctx = {
    Enumerator: Enumerator, JSON: JSON, console: console, screen: { width: 2560, height: 1440 }, location: { pathname: '/C:/app/x.hta', hash: '' }, decodeURIComponent: decodeURIComponent,
    window: {},
    ActiveXObject: function (name) {
      if (name === 'Scripting.FileSystemObject') return fsoMock;
      if (name === 'WScript.Shell') return shellMock;
      if (name === 'ADODB.Stream') return new Stream();
      if (name === 'WbemScripting.SWbemLocator') {
        if (opts.noWmi) throw new Error('Automation server cannot create object');
        return { ConnectServer: function (h, ns) { return { ExecQuery: function (q) {
          if (opts.wmiQuery) { var hit = opts.wmiQuery(q); if (hit) return { __items: hit.map(wobj) }; }
          var r = (opts.wmi || {})[q.split(' from ')[1].split(' ')[0]]; return { __items: (r || []).map(wobj) }; } }; } };
      }
      throw new Error('unsupported ' + name);
    },
    GetObject: function () { throw new Error('GetObject failed'); }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'core.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'sys.js'), 'utf8'), ctx);
  ctx.Sys.__tmp = tmp; ctx.Sys.__ro = ro; ctx.Sys.__norm = norm;
  return ctx.Sys;
}

module.exports = { load: load, norm: norm };
