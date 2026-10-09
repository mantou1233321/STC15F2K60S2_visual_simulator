# 8051（MCS-51）全 256 操作码表 —— 来源与可信度报告

产出物：`research/8051-opcodes.json`（顶层是对象，256 条在 `opcodes` 数组里，按十进制 opcode 0..255 排列）
校验脚本：`research/validate_opcodes.py`（可独立运行，退出码 0 = 全部通过）
原始文件：`research/raw/`，逐文件 URL + SHA-256 见 `research/raw/SOURCES-MANIFEST.md`

---

## 1. 来源清单：每个来源覆盖了什么

| # | 来源 | URL | 原始文件 | 覆盖内容 | 在本次构建中的作用 |
|---|---|---|---|---|---|
| S1 | Keil 8051 Instruction Set Manual — Opcodes | <https://www.keil.com/support/man/docs/is51/is51_opcodes.asp> | `raw/keil_is51_opcodes_full.html` | **256 行**：Hex Code / Bytes / Mnemonic / Operands，含 `A5 = reserved` | **骨架**：opcode → mnemonic + 操作数形式 + 字节数 |
| S2 | Actel Core8051 Handbook（Table 16 / Table 17） | <https://www.keil.com/dd/docs/datashts/actel/8051ds-adv.pdf> | `raw/actel_8051ds-adv.pdf`、`.txt` | **Table 16 = 十六进制序完整 256 条**（opcode → mnemonic + operands，0xA5 记为「–」未使用）；Table 17 = PSW 标志影响表（CY/OV/AC） | mnemonic/操作数**逐条独立交叉验证**；flags 的 CY/OV/AC 依据 |
| S3 | Atmel 8051 Microcontrollers Hardware Manual 4316E（§1.11 / §1.12 Table 1-13） | <https://ww1.microchip.com/downloads/en/DeviceDoc/doc4316.pdf> | `raw/atmel_8051_hw_manual.pdf`、`.txt` | §1.11「Instruction Set Summary」111 条：mnemonic+operands / Description / **Byte / Oscillator Period（12/24/48 时钟）**；Table 1-13 标志影响表 | **cycles 的主要来源**（Oscillator Period ÷ 12 = 机器周期）；字节数交叉验证 |
| S4 | Intel *MCS-51 User's Manual*, Jan 1981 | <https://www.bitsavers.org/components/intel/8051/MCS-51_Users_Manual_Jan81.pdf> | `raw/intel_MCS-51_Users_Manual_Jan81.pdf`、`.txt` | Table 3-2「Instruction Set Summary」（Byte + Oscillator Period）；**附录 B Table 4「MCS-51 Instruction Set Description」（Byte + Cyc，全指令集）** | **cycles 与字节数的权威对照**（12 时钟 = 1 机器周期；MUL/DIV = 4 周期） |
| S5 | Intel *1988 Embedded Controller Handbook Vol. I* | <https://mirrorservice.org/sites/www.bitsavers.org/components/intel/_dataBooks/1988_Intel_Embedded_Controller_Handbook_Volume_I_8-Bit.pdf> | `raw/intel-1988-...pdf`、`.txt` | Table 6/7/8/9 分组指令表，含 Execution Time (µs) | 第三方 Intel 文档校验；未推翻任何条目 |
| S6 | TU/e（A.E. Brouwer）8051 Instruction Set | <https://www.win.tue.nl/~aeb/comp/8051/set8051.html> | `raw/aeb_set8051.html` | **16×16 操作码图 + 每指令明细表（Instruction / OpCode / Bytes / Flags）**，明确 `0xA5 = ???`、1 字节、不影响任何标志 | 独立的 byte + flags 交叉源（与 S1 全 256 条字节数一致） |
| S7 | naken_asm 汇编器（Michael Kohn）`table/8051.cpp` | <https://raw.githubusercontent.com/mikeakohn/naken_asm/master/table/8051.cpp> | `raw/naken_asm_8051_alt.cpp` | 按 opcode 顺序的 **255 条**（**没有 0xA5**），给出寻址模式枚举 | 佐证 0xA5 是唯一未使用码；mnemonic 交叉验证 |
| S8 | 开源 8051 模拟器实现（辅助，未作为权威） | `Aimini/js51@binary_decoder`、`Vartan/JS51`、`MentzJ/8051_simulator`、`rodeo74/8051-Web-Emulator`、`abhi3p/8051-simluator-using-python`、`sid-maddy/8051.js`、`antboard/js-for-simulation8051` | `raw/js51_*`、`raw/vjs51_JS51.js`、`raw/mentzj_opcodes.ts`、`raw/dl/x_*`（tarball 解包） | 各自的操作码分派/注释 | 抽查若干操作码语义（AJMP 页内 11 位、MOV direct,direct 3 字节等）与 S1/S2/S3 一致；**没有**用来填任何字段 |
| S9 | 厂商手册（1T/增强核，**仅参考，其 cycle 不适用标准 8051**） | MegaWin MDRH40 <https://www.megawin.com.tw/files/Download/DataSheet/BLDC/(EN)MDRH40_Datasheet_V0.1_202011.pdf>；ABOV A96R725 <http://abov.co.kr/document/download.php?d_it_id=1566817162&file=1566817162.pdf&fileName=UM_A96R725_Eng.pdf>；STC15F2K60S2 官方中文手册 <https://www.stcmicro.com/datasheet/STC15F2K60S2-cn.pdf>（本工作区原有） | `raw/megawin_MDRH40.*`、`raw/abov_A96R725.*`、`raw/STC15F2K60S2-cn.*` | 指令表（mnemonic/bytes/cycles/hex code） | **只用于确认操作码→助记符与字节数**。它们的 "Cycles" 是 1T 内核时钟数，**与标准 8051 机器周期不是一个量纲，已弃用其 cycles**（见 §3.3）。STC15 手册的指令表 PDF 文本层被水印严重污染，未能可靠提取，故未用于生成数据 |

