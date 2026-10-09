/* =============================================================================
 * chips.js —— 由 sfr-data.js 建立索引，并提供地址/位地址的可读描述
 * （用于悬停提示、反汇编符号化显示、复位初值）
 * ========================================================================== */
(function (root) {
  'use strict';

  var STC = root.STC = root.STC || {};
  var D = STC.chipData;
  if (!D) throw new Error('chips.js 需要先加载 sfr-data.js');

  var sfrByName = Object.create(null);   // 'PSW' -> {name,addr,bits}
  var sfrByAddr = new Array(256);        // 0x80..0xFF -> {name,addr,bits} | undefined
  var bitByName = Object.create(null);   // 'CY' -> bitAddr
  var bitByAddr = Object.create(null);   // bitAddr -> {name, sfr?, bit?, kind}
  var aliasOf = Object.create(null);     // 别名指向同一地址：'P_SW1' -> 'AUXR1'

  D.sfr.forEach(function (s) {
    if (!sfrByName[s.name]) sfrByName[s.name.toUpperCase()] = s;
    else aliasOf[s.name.toUpperCase()] = sfrByName[s.name.toUpperCase()].name;
    if (!sfrByAddr[s.addr] || sfrByAddr[s.addr].name === s.name) sfrByAddr[s.addr] = s;
    // 位可寻址 SFR：自动登记 8 个位
    if ((s.addr & 0x07) === 0 && s.bits) {
      for (var b = 0; b < 8; b++) {
        var bn = s.bits[b];
        if (!bn || bn === '—') continue;
        var ba = s.addr + b;
        var full = bn.indexOf('.') >= 0 ? bn : s.name + '.' + b;
        if (bitByAddr[ba] === undefined) {
          bitByAddr[ba] = { name: bn, full: full, sfr: s.name, bit: b, addr: ba };
        }
        if (!bitByName[bn.toUpperCase()]) bitByName[bn.toUpperCase()] = ba;
        if (!bitByName[s.name.toUpperCase() + '.' + b]) bitByName[s.name.toUpperCase() + '.' + b] = ba;
      }
    }
  });

  D.extraBits.forEach(function (e) {
    if (bitByAddr[e.addr] === undefined) {
      var sf = sfrByAddr[e.addr & 0xF8];
      bitByAddr[e.addr] = { name: e.name, full: e.name, sfr: sf ? sf.name : null, bit: e.addr & 7, addr: e.addr };
    }
    if (!bitByName[e.name.toUpperCase()]) bitByName[e.name.toUpperCase()] = e.addr;
  });

  // 位寻址区(20H~2FH)的 128 个位：位地址 0x00~0x7F
  var bitRamStartByte = D.bitRamStartByte;
  for (var i = 0; i < D.bitRamBytes * 8; i++) {
    var byteAddr = bitRamStartByte + (i >> 3);
    bitByAddr[i] = {
      name: byteAddr.toString(16).toUpperCase().replace(/^(\w)$/, '0$1') + 'H.' + (i & 7),
      full: null, ram: byteAddr, bit: i & 7, addr: i, kind: 'bitram'
    };
  }

  function hex(v, w) {
    var s = (v >>> 0).toString(16).toUpperCase();
    while (s.length < (w || 2)) s = '0' + s;
    return s;
  }
  function hexH(v, w) { return hex(v, w) + 'H'; }

  /** 直接地址的可读名：0x80 以上若是已定义 SFR 则给名字 */
  function directName(addr) {
    addr &= 0xFF;
    if (addr >= 0x80 && sfrByAddr[addr]) return sfrByAddr[addr].name;
    if (addr >= 0x80) return hexH(addr) + '(未定义SFR)';
    return hexH(addr);
  }

  /** 位地址的可读名 */
  function bitName(addr) {
    addr &= 0xFF;
    var b = bitByAddr[addr];
    if (!b) return hexH(addr);
    if (b.kind === 'bitram') return hexH(b.ram) + '.' + b.bit + '(' + hexH(addr) + ')';
    return b.name + '(' + hexH(addr) + ')';
  }

  /** 反汇编时的简短位名（不带括号） */
  function bitNameShort(addr) {
    addr &= 0xFF;
    var b = bitByAddr[addr];
    if (!b) return hexH(addr);
    if (b.kind === 'bitram') return hexH(b.ram) + '.' + b.bit;
    return b.name;
  }

  /** 内部 RAM 直接/间接地址的区域说明（悬停提示用） */
  function describeIram(addr) {
    addr &= 0xFF;
    var info = { zone: '', detail: '', bank: -1, bit: null };
    if (addr < 0x20) {
      var bank = addr >> 3, idx = addr & 7;
      info.zone = '工作寄存器区';
      info.bank = bank;
      info.detail = '寄存器组 ' + bank + ' 的 R' + idx + '（当前使用组由 PSW 的 RS1/RS0 决定）';
    } else if (addr < 0x30) {
      info.zone = '位寻址区';
      info.detail = '可位寻址，位地址 ' + hexH((addr - 0x20) * 8) + '~' + hexH((addr - 0x20) * 8 + 7);
    } else if (addr < 0x80) {
      info.zone = '用户 RAM 区（低 128 字节）';
      info.detail = '可堆栈、可直接/间接寻址';
    } else {
      info.zone = '间接寻址区（高 128 字节）';
      info.detail = '只能用 @R0/@R1/SP 间接访问；直接寻址会落到同名 SFR 上';
      if (sfrByAddr[addr]) info.detail += '（直接地址 ' + hexH(addr) + ' = SFR ' + sfrByAddr[addr].name + '）';
    }
    return info;
  }

  /** 直接地址的区域说明（区分 SFR 与普通 RAM） */
  function describeDirect(addr) {
    addr &= 0xFF;
    if (addr >= 0x80) {
      var s = sfrByAddr[addr];
      if (s) {
        var bits = [];
        if ((s.addr & 7) === 0 && s.bits) {
          for (var b = 0; b < 8; b++) if (s.bits[b] && s.bits[b] !== '—') bits.push(s.bits[b] + '(位地址' + hexH(s.addr + b) + ')');
        }
        var out = { zone: 'SFR 特殊功能寄存器', detail: s.name };
        if (bits.length) out.detail += '　位定义：' + bits.join('、');
        else {
          var doc = D.documentedBits && D.documentedBits[s.name];
          if (doc && doc.bits) {
            var dl = Object.keys(doc.bits).map(function (k) { return k + '=bit' + doc.bits[k]; });
            out.detail += '　手册位定义（不可位寻址）：' + dl.join('、');
          } else out.detail += '　（不可位寻址）';
        }
        return out;
      }
      return { zone: 'SFR 空间（未定义）', detail: 'STC15F2K60S2 未在该地址定义寄存器' };
    }
    return describeIram(addr);
  }

  /** 位地址说明 */
  function describeBit(addr) {
    addr &= 0xFF;
    var b = bitByAddr[addr];
    if (!b) return { zone: '位地址空间', detail: '未定义的位地址' };
    if (b.kind === 'bitram') {
      return { zone: '位寻址区（20H~2FH）', detail: hexH(b.ram) + ' 的第 ' + b.bit + ' 位（' + hexH(b.ram) + '.' + b.bit + '）' };
    }
    var s = b.sfr ? sfrByAddr[(addr & 0xF8)] : null;
    return {
      zone: '位可寻址 SFR',
      detail: (s ? s.name + ' 的 bit' + b.bit + '　' : '') + '位名 ' + b.name + '（位地址 ' + hexH(addr) + '）'
    };
  }

  /** 复位时 SFR 初值数组（索引 = 地址） */
  function resetSfr() {
    var a = new Uint8Array(256);
    for (var i = 0; i < 256; i++) a[i] = 0x00;
    Object.keys(D.resetSfr).forEach(function (n) {
      var s = sfrByName[n.toUpperCase()];
      if (s) a[s.addr] = D.resetSfr[n] & 0xFF;
    });
    return a;
  }

  STC.chip = {
    data: D,
    sfrByName: sfrByName,
    sfrByAddr: sfrByAddr,
    bitByName: bitByName,
    bitByAddr: bitByAddr,
    aliasOf: aliasOf,
    hex: hex,
    hexH: hexH,
    directName: directName,
    bitName: bitName,
    bitNameShort: bitNameShort,
    describeIram: describeIram,
    describeDirect: describeDirect,
    describeBit: describeBit,
    resetSfr: resetSfr
  };
})(typeof window !== 'undefined' ? window : globalThis);
