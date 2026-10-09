# 现成「浏览器内 8051 汇编模拟器/可视化工具」调研报告

> 调研对象：为自研「STC15F2K60S2 汇编可视化模拟器 Web UI」寻找可参考、可借鉴、可复用的开源项目。
> 调研日期：2026-10-09
> 调研方式：GitHub 仓库页面 / commits 页 / LICENSE 文件 / **实际下载 tarball 阅读核心源码**（非仅搜索摘要）
> 源码快照存放：`research/raw/dl/`（各项目解包源码）、`research/raw/`（抽出的可复用数据文件）

---

## 0. 执行摘要（先看结论）

1. **有一个几乎与你需求完全重合的项目：`MentzJ/8051_simulator`**（TypeScript + React 19 + Vite + Tailwind，**The Unlicense = 公有领域**）。它的功能清单和你的需求逐条对应：中文场景下的"粘贴汇编 → 两遍汇编 → 单步 → PC 高亮 + 地址 gutter → 256B IRAM/64KB XRAM 网格 + 悬停提示 + 变动高亮 → 寄存器面板 AP/PC/SP/DPTR/PSW + R0-R7"。**它是本报告唯一推荐的 fork/直接复用起点。**
2. **架构最优雅的是 `Aimini/js51`**，但**它没有任何 LICENSE 文件**（默认保留全部版权），所以只能"读思路、不能抄代码"。
3. **不存在任何 STC15 专用 Web 模拟器**（已多轮搜索确认）。但没有关系：STC15F2K60S2 是**标准 MCS-51 指令集**，只扩展了 SFR，不扩展指令，所以"标准 8051 内核"可以直接用，STC15 的差异只落在 **SFR 定义表 / 时序（1T）/ 外设** 三处。
4. 推荐路线：**以 MentzJ 为基底 fork 魔改（Unlicense 允许），在数据层自建 STC15 SFR 表**；不要从零自研内核，也不要抄 js51/antboard/pysim 的代码（无许可证）。

---

## 1. 项目对照表（19 个，按相关度排序）

