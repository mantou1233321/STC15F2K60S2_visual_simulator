/* =============================================================================
 * cpu.js —— STC15F2K60S2（标准 8051 内核）指令级模拟器
 *   · 严格区分：直接地址 0x80~0xFF = SFR；间接地址 0x80~0xFF = 高 128B RAM
 *   · 每条指令执行后给出本步所有写入（供 UI 做数据变动可视化）
 *   · 标志位 CY/AC/OV/P 按 8051 硬件规则更新
 * ========================================================================== */
(function (root) {
  'use strict';

  var STC = root.STC = root.STC || {};
  var OP = STC.opcodes;
  var CHIP = STC.chip;

  var SFR_ACC = 0xE0, SFR_B = 0xF0, SFR_PSW = 0xD0, SFR_SP = 0x81, SFR_DPL = 0x82, SFR_DPH = 0x83;
  var BIT_CY = 0xD7;

  function parityOdd(v) {
    var n = 0;
    v &= 0xFF;
    while (v) { n ^= (v & 1); v >>= 1; }
    return n;
  }

  function CPU(opts) {
    opts = opts || {};
    this.xramSize = opts.xramSize || CHIP.data.xramBytes;
    /* 片上 Flash 擦除后为 FFH */
    this.rom = new Uint8Array(0x10000).fill(0xFF);
    this.reset();
  }

  CPU.prototype.reset = function () {
    this.iram = new Uint8Array(256);
    this.xram = new Uint8Array(this.xramSize);
    this.sfr = CHIP.resetSfr();
    this.pc = 0;
    this.cycles = 0;
    this.steps = 0;
    this.writes = [];
    this.notes = [];
  };

  CPU.prototype.loadRom = function (rom, entry) {
    this.rom = rom;
    this.pc = entry >>> 0;
  };

  /* --------------------------------------------------------- 寄存器访问 */

  CPU.prototype.getA = function () { return this.sfr[SFR_ACC]; };
  CPU.prototype.setA = function (v) {
    v &= 0xFF;
    this._writeSfr(SFR_ACC, v);
    var psw = this.sfr[SFR_PSW];
    this.sfr[SFR_PSW] = (psw & 0xFE) | parityOdd(v);
  };
  CPU.prototype.getB = function () { return this.sfr[SFR_B]; };
  CPU.prototype.setB = function (v) { this._writeSfr(SFR_B, v & 0xFF); };
  CPU.prototype.getPSW = function () { return this.sfr[SFR_PSW]; };
  CPU.prototype.setPSW = function (v) { this._writeSfr(SFR_PSW, v & 0xFF); };
  CPU.prototype.getSP = function () { return this.sfr[SFR_SP]; };
  CPU.prototype.setSP = function (v) { this._writeSfr(SFR_SP, v & 0xFF); };
  CPU.prototype.getDPTR = function () { return ((this.sfr[SFR_DPH] << 8) | this.sfr[SFR_DPL]) & 0xFFFF; };
  CPU.prototype.setDPTR = function (v) {
    this._writeSfr(SFR_DPH, (v >> 8) & 0xFF);
    this._writeSfr(SFR_DPL, v & 0xFF);
  };
  CPU.prototype.bank = function () { return (this.sfr[SFR_PSW] >> 3) & 3; };
  CPU.prototype.getRn = function (n) { return this.iram[this.bank() * 8 + (n & 7)]; };
  CPU.prototype.setRn = function (n, v) { this._writeIram(this.bank() * 8 + (n & 7), v & 0xFF); };
  for (var rn = 0; rn < 8; rn++) {
    (function (n) {
      CPU.prototype['getR' + n] = function () { return this.getRn(n); };
      CPU.prototype['setR' + n] = function (v) { this.setRn(n, v); };
    })(rn);
  }

  CPU.prototype.flag = function (name) {
    var bit = { CY: 7, AC: 6, F0: 5, RS1: 4, RS0: 3, OV: 2, P: 0 }[name];
    if (bit === undefined) return 0;
    return (this.sfr[SFR_PSW] >> bit) & 1;
  };
  CPU.prototype.setFlag = function (name, v) {
    var bit = { CY: 7, AC: 6, F0: 5, RS1: 4, RS0: 3, OV: 2, P: 0 }[name];
    if (bit === undefined) return;
    var psw = this.sfr[SFR_PSW];
    this.sfr[SFR_PSW] = v ? (psw | (1 << bit)) : (psw & ~(1 << bit));
  };

  /* ------------------------------------------------------------ 存储访问 */

  CPU.prototype._writeIram = function (addr, v) {
    addr &= 0xFF; v &= 0xFF;
    var old = this.iram[addr];
    this.iram[addr] = v;
    this.writes.push({ space: 'iram', addr: addr, from: old, to: v, same: old === v });
  };
  CPU.prototype._writeXram = function (addr, v) {
    addr &= 0xFFFF; v &= 0xFF;
    var a = addr % this.xramSize;
    var old = this.xram[a];
    this.xram[a] = v;
    this.writes.push({ space: 'xram', addr: a, from: old, to: v, same: old === v });
  };
  CPU.prototype._writeSfr = function (addr, v) {
    addr &= 0xFF; v &= 0xFF;
    var old = this.sfr[addr];
    this.sfr[addr] = v;
    this.writes.push({ space: 'sfr', addr: addr, from: old, to: v, same: old === v });
    if (addr === SFR_ACC) {
      var psw = this.sfr[SFR_PSW];
      this.sfr[SFR_PSW] = (psw & 0xFE) | parityOdd(v);
    }
  };

  CPU.prototype.readDirect = function (addr) {
    addr &= 0xFF;
    return addr < 0x80 ? this.iram[addr] : this.sfr[addr];
  };
  CPU.prototype.writeDirect = function (addr, v) {
    addr &= 0xFF;
    if (addr < 0x80) this._writeIram(addr, v); else this._writeSfr(addr, v);
  };
  CPU.prototype.readIndirect = function (addr) { return this.iram[addr & 0xFF]; };
  CPU.prototype.writeIndirect = function (addr, v) { this._writeIram(addr & 0xFF, v); };
  CPU.prototype.readXram = function (addr) { return this.xram[(addr & 0xFFFF) % this.xramSize]; };
  CPU.prototype.writeXram = function (addr, v) { this._writeXram(addr, v); };
  CPU.prototype.readRom = function (addr) { return this.rom[addr & 0xFFFF]; };

  CPU.prototype.readBit = function (bitAddr) {
    bitAddr &= 0xFF;
    if (bitAddr < 0x80) {
      var b = this.iram[0x20 + (bitAddr >> 3)];
      return (b >> (bitAddr & 7)) & 1;
    }
    return (this.sfr[bitAddr & 0xF8] >> (bitAddr & 7)) & 1;
  };
  CPU.prototype.writeBit = function (bitAddr, v) {
    bitAddr &= 0xFF;
    v = v ? 1 : 0;
    if (bitAddr < 0x80) {
      var a = 0x20 + (bitAddr >> 3);
      var b = this.iram[a];
      var nb = v ? (b | (1 << (bitAddr & 7))) : (b & ~(1 << (bitAddr & 7)));
      this._writeIram(a, nb);
    } else {
      var sa = bitAddr & 0xF8;
      var sb = this.sfr[sa];
      var snb = v ? (sb | (1 << (bitAddr & 7))) : (sb & ~(1 << (bitAddr & 7)));
      this._writeSfr(sa, snb);
    }
  };

  /* ------------------------------------------------------------ 单步执行 */

  var rel8 = OP.sign8;

  /**
   * 执行一条指令。
   * @returns {null|object} 本步信息 {pc, opcode, bytes, mnemonic, text, cycles, writes, jumped, target}
   */
  CPU.prototype.step = function () {
    this.writes = [];
    this.notes = [];
    var startPc = this.pc & 0xFFFF;
    var opcode = this.rom[startPc];
    var entry = OP.byOp[opcode];
    if (!entry) {
      this.notes.push('操作码 ' + OP.hex(opcode) + ' 为保留/未定义操作码，模拟器按单字节 NOP 处理');
      this.pc = (startPc + 1) & 0xFFFF;
      return {
        pc: startPc, opcode: opcode, bytes: [opcode], mnemonic: '.DB',
        text: '.DB ' + OP.hex(opcode), cycles: 1, writes: [], jumped: false, target: null,
        notes: this.notes.slice()
      };
    }

    var bytes = [];
    for (var bi = 0; bi < entry.len; bi++) bytes.push(this.rom[(startPc + bi) & 0xFFFF]);

    var self = this;
    /* 取操作数的“值”：直接地址、立即数、位地址、跳转目标 */
    function opVal(i) {
      var kind = entry.kinds[i], b = 1;
      for (var k = 0; k < i; k++) b += OP.KIND_INFO[entry.kinds[k]].bytes;
      switch (kind) {
        case 'direct':
          if (entry.rev) return i === 0 ? bytes[2] : bytes[1];
          return bytes[b];
        case 'bit': case '/bit': case '#immed': case 'rel': case 'addr11':
          return bytes[b];
        case '#immed16': case 'addr16':
          return (bytes[b] << 8) | bytes[b + 1];
        default:
          return null;
      }
    }
    /* 取操作数的“内存内容” */
    function rd(i) {
      var kind = entry.kinds[i];
      switch (kind) {
        case 'A': return self.getA();
        case 'B': return self.getB();
        case 'C': return self.flag('CY');
        case 'AB': return self.getA();
        case 'DPTR': return self.getDPTR();
        case 'Rn': return self.getRn(entry.rn);
        case '@R0': return self.readIndirect(self.getRn(0));
        case '@R1': return self.readIndirect(self.getRn(1));
        case 'direct': return self.readDirect(opVal(i));
        case '#immed': case '#immed16': return opVal(i);
        case 'bit': return self.readBit(opVal(i));
        case '/bit': return self.readBit(opVal(i)) ^ 1;
        default: return 0;
      }
    }
    function wr(i, v) {
      var kind = entry.kinds[i];
      switch (kind) {
        case 'A': self.setA(v & 0xFF); break;
        case 'B': self.setB(v & 0xFF); break;
        case 'C': self.writeBit(BIT_CY, v & 1); break;
        case 'Rn': self.setRn(entry.rn, v & 0xFF); break;
        case '@R0': self.writeIndirect(self.getRn(0), v & 0xFF); break;
        case '@R1': self.writeIndirect(self.getRn(1), v & 0xFF); break;
        case 'direct': self.writeDirect(opVal(i), v & 0xFF); break;
        case 'bit': self.writeBit(opVal(i), v & 1); break;
        case 'DPTR': self.setDPTR(v & 0xFFFF); break;
      }
    }
    function jumpTo(target) {
      self.pc = target & 0xFFFF;
      jumped = true;
      branch = target & 0xFFFF;
    }

    var jumped = false, branch = null;
    /* 默认 PC 前进 */
    this.pc = (startPc + entry.len) & 0xFFFF;

    var m = entry.mnemonic, kinds = entry.kinds;
    var a, b2, r, c;

    switch (m) {
      case 'NOP': break;

      case 'MOV': {
        var dst = kinds[0], srcK = kinds[1];
        var v = rd(1);
        wr(0, v);
        break;
      }
      case 'MOVX': {
        if (kinds[0] === 'A') {
          var addr = (kinds[1] === '@DPTR') ? this.getDPTR() : this.getRn(kinds[1] === '@R0' ? 0 : 1);
          this.setA(this.readXram(addr));
        } else {
          var addr2 = (kinds[0] === '@DPTR') ? this.getDPTR() : this.getRn(kinds[0] === '@R0' ? 0 : 1);
          this.writeXram(addr2, this.getA());
        }
        break;
      }
      case 'MOVC': {
        /* 查表：把「基址 + A → 实际读到的代码地址」写进本步说明，避免 @A+PC 的基址算错 */
        var useDptr = (kinds[1] === '@A+DPTR');
        var base = useDptr ? this.getDPTR() : this.pc;
        var idx = this.getA();
        var codeAddr = (base + idx) & 0xFFFF;
        this.setA(this.readRom(codeAddr));
        this.notes.push('查表：' + (useDptr ? 'DPTR' : 'PC(本条之后)') + '=' + OP.hex(base, 4) +
          ' + A=' + OP.hex(idx) + ' → 读代码空间 ' + OP.hex(codeAddr, 4) + ' = ' + OP.hex(this.getA()));
        break;
      }
      case 'ADD': case 'ADDC': case 'SUBB': {
        a = this.getA();
        b2 = rd(1) & 0xFF;
        c = (m === 'ADD') ? 0 : this.flag('CY');
        if (m === 'SUBB') {
          r = a - b2 - c;
          this.setFlag('CY', r < 0 ? 1 : 0);
          this.setFlag('AC', ((a & 0x0F) - (b2 & 0x0F) - c) < 0 ? 1 : 0);
          this.setFlag('OV', (((a ^ b2) & (a ^ (r & 0xFF))) & 0x80) ? 1 : 0);
          this.setA(r & 0xFF);
        } else {
          r = a + b2 + c;
          this.setFlag('CY', r > 0xFF ? 1 : 0);
          this.setFlag('AC', ((a & 0x0F) + (b2 & 0x0F) + c) > 0x0F ? 1 : 0);
          this.setFlag('OV', (((a ^ (r & 0xFF)) & (b2 ^ (r & 0xFF))) & 0x80) ? 1 : 0);
          this.setA(r & 0xFF);
        }
        break;
      }
      case 'ANL': case 'ORL': case 'XRL': {
        var f = m === 'ANL' ? function (x, y) { return x & y; }
              : m === 'ORL' ? function (x, y) { return x | y; }
              : function (x, y) { return x ^ y; };
        if (kinds[0] === 'C') {
          /* ANL/ORL C,bit 与 C,/bit */
          this.setFlag('CY', f(this.flag('CY'), rd(1)) & 1);
        } else if (kinds[0] === 'direct') {
          this.writeDirect(opVal(0), f(this.readDirect(opVal(0)), rd(1)));
        } else {
          this.setA(f(this.getA(), rd(1)));
        }
        break;
      }
      case 'INC': case 'DEC': {
        var delta = (m === 'INC') ? 1 : -1;
        if (kinds[0] === 'DPTR') {
          this.setDPTR((this.getDPTR() + 1) & 0xFFFF);
        } else {
          wr(0, (rd(0) + delta) & 0xFF);
        }
        break;
      }
      case 'MUL': {
        var prod = this.getA() * this.getB();
        this.setA(prod & 0xFF);
        this.setB((prod >> 8) & 0xFF);
        this.setFlag('CY', 0);
        this.setFlag('OV', (prod > 0xFF) ? 1 : 0);
        break;
      }
      case 'DIV': {
        var num = this.getA(), den = this.getB();
        if (den === 0) {
          this.setA(0); this.setB(0);
          this.setFlag('OV', 1);
          this.notes.push('除数为 0：硬件行为未定义，本模拟器置 A=0、B=0、OV=1');
        } else {
          this.setA(Math.floor(num / den));
          this.setB(num % den);
          this.setFlag('OV', 0);
        }
        this.setFlag('CY', 0);
        break;
      }
      case 'DA': {
        /* 标准 8051 十进制调整：先修低 4 位，再修高 4 位 */
        a = this.getA();
        var cy = this.flag('CY');
        if ((a & 0x0F) > 9 || this.flag('AC')) {
          var t1 = a + 0x06;
          if (t1 > 0xFF) cy = 1;
          a = t1 & 0xFF;
        }
        if (((a >> 4) & 0x0F) > 9 || cy) {
          var t2 = a + 0x60;
          if (t2 > 0xFF) cy = 1;
          a = t2 & 0xFF;
        }
        this.setA(a & 0xFF);
        this.setFlag('CY', cy ? 1 : 0);
        break;
      }
      case 'CLR': {
        if (kinds[0] === 'A') this.setA(0);
        else if (kinds[0] === 'C') this.setFlag('CY', 0);
        else this.writeBit(opVal(0), 0);
        break;
      }
      case 'CPL': {
        if (kinds[0] === 'A') this.setA(~this.getA() & 0xFF);
        else if (kinds[0] === 'C') this.setFlag('CY', this.flag('CY') ^ 1);
        else this.writeBit(opVal(0), this.readBit(opVal(0)) ^ 1);
        break;
      }
      case 'SETB': {
        if (kinds[0] === 'C') this.setFlag('CY', 1);
        else this.writeBit(opVal(0), 1);
        break;
      }
      case 'RL': a = this.getA(); this.setA(((a << 1) | (a >> 7)) & 0xFF); break;
      case 'RR': a = this.getA(); this.setA(((a >> 1) | (a << 7)) & 0xFF); break;
      case 'RLC': a = this.getA(); c = this.flag('CY'); this.setFlag('CY', (a >> 7) & 1); this.setA(((a << 1) | c) & 0xFF); break;
      case 'RRC': a = this.getA(); c = this.flag('CY'); this.setFlag('CY', a & 1); this.setA(((a >> 1) | (c << 7)) & 0xFF); break;
      case 'SWAP': a = this.getA(); this.setA(((a >> 4) | (a << 4)) & 0xFF); break;

      case 'XCH': {
        var oldA = this.getA();
        this.setA(rd(1));
        wr(1, oldA);
        break;
      }
      case 'XCHD': {
        var oldA2 = this.getA();
        var mem = rd(1);
        this.setA((oldA2 & 0xF0) | (mem & 0x0F));
        wr(1, (mem & 0xF0) | (oldA2 & 0x0F));
        break;
      }
      case 'PUSH': {
        this.setSP((this.getSP() + 1) & 0xFF);
        this.writeIndirect(this.getSP(), this.readDirect(opVal(0)));
        break;
      }
      case 'POP': {
        this.writeDirect(opVal(0), this.readIndirect(this.getSP()));
        this.setSP((this.getSP() - 1) & 0xFF);
        break;
      }

      case 'SJMP': jumpTo((this.pc + rel8(opVal(0))) & 0xFFFF); break;
      case 'AJMP': jumpTo(((this.pc & 0xF800) | ((entry.page << 8) | opVal(0))) & 0xFFFF); break;
      case 'LJMP': jumpTo(opVal(0)); break;
      case 'ACALL': case 'LCALL': {
        var target = (m === 'ACALL') ? ((this.pc & 0xF800) | ((entry.page << 8) | opVal(0))) : opVal(0);
        var ret = this.pc;
        this.setSP((this.getSP() + 1) & 0xFF);
        this.writeIndirect(this.getSP(), ret & 0xFF);
        this.setSP((this.getSP() + 1) & 0xFF);
        this.writeIndirect(this.getSP(), (ret >> 8) & 0xFF);
        jumpTo(target);
        break;
      }
      case 'RET': case 'RETI': {
        var hi = this.readIndirect(this.getSP());
        this.setSP((this.getSP() - 1) & 0xFF);
        var lo = this.readIndirect(this.getSP());
        this.setSP((this.getSP() - 1) & 0xFF);
        jumpTo(((hi << 8) | lo) & 0xFFFF);
        if (m === 'RETI') this.notes.push('RETI：本模拟器不模拟中断控制器，按 RET 处理');
        break;
      }
      case 'JMP': jumpTo((this.getA() + this.getDPTR()) & 0xFFFF); break;

      case 'JC': if (this.flag('CY')) jumpTo((this.pc + rel8(opVal(0))) & 0xFFFF); break;
      case 'JNC': if (!this.flag('CY')) jumpTo((this.pc + rel8(opVal(0))) & 0xFFFF); break;
      case 'JZ': if (this.getA() === 0) jumpTo((this.pc + rel8(opVal(0))) & 0xFFFF); break;
      case 'JNZ': if (this.getA() !== 0) jumpTo((this.pc + rel8(opVal(0))) & 0xFFFF); break;
      case 'JB': if (this.readBit(opVal(0))) jumpTo((this.pc + rel8(opVal(1))) & 0xFFFF); break;
      case 'JNB': if (!this.readBit(opVal(0))) jumpTo((this.pc + rel8(opVal(1))) & 0xFFFF); break;
      case 'JBC': {
        if (this.readBit(opVal(0))) {
          this.writeBit(opVal(0), 0);
          jumpTo((this.pc + rel8(opVal(1))) & 0xFFFF);
        }
        break;
      }
      case 'DJNZ': {
        var nv = (rd(0) - 1) & 0xFF;
        wr(0, nv);
        if (nv !== 0) jumpTo((this.pc + rel8(opVal(1))) & 0xFFFF);
        break;
      }
      case 'CJNE': {
        var x = rd(0), y = rd(1);
        if (x !== y) {
          this.setFlag('CY', x < y ? 1 : 0);
          jumpTo((this.pc + rel8(opVal(2))) & 0xFFFF);
        }
        break;
      }
      default:
        this.notes.push('未实现指令 ' + m + '（按 NOP 处理）');
        break;
    }

    var ret2 = {
      pc: startPc,
      opcode: opcode,
      bytes: bytes,
      mnemonic: entry.mnemonic,
      text: OP.disasm(this.rom, startPc, {
        directName: function (x) { return CHIP.directName(x); },
        bitName: function (x) { return CHIP.bitNameShort(x); }
      }).text,
      cycles: entry.cycles,
      writes: this.writes.slice(),
      jumped: jumped,
      target: branch,
      notes: this.notes.slice()
    };
    this.cycles += entry.cycles;
    this.steps++;
    return ret2;
  };

  /** 连续执行到某个地址或太多步为止 */
  CPU.prototype.runTo = function (targetPc, maxSteps) {
    maxSteps = maxSteps || 2000000;
    var n = 0;
    while (n < maxSteps) {
      this.step();
      n++;
      if (targetPc !== null && targetPc !== undefined && (this.pc & 0xFFFF) === (targetPc & 0xFFFF)) break;
    }
    return n;
  };

  STC.CPU = CPU;
})(typeof window !== 'undefined' ? window : globalThis);
