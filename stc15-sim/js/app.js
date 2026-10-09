/* =============================================================================
 * app.js —— 界面逻辑：汇编、单步执行、代码地址可视化、内存格子可视化
 * ========================================================================== */
(function () {
  'use strict';

  var STC = window.STC, CHIP = STC.chip, OP = STC.opcodes;

  var DEFAULT_SOURCE = [
    '; ============ STC15F2K60S2 演示程序 ============',
    '; 功能：40H~45H 填入 0~5，求和后存入 50H；最低位经 CY 输出到 P1.0',
    '        ORG 0000H',
    '        LJMP START',
    '        ORG 0030H',
    'START:  MOV SP,#60H          ; 栈指针（堆栈从 61H 向上增长）',
    '        MOV R0,#40H          ; R0 作间接寻址指针',
    '        MOV R1,#6            ; 循环 6 次',
    '        CLR A',
    'LOAD:   MOV @R0,A            ; 把 A 存入 @R0 指向的单元',
    '        INC A',
    '        INC R0',
    '        DJNZ R1,LOAD',
    '        MOV R0,#40H',
    '        MOV R1,#6',
    '        LCALL SUM            ; 调用求和子程序',
    '        MOV 50H,A            ; 和存入 50H',
    '        MOV C,ACC.0          ; ACC.0 → CY',
    '        MOV P1.0,C           ; CY → P1.0',
    '        SETB 20H.7           ; 置位位寻址区 2FH.7（位地址 7FH）',
    '        SJMP $               ; 原地停机',
    '; ---- 求和子程序：@R0 起的 R1 个字节求和，结果在 A ----',
    'SUM:    CLR A',
    'SUM1:   ADD A,@R0',
    '        INC R0',
    '        DJNZ R1,SUM1',
    '        RET',
    '        END'
  ].join('\n');

  /* ============================ 状态 ============================ */
  var state = {
    cpu: new STC.CPU(),
    asm: null,
    gutterCount: -1,
    gutterLine: -1,
    running: false,
    rafId: null,
    cursorAddr: null,
    stopFlag: false,
    lastStep: null,
    pcHistory: [],
    initial: { iram: null, xram: null, sfr: null },
    lastWrite: { iram: Object.create(null), xram: Object.create(null), sfr: Object.create(null) },
    grids: {},
    activeSpace: 'iram',
    radix: 'hex',          /* 'hex' | 'dec'：格子数值显示进制 */
    flashPage: 0,          /* Flash 视图当前页（256 字节/页） */
    flashFollow: true,     /* 是否跟随 PC 自动翻页 */
    byteOwner: null,       /* 字节地址 → listing 下标（-1 表示不在任何行内） */
    pcRow: null
  };
  var FLASH_PAGE = 256;
  var FLASH_PAGES = 240;   /* 60KB 用户程序区 = 240 页 */
  var MAX_RUN_STEPS = 5000000;

  /* ============================ DOM ============================ */
  function $(id) { return document.getElementById(id); }
  var el = {
    source: $('source'), btnAsm: $('btnAsm'), btnClear: $('btnClear'), msgBox: $('msgBox'),
    gutter: $('gutter'), listingHead: $('listingHead'),
    asmStatus: $('asmStatus'), runStatus: $('runStatus'), codeInfo: $('codeInfo'),
    btnStep: $('btnStep'), btnRun: $('btnRun'), btnReset: $('btnReset'), btnToCursor: $('btnToCursor'),
    btnToEntry: $('btnToEntry'),
    speed: $('speed'), curAddr: $('curAddr'), curBytes: $('curBytes'), curText: $('curText'),
    curEffect: $('curEffect'), listing: $('listing'), codemap: $('codemap'), codemapTip: $('codemapTip'),
    rPC: $('rPC'), rSP: $('rSP'), rSPnote: $('rSPnote'), rDPTR: $('rDPTR'), rDPTRnote: $('rDPTRnote'),
    rDPHL: $('rDPHL'), rACC: $('rACC'), rACCBin: $('rACCBin'), rB: $('rB'), rPSW: $('rPSW'),
    rPSWBits: $('rPSWBits'), rSteps: $('rSteps'), rCycles: $('rCycles'), rnGrid: $('rnGrid'),
    rnBank: $('rnBank'), regBankTag: $('regBankTag'), memSummary: $('memSummary'), tip: $('tip'),
    footTip: $('footTip'), btnFull: $('btnFull'),
    fGrid: $('fGrid'), fPage: $('fPage'), fInfo: $('fInfo'), fAddr: $('fAddr'),
    fFirst: $('fFirst'), fPrev: $('fPrev'), fNext: $('fNext'), fLast: $('fLast'),
    fToPc: $('fToPc'), fFollow: $('fFollow'), gridFlash: $('grid-flash'),
    fErase: $('fErase'), fUndo: $('fUndo')
  };

  function hex(v, w) { return (v >>> 0).toString(16).toUpperCase().padStart(w || 2, '0'); }
  function hexH(v, w) { return hex(v, w) + 'H'; }
  function bin(v, w) { return (v >>> 0).toString(2).padStart(w || 8, '0'); }
  /** 按当前进制格式化格子里的数值（十进制统一补足 3 位，保证网格对齐） */
  function fmtCell(v) {
    return state.radix === 'dec' ? String(v).padStart(3, '0') : hex(v);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function asciiOf(v) { return (v >= 32 && v < 127) ? String.fromCharCode(v) : '·'; }

  /* ========================= 内存网格定义 ========================= */
  /* 每个格子通过 data-a 携带地址，便于悬停提示与刷新 */
  var GRID_DEFS = {
    iram: {
      cols: 16, rows: 16, cls: 'iramgrid', rowBytes: 16, base: 0,
      rowLabel: function (r) { return hex(r * 16) + 'H'; },
      colLabels: true,
      value: function (a) { return state.cpu.iram[a]; }
    },
    xram: {
      cols: 64, rows: 28, cls: 'xramgrid', rowBytes: 64, base: 0,
      rowLabel: function (r) { return hex(r * 64, 4) + 'H'; },
      colLabels: 16,
      value: function (a) { return state.cpu.xram[a]; }
    },
    sfr: {
      cols: 16, rows: 8, cls: 'sfrgrid', rowBytes: 16, base: 0x80,
      rowLabel: function (r) { return hex(0x80 + r * 16) + 'H'; },
      colLabels: true,
      value: function (a) { return state.cpu.sfr[a]; }
    }
  };

  function buildGrid(space) {
    var def = GRID_DEFS[space];
    var host = $('grid-' + space);
    host.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'memgrid ' + def.cls;
    grid.style.gridTemplateColumns = '46px repeat(' + def.cols + ', 1fr)';

    // 列标题
    grid.appendChild(document.createElement('div')).className = 'hdr';
    for (var c = 0; c < def.cols; c++) {
      var h = document.createElement('div');
      h.className = 'hdr';
      if (def.colLabels === true) h.textContent = hex(c, 1);
      else if (c % def.colLabels === 0) h.textContent = hex(c, 2);
      grid.appendChild(h);
    }
    // 数据行
    var cells = [];
    for (var r = 0; r < def.rows; r++) {
      var lab = document.createElement('div');
      lab.className = 'rowlab';
      lab.textContent = def.rowLabel(r);
      grid.appendChild(lab);
      for (var c2 = 0; c2 < def.cols; c2++) {
        var addr = def.base + r * def.rowBytes + c2;
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.a = addr;
        grid.appendChild(cell);
        cells[addr] = cell;
      }
    }
    host.appendChild(grid);
    state.grids[space] = { def: def, cells: cells, host: host };
  }

  function refreshGrid(space) {
    var g = state.grids[space];
    if (!g) return;
    var def = g.def, cpu = state.cpu;
    var initial = state.initial[space];
    var lw = state.lastWrite[space];
    var sp = cpu.getSP(), dptr = cpu.getDPTR() % cpu.xramSize, bank = cpu.bank();
    var changed = 0, nonzero = 0;

    for (var a = def.base; a < def.base + def.rows * def.rowBytes; a++) {
      var cell = g.cells[a];
      if (!cell) continue;
      var v = def.value(a);
      var txt = space === 'sfr' ? '' : fmtCell(v);
      var isUndef = false;

      if (space === 'sfr') {
        var s = CHIP.sfrByAddr[a];
        isUndef = !s;
        var html = '<i>' + (s ? esc(s.name) : '·') + '</i><b>' + fmtCell(v) + '</b>';
        var key = state.radix + '|' + html;      // 进制也计入缓存键，切换时才会重绘
        if (cell.dataset.t !== key) { cell.innerHTML = html; cell.dataset.t = key; }
        cell.classList.add('sfrname');
      } else if (cell.textContent !== txt) {
        cell.textContent = txt;
      }

      cell.classList.toggle('nz', v !== 0);
      cell.classList.toggle('undef', isUndef);
      if (v !== 0) nonzero++;

      var w = lw[a];
      cell.classList.toggle('wrote', !!(w && w.step === cpu.steps && !w.same));
      var isChg = !!(initial && initial[a] !== v);
      cell.classList.toggle('chg', isChg);
      if (isChg) changed++;

      // 标记：SP / 寄存器组 / DPTR / 存储区着色
      if (space === 'iram') {
        cell.classList.toggle('sp', a === sp);
        cell.classList.toggle('reg', a >= bank * 8 && a < bank * 8 + 8);
        cell.classList.toggle('stack', a > 0x07 && a <= sp);
        cell.classList.toggle('zone-bank', a < 0x20);
        cell.classList.toggle('zone-bit', a >= 0x20 && a < 0x30);
        cell.classList.toggle('zone-up', a >= 0x80);
      } else if (space === 'xram') {
        cell.classList.toggle('ptr', a === dptr && dptr < def.rows * def.rowBytes);
      } else if (space === 'sfr') {
        cell.classList.toggle('sp', a === 0x81);
        cell.classList.toggle('ptr', a === 0x82 || a === 0x83);
        cell.classList.toggle('reg', a === 0xD0 || a === 0xE0 || a === 0xF0);
      }
    }
    return { changed: changed, nonzero: nonzero };
  }

  function refreshMemSummary() {
    var s = refreshGrid('iram');
    refreshGrid('xram');
    refreshGrid('sfr');
    refreshFlash();
    if (!s) { el.memSummary.textContent = ''; return; }
    var total = 0;
    for (var i = 0; i < 256; i++) if (state.initial.iram && state.initial.iram[i] !== state.cpu.iram[i]) total++;
    el.memSummary.textContent = '内部 RAM 非零 ' + s.nonzero + ' 格 · 已变化 ' + total + ' 格';
  }

  /* ====================== 编辑器行号栏 ====================== */
  /* 行高由 CSS 统一为 21px（#source 与 .gutter 必须一致），此处只需同步滚动与行数 */

  function syncGutter() {
    if (el.gutter) el.gutter.scrollTop = el.source.scrollTop;
  }

  /** 光标所在行（1 起） */
  function caretLine() {
    var upto = el.source.value.slice(0, el.source.selectionStart);
    return upto.split('\n').length;
  }

  function markGutterLine() {
    if (!el.gutter) return;
    var line = caretLine();
    if (state.gutterLine === line) return;
    state.gutterLine = line;
    var kids = el.gutter.children;
    for (var i = 0; i < kids.length; i++) kids[i].classList.toggle('cur', (i + 1) === line);
  }

  /** 重建行号（行数不变时只同步滚动与当前行） */
  function updateGutter() {
    if (!el.gutter) return;
    var n = el.source.value.split('\n').length;
    if (state.gutterCount !== n) {
      var html = '';
      for (var i = 1; i <= n; i++) html += '<div>' + i + '</div>';
      el.gutter.innerHTML = html;
      state.gutterCount = n;
      state.gutterLine = -1;
      el.gutter.style.width = (String(n).length * 8 + 20) + 'px';
    }
    syncGutter();
    markGutterLine();
  }

  function bindEditor() {
    el.source.addEventListener('input', updateGutter);
    el.source.addEventListener('scroll', syncGutter);
    ['click', 'keyup', 'select', 'focus'].forEach(function (ev) {
      el.source.addEventListener(ev, markGutterLine);
    });
    /* 文本域横向滚动时，清单表头跟着平移，保持列对齐 */
    el.listing.addEventListener('scroll', function () {
      if (el.listingHead) el.listingHead.style.transform = 'translateX(' + (-el.listing.scrollLeft) + 'px)';
    });
  }

  /* ====================== 程序 Flash 视图（分页 256 字节） ====================== */
  function buildFlashGrid() {
    var host = el.fGrid;
    host.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'memgrid flashgrid';
    grid.style.gridTemplateColumns = '58px repeat(16, 1fr)';
    grid.appendChild(document.createElement('div')).className = 'hdr';
    for (var c = 0; c < 16; c++) {
      var h = document.createElement('div');
      h.className = 'hdr';
      h.textContent = hex(c, 1);
      grid.appendChild(h);
    }
    state.flashCells = [];
    state.flashRows = [];
    for (var r = 0; r < 16; r++) {
      var lab = document.createElement('div');
      lab.className = 'rowlab';
      grid.appendChild(lab);
      state.flashRows.push(lab);
      for (var c2 = 0; c2 < 16; c2++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.a = r * 16 + c2;
        grid.appendChild(cell);
        state.flashCells.push(cell);
      }
    }
    host.appendChild(grid);
  }

  /** 该字节在指令中的角色说明 */
  function instrTextAt(a) {
    if (!state.asm) return '（尚未载入程序）';
    var li = state.byteOwner ? state.byteOwner[a] : -1;
    if (li < 0) return '未编程区域（擦除态 FFH）';
    var it = state.asm.listing[li];
    if (it.addr === a) return it.kind === 'data' ? '数据表（DB）起始字节' : '指令首字节（操作码）';
    return '属于 ' + it.text + ' 的后续字节（操作数）';
  }

  /** PC 所在指令的长度（用于把整条指令的字节都标出来） */
  function instrLenAt(pc) {
    var o = state.byteOwner;
    if (!o || !state.asm || !state.asm.listing.length) return 1;
    var li = o[pc & 0xFFFF];
    if (li < 0) return 1;
    var it = state.asm.listing[li];
    if (!it || !it.bytes || !it.bytes.length) return 1;
    return it.bytes.length;
  }

  function refreshFlash() {
    if (!state.flashCells) return;
    var asm = state.asm, cpu = state.cpu;
    if (state.flashFollow && el.fFollow.checked) {
      state.flashPage = Math.min(FLASH_PAGES - 1, Math.floor((cpu.pc & 0xFFFF) / FLASH_PAGE));
    }
    var base = state.flashPage * FLASH_PAGE;
    var pc0 = cpu.pc & 0xFFFF, pcEnd = pc0 + instrLenAt(pc0);
    var owner = state.byteOwner;
    var programmed = 0, dataBytes = 0;

    for (var r = 0; r < 16; r++) {
      var lt = hex(base + r * 16, 4) + 'H';
      if (state.flashRows[r].textContent !== lt) state.flashRows[r].textContent = lt;
    }
    for (var i = 0; i < 256; i++) {
      var a = base + i, cell = state.flashCells[i];
      var v = cpu.rom[a];
      var txt = fmtCell(v);
      if (cell.textContent !== txt) cell.textContent = txt;
      if (cell.dataset.a !== String(a)) cell.dataset.a = a;
      var used = asm ? asm.used[a] : 0;
      if (used) programmed++;
      cell.classList.toggle('nz', v !== 0 && v !== 0xFF);
      cell.classList.toggle('erased', !used);
      var li = owner ? owner[a] : -1;
      var isData = !!(li >= 0 && asm.listing[li].kind === 'data');
      if (isData) dataBytes++;
      cell.classList.toggle('data', isData);
      cell.classList.toggle('pcbyte', a >= pc0 && a < pcEnd);
      cell.classList.toggle('pchead', a === pc0);
    }
    el.fPage.textContent = hex(base, 4) + 'H ~ ' + hex(base + 255, 4) + 'H　第 ' + (state.flashPage + 1) + '/' + FLASH_PAGES + ' 页';
    el.fInfo.textContent = '本页已编程 ' + programmed + '/256 字节' +
      (dataBytes ? '（其中数据表 ' + dataBytes + '）' : '') +
      '　整片已编程 ' + (state.flashTotal === undefined ? '?' : state.flashTotal) + ' 字节' +
      (state.flashPage >= FLASH_PAGES ? '　⚠ F000H 以上为 ISP/系统区' : '');
  }

  function setFlashPage(page, manual) {
    if (manual) { state.flashFollow = false; el.fFollow.checked = false; }
    state.flashPage = Math.max(0, Math.min(FLASH_PAGES - 1, page | 0));
    refreshFlash();
  }

  /* ==================== 全片擦除（把 Flash 写回 FFH） ==================== */
  function chipErase() {
    if (!state.asm) { flashMsg('尚未载入程序，无需擦除', 'warn'); return; }
    var asm = state.asm, limit = CHIP.data.flashBytes;
    /* 撤销快照 */
    state.lastErase = {
      rom: Uint8Array.from(asm.rom),
      used: Uint8Array.from(asm.used),
      blockMap: asm.blockMap.slice(),
      codeBytes: asm.codeBytes,
      listing: asm.listing.slice(),
      byteOwner: state.byteOwner ? state.byteOwner.slice() : null,
      flashTotal: state.flashTotal
    };
    var n = 0;
    for (var a = 0; a < limit; a++) {
      if (asm.rom[a] !== 0xFF) n++;
      asm.rom[a] = 0xFF;       // cpu.rom 与 asm.rom 是同一个数组
      asm.used[a] = 0;
    }
    asm.listing = [];
    asm.blockMap = new Array(256).fill(0);
    asm.codeBytes = 0;
    asm.blanked = true;
    state.byteOwner = null;
    state.flashTotal = 0;
    state.lastStep = null;
    el.fUndo.classList.remove('hidden');
    renderListing();
    refreshAll();
    el.asmStatus.textContent = '已全片擦除（芯片内容全为 FFH）';
    el.asmStatus.className = 'status status-run';
    flashMsg('已全片擦除：用户程序区 0000H~EFFFH 共 ' + limit + ' 字节全部写为 FFH（其中 ' + n +
      ' 个字节由程序改为擦除态）。F000H 以上的 ISP/系统区不受影响；源码仍在编辑区，点「汇编并载入」可重新烧写。' +
      '注意：PC 不会因此复位，继续单步会执行 FFH（即 MOV R7,A），与真机擦除后跑空片的表现一致。', 'warn');
  }

  function undoErase() {
    var s = state.lastErase;
    if (!s || !state.asm) return;
    state.asm.rom.set(s.rom);
    state.asm.used.set(s.used);
    state.asm.blockMap = s.blockMap;
    state.asm.codeBytes = s.codeBytes;
    state.asm.listing = s.listing;
    state.byteOwner = s.byteOwner;
    state.flashTotal = s.flashTotal;
    state.lastErase = null;
    el.fUndo.classList.add('hidden');
    renderListing();
    refreshAll();
    el.asmStatus.textContent = '已撤销擦除，程序恢复到芯片中';
    el.asmStatus.className = 'status status-ok';
    flashMsg('已撤销擦除：' + s.codeBytes + ' 字节程序已恢复', 'ok');
  }

  /** 解析 "0030H" / "0x30" / "48" 形式的地址输入 */  function parseAddr(text) {
    var s = String(text || '').trim().replace(/[hH]$/, '');
    if (/^0[xX]/.test(s)) return parseInt(s, 16);
    if (/[a-fA-F]/.test(s)) return parseInt(s, 16);
    return parseInt(s, 10);
  }

  function flashTooltipRows(a, v) {
    var asm = state.asm, cpu = state.cpu;
    var rows = [];
    var used = asm ? asm.used[a] : 0;
    rows.push(['区域', a < CHIP.data.flashBytes ? '用户程序区（0000H~EFFFH）' : 'ISP / 系统区（用户程序不能占用）']);
    rows.push(['状态', used ? '已编程' : '擦除态（Flash 擦除后为 FFH）']);
    var li = state.byteOwner ? state.byteOwner[a] : -1;
    if (li >= 0 && asm) {
      var it = asm.listing[li];
      rows.push(['所属源码', '第 ' + it.line + ' 行']);
      var off = a - it.addr;
      rows.push(['所在' + (it.kind === 'data' ? '数据行' : '指令'),
        it.text + '（第 ' + (off + 1) + '/' + it.bytes.length + ' 字节）']);
    } else if (used) {
      rows.push(['说明', '已编程字节，但不在当前清单的行边界内']);
    }
    if (a === (cpu.pc & 0xFFFF)) rows.push(['★', 'PC 指向此处（下一条要执行的指令首字节）']);
    else if (a > (cpu.pc & 0xFFFF) && a < (cpu.pc & 0xFFFF) + instrLenAt(cpu.pc)) rows.push(['★', '属于当前指令的后续字节']);
    if (a === cpu.getDPTR() && (a < CHIP.data.flashBytes)) rows.push(['★', 'DPTR 指向此处（MOVC 查表基址）']);
    return rows;
  }

  function snapshotInitial() {
    state.initial.iram = Uint8Array.from(state.cpu.iram);
    state.initial.xram = Uint8Array.from(state.cpu.xram);
    state.initial.sfr = Uint8Array.from(state.cpu.sfr);
    state.lastWrite = { iram: Object.create(null), xram: Object.create(null), sfr: Object.create(null) };
  }

  /* ========================== 悬停提示 ========================== */
  function tooltipHtml(space, a) {
    var cpu = state.cpu;
    var v = (space === 'iram') ? cpu.iram[a]
          : (space === 'xram') ? cpu.xram[a]
          : (space === 'flash') ? cpu.rom[a]
          : cpu.sfr[a];
    var rows = [];
    var title;
    if (space === 'iram') {
      title = '内部 RAM  ' + hexH(a);
      var d = CHIP.describeIram(a);
      rows.push(['区域', d.zone]);
      if (a < 0x20) rows.push(['寄存器', '组 ' + (a >> 3) + ' 的 R' + (a & 7) + (cpu.bank() === (a >> 3) ? '（当前使用）' : '')]);
      if (a >= 0x20 && a < 0x30) {
        var b0 = (a - 0x20) * 8;
        rows.push(['位地址', hexH(b0) + ' ~ ' + hexH(b0 + 7)]);
      }
      if (a >= 0x80) rows.push(['注意', '只能间接寻址，直接寻址 '+hexH(a)+' 是 ' + (CHIP.sfrByAddr[a] ? CHIP.sfrByAddr[a].name : '未定义 SFR')]);
    } else if (space === 'xram') {
      title = '片内 XRAM  ' + hexH(a, 4);
      rows.push(['区域', 'STC15F2K60S2 片内扩展 RAM（MOVX @DPTR / @Ri 访问）']);
    } else if (space === 'flash') {
      title = '程序 Flash  ' + hexH(a, 4);
      rows = flashTooltipRows(a, v).concat(rows);
      rows.push(['十六进制', hex(v) + 'H']);
      rows.push(['十进制', String(v)]);
      rows.push(['二进制', bin(v, 8)]);
      rows.push(['ASCII', asciiOf(v)]);
      rows.push(['指令含义', instrTextAt(a)]);
      return '<h4>' + esc(title) + '</h4>' +
        rows.map(function (r) { return '<div class="trow"><span class="tk">' + r[0] + '</span><span class="tv">' + r[1] + '</span></div>'; }).join('') +
        '<div class="tnote">程序存放在片内 Flash：掉电不丢，复位后从 0000H 开始取指。</div>';
    } else {
      var s = CHIP.sfrByAddr[a];
      title = 'SFR  ' + hexH(a) + (s ? '  ' + s.name : '');
      rows.push(['名称', s ? s.name : '未定义寄存器']);
      if (s && (a & 7) === 0 && s.bits) {
        var bl = [];
        for (var i = 0; i < 8; i++) if (s.bits[i] && s.bits[i] !== '—') bl.push(s.bits[i]);
        if (bl.length) rows.push(['可位寻址', '是（' + hexH(a) + '~' + hexH(a + 7) + '）']);
        rows.push(['位定义', bl.join('、')]);
        var bl2 = '';
        for (var i2 = 7; i2 >= 0; i2--) {
          var nm = s.bits[i2];
          if (!nm || nm === '—') continue;
          bl2 += '<span class="tv">' + esc(nm) + '=' + ((v >> i2) & 1) + '</span> ';
        }
        if (bl2) rows.push(['当前位值', bl2]);
      } else {
        var doc = CHIP.data.documentedBits && CHIP.data.documentedBits[s ? s.name : ''];
        if (doc && doc.bits) {
          rows.push(['可位寻址', '否（手册有逐位定义，只能用字节操作）']);
          var names = Object.keys(doc.bits).sort(function (a, b) { return doc.bits[b] - doc.bits[a]; });
          var dl = names.map(function (k) {
            var bit = doc.bits[k];
            return '<span class="tv">' + esc(k) + '=' + ((v >> bit) & 1) + '</span>';
          }).join(' ');
          rows.push(['当前位值', dl]);
          if (doc.confidence) rows.push(['备注', '手册对位分配存在矛盾，此处按官方示例代码采用的一套']);
        } else {
          rows.push(['可位寻址', '否']);
        }
      }
    }
    rows.push([(state.radix === 'hex' ? '▸ ' : '') + '十六进制', hex(v) + 'H']);
    rows.push([(state.radix === 'dec' ? '▸ ' : '') + '十进制', String(v)]);
    rows.push(['二进制', bin(v, 8)]);
    if (space !== 'sfr') rows.push(['ASCII', asciiOf(v)]);

    // 特殊标记
    var marks = [];
    if (space === 'iram' && a === cpu.getSP()) marks.push('SP 指向此处（栈顶）');
    if (space === 'iram' && a > 0x07 && a <= cpu.getSP()) marks.push('位于当前堆栈范围内');
    if (space === 'xram' && a === (cpu.getDPTR() % cpu.xramSize)) marks.push('DPTR 指向此处');
    if (space === 'sfr' && a === 0x81) marks.push('SP');
    var w = state.lastWrite[space][a];
    var writeRow = '';
    if (w) {
      writeRow = '<div class="tnote">第 ' + w.step + ' 步被写入：' + hexH(w.from) + ' → <span class="wrote">' + hexH(w.to) + '</span></div>';
    }
    var markRow = marks.length ? '<div class="tnote">' + marks.join('；') + '</div>' : '';
    var detail = (space === 'iram') ? CHIP.describeIram(a).detail : (space === 'sfr' ? CHIP.describeDirect(a).detail : '片内扩展 RAM，MOVX 指令访问');
    return '<h4>' + esc(title) + '</h4>' +
      rows.map(function (r) { return '<div class="trow"><span class="tk">' + r[0] + '</span><span class="tv">' + r[1] + '</span></div>'; }).join('') +
      '<div class="tnote">' + esc(detail) + '</div>' + markRow + writeRow;
  }

  function showTip(e, space, a) {
    el.tip.innerHTML = tooltipHtml(space, a);
    el.tip.classList.remove('hidden');
    var x = e.clientX + 14, y = e.clientY + 14;
    var r = el.tip.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8);
    el.tip.style.left = x + 'px';
    el.tip.style.top = y + 'px';
  }
  function hideTip() { el.tip.classList.add('hidden'); }

  function bindGridMouse() {
    ['iram', 'xram', 'sfr', 'flash'].forEach(function (space) {
      var host = $('grid-' + space);
      host.addEventListener('mousemove', function (e) {
        var cell = e.target.closest ? e.target.closest('.cell') : null;
        if (!cell) { hideTip(); return; }
        showTip(e, space, parseInt(cell.dataset.a, 10));
      });
      host.addEventListener('mouseleave', hideTip);
    });
  }

  /* ========================= 代码清单渲染 ========================= */
  /** 重建「字节地址 → 清单行」索引与已编程字节数。
   *  必须在任何提前 return 之前调用，否则会留下与 state.asm 不匹配的旧索引，
   *  后续 instrLenAt() 会拿旧下标去查新的（可能为空的）清单而抛异常。 */
  function rebuildByteIndex() {
    state.byteOwner = new Int32Array(0x10000).fill(-1);
    state.flashTotal = 0;
    if (!state.asm) return;
    state.asm.listing.forEach(function (it, idx) {
      if (it.addr === null) return;
      for (var k = 0; k < it.bytes.length; k++) state.byteOwner[(it.addr + k) & 0xFFFF] = idx;
    });
    var total = 0;
    for (var b = 0; b < FLASH_PAGES * FLASH_PAGE; b++) if (state.asm.used[b]) total++;
    state.flashTotal = total;
  }

  /* ================= 指令清单列宽（按内容实测，保证不截断） ================= */
  var measurer = null;
  function measureText(str, isMono) {
    if (!measurer) {
      measurer = document.createElement('span');
      measurer.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;';
      document.body.appendChild(measurer);
    }
    measurer.style.fontFamily = isMono ? 'var(--mono)' : 'var(--zh)';
    measurer.style.fontSize = isMono ? '12.5px' : '11px';
    measurer.textContent = str;
    return Math.ceil(measurer.getBoundingClientRect().width);
  }

  /** 等宽字体下 CJK 是双宽，用“视觉宽度”挑选最长的样本，避免低估 */
  function visualLen(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) n += (s.charCodeAt(i) > 0x2E80 ? 2 : 1);
    return n;
  }

  /** 依据清单内容计算 4 列宽度，写在 .listing-wrap 的 --c1..--c4 上 */
  function applyColumnWidths() {
    var wrap = el.listing.parentNode;
    if (!wrap || !state.asm) return;
    var best = { addr: '', bytes: '', text: '', src: '' };
    var bl = { addr: 0, bytes: 0, text: 0, src: 0 };
    state.asm.listing.forEach(function (it) {
      var cand = {
        addr: it.addr === null ? '' : hex(it.addr, 4) + 'H',
        bytes: it.bytes.length ? it.bytes.map(function (b) { return hex(b); }).join(' ') : '',
        text: (it.label ? it.label + ': ' : '') + it.text,
        src: it.src || ''
      };
      Object.keys(cand).forEach(function (k) {
        var v = visualLen(cand[k]);
        if (v > bl[k]) { bl[k] = v; best[k] = cand[k]; }
      });
    });
    var w = {
      addr: Math.max(62, measureText(best.addr || '0000H', true) + 10),
      bytes: Math.max(96, measureText(best.bytes || '00 00 00', true) + 10),
      text: Math.max(measureText('指令 / 数据', false) + 12, measureText(best.text || '0000H', true) + 12),
      src: Math.max(measureText('源码', false) + 12, measureText(best.src || 'MOV A,#0', true) + 12)
    };
    wrap.style.setProperty('--c1', w.addr + 'px');
    wrap.style.setProperty('--c2', w.bytes + 'px');
    wrap.style.setProperty('--c3', w.text + 'px');
    wrap.style.setProperty('--c4', w.src + 'px');
  }

  function renderListing() {
    el.listing.innerHTML = '';
    state.rows = [];
    state.pcOrphan = null;
    rebuildByteIndex();
    if (!state.asm) {
      showListingEmpty('尚未载入程序：在左侧写汇编源码后点「汇编并载入」（Ctrl+Enter）');
      return;
    }
    if (!state.asm.listing.length) {
      showListingEmpty(state.asm.blanked
        ? '芯片已全片擦除：程序存储器里没有代码。点「汇编并载入」可把编辑区的源码重新烧写进去。'
        : '本次汇编没有产生任何代码（0 字节）：源码可能为空，或只有注释、标号、伪指令，没有一条真正的指令。');
      return;
    }
    var frag = document.createDocumentFragment();
    state.asm.listing.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'listing-row' + (it.kind === 'data' ? ' data' : '') + (it.kind === 'end' ? ' end' : '') + (it.kind === 'label' ? ' label' : '');
      var addrTxt = it.addr === null ? '' : hex(it.addr, 4) + 'H';
      var bytesTxt = it.bytes.length ? it.bytes.map(function (b) { return hex(b); }).join(' ') : '';
      row.innerHTML =
        '<span class="col-addr">' + addrTxt + '</span>' +
        '<span class="col-bytes">' + bytesTxt + '</span>' +
        '<span class="col-text">' + (it.label ? esc(it.label) + ': ' : '') + esc(it.text) + '</span>' +
        '<span class="col-src">' + esc(it.src || '') + '</span>';
      if (it.addr !== null) {
        row.dataset.a = it.addr;
        row.dataset.len = it.kind === 'label' ? 0 : (it.bytes.length || 1);
        row.dataset.line = it.line;
        state.rows.push(row);
      }
      frag.appendChild(row);
    });
    el.listing.appendChild(frag);
    applyColumnWidths();
    var okCount = state.asm.listing.filter(function (x) { return x.kind === 'instr'; }).length;
    el.codeInfo.textContent = state.asm.codeBytes === 0
      ? '共 0 条指令 / 0 字节（没有可烧写的代码）'
      : '共 ' + okCount + ' 条指令 / ' + state.asm.codeBytes + ' 字节，装入 ' +
        hexH(state.asm.startAddr, 4) + ' ~ ' + hexH(Math.max(state.asm.endAddr, 0), 4);
  }

  /** 程序存储器面板的空态说明（避免出现“一片空白又不说为什么”） */
  function showListingEmpty(msg) {
    var d = document.createElement('div');
    d.className = 'listing-empty';
    d.textContent = msg;
    el.listing.appendChild(d);
    el.codeInfo.textContent = '程序存储器为空';
  }

  function updatePcRow() {
    if (state.pcRow) { state.pcRow.classList.remove('ispc'); state.pcRow = null; }
    if (!state.rows) return;
    var pc = state.cpu.pc;
    var found = false;
    for (var i = 0; i < state.rows.length; i++) {
      var a = parseInt(state.rows[i].dataset.a, 10);
      var len = parseInt(state.rows[i].dataset.len, 10);
      if (len > 0 && pc >= a && pc < a + len) {
        state.rows[i].classList.add('ispc');
        state.pcRow = state.rows[i];
        found = true;
        var wrap = el.listing;
        var top = state.rows[i].offsetTop - wrap.offsetTop;
        if (top < wrap.scrollTop || top > wrap.scrollTop + wrap.clientHeight - 30) {
          wrap.scrollTop = Math.max(0, top - wrap.clientHeight / 2);
        }
        break;
      }
    }
    /* PC 落在清单之外（例如程序从 0030H 开始、复位后 PC=0000H 停在空片区）：
       在清单顶部显示一行醒目提示，否则用户会以为“点了没反应” */
    if (!found && state.asm && state.byteOwner && state.byteOwner[pc & 0xFFFF] < 0) {
      if (!state.pcOrphan) {
        state.pcOrphan = document.createElement('div');
        state.pcOrphan.className = 'listing-row pcorphan';
      }
      state.pcOrphan.innerHTML =
        '<span class="col-addr">' + hexH(pc, 4) + '</span>' +
        '<span class="col-bytes">FF</span>' +
        '<span class="col-text">◀ PC 在这里：程序之外的空片区域（FFH 即 MOV R7,A）' +
        (state.asm.entry !== undefined ? '　→ 点「跳到入口」或按 F10 进入程序 ' + hexH(state.asm.entry, 4) : '') + '</span>' +
        '<span class="col-src"></span>';
      if (el.listing.firstChild !== state.pcOrphan) el.listing.insertBefore(state.pcOrphan, el.listing.firstChild);
    } else if (state.pcOrphan && state.pcOrphan.parentNode) {
      state.pcOrphan.parentNode.removeChild(state.pcOrphan);
    }
  }

  function markCursorRow() {
    if (!state.rows) return;
    state.rows.forEach(function (r) {
      r.classList.toggle('iscursor', parseInt(r.dataset.a, 10) === state.cursorAddr);
    });
  }

  /* ============================ 代码空间图 ============================ */
  function buildCodemap() {
    el.codemap.innerHTML = '';
    for (var i = 0; i < 240; i++) {
      var d = document.createElement('div');
      d.dataset.block = i;
      d.title = hexH(i * 256, 4) + ' ~ ' + hexH(i * 256 + 255, 4);
      el.codemap.appendChild(d);
    }
  }
  function refreshCodemap() {
    var blocks = el.codemap.children;
    var pcBlock = state.cpu.pc >> 8;
    for (var i = 0; i < blocks.length; i++) {
      var used = state.asm ? state.asm.blockMap[i] : 0;
      blocks[i].classList.toggle('has', used > 0);
      blocks[i].classList.toggle('pc', i === pcBlock);
    }
    if (state.asm) {
      var total = 0, from = -1, to = -1;
      for (var b = 0; b < 240; b++) if (state.asm.blockMap[b] > 0) { total++; if (from < 0) from = b; to = b; }
      el.codemapTip.textContent = total === 0 ? '程序已擦除，无代码占用'
        : '占用 ' + total + ' 个 256 字节块（' + hexH(from * 256, 4) + ' ~ ' + hexH(to * 256 + 255, 4) + '）';
    } else el.codemapTip.textContent = '';
    var el2 = el.codemap.querySelector('.pc');
    if (el2) el2.title = 'PC 当前所在块：' + hexH(pcBlock * 256, 4) + ' ~ ' + hexH(pcBlock * 256 + 255, 4);
  }

  /* ============================ 寄存器面板 ============================ */
  var lastRegs = {};
  function setTxt(node, txt) { if (node.textContent !== txt) node.textContent = txt; }

  function refreshRegs() {
    var cpu = state.cpu;
    setTxt(el.rPC, hexH(cpu.pc, 4) + '  (' + cpu.pc + ')');
    setTxt(el.rSP, hexH(cpu.getSP()));
    setTxt(el.rSPnote, '栈顶 iram[' + hexH(cpu.getSP()) + '] = ' + hexH(cpu.iram[cpu.getSP()]) + '　深度 ' + (cpu.getSP() - 7));
    var dptr = cpu.getDPTR();
    setTxt(el.rDPTR, hexH(dptr, 4));
    setTxt(el.rDPTRnote, 'XRAM ' + hexH(dptr % cpu.xramSize, 4) + (dptr >= cpu.xramSize ? '（超出片内 XRAM，回绕）' : ''));
    setTxt(el.rDPHL, hexH(cpu.sfr[0x83]) + ' / ' + hexH(cpu.sfr[0x82]));
    setTxt(el.rACC, hexH(cpu.getA()));
    setTxt(el.rACCBin, bin(cpu.getA(), 8));
    setTxt(el.rB, hexH(cpu.getB()));
    setTxt(el.rPSW, hexH(cpu.getPSW()));
    setTxt(el.rPSWBits, 'CY AC F0 RS1 RS0 OV P = ' +
      cpu.flag('CY') + cpu.flag('AC') + cpu.flag('F0') + cpu.flag('RS1') + cpu.flag('RS0') + cpu.flag('OV') + cpu.flag('P'));

    ['CY', 'AC', 'F0', 'RS1', 'RS0', 'OV', 'P'].forEach(function (f) {
      var v = cpu.flag(f);
      var chip = document.querySelector('.flag[data-f="' + f + '"]');
      if (chip) {
        chip.classList.toggle('on', !!v);
        var span = chip.querySelector('span');
        setTxt(span, String(v));
      }
    });

    var bank = cpu.bank();
    setTxt(el.rnBank, '组 ' + bank + '（iram ' + hexH(bank * 8) + '~' + hexH(bank * 8 + 7) + '）');
    setTxt(el.regBankTag, '寄存器组 ' + bank);
    for (var i = 0; i < 8; i++) {
      var cellEl = el.rnGrid.children[i];
      if (!cellEl) continue;
      var addr = bank * 8 + i, v = cpu.iram[addr];
      var key = 'r' + i;
      var html = '<i>R' + i + '</i><b>' + hex(v) + '</b>';
      if (cellEl.dataset.t !== html) { cellEl.innerHTML = html; cellEl.dataset.t = html; }
      var w = state.lastWrite.iram[addr];
      cellEl.classList.toggle('changed', !!(w && w.step === cpu.steps));
      cellEl.title = 'R' + i + ' = ' + hexH(v) + '（iram ' + hexH(addr) + '）';
    }
    setTxt(el.rSteps, String(cpu.steps));
    setTxt(el.rCycles, String(cpu.cycles));
  }

  function buildRnGrid() {
    el.rnGrid.innerHTML = '';
    for (var i = 0; i < 8; i++) {
      var d = document.createElement('div');
      d.className = 'rncell';
      el.rnGrid.appendChild(d);
    }
  }

  /* ============================ 当前指令 ============================ */
  function refreshCurrent() {
    var cpu = state.cpu;
    var pc = cpu.pc;
    var entry = OP.byOp[cpu.rom[pc]];
    setTxt(el.curAddr, hexH(pc, 4));
    if (!state.asm) {
      setTxt(el.curBytes, '—');
      setTxt(el.curText, '尚未载入程序');
      el.curEffect.innerHTML = '在左侧编辑汇编源码后点击“汇编并载入”';
      return;
    }
    var n = entry ? entry.len : 1;
    var bs = [];
    for (var i = 0; i < n; i++) bs.push(hex(cpu.rom[(pc + i) & 0xFFFF]));
    setTxt(el.curBytes, bs.join(' '));
    var dis = OP.disasm(cpu.rom, pc, {
      directName: function (a) { return CHIP.directName(a); },
      bitName: function (a) { return CHIP.bitNameShort(a); }
    });
    setTxt(el.curText, dis.text);
    if (!entry) el.curText.textContent = dis.text + '（未定义操作码，按 NOP 处理）';
  }

  /* 不显眼的 SFR（不是 A/B/PSW/SP/DPTR 这些常用寄存器）被写入时给出地址重叠提醒 */
  var CORE_SFR = { 0xE0: 1, 0xF0: 1, 0xD0: 1, 0x81: 1, 0x82: 1, 0x83: 1 };

  function describeWrites(step) {
    if (!step) return '按 F8 单步执行';
    var parts = [];
    step.writes.forEach(function (w) {
      var nm = w.space === 'iram' ? 'RAM ' + hexH(w.addr)
             : w.space === 'xram' ? 'XRAM ' + hexH(w.addr, 4)
             : 'SFR ' + hexH(w.addr) + ' ' + (CHIP.sfrByAddr[w.addr] ? CHIP.sfrByAddr[w.addr].name : '');
      parts.push('<b>' + esc(nm) + '</b> ' + hexH(w.from) + '→' + hexH(w.to));
    });
    var extra = parts.length ? '写入：' + parts.join('　') : '本条指令未修改存储器';
    if (step.jumped && step.target !== null) {
      extra += '　<span class="muted">跳转到 ' + hexH(step.target, 4) + '</span>';
    }
    var odd = step.writes.filter(function (w) { return w.space === 'sfr' && !CORE_SFR[w.addr]; });
    if (odd.length) {
      var addrs = odd.map(function (w) { return hexH(w.addr); }).join('、');
      extra += '<br><span class="muted">注意：' + addrs + ' 是<b>特殊功能寄存器</b>（直接寻址 80H~FFH 一律指向 SFR），' +
        '内部 RAM 同地址的格子不受影响；要访问它请用间接寻址 <code>MOV R0,#' + hexH(odd[0].addr) + '</code> + <code>MOV @R0,A</code></span>';
    }
    if (step.notes && step.notes.length) extra += '　<span class="muted">' + esc(step.notes.join('；')) + '</span>';
    return extra;
  }

  /* ============================ 执行控制 ============================ */
  function applyWrites(step) {
    step.writes.forEach(function (w) {
      state.lastWrite[w.space][w.addr] = { from: w.from, to: w.to, step: state.cpu.steps, same: w.same };
    });
  }

  function doStep() {
    if (!state.asm) return null;
    var s = state.cpu.step();
    applyWrites(s);
    state.lastStep = s;
    state.pcHistory.push(s.pc);
    if (state.pcHistory.length > 24) state.pcHistory.shift();
    return s;
  }

  function refreshAll() {
    refreshRegs();
    refreshCurrent();
    updatePcRow();
    refreshCodemap();
    refreshMemSummary();
    var eff = describeWrites(state.lastStep);
    var pc = state.cpu.pc & 0xFFFF;
    if (state.asm && state.byteOwner && state.byteOwner[pc] < 0 && state.asm.entry !== undefined) {
      eff += '<br><span class="muted">提示：PC 当前在程序之外的空片区（Flash 擦除态 FFH = MOV R7,A）。' +
        '点「跳到入口」或按 <b>F10</b> 可直接进入程序 ' + hexH(state.asm.entry, 4) + '。</span>';
    }
    el.curEffect.innerHTML = eff;
  }

  function setRunStatus(text, cls) {
    el.runStatus.textContent = text;
    el.runStatus.className = 'status ' + cls;
  }

  function stepOnce() {
    if (state.running) return;
    if (!state.asm) { flashMsg('请先汇编并载入程序', 'warn'); return; }
    doStep();
    refreshAll();
  }

  function frame() {
    if (!state.running) return;
    var n = parseInt(el.speed.value, 10) || 1;
    for (var i = 0; i < n; i++) {
      var s = doStep();
      if (!s) break;
      if (state.cpu.steps > MAX_RUN_STEPS) {
        pause('已达到最大执行步数（' + MAX_RUN_STEPS + '），已暂停', 'warn');
        return;
      }
      // 死循环检测：连续 24 步 PC 只有 1~2 个不同值（如 SJMP $）
      if (state.pcHistory.length === 24) {
        var uniq = {};
        state.pcHistory.forEach(function (p) { uniq[p] = 1; });
        if (Object.keys(uniq).length <= 2) {
          pause('检测到原地循环（PC 长时间不变），已暂停', 'warn');
          return;
        }
      }
    }
    refreshAll();
    state.rafId = requestAnimationFrame(frame);
  }

  function run() {
    if (!state.asm) { flashMsg('请先汇编并载入程序', 'warn'); return; }
    if (state.running) return;
    state.running = true;
    setRunStatus('运行中…', 'status-run');
    el.btnRun.textContent = '暂停';
    state.rafId = requestAnimationFrame(frame);
  }

  function pause(msg, kind) {
    state.running = false;
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    el.btnRun.textContent = '连续运行';
    setRunStatus('已暂停', 'status-idle');
    refreshAll();
    if (msg) flashMsg(msg, kind || 'warn');
  }

  function resetCpu() {
    state.cpu.reset();
    /* 真机复位后 PC = 0000H（不是“第一条指令的地址”）：若 0000H 没有代码，
       会先执行空片的 FFH。这里严格按硬件行为来，并在汇编时给出提示。 */
    if (state.asm) state.cpu.loadRom(state.asm.rom, 0);
    state.lastStep = null;
    state.pcHistory = [];
    state.stopFlag = false;
    snapshotInitial();
  }

  function runToCursor() {
    if (!state.asm) { flashMsg('请先汇编并载入程序', 'warn'); return; }
    if (state.cursorAddr === null) { flashMsg('请先在代码清单中点击一行设置光标', 'warn'); return; }
    pause();
    var target = state.cursorAddr, guard = 0;
    while (state.cpu.pc !== target && guard++ < MAX_RUN_STEPS) {
      var s = doStep();
      if (!s) break;
    }
    if (guard >= MAX_RUN_STEPS) flashMsg('运行步数超限，未到达光标行', 'warn');
    refreshAll();
  }

  /* ============================ 汇编与消息 ============================ */
  function clearMsg() { el.msgBox.innerHTML = ''; }

  function flashMsg(text, kind) {
    var d = document.createElement('div');
    d.className = 'msg msg-' + (kind || 'ok');
    d.innerHTML = '<span class="ln"></span><span class="txt">' + esc(text) + '</span>';
    el.msgBox.appendChild(d);
    el.msgBox.scrollTop = el.msgBox.scrollHeight;
  }

  function assembleAndLoad() {
    pause();
    clearMsg();
    updateGutter();
    var res = STC.assembler.assemble(el.source.value, { maxAddr: CHIP.data.flashBytes - 1 });
    var errs = res.errors, warns = res.warnings;
    errs.forEach(function (e) {
      var d = document.createElement('div');
      d.className = 'msg msg-err';
      d.innerHTML = '<span class="ln">第' + e.line + '行</span><span class="txt">' + esc(e.msg) +
        (e.text ? '<br><code>' + esc(e.text) + '</code>' : '') + '</span>';
      el.msgBox.appendChild(d);
    });
    warns.forEach(function (w) {
      var d = document.createElement('div');
      d.className = 'msg msg-warn';
      d.innerHTML = '<span class="ln">第' + w.line + '行</span><span class="txt">' + esc(w.msg) + '</span>';
      el.msgBox.appendChild(d);
    });
    (res.hints || []).forEach(function (h) {
      var d = document.createElement('div');
      d.className = 'msg msg-info';
      d.innerHTML = '<span class="ln">第' + h.line + '行</span><span class="txt">' + esc(h.msg) +
        (h.text ? '<br><code>' + esc(h.text) + '</code>' : '') + '</span>';
      el.msgBox.appendChild(d);
    });

    if (!res.ok) {
      el.asmStatus.textContent = '汇编失败（' + errs.length + ' 个错误）';
      el.asmStatus.className = 'status status-err';
      var hadCode = !!(state.asm && state.asm.listing.length);
      flashMsg('本次汇编失败，未载入任何程序。程序存储器里' +
        (hadCode ? '仍是上一次成功载入的代码。' : '当前为空（上次汇编失败或执行过全片擦除）。'), 'warn');
      el.footTip.textContent = '修正错误后重新汇编；当前未载入新程序';
      return;
    }
    /* 只有汇编成功才替换当前程序，避免失败时内部状态与界面不一致 */
    res.blanked = false;
    state.asm = res;
    resetCpu();
    renderListing();
    /* 光标默认停在程序入口，这样 F10「运行到光标行」可直接跳到入口
       （跳过 0000H~入口 之间的空片 FFH） */
    if (state.asm.entry !== undefined && state.asm.entry !== null) state.cursorAddr = state.asm.entry;
    markCursorRow();
    refreshAll();

    var instrCount = res.listing.filter(function (x) { return x.kind === 'instr'; }).length;
    if (instrCount === 0) {
      /* 0 条指令不能算“成功”，否则用户会以为载入了却什么也看不到 */
      el.asmStatus.textContent = '没有可载入的代码（0 字节）';
      el.asmStatus.className = 'status status-run';
      var rawSrc = String(el.source.value);
      flashMsg(rawSrc.trim() === ''
        ? '编辑区是空的：请先写下或粘贴汇编源码，再点「汇编并载入」（Ctrl+Enter）。'
        : '本次汇编没有产生任何代码：源码里可能只有注释、标号或伪指令，没有一条真正的指令。', 'warn');
      el.footTip.textContent = '程序存储器为空';
      return;
    }
    el.asmStatus.textContent = '汇编成功：' + instrCount + ' 条指令 / ' + res.codeBytes + ' 字节';
    el.asmStatus.className = 'status status-ok';
    setRunStatus('已就绪', 'status-idle');
    flashMsg('汇编完成：代码 ' + res.codeBytes + ' 字节，入口地址 ' + hexH(res.entry, 4) +
      (warns.length ? '，' + warns.length + ' 条警告' : ''), 'ok');
    el.footTip.textContent = '符号表 ' + res.symbols.length + ' 项';
  }

  /* ========================= 事件绑定 ========================= */
  /** 给按钮处理函数套一层保护：任何内部异常都变成可见的错误消息，
   *  绝不能再出现“点了没反应、也不报错”这种无法诊断的情况。 */
  function guard(label, fn) {
    return function (ev) {
      try { return fn.call(this, ev); }
      catch (err) {
        try { console.error(err); } catch (e2) { }
        try {
          var d = document.createElement('div');
          d.className = 'msg msg-err';
          d.innerHTML = '<span class="ln">内部错误</span><span class="txt">' +
            esc(label + '：' + (err && err.message ? err.message : String(err))) +
            '<br>这是模拟器自身的异常（不是你的程序问题），本次操作已中断。</span>';
          el.msgBox.appendChild(d);
          el.asmStatus.textContent = '内部错误（' + label + '）';
          el.asmStatus.className = 'status status-err';
        } catch (e3) { }
      }
    };
  }

  function bindEvents() {
    /* 未捕获的脚本错误也显示在消息区，便于定位 */
    window.addEventListener('error', function (ev) {
      try {
        var d = document.createElement('div');
        d.className = 'msg msg-err';
        d.innerHTML = '<span class="ln">脚本错误</span><span class="txt">' + esc(ev.message || '未知错误') +
          '（' + esc(String(ev.filename || '').split('/').pop()) + ':' + (ev.lineno || '?') + '）</span>';
        el.msgBox.appendChild(d);
      } catch (e) { }
    });

    el.btnAsm.addEventListener('click', guard('汇编并载入', assembleAndLoad));
    el.btnClear.addEventListener('click', guard('清空', function () {
      pause(); el.source.value = ''; clearMsg(); updateGutter();
      state.asm = null; resetCpu(); renderListing(); refreshAll();
      el.asmStatus.textContent = '尚未汇编'; el.asmStatus.className = 'status status-idle';
    }));
    el.btnStep.addEventListener('click', guard('单步执行', stepOnce));
    el.btnRun.addEventListener('click', guard('连续运行', function () { state.running ? pause() : run(); }));
    el.btnReset.addEventListener('click', guard('复位', function () {
      pause(); resetCpu(); state.lastStep = null; refreshAll();
      flashMsg('已复位：PC=' + hexH(state.cpu.pc, 4) + '，SP=07H，RAM 与 SFR 回到初值', 'ok');
    }));
    el.btnToCursor.addEventListener('click', guard('运行到光标行', runToCursor));
    el.btnToEntry.addEventListener('click', guard('跳到入口', function () {
      if (!state.asm || state.asm.entry === undefined) { flashMsg('请先汇编并载入程序', 'warn'); return; }
      pause();
      state.cpu.pc = state.asm.entry & 0xFFFF;
      state.lastStep = null;
      state.pcHistory = [];
      refreshAll();
      flashMsg('PC 已跳到程序入口 ' + hexH(state.asm.entry, 4) +
        (state.asm.entry !== 0 ? '（跳过了 0000H~' + hexH(state.asm.entry - 1, 4) + ' 的空片区）' : ''), 'ok');
    }));

    el.listing.addEventListener('click', function (e) {
      var row = e.target.closest('.listing-row');
      if (!row || row.dataset.a === undefined) return;
      state.cursorAddr = parseInt(row.dataset.a, 10);
      markCursorRow();
      refreshAll();
    });

    el.codemap.addEventListener('mousemove', function (e) {
      var d = e.target.closest('div[data-block]');
      if (!d) return;
      var i = parseInt(d.dataset.block, 10);
      var used = state.asm ? state.asm.blockMap[i] : 0;
      el.codemapTip.textContent = hexH(i * 256, 4) + '~' + hexH(i * 256 + 255, 4) + '：' + used + ' 字节' +
        (i === (state.cpu.pc >> 8) ? '（PC 所在块）' : '');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'F8') { e.preventDefault(); stepOnce(); }
      else if (e.key === 'F5') { e.preventDefault(); state.running ? pause() : run(); }
      else if (e.key === 'F9') { e.preventDefault(); pause(); resetCpu(); state.lastStep = null; refreshAll(); }
      else if (e.key === 'F10') { e.preventDefault(); runToCursor(); }
      else if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); toggleFullscreen(); }
      else if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); assembleAndLoad(); }
    });

    el.source.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = el.source.selectionStart, t = el.source.selectionEnd;
        el.source.value = el.source.value.slice(0, s) + '        ' + el.source.value.slice(t);
        el.source.selectionStart = el.source.selectionEnd = s + 8;
      }
    });

    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.gridview').forEach(function (v) { v.classList.remove('active'); });
        tab.classList.add('active');
        state.activeSpace = tab.dataset.space;
        $('grid-' + state.activeSpace).classList.add('active');
        refreshMemSummary();
      });
    });

    document.querySelectorAll('.radix-btn').forEach(function (b) {
      b.addEventListener('click', function () { setRadix(b.dataset.radix, true); });
    });

    el.btnFull.addEventListener('click', toggleFullscreen);
    ['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'].forEach(function (ev) {
      document.addEventListener(ev, updateFullBtn);
    });

    /* 程序 Flash 视图：翻页 / 跳转 / 跟随 PC */
    el.fFirst.addEventListener('click', function () { setFlashPage(0, true); });
    el.fPrev.addEventListener('click', function () { setFlashPage(state.flashPage - 1, true); });
    el.fNext.addEventListener('click', function () { setFlashPage(state.flashPage + 1, true); });
    el.fLast.addEventListener('click', function () { setFlashPage(FLASH_PAGES - 1, true); });
    el.fToPc.addEventListener('click', function () { setFlashPage((state.cpu.pc & 0xFFFF) / FLASH_PAGE | 0, false); });
    el.fFollow.addEventListener('change', function () {
      state.flashFollow = el.fFollow.checked;
      refreshFlash();
    });
    el.fAddr.addEventListener('keydown', function (e) {      if (e.key !== 'Enter') return;
      e.preventDefault();
      var v = parseAddr(el.fAddr.value);
      if (!isFinite(v) || v < 0) { flashMsg('地址无法识别，可写成 0030H / 0x30 / 48', 'warn'); return; }
      if (v >= CHIP.data.flashBytes) flashMsg('地址 ' + hexH(v, 4) + ' 超出用户程序区（0000H~EFFFH）', 'warn');
      setFlashPage(v / FLASH_PAGE | 0, true);
      el.fAddr.blur();
    });
    /* 全片擦除：第一次点击进入待确认状态，3 秒内再点一次才真正擦除 */
    var eraseTimer = 0;
    el.fErase.addEventListener('click', guard('全片擦除', function () {
      if (!eraseTimer) {
        el.fErase.textContent = '再点一次确认擦除';
        el.fErase.classList.add('armed');
        eraseTimer = setTimeout(function () {
          eraseTimer = 0;
          el.fErase.textContent = '⨯ 全片擦除';
          el.fErase.classList.remove('armed');
        }, 3000);
        return;
      }
      clearTimeout(eraseTimer); eraseTimer = 0;
      el.fErase.textContent = '⨯ 全片擦除';
      el.fErase.classList.remove('armed');
      chipErase();
    }));
    el.fUndo.addEventListener('click', guard('撤销擦除', undoErase));

    /* 点代码空间分布图上的小块 → 直接跳到 Flash 视图对应页 */
    el.codemap.addEventListener('click', function (e) {
      var d = e.target.closest ? e.target.closest('div[data-block]') : null;
      if (!d) return;
      var block = parseInt(d.dataset.block, 10);
      document.querySelector('.tab[data-space="flash"]').click();
      setFlashPage(block, true);
    });

    // 支持用 #iram / #xram / #sfr 直接定位到某个存储区视图
    var hash = (location.hash || '').replace('#', '');
    if (hash && document.querySelector('.tab[data-space="' + hash + '"]')) {
      document.querySelector('.tab[data-space="' + hash + '"]').click();
    }
  }

  /* ========================== 网页全屏 ========================== */
  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  }
  function updateFullBtn() {
    var on = !!fsElement();
    if (el.btnFull) {
      el.btnFull.textContent = on ? '⛶ 退出全屏' : '⛶ 全屏';
      el.btnFull.title = (on ? '退出网页全屏' : '进入网页全屏') + '（Ctrl+Shift+F）';
      el.btnFull.classList.toggle('active', on);
    }
    document.body.classList.toggle('is-fullscreen', on);
  }
  function toggleFullscreen() {
    var el0 = document.documentElement;
    if (fsElement()) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) { var r = exit.call(document); if (r && r.catch) r.catch(function () { }); }
      else { flashMsg('无法退出全屏，可按 Esc 退出', 'warn'); }
      return;
    }
    var req = el0.requestFullscreen || el0.webkitRequestFullscreen || el0.msRequestFullscreen;
    if (!req) { flashMsg('当前浏览器不支持网页全屏，可按 F11 使用浏览器自带全屏', 'warn'); return; }
    try {
      var p = req.call(el0);
      if (p && p.catch) p.catch(function (err) { flashMsg('浏览器拒绝了全屏请求（' + (err && err.message ? err.message : '需要用户手势') + '），也可按 F11', 'warn'); });
    } catch (err) {
      flashMsg('全屏请求失败：' + err.message, 'warn');
    }
  }

  /* ========================== 进制显示切换 ========================== */
  function setRadix(radix, persist) {
    state.radix = (radix === 'dec') ? 'dec' : 'hex';
    document.querySelectorAll('.radix-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.radix === state.radix);
    });
    ['iram', 'xram', 'sfr'].forEach(function (sp) {
      var g = state.grids[sp];
      if (g) g.host.classList.toggle('dec', state.radix === 'dec');
    });
    if (el.gridFlash) el.gridFlash.classList.toggle('dec', state.radix === 'dec');
    if (persist) { try { localStorage.setItem('stc15sim.radix', state.radix); } catch (e) { /* file:// 下可能不可用 */ } }
    refreshMemSummary();
  }

  /* ============================== 启动 ============================== */
  function init() {
    el.source.value = DEFAULT_SOURCE;
    updateGutter();
    buildRnGrid();
    ['iram', 'xram', 'sfr'].forEach(buildGrid);
    buildFlashGrid();
    bindGridMouse();
    buildCodemap();
    bindEvents();
    bindEditor();
    var savedRadix = 'hex';
    try { savedRadix = localStorage.getItem('stc15sim.radix') || 'hex'; } catch (e) { }
    setRadix(savedRadix, false);
    resetCpu();
    refreshAll();
    el.asmStatus.textContent = '尚未汇编';
    el.asmStatus.className = 'status status-idle';
    setRunStatus('已停止', 'status-idle');
    updateFullBtn();
    el.footTip.textContent = 'F8 单步 · F5 运行/暂停 · F10 运行到光标行 · F9 复位 · Ctrl+Enter 汇编 · Ctrl+Shift+F 全屏';
    el.curEffect.textContent = '按 F8 单步执行';
    assembleAndLoad();
  }

  /* 供自动化自测调用（不影响正常使用） */
  window.STC = window.STC || {};
  window.STC.ui = {
    toggleFullscreen: function () { toggleFullscreen(); },
    updateFullBtn: function () { updateFullBtn(); },
    setRadix: function (r) { setRadix(r, false); },
    state: state
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