| # | 名称 | URL | 技术栈 | 许可证 | 汇编源码输入 | 单步 | RAM 可视化 | 最后活跃 | 可复用性 |
|---|------|-----|--------|--------|------|------|-----------|----------|----------|
| 1 | **MentzJ/8051_simulator** | https://github.com/MentzJ/8051_simulator | TS + React19 + Vite + Tailwind + Web Worker | **Unlicense（公有领域）**；package.json 写 MIT（不一致，见 §4） | ✅ 内置两遍汇编器 | ✅ step/run/pause/速度 | ✅ 256B IRAM 16×8 + 64KB XRAM 分页，悬停 tooltip、写变动高亮、SP 标记 | 2026-10-03 | ★★★★★ 可直接 fork 魔改 |
| 2 | Aimini/js51 | https://github.com/Aimini/js51 | 原生 JS（无框架，script 标签加载） | **无 LICENSE 文件 = 保留全部权利** | ❌ 只吃 Intel HEX / 裸 bin | ✅ `next(n)` | ⚠️ 有寄存器+内存表，UI 很原始 | 2021-12-02 | ★★★☆☆ 只可借鉴架构，不可抄代码 |
| 3 | S2Sofficial/8051sim | https://github.com/S2Sofficial/8051sim | React19 + Vite + Tailwind4（+Clerk 登录） | MIT | ✅（有 snippets/代码编辑器） | ✅ step/run | ✅ 寄存器/RAM/GPIO/trace 视图 | 2026-03-18 | ★★☆☆☆ 引入 Clerk 账号体系，重；逻辑集中在 705 行 App.jsx |
| 4 | rodeo74/8051-Web-Emulator | https://github.com/rodeo74/8051-Web-Emulator | C++ → Emscripten WASM + 原生 JS UI | **无 LICENSE 文件** | ✅ 自带 JS 两遍汇编器 | ✅ STEP/RUN/STOP | ✅ 16 列 RAM 网格（0x00-0xFF）+ LED | 2026-06-30 | ★★★☆☆ 架构值得借鉴（WASM 内核+JS UI），但仅实现 37 条指令且无许可证 |
| 5 | erikgoe/Sim8051 | https://github.com/erikgoe/Sim8051 | Java / 桌面（结构值得借鉴） | Apache-2.0 | ✅ 可加载 .asm | ✅ | ✅ 内存/寄存器视图 | 2025-04-28 | ★★★☆☆ 解码器分层思路可参考 |
| 6 | mmastrac/i8051 | https://github.com/mmastrac/i8051 | Rust（crate：i8051 / disassembler / debug-tui） | MIT OR Apache-2.0 | ❌ 吃 ROM 镜像 | ✅（TUI 调试器） | ✅ TUI 内存/寄存器面板 | 2026-09-30 | ★★★☆☆ 操作码宏 DSL 与"结构化反汇编"思想一流，可移植到 TS |
| 7 | 8051Enthusiast/at51 | https://github.com/8051Enthusiast/at51 | Rust（逆向 8051 固件） | MIT | ❌ | ❌ | ❌ | 2024-07-29 | ★★★★☆ **256 项 (长度, 助记符) 操作码表可直接借用（已下载）** |
| 8 | sid-maddy/8051.js | https://github.com/sid-maddy/8051.js | Vue 2 + Webpack（2017 老栈） | MIT | ❌（指令页） | ✅ | ✅ 寄存器/RAM 表 | 2017-07-17（已归档） | ★★☆☆☆ 老栈，仅参考 |
| 9 | Vartan/JS51 | https://github.com/Vartan/JS51 | 原生 JS 单文件 | **无 LICENSE** | ❌ | ✅ | ⚠️ 极简 | 2014-06-09 | ★☆☆☆☆ 太老 |
| 10 | moltate/8051-emulator | https://github.com/moltate/8051-emulator | 单文件 HTML/JS | MIT | ✅ 文本框输入 | ✅ | ✅ RAM 网格 | 2026-03-31 | ★★☆☆☆ 玩具级，单文件 |
| 11 | antboard/js-for-simulation8051 | https://github.com/antboard/js-for-simulation8051 | 原生 JS + underscore（中文注释） | **无 LICENSE** | ❌ 吃 hex | ✅ | ✅ 网页版外设仿真 | 2016-05-23 | ★★☆☆☆ 中文项目、外设思路可看 |
| 12 | abhi3p/8051-simluator-using-python | https://github.com/abhi3p/8051-simluator-using-python | Python + Tkinter | **无 LICENSE** | ✅ .asm | ✅ | ✅ 寄存器/内存文本视图 | 2011-11-27 | ★☆☆☆☆ **仅"助记符→操作码"字典有参考价值（已下载）** |
| 13 | hsrzq/VSCode-ASM8052 | https://github.com/hsrzq/VSCode-ASM8052 | VSCode 扩展（TextMate 语法 + IntelliSense） | Apache-2.0 | ✅ 语法高亮/补全（不执行） | ❌ | ❌ | 2025-11-27 | ★★★☆☆ **操作码/语法定义可做编辑器高亮参考** |
| 14 | TecCheck/vscode-8051-assembly | https://github.com/TecCheck/vscode-8051-assembly | VSCode 扩展 | 无（已归档） | ✅ 仅语法高亮 | ❌ | ❌ | 归档 | ★☆☆☆☆ |
| 15 | mikeakohn/naken_asm | https://github.com/mikeakohn/naken_asm | C（多架构汇编器，含 8051/8052 + A251） | **GPL-3.0** | ✅ 汇编器本体 | ❌ | ❌ | 活跃（341★） | ★★☆☆☆ GPL 传染，仅命令行参考；**不可拷贝进闭源/自有产品** |
| 16 | danish9661/8086emu | https://github.com/danish9661/8086emu | Rust → WASM，多核（含 8051） | MIT | ❌ | ❌ | ❌ | 2026-10-07 | ★★☆☆☆ Rust+WASM 多核路线可作架构备选 |
| 17 | grigorig/stcgal | https://github.com/grigorig/stcgal | Python（STC ISP 下载器，非模拟器） | MIT（LICENSE 文件缺失，但 setup.py + 源码头声明 MIT） | ❌ | ❌ | ❌ | 2023-11-11 | ★★☆☆☆ 只提供 STC15 协议/型号数据，**不含 STC15F2K60S2 SFR 表** |
| 18 | znhocn/stc-header | https://github.com/znhocn/stc-header | SDCC 头文件集合（含 STC15Fxx.h，103 个 SFR） | **无 LICENSE** | — | — | — | 2018-09-07 | ★★★☆☆ **最好的 STC15 SFR 地址速查表，但无许可证 → 只做核对参考** |
| 19 | uluo1226/51_Lanqiao_2019 | https://github.com/uluo1226/51_Lanqiao_2019 | 蓝桥杯 CT107D / STC15F2K60S2 例程与头文件 | **无 LICENSE** | — | — | — | — | ★★☆☆☆ 工作区已有其 STC15 头文件副本，做地址核对参考 |

> 网络在线工具（非开源，无法 fork，仅供交互设计参考）：
> - **EdSim51**（https://edsim51.com/ ）：教学界最著名的 8051 模拟器，**闭源免费软件（freeware，非开源）**，有寄存器/内存/外设可视化与单步。**不能复用代码**，但它的"外设面板 + 反汇编视图"布局是很好的交互参考。
> - **8051.sim**（https://8051sim.vercel.app/ ，仓库即上表 #3）：可在线试用，直接体验"单步 + RAM 网格 + trace"的交互。
> - Wokwi（https://docs.wokwi.com/getting-started/supported-hardware ）**不支持 8051/MCS-51**（只支持 AVR/ESP32/STM32/RP2040 等），不要指望。

---

## 2. 重点分析（实际读源码）

### 2.1 MentzJ/8051_simulator —— 与需求的重合度最高（**推荐基底**）

**仓库**：https://github.com/MentzJ/8051_simulator
**规模**：核心 ~4,900 行 TS/TSX + 1,800 行测试（58 个 Vitest 用例）

#### （a）"汇编器 / 解码器 / CPU 内核 / UI"四层如何组织

```text
src/assembler.ts        942 行  两遍汇编器（词法→符号表→发射机器码 + sourceMap）
src/opcodes.ts          964 行  256 项操作码跳转表 table[opcode] = (cpu, op) => cycles
src/cpu.ts              990 行  CPU8051 内核（取指/执行/PSW 标志/定时器/中断/外设 tick）
src/flags.ts             66 行  CY/AC/OV/P 计算（独立，便于单测）
src/types.ts            200 行  SFR 地址表 + PSW/TCON/TMOD/IE/IP/SCON 位掩码 + Worker 消息协议
src/cpu.worker.ts       290 行  Web Worker 侧：批量执行 + 脏页收集
src/useCpuWorker.ts     262 行  主线程侧：Worker 通信 hook
src/components/CodeEditor.tsx      182 行  代码编辑器（PC gutter + 当前行高亮）
src/components/RamGrid.tsx         482 行  IRAM/XRAM 网格（核心可视化）
src/components/RegisterDashboard.tsx 298 行 寄存器/标志面板
src/components/Controls.tsx        143 行  单步/运行/暂停/复位/速度
src/components/PeripheralsPanel.tsx 631 行 LED/数码管/拨码开关/串口终端
src/App.tsx             259 行  布局与状态编排
```

