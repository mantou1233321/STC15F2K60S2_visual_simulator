/* 测试加载器：把浏览器用的经典脚本装进一个共享的 vm 上下文 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const jsDir = path.join(here, '..', 'js');
const FILES = ['opcodes.js', 'sfr-data.js', 'chips.js', 'assembler.js', 'cpu.js'];

const sandbox = { console };
vm.createContext(sandbox);
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), 'utf8'), sandbox, { filename: f });
}

export const STC = sandbox.STC;
