# -*- coding: utf-8 -*-
"""Chinese one-line summaries per MCS-51 mnemonic.

Provenance of the Chinese terminology: the STC 官方数据手册 (STC15F2K60S2-cn.pdf,
section "指令系统" / 附录 指令表, kept in research/raw/) uses exactly this
vocabulary (累加器 / 立即数 / 直接地址 / 寄存器 / 间接寻址 / 位寻址 / 相对偏移).
These strings are only an aid for the assembler UI - the machine-readable table
(8051-opcodes.json) does not depend on them.
"""

CN_NOTES = {
    "ACALL": "绝对调用子程序（11 位目标地址，2KB 页内）",
    "ADD":   "加法：累加器 A 加上源操作数，结果送回 A",
    "ADDC":  "带进位加法：A + 源操作数 + CY，结果送回 A",
    "AJMP":  "绝对跳转（11 位目标地址，2KB 页内）",
    "ANL":   "逻辑与（按位与）",
    "CJNE":  "比较不等则转移（相等则顺序执行，影响 CY）",
    "CLR":   "清 0：累加器 A / 进位标志 CY / 指定位",
    "CPL":   "取反：累加器 A / 进位标志 CY / 指定位",
    "DA":    "十进制调整（BCD 加法校正）",
    "DEC":   "减 1（字节减 1，不影响标志）",
    "DIV":   "除法：A ÷ B，商在 A，余数在 B（当 B=0 时 OV=1）",
    "DJNZ":  "减 1 不为 0 则转移（循环计数）",
    "INC":   "加 1（字节或数据指针 DPTR 加 1）",
    "JB":    "位为 1 则转移",
    "JBC":   "位为 1 则转移并清零该位",
    "JC":    "进位标志 CY=1 则转移",
    "JMP":   "间接转移 @A+DPTR（多分支跳转表）",
    "JNB":   "位为 0 则转移",
    "JNC":   "进位标志 CY=0 则转移",
    "JNZ":   "累加器 A 非 0 则转移",
    "JZ":    "累加器 A 为 0 则转移",
    "LCALL": "长调用子程序（16 位目标地址，64KB 空间内）",
    "LJMP":  "长跳转（16 位目标地址，64KB 空间内）",
    "MOV":   "传送数据（字节传送 / 位传送）",
    "MOVC":  "读程序存储器（查表：@A+DPTR 或 @A+PC）",
    "MOVX":  "读/写片外数据存储器（@Ri 8 位地址或 @DPTR 16 位地址）",
    "MUL":   "乘法：A × B，16 位积高字节在 B、低字节在 A",
    "NOP":   "空操作（占 1 个机器周期）",
    "ORL":   "逻辑或（按位或）",
    "POP":   "出栈（把栈顶字节送入直接地址单元）",
    "PUSH":  "入栈（把直接地址单元内容压入堆栈）",
    "RET":   "子程序返回",
    "RETI":  "中断服务程序返回（同时清中断优先级触发器）",
    "RL":    "循环左移（累加器 A，不含进位）",
    "RLC":   "带进位循环左移（累加器 A）",
    "RR":    "循环右移（累加器 A，不含进位）",
    "RRC":   "带进位循环右移（累加器 A）",
    "SETB":  "置 1：进位标志 CY / 指定位",
    "SJMP":  "短转移（相对偏移 rel）",
    "SUBB":  "带借位减法：A − 源操作数 − CY，结果送回 A",
    "SWAP":  "累加器 A 高低半字节交换",
    "XCH":   "字节交换（A 与源操作数互换）",
    "XCHD":  "低半字节交换（A 与 @Ri 的低 4 位互换）",
    "XRL":   "逻辑异或（按位异或）",
    "RESERVED": "保留/未定义操作码（标准 MCS-51 未使用 0xA5）",
}