四层边界非常清晰：**assembler 只输出 `{code: Uint8Array, sourceMap, symbolTable, errors}`；cpu 只依赖 `types.ts` 的掩码常量；worker 只做批量执行与状态 diff；UI 只消费快照**。这正是你需要的分层，而且几乎没有历史包袱。

#### （b）操作码表/解码用什么数据结构

**256 项定长数组跳转表**，每个元素是一个返回机器周期数的函数：

```ts
export type OpcodeHandler = (cpu: CPU8051, opcode: number) => number;  // 返回值 = 机器周期
export function buildOpcodeTable(): OpcodeHandler[] {
  const table: OpcodeHandler[] = new Array(256);
  table[0x00] = () => 1;                                        // NOP, 1 周期
  table[0x02] = (cpu) => { const h=cpu.fetchCode(), l=cpu.fetchCode();
                           cpu.pc = (h<<8)|l; return 2; };      // LJMP addr16
  for (let page = 0; page < 8; page++) {                        // AJMP：一条循环生成 8 个变体
    const op = (page << 5) | 0x01;
    table[op] = (cpu, opcode) => { ... return 2; };
  }
  ...
}
```

**优点**：`table[op]` 是 O(1) 直接索引，不用逐位判断；每个 handler 返回**精确机器周期数**，天然支持"周期精确"与后续"1T/12T 时序"扩展；8 个 AJMP/ACALL 变体用循环生成，避免 256 行手写。**这是最值得直接照搬的解码器形态。**

对比另一种形态（见 §2.2 js51）：js51 用**操作码位模式二叉判定树**（`if (opcode.test(0x08, 0xF8)) // INC Rn`），代码短、免查表，但每次执行要走 8 层判断，且没有周期数信息。**你的场景建议用跳转表 + handler 返回周期**。

#### （c）内存可视化与单步 UI 怎么做的（重点可借鉴项）

1. **PC 与源码行双向映射**：汇编器 Pass 2 产出 `sourceMap: {line, pc, source}[]`；编辑器左侧 gutter 同时显示**源码行号 + 该指令的 ROM 地址**，并用 `App.tsx` 传入的当前 PC 高亮整行。这正好实现你"代码区显示每条指令的存放地址 + 当前 PC 高亮"。
2. **变动高亮（脏页 diff）**：CPU 在 Worker 里维护 `dirtyRam / dirtyXram` 集合，一帧只上报 `{address,value}` 数组，而不是整块内存 → UI 只给这些格子加 CSS 脉冲动画（`cell-modified`）。**这个"差分脏页 + CSS 动画"是性能与观感兼顾的关键设计。**
3. **RAM 网格**：
   - 内 RAM：8 行 × 16 列（0x00–0x7F），行头 `0x00:`、列头 `+0…+F`；
   - 单元格颜色按区域编码：`0x00–0x1F` 寄存器组（**当前组高亮**，并在格内标注 `R0…R7`）、`0x20–0x2F` 位寻址区（蓝）、`0x30–0x7F` 通用 RAM（灰）；非零值加粗；
   - **SP 位置**在格右上角画一个绿点；
   - **悬停**：`onMouseEnter` 设 `hoveredAddr`，格子放大 + `ring-2` 高亮，并用原生 `title` 显示 `Address: 0x.. | Value: 0x..`（还额外在信息条里显示 hex/dec/bin/ASCII + 区域描述）；
   - **XRAM**：64KB 不可能一次画完，采用 **256 字节窗口 + 分页**（上一页/下一页）+ **地址跳转输入框** + 快捷跳转按钮（0x0000/0x1000/0x2000/0x8000）。这是 XRAM 可视化的正确做法，建议直接沿用并改成中文标签。
4. **寄存器面板**：ACC/B/PC/SP/DPTR(DPH,DPL)/PSW 同时给出 **HEX/DEC/BIN 三种表示**；PSW 8 个标志（CY/AC/F0/RS1/RS0/OV/F1/P）拆成独立徽标；**"上一步被修改的寄存器"整体高亮**；R0–R7 按当前寄存器组显示。
5. **执行控制与解耦**：`step / run / pause / reset / 1Hz / 10Hz / Max`；CPU 跑在 **Web Worker** 中，按 16ms 一帧批量执行 3–5 万周期（≈12–24MHz 等效），彻底避免"运行中卡死 UI"。**如果你的模拟器要支持长延时/跑飞的程序，这套 Worker 批量执行 + 状态 diff 必须抄。**

#### （d）许可证结论

- `LICENSE` 文件正文 = **The Unlicense**（"This is free and unencumbered software released into the public domain…"）。
- 但 `package.json` 里写的是 `"license": "MIT"`，README 未提许可证 → **元数据不一致**。
- **结论**：按法律效力，**LICENSE 文件优先**，即 The Unlicense（公有领域），可用范围比 MIT 更宽（连版权声明都不强制保留）。为稳妥，**fork 后同时保留 `LICENSE` 原文并在 NOTICE 中说明来源**，即可消除歧义。**这是我唯一建议直接 fork 的项目。**

