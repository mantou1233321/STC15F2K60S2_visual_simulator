/* =============================================================================
 * assembler.js —— 8051/STC15 汇编器（A51 风格）
 *   · 两遍以上的定位 + 编码（符号前向引用通过迭代收敛）
 *   · 伪指令：ORG / END / EQU / = / DATA / BIT / DB / DW / DS / CSEG AT / 等
 *   · 表达式：+ - * / MOD SHL SHR AND OR XOR NOT HIGH LOW () $ 与 '字符'
 *   · 支持 SFR 名、位名（PSW.7 / CY / P1.0 / 20H.3）
 * ========================================================================== */
(function (root) {
  'use strict';

  var STC = root.STC = root.STC || {};
  var OP = STC.opcodes;
  var CHIP = STC.chip;

  var EXPR_KINDS = ['direct', 'bit', 'rel', 'addr11', 'addr16'];

  /* ------------------------------------------------------------------ 工具 */

  function stripComment(line) {
    var out = '', q = null;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        out += c;
        if (c === q) q = null;
      } else if (c === '"' || c === "'") { q = c; out += c; }
      else if (c === ';') break;
      else out += c;
    }
    return out;
  }

  /** 按顶层逗号切分操作数（引号与括号内的逗号不算） */
  function splitOperands(s) {
    var parts = [], cur = '', depth = 0, q = null;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim() !== '' || parts.length) parts.push(cur.trim());
    return parts.filter(function (p, idx, arr) { return !(p === '' && arr.length === 1); });
  }

  function isIdent(s) { return /^[A-Za-z_?$][A-Za-z0-9_?]*$/.test(s); }

  /** 编辑距离（用于“未定义符号”的近似拼写建议） */
  function editDistance(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1), i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }

  /* -------------------------------------------------------- 表达式求值器 */

  function ExprError(msg) { this.message = msg; }

  function lexExpr(s) {
    var toks = [], i = 0;
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '(' || c === ')') { toks.push({ t: c }); i++; continue; }
      if (c === "'") {                       // 字符常量
        var j = s.indexOf("'", i + 1);
        if (j < 0) throw new ExprError('字符常量缺少结束的单引号');
        var body = s.slice(i + 1, j);
        var val = 0;
        if (body.length && body[0] === '\\') {
          var esc = body.slice(1);
          val = esc === 'n' ? 10 : esc === 'r' ? 13 : esc === 't' ? 9 : esc === '0' ? 0 : esc.charCodeAt(0);
        } else if (body.length) val = body.charCodeAt(0);
        toks.push({ t: 'num', v: val, raw: s.slice(i, j + 1) });
        i = j + 1; continue;
      }
      if (c === '$') { toks.push({ t: 'cur' }); i++; continue; }
      if (/[0-9]/.test(c)) {                 // 数字（含 0x..H/..H/..B/..D/十进制）
        var m = /^0[xX][0-9A-Fa-f]+/.exec(s.slice(i));
        if (m) { toks.push({ t: 'num', v: parseInt(m[0], 16), raw: m[0] }); i += m[0].length; }
        else {
          m = /^[0-9][0-9A-Fa-f]*[Hh]/.exec(s.slice(i));
          if (m) { toks.push({ t: 'num', v: parseInt(m[0].slice(0, -1), 16), raw: m[0] }); i += m[0].length; }
          else {
            m = /^[01]+[Bb]/.exec(s.slice(i));
            if (m) { toks.push({ t: 'num', v: parseInt(m[0].slice(0, -1), 2), raw: m[0] }); i += m[0].length; }
            else {
              m = /^[0-9]+[Dd]?/.exec(s.slice(i));
              toks.push({ t: 'num', v: parseInt(m[0].replace(/[Dd]$/, ''), 10), raw: m[0] });
              i += m[0].length;
            }
          }
        }
        // 直接地址的位写法：20H.3 / 2FH.7
        if (s[i] === '.' && /[0-7]/.test(s[i + 1] || '')) {
          toks[toks.length - 1].dotbit = parseInt(s[i + 1], 10);
          i += 2;
        }
        continue;
      }
      if (/[A-Za-z_?]/.test(c)) {
        var mi = /^[A-Za-z_?][A-Za-z0-9_?]*/.exec(s.slice(i));
        var name = mi[0];
        var upName = name.toUpperCase();
        // 表达式运算符关键字（避免被当成符号名）
        if (['MOD', 'SHL', 'SHR', 'AND', 'OR', 'XOR', 'NOT', 'HIGH', 'LOW'].indexOf(upName) >= 0) {
          toks.push({ t: 'op', v: upName });
          i += name.length;
          continue;
        }
        i += name.length;
        // SFR 的位写法：P1.0 / PSW.7 / ACC.3
        var dotbit = null;
        if (s[i] === '.' && /[0-7]/.test(s[i + 1] || '')) { dotbit = parseInt(s[i + 1], 10); i += 2; }
        toks.push({ t: 'id', name: name, dotbit: dotbit });
        continue;
      }
      var opm = /^(SHL|SHR|MOD|AND|XOR|OR|NOT|HIGH|LOW|[-+*/])/i.exec(s.slice(i));
      if (opm) { toks.push({ t: 'op', v: opm[0].toUpperCase() }); i += opm[0].length; continue; }
      throw new ExprError('无法识别的字符 “' + c + '”');
    }
    return toks;
  }

  /**
   * 计算表达式。
   * @param {string} s
   * @param {object} ctx { symbols, addr, allowUnknown }
   * @returns {number}
   */
  function evaluate(s, ctx) {
    var toks = lexExpr(s), pos = 0;

    function peek() { return toks[pos]; }
    function next() { return toks[pos++]; }

    function resolveId(tok) {
      var key = tok.name.toUpperCase();
      var sym = ctx.symbols[key];
      if (sym && sym.value !== undefined && sym.value !== null) return sym.value;
      var sfr = CHIP.sfrByName[key];
      if (sfr) return sfr.addr;
      var bit = CHIP.bitByName[key];
      if (bit !== undefined) return bit;
      if (ctx.allowUnknown) return 0;
      throw new ExprError('未定义的符号 “' + tok.name + '”');
    }

    function primary() {
      var t = peek();
      if (!t) throw new ExprError('表达式不完整');
      var v;
      if (t.t === 'num') { next(); v = t.v; }
      else if (t.t === 'cur') { next(); v = ctx.addr || 0; }
      else if (t.t === 'id') { next(); v = resolveId(t); }
      else if (t.t === '(') { next(); v = parseOrXor(); if (!peek() || peek().t !== ')') throw new ExprError('缺少右括号'); next(); }
      else throw new ExprError('表达式语法错误');

      // “字节地址.位号”写法：20H.3（RAM 位寻址区）或 PSW.7（位可寻址 SFR）
      if (t.dotbit !== null && t.dotbit !== undefined) {
        var base = v;
        if (base >= 0x20 && base <= 0x2F) v = (base - 0x20) * 8 + t.dotbit;
        else if (base >= 0x80 && (base & 7) === 0) v = base + t.dotbit;
        else throw new ExprError('地址 ' + base.toString(16).toUpperCase() + 'H 不可位寻址');
      }
      return v;
    }

    function unary() {
      var t = peek();
      if (t && t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === 'NOT' || t.v === 'HIGH' || t.v === 'LOW')) {
        next();
        var v = unary();
        if (t.v === '-') return (-v) & 0xFFFF;
        if (t.v === '+') return v;
        if (t.v === 'NOT') return (~v) & 0xFFFF;
        if (t.v === 'HIGH') return (v >> 8) & 0xFF;
        return v & 0xFF;
      }
      return primary();
    }
    function mulDiv() {
      var v = unary();
      for (;;) {
        var t = peek();
        if (!t || t.t !== 'op' || ['*', '/', 'MOD', 'SHL', 'SHR'].indexOf(t.v) < 0) return v;
        next();
        var r = unary();
        if (t.v === '*') v = (v * r) & 0xFFFF;
        else if (t.v === '/') { if (r === 0) throw new ExprError('除数为 0'); v = Math.floor(v / r); }
        else if (t.v === 'MOD') { if (r === 0) throw new ExprError('除数为 0'); v = v % r; }
        else if (t.v === 'SHL') v = (v << r) & 0xFFFF;
        else v = (v >> r) & 0xFFFF;
      }
    }
    function addSub() {
      var v = mulDiv();
      for (;;) {
        var t = peek();
        if (!t || t.t !== 'op' || (t.v !== '+' && t.v !== '-')) return v;
        next();
        var r = mulDiv();
        v = t.v === '+' ? (v + r) & 0xFFFF : (v - r) & 0xFFFF;
      }
    }
    function parseAnd() {
      var v = addSub();
      for (;;) {
        var t = peek();
        if (!t || t.t !== 'op' || t.v !== 'AND') return v;
        next();
        v = v & addSub();
      }
    }
    function parseOrXor() {
      var v = parseAnd();
      for (;;) {
        var t = peek();
        if (!t || t.t !== 'op' || (t.v !== 'OR' && t.v !== 'XOR')) return v;
        next();
        var r = parseAnd();
        v = t.v === 'OR' ? (v | r) : (v ^ r);
      }
    }

    var result = parseOrXor();
    if (pos < toks.length) throw new ExprError('表达式尾部有多余内容 “' + (toks[pos].raw || toks[pos].name || toks[pos].v || '') + '”');
    return result & 0xFFFF;
  }

  /* ------------------------------------------------------------ 行解析 */

  var DIRECTIVES = {
    ORG: 1, END: 1, EQU: 1, DATA: 1, BIT: 1, DB: 1, DEFB: 1, DW: 1, DEFW: 1, DS: 1,
    CSEG: 1, DSEG: 1, BSEG: 1, XSEG: 1, SEGMENT: 1, USING: 1, PUBLIC: 1, EXTRN: 1,
    NAME: 1, '$INCLUDE': 1, INCLUDE: 1, '$NOMOD51': 1, '$MOD51': 1, '=': 1, SET: 1,
    IF: 1, ELSE: 1, ENDIF: 1, 'INCLUDE ': 1, TITLE: 1, PAGE: 1, LIST: 1, NOLIST: 1,
    XDATA: 1, CODE: 1, IDATA: 1, DATA_: 1, BIT_: 1, NUMBER: 1, ERROR: 1
  };

  /** 把一行源码解析为结构化对象 */
  function parseLine(rawLine, lineNo) {
    var line = stripComment(rawLine);
    var obj = { line: lineNo, raw: rawLine, text: line.trim(), label: null, op: null, operands: [], addr: null, len: 0, entry: null, error: null };

    var rest = line;
    // 行首标号
    var lm = /^\s*([A-Za-z_?][A-Za-z0-9_?]*)\s*:\s*/.exec(rest);
    if (lm) { obj.label = lm[1]; rest = rest.slice(lm[0].length); }

    var t = rest.trim();
    if (t === '') return obj;

    // 符号定义：NAME EQU/DATA/BIT/= expr
    var dm = /^([A-Za-z_?][A-Za-z0-9_?]*)\s+(EQU|DATA|BIT|SET|=)\s+(.+)$/i.exec(t);
    if (dm) {
      obj.op = dm[2].toUpperCase() === '=' ? 'EQU' : dm[2].toUpperCase();
      obj.label = obj.label || dm[1];
      obj.operands = [dm[3].trim()];
      obj.isSymbolDef = true;
      return obj;
    }

    // 普通行：助记符/伪指令 操作数
    var im = /^(\S+)\s*(.*)$/.exec(t);
    obj.op = im[1].toUpperCase();
    obj.operands = im[2].trim() === '' ? [] : splitOperands(im[2]);
    if (obj.operands.length === 1 && obj.operands[0] === '') obj.operands = [];
    return obj;
  }

  /* --------------------------------------------------- 操作数分类与匹配 */

  /** 把一个操作数记号分类成可能接受的“操作数种类”集合 */
  function classifyToken(tok, symbols) {
    var s = tok.trim();
    var set = Object.create(null);
    var rn = -1;
    var kind = 'expr';

    var upper = s.toUpperCase();
    var symHere = symbols[upper] !== undefined && symbols[upper].value !== undefined;

    function addAll() { EXPR_KINDS.forEach(function (k) { set[k] = true; }); }

    if (s[0] === '#') { set['#immed'] = true; set['#immed16'] = true; kind = '#expr'; }
    else if (s[0] === '/') { set['/bit'] = true; kind = '/expr'; }
    else if (/^@R[01]$/i.test(s)) { set['@' + s.slice(1).toUpperCase()] = true; kind = 'indirect'; }
    else if (/^@DPTR$/i.test(s)) { set['@DPTR'] = true; kind = 'indirect'; }
    else if (/^@A\s*\+\s*DPTR$/i.test(s)) { set['@A+DPTR'] = true; kind = 'indirect'; }
    else if (/^@A\s*\+\s*PC$/i.test(s)) { set['@A+PC'] = true; kind = 'indirect'; }
    else if (/^@DPTR\s*\+\s*A$/i.test(s)) { set['@A+DPTR'] = true; kind = 'indirect'; }   // 兼容 @DPTR+A 写法
    else if (/^@PC\s*\+\s*A$/i.test(s)) { set['@A+PC'] = true; kind = 'indirect'; }       // 兼容 @PC+A 写法
    else if (/^R[0-7]$/.test(upper) && !symHere) { set['Rn'] = true; rn = parseInt(upper.slice(1), 10); kind = 'rn'; }
    else if (upper === 'A' && !symHere) { set['A'] = true; kind = 'acc'; }
    else if (upper === 'AB' && !symHere) { set['AB'] = true; kind = 'ab'; }
    else if ((upper === 'C' || upper === 'CY') && !symHere) { set['C'] = true; kind = 'cy'; }
    else if (upper === 'DPTR' && !symHere) { set['DPTR'] = true; kind = 'dptr'; }
    else { addAll(); kind = 'expr'; }

    if (kind === 'expr' || kind === 'rn') {
      // 关键字也可能是用户符号做表达式（容错）
      if (symHere && kind === 'expr') addAll();
    }
    return { text: s, kinds: set, rn: rn, kind: kind };
  }

  /** 为一个已解析行挑选指令模板 */
  function matchInstruction(obj, symbols) {
    var mnem = obj.op;

    /* 先拦掉写错的间接寻址，给出能照着改的提示（否则会掉进表达式报“无法识别的字符 @”） */
    for (var q = 0; q < obj.operands.length; q++) {
      var tk0 = String(obj.operands[q]).trim();
      if (tk0.charAt(0) !== '@') continue;
      var flat0 = tk0.toUpperCase().replace(/\s+/g, '');
      if (!/^@(R[01]|DPTR|A\+DPTR|A\+PC|DPTR\+A|PC\+A)$/.test(flat0)) {
        if (/^@R[2-7]$/.test(flat0)) {
          return { entry: null, error: '间接寻址只能用 @R0 或 @R1，不能用 ' + tk0 +
            '（8051 里只有 R0/R1 能当间址寄存器；要搬数组可把指针放 R0/R1，计数用 R2~R7）' };
        }
        return { entry: null, error: '无法识别的间接寻址写法 “' + tk0 +
          '”（可用：@R0、@R1、@DPTR、@A+DPTR、@A+PC）' };
      }
    }

    var cands = OP.byMnemonic[mnem];
    if (!cands) return { entry: null, error: '未知的指令或伪指令 “' + mnem + '”' };
    var toks = obj.operands.map(function (o) { return classifyToken(o, symbols); });

    var best = null, bestScore = -1, matches = 0;
    for (var i = 0; i < cands.length; i++) {
      var e = cands[i];
      if (e.kinds.length !== toks.length) continue;
      var ok = true, score = 0;
      for (var k = 0; k < e.kinds.length; k++) {
        var kind = e.kinds[k], tk = toks[k];
        if (kind === 'Rn') {
          if (!tk.kinds['Rn'] || tk.rn !== e.rn) { ok = false; break; }
          score += 3;
        } else if (tk.kinds[kind]) {
          score += (kind === 'direct' || kind === 'bit' || kind === 'rel' || kind === 'addr11' || kind === 'addr16') ? 1 : 2;
        } else { ok = false; break; }
      }
      if (!ok) continue;
      matches++;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (!best) {
      /* 针对最常写错的两种寻址方式给出可直接照抄的正确写法 */
      var flat = obj.operands.map(function (x) { return String(x).toUpperCase().replace(/\s+/g, ''); });
      var tip = '';
      if (mnem === 'MOVC') {
        if (flat.indexOf('@DPTR') >= 0) {
          tip = '。MOVC 只能变址寻址，要写成 MOVC A,@A+DPTR（DPTR 指向表首、A 是表内偏移）；' +
                '若要按 DPTR 读数据存储器请用 MOVX A,@DPTR';
        } else if (flat.indexOf('@R0') >= 0 || flat.indexOf('@R1') >= 0) {
          tip = '。MOVC 不支持 @R0/@R1，请用 MOVC A,@A+DPTR 或 MOVC A,@A+PC';
        } else if (flat.some(function (x) { return x[0] === '#'; })) {
          tip = '。MOVC 的源操作数不能是立即数，应为 @A+DPTR 或 @A+PC';
        } else {
          tip = '。MOVC 只有两种写法：MOVC A,@A+DPTR（基址=DPTR）、MOVC A,@A+PC（基址=下一条指令地址）';
        }
      } else if (mnem === 'MOVX' && flat.indexOf('@A+DPTR') >= 0) {
        tip = '。MOVX 用于访问数据存储器，应写成 MOVX A,@DPTR 或 MOVX A,@R0/@R1（不带 +A）；' +
              '要查代码空间的表请用 MOVC A,@A+DPTR';
      } else if (mnem === 'MOV' && flat.indexOf('@DPTR') >= 0) {
        tip = '。MOV 不能按 DPTR 间址存取，要按 DPTR 访问数据存储器请用 MOVX A,@DPTR / MOVX @DPTR,A';
      }
      return { entry: null, error: '“' + mnem + '” 不支持这样的操作数：' + (obj.operands.join(',') || '(无)') + tip };
    }
    return { entry: best, tokens: toks, error: null };
  }

  /* ------------------------------------------------------ 主汇编流程 */

  function assemble(source, opts) {
    opts = opts || {};
    var startAddr = opts.startAddr || 0;
    var maxAddr = opts.maxAddr || 0xFFFF;

    var rawLines = String(source).replace(/\r\n?/g, '\n').split('\n');
    var objs = rawLines.map(function (l, i) { return parseLine(l, i + 1); });

    var symbols = Object.create(null);
    var afterEndLabels = Object.create(null);   // END 之后被忽略的标号：名字 → 行号
    var errors = [], warnings = [], hints = [], warnedKeys = Object.create(null);

    function warn(o, msg) {
      var key = o.line + '|' + msg;
      if (warnedKeys[key]) return;
      warnedKeys[key] = 1;
      warnings.push({ line: o.line, text: o.raw.trim(), msg: msg });
    }
    function hint(o, msg) {
      var key = o.line + '|h|' + msg;
      if (warnedKeys[key]) return;
      warnedKeys[key] = 1;
      hints.push({ line: o.line, text: o.raw.trim(), msg: msg });
    }
    function fail(o, msg) { errors.push({ line: o.line, text: o.raw.trim(), msg: msg }); o.error = msg; }

    function defineSymbol(o, name, kind, value) {
      var key = name.toUpperCase();
      var prev = symbols[key];
      if (prev && prev.kind !== 'LABEL' && prev.line !== o.line && prev.value !== value) {
        warn(o, '符号 “' + name + '” 重复定义（原定义在第 ' + prev.line + ' 行）');
      }
      if (!prev || prev.value !== value || prev.kind !== kind) {
        symbols[key] = { name: name, kind: kind, value: value, line: o.line, changed: !prev || prev.value !== value };
        return true;
      }
      return false;
    }

    /* ---------------- 迭代定位：直到符号值与各指令长度稳定 ---------------- */
    var pass, stable = false;
    for (pass = 0; pass < 8 && !stable; pass++) {
      Object.keys(symbols).forEach(function (k) { symbols[k].changed = false; });
      var cur = startAddr & 0xFFFF;
      var anyChange = false;

      for (var i = 0; i < objs.length; i++) {
        var o = objs[i];
        o.addr = cur; o.len = 0; o.entry = null; o.error = null;
        if (o.text === '') continue;

        if (o.label && !o.isSymbolDef) {
          if (defineSymbol(o, o.label, 'LABEL', cur)) anyChange = true;
        }
        /* 只有标号的行（如 “CZX:”）不产生任何代码 */
        if (!o.op) { o.len = 0; continue; }

        var op = o.op;
        if (op === 'ORG') {
          var v = 0;
          try { v = evaluate(o.operands[0], { symbols: symbols, addr: cur, allowUnknown: true }); }
          catch (e) { /* 最终编码阶段再报错 */ }
          cur = v & 0xFFFF;
          o.addr = cur;
          continue;
        }
        if (op === 'END') {
          o.len = 0;
          var ignored = 0;
          for (var j = i + 1; j < objs.length; j++) {
            objs[j].skipped = true;
            if (objs[j].text !== '') ignored++;
            if (objs[j].label) afterEndLabels[objs[j].label.toUpperCase()] = objs[j].line;
          }
          var afterNames = Object.keys(afterEndLabels);
          if (ignored) {
            warn(o, 'END 之后的 ' + ignored + ' 行不会被汇编' +
              (afterNames.length ? '，其中的标号也不会被定义：' + afterNames.join('、') +
                '（如果这些标号在后面被调用，就会报“未定义的符号”）' : ''));
          }
          break;
        }
        if (op === 'CSEG' || op === 'DSEG' || op === 'BSEG' || op === 'XSEG') {
          var at = /AT\s+(.+)$/i.exec(o.operands.join(','));
          if (at) {
            try { cur = evaluate(at[1], { symbols: symbols, addr: cur, allowUnknown: true }) & 0xFFFF; } catch (e) { }
            o.addr = cur;
          }
          continue;
        }
        if (op === 'SEGMENT' || op === 'USING' || op === 'PUBLIC' || op === 'EXTRN' || op === 'NAME' ||
            op === 'TITLE' || op === 'PAGE' || op === 'LIST' || op === 'NOLIST' || op === '$NOMOD51' || op === '$MOD51') {
          if (op === 'PUBLIC' || op === 'EXTRN' || op === 'SEGMENT') warn(o, '忽略不支持的伪指令 ' + op + '（模拟器不需要多模块链接）');
          continue;
        }
        if (op === '$INCLUDE' || op === 'INCLUDE') { warn(o, '不支持 $INCLUDE 头文件，已忽略该行'); continue; }
        if (op === 'IF' || op === 'ELSE' || op === 'ENDIF') { warn(o, '不支持条件汇编 IF/ELSE/ENDIF，已忽略该行'); continue; }

        if (op === 'EQU' || op === 'DATA' || op === 'BIT' || op === 'SET') {
          o.isSymbolDef = true;
          var val = null;
          try { val = evaluate(o.operands[0], { symbols: symbols, addr: cur, allowUnknown: true }); }
          catch (e) { /* 最终编码阶段再报错 */ }
          if (val !== null) {
            var kind = op === 'EQU' ? 'EQU' : (op === 'DATA' ? 'DATA' : (op === 'BIT' ? 'BIT' : 'EQU'));
            if (defineSymbol(o, o.label, kind, val)) anyChange = true;
          }
          o.len = 0;
          continue;
        }

        if (op === 'DB' || op === 'DEFB' || op === 'DW' || op === 'DEFW') {
          o.len = 0;
          o.isData = true;
          o.dataWidth = (op === 'DW' || op === 'DEFW') ? 2 : 1;
          // 只有单字符串且无逗号时长度可确定为字符串长度，其余按逐个表达式 1 个元素
          var total = 0;
          for (var d = 0; d < o.operands.length; d++) {
            var tk = o.operands[d];
            if (/^".*"$/.test(tk) || /^'.*'$/.test(tk)) total += (tk.length - 2);
            else total += o.dataWidth;
          }
          o.len = total;
          cur = (cur + o.len) & 0xFFFF;
          continue;
        }
        if (op === 'DS') {
          o.isReserve = true;
          o.len = 0;
          try { o.len = evaluate(o.operands[0], { symbols: symbols, addr: cur, allowUnknown: true }) & 0xFFFF; }
          catch (e) { /* 最终编码阶段再报错 */ }
          cur = (cur + o.len) & 0xFFFF;
          continue;
        }
        if (op === 'XDATA' || op === 'CODE' || op === 'IDATA' || op === 'NUMBER' || op === 'ERROR') {
          warn(o, '忽略伪指令 ' + op); continue;
        }

        // 普通指令
        var m = matchInstruction(o, symbols);
        if (m.error) {
          o.len = 1 + o.operands.length;  // 保守长度，避免后续地址重叠
          o.error = m.error;
        } else {
          o.entry = m.entry;
          o.kindInfo = m.tokens;
          o.len = m.entry.len;
        }
        cur = (cur + o.len) & 0xFFFF;
      }
      if (!anyChange && pass > 0) stable = true;
      if (pass === 0 && !anyChange) { /* 无符号变化，仍需再跑一遍编码 */ }
    }

    /* ---------------------------- 最终编码 ---------------------------- */
    /* 真实 Flash 擦除态是 FFH，未写入的代码空间保持 FFH 才与硬件一致
       （MOVC 读到未编程区域应得 FFH，而不是 00H） */
    var rom = new Uint8Array(0x10000).fill(0xFF);
    var used = new Uint8Array(0x10000);
    var listing = [];
    var minAddr = 0x10000, maxUsed = -1;

    function evalFinal(o, s, addr) {
      return evaluate(s, { symbols: symbols, addr: addr, allowUnknown: false });
    }

    var IGNORED_OPS = {
      SEGMENT: 1, USING: 1, PUBLIC: 1, EXTRN: 1, NAME: 1, $INCLUDE: 1, INCLUDE: 1, CSEG: 1, DSEG: 1, BSEG: 1,
      XSEG: 1, IF: 1, ELSE: 1, ENDIF: 1, TITLE: 1, PAGE: 1, LIST: 1, NOLIST: 1, $NOMOD51: 1, $MOD51: 1,
      XDATA: 1, CODE: 1, IDATA: 1, NUMBER: 1, ERROR: 1
    };

    for (var i2 = 0; i2 < objs.length; i2++) {
      var o2 = objs[i2];
      if (o2.text === '' || o2.skipped) continue;
      /* 只有标号的行：在清单里保留一行（便于设光标 / 看地址），但不产生字节 */
      if (!o2.op) {
        if (o2.label) {
          listing.push({
            addr: o2.addr >>> 0, bytes: [], text: o2.label + ':', kind: 'label',
            line: o2.line, src: o2.raw.trim(), label: o2.label
          });
        }
        continue;
      }
      if (o2.op === 'END') {
        listing.push({ addr: null, bytes: [], text: 'END', kind: 'end', line: o2.line, src: o2.raw.trim(), label: o2.label });
        continue;
      }
      if (IGNORED_OPS[o2.op]) continue;

      var addr = o2.addr >>> 0;
      var bytes = [];

      /* 表达式类伪指令：在符号表稳定后做一次最终求值，检查错误 */
      if (o2.op === 'ORG' || o2.op === 'DS' || o2.isSymbolDef) {
        if (o2.operands && o2.operands.length) {
          try { evalFinal(o2, o2.operands[0], o2.addr); }
          catch (e) {
            var what = o2.op === 'ORG' ? 'ORG 地址' : (o2.op === 'DS' ? 'DS 长度' : '符号 “' + o2.label + '” 的定义值');
            fail(o2, what + '表达式错误：' + e.message);
          }
        }
        if (o2.isReserve && !o2.error) {
          for (var z = 0; z < o2.len; z++) bytes.push(0);
        } else if (o2.op === 'ORG' || o2.isSymbolDef) {
          continue;
        }
      } else if (o2.isData) {
        for (var d2 = 0; d2 < o2.operands.length; d2++) {
          var tk2 = o2.operands[d2];
          var sm = /^"(.*)"$/s.exec(tk2) || /^'(.*)'$/s.exec(tk2);
          if (sm) {
            var str = sm[1].replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\0/g, '\0').replace(/\\\\/g, '\\');
            for (var ci = 0; ci < str.length; ci++) {
              if (o2.dataWidth === 2) { bytes.push(0); bytes.push(str.charCodeAt(ci) & 0xFF); }
              else bytes.push(str.charCodeAt(ci) & 0xFF);
            }
          } else {
            var v2;
            try { v2 = evalFinal(o2, tk2, addr + bytes.length); }
            catch (e) { fail(o2, '数据表达式错误：' + e.message); continue; }
            if (o2.dataWidth === 2) { bytes.push((v2 >> 8) & 0xFF); bytes.push(v2 & 0xFF); }
            else {
              if (v2 > 0xFF) warn(o2, '数据 “' + tk2 + '” 超出 8 位，只取低 8 位');
              bytes.push(v2 & 0xFF);
            }
          }
        }
      } else if (o2.entry) {
        bytes = encodeInstruction(o2, evalFinal, fail, warn, hint, function (sym) {
          var raw = String(sym).trim();
          var key = raw.toUpperCase();
          if (afterEndLabels[key]) {
            return '（该标号定义在第 ' + afterEndLabels[key] + ' 行，但那一行在 END 之后，汇编已经停止 —— ' +
              '请把 END 移到最后一行）';
          }
          /* 拼写近似建议：常见于把 PTDS 写成 PTDSS 之类 */
          var best = null, bestD = 99;
          Object.keys(symbols).forEach(function (k) {
            var d = editDistance(key, k);
            if (d < bestD) { bestD = d; best = symbols[k]; }
          });
          var limit = Math.max(1, Math.min(3, Math.round(key.length / 2) - 1));
          if (best && bestD <= limit) {
            return '（是不是想写 “' + best.name + '”？已定义的' +
              (best.kind === 'LABEL' ? '标号' : '符号') + '里最接近的是它，定义在第 ' + best.line + ' 行）';
          }
          /* 一个都没有定义时，给个更直白的说明 */
          var labelCount = Object.keys(symbols).filter(function (k) { return symbols[k].kind === 'LABEL'; }).length;
          if (labelCount === 0) return '（当前源码里没有定义任何标号）';
          return '';
        });
      } else {
        fail(o2, o2.error || '无法识别的内容：“' + o2.text + '”');
        continue;
      }

      if (bytes.length && (addr + bytes.length - 1) > maxAddr && !o2.error) {
        fail(o2, '程序超出代码空间上限（' + OP.hex(maxAddr, 4) + '）');
      }

      // 写入 rom
      for (var bi2 = 0; bi2 < bytes.length; bi2++) {
        var a2 = (addr + bi2) & 0xFFFF;
        rom[a2] = bytes[bi2];
        used[a2] = 1;
        if (a2 < minAddr) minAddr = a2;
        if (a2 > maxUsed) maxUsed = a2;
      }

      var text;
      if (o2.entry && bytes.length) {
        var dis = OP.disasm(rom, addr, {
          directName: function (a) { return CHIP.directName(a); },
          bitName: function (a) { return CHIP.bitNameShort(a); }
        });
        text = dis.text;
      } else if (o2.isData || o2.isReserve) {
        text = '.DB ' + bytes.map(function (b) { return OP.hex(b); }).join(',');
      } else {
        text = o2.op + (o2.operands.length ? ' ' + o2.operands.join(',') : '');
      }
      listing.push({
        addr: addr, bytes: bytes, text: text, kind: (o2.isData || o2.isReserve) ? 'data' : 'instr',
        line: o2.line, src: o2.raw.trim(), label: o2.label, op: o2.op
      });
    }

    /* 复位向量检查：真机复位后 PC=0000H，若 0000H 没有指令会先执行空片 FFH */
    var firstInstr = null, hasCodeAtZero = false;
    for (var q = 0; q < listing.length; q++) {
      if (listing[q].kind !== 'instr') continue;
      if (!firstInstr) firstInstr = listing[q];
      if (listing[q].addr === 0) { hasCodeAtZero = true; break; }
    }
    if (firstInstr && !hasCodeAtZero) {
      hint({ line: firstInstr.line, raw: firstInstr.src },
        '复位后 PC 从 0000H 开始取指，但 0000H 处没有指令：真机与本模拟器都会先执行空片的 FFH' +
        '（相当于连续的 MOV R7,A / INC R0 之类的单字节指令），一路滑到 ' + OP.hex(firstInstr.addr, 4) +
        ' 才开始执行你的代码。建议开头补上：ORG 0000H 与 LJMP <入口标号>' +
        '（0003H/000BH/0013H/001BH/0023H… 还要留给中断向量）。');
    }

    /* ---------------------------- 符号表输出 ---------------------------- */
    var symbolList = Object.keys(symbols).map(function (k) {
      var s = symbols[k];
      return { name: s.name, kind: s.kind, value: s.value, line: s.line };
    }).sort(function (a, b) { return a.kind === b.kind ? (a.value - b.value) : (a.kind < b.kind ? -1 : 1); });

    var blockMap = new Array(256);
    for (var b3 = 0; b3 < 256; b3++) {
      var cnt = 0;
      for (var k3 = 0; k3 < 256; k3++) if (used[b3 * 256 + k3]) cnt++;
      blockMap[b3] = cnt;
    }

    return {
      ok: errors.length === 0,
      rom: rom,
      used: used,
      listing: listing,
      symbols: symbolList,
      errors: errors,
      warnings: warnings,
      hints: hints,
      startAddr: minAddr === 0x10000 ? 0 : minAddr,
      endAddr: maxUsed,
      codeBytes: maxUsed < 0 ? 0 : (function () { var n = 0; for (var q = 0; q < 0x10000; q++) if (used[q]) n++; return n; })(),
      blockMap: blockMap,
      entry: (function () {
        for (var li = 0; li < listing.length; li++) if (listing[li].kind === 'instr') return listing[li].addr;
        return 0;
      })()
    };
  }

  /** 编码一条指令 */
  function encodeInstruction(o, evalFinal, fail, warn, hint, explain) {
    var e = o.entry;
    var kinds = e.kinds;
    var vals = [];
    var i;
    for (i = 0; i < kinds.length; i++) {
      var s = o.operands[i];
      var kind = kinds[i];
      try {
        if (kind === '#immed' || kind === '#immed16' || kind === 'direct' || kind === 'bit' || kind === '/bit' || kind === 'rel' || kind === 'addr11' || kind === 'addr16') {
          // 指令中 “$” 表示本指令的地址（A51 惯例：SJMP $ 即 80H,FEH）
          vals.push(evalFinal(o, s.replace(/^#|^\//, ''), o.addr));
        } else vals.push(null);
      } catch (err) {
        var extra = explain ? explain(s.replace(/^#|^\//, '')) : '';
        fail(o, '操作数 “' + s + '” 错误：' + err.message + extra);
        return new Array(e.len).fill(0);
      }
    }

    var bytes = [];
    var opcode = e.op;
    var p;

    // AJMP / ACALL：按目标地址所在 2KB 页决定操作码高 3 位
    if (kinds.indexOf('addr11') >= 0) {
      var target11 = vals[0] & 0xFFFF;
      var nextPC = (o.addr + 2) & 0xFFFF;
      if ((target11 & 0xF800) !== (nextPC & 0xF800)) {
        // 允许用户直接写 0800H 之类的低位形式：取目标低 11 位，页固定为当前页
        var low11 = target11 & 0x7FF;
        target11 = (nextPC & 0xF800) | low11;
        warn(o, 'AJMP/ACALL 目标 ' + OP.hex(vals[0], 4) + ' 不在当前 2KB 页内，已按当前页（低 11 位）编码为 ' + OP.hex(target11, 4));
      }
      opcode = (e.op & 0x1F) | (((target11 >> 8) & 0x07) << 5);
      bytes.push(opcode, target11 & 0xFF);
      return bytes;
    }

    bytes.push(opcode);
    if (e.rev) {  // MOV direct,direct：机器码顺序为 源, 目的
      bytes.push(vals[1] & 0xFF, vals[0] & 0xFF);
      return bytes;
    }
    for (i = 0; i < kinds.length; i++) {
      var kd = kinds[i], v = vals[i];
      switch (kd) {
        case 'direct':
          if (v > 0xFF) { fail(o, '直接地址 ' + OP.hex(v, 4) + ' 超出 8 位'); v &= 0xFF; }
          // 教学提示：直接寻址 80H~FFH 落在 SFR 区，不是内部 RAM 的高 128 字节
          if (v >= 0x80 && /^[0-9]/.test(String(o.operands[i] || '').trim()) && hint) {
            var sfr = CHIP.sfrByAddr[v];
            hint(o, '直接地址 ' + OP.hex(v) + (sfr ? '（SFR ' + sfr.name + '）' : '') +
              ' 属于特殊功能寄存器区，写的是 SFR，不是内部 RAM。' +
              '要访问内部 RAM 的 80H~FFH（仅可间接寻址），请写成：MOV R0,#' + OP.hex(v) + ' 然后 MOV @R0,A');
          }
          bytes.push(v & 0xFF); break;
        case 'bit':
        case '/bit':
          if (v > 0xFF) { fail(o, '位地址 ' + OP.hex(v, 4) + ' 超出 8 位'); v &= 0xFF; }
          bytes.push(v & 0xFF); break;
        case '#immed':
          if (v > 0xFF) { warn(o, '立即数 ' + OP.hex(v, 4) + ' 超出 8 位，只取低 8 位 ' + OP.hex(v & 0xFF)); }
          bytes.push(v & 0xFF); break;
        case '#immed16':
          bytes.push((v >> 8) & 0xFF, v & 0xFF); break;
        case 'addr16':
          bytes.push((v >> 8) & 0xFF, v & 0xFF); break;
        case 'rel':
          var off = v - ((o.addr + e.len) & 0xFFFF);
          if (off < -128 || off > 127) {
            fail(o, '相对转移目标 ' + OP.hex(v, 4) + ' 超出范围（相对偏移 ' + off + '，允许 -128~+127）');
            off = 0;
          }
          bytes.push(off & 0xFF); break;
        default: break;
      }
    }
    return bytes;
  }

  STC.assembler = { assemble: assemble, evaluate: evaluate, parseLine: parseLine, splitOperands: splitOperands };
})(typeof window !== 'undefined' ? window : globalThis);
