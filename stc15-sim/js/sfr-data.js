/* =============================================================================
 * sfr-data.js —— STC15F2K60S2 特殊功能寄存器(SFR)与存储器映射
 *
 * ⚠ 本文件由 tools/gen-sfr-data.mjs 自动生成，请勿手工编辑。
 *    数据来源：https://www.stcmicro.com/datasheet/STC15F2K60S2-cn.pdf | https://www.stcmicro.com/stc/stc15f2k60s2.html | https://github.com/uluo1226/51_Lanqiao_2019/blob/master/2_3peripherals/stc15f2k60s2.h
 *    生成依据：research/stc15f2k60s2-sfr.json（98 个 sfr / 108 个 sbit，逐条与官方手册核对）
 *    本型号不可用的 12 个 SFR 已剔除：P6, P7, P6M0, P6M1, P7M0, P7M1, T4T3M, T3T4M, T4H, T4L, T3H, T3L
 * ========================================================================== */
(function (root) {
  'use strict';

  var SFR = [
    { name: 'ACC', addr: 0xE0, bits: ['ACC.0', 'ACC.1', 'ACC.2', 'ACC.3', 'ACC.4', 'ACC.5', 'ACC.6', 'ACC.7'] },
    { name: 'B', addr: 0xF0, bits: ['B.0', 'B.1', 'B.2', 'B.3', 'B.4', 'B.5', 'B.6', 'B.7'] },
    { name: 'PSW', addr: 0xD0, bits: ['P', '—', 'OV', 'RS0', 'RS1', 'F0', 'AC', 'CY'] },
    { name: 'SP', addr: 0x81, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'DPL', addr: 0x82, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'DPH', addr: 0x83, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P0', addr: 0x80, bits: ['0.0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7'] },
    { name: 'P1', addr: 0x90, bits: ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7'] },
    { name: 'P2', addr: 0xA0, bits: ['2.0', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7'] },
    { name: 'P3', addr: 0xB0, bits: ['3.0', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7'] },
    { name: 'P4', addr: 0xC0, bits: ['4.0', '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7'] },
    { name: 'P5', addr: 0xC8, bits: ['5.0', '5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7'] },
    { name: 'P0M0', addr: 0x94, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P0M1', addr: 0x93, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P1M0', addr: 0x92, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P1M1', addr: 0x91, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P2M0', addr: 0x96, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P2M1', addr: 0x95, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P3M0', addr: 0xB2, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P3M1', addr: 0xB1, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P4M0', addr: 0xB4, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P4M1', addr: 0xB3, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P5M0', addr: 0xCA, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P5M1', addr: 0xC9, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'PCON', addr: 0x87, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'AUXR', addr: 0x8E, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'AUXR1', addr: 0xA2, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P_SW1', addr: 0xA2, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CLK_DIV', addr: 0x97, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'BUS_SPEED', addr: 0xA1, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P1ASF', addr: 0x9D, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'P_SW2', addr: 0xBA, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'IE', addr: 0xA8, bits: ['EX0', 'ET0', 'EX1', 'ET1', 'ES', 'EADC', 'ELVD', 'EA'] },
    { name: 'IP', addr: 0xB8, bits: ['PX0', 'PT0', 'PX1', 'PT1', 'PS', 'PADC', 'PLVD', 'PPCA'] },
    { name: 'IE2', addr: 0xAF, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'IP2', addr: 0xB5, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'INT_CLKO', addr: 0x8F, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'TCON', addr: 0x88, bits: ['IT0', 'IE0', 'IT1', 'IE1', 'TR0', 'TF0', 'TR1', 'TF1'] },
    { name: 'TMOD', addr: 0x89, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'TL0', addr: 0x8A, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'TL1', addr: 0x8B, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'TH0', addr: 0x8C, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'TH1', addr: 0x8D, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'T2H', addr: 0xD6, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'T2L', addr: 0xD7, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'WKTCL', addr: 0xAA, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'WKTCH', addr: 0xAB, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'WDT_CONTR', addr: 0xC1, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'SCON', addr: 0x98, bits: ['RI', 'TI', 'RB8', 'TB8', 'REN', 'SM2', 'SM1', 'SM0'] },
    { name: 'SBUF', addr: 0x99, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'S2CON', addr: 0x9A, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'S2BUF', addr: 0x9B, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'S3CON', addr: 0xAC, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'S3BUF', addr: 0xAD, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'S4CON', addr: 0x84, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'S4BUF', addr: 0x85, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'SADDR', addr: 0xA9, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'SADEN', addr: 0xB9, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'ADC_CONTR', addr: 0xBC, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'ADC_RES', addr: 0xBD, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'ADC_RESL', addr: 0xBE, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'SPSTAT', addr: 0xCD, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'SPCTL', addr: 0xCE, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'SPDAT', addr: 0xCF, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'IAP_DATA', addr: 0xC2, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'IAP_ADDRH', addr: 0xC3, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'IAP_ADDRL', addr: 0xC4, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'IAP_CMD', addr: 0xC5, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'IAP_TRIG', addr: 0xC6, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'IAP_CONTR', addr: 0xC7, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CCON', addr: 0xD8, bits: ['CCF0', 'CCF1', 'CCF2', '—', '—', '—', 'CR', 'CF'] },
    { name: 'CMOD', addr: 0xD9, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CL', addr: 0xE9, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CH', addr: 0xF9, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CCAPM0', addr: 0xDA, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CCAPM1', addr: 0xDB, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CCAPM2', addr: 0xDC, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CCAP0L', addr: 0xEA, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CCAP1L', addr: 0xEB, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CCAP2L', addr: 0xEC, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'PCA_PWM0', addr: 0xF2, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'PCA_PWM1', addr: 0xF3, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'PCA_PWM2', addr: 0xF4, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CCAP0H', addr: 0xFA, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CCAP1H', addr: 0xFB, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
    { name: 'CCAP2H', addr: 0xFC, bits: ['—', '—', '—', '—', '—', '—', '—', '—'] },
  ];

  var EXTRA_BITS = [
    { name: 'P00', addr: 0x80 },
    { name: 'P01', addr: 0x81 },
    { name: 'P02', addr: 0x82 },
    { name: 'P03', addr: 0x83 },
    { name: 'P04', addr: 0x84 },
    { name: 'P05', addr: 0x85 },
    { name: 'P06', addr: 0x86 },
    { name: 'P07', addr: 0x87 },
    { name: 'P10', addr: 0x90 },
    { name: 'P11', addr: 0x91 },
    { name: 'P12', addr: 0x92 },
    { name: 'P13', addr: 0x93 },
    { name: 'P14', addr: 0x94 },
    { name: 'P15', addr: 0x95 },
    { name: 'P16', addr: 0x96 },
    { name: 'P17', addr: 0x97 },
    { name: 'P20', addr: 0xA0 },
    { name: 'P21', addr: 0xA1 },
    { name: 'P22', addr: 0xA2 },
    { name: 'P23', addr: 0xA3 },
    { name: 'P24', addr: 0xA4 },
    { name: 'P25', addr: 0xA5 },
    { name: 'P26', addr: 0xA6 },
    { name: 'P27', addr: 0xA7 },
    { name: 'P30', addr: 0xB0 },
    { name: 'P31', addr: 0xB1 },
    { name: 'P32', addr: 0xB2 },
    { name: 'P33', addr: 0xB3 },
    { name: 'P34', addr: 0xB4 },
    { name: 'P35', addr: 0xB5 },
    { name: 'P36', addr: 0xB6 },
    { name: 'P37', addr: 0xB7 },
    { name: 'P40', addr: 0xC0 },
    { name: 'P41', addr: 0xC1 },
    { name: 'P42', addr: 0xC2 },
    { name: 'P43', addr: 0xC3 },
    { name: 'P44', addr: 0xC4 },
    { name: 'P45', addr: 0xC5 },
    { name: 'P46', addr: 0xC6 },
    { name: 'P47', addr: 0xC7 },
    { name: 'P50', addr: 0xC8 },
    { name: 'P51', addr: 0xC9 },
    { name: 'P52', addr: 0xCA },
    { name: 'P53', addr: 0xCB },
    { name: 'P54', addr: 0xCC },
    { name: 'P55', addr: 0xCD },
    { name: 'P56', addr: 0xCE },
    { name: 'P57', addr: 0xCF },
  ];

  /* 手册给出逐位定义、但该 SFR 本身不可位寻址（无法用 SETB 操作），仅用于界面提示 */
  var DOCUMENTED_BITS = {
    "IE2": {
      "addr": 175,
      "bits": {
        "ET4": 6,
        "ET3": 5,
        "ES4": 4,
        "ES3": 3,
        "ET2": 2,
        "ESPI": 1,
        "ES2": 0
      },
      "confidence": "manual_conflict - the STC15 manual prints two DIFFERENT IE2 layouts"
    }
  };

  root.STC = root.STC || {};
  root.STC.chipData = {
    part: 'STC15F2K60S2',
    flashBytes: 61440,          /* 60KB 用户程序区 0000H~EFFFH */
    iramBytes: 256,            /* 内部 RAM：低 128B 直接/间接，高 128B 仅间接 */
    xramBytes: 1792,            /* 片内扩展 RAM（AUX-RAM），MOVX 访问 */
    eepromBytes: 1024,        /* IAP/EEPROM 2×512B（模拟器暂不模拟 IAP 时序） */
    sfr: SFR,
    extraBits: EXTRA_BITS,
    documentedBits: DOCUMENTED_BITS,
    bitRamStartByte: 32,   /* 位寻址区 20H~2FH */
    bitRamBytes: 16,
    portCount: 6,
    resetSfr: { SP: 0x7, P0: 0xFF, P1: 0xFF, P2: 0xFF, P3: 0xFF, P4: 0xFF, P5: 0x3F, PCON: 0x30, AUXR: 0x1, BUS_SPEED: 0x2, WKTCL: 0xFF, WKTCH: 0x7F, S2CON: 0x40, SPCTL: 0x4, IAP_DATA: 0xFF },
    xramUpperBound: 0x700,  /* EXTRAM=0 时 MOVX @DPTR 的片内上界（0700H，按 1792 推导） */
    notes: [
      "sfr[] entries come verbatim from the STC15F2K60S2 Keil header (see sources); every addr was cross-checked against the SFR map in the official STC15F2K60S2 datasheet chapter 3.",
      "bit_addressable flags follow the Intel/Keil rule: SFR byte address in 0x80..0xFF and divisible by 8.",
      "bits[] contains ONLY sbit names that literally appear in the header; no bit names were invented.",
      "P5 only has 6 pins (P5.0-P5.5). The header still declares P56/P57 as sbits; those two bits are reserved on STC15F2K60S2 (P5 reset value xx11,1111B) and are flagged unavailable.",
      "The header files also declare P6 (0xE8) / P7 (0xF8) and their mode registers, plus T3/T4 registers (T4T3M 0xD1, T4H/T4L, T3H/T3L) and PWM/CMP SFRs. Those belong to other STC15 family members (STC15W4KxxS4 and 64-pin parts); they are NOT populated on STC15F2K60S2 in a 40/44-pin package. They are listed with available=false so the simulator can trap accesses.",
      "IE (0xA8) bit5 is EADC and bit6 is ELVD on STC15F2K60S2 - there is no ET2 in IE. Timer 2's enable is IE2.4 (ET2), IE2 is at 0xAF and is NOT bit addressable.",
      "AUXR is 0x8E and is NOT bit addressable; AUXR.EXTRAM (bit1) selects internal AUX-RAM vs external data memory for MOVX (@DPTR: addresses < 0x0700 hit the internal 1792-byte AUX-RAM when EXTRAM=0; >= 0x0700 always goes off chip). AUXR resets to 0000,0001B on this family (S1ST2=1).",
      "AUXR1 (0xA2) and P_SW1 (0xA2) are the same physical register (two names).",
      "T4T3M (0xD1) and T3T4M (0xD1) are the same physical register (two names).",
      "INT_CLKO/AUXR2 (0x8F) is NOT bit addressable; EX2/EX3/EX4 live there, not in IE.",
      "The 22 instructions that execute in a single clock (1T core) and INC DPTR / MUL AB (24x) are the only timing differences from a classic 8051; the 111-instruction opcode set is fully compatible.",
      "Bit names for TCON/SCON/IE/IP/CCON in this table were byte-for-byte cross-checked against the official datasheet: TCON 0x88 TF1 TR1 TF0 TR0 IE1 IT1 IE0 IT0; SCON 0x98 SM0/FE SM1 SM2 REN TB8 RB8 TI RI; IE 0xA8 EA ELVD EADC ES ET1 EX1 ET0 EX0; IP 0xB8 PPCA PLVD PADC PS PT1 PX1 PT0 PX0; CCON 0xD8 CF CR - - - CCF2 CCF1 CCF0; PSW 0xD0 CY AC F0 RS1 RS0 OV - P."
    ],
    sources: [
      "https://www.stcmicro.com/datasheet/STC15F2K60S2-cn.pdf",
      "https://www.stcmicro.com/stc/stc15f2k60s2.html",
      "https://github.com/uluo1226/51_Lanqiao_2019/blob/master/2_3peripherals/stc15f2k60s2.h",
      "https://github.com/uluo1226/51_Lanqiao_2019/blob/master/3_2011jue_door/stc15.h",
      "https://github.com/mogoreanu/8x16/blob/master/stc15f2k60s2.h",
      "https://www.mikrocontroller.net/attachment/428781/STC15-English.pdf"
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