---

### 2.2 Aimini/js51 —— 架构最漂亮，但**没有许可证**

**仓库**：https://github.com/Aimini/js51 （默认分支 `binary_decoder`，最后提交 2021-12-02，9★）

#### （a）四层组织

```text
51vm_core.js            199 行  CPU 对象 + SFR 注册表（reg 对象模型）
51vm_operand.js         177 行  取操作数层：把"内存/SFR/位/Rn/@Ri"统一成 cell
51vm_operation.js       250 行  通用运算微操作（op_inc / op_dec / op_add_offset / op_call…）
51vm_opcode_decoder.js  607 行  操作码解码执行（位模式二叉判定树）
51vm_ctl.js              26 行  执行控制（next/continue/断点）
51vm_peripheral.js      103 行  外设与中断请求源挂钩
hex_decoder.js           52 行  Intel HEX → 字节数组
main.html               492 行  单页 UI（寄存器表 + IRAM/XRAM 表 + 终端）
```

#### （b）操作码表/解码数据结构

**不是表，而是"操作码位模式二叉判定树"**。`fetch_opcode()` 返回一个带 `test(target, mask=0xFF)` 的 opcode 对象，然后：

```js
if (opcode.test(0x01, 0x1F))        this.PC.set(opcode.fetch_addr11());  // AJMP
else if (opcode.test(0x11, 0x1F))   this.op_call(opcode.fetch_addr11()); // ACALL
else if (opcode.value < 0x80) { ... 层层二分到 __execute_decode_90_9F ... }
...
// 变体家族统一处理：
} else if (opcode.test(0x08, 0xF8)) { this.op_inc(opcode.get_Rn()); }     // INC Rn
} else if (opcode.test(0x06, 0xFE)) { this.op_inc(opcode.get_Ri()); }     // INC @Ri
```

**优点**：代码紧凑、变体家族一目了然；**缺点**：每指令 6–8 次比较、无周期数、没有"指令长度表"（做反汇编/静态列表时要另写）。**可以借鉴 `test(value, mask)` 这个技巧去精简你的操作码表，但不值得整棵树照搬。**

#### （c）最值得借鉴的一点：**`cell`（单元格）抽象**

`get_iram_cell(addr)` / `get_XRAM_cell(addr)` / `get_ram_cell(addr)` / `fetch_bit(bit_addr)` 全部返回**同构的 `{get(), set(v)}` 对象**，于是"INC direct / INC Rn / INC @Ri / INC A" 共用一句 `this.op_inc(cell)`；位寻址也被包装成 cell（内部自动做 `0x20+bit>>3` 或 `bit & 0xF8` 的地址换算）。

**对你的直接价值**：**在 `set()` 里挂钩子就能天然拿到"哪个地址被写了"** —— 你的"数据变动高亮"可以直接做在 cell 层，不需要像 MentzJ 那样在 Worker 里维护独立 dirty 集合。这是本报告里最值得"抄思路"的设计。
（注意：该抽象每次访存都新建对象，性能一般；建议只在"调试/单步模式"启用带钩子的 cell，全速运行走裸数组。）

#### （d）SFR 可扩展性

`vm.sfr_extend(new Map([[0x98,"SCON"],[0x99,"SBUF"]]))` 动态注册 SFR，并支持 `setlistener/getlistener` 让外设在 CPU 读写 SFR 时介入（README 里有完整 UART 示例，用 `_value` 作为内核与外设的接口）。
**对你的直接价值**：**STC15 扩展 SFR（AUXR/IE2/IP2/P4/P5/ADC_CONTR/T2H/T2L/S2CON…）正需要这种"按地址注册 + 读写钩子"的机制**，不用改内核代码。

#### （e）许可证结论

- 仓库根目录**只有 `README.md`**，**没有任何 LICENSE/LICENSE.md/COPYING 文件**（已核对解包后的完整文件列表：`51vm_*.js`、`hex_decoder.js`、`main.html`、`test.js`、`test/`、`README.md`）。
- 源码头部**无任何版权/许可声明**（已逐文件扫描 license/copyright/GPL/MIT/Apache/BSD 关键字，零命中）。
- **结论：无许可证 = 默认保留全部权利（All rights reserved）。你不能复制、修改、分发它的代码。** 只能阅读、学习设计思想，然后**用自己的表达重写**。若确实想用，必须联系作者（Aimini）取得书面授权。

---

### 2.3 rodeo74/8051-Web-Emulator —— WASM 内核 + JS 汇编器路线（第三核实对象）

**仓库**：https://github.com/rodeo74/8051-Web-Emulator （最后提交 2026-06-30，0★）

#### （a）四层组织

```text
include/mcu.h + include/disasm.h + include/loader.h
src/mcu.cpp        内核：struct mcu { ram[256]; rom[65536]; xram[65536]; pc; clk; run; } + step_mcu()
src/disasm.cpp     反汇编器（指令 → 文本，供 UI 显示当前指令）
src/loader.cpp     Intel HEX 装载
src/web_main.cpp   Emscripten 导出（web/emulator.js + emulator.wasm）
web/index.html     原生 JS UI（textarea 写汇编 + 状态面板 + 16 列 RAM 网格 + Port1 LED）
（README 称另有一个 "自定义 2-pass JS 汇编器"，但未随仓库提交，只提交了编译产物）
```

