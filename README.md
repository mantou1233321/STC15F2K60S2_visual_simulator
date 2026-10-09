# STC15F2K60S2 汇编语言可视化模拟器

### STC15F2K60S2 Assembly Visual Simulator

**中文** | [English](#english)

> **AI 声明**：本项目的全部代码、测试与文档均由 **AI 编码代理**生成（人类负责提需求、评审与反馈缺陷）。
> 模拟器**未在实物芯片上对拍验证**，芯片数据中有若干手册冲突项已逐条标注。详见文末 [AI 声明](#ai-声明)。

在浏览器里运行的 8051 / STC15F2K60S2 **指令级**汇编模拟器：写汇编 → 汇编 → **逐条执行**，
实时可视化**指令存放地址**、**内部 RAM / XRAM / SFR / 程序 Flash 每一个格子的数据变动**，
以及 **PC / SP / DPTR / PSW** 等寄存器。零依赖、无构建步骤（原生 JavaScript + HTML + CSS）。

![界面截图](stc15-sim/docs/screenshot.png)

## 功能

**执行控制**

- 单步执行（`F8`）、连续运行/暂停（`F5`，速度 1~5000 条每帧）、运行到光标行（`F10`）、
  复位（`F9`）、跳到程序入口、全片擦除（把 Flash 用户区全部写为 `FFH`，可撤销）

**代码与地址可视化**

- 每条指令的**存放地址**、机器码、反汇编与原始源码同排显示，当前 **PC 所在行高亮**（绿色）
- 60KB 用户程序区按 256 字节分块的占用图，**点击任一块可跳到 Flash 视图对应页**
- 板载说明：`0000H~EFFFH` 用户区、`F000H` 以上 ISP/系统区、复位向量与中断向量位置

**存储器逐格可视化**（四张视图）

| 视图 | 规模 | 说明 |
|---|---|---|
| 内部 RAM | 256 字节（16×16） | 工作寄存器区 / 位寻址区 / 用户区 / 间接寻址区着色区分 |
| 片内 XRAM | 1792 字节（28×64） | `MOVX` 访问的 AUX-RAM |
| SFR 区 | 128 个寄存器 | 显示寄存器名与值，位可寻址者给出位地址与逐位当前值 |
| 程序 Flash | 61440 字节（分页 256B/页，共 240 页） | 已编程/擦除态（`FFH`）区分，数据表（`DB`）另行着色 |

- **悬停即得**：格子绝对地址、所属区域、位地址范围、十六/十/二进制、ASCII、
  **最近一次被写入的步数与新旧值**
- **变动可视化**：绿框=本步刚写入、橙点=相对装入时已变化、黄框=SP 指向、
  蓝框=当前寄存器组、紫框=DPTR 指向
- **十六进制 / 十进制一键切换**（四张视图联动，选择会被记住）

**汇编器**

- 标准 MCS-51 全部 **255 个操作码 / 111 条指令**（STC15F2K60S2 与其指令码完全兼容）
- 伪指令：`ORG` `END` `EQU` `=` `DATA` `BIT` `DB` `DW` `DS` `CSEG AT`
- 表达式：`+ - * / MOD SHL SHR AND OR XOR NOT HIGH LOW`、`$`（当前地址）、`'A'` 字符常量
- 寻址：立即数、直接地址 / SFR 名、`R0~R7`、`@R0` `@R1` `@DPTR`、`@A+DPTR` `@A+PC`、
  位地址 `P1.0` `PSW.7` `CY` `20H.3`

**面向教学的错误提示**（都能给出可照抄的正确写法）

- 未定义符号 → 附「标号写在 `END` 之后（第 N 行）」「是不是想写 `PTDS`？」
- `MOV 0AAH,A` → 提示直接寻址 `80H~FFH` 其实是 SFR，并给出间接寻址写法
- `MOVC A,@DPTR` / `MOVX A,@A+DPTR` / `MOV @R2,A` → 指出正确写法
- 程序从 `0030H` 开始但 `0000H` 没有跳转 → 提示真机复位从 `0000H` 取指
- 每个按钮都有异常保护：内部异常会显示为红色「内部错误」，不会静默失败

**界面**

- 编辑器行号栏（与正文严格对齐、光标所在行高亮）
- 上面三栏等高对齐；编辑器与代码清单都有高度上限与横纵滚动条
- 深灰主题 + 深色滚动条；网页全屏（`Ctrl+Shift+F`）

## 快速开始

```bash
# 方式 1（推荐）：双击启动脚本，自动打开浏览器
stc15-sim/启动模拟器.cmd

# 方式 2：命令行起静态服务器
node stc15-sim/serve.mjs 8099     # 打开 http://127.0.0.1:8099/

# 方式 3：直接双击 stc15-sim/index.html（脚本都是经典 <script>，不需要服务器）
```

默认载入的是演示程序（内部 RAM 求和 + 位操作 + 子程序调用），点「单步执行」或按 `F8` 即可开始。

**详细文档（中文）**：[`stc15-sim/README.md`](stc15-sim/README.md) —— 汇编语法细节、模拟器实现口径、
常见坑、验证方式与已知限制。

## 仓库内容

| 路径 | 说明 |
|---|---|
| `stc15-sim/` | 模拟器本体：指令表 / 汇编器 / CPU 内核 / SFR 数据 / 界面 / 测试 / 工具 |
| `stc15-sim/docs/` | 界面截图 |
| `research/*.json` | 芯片与指令集数据：SFR 与位地址表、256 条指令表（长度、机器周期） |
| `research/*.md` | 调研与出处：存储器映射、SFR 核对记录、19 个现成 8051 Web 模拟器调研 |
| `research/*.py` | 从官方手册与头文件生成上述数据的可复现脚本 |
| `同步到GitHub.cmd` | 一键暂存 / 提交 / 推送本工作区 |

## 不在仓库里的东西（有意排除）

- `research/raw/`、`research/parsed/`：STC 官方手册 PDF（26MB）、Intel 8086/MCS-51 手册（82MB）、
  以及 19 个开源项目的源码快照 —— 其中部分项目**无许可证**或为 **GPL**，**禁止再分发**，
  只作本地核对用。它们的出处与用途记录在 `research/*.md` 中，可据此自行获取。
- 浏览器测试截图与 DOM dump（可由 `stc15-sim/test/run-ui-test.cmd` 随时重新生成）。

## 芯片数据从哪来（可复现）

1. `research/stc15f2k60s2-sfr.json` —— 由 `research/extract_sfr.py` 从 STC 官方手册 +
   三处 GitHub 头文件镜像交叉核对生成（98 个 sfr / 108 个 sbit，含位地址、复位值、位域）。
2. `research/8051-opcodes.json` —— 由 `research/parse_*.py`、`build_final.py` 等脚本从
   Keil / Actel Core8051 / Atmel 4316E / Intel MCS-51 手册等 **7 个来源**交叉比对生成
   （256 条操作码的长度与机器周期）。
3. `stc15-sim/js/sfr-data.js` —— 由 `node stc15-sim/tools/gen-sfr-data.mjs` 从第 1 步的 JSON
   自动生成，**不要手改**。

## 测试

```bash
node stc15-sim/test/run-tests.mjs             # 54 项：汇编编码 + 指令语义 + 综合程序
node stc15-sim/test/cross-check-opcodes.mjs   # 与外部权威指令表逐条比对（长度/周期/助记符）
```

浏览器集成自测：先启动 `serve.mjs`，再打开 `http://127.0.0.1:8099/test/ui-selftest.html`
（153 项，覆盖渲染、单步、内存可视化、滚动条、Flash 视图、异常路径等）。

其中交叉校验结果：**长度 256/256、机器周期 256/256、助记符 256/256 全部一致（0 处差异）**。

## 已知限制

- **不模拟外设**：定时器 / 串口 / ADC / PCA / 看门狗 / 中断响应 / EEPROM(IAP) 只显示寄存器数值，
  不产生硬件动作；`RETI` 按 `RET` 处理。模拟器聚焦「指令集 + 存储器 + 寄存器」本身。
- **周期数**按标准 8051 机器周期（12 时钟）统计，未换算成 STC15 的 1T 时钟数。
- 不支持 `$INCLUDE`、宏、条件汇编、多模块链接，也不支持 Intel HEX 导入导出。

## AI 声明

**本项目的全部代码、测试与文档均由 AI 编码代理生成**（模型：DeepSeek Harness 的 deepseek-flash 代理），
由人类提出需求、审查结果，并根据实际使用中的问题推动迭代。具体说明：

1. **代码**：模拟器内核、汇编器、Web 界面、测试脚本与文档均为 AI 编写。人类负责需求设定与验收，
   并贡献了多条关键缺陷报告 —— 例如「只写标号、不写指令的行被判为非法指令」的汇编器缺陷、
   「点载入既不报错也没反应」的异常链（内部状态索引失效导致点击处理器中途抛异常）、
   源码列被省略号截断等问题，都是人类实测发现后修复的。
2. **芯片数据**：SFR 表、位地址表与 256 条指令表由 AI 从**公开资料**整理 ——
   STC 官方手册（含页码/行号记录）、多家 GitHub 头文件镜像、Keil / Actel Core8051 /
   Atmel 4316E / Intel MCS-51 手册等，并做了**脚本化交叉校验**（见上文「测试」）。
3. **未在真实硬件上验证**：指令语义与寄存器行为依据文档与参考表实现，由自动化测试覆盖，
   **没有在实物 STC15F2K60S2 上对拍**。手册中仍有若干冲突或未证实项
   （如 IE2 位分配、PSW 复位值、XRAM 片内/片外分界 `0700H`、用户区最后 14 字节归属），
   已在 `research/stc15f2k60s2-memory.md` 中逐条标注为"未证实"。若用于课程作业、产品设计或
   硬件调试，请以官方手册与实物测试为准。
4. **外设有意未实现**（见「已知限制」）。
5. **AI 也下载了第三方资料**用于核对，其中含无许可证或 GPL 项目，**均未入库**（见 `.gitignore`）。
6. **不提供任何担保**：本项目按「现状」提供，作者与 AI 均不对使用后果负责。

## 许可证

**尚未指定**。若打算公开使用，建议补一个 `LICENSE`（MIT / Apache-2.0 / GPL-3.0 均可），
并把 `stc15-sim/package.json` 的 `license` 字段对齐。

---

## English

**English** | [中文](#stc15f2k60s2-汇编语言可视化模拟器)

> **AI disclosure**: every line of code, every test and this documentation were generated by an
> **AI coding agent** (the deepseek-flash agent of DeepSeek Harness), steered by a human who set the
> requirements, reviewed the results and reported bugs. The simulator has **not been validated
> against physical silicon**, and several manual conflicts are explicitly flagged as unverified.
> See the full [AI disclosure](#ai-disclosure) below.

A browser-based, **instruction-level** simulator for the 8051 / STC15F2K60S2 microcontroller:
write assembly → assemble → **step through it instruction by instruction**, with live visualization of
where each instruction lives, of **every byte of internal RAM / XRAM / SFR / program Flash**, and of the
**PC / SP / DPTR / PSW** registers. Zero dependencies, no build step (vanilla JavaScript + HTML + CSS).

![Screenshot](stc15-sim/docs/screenshot.png)

## Features

**Execution control**

- Step (`F8`), run/pause (`F5`, 1–5000 instructions per frame), run-to-cursor (`F10`),
  reset (`F9`), jump-to-entry, and a chip-erase that overwrites the whole user Flash area with `FFH` (undoable)

**Code and address visualization**

- Each instruction is listed with its **storage address**, machine code, disassembly and the original
  source line; the row containing the **PC is highlighted**
- A 60 KB code-space occupancy map in 256-byte blocks — **click any block to jump to that Flash page**
- Built-in notes on the memory map: user area `0000H~EFFFH`, ISP/system area above `F000H`,
  reset vector and interrupt vector locations

**Byte-level memory visualization** (four views)

| View | Size | Notes |
|---|---|---|
| Internal RAM | 256 bytes (16×16) | register banks / bit-addressable area / user area / indirect-only area are tinted |
| On-chip XRAM | 1792 bytes (28×64) | AUX-RAM accessed by `MOVX` |
| SFR space | 128 registers | names + values; bit-addressable ones show bit addresses and per-bit values |
| Program Flash | 61440 bytes (paged, 256 B/page, 240 pages) | programmed vs. erased (`FFH`), data tables (`DB`) tinted differently |

- **Hover any cell** for its absolute address, memory region, bit-address range, hex/dec/binary,
  ASCII, and the **step number plus old→new value of the most recent write**
- **Change visualization**: green = written by the current step, orange dot = changed since load,
  yellow = SP, blue = current register bank, purple = DPTR
- **Hex/decimal display toggle** that applies to all four views and is remembered

**Assembler**

- All **255 opcodes / 111 instructions** of the standard MCS-51 set (STC15F2K60S2 is opcode-compatible)
- Directives: `ORG` `END` `EQU` `=` `DATA` `BIT` `DB` `DW` `DS` `CSEG AT`
- Expressions: `+ - * / MOD SHL SHR AND OR XOR NOT HIGH LOW`, `$`, `'A'`
- Addressing modes: immediate, direct / SFR names, `R0~R7`, `@R0` `@R1` `@DPTR`, `@A+DPTR` `@A+PC`,
  bit addresses (`P1.0`, `PSW.7`, `CY`, `20H.3`)

**Teaching-oriented diagnostics** — each one tells you the correct form to copy

- Undefined symbol → "that label is defined on line N, but *after* `END`", or "did you mean `PTDS`?"
- `MOV 0AAH,A` → explains that direct addresses `80H~FFH` are SFRs, and shows the indirect form
- `MOVC A,@DPTR`, `MOVX A,@A+DPTR`, `MOV @R2,A` → points out the legal syntax
- Program starting at `0030H` without a jump at `0000H` → explains that a real chip fetches from `0000H`
- Every button is wrapped in exception handling, so an internal error is shown in red instead of
  silently doing nothing

## Quick start

```bash
# Option 1 (recommended on Windows): double-click the launcher, the browser opens automatically
stc15-sim/启动模拟器.cmd

# Option 2: serve the folder and open the URL
node stc15-sim/serve.mjs 8099      # then open http://127.0.0.1:8099/

# Option 3: just open stc15-sim/index.html directly (plain <script> tags, no server needed)
```

A demo program is loaded by default; press `F8` to start stepping.

## Repository layout

| Path | Contents |
|---|---|
| `stc15-sim/` | The simulator: instruction table / assembler / CPU core / SFR data / UI / tests / tools |
| `stc15-sim/docs/` | Screenshots |
| `research/*.json` | Chip and instruction-set data: SFR + bit-address table, 256-entry opcode table (length, machine cycles) |
| `research/*.md` | Research notes and provenance: memory map, SFR cross-check record, survey of 19 existing 8051 web simulators |
| `research/*.py` | Reproducible scripts that derive the data above from the official manual and header mirrors |

## What is deliberately **not** in this repository

- `research/raw/` and `research/parsed/`: the STC official manual (26 MB), Intel 8086 / MCS-51 manuals (82 MB)
  and source snapshots of 19 open-source projects — several of which are **unlicensed or GPL** and therefore
  **must not be redistributed**. They were used locally for cross-checking only; their sources and purpose are
  documented in `research/*.md` so they can be re-fetched.
- Browser test screenshots and DOM dumps (regenerate with `stc15-sim/test/run-ui-test.cmd`).

## Where the chip data comes from (reproducible)

1. `research/stc15f2k60s2-sfr.json` — produced by `research/extract_sfr.py` from the STC official manual plus
   three GitHub header mirrors (98 SFRs / 108 sbits, with bit addresses, reset values and bit fields).
2. `research/8051-opcodes.json` — produced by `research/parse_*.py` and `build_final.py` by cross-checking
   **7 independent sources** (Keil, Actel Core8051, Atmel 4316E, Intel MCS-51 manuals, …) for all 256 opcodes.
3. `stc15-sim/js/sfr-data.js` — generated by `node stc15-sim/tools/gen-sfr-data.mjs` from step 1. **Do not edit by hand.**

## Tests

```bash
node stc15-sim/test/run-tests.mjs             # 54 checks: assembler encoding, instruction semantics, whole programs
node stc15-sim/test/cross-check-opcodes.mjs   # diff against external authoritative tables
```

Browser integration suite: start `serve.mjs`, then open
`http://127.0.0.1:8099/test/ui-selftest.html` (153 checks: rendering, stepping, memory visualization,
scrollbars, Flash view, error paths, …).

Cross-check result: **lengths 256/256, machine cycles 256/256, mnemonics 256/256 — zero differences.**

## Known limitations

- **No peripheral emulation**: timers, UART, ADC, PCA, watchdog, interrupt dispatch and EEPROM/IAP only show
  register values; they produce no hardware behaviour, and `RETI` is treated as `RET`. The focus is
  deliberately "instruction set + memory + registers".
- **Cycle counts** are standard 8051 machine cycles (12 clocks), not STC15's 1T clock counts.
- No `$INCLUDE`, macros, conditional assembly, multi-module linking, or Intel HEX import/export.

## AI disclosure

**All code, tests and documentation in this project were generated by an AI coding agent**
(the deepseek-flash agent of DeepSeek Harness), driven by a human who set the requirements, reviewed the
results and pushed iterations based on real-world use. Specifically:

1. **Code**: the CPU core, assembler, web UI, test suites and documentation were written by the AI.
   The human set requirements and acceptance criteria, and contributed several critical bug reports —
   e.g. a label-only line (`CZX:`) being rejected as an illegal instruction, a "clicking *assemble* does
   nothing and reports nothing" exception chain (a stale index made the click handler throw halfway),
   and source-column text being truncated with an ellipsis.
2. **Chip data**: the SFR table, bit-address table and 256-entry opcode table were compiled by the AI from
   **public sources** (STC official manual with page/line references, several GitHub header mirrors, and
   Keil / Actel Core8051 / Atmel 4316E / Intel MCS-51 manuals) and then **cross-checked by scripts**.
3. **Not validated on real hardware**: instruction semantics and register behaviour follow the documentation
   and reference tables and are covered by automated tests, but were **never compared against a physical
   STC15F2K60S2**. Several manual conflicts remain (IE2 bit layout, PSW reset value, the `0700H`
   on-chip/off-chip XRAM boundary, ownership of the last 14 bytes of the user area) and are explicitly marked
   as unverified in `research/stc15f2k60s2-memory.md`. For coursework, product design or hardware debugging,
   trust the official manual and real measurements instead.
4. **Peripherals are intentionally not implemented** (see "Known limitations").
5. **The AI also downloaded third-party material** for cross-checking; anything unlicensed or GPL is
   excluded from this repository (see `.gitignore`).
6. **No warranty**: this project is provided "as is", without any guarantee of correctness or fitness.

## License

**Not chosen yet.** If you intend to publish or reuse this, add a `LICENSE` (MIT / Apache-2.0 / GPL-3.0)
and align the `license` field in `stc15-sim/package.json`.