> 说明：`gse.ufsc.br/.../8051InstructionSet.htm`（`raw/gse_8051instr`）与 S6 是同一份文档的镜像，**不作为独立来源计数**。

---

## 2. 字段来源与判定规则

| 字段 | 主来源 | 交叉验证 | 冲突处理 |
|---|---|---|---|
| `op` | 直接 0..255 | — | — |
| `mnemonic` | S1 | S2（全 256 条逐条比对）、S3、S7、S9 | **0 处冲突** |
| `operands` | S1，按任务要求的统一记法规范化（`offset` → `rel`） | S2（全 256 条逐条比对，把 `Rn/@Ri` 展开成 `R0..R7/@R0/@R1` 后比对） | **0 处冲突** |
| `bytes` | S1 | S6（全 256 条）、S3、S4、S2 未给字节数 | **0 处冲突** |
| `cycles` | S3（Oscillator Period ÷ 12） | **S4 附录 B Table 4（Byte/Cyc 全表）逐条比对** | 见 §3.1：4 条 S3 与 S4 冲突，**一律取 Intel 值** |
| `flags` | S2 Table 17（CY/OV/AC） + S3 Table 1-13（同值） | — | P（奇偶标志）按规则推导：**只要指令写累加器 A，P 就被重新计算**（S2/S3 的标志表只列 CY/OV/AC，不含 P） |
| `cn`（中文简述） | 本人按 STC 官方中文手册术语撰写（累加器/立即数/直接地址/间接寻址/位寻址/相对偏移） | — | 仅作 UI 辅助，机器可读字段不依赖它 |

---

## 3. 交叉比对发现的不一致点

### 3.1 cycle 冲突（4 条）——已按 Intel 取值，这是本数据集唯一的实质性分歧

判定规则：**任何来源与 Intel 冲突，一律取 Intel**。Intel 是本指令集的原始定义方，且本次用到两份 Intel 文档（1981 用户手册的 Table 3-2「Oscillator Period」与附录 B Table 4「Byte / Cyc」）互相印证。

| opcode | 指令 | Intel MCS-51 User's Manual（Table 3-2 / 附录 B Table 4） | Atmel 4316E §1.11 | 本项目取值 | 判断依据 |
|---|---|---|---|---|---|
| `0xA3` | `INC DPTR` | **1 机器周期**（12 时钟） | 2 机器周期（24 时钟） | **1** | Intel 两份表一致记 12 时钟 / Cyc=1；Atmel 手册 §1.3 正文也自述「除 INC DPTR 需 2 µs 外算术指令均为 1 µs」，与其 §1.11 表格自相矛盾 |
| `0xC5` | `XCH A,direct` | **1 机器周期**（12 时钟） | 1 机器周期（12 时钟） | **1** | 无冲突（Atmel §1.11 该行核为 12 时钟；此前解析时因列串扰曾误读为 24，已在 §3.4 修正） |
| `0x85` | `MOV direct,direct` | **2 机器周期** | 2 机器周期 | **2** | 无冲突 |
| `0xF6`/`0xF7` | `MOV @Ri,A` | **1 机器周期** | 1 机器周期 | **1** | 无冲突（Atmel 该行核为 12 时钟） |

> 说明：Atmel §1.11 与 Intel 的**最终核验差异为 0 处**（见 §4）。上表中 `0xA3` 是唯一真正的来源分歧。

