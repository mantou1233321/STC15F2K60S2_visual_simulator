/* =============================================================================
 * 自动化测试：汇编器编码 + CPU 指令语义 + 全覆盖扫描
 * 运行： node test/run-tests.mjs
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STC } from './loader.mjs';

/* 相对脚本自身定位仓库里的 research/（而不是 process.cwd()），
   这样从仓库根目录或 stc15-sim/ 目录运行都能找到权威数据 */
const RESEARCH_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'research');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; failures.push({ name, msg: e.message }); }
}
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error((msg || '') + ` 期望 ${b}，实际 ${a}`);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || '断言失败'); }
function hx(v, w = 2) { return (v >>> 0).toString(16).toUpperCase().padStart(w, '0'); }

function asm(src) { return STC.assembler.assemble(src); }
function asmOk(src) {
  const r = asm(src);
  if (!r.ok) throw new Error('汇编出错：' + r.errors.map(e => `第${e.line}行 ${e.msg}`).join(' | '));
  return r;
}
function bytes(r, addr, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(r.rom[(addr + i) & 0xFFFF]);
  return out;
}
/** 编码一条指令并返回机器码 */
function enc(line) { return bytes(asmOk('ORG 0\n' + line + '\nEND'), 0, 4).slice(0, -0); }

function cpuOf(src, entry) {
  const r = asmOk(src);
  const cpu = new STC.CPU();
  cpu.loadRom(r.rom, entry === undefined ? r.entry : entry);
  return { cpu, r };
}
function stepN(cpu, n) { for (let i = 0; i < n; i++) cpu.step(); }

/* ==========================================================================
 * 一、指令表自身
 * ======================================================================== */
test('指令表：255 个已定义操作码，仅 0xA5 保留', () => {
  const s = STC.opcodes.stats();
  eq(s.total, 255);
  eq(s.reserved, [0xA5]);
});
test('指令表：长度分布 140/91/24', () => {
  eq(STC.opcodes.stats().byLen, { 1: 140, 2: 91, 3: 24 });
});
test('指令表：0x85 (MOV direct,direct) 标记为操作数反序', () => {
  ok(STC.opcodes.byOp[0x85].rev === true);
  ok(STC.opcodes.byOp[0xE5].rev === false);
});
test('指令表：唯一保留操作码 0xA5 执行不抛异常', () => {
  const cpu = new STC.CPU();
  cpu.rom[0] = 0xA5;
  const s = cpu.step();
  eq(cpu.pc, 1);
  ok(s.notes.length > 0, '应给出保留操作码提示');
});
test('指令表：255 个操作码逐个执行均不抛异常', () => {
  for (let op = 0; op < 256; op++) {
    if (op === 0xA5) continue;
    const cpu = new STC.CPU();
    cpu.rom[0] = op; cpu.rom[1] = 0x00; cpu.rom[2] = 0x00;
    cpu.iram[0] = 0x20; cpu.iram[1] = 0x30;
    try { cpu.step(); } catch (e) { throw new Error(`操作码 ${hx(op)} 执行异常：${e.message}`); }
  }
});

/* ==========================================================================
 * 二、汇编器：全部 255 个操作码的编码回环测试
 * ======================================================================== */
function operandText(kind, e) {
  switch (kind) {
    case 'A': return 'A';
    case 'AB': return 'AB';
    case 'C': return 'C';
    case 'DPTR': return 'DPTR';
    case 'Rn': return 'R' + e.rn;
    case '@R0': return '@R0';
    case '@R1': return '@R1';
    case '@DPTR': return '@DPTR';
    case '@A+DPTR': return '@A+DPTR';
    case '@A+PC': return '@A+PC';
    case 'direct': return '30H';
    case '#immed': return '#12H';
    case '#immed16': return '#1234H';
    case 'bit': return '20H.0';
    case '/bit': return '/20H.0';
    case 'rel': return '$';
    case 'addr11': return hx(e.page << 8, 4) + 'H';
    case 'addr16': return '0000H';
    default: throw new Error('未知操作数种类 ' + kind);
  }
}
test('汇编器：255 个操作码全部能正确回环编码', () => {
  for (let op = 0; op < 256; op++) {
    const e = STC.opcodes.byOp[op];
    if (!e) continue;
    const text = e.mnemonic + (e.kinds.length ? ' ' + e.kinds.map(k => operandText(k, e)).join(',') : '');
    const r = asm('ORG 0\n' + text + '\nEND');
    if (!r.ok) throw new Error(`[${hx(op)}] ${text} 汇编失败：${r.errors.map(x => x.msg).join(';')}`);
    const got = bytes(r, 0, e.len);
    // 期望机器码
    const exp = [];
    if (e.kinds.indexOf('addr11') >= 0) exp.push((e.op & 0x1F) | (e.page << 5));
    else exp.push(op);
    if (e.op === 0x85) exp.push(0x30, 0x30);
    else for (const k of e.kinds) {
      switch (k) {
        case 'direct': exp.push(0x30); break;
        case 'bit': case '/bit': exp.push(0x00); break;
        case '#immed': exp.push(0x12); break;
        case '#immed16': exp.push(0x12, 0x34); break;
        case 'addr16': exp.push(0x00, 0x00); break;
        case 'addr11': exp.push(0x00); break;
        case 'rel': exp.push((0 - e.len) & 0xFF); break;
        default: break;
      }
    }
    eq(got, exp, `[${hx(op)}] ${text}`);
  }
});

/* ==========================================================================
 * 三、汇编器：寻址方式 / 伪指令 / 表达式
 * ======================================================================== */