汇编器（JS）→ Intel HEX → `loader.cpp` → `mcu.rom` → `step_mcu()`；`disasm.cpp` 负责把机器码反汇编成文本给 UI 显示。

#### （b）操作码/解码结构

`mcu.cpp` 是 **switch(opcode) 巨型分支**，README 明确说只实现 37 条指令的 "Golden Subset"。**没有操作码表**，扩展性差。而 `disasm.cpp` 反过来用一张**助记符表 + 操作数格式**做反汇编 —— **"执行用 switch、显示用表"这种分离是个反面教材**：你应当让**执行和显示共用同一张表**（每条记录同时带 `{opcode, mnemonic, operandMode, length, cycles, handler}`），这样代码区显示地址/反汇编、单步执行、周期统计全部同源，这是 MentzJ 之外我做的一个重要改进建议。

#### （c）UI 借鉴点

- 布局是**左右两栏 + 全宽内存区**：左"输入 8051 汇编 + ASSEMBLE & LOAD 按钮"，右"Core State（PC/ACC/SP/CLK）+ Port1 LED + STEP/AUTO RUN/STOP"，下方全宽 "Internal RAM (0x00-0xFF)" 网格（`.ram-cell` / `.ram-cell.active` 高亮）。
- 亮点：**每个 RAM 格子有 `active` 类做数值/写变动高亮**；**Port1 用真实 LED 灯泡（`.led.on` 带发光阴影）**表示 P1 引脚 —— 这种"外设拟物化"比纯数字好看，值得为 STC15 的 P0-P5 端口借鉴。

#### （d）许可证结论

- 仓库**没有 LICENSE 文件**（解包后根目录仅 `README.md`、`index.html`、`screenshot.png`、`include/`、`src/`、`web/`），源码头部无版权声明。
- **结论：All rights reserved，不可复制代码。** WASM 方案只可作为"若将来需要 C 内核"的架构参考。

---

## 3. 其他"可复用数据文件"评估（含已下载清单）