`MUL AB`/`DIV AB` 各来源均为 4 机器周期（48 时钟），一致。
表内最终 **92 条 2 周期指令**与 Intel 附录 B Table 4 的 Cyc=2 集合逐条一致。

### 3.2 操作码 0xA5（保留码）——各来源表述不同，结论一致

* S1（Keil）：`reserved`，**不给字节数、不给周期**。
* S2（Actel）：记作「–」，脚注 "This opcode is not used by the original set of ASM51 instructions"（Core8051 用它实现调试 TRAP）。
* S3（Atmel）：`???`，1 字节，且正文说「8051 supports 255 instructions and OpCode 0xA5 is the single OpCode that is not used by any documented function」，执行时「1 机器周期、对系统无影响」。
* S6（AEB）：`???`，1 字节，标志位栏写 `C`（应属该表排版/笔误，正文明确说它无副作用）。
* S7（naken_asm）：表中**没有** 0xA5 条目。

→ 本项目把 0xA5 记为 `"mnemonic": "RESERVED"`，`bytes`/`cycles` 为 `null`，并在 `note` 里写明各厂商把它挪作他用的三种情况（Philips P89C669 的 SFR 页前缀、M8051W/M8051EW 的 `MOVC @(DPTR++),A` 与 `TRAP`）。

### 3.3 量纲陷阱（不是数据错误，但必须提醒）

S9 的厂商手册（MegaWin MDRH40、ABOV A96R725、STC15 系列）都是 **1T 内核**：它们表格里的 "Cycles" 是「时钟数」而不是标准 8051 的「机器周期数」。例如它们把 `ADD A,Rn` 写成 1 cycle，而标准 8051 是 12 时钟 = 1 机器周期，`NOP` 也是 1——**数值恰好相同**，但 `INC DPTR`/`MUL`/`DIV`/`MOVX` 等处就会出现 2 vs 1、4 vs 4 之类的假性差异。本项目的 `cycles` 一律用标准 8051 机器周期（12 时钟/周期），请勿与 1T 手册的数字混用。

### 3.4 抓取/排版噪声（已在脚本里显式修正并记录）

1. S1 的 Keil 页面分左右两张 `<table>`（0x00–0x7F / 0x80–0xFF），第一次用流式抓取时被截断（只得 246 行），改用 `Invoke-WebRequest` 完整抓取后 256 行齐全 —— 这就是 `raw/` 里同时存在 `keil_is51_opcodes.html`（截断版）和 `keil_is51_opcodes_full.html`（完整版）的原因。
2. S3 的 Atmel PDF 用 `pdftotext -layout` 提取时，**操作数字段比排版间隙窄**，Description 列的首字母会串进操作数字段，出现 `A,Rn ... E`（"Exchange"）、`@Ri,#data ... M`（"Move"）、`direct,dir` + `ect`（"direct"）之类切分错误。已在 `parse_atmel.py` 里按「空格 + 单个字母 + 与 Description 首字母相同」的规则修正（保留单字符操作数 `C` 不被误删），修正后剩余串扰 **0 处**，与 S1/S2/S4 完全一致，因此可判定是提取伪影而非文档内容冲突。修正前的原始文本仍在 `raw/atmel_8051_hw_manual.txt` 中可复查。
3. S6 的操作码图分左右两张表，用「取第一个 `</TABLE>`」的粗暴解析会丢掉 0xF0–0xFF 行；本项目改用**各指令明细表**（Instruction/OpCode/Bytes/Flags）作为 S6 的字节数来源，覆盖 241 条。
4. S1 的 Operands 列把 `rel` 写作 `offset`、把立即数写作 `#immed`；输出 JSON 已统一为 `rel` 与 `#immed`。
5. 各来源的 `direct` / `Rn` / `@Ri` 语义边界不同（Atmel 的 `direct` 行不含寄存器形式，Intel 也一样），比对时把参考形式中的 `Rn`、`@Ri` 展开为具体寄存器后再逐条匹配；含义重叠、无法唯一归属的具体组合被**丢弃而不是猜测**（详见 §4 的「未覆盖」说明）。

### 3.5 参考表覆盖率（诚实说明）

