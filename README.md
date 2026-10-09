# STC15F2K60S2 汇编语言可视化模拟器

浏览器里运行的 8051 / STC15F2K60S2 **指令级**汇编模拟器：写汇编 → 汇编 → **逐条执行**，
实时可视化**指令存放地址**、**内部 RAM / XRAM / SFR / Flash 每个格子的数据变动**与
**PC / SP / DPTR / PSW** 等寄存器。

零依赖、无构建步骤：原生 JavaScript + HTML + CSS，Node.js 只用来起个静态服务器和跑测试。

## 快速开始

```bash
# 方式 1（推荐）：双击启动脚本，自动开浏览器
stc15-sim/启动模拟器.cmd

# 方式 2：命令行
node stc15-sim/serve.mjs 8099      # 然后打开 http://127.0.0.1:8099/

# 方式 3：直接双击 stc15-sim/index.html（脚本都是经典 <script>，不需要服务器）
```

**完整说明见 [stc15-sim/README.md](stc15-sim/README.md)** —— 功能清单、快捷键、汇编语法、
模拟器实现口径（哪些模拟、哪些有意从简）、常见坑、验证方式都在那里。

## 仓库内容

| 路径 | 说明 |
|---|---|
| `stc15-sim/` | 模拟器本体（指令表 / 汇编器 / CPU 内核 / SFR 数据 / 界面 / 测试 / 工具） |
| `research/*.json` | 芯片与指令集数据：SFR 与位地址表、256 条指令表（长度、机器周期） |
| `research/*.md` | 调研与出处说明：存储器映射、SFR 核对记录、现成 8051 Web 模拟器调研 |
| `research/*.py` | 从官方手册与头文件生成上述数据的可复现脚本 |
| `.gitignore` | 排除手册 PDF、第三方源码快照与测试产物 |

## 不在仓库里的东西（有意排除）

- `research/raw/`：STC 官方手册 PDF（27MB）、Intel/Atmel/Actel 手册、以及 19 个开源项目的
  源码快照 —— 其中部分项目**无许可证**或为 **GPL**，**禁止再分发**，只作本地核对用。
  它们的出处与用途都记录在 `research/*.md` 里，可据此自行获取。
- 本机测试产物（浏览器截图、DOM dump），可随时重新生成。

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

## 许可证

**尚未指定**。若打算公开使用，建议在仓库根目录补一个 `LICENSE`（MIT / Apache-2.0 / GPL-3.0
均可），并把 `stc15-sim/package.json` 里的 `license` 字段对齐。需要我加的话说一声即可。