test('汇编：立即数、注释、大小写混合', () => {
  const r = asmOk('Org 0000h\nmov a, #55h ; 送数\nEND');
  eq(bytes(r, 0, 2), [0x74, 0x55]);
});
test('汇编：MOV direct,direct 机器码为先源后目的 (85H 源 目的)', () => {
  eq(bytes(asmOk('ORG 0\nMOV 30H,40H\nEND'), 0, 3), [0x85, 0x40, 0x30]);
});
test('汇编：SFR 名称与位名解析', () => {
  eq(bytes(asmOk('ORG 0\nMOV A,PSW\nEND'), 0, 2), [0xE5, 0xD0]);
  eq(bytes(asmOk('ORG 0\nMOV SP,#60H\nEND'), 0, 3), [0x75, 0x81, 0x60]);
  eq(bytes(asmOk('ORG 0\nSETB P1.0\nEND'), 0, 2), [0xD2, 0x90]);
  eq(bytes(asmOk('ORG 0\nCLR CY\nEND'), 0, 1), [0xC3]);
  eq(bytes(asmOk('ORG 0\nMOV C,P1.7\nEND'), 0, 2), [0xA2, 0x97]);
  eq(bytes(asmOk('ORG 0\nMOV P1.2,C\nEND'), 0, 2), [0x92, 0x92]);
  eq(bytes(asmOk('ORG 0\nSETB 2FH.7\nEND'), 0, 2), [0xD2, 0x7F]);
  eq(bytes(asmOk('ORG 0\nSETB ACC.7\nEND'), 0, 2), [0xD2, 0xE7]);
  eq(bytes(asmOk('ORG 0\nANL C,/P1.0\nEND'), 0, 2), [0xB0, 0x90]);
});
test('汇编：寄存器寻址与间接寻址', () => {
  eq(bytes(asmOk('ORG 0\nMOV R0,#10H\nEND'), 0, 2), [0x78, 0x10]);
  eq(bytes(asmOk('ORG 0\nMOV R7,#0\nEND'), 0, 2), [0x7F, 0x00]);
  eq(bytes(asmOk('ORG 0\nMOV @R0,#5\nEND'), 0, 2), [0x76, 0x05]);
  eq(bytes(asmOk('ORG 0\nMOV @R1,A\nEND'), 0, 1), [0xF7]);
  eq(bytes(asmOk('ORG 0\nMOV @R0,40H\nEND'), 0, 2), [0xA6, 0x40]);
  eq(bytes(asmOk('ORG 0\nMOVX A,@DPTR\nEND'), 0, 1), [0xE0]);
  eq(bytes(asmOk('ORG 0\nMOVX @R0,A\nEND'), 0, 1), [0xF2]);
  eq(bytes(asmOk('ORG 0\nMOVC A,@A+DPTR\nEND'), 0, 1), [0x93]);
});
test('汇编：跳转指令的 rel / addr11 / addr16 编码', () => {
  eq(bytes(asmOk('ORG 0\nSJMP $\nEND'), 0, 2), [0x80, 0xFE]);
  eq(bytes(asmOk('ORG 0\nLJMP 0100H\nEND'), 0, 3), [0x02, 0x01, 0x00]);
  eq(bytes(asmOk('ORG 0\nAJMP 0100H\nEND'), 0, 2), [0x21, 0x00]);
  eq(bytes(asmOk('ORG 0\nACALL 0000H\nEND'), 0, 2), [0x11, 0x00]);
  eq(bytes(asmOk('ORG 0\nDJNZ R0,$\nEND'), 0, 2), [0xD8, 0xFE]);
  const r = asmOk('ORG 0\nLOOP: SJMP LOOP\nNOP\nEND');
  eq(bytes(r, 0, 2), [0x80, 0xFE]);
});
test('汇编：前向标签（需要迭代收敛）', () => {
  const r = asmOk('ORG 0\nSJMP NEXT\nNOP\nNEXT: MOV A,#1\nEND');
  eq(bytes(r, 0, 4), [0x80, 0x01, 0x00, 0x74]);
});
test('汇编：伪指令 EQU / BIT / DATA / ORG / DB / DW / DS', () => {
  eq(bytes(asmOk('COUNT EQU 5\nORG 0\nMOV A,#COUNT\nEND'), 0, 2), [0x74, 0x05]);
  eq(bytes(asmOk('FLAG BIT 20H.3\nORG 0\nSETB FLAG\nEND'), 0, 2), [0xD2, 0x03]);
  eq(bytes(asmOk('ADDR DATA 30H\nORG 0\nMOV ADDR,#1\nEND'), 0, 3), [0x75, 0x30, 0x01]);
  eq(bytes(asmOk('ORG 0\nDB 1,2,3\nDW 1234H\nDS 2\nMOV A,#0\nEND'), 0, 9),
     [0x01, 0x02, 0x03, 0x12, 0x34, 0x00, 0x00, 0x74, 0x00]);
  eq(bytes(asmOk("ORG 0\nDB 'AB',0\nEND"), 0, 3), [0x41, 0x42, 0x00]);
  eq(bytes(asmOk('ORG 0\nDB "Hi"\nEND'), 0, 2), [0x48, 0x69]);
  eq(bytes(asmOk('ORG 0100H\nMOV A,#1\nEND'), 0x100, 2), [0x74, 0x01]);
});
test('汇编：表达式运算与 HIGH/LOW', () => {
  eq(bytes(asmOk('ORG 0\nMOV A,#(1+2)*3\nEND'), 0, 2), [0x74, 0x09]);
  eq(bytes(asmOk('ORG 0\nMOV A,#10H MOD 7\nEND'), 0, 2), [0x74, 0x02]);
  eq(bytes(asmOk('ORG 0\nMOV A,#HIGH(1234H)\nEND'), 0, 2), [0x74, 0x12]);
  eq(bytes(asmOk('ORG 0\nMOV A,#LOW(1234H)\nEND'), 0, 2), [0x74, 0x34]);
  eq(bytes(asmOk('ORG 0\nMOV A,#NOT 0\nEND'), 0, 2), [0x74, 0xFF]);
  eq(bytes(asmOk('ORG 0\nMOV A,#1 SHL 4\nEND'), 0, 2), [0x74, 0x10]);
  eq(bytes(asmOk('ORG 0\nMOV A,#1010B\nEND'), 0, 2), [0x74, 0x0A]);
  eq(bytes(asmOk("ORG 0\nMOV A,#'A'\nEND"), 0, 2), [0x74, 0x41]);
  // $ 表示当前指令地址
  eq(bytes(asmOk('ORG 0100H\nLJMP $\nEND'), 0x100, 3), [0x02, 0x01, 0x00]);
});
test('汇编：错误检测（越界 rel、未知指令、未定义符号）', () => {
  ok(!asm('ORG 0\nSJMP 1000H\nEND').ok, '越界 SJMP 应报错');
  ok(!asm('ORG 0\nJB P1.0,1000H\nEND').ok, '越界 JB 应报错');
  ok(!asm('ORG 0\nFOO A,#1\nEND').ok, '未知指令应报错');
  ok(!asm('ORG 0\nMOV A,UNDEF\nEND').ok, '未定义符号应报错');
  ok(!asm('ORG 0\nMOV A,#(1+\nEND').ok, '表达式语法错误应报错');
  const r = asm('ORG 0\nSJMP 1000H\nEND');
  ok(/范围/.test(r.errors[0].msg), 'rel 越界错误信息应说明范围');
});
test('指令表：长度/机器周期与外部权威表逐条一致（Keil+Actel+Atmel+Intel 多源）', () => {
  const jf = path.join(RESEARCH_DIR, '8051-opcodes.json');
  if (!fs.existsSync(jf)) { console.log('    ⚠ 跳过：未找到 ' + jf + '（只复制了 stc15-sim/ 子目录时属正常）'); return; }
  const ref = JSON.parse(fs.readFileSync(jf, 'utf8'));
  const list = ref.opcodes || ref;
  eq(list.length, 256, '参考表条目数');
  const lenBad = [], cycBad = [], mnBad = [];
  for (const r of list) {
    const e = STC.opcodes.byOp[r.op];
    if (!e) { if (r.op !== 0xA5) lenBad.push(hx(r.op)); continue; }
    if (r.bytes !== null && e.len !== r.bytes) lenBad.push(`${hx(r.op)} ${e.mnemonic} 我=${e.len} 参考=${r.bytes}`);
    if (r.cycles !== null && e.cycles !== r.cycles) cycBad.push(`${hx(r.op)} ${e.mnemonic} 我=${e.cycles} 参考=${r.cycles}`);
    if (r.mnemonic && e.mnemonic.replace(/[^A-Z]/g, '') !== r.mnemonic.replace(/[^A-Z]/g, '')) mnBad.push(hx(r.op));
  }
  eq(lenBad, [], '长度不一致');
  eq(cycBad, [], '机器周期不一致');
  eq(mnBad, [], '助记符不一致');
  // 统计口径也应一致（参考表把保留码 0xA5 记为 None，这里只比已定义操作码）
  const refLen = ref.stats.bytes_distribution;
  const myLen = STC.opcodes.stats().byLen;
  eq({ 1: myLen[1], 2: myLen[2], 3: myLen[3] },
     { 1: refLen[1] || refLen['1'], 2: refLen[2] || refLen['2'], 3: refLen[3] || refLen['3'] }, '长度分布');
});
test('汇编：只有标号的行（"CZX:" 独占一行）不产生字节，保留为清单里的标号行', () => {
  const r = asmOk('ORG 0\n        MOV A,#1\nCZX:\n        MOV A,#2\n        SJMP $\nEND');
  eq(r.codeBytes, 6, '标号行不占字节（2+2+2 = 6 字节）');
  const rows = r.listing;
  const lab = rows.filter(x => x.kind === 'label');
  eq(lab.length, 1, '应有 1 个标号行');
  eq(lab[0].text, 'CZX:');
  eq(lab[0].addr, 2, '标号行地址 = 它所在位置（0002H）');
  eq(lab[0].bytes, [], '标号行没有字节');
  eq(r.symbols.find(s => s.name === 'CZX').value, 2, '标号值应为 0002H');
  const instrs = rows.filter(x => x.kind === 'instr');
  eq(instrs.map(x => x.addr), [0, 2, 4], '后续指令地址不受影响');
  // 标号行不能挤掉 PC 高亮：行长度为 0
  ok(!asm('ORG 0\nCZX:\nEND').errors.some(e => /null/.test(e.msg)), '不应出现 “null” 报错');
  ok(asmOk('ORG 0\nCZX:\nEND').ok, '只含标号的程序也能汇编通过');
});
test('汇编：0000H 没有指令时提示复位向量问题（真机 PC 从 0000H 开始）', () => {
  const r = asmOk('ORG 0030H\nSTART: MOV A,#1\nSJMP $\nEND');
  const h = (r.hints || []).filter(x => /复位后 PC/.test(x.msg));
  eq(h.length, 1, '应给出复位向量提示');
  ok(/0000H/.test(h[0].msg) && /0030H/.test(h[0].msg), '提示应同时提到 0000H 与 0030H：' + h[0].msg);
  ok(/LJMP/.test(h[0].msg), '提示应建议加 LJMP');
  // 0000H 有指令时不应提示
  const r2 = asmOk('ORG 0000H\nLJMP START\nORG 0030H\nSTART: MOV A,#1\nEND');
  eq((r2.hints || []).filter(x => /复位后 PC/.test(x.msg)).length, 0, '0000H 有跳转时不应提示');
  // 真机行为：从 0000H 开始执行会先跑空片 FFH（MOV R7,A）
  const cpu = new STC.CPU();
  cpu.loadRom(r.rom, 0);
  const s = cpu.step();
  eq([s.mnemonic, s.bytes[0]], ['MOV', 0xFF], '0000H 处空片是 FFH → MOV R7,A');
  eq(cpu.pc, 1, 'PC 逐字节前进，直到滑到 0030H');
  for (let i = 0; i < 0x2F; i++) cpu.step();
  eq(cpu.pc, 0x30, '执行 48 个空片字节后到达 0030H');
  eq(cpu.step().mnemonic, 'MOV', '从 0030H 开始执行真正的程序');
});
test('汇编：未定义符号的可定位诊断（END 之后的标号 / 拼写近似 / 无任何标号）', () => {
  // 1) 标号定义在 END 之后
  const r1 = asm('ORG 0\n        LCALL PTDS\n        SJMP $\n        END\nPTDS:   RET\n');
  ok(!r1.ok, 'END 之后的标号不算定义，应报未定义');
  ok(/第 5 行/.test(r1.errors[0].msg) && /END 移到最后一行/.test(r1.errors[0].msg),
     '错误应指出标号在第 5 行且位于 END 之后：' + r1.errors[0].msg);
  ok(r1.warnings.some(w => /END 之后的 \d+ 行/.test(w.msg) && /PTDS/.test(w.msg)),
     'END 行应给出“后面 N 行被忽略”的警告：' + JSON.stringify(r1.warnings.map(w => w.msg)));
  // 把 END 移到最后就正常了
  ok(asm('ORG 0\n        LCALL PTDS\n        SJMP $\nPTDS:   RET\n        END\n').ok, 'END 移到最后应汇编通过');

  // 2) 拼写近似
  const r2 = asm('ORG 0\n        LCALL PTDSS\n        SJMP $\nPTDS:   RET\n        END\n');
  ok(!r2.ok && /是不是想写 “PTDS”/.test(r2.errors[0].msg), '应给出拼写建议：' + r2.errors[0].msg);
  ok(/定义在第 4 行/.test(r2.errors[0].msg), '建议里应含定义位置');

  // 3) 源码里一个标号都没有
  const r3 = asm('ORG 0\n        LCALL FOO\n        END\n');
  ok(!r3.ok && /当前源码里没有定义任何标号/.test(r3.errors[0].msg), '应说明压根没有标号：' + r3.errors[0].msg);
});
test('汇编：常见写法兼容（CSEG AT / NAME / 端口位 / HIGH-LOW 前向引用）', () => {
  ok(asm('CSEG AT 0000H\nAJMP MAIN\nCSEG AT 0030H\nMAIN: MOV A,#1\nEND').ok, 'CSEG AT 应可用');
  const r1 = asmOk('CSEG AT 0000H\nAJMP MAIN\nCSEG AT 0030H\nMAIN: MOV A,#1\nEND');
  eq(bytes(r1, 0, 2), [0x01, 0x30]);
  eq(bytes(r1, 0x30, 2), [0x74, 0x01]);
  ok(asm('ORG 0\nNAME TEST\nMOV A,#1\nEND').ok, 'NAME 伪指令应被忽略而非报错');
  eq(bytes(asmOk('ORG 0\nMOV A,#0FFH\nMOV P1,A\nCPL A\nEND'), 0, 4), [0x74, 0xFF, 0xF5, 0x90]);
  eq(bytes(asmOk('ORG 0\nSTART: JNB P1.0,START\nEND'), 0, 3), [0x30, 0x90, 0xFD]);
  // HIGH/LOW 引用后面的标签（需要迭代收敛）；注意 MOV B,#n 按直接寻址编码为 75H F0H nn（与 A51 一致）
  const r2 = asmOk('ORG 0\nMOV A,#LOW(TAB)\nMOV B,#HIGH(TAB)\nTAB: DB 0\nEND');
  eq(bytes(r2, 0, 5), [0x74, 0x05, 0x75, 0xF0, 0x00]);
});
test('汇编：未使用的代码空间保持 Flash 擦除态 FFH（不是 00H）', () => {
  const r = asmOk('ORG 0\nNOP\nEND');
  eq(r.rom[0], 0x00, '已编程字节');
  eq(r.rom[1], 0xFF, '紧邻的未编程字节应为 FFH');
  eq(r.rom[0x1234], 0xFF, '远处未编程区域应为 FFH');
  eq(r.rom[0xFFFF], 0xFF, '代码空间末尾应为 FFH');
  // 与硬件一致：MOVC 读未编程区域得到 FFH
  const { cpu } = cpuOf('ORG 0\nMOV DPTR,#8000H\nCLR A\nMOVC A,@A+DPTR\nEND');
  stepN(cpu, 3);
  eq(cpu.getA(), 0xFF, 'MOVC 读未编程 Flash 应得 FFH');
  // 复位后 CPU 的默认 rom 也应是擦除态
  const fresh = new STC.CPU();
  eq([fresh.rom[0], fresh.rom[0x8000]], [0xFF, 0xFF]);
});
test('汇编：列出每条指令的地址与字节（清单）', () => {
  const r = asmOk('ORG 0030H\nMAIN: MOV A,#1\n      ADD A,#2\n      SJMP MAIN\nEND');
  eq(r.listing.filter(x => x.kind === 'instr').map(x => [hx(x.addr, 4), x.bytes.length]),
     [['0030', 2], ['0032', 2], ['0034', 2]]);
  eq(r.listing.find(x => x.kind === 'instr').text, 'MOV A,#01H');
  eq(r.entry, 0x30);
});