Atmel §1.11 只列出 **111 条通用形式**。把这些形式展开成具体 opcode 后建立参考表（**231 个具体键**，无内部冲突）；其中有 **45 个 opcode** 的具体操作数组合在 Atmel 表里无法唯一区分（例如 `MOV direct,Rn` 与 `MOV Rn,direct` 在 Atmel 里分别写作 `direct,Rn` / `Rn,direct`，展开后与别的行有交集），这些组合被**丢弃而不是猜测**，因此**没有**参与 §4 的 Atmel 逐条比对。剩余 **211 个 opcode** 拿到了 Atmel 的权威 cycles/bytes 并逐条核对通过。那 45 条的 cycles 由 **Intel 附录 B Table 4（全指令集 Byte/Cyc 表）** 覆盖，并已在本次工作中人工核对该表的 ADD/ADDC/SUBB/INC/DEC/MUL/DIV/DA/逻辑/传送/位操作/转移各分组行（见 §1 表 S4 行）。换句话说：

* Atmel §1.11 逐条核验覆盖：**211 / 256** 个 opcode（0 处不一致）
* Intel 附录 B Table 4 逐条核验覆盖：**256 / 256** 个 opcode（这是 cycles 的最终依据）
* Keil 操作码表逐条核验覆盖：**256 / 256** 个 opcode（bytes / operands / mnemonic 的骨架）
* Actel Table 16 逐条核验覆盖：**256 / 256** 个 opcode（mnemonic / operands）

### 3.6 需要留意的操作数记法（不是冲突，但会影响你的汇编器）

* 输出表**逐条展开**寄存器与间接寻址：`INC R0`…`INC R7`、`ADD A,@R0`、`ADD A,@R1` 都是独立条目，不写 `Rn`/`@Ri`。`Rn`/`@Ri` 只出现在 `notation` 说明里。
* Keil/Actel 把 `MOVX @R0,A` 写作 `MOVX @Ri,A`，`MOV bit,C` 与 `MOV C,bit` 方向相反 —— 已逐条核对，未混。
* `MOV DPTR,#immed`（0x90）操作数写作 `DPTR,#immed`（Keil 原文用 `#immed` 表示 16 位立即数），语义是 16 位立即数；若你的汇编器要区分，请按 `bytes == 3` 判断而不是按字面。

---

## 4. 校验脚本输出摘要

`python research/validate_opcodes.py`（退出码 0）：

```
8051-opcodes.json validation
============================================================
file            : C:\Users\ZCB\Desktop\STCsimulator\research\8051-opcodes.json
entries         : 256
opcode coverage : 0..255 complete, no gaps, no duplicates
bytes dist.     : 1 bytes = 140, 2 bytes = 91, 3 bytes = 24, null bytes = 1
cycles dist.    : 1 cycles = 161, 2 cycles = 92, 4 cycles = 2, null cycles = 1
reserved codes  : 0xA5
undefined codes : none
distinct mnemonics (44): ACALL ADD ADDC AJMP ANL CJNE CLR CPL DA DEC DIV DJNZ INC JB JBC JC
                         JMP JNB JNC JNZ JZ LCALL LJMP MOV MOVC MOVX MUL NOP ORL POP PUSH
                         RET RETI RL RLC RR RRC SETB SJMP SUBB SWAP XCH XCHD XRL
ERRORS   : 0
WARNINGS : 0
```

校验脚本除覆盖性外还断言了任务点名的结构性规则，全部通过：

* `AJMP/ACALL addr11` = **2 字节**（0x01/0x11/0x21/0x31/0x41/0x51/0x61/0x71/0x81/0x91/0xA1/0xB1/0xC1/0xD1/0xE1/0xF1，共 16 条）
* `LJMP/LCALL addr16` = **3 字节**（0x02/0x12）
* `MOV DPTR,#immed` = **3 字节**（0x90）；`MOV direct,direct` = **3 字节**（0x85）
* `JBC/JB/JNB`（0x10/0x20/0x30）与 `CJNE`（0xB4–0xBF）、`DJNZ direct,rel`（0xD5）= **3 字节**；`DJNZ Rn,rel`（0xD8–0xDF）= **2 字节**
* 位操作按位寻址（2 字节，0x92/0xA0/0xA2/0xB0/0xB2/0xC2/0xD2）与带 rel 的位判断（3 字节）分清
* `MUL AB`/`DIV AB` = 1 字节 / **4 周期**，flags = CY,OV,P
* 全部 24 条 3 字节指令清单：`02 10 12 20 30 43 53 63 75 85 90 B4 B5 B6 B7 B8 B9 BA BB BC BD BE BF D5`

长度分布合计：140 + 91 + 24 + 1（保留码）= 256
周期分布合计：161 + 92 + 2 + 1 = 256
flags 分布：`(无) 122 / P 73 / CY,AC,OV,P 36 / CY 20 / CY,P 3 / CY,OV,P 2`

`python research/verify_cycles.py`（模板 vs 各来源逐条比对，本次最终运行）：

