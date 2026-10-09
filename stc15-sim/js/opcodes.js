/* =============================================================================
 * opcodes.js —— MCS-51 / STC15 指令表（全部 256 个操作码）
 * 依据标准 8051 操作码映射表（行 = 高 4 位，列 = 低 4 位）生成。
 * 每个条目包含：助记符、操作数种类、机器码、字节数、机器周期数。
 * 浏览器与 Node 均可加载（UMD 风格，挂到全局 STC 命名空间）。
 * ========================================================================== */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------------------
   * 指令模板表
   * [助记符, 操作数种类数组, 起始操作码, 字节数, 机器周期, 重复数, 操作码步长, 变化的操作数下标]
   * 操作数种类：A AB C DPTR Rn @R0 @R1 @DPTR @A+DPTR @A+PC
   *             direct #immed #immed16 bit /bit rel addr11 addr16
   * ------------------------------------------------------------------------ */
  var T = [
    /* ---------- 第 0 行 ---------- */
    ['NOP',   [],                     0x00, 1, 1],
    ['AJMP',  ['addr11'],             0x01, 2, 2, 8, 0x20],
    ['LJMP',  ['addr16'],             0x02, 3, 2],
    ['RR',    ['A'],                  0x03, 1, 1],
    ['INC',   ['A'],                  0x04, 1, 1],
    ['INC',   ['direct'],             0x05, 2, 1],
    ['INC',   ['@R0'],                0x06, 1, 1],
    ['INC',   ['@R1'],                0x07, 1, 1],
    ['INC',   ['Rn'],                 0x08, 1, 1, 8, 1, 0],
    /* ---------- 第 1 行 ---------- */
    ['JBC',   ['bit', 'rel'],         0x10, 3, 2],
    ['ACALL', ['addr11'],             0x11, 2, 2, 8, 0x20],
    ['LCALL', ['addr16'],             0x12, 3, 2],
    ['RRC',   ['A'],                  0x13, 1, 1],
    ['DEC',   ['A'],                  0x14, 1, 1],
    ['DEC',   ['direct'],             0x15, 2, 1],
    ['DEC',   ['@R0'],                0x16, 1, 1],
    ['DEC',   ['@R1'],                0x17, 1, 1],
    ['DEC',   ['Rn'],                 0x18, 1, 1, 8, 1, 0],
    /* ---------- 第 2 行 ---------- */
    ['JB',    ['bit', 'rel'],         0x20, 3, 2],
    ['RET',   [],                     0x22, 1, 2],
    ['RL',    ['A'],                  0x23, 1, 1],
    ['ADD',   ['A', '#immed'],        0x24, 2, 1],
    ['ADD',   ['A', 'direct'],        0x25, 2, 1],
    ['ADD',   ['A', '@R0'],           0x26, 1, 1],
    ['ADD',   ['A', '@R1'],           0x27, 1, 1],
    ['ADD',   ['A', 'Rn'],            0x28, 1, 1, 8, 1, 1],
    /* ---------- 第 3 行 ---------- */
    ['JNB',   ['bit', 'rel'],         0x30, 3, 2],
    ['RETI',  [],                     0x32, 1, 2],
    ['RLC',   ['A'],                  0x33, 1, 1],
    ['ADDC',  ['A', '#immed'],        0x34, 2, 1],
    ['ADDC',  ['A', 'direct'],        0x35, 2, 1],
    ['ADDC',  ['A', '@R0'],           0x36, 1, 1],
    ['ADDC',  ['A', '@R1'],           0x37, 1, 1],
    ['ADDC',  ['A', 'Rn'],            0x38, 1, 1, 8, 1, 1],
    /* ---------- 第 4 行 ---------- */
    ['JC',    ['rel'],                0x40, 2, 2],
    ['ORL',   ['direct', 'A'],        0x42, 2, 1],
    ['ORL',   ['direct', '#immed'],   0x43, 3, 2],
    ['ORL',   ['A', '#immed'],        0x44, 2, 1],
    ['ORL',   ['A', 'direct'],        0x45, 2, 1],
    ['ORL',   ['A', '@R0'],           0x46, 1, 1],
    ['ORL',   ['A', '@R1'],           0x47, 1, 1],
    ['ORL',   ['A', 'Rn'],            0x48, 1, 1, 8, 1, 1],
    /* ---------- 第 5 行 ---------- */
    ['JNC',   ['rel'],                0x50, 2, 2],
    ['ANL',   ['direct', 'A'],        0x52, 2, 1],
    ['ANL',   ['direct', '#immed'],   0x53, 3, 2],
    ['ANL',   ['A', '#immed'],        0x54, 2, 1],
    ['ANL',   ['A', 'direct'],        0x55, 2, 1],
    ['ANL',   ['A', '@R0'],           0x56, 1, 1],
    ['ANL',   ['A', '@R1'],           0x57, 1, 1],
    ['ANL',   ['A', 'Rn'],            0x58, 1, 1, 8, 1, 1],
    /* ---------- 第 6 行 ---------- */
    ['JZ',    ['rel'],                0x60, 2, 2],
    ['XRL',   ['direct', 'A'],        0x62, 2, 1],
    ['XRL',   ['direct', '#immed'],   0x63, 3, 2],
    ['XRL',   ['A', '#immed'],        0x64, 2, 1],
    ['XRL',   ['A', 'direct'],        0x65, 2, 1],
    ['XRL',   ['A', '@R0'],           0x66, 1, 1],
    ['XRL',   ['A', '@R1'],           0x67, 1, 1],
    ['XRL',   ['A', 'Rn'],            0x68, 1, 1, 8, 1, 1],
    /* ---------- 第 7 行 ---------- */
    ['JNZ',   ['rel'],                0x70, 2, 2],
    ['ORL',   ['C', 'bit'],           0x72, 2, 2],
    ['JMP',   ['@A+DPTR'],            0x73, 1, 2],
    ['MOV',   ['A', '#immed'],        0x74, 2, 1],
    ['MOV',   ['direct', '#immed'],   0x75, 3, 2],
    ['MOV',   ['@R0', '#immed'],      0x76, 2, 1],
    ['MOV',   ['@R1', '#immed'],      0x77, 2, 1],
    ['MOV',   ['Rn', '#immed'],       0x78, 2, 1, 8, 1, 0],
    /* ---------- 第 8 行 ---------- */
    ['SJMP',  ['rel'],                0x80, 2, 2],
    ['ANL',   ['C', 'bit'],           0x82, 2, 2],
    ['MOVC',  ['A', '@A+PC'],         0x83, 1, 2],
    ['DIV',   ['AB'],                 0x84, 1, 4],
    ['MOV',   ['direct', 'direct'],   0x85, 3, 2],
    ['MOV',   ['direct', '@R0'],      0x86, 2, 2],
    ['MOV',   ['direct', '@R1'],      0x87, 2, 2],
    ['MOV',   ['direct', 'Rn'],       0x88, 2, 2, 8, 1, 1],
    /* ---------- 第 9 行 ---------- */
    ['MOV',   ['DPTR', '#immed16'],   0x90, 3, 2],
    ['MOV',   ['bit', 'C'],           0x92, 2, 2],
    ['MOVC',  ['A', '@A+DPTR'],       0x93, 1, 2],
    ['SUBB',  ['A', '#immed'],        0x94, 2, 1],
    ['SUBB',  ['A', 'direct'],        0x95, 2, 1],
    ['SUBB',  ['A', '@R0'],           0x96, 1, 1],
    ['SUBB',  ['A', '@R1'],           0x97, 1, 1],
    ['SUBB',  ['A', 'Rn'],            0x98, 1, 1, 8, 1, 1],
    /* ---------- 第 A 行（0xA5 为保留操作码） ---------- */
    ['ORL',   ['C', '/bit'],          0xA0, 2, 2],
    ['MOV',   ['C', 'bit'],           0xA2, 2, 1],
    ['INC',   ['DPTR'],               0xA3, 1, 2],
    ['MUL',   ['AB'],                 0xA4, 1, 4],
    ['MOV',   ['@R0', 'direct'],      0xA6, 2, 2],
    ['MOV',   ['@R1', 'direct'],      0xA7, 2, 2],
    ['MOV',   ['Rn', 'direct'],       0xA8, 2, 2, 8, 1, 0],
    /* ---------- 第 B 行 ---------- */
    ['ANL',   ['C', '/bit'],          0xB0, 2, 2],
    ['CPL',   ['bit'],                0xB2, 2, 1],
    ['CPL',   ['C'],                  0xB3, 1, 1],
    ['CJNE',  ['A', '#immed', 'rel'], 0xB4, 3, 2],
    ['CJNE',  ['A', 'direct', 'rel'], 0xB5, 3, 2],
    ['CJNE',  ['@R0', '#immed', 'rel'],0xB6, 3, 2],
    ['CJNE',  ['@R1', '#immed', 'rel'],0xB7, 3, 2],
    ['CJNE',  ['Rn', '#immed', 'rel'],0xB8, 3, 2, 8, 1, 0],
    /* ---------- 第 C 行 ---------- */
    ['PUSH',  ['direct'],             0xC0, 2, 2],
    ['CLR',   ['bit'],                0xC2, 2, 1],
    ['CLR',   ['C'],                  0xC3, 1, 1],
    ['SWAP',  ['A'],                  0xC4, 1, 1],
    ['XCH',   ['A', 'direct'],        0xC5, 2, 1],
    ['XCH',   ['A', '@R0'],           0xC6, 1, 1],
    ['XCH',   ['A', '@R1'],           0xC7, 1, 1],
    ['XCH',   ['A', 'Rn'],            0xC8, 1, 1, 8, 1, 1],
    /* ---------- 第 D 行 ---------- */
    ['POP',   ['direct'],             0xD0, 2, 2],
    ['SETB',  ['bit'],                0xD2, 2, 1],
    ['SETB',  ['C'],                  0xD3, 1, 1],
    ['DA',    ['A'],                  0xD4, 1, 1],
    ['DJNZ',  ['direct', 'rel'],      0xD5, 3, 2],
    ['XCHD',  ['A', '@R0'],           0xD6, 1, 1],
    ['XCHD',  ['A', '@R1'],           0xD7, 1, 1],
    ['DJNZ',  ['Rn', 'rel'],          0xD8, 2, 2, 8, 1, 0],
    /* ---------- 第 E 行 ---------- */
    ['MOVX',  ['A', '@DPTR'],         0xE0, 1, 2],
    ['MOVX',  ['A', '@R0'],           0xE2, 1, 2],
    ['MOVX',  ['A', '@R1'],           0xE3, 1, 2],
    ['CLR',   ['A'],                  0xE4, 1, 1],
    ['MOV',   ['A', 'direct'],        0xE5, 2, 1],
    ['MOV',   ['A', '@R0'],           0xE6, 1, 1],
    ['MOV',   ['A', '@R1'],           0xE7, 1, 1],
    ['MOV',   ['A', 'Rn'],            0xE8, 1, 1, 8, 1, 1],
    /* ---------- 第 F 行 ---------- */
    ['MOVX',  ['@DPTR', 'A'],         0xF0, 1, 2],
    ['MOVX',  ['@R0', 'A'],           0xF2, 1, 2],
    ['MOVX',  ['@R1', 'A'],           0xF3, 1, 2],
    ['CPL',   ['A'],                  0xF4, 1, 1],
    ['MOV',   ['direct', 'A'],        0xF5, 2, 1],
    ['MOV',   ['@R0', 'A'],           0xF6, 1, 1],
    ['MOV',   ['@R1', 'A'],           0xF7, 1, 1],
    ['MOV',   ['Rn', 'A'],            0xF8, 1, 1, 8, 1, 0]
  ];

  /* --------------------------- 展开成 256 个操作码 --------------------------- */
  var byOp = new Array(256);
  for (var i = 0; i < 256; i++) byOp[i] = null;

  var byMnemonic = Object.create(null);
  var reserved = [];

  T.forEach(function (t) {
    var mnemonic = t[0];
    var kinds = t[1] || [];
    var base = t[2], len = t[3], cycles = t[4];
    var rep = t[5] || 1, stride = t[6] || 1;
    var repIdx = (t[7] === undefined) ? -1 : t[7];

    for (var k = 0; k < rep; k++) {
      var op = base + k * stride;
      var entry = {
        op: op,
        mnemonic: mnemonic,
        kinds: kinds.slice(),
        len: len,
        cycles: cycles,
        repIndex: repIdx,     // 随寄存器编号变化的操作数下标（-1 表示无）
        rn: (repIdx >= 0) ? k : -1,
        page: (kinds.indexOf('addr11') >= 0) ? k : -1, // AJMP/ACALL 的页号 a10a9a8
        sig: mnemonic + ' ' + kinds.join(','),
        rev: false            // MOV direct,direct 的机器码操作数顺序与书写顺序相反
      };
      byOp[op] = entry;
      if (!byMnemonic[mnemonic]) byMnemonic[mnemonic] = [];
      byMnemonic[mnemonic].push(entry);
    }
  });

  // MOV direct,direct (0x85)：机器码中先源后目的，与书写顺序相反
  if (byOp[0x85]) byOp[0x85].rev = true;

  for (var o = 0; o < 256; o++) if (!byOp[o]) reserved.push(o);

  /* ------------------------------- 助记符集合 ------------------------------- */
  var MNEMONICS = Object.keys(byMnemonic).sort();

  /* ---------------------------- 操作数种类描述表 ---------------------------- */
  var KIND_INFO = {
    'A':        { zh: '累加器 A',        bytes: 0 },
    'AB':       { zh: 'A、B 寄存器对',   bytes: 0 },
    'C':        { zh: '进位标志 CY',     bytes: 0 },
    'DPTR':     { zh: '数据指针 DPTR',   bytes: 0 },
    'Rn':       { zh: '工作寄存器 Rn',   bytes: 0 },
    '@R0':      { zh: '间接寻址 @R0',    bytes: 0 },
    '@R1':      { zh: '间接寻址 @R1',    bytes: 0 },
    '@DPTR':    { zh: '间接寻址 @DPTR',  bytes: 0 },
    '@A+DPTR':  { zh: '查表 @A+DPTR',    bytes: 0 },
    '@A+PC':    { zh: '查表 @A+PC',      bytes: 0 },
    'direct':   { zh: '直接地址',        bytes: 1 },
    '#immed':   { zh: '8 位立即数',      bytes: 1 },
    '#immed16': { zh: '16 位立即数',     bytes: 2 },
    'bit':      { zh: '位地址',          bytes: 1 },
    '/bit':     { zh: '位地址取反',      bytes: 1 },
    'rel':      { zh: '相对偏移 rel',    bytes: 1 },
    'addr11':   { zh: '11 位目标地址',   bytes: 1 },
    'addr16':   { zh: '16 位目标地址',   bytes: 2 }
  };

  /* ------------------------------- 工具函数 -------------------------------- */

  function hex(v, width) {
    var s = (v >>> 0).toString(16).toUpperCase();
    while (s.length < (width || 2)) s = '0' + s;
    return s + 'H';
  }

  /** 把一个有符号 rel 偏移格式化为 "地址" 形式（供反汇编显示） */
  function sign8(v) { return (v & 0x80) ? v - 0x100 : v; }

  /**
   * 反汇编一条指令。
   * @param {Uint8Array} rom  代码空间
   * @param {number} addr     指令地址
   * @param {object} [fmt]    格式化选项 { directName(a)->string, bitName(a)->string }
   * @returns {null|{op,mnemonic,text,bytes,entry,cycles}}
   */
  function disasm(rom, addr, fmt) {
    var op = rom[addr & 0xFFFF];
    var entry = byOp[op];
    if (!entry) {
      return { op: op, mnemonic: '.DB', text: '.DB ' + hex(op), bytes: [op], cycles: 0, entry: null };
    }
    var bytes = [], i;
    for (i = 0; i < entry.len; i++) bytes.push(rom[(addr + i) & 0xFFFF]);

    var parts = [];
    var bi = 1;
    for (i = 0; i < entry.kinds.length; i++) {
      var kind = entry.kinds[i];
      var val;
      switch (kind) {
        case 'Rn':      parts.push('R' + entry.rn); break;
        case 'addr11':
          val = ((entry.page << 8) | bytes[bi++]) & 0xFFFF;
          parts.push(fmt && fmt.addr ? fmt.addr(val) : hex(val, 4));
          break;
        case 'addr16':
          val = ((bytes[bi] << 8) | bytes[bi + 1]) & 0xFFFF; bi += 2;
          parts.push(fmt && fmt.addr ? fmt.addr(val) : hex(val, 4));
          break;
        case 'rel':
          val = bytes[bi++];
          var target = (addr + entry.len + sign8(val)) & 0xFFFF;
          parts.push(fmt && fmt.addr ? fmt.addr(target) : hex(target, 4));
          break;
        case 'direct':
          if (entry.rev && i === 0) { val = bytes[2]; }        // MOV direct,direct：先源后目的
          else if (entry.rev && i === 1) { val = bytes[1]; }
          else { val = bytes[bi++]; }
          parts.push(fmt && fmt.directName ? fmt.directName(val) : hex(val));
          break;
        case '#immed16':
          val = ((bytes[bi] << 8) | bytes[bi + 1]) & 0xFFFF; bi += 2;
          parts.push('#' + (fmt && fmt.num ? fmt.num(val, 4) : hex(val, 4)));
          break;
        case '#immed':
          val = bytes[bi++];
          parts.push('#' + (fmt && fmt.num ? fmt.num(val) : hex(val)));
          break;
        case 'bit':
        case '/bit':
          val = bytes[bi++];
          parts.push((kind === '/bit' ? '/' : '') + (fmt && fmt.bitName ? fmt.bitName(val) : hex(val)));
          break;
        default:
          parts.push(kind);
      }
    }
    var text = entry.mnemonic + (parts.length ? ' ' + parts.join(',') : '');
    return { op: op, mnemonic: entry.mnemonic, text: text, bytes: bytes, cycles: entry.cycles, entry: entry };
  }

  root.STC = root.STC || {};
  root.STC.opcodes = {
    byOp: byOp,
    byMnemonic: byMnemonic,
    MNEMONICS: MNEMONICS,
    KIND_INFO: KIND_INFO,
    reserved: reserved,
    hex: hex,
    sign8: sign8,
    disasm: disasm,
    /** 统计信息，供自检使用 */
    stats: function () {
      var lens = { 1: 0, 2: 0, 3: 0 }, total = 0;
      for (var i = 0; i < 256; i++) if (byOp[i]) { lens[byOp[i].len]++; total++; }
      return { total: total, reserved: reserved.slice(), byLen: lens, mnemonics: MNEMONICS.length };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