/* ==========================================================================
 * 四、CPU 语义
 * ======================================================================== */
test('CPU：复位初值 SP=07H', () => {
  const cpu = new STC.CPU();
  eq(cpu.getSP(), 0x07);
  eq(cpu.pc, 0);
  eq(cpu.getDPTR(), 0);
});
test('CPU：MOV 与寄存器寻址', () => {
  const { cpu } = cpuOf('ORG 0\nMOV A,#55H\nMOV R3,A\nMOV 30H,#7\nMOV 31H,30H\nEND');
  stepN(cpu, 4);
  eq(cpu.getA(), 0x55);
  eq(cpu.iram[3], 0x55);
  eq(cpu.iram[0x30], 0x07);
  eq(cpu.iram[0x31], 0x07);
});
test('CPU：加法标志位 CY/AC/OV/P', () => {
  let c = cpuOf('ORG 0\nMOV A,#55H\nADD A,#0AAH\nEND').cpu; stepN(c, 2);
  eq([c.getA(), c.flag('CY'), c.flag('AC'), c.flag('OV')], [0xFF, 0, 0, 0]);
  eq(c.flag('P'), 0);                       // 0xFF 有 8 个 1 → 偶校验

  c = cpuOf('ORG 0\nMOV A,#0FFH\nADD A,#1\nEND').cpu; stepN(c, 2);
  eq([c.getA(), c.flag('CY'), c.flag('AC'), c.flag('OV')], [0x00, 1, 1, 0]);

  c = cpuOf('ORG 0\nMOV A,#7FH\nADD A,#1\nEND').cpu; stepN(c, 2);
  eq([c.getA(), c.flag('CY'), c.flag('OV'), c.flag('AC')], [0x80, 0, 1, 1]);

  c = cpuOf('ORG 0\nMOV A,#50H\nADD A,#50H\nEND').cpu; stepN(c, 2);
  eq([c.getA(), c.flag('CY'), c.flag('OV')], [0xA0, 0, 1]);
});
test('CPU：ADDC 带进位相加', () => {
  let c = cpuOf('ORG 0\nMOV A,#0FFH\nADD A,#1\nMOV A,#0\nADDC A,#0\nEND').cpu; stepN(c, 4);
  eq([c.getA(), c.flag('CY')], [1, 0]);
});
test('CPU：SUBB 借位与溢出', () => {
  let c = cpuOf('ORG 0\nMOV A,#0\nSUBB A,#1\nEND').cpu; stepN(c, 2);
  eq([c.getA(), c.flag('CY'), c.flag('AC'), c.flag('OV')], [0xFF, 1, 1, 0]);
  c = cpuOf('ORG 0\nMOV A,#7FH\nSUBB A,#0FFH\nEND').cpu; stepN(c, 2);
  eq([c.getA(), c.flag('CY'), c.flag('OV')], [0x80, 1, 1]);
  c = cpuOf('ORG 0\nSETB C\nMOV A,#5\nSUBB A,#2\nEND').cpu; stepN(c, 3);
  eq([c.getA(), c.flag('CY')], [2, 0]);
});
test('CPU：逻辑运算与累加器取反', () => {
  let c = cpuOf('ORG 0\nMOV A,#0FH\nANL A,#3\nORL A,#10H\nXRL A,#0FFH\nCPL A\nEND').cpu; stepN(c, 5);
  eq(c.getA(), ((0x0F & 3) | 0x10) ^ 0xFF ^ 0xFF);
  c = cpuOf('ORG 0\nMOV 30H,#0F0H\nANL 30H,#0FH\nORL 30H,#81H\nXRL 30H,#1\nEND').cpu; stepN(c, 4);
  eq(c.iram[0x30], ((0xF0 & 0x0F) | 0x81) ^ 1);
});
test('CPU：MUL / DIV / DA', () => {
  let c = cpuOf('ORG 0\nMOV A,#25\nMOV B,#4\nMUL AB\nEND').cpu; stepN(c, 3);
  eq([c.getA(), c.getB(), c.flag('OV'), c.flag('CY')], [100, 0, 0, 0]);
  c = cpuOf('ORG 0\nMOV A,#0FFH\nMOV B,#0FFH\nMUL AB\nEND').cpu; stepN(c, 3);
  eq([c.getA(), c.getB(), c.flag('OV')], [0x01, 0xFE, 1]);
  c = cpuOf('ORG 0\nMOV A,#0AH\nMOV B,#3\nDIV AB\nEND').cpu; stepN(c, 3);
  eq([c.getA(), c.getB(), c.flag('OV')], [3, 1, 0]);
  c = cpuOf('ORG 0\nMOV A,#5\nMOV B,#0\nDIV AB\nEND').cpu; stepN(c, 3);
  eq([c.getA(), c.getB(), c.flag('OV')], [0, 0, 1]);
  c = cpuOf('ORG 0\nMOV A,#9AH\nDA A\nEND').cpu; stepN(c, 2);
  eq([c.getA(), c.flag('CY')], [0x00, 1]);
  c = cpuOf('ORG 0\nMOV A,#15H\nADD A,#27H\nDA A\nEND').cpu; stepN(c, 3);
  eq([c.getA(), c.flag('CY')], [0x42, 0]);
});
test('CPU：循环移位与 SWAP', () => {
  let c = cpuOf('ORG 0\nMOV A,#81H\nRL A\nRR A\nSWAP A\nSETB C\nRLC A\nEND').cpu; stepN(c, 6);
  eq(c.getA(), 0x31, '81H→03H→81H→18H→(带进位)31H');
  c = cpuOf('ORG 0\nMOV A,#01H\nSETB C\nRRC A\nEND').cpu; stepN(c, 3);
  eq([c.getA(), c.flag('CY')], [0x80, 1]);
});
test('CPU：位操作 SETB/CLR/CPL/MOV C,bit/JBC', () => {
  const { cpu } = cpuOf('ORG 0\nSETB 20H.0\nSETB P1.3\nCPL P1.3\nMOV C,20H.0\nCLR 20H.0\nJBC 21H.0,NEXT\nNEXT: MOV A,#1\nEND');
  stepN(cpu, 7);
  eq(cpu.readBit(0x00), 0);
  eq(cpu.readBit(0x93), 0);
  eq(cpu.flag('CY'), 1);
  eq(cpu.getA(), 1);
});
test('CPU：JBC 置位时清位并跳转', () => {
  const { cpu } = cpuOf('ORG 0\nSETB 20H.1\nJBC 20H.1,L1\nMOV A,#0FFH\nL1: MOV A,#11H\nEND');
  stepN(cpu, 3);
  eq(cpu.getA(), 0x11);
  eq(cpu.readBit(0x01), 0);
});
test('CPU：PUSH/POP 与堆栈指针', () => {
  const { cpu } = cpuOf('ORG 0\nMOV SP,#30H\nMOV A,#5AH\nPUSH ACC\nMOV A,#0\nPOP ACC\nEND');
  stepN(cpu, 5);
  eq(cpu.getA(), 0x5A);
  eq(cpu.getSP(), 0x30);
  eq(cpu.iram[0x31], 0x5A);
});
test('CPU：LCALL/RET 返回地址与堆栈内容（低字节先入栈）', () => {
  const { cpu, r } = cpuOf('ORG 0\nLCALL SUB\nMOV A,#2\nSJMP $\nSUB: MOV A,#1\nRET\nEND');
  stepN(cpu, 1);
  eq(cpu.getSP(), 0x09);
  eq(cpu.iram[0x08], 0x03);   // 返回地址低字节
  eq(cpu.iram[0x09], 0x00);   // 返回地址高字节
  stepN(cpu, 3);              // MOV A,#1 / RET / MOV A,#2
  eq(cpu.getA(), 2);
  eq(cpu.getSP(), 0x07);
});
test('CPU：DJNZ 循环', () => {
  const { cpu } = cpuOf('ORG 0\nMOV R0,#5\nMOV A,#0\nLOOP: INC A\nDJNZ R0,LOOP\nSJMP $\nEND');
  stepN(cpu, 2 + 5 * 2);
  eq([cpu.getA(), cpu.getR0()], [5, 0]);
});
test('CPU：CJNE 比较与 CY', () => {
  let c = cpuOf('ORG 0\nMOV A,#5\nCJNE A,#7,L1\nL1: NOP\nEND').cpu; stepN(c, 3);
  eq(c.flag('CY'), 1);
  c = cpuOf('ORG 0\nMOV A,#7\nCJNE A,#5,L1\nL1: NOP\nEND').cpu; stepN(c, 3);
  eq(c.flag('CY'), 0);
  c = cpuOf('ORG 0\nMOV A,#5\nCJNE A,#5,L1\nMOV A,#0AAH\nL1: NOP\nEND').cpu; stepN(c, 3);
  eq(c.getA(), 0xAA);   // 相等则不跳转
});
test('CPU：条件转移 JC/JNC/JZ/JNZ/JB/JNB', () => {
  let c = cpuOf('ORG 0\nCLR C\nJC L1\nMOV A,#1\nSJMP $\nL1: MOV A,#2\nEND').cpu; stepN(c, 3);
  eq(c.getA(), 1);
  c = cpuOf('ORG 0\nMOV A,#0\nJNZ L1\nMOV A,#1\nSJMP $\nL1: MOV A,#2\nEND').cpu; stepN(c, 3);
  eq(c.getA(), 1);
  c = cpuOf('ORG 0\nMOV A,#3\nJZ L1\nMOV A,#1\nSJMP $\nL1: MOV A,#2\nEND').cpu; stepN(c, 3);
  eq(c.getA(), 1);
  c = cpuOf('ORG 0\nSETB P1.0\nJB P1.0,L1\nMOV A,#1\nSJMP $\nL1: MOV A,#2\nEND').cpu; stepN(c, 3);
  eq(c.getA(), 2);
  c = cpuOf('ORG 0\nCLR P1.0\nJNB P1.0,L1\nMOV A,#1\nSJMP $\nL1: MOV A,#2\nEND').cpu; stepN(c, 3);
  eq(c.getA(), 2);
});
test('CPU：直接/间接地址 80H 重叠（直接=SFR，间接=高 128B RAM）', () => {
  const { cpu } = cpuOf('ORG 0\nMOV 80H,#11H\nMOV R0,#80H\nMOV @R0,#22H\nMOV A,@R0\nMOV 81H,A\nEND');
  stepN(cpu, 5);
  eq(cpu.sfr[0x80], 0x11, '直接寻址 80H 应写入 SFR P0');
  eq(cpu.iram[0x80], 0x22, '间接寻址 80H 应写入高 128B RAM');
  eq(cpu.getSP(), 0x22);
});
test('CPU：MOV 0AAH,A 写的是 SFR WKTCL，不是内部 RAM 0AAH（并给出教学提示）', () => {
  const src = 'ORG 0\nMOV A,#03H\nADD A,#05H\nMOV 0AAH,A\nSJMP $\nEND';
  const r = asmOk(src);
  const cpu = new STC.CPU();
  cpu.loadRom(r.rom, r.entry);
  stepN(cpu, 3);
  eq(cpu.getA(), 8);
  eq(cpu.sfr[0xAA], 8, '直接寻址 AAH 写入 SFR（STC15F2K60S2 的 WKTCL）');
  eq(cpu.iram[0xAA], 0, '内部 RAM 0AAH 不受影响');
  eq(r.listing.filter(x => x.kind === 'instr')[2].text, 'MOV WKTCL,A');
  // 汇编时给出提示
  ok((r.hints || []).length === 1, '应产生 1 条提示');
  ok(/特殊功能寄存器/.test(r.hints[0].msg) && /间接寻址/.test(r.hints[0].msg), '提示应说明原因与正确写法');
  // 正确写法：间接寻址才能写内部 RAM 0AAH
  const r2 = asmOk('ORG 0\nMOV A,#03H\nADD A,#05H\nMOV R0,#0AAH\nMOV @R0,A\nSJMP $\nEND');
  const cpu2 = new STC.CPU();
  cpu2.loadRom(r2.rom, r2.entry);
  stepN(cpu2, 4);
  eq(cpu2.iram[0xAA], 8, '间接寻址才能写内部 RAM 0AAH');
  eq(cpu2.sfr[0xAA] === 8, false, '此时不应改动 SFR WKTCL');
  eq((r2.hints || []).length, 0, '用 SFR 名或间接寻址时不应产生提示');
});
test('CPU：工作寄存器组切换（PSW 的 RS1/RS0）', () => {
  const { cpu } = cpuOf('ORG 0\nMOV R0,#11H\nSETB RS0\nMOV R0,#22H\nEND');
  stepN(cpu, 3);
  eq(cpu.iram[0x00], 0x11);
  eq(cpu.iram[0x08], 0x22);
  eq(cpu.getR0(), 0x22);
});
test('CPU：MOVX 访问片内 XRAM', () => {
  const { cpu } = cpuOf('ORG 0\nMOV DPTR,#0100H\nMOV A,#77H\nMOVX @DPTR,A\nCLR A\nMOVX A,@DPTR\nEND');
  stepN(cpu, 5);
  eq(cpu.xram[0x100], 0x77);
  eq(cpu.getA(), 0x77);
  eq(cpu.getDPTR(), 0x100);
});
test('CPU：MOVC 查表（@A+DPTR 与 @A+PC）', () => {
  let c = cpuOf('ORG 0\nMOV DPTR,#TAB\nCLR A\nMOVC A,@A+DPTR\nSJMP $\nTAB: DB 11H,22H,33H\nEND').cpu;
  stepN(c, 3);
  eq(c.getA(), 0x11);
  // MOVC 位于 0002H，执行时 PC 已指向 0003H，故 A=4 → 读 0007H
  c = cpuOf('ORG 0\nMOV A,#4\nMOVC A,@A+PC\nSJMP $\nNOP\nNOP\nDB 0CCH\nEND').cpu;
  stepN(c, 2);
  eq(c.getA(), 0xCC);
});
test('CPU：MOVC 查表八项全对（@A+DPTR 拷表到 RAM）', () => {
  const src = `
        ORG 0
        MOV DPTR,#TAB
        MOV R0,#0            ; 表内偏移（MOVC 用）
        MOV R1,#40H          ; 目标指针（@R1）
        MOV R2,#8            ; 计数（R2 只计数，不做指针）
LOOP:   MOV A,R0
        MOVC A,@A+DPTR
        MOV @R1,A
        INC R0
        INC R1
        DJNZ R2,LOOP
        SJMP $
TAB:    DB 0AAH,0BBH,0CCH,0DDH,11H,22H,33H,44H
        END`;
  const { cpu, r } = cpuOf(src);
  const halt = r.listing.filter(x => x.kind === 'instr').find(x => x.op === 'SJMP');
  for (let i = 0; i < 5000 && cpu.pc !== halt.addr; i++) cpu.step();
  eq(cpu.pc, halt.addr, '应运行到 SJMP $ 停机');
  eq([0, 1, 2, 3, 4, 5, 6, 7].map(i => cpu.iram[0x40 + i]),
     [0xAA, 0xBB, 0xCC, 0xDD, 0x11, 0x22, 0x33, 0x44], '八个表项应逐字节拷入 40H~47H');
});
test('CPU：MOVC @A+PC 的基址是「本条的下一条指令地址」', () => {
  // 布局：0000 MOV A,#2 / 0002 MOVC(base=0003) / 0003 SJMP NEXT / 0005 TAB: DB 5AH,6BH / 0007 NEXT:
  const src = 'ORG 0\nMOV A,#2\nMOVC A,@A+PC\nSJMP NEXT\nTAB: DB 5AH,6BH\nNEXT: SJMP $\nEND';
  let c = cpuOf(src).cpu;
  stepN(c, 2);
  eq(c.getA(), 0x5A, 'A=2 → 读 0003H+2 = 0005H（表首）');
  c = cpuOf('ORG 0\nMOV A,#3\nMOVC A,@A+PC\nSJMP NEXT\nTAB: DB 5AH,6BH\nNEXT: SJMP $\nEND').cpu;
  stepN(c, 2);
  eq(c.getA(), 0x6B, 'A=3 → 读 0006H（表第二项）');
  // 偏移写错会读到别的字节，模拟器在单步说明里给出实际地址
  c = cpuOf('ORG 0\nMOV A,#0\nMOVC A,@A+PC\nSJMP NEXT\nTAB: DB 5AH,6BH\nNEXT: SJMP $\nEND').cpu;
  stepN(c, 1);
  const s = c.step();
  eq(s.bytes[0], 0x83, 'MOVC A,@A+PC 机器码是 83H');
  ok(s.notes.some(n => /0003H/.test(n)), '说明里应出现基址 0003H（实际：' + s.notes.join('；') + '）');
  eq(c.getA(), 0x80, 'A=0 时读到 MOVC 下一条指令（SJMP 的 80H）——正是常见的偏移写错现象');
});
test('CPU：MOVC 会说明「基址 + A → 实际地址」，便于排查 @A+PC 偏移', () => {
  const { cpu } = cpuOf('ORG 0\nMOV DPTR,#0100H\nMOV A,#7\nMOVC A,@A+DPTR\nEND');
  stepN(cpu, 2);
  const s = cpu.step();
  eq(s.mnemonic, 'MOVC');
  ok(s.notes.some(n => /查表/.test(n) && /0107H/.test(n)), '本步说明应含 0100H + 7 → 0107H（实际：' + s.notes.join('；') + '）');
  eq(s.bytes[0], 0x93, 'MOVC A,@A+DPTR 机器码是 93H');
});
test('汇编：MOVC / MOVX 写错时给出可直接照抄的正确写法', () => {
  let r = asm('ORG 0\nMOVC A,@DPTR\nEND');
  ok(!r.ok && /MOVC A,@A\+DPTR/.test(r.errors[0].msg), 'MOVC A,@DPTR 的报错应给出正确写法：' + r.errors[0].msg);
  r = asm('ORG 0\nMOVX A,@A+DPTR\nEND');
  ok(!r.ok && /MOVX A,@DPTR/.test(r.errors[0].msg), 'MOVX A,@A+DPTR 的报错应给出正确写法');
  r = asm('ORG 0\nMOVC A,@R0\nEND');
  ok(!r.ok && /不支持 @R0/.test(r.errors[0].msg), 'MOVC A,@R0 应说明不支持');
  // 兼容 @DPTR+A / @PC+A 两种书写
  eq(bytes(asmOk('ORG 0\nMOVC A,@DPTR+A\nEND'), 0, 1), [0x93]);
  eq(bytes(asmOk('ORG 0\nMOVC A,@PC+A\nEND'), 0, 1), [0x83]);
});
test('CPU：INC/DEC/DPTR 自增与 XCH/XCHD', () => {
  let c = cpuOf('ORG 0\nMOV DPTR,#0FFFFH\nINC DPTR\nMOV A,#35H\nMOV R0,#40H\nMOV @R0,#0AH\nXCHD A,@R0\nEND').cpu;
  stepN(c, 6);
  eq(c.getDPTR(), 0);
  eq([c.getA(), c.iram[0x40]], [0x3A, 0x05]);
  c = cpuOf('ORG 0\nMOV A,#11H\nMOV 30H,#22H\nXCH A,30H\nEND').cpu; stepN(c, 3);
  eq([c.getA(), c.iram[0x30]], [0x22, 0x11]);
});
test('CPU：JMP @A+DPTR 散转', () => {
  const { cpu } = cpuOf('ORG 0\nMOV DPTR,#TAB\nMOV A,#2\nJMP @A+DPTR\nTAB: AJMP L1\nAJMP L2\nL1: MOV A,#0F1H\nSJMP $\nL2: MOV A,#0F2H\nEND');
  stepN(cpu, 5);
  eq(cpu.getA(), 0xF2, 'A=2 → 落到 TAB+2 的 AJMP L2 → A=0F2H');
});
test('CPU：RETI 等价 RET', () => {
  const { cpu } = cpuOf('ORG 0\nLCALL SUB\nMOV A,#9\nSJMP $\nSUB: NOP\nRETI\nEND');
  stepN(cpu, 4);
  eq(cpu.getA(), 9);
});
test('CPU：每条指令都产生写入追踪（供可视化）', () => {
  const { cpu } = cpuOf('ORG 0\nMOV A,#5\nMOV 30H,A\nEND');
  const s1 = cpu.step();
  ok(s1.writes.some(w => w.space === 'sfr' && w.addr === 0xE0 && w.to === 5), '应记录 ACC 写入');
  eq(s1.writes, s1.writes.slice());
  const s2 = cpu.step();
  ok(s2.writes.some(w => w.space === 'iram' && w.addr === 0x30 && w.to === 5), '应记录 RAM 写入');
  eq(s1.text, 'MOV A,#05H');
  eq(s2.text, 'MOV 30H,A');
});
test('CPU：机器周期累计', () => {
  const { cpu } = cpuOf('ORG 0\nNOP\nMOV A,#1\nMOV DPTR,#1234H\nEND');
  stepN(cpu, 3);
  eq(cpu.cycles, 1 + 1 + 2);
});

