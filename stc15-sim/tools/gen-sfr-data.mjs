/* =============================================================================
 * gen-sfr-data.mjs —— 由 research/stc15f2k60s2-sfr.json 生成 js/sfr-data.js
 * 数据来源：STC15F2K60S2 官方手册 + 三处 GitHub 头文件镜像交叉核对
 *（详见 research/stc15f2k60s2-memory.md）
 * 用法： node tools/gen-sfr-data.mjs
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const json = JSON.parse(fs.readFileSync(path.join(root, 'research', 'stc15f2k60s2-sfr.json'), 'utf8'));

const avail = json.sfr.filter(s => s.available_on_stc15f2k60s2 !== false);
const skipped = json.sfr.filter(s => s.available_on_stc15f2k60s2 === false).map(s => s.name);

const EXTRA_BIT_SFRS = { ACC: 0xE0, B: 0xF0 };   // 头文件未给 sbit，但“ACC.0/B.0”写法有效

const out = [];
const extras = [];
const synonyms = [];

for (const s of avail) {
  const bits = ['—', '—', '—', '—', '—', '—', '—', '—'];
  for (const b of (s.bits || [])) {
    const pretty = /^P([0-7])([0-7])$/.test(b.name) ? `${b.name[1]}.${b.name[2]}` : b.name;
    if (pretty !== b.name) synonyms.push([b.name, b.addr]);
    bits[b.bit] = pretty;
  }
  if (EXTRA_BIT_SFRS[s.name] !== undefined) {
    for (let i = 0; i < 8; i++) if (bits[i] === '—') bits[i] = `${s.name}.${i}`;
  }
  out.push({
    name: s.name,
    addr: s.addr,
    bitAddr: !!s.bit_addressable,
    reset: s.reset_value || 0,
    bits: bits
  });
}

/* 头文件里定义但与“位可寻址 SFR 的 8 位展开”无关的 sbit（此处已全部包含在各 SFR 的 bits 中），
   仅保留别名映射：例如 P10 → P1.0，方便两种写法都能汇编。 */

const documented = {};
for (const f of Object.values(json.documented_bit_fields || {})) {
  const layout = f.layout_a_from_STC_official_spi_example || Object.values(f).find(v => v && v.bits);
  if (f.sfr && f.addr && layout && layout.bits) {
    documented[f.sfr] = { addr: f.addr, bits: layout.bits, confidence: f.confidence || '' };
  }
}

const mem = json.memory;

const file = `/* =============================================================================
 * sfr-data.js —— STC15F2K60S2 特殊功能寄存器(SFR)与存储器映射
 *
 * ⚠ 本文件由 tools/gen-sfr-data.mjs 自动生成，请勿手工编辑。
 *    数据来源：${json.sources.slice(0, 3).join(' | ')}
 *    生成依据：research/stc15f2k60s2-sfr.json（98 个 sfr / 108 个 sbit，逐条与官方手册核对）
 *    本型号不可用的 ${skipped.length} 个 SFR 已剔除：${skipped.join(', ')}
 * ========================================================================== */
(function (root) {
  'use strict';

  var SFR = [
${out.map(s => {
  const bits = s.bits.map(b => `'${b}'`).join(', ');
  return `    { name: '${s.name}', addr: 0x${s.addr.toString(16).toUpperCase()}, bits: [${bits}] },`;
}).join('\n')}
  ];

  var EXTRA_BITS = [
${synonyms.map(([n, a]) => `    { name: '${n}', addr: 0x${a.toString(16).toUpperCase()} },`).join('\n') || '    /* 无 */'}
  ];

  /* 手册给出逐位定义、但该 SFR 本身不可位寻址（无法用 SETB 操作），仅用于界面提示 */
  var DOCUMENTED_BITS = ${JSON.stringify(documented, null, 2).replace(/\n/g, '\n  ')};

  root.STC = root.STC || {};
  root.STC.chipData = {
    part: 'STC15F2K60S2',
    flashBytes: ${mem.flash_bytes},          /* 60KB 用户程序区 0000H~EFFFH */
    iramBytes: ${mem.iram_bytes},            /* 内部 RAM：低 128B 直接/间接，高 128B 仅间接 */
    xramBytes: ${mem.xram_bytes},            /* 片内扩展 RAM（AUX-RAM），MOVX 访问 */
    eepromBytes: ${mem.eeprom_bytes},        /* IAP/EEPROM 2×512B（模拟器暂不模拟 IAP 时序） */
    sfr: SFR,
    extraBits: EXTRA_BITS,
    documentedBits: DOCUMENTED_BITS,
    bitRamStartByte: ${mem.bit_addressable_ram.start},   /* 位寻址区 20H~2FH */
    bitRamBytes: ${mem.bit_addressable_ram.bytes},
    portCount: ${mem.ports.length},
    resetSfr: { ${avail.filter(s => s.reset_value).map(s => `${s.name}: 0x${s.reset_value.toString(16).toUpperCase()}`).join(', ')} },
    xramUpperBound: 0x${(mem.xram_bytes).toString(16).toUpperCase()},  /* EXTRAM=0 时 MOVX @DPTR 的片内上界（0700H，按 1792 推导） */
    notes: ${JSON.stringify((json.notes || []).slice(0, 12), null, 2).replace(/\n/g, '\n    ')},
    sources: ${JSON.stringify(json.sources || [], null, 2).replace(/\n/g, '\n    ')}
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.writeFileSync(path.join(here, '..', 'js', 'sfr-data.js'), file, 'utf8');
console.log('已生成 js/sfr-data.js');
console.log('  SFR 条目：', out.length, '（剔除', skipped.length, '个本型号不可用）');
console.log('  别名位名：', synonyms.length);
console.log('  逐位定义文档：', Object.keys(documented).join(', '));
console.log('  存储器：flash', mem.flash_bytes, 'iram', mem.iram_bytes, 'xram', mem.xram_bytes, 'eeprom', mem.eeprom_bytes);
