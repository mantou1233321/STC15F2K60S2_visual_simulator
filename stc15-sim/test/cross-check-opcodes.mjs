/* 交叉校验：把自研指令表与外部独立来源逐条比对
 *   1) 8051Enthusiast/at51 (MIT)        —— 操作码 → 长度 + 助记符
 *   2) research/8051-opcodes.json       —— 操作码 → 长度 + 机器周期 + 助记符
 *      （由子代理从 Keil / Actel Core8051 / Atmel 4316E / Intel MCS-51 手册等
 *        多源交叉比对得到，见 research/8051-opcodes-sources.md）
 * 用法： node test/cross-check-opcodes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { STC } from './loader.mjs';

const raw = path.join(process.cwd(), '..', 'research', 'raw');
const research = path.join(process.cwd(), '..', 'research');
const mine = STC.opcodes.byOp;
const H = n => n.toString(16).toUpperCase().padStart(2, '0');

let bad = 0, checked = 0;
const lenDiff = [], cycDiff = [], mnDiff = [];

/* ---------------- 1) at51：长度 + 助记符 ---------------- */
const rs = fs.readFileSync(path.join(raw, 'opcode-info-table_at51.rs'), 'utf8');
const pairs = [...rs.matchAll(/\(\s*(\d+)\s*,\s*InsType::(\w+)\s*\)/g)].map(m => ({ len: +m[1], type: m[2] }));
console.log('at51 条目数：', pairs.length);
let at51Bad = 0;
for (let op = 0; op < Math.min(256, pairs.length); op++) {
  const e = mine[op], p = pairs[op];
  checked++;
  if (!e) { if (p.type !== 'Resrv') { (console.log(`✗ ${H(op)} 我表里未定义，at51 为 ${p.type}(${p.len})`), at51Bad++); } continue; }
  if (e.len !== p.len) { console.log(`✗ ${H(op)} ${e.mnemonic}: 长度 我=${e.len} at51=${p.len}`); at51Bad++; }
  if (e.mnemonic.replace(/[^A-Z]/g, '').toLowerCase() !== p.type.toLowerCase()) {
    mnDiff.push(`${H(op)} 我=${e.mnemonic} at51=${p.type}`);
  }
}
console.log(`at51 长度比对：检查 ${checked} 条，不一致 ${at51Bad} 条`);
bad += at51Bad;

/* ---------------- 2) research/8051-opcodes.json：长度 + 周期 + 助记符 ---------------- */
const jf = path.join(research, '8051-opcodes.json');
if (fs.existsSync(jf)) {
  const ref = JSON.parse(fs.readFileSync(jf, 'utf8'));
  const list = ref.opcodes || ref;
  console.log('\nresearch/8051-opcodes.json 条目数：', list.length, '| 来源：', (ref.about && ref.about.sources ? ref.about.sources.length : '?'), '个');
  console.log('其 stats：', JSON.stringify(ref.stats || {}).slice(0, 200));
  for (const r of list) {
    const e = mine[r.op];
    if (!e) {
      if (r.op !== 0xA5) lenDiff.push(`${H(r.op)} 我表未定义，参考为 ${r.mnemonic}`);
      continue;
    }
    if (r.bytes !== null && e.len !== r.bytes) lenDiff.push(`${H(r.op)} ${e.mnemonic}: 长度 我=${e.len} 参考=${r.bytes}`);
    if (r.cycles !== null && e.cycles !== r.cycles) cycDiff.push(`${H(r.op)} ${e.mnemonic} ${String(r.operands || '')}: 周期 我=${e.cycles} 参考=${r.cycles}`);
    if (r.mnemonic && e.mnemonic.replace(/[^A-Z]/g, '') !== r.mnemonic.replace(/[^A-Z]/g, '')) {
      mnDiff.push(`${H(r.op)} 我=${e.mnemonic} 参考=${r.mnemonic}`);
    }
  }
  console.log(`\n长度不一致 ${lenDiff.length} 条` + (lenDiff.length ? '：\n  ' + lenDiff.join('\n  ') : ' ✓'));
  console.log(`机器周期不一致 ${cycDiff.length} 条` + (cycDiff.length ? '：\n  ' + cycDiff.join('\n  ') : ' ✓'));
  console.log(`助记符差异 ${mnDiff.length} 条` + (mnDiff.length ? '：\n  ' + mnDiff.join('\n  ') : ' ✓'));
  bad += lenDiff.length + cycDiff.length + mnDiff.length;
} else {
  console.log('\n（未找到 research/8051-opcodes.json，跳过周期比对）');
}

console.log(`\n总计不一致 ${bad} 条` + (bad ? '' : ' ✓ 指令表（长度/周期/助记符）与外部权威来源完全一致'));
process.exit(bad ? 1 : 0);