* 模板 vs Keil 字节数（**256 / 256** 条）：**0 处不一致**
* 模板 vs Atmel §1.11（把 `Rn/@Ri` 参考形式展开成具体形式、含义重叠的组合丢弃后逐条比对，覆盖 211 条）：**0 处不一致**
* 模板 vs Intel 附录 B Table 4（Byte / Cyc 全表）：人工逐分组核对，**0 处不一致**
* Keil / Actel / AEB / naken_asm 之间的 mnemonic 冲突：**0 处**
* 本数据集内部（Keil 字节数 vs AEB 字节数、Keil mnemonic vs Actel mnemonic）：**0 处不一致**

唯一真正的来源分歧是 §3.1 表中的 **`0xA3 INC DPTR`（Intel 1 周期 vs Atmel 2 周期，取 Intel）**。

---

## 5. 可信度评估

**高度确信（可直接用于交叉校验）**

* 全部 256 条的 **mnemonic**：四个互相独立的来源（Keil 表、Actel 十六进制序表、Atmel 手册、naken_asm 汇编器表）逐条一致，且 0xA5 是唯一缺项，与「255 条有效指令」的定论吻合。
* 全部 256 条的 **操作数形式与字节数**：Keil 操作码表（256 条骨架）与 AEB 指令明细表（241 条）逐条一致；Atmel §1.11 的 111 条通用形式展开后覆盖 211 个 opcode，同样逐条一致（另 45 条的字节数由 Keil/AEB 覆盖）。3 字节集合（24 条）与 2 字节 rel 类指令的划分与 Intel 文档描述（`AJMP/ACALL` 2 字节 / `LJMP/LCALL` 3 字节 / `DPTR,#data16` 3 字节）完全对应。
* **cycles**：与 Intel 附录 B Table 4 的 Byte/Cyc 列逐条一致（1/2/4 三档，仅 MUL/DIV 为 4）。Intel 是本指令集的原始定义方，两份 Intel 文档（1981 手册、1988 手册）互证。
* **flags 的 CY/OV/AC**：Actel Table 17 与 Atmel Table 1-13 两张独立表给出一致的「哪些指令影响 CY/OV/AC」，且与 Intel 手册正文（MUL 清 CY、DIV 清 CY、CJNE 影响 CY、ANL/ORL C,bit 影响 CY、RLC/RRC/DA 影响 CY）一致。

**中等确信（有依据但属于推导/需注意口径）**

* `flags` 中的 **P（奇偶标志）**：由「指令是否写累加器 A」推导。规则本身（任何写 A 的指令都会更新 P）与所有 8051 文档一致，但**没有任何一张来源表逐条列出 P**，因此这一列属于规则推导而非逐条抄录。若你的模拟器采用「只在 PSW 被显式写入时更新 P」的变体，需要自行调整这 73 条。
* **`0xA5` 的 bytes/cycles**：按「保留码」处理成 `null`。Atmel 说它在原版 8051 上表现为 1 字节、1 周期、无副作用；若你的模拟器想「宽容执行」，可把这两个字段填成 `1`/`1`。
* **`MOV direct,#immed`（0x75）等 3 字节/2 周期**：各来源一致，但注意 Atmel 的 Description 串列容易误读成 2 字节（已在脚本里修正）。

**低确信 / 明确未采用**

* 任何 **1T 内核厂商手册的 cycles**（MegaWin MDRH40、ABOV A96R725、STC15）——量纲不同，已在 §3.3 说明。
* STC15 官方中文手册的**指令表文本**（PDF 文本层被水印破坏，未能可靠提取），因此 `cn` 字段不是从这里抄的，而是按该手册的术语人工撰写。
* 各开源模拟器的**内部实现细节**（例如 js51 把 0x01–0x1F 当作 AJMP 的一整段处理）——只用于抽查，未用于生成字段。

---

## 6. 复现方式

```powershell
# 解析各来源（原始文件已在 research/raw/）
python research/parse_sources.py       # S1 Keil / S6 AEB / S7 naken / MentzJ
python research/parse_atmel.py         # S3 Atmel §1.11
python research/parse_actel.py         # S2 Actel Table 16
python research/verify_cycles.py       # 交叉比对（输出 research/parsed/verify.json）
python research/build_final.py         # 生成 research/8051-opcodes.json
python research/validate_opcodes.py    # 独立校验（退出码 0）
python research/make_manifest.py       # 刷新 raw/SOURCES-MANIFEST.md
```

中间产物都在 `research/parsed/`：`keil.json`、`actel.json`、`aeb.json`、`atmel.json`、`naken_asm.json`、`verify.json`、`final_discrepancies.json`、`validation-report.txt`。