/* ==========================================================================
 * 五、综合程序
 * ======================================================================== */
test('综合：子程序求和（含堆栈、间接寻址、MOVC 载入）', () => {
  const src = `
        ORG 0000H
        LJMP START
        ORG 0030H
START:  MOV SP,#60H
        MOV R0,#40H
        MOV R1,#6
        CLR A
LOAD:   MOV @R0,A
        INC A
        INC R0
        DJNZ R1,LOAD
        MOV R0,#40H
        MOV R1,#6
        LCALL SUM
        MOV A,R2
        MOV 50H,A
        SJMP $
SUM:    CLR A
SUM1:   ADD A,@R0
        INC R0
        DJNZ R1,SUM1
        MOV R2,A
        RET
        END`;
  const { cpu, r } = cpuOf(src);
  const halt = r.listing.filter(x => x.kind === 'instr').find(x => x.op === 'SJMP');
  for (let i = 0; i < 2000 && cpu.pc !== halt.addr; i++) cpu.step();
  eq(cpu.pc, halt.addr, '应运行到 SJMP $ 停机');
  eq([cpu.iram[0x40], cpu.iram[0x41], cpu.iram[0x45]], [0, 1, 5]);
  eq(cpu.iram[0x50], 15, '0+1+2+3+4+5 = 15');
  eq(cpu.getSP(), 0x60, '子程序返回后 SP 应复原');
  eq(cpu.getR2(), 15);
});
test('综合：冒泡排序（间接寻址 + CJNE 比较 + 交换）', () => {
  const src = `
        ORG 0000H
        LJMP MAIN
        ORG 0030H
MAIN:   MOV R0,#40H
        MOV R1,#5
        MOV DPTR,#TAB
COPY:   CLR A
        MOVC A,@A+DPTR
        MOV @R0,A
        INC R0
        INC DPTR
        DJNZ R1,COPY
        MOV R7,#4
OUTER:  MOV R0,#40H
        MOV R6,#4
INNER:  MOV A,@R0
        INC R0
        MOV B,@R0
        CJNE A,B,CHK
CHK:    JC  NEXT
        MOV @R0,A
        DEC R0
        MOV @R0,B
        INC R0
NEXT:   DJNZ R6,INNER
        DJNZ R7,OUTER
        SJMP $
TAB:    DB 05H,03H,09H,01H,07H
        END`;
  const { cpu, r } = cpuOf(src);
  const halt = r.listing.filter(x => x.kind === 'instr').find(x => x.op === 'SJMP');
  for (let i = 0; i < 20000 && cpu.pc !== halt.addr; i++) cpu.step();
  eq(cpu.pc, halt.addr, '应运行到 SJMP $ 停机');
  eq([0, 1, 2, 3, 4].map(i => cpu.iram[0x40 + i]), [1, 3, 5, 7, 9]);
});
test('综合：定时器风格的软件延时（DJNZ 嵌套计数）', () => {
  const { cpu } = cpuOf('ORG 0\nMOV R7,#100\nD1: MOV R6,#10\nD2: DJNZ R6,D2\nDJNZ R7,D1\nSJMP $\nEND');
  let guard = 0;
  while (guard++ < 10000) {
    const s = cpu.step();
    if (s.mnemonic === 'SJMP') break;
  }
  eq([cpu.getR7(), cpu.getR6()], [0, 0]);
  // 1(MOV R7) + 100*(1(MOV R6) + 10(DJNZ R6) + 1(DJNZ R7)) + 1(SJMP)
  eq(cpu.steps, 1 + 100 * 12 + 1);
});

/* ========================================================================== */
console.log(`\n通过 ${passed} 项，失败 ${failed} 项`);
if (failed) {
  console.log('\n失败明细：');
  for (const f of failures) console.log(`  ✗ ${f.name}\n      ${f.msg}`);
  process.exit(1);
} else {
  console.log('全部测试通过 ✓');
}