已下载到 `C:\Users\ZCB\Desktop\STCsimulator\research\raw\`（原始项目源码在 `research/raw/dl/`）。

| 文件（research/raw 下） | 内容 | 来源 URL | 许可证 | 可否直接用 |
|---|---|---|---|---|
| `opcode-table_mentzj-8051-simulator.ts` | 256 项操作码跳转表（含每条周期数、RETI 0x32、8 个 AJMP/ACALL 变体） | https://github.com/MentzJ/8051_simulator/blob/main/src/opcodes.ts | **Unlicense（公有领域）** | ✅ **可自由使用/修改/商用** |
| `sfr-and-bitmasks_mentzj-8051-simulator.ts` | 标准 SFR 地址表 + PSW/TCON/TMOD/IE/IP/SCON/PCON 位掩码 | https://github.com/MentzJ/8051_simulator/blob/main/src/types.ts | **Unlicense** | ✅ 可自由使用 |
| `assembler-2pass_mentzj-8051-simulator.ts` | 两遍汇编器（ORG/DB/EQU/END、多进制字面量、位点号、sourceMap 生成） | https://github.com/MentzJ/8051_simulator/blob/main/src/assembler.ts | **Unlicense** | ✅ 强烈建议直接改造 |
| `cpu-core_mentzj-8051-simulator.ts` | CPU8051 内核（PSW/定时器/中断/准双向口/UART tick） | https://github.com/MentzJ/8051_simulator/blob/main/src/cpu.ts | **Unlicense** | ✅ 可自由使用 |
| `LICENSE_mentzj-8051-simulator.txt` | Unlicense 原文（保留即可） | 同上仓库 `/LICENSE` | — | ✅ 必须随产物保留 |
| `opcode-info-table_at51.rs` | **256 项 `(指令长度, InsType)` 静态表**（做反汇编/指令长度校验的现成数据） | https://github.com/8051Enthusiast/at51/blob/master/src/instr.rs | **MIT**（已下载 `LICENSE_at51.txt`） | ✅ 可移植（保留 MIT 声明） |
| `LICENSE_at51.txt` | at51 的 MIT 原文 | 同上 | MIT | ✅ 需随衍生代码附上 |
| `STC15Fxx.h_UNLICENSED_reference-only.h` | **STC15 全系 SFR 地址表（103 个 SFR，含 P4/P5/AUXR/AUXR1/CLK_DIV/P1ASF/IE2/IP2/INT_CLKO/T4T3M/T2H/T2L/WKTCL/WKTCH/S2CON/S2BUF/ADC_CONTR/ADC_RES/ADC_RESL）+ 全部 SBIT 位定义，带中文注释与复位值** | https://github.com/znhocn/stc-header/blob/master/STC15Fxx.h | **无 LICENSE（All rights reserved）** | ⚠️ **仅作地址核对参考，不要逐字拷贝**；正式数据请直接用本工作区已有的 `research/stc15f2k60s2-sfr.json` |
| `cell-abstraction_js51_UNLICENSED_reference-only.js` | js51 的"统一 cell（get/set）"操作数层 | https://github.com/Aimini/js51/blob/binary_decoder/51vm_operand.js | **无 LICENSE** | ❌ 只读思路，不可拷贝 |
| `cpu-core_js51_UNLICENSED_reference-only.js` | js51 CPU 对象 + SFR 注册表 + 监听器 | https://github.com/Aimini/js51/blob/binary_decoder/51vm_core.js | **无 LICENSE** | ❌ 只读思路 |
| `mnemonic-to-opcode-map_pysim_UNLICENSED_reference-only.py` | 助记符→操作码字典（形如 `'MOVA#':'74'`），可用于**交叉校验你自己的操作码表** | https://github.com/abhi3p/8051-simluator-using-python/blob/master/decoder.py | **无 LICENSE** | ❌ 仅作校验数据（数据本身无独创性，但保守起见别进仓库） |

**⚠️ 重要：STC15 SFR 表本工作区已有，不要重复造**

`research/stc15f2k60s2-sfr.json` + `research/stc15f2k60s2-memory.md`（由 `research/extract_sfr.py` 从官方手册与头文件交叉生成）**已经是本报告需要的 STC15 SFR/位域权威数据源**，包含 `bit_addressable`、`bit_addr_base`、`reset_value`、`available_on_stc15f2k60s2`、`documented_bit_fields`、`raw_header_mirrors` 等字段。**直接用它作为 §5.3 架构里的 `chip profile`，无需再解析头文件。** 本报告下列数据文件的定位是"**补充/交叉校验**"，不是替代。

**工作区中已存在的、非本次下载但可用的参考**（来源与许可已核实）：
- `research/raw/STC15F2K60S2-cn.pdf` / `.txt`（27MB 官方中文数据手册，SFR 与指令时序的权威依据）。
- `research/raw/intel_MCS-51_Users_Manual_Jan81.pdf`（指令集权威定义）。
- `research/raw/uluo1226-lanqiao-stc15f2k60s2.h` 等 → 来源 https://github.com/uluo1226/51_Lanqiao_2019 ，**该仓库无 LICENSE 文件（已核实 LICENSE/LICENSE.md/LICENSE.txt 均 404）→ 同样只做核对参考**。
- `research/raw/keil_is51_opcodes.html`、`keil_is51_instructions.html`（Keil 指令集/操作码在线文档副本，**版权归 Arm/Keil，仅作查阅，不可再发布**）。

> **许可证使用红线（务必遵守）**
> - **可自由用（含商用/闭源）**：`MentzJ/8051_simulator`（Unlicense）、`at51`（MIT）、`stcgal` 的 MIT 声明、`erikgoe/Sim8051`（Apache-2.0，需留 NOTICE）。
> - **GPL-3.0 传染，禁止拷进你的产品**：`mikeakohn/naken_asm`。
> - **无许可证 = 全保留，禁止拷贝代码**：`Aimini/js51`、`rodeo74/8051-Web-Emulator`、`antboard/js-for-simulation8051`、`abhi3p/8051-simluator-using-python`、`Vartan/JS51`、`znhocn/stc-header`、`uluo1226/51_Lanqiao_2019`、`TecCheck/vscode-8051-assembly`。
> - **闭源免费软件（连代码都看不到）**：EdSim51。

---

## 4. STC15 专题：有没有现成的 STC15 专用 Web 模拟器？差异会不会成为障碍？

### 4.1 结论：**没有。**

已用中英文多轮检索（`STC15F2K60S2 simulator`、`STC15 web 仿真 网页 模拟器`、GitHub topic `stc-mcu` / `8051-microcontroller`、DuckDuckGo HTML 检索、crates.io / npm / PyPI 全量搜索）：

- GitHub topic `stc-mcu` 下全部是 **ISP 下载器、SDCC 头文件、外设库、例程**（stcgal / stc8prog / FwLib_STC8 / STC15lib / uni-STC 等），**没有任何模拟器**。
- crates.io 上 8051 相关的只有 `i8051`（标准 MCS-51，无 STC 扩展）、`at51`（逆向）、`stcbsl`（STC89 引导下载）。
- npm 上 `8051asm` **不是汇编器**，只是 Atom 编辑器的语法高亮插件。
- 现有的 Web 8051 模拟器（本报告全部 19 个）**没有一个带 STC SFR**。

### 4.2 STC15F2K60S2 vs 标准 8051：差异清单与影响评估

**好消息（决定了工作量上限）：STC15F2K60S2 的指令集 = 标准 MCS-51，没有 STC 私有扩展指令**。它是"1 个时钟/机器周期"的 1T 内核（数据手册原文："1个时钟/机器周期8051"），即**时序更快，但指令编码不变**。因此：

| 差异点 | 具体内容 | 对你的影响 | 难度 |
|---|---|---|---|
| **SFR 扩展（最大工作量）** | 标准外新增 `P4(0xC0) P5(0xC8)`、`AUXR(0x8E) AUXR1(0xA2)`、`CLK_DIV(0x97)`、`P4M0/P4M1/P5M0/P5M1`、`P1ASF(0x9D)`、`AUXR`、`IE2(0xAF) IP2(0xB5)`、`INT_CLKO(0x8F)`、`T2H(0xD6)/T2L(0xD7)/T4T3M(0xD1)`、`WKTCL(0xAA)/WKTCH(0xAB)`、`S2CON(0x9A)/S2BUF(0x9B)`、`ADC_CONTR(0xBC)/ADC_RES(0xBD)/ADC_RESL(0xBE)` 等，共 **103 个 SFR** | 只需**扩充一张 SFR 地址→名称/复位值/可位寻址标志的表**；内核的 `direct` 寻址逻辑无需改动。**建议做成可插拔的"芯片型号 profile"**，为以后加 STC8/STC12 留口 | 🟢 低（纯数据录入） |
| **位寻址扩展** | P4/P5、IE2 等新增可位寻址 SFR 及其位名（如 `P40`、`ELVD`） | 汇编器的 SFR 符号表 + 位地址计算表加条目即可 | 🟢 低 |
| **时序（1T vs 12T）** | STC15 多数指令 1 个时钟/机器周期（可选 12T 兼容模式） | 若只做"逐条单步 + 周期计数展示"，**用标准 8051 周期数也能工作**，但要如实展示 STC15 的周期请在操作码表里换成 STC 的周期列（数据手册有指令周期表）。**建议：初期先用标准周期数并在 UI 标注"周期数为标准 8051 参考值"，第二步再换 STC15 表** | 🟡 中（换一张周期列） |
| **XRAM 在主片内** | STC15F2K60S2 有 **2KB 片内扩展 RAM（AUX-RAM）**，通过 `MOVX @DPTR/@Ri` 访问，需 `AUXR` 的 `EXTRAM` 位区分片内/片外 | XRAM 视图建议显示"片内 2KB + 片外 64KB"两段，并标注 `EXTRAM` 状态。**注意：2KB 片内 AUX-RAM 不能像 64KB 那样一次全画，用窗口分页** | 🟡 中 |
| **新增外设** | 双串口（S2CON/S2BUF）、PCA/CCP、增强型 ADC、看门狗、掉电唤醒定时器、T2/T3/T4 | 属于"第二阶段外设仿真"；**首版可以先只做 SFR 寄存器可视化（能读写、能看值），不仿真行为** | 🟡 中（可延后） |
| **程序下载/ISP** | STC 专有 ISP 协议（P3.0/P3.1） | **与"模拟器"无关，完全不用做** | 🟢 无 |

**结论：差异不构成障碍。** 标准 8051 内核必须自建（或有许可证地复用 Unlicense/MIT 的实现），STC15 的差异化工作**集中在数据表（SFR/位名/周期表）与 XRAM 视图**，不需要重写解码器或 CPU 内核。

---

## 5. 最终建议：**fork `MentzJ/8051_simulator` 魔改，而不是纯自研**

### 5.1 为什么不是"完全自研"

- 从零写一个 8051 内核 + 两遍汇编器 + 单步 UI，**参考实现已经存在且是公有领域（Unlicense）**，自研等于把 2–3 周工作重复一遍。
- 你需求里最难的三件事——**① 汇编器 Pass2 产出 `sourceMap` 实现"地址 gutter + PC 行高亮"**、**② 内存变动差量高亮（dirty diff + CSS 脉冲）**、**③ 运行时不卡 UI（Web Worker 批量执行 + 状态快照）**——MentzJ 都已经做对了，而且是在 TypeScript 里做对的，可以直接改。

### 5.2 为什么不是"直接原样用"

- 它是**标准 8051**，没有 STC15 的 103 个 SFR、没有 2KB 片内 AUXR-RAM、没有 1T 周期表 → 必须做 §4.2 的改造。
- 界面是**英文 + 暗色 IDE 风**，你要**中文界面**，需要全量替换文案（组件内字符串很集中，改起来不难）。
- 它的 `package.json` 写 MIT 而 `LICENSE` 是 Unlicense，**fork 时要在 README/NOTICE 里说明来源**，并保留 Unlicense 原文，避免歧义。
- 未实现的点（README 的 roadmap 明确列出）：**Intel HEX 导入、断点、执行 trace/波形、外部中断 INT0/INT1** —— 其中"断点"和"HEX 导入"建议你自己补。

### 5.3 推荐架构（在你的产品里落地）

```text
┌─ UI 层（你自己的中文界面，可参考 RamGrid/RegisterDashboard/CodeEditor 的交互）
│   ├─ CodeEditor：源码 + gutter 显示"行号 + ROM 地址" + 当前 PC 行高亮 + 错误行标红
│   ├─ RegisterDashboard：PC/SP/DPTR/PSW/ACC/B/R0-R7（HEX/DEC/BIN 三态）+ 变动高亮 + PSW 标志徽标
│   ├─ MemoryView：IRAM 256B（16×16，含位寻址区/寄存器组着色、SP 标记）
│   │              XRAM 片内 2KB + 片外 64KB（256B 窗口分页 + 地址跳转 + 悬停 tooltip + 变动高亮）
│   └─ Controls：单步 / 运行 / 暂停 / 复位 / 速度（1Hz·10Hz·Max）
├─ 汇编器（改造自 MentzJ Assembler8051，Unlicense）
│   └─ 输出 { code, sourceMap:[{line,pc}], symbolTable, errors }；**扩充 STC15 SFR/位名符号表**
├─ 解码/执行核心（两种路线二选一）
│   ├─ 路线 A（推荐）：MentzJ 式 256 项跳转表 table[op]=(cpu)=>{...; return cycles}
│   └─ 路线 B（优化期）：把跳转表升级为"单一指令表"
│        INSTR[op] = { mnemonic, len, cycles, operandMode, exec }
│        → 执行、反汇编显示、指令长度、周期统计**同源**，避免 MentzJ(执行用表)+rodeo74(显示用表) 的割裂
├─ 访存层（借鉴 js51 的 cell 抽象，但仅调试模式启用）
│   └─ getCell(addr) → {get,set}；set 里记录 dirty → UI 变动高亮（比 Worker 脏页集合更简单）
├─ 芯片 profile（STC15 特有，独立数据文件，未来可加 STC8/STC12）
│   ├─ sfr-stc15f2k60s2.ts：{addr, name, reset, bitAddressable, bits:{name:index}} × 103
│   ├─ cycles-stc15.ts：指令周期表（1T）
│   └─ memory-map.ts：2KB AUX-RAM(EXTRAM) + 64KB 片外 XRAM
└─ Worker（运行不卡 UI）+ 状态 diff 快照
```

**许可证自检清单**：保留 `mentzj` 的 Unlicense 原文 + 来源说明；若移植 at51 的 256 项长度表，附上其 MIT LICENSE；**不要**把 js51 / rodeo74 / antboard / pysim / znhocn/stc-header 的代码或文件拷进你的仓库。

### 5.4 分阶段建议

1. **第 1 步（1–3 天）**：fork MentzJ，跑通 `npm i && npm run dev`，确认单步/汇编/内存网格可用；把 UI 文案换中文。
2. **第 2 步（3–5 天）**：建 `chip profile`，录入 STC15F2K60S2 的 SFR 表（用官方数据手册 `STC15F2K60S2-cn.pdf` 为准，`STC15Fxx.h` 仅作交叉核对）；扩展汇编器的 SFR/位名符号表。
3. **第 3 步（3–5 天）**：XRAM 视图改成"片内 2KB + 片外 64KB"两段；加 `AUXR.EXTRAM` 指示。
4. **第 4 步（3–5 天）**：换成 STC15 的 1T 指令周期表；补断点、Intel HEX 导入、执行 trace。
5. **第 5 步（可选）**：加 STC15 外设的面板（LED/数码管/串口终端可参考 MentzJ 的 `PeripheralsPanel.tsx`，端口拟物化可参考 rodeo74 的 LED 样式）。

---

## 6. 全部 URL 清单

**项目仓库**
1. https://github.com/MentzJ/8051_simulator  ← **推荐基底（Unlicense）**
2. https://github.com/Aimini/js51 （无许可证，只读思路）
3. https://github.com/S2Sofficial/8051sim （MIT，在线版 https://8051sim.vercel.app/ ）
4. https://github.com/rodeo74/8051-Web-Emulator （无许可证）
5. https://github.com/erikgoe/Sim8051 （Apache-2.0）
6. https://github.com/mmastrac/i8051 （MIT OR Apache-2.0；crates: i8051 / i8051-disassembler / i8051-debug-tui）
7. https://github.com/8051Enthusiast/at51 （MIT）
8. https://github.com/sid-maddy/8051.js （MIT，已归档）
9. https://github.com/Vartan/JS51 （无许可证）
10. https://github.com/moltate/8051-emulator （MIT）
11. https://github.com/antboard/js-for-simulation8051 （无许可证，中文）
12. https://github.com/abhi3p/8051-simluator-using-python （无许可证）
13. https://github.com/hsrzq/VSCode-ASM8052 （Apache-2.0）
14. https://github.com/TecCheck/vscode-8051-assembly （无许可证，已归档）
15. https://github.com/mikeakohn/naken_asm （**GPL-3.0**，慎用）
16. https://github.com/danish9661/8086emu / https://www.npmjs.com/package/8086emu （MIT）
17. https://github.com/grigorig/stcgal （MIT 声明）
18. https://github.com/znhocn/stc-header （无许可证，STC15 SFR 速查）
19. https://github.com/uluo1226/51_Lanqiao_2019 （无许可证，STC15F2K60S2 例程）
20. https://github.com/CrispStrobe/stcbsl （MIT，STC89 引导协议）
21. https://github.com/A-Dunstan/Sim8051 （无许可证）
22. https://github.com/mgoblin/STC15lib （Apache-2.0，STC15W408AS HAL）

**在线工具 / 文档**
- EdSim51 8051 模拟器（闭源免费）：https://edsim51.com/
- EdSim51 示例文档：https://edsim51.com/wp-content/uploads/2024/09/examples-1.pdf
- Wokwi 支持硬件列表（**不含 8051**）：https://docs.wokwi.com/getting-started/supported-hardware
- GitHub 话题：https://github.com/topics/8051-microcontroller 、https://github.com/topics/stc-mcu
- Keil C51 指令集/操作码在线文档：https://www.keil.com/support/man/docs/is51/is51_instructions.asp
- STC 官方 STC15F2K60S2 概览：https://www.stcmicro.com/cn/stc/stc15f2k60s2.html
- STC15F2K60S2 官方特性 PDF：https://www.stcmicro.com/datasheet/STC15F2K60S2_Features.pdf
- STC15 系列英文数据手册（mikrocontroller.net 镜像）：https://www.mikrocontroller.net/attachment/428781/STC15-English.pdf

**本次使用的 GitHub 页面解析接口**（便于复现）
- 仓库元数据（stars/license/description）：仓库 HTML 页内嵌 JSON（`"stargazerCount"`, `"licenseInfo"`, `"isArchived"`）
- 最后活跃时间：`https://github.com/<owner>/<repo>/commits/<branch>` 页内嵌 `"committedDate":"YYYY-MM-DD..."`
- 源码快照：`https://codeload.github.com/<owner>/<repo>/tar.gz/refs/heads/<branch>`
- 注：GitHub REST API（api.github.com）本次返回 **403 rate limit exceeded（60 次/小时，未认证）**，故改用上述 HTML/codeload 方式，结论等效。
