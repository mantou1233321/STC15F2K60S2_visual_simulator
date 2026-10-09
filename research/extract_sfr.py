# -*- coding: utf-8 -*-
"""
Parse Keil C51 style STC15F2K60S2 headers into a simulator-friendly SFR table.

Sources (all mirrored copies of the header shipped with STC's own tool chain /
Lanqiao competition driver sets):
  raw/mogoreanu-8x16-stc15f2k60s2.utf8.h
  raw/uluo1226-lanqiao-stc15f2k60s2.utf8.h
  raw/uluo1226-lanqiao-stc15.utf8.h

Cross-checked against the official datasheet STC15F2K60S2-cn.pdf (chapter 3 SFR map).
"""
import json
import re
from pathlib import Path

RAW = Path(__file__).resolve().parent / "raw"
OUT = Path(__file__).resolve().parent / "stc15f2k60s2-sfr.json"

SOURCES = {
    "mogoreanu": RAW / "mogoreanu-8x16-stc15f2k60s2.utf8.h",
    "uluo_f2k60s2": RAW / "uluo1226-lanqiao-stc15f2k60s2.utf8.h",
    "uluo_stc15": RAW / "uluo1226-lanqiao-stc15.utf8.h",
}

SFR_RE = re.compile(r"^\s*sfr\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(0[xX][0-9A-Fa-f]+|\d+)\s*;")
SBIT_RE = re.compile(
    r"^\s*sbit\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*\^\s*(\d+)\s*;"
)
DEFINE_RE = re.compile(r"^\s*#define\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$")


def parse(path):
    sfrs = {}   # name -> addr
    order = []
    sbits = []  # (name, sfr_name, bit)
    defines = []
    for line in path.read_text(encoding="utf-8").splitlines():
        code = line.split("//")[0]
        m = SFR_RE.match(code)
        if m:
            name, addr = m.group(1), int(m.group(2), 0)
            if name not in sfrs:
                order.append(name)
            sfrs[name] = addr
            continue
        m = SBIT_RE.match(code)
        if m:
            sbits.append((m.group(1), m.group(2), int(m.group(3))))
            continue
        m = DEFINE_RE.match(code)
        if m:
            defines.append((m.group(1), m.group(2).strip()))
    return sfrs, order, sbits, defines


def main():
    parsed = {k: parse(v) for k, v in SOURCES.items()}

    # Use uluo1226's STC15F2K60S2 header as the authority: it is the most complete
    # (declares sbit names too) and matches the official datasheet SFR map.
    base_name = "uluo_f2k60s2"
    sfrs, order, sbits, defines = parsed[base_name]
    ref_sfrs = parsed["uluo_stc15"][0]
    mog_sfrs = parsed["mogoreanu"][0]

    bit_of = {}   # sfr -> {bitindex: [bit names]}
    addr_of_bit = {}
    for name, sfr, bit in sbits:
        bit_of.setdefault(sfr, {}).setdefault(bit, []).append(name)
        addr_of_bit[name] = sfrs[sfr] + bit

    # SFR names that only exist in the W4K-oriented copy (not on F2K60S2)
    extra_in_mog = sorted(set(mog_sfrs) - set(sfrs))
    extra_in_ref = sorted(set(ref_sfrs) - set(sfrs))

    out_sfrs = []
    not_bit_addressable = []
    for name in order:
        addr = sfrs[name]
        bits = []
        for bit in sorted(bit_of.get(name, {})):
            for bn in bit_of[name][bit]:
                bits.append({"name": bn, "bit": bit, "addr": addr + bit})
        entry = {"name": name, "addr": addr, "addr_hex": "0x%02X" % addr}
        # a SFR is bit addressable iff addr % 8 == 0 (Keil/Intel 8051 rule)
        if addr % 8 == 0:
            entry["bit_addressable"] = True
            entry["bit_addr_base"] = addr
        else:
            entry["bit_addressable"] = False
            not_bit_addressable.append(name)
        if bits:
            entry["bits"] = bits
        out_sfrs.append(entry)

    doc = {
        "part": "STC15F2K60S2",
        "generated_by": "research/extract_sfr.py",
        "addr_encoding": (
            "addr / bit_addressable / bits[].addr are DECIMAL byte/bit addresses; "
            "addr_hex is the same byte address in hex. 8051 bit address = byte address + bit index, "
            "valid only when the SFR byte address is a multiple of 8 (0x80..0xFF)."
        ),
        "sfr": out_sfrs,
        "memory": {
            "iram_bytes": 256,
            "iram_breakdown": {
                "low_128_direct_and_indirect": 128,
                "high_128_indirect_only": 128,
                "note": "high 128 bytes (0x80-0xFF via @Ri) share the address range with the SFRs, "
                        "but are physically separate; SFR access is direct-only, upper RAM is indirect-only.",
            },
            "bit_addressable_ram": {"start": 32, "end": 47, "bytes": 16,
                                    "note": "IRAM 0x20-0x2F, bit addresses 0x00-0x7F"},
            "xram_bytes": 1792,
            "xram_address_range": {"start": 0, "end": 1791, "start_hex": "0x0000", "end_hex": "0x06FF"},
            "xram_note": "internal auxiliary RAM (AUX-RAM), reached with MOVX @DPTR/@Ri while AUXR.EXTRAM=0",
            "external_xram_bytes": 65536,
            "flash_bytes": 61440,
            "flash_address_range": {"start_hex": "0x0000", "end_hex": "0xEFFF"},
            "flash_note": "60K user program area 0000H-EFFFH on a 64K (0x10000) code space; "
                          "F000H-FFFFH holds the ISP/system area",
            "eeprom_bytes": 1024,
            "eeprom_address_range": {"start_hex": "0x0000", "end_hex": "0x03FF",
                                     "sector_size": 512, "sectors": 2,
                                     "movc_start_hex": "0xF000", "movc_end_hex": "0xF3FF"},
            "sfr_bytes": 128,
            "ports": ["P0", "P1", "P2", "P3", "P4", "P5"],
            "port_addrs": {"P0": 128, "P1": 144, "P2": 160, "P3": 176, "P4": 192, "P5": 200},
            "port_bit_addressable": {"P0": True, "P1": True, "P2": True, "P3": True, "P4": True, "P5": True},
            "port_pin_counts": {"P0": 8, "P1": 8, "P2": 8, "P3": 8, "P4": 8, "P5": 6},
            "max_io_pins": 42,
        },
        "bit_addressable_sfrs": [
            {"name": n, "addr": sfrs[n], "addr_hex": "0x%02X" % sfrs[n]}
            for n in order if sfrs[n] % 8 == 0
        ],
        "notes": [],
        "sources": [],
    }

    doc["notes"] = [
        "sfr[] entries come verbatim from the STC15F2K60S2 Keil header (see sources); "
        "every addr was cross-checked against the SFR map in the official STC15F2K60S2 datasheet chapter 3.",
        "bit_addressable flags follow the Intel/Keil rule: SFR byte address in 0x80..0xFF and divisible by 8.",
        "bits[] contains ONLY sbit names that literally appear in the header; no bit names were invented.",
        "P5 only has 6 pins (P5.0-P5.5). The header still declares P56/P57 as sbits; those two bits are "
        "reserved on STC15F2K60S2 (P5 reset value xx11,1111B) and are flagged unavailable.",
        "The header files also declare P6 (0xE8) / P7 (0xF8) and their mode registers, plus T3/T4 registers "
        "(T4T3M 0xD1, T4H/T4L, T3H/T3L) and PWM/CMP SFRs. Those belong to other STC15 family members "
        "(STC15W4KxxS4 and 64-pin parts); they are NOT populated on STC15F2K60S2 in a 40/44-pin package. "
        "They are listed with available=false so the simulator can trap accesses.",
        "IE (0xA8) bit5 is EADC and bit6 is ELVD on STC15F2K60S2 - there is no ET2 in IE. Timer 2's enable "
        "is IE2.4 (ET2), IE2 is at 0xAF and is NOT bit addressable.",
        "AUXR is 0x8E and is NOT bit addressable; AUXR.EXTRAM (bit1) selects internal AUX-RAM vs external "
        "data memory for MOVX (@DPTR: addresses < 0x0700 hit the internal 1792-byte AUX-RAM when EXTRAM=0; "
        ">= 0x0700 always goes off chip). AUXR resets to 0000,0001B on this family (S1ST2=1).",
        "AUXR1 (0xA2) and P_SW1 (0xA2) are the same physical register (two names).",
        "T4T3M (0xD1) and T3T4M (0xD1) are the same physical register (two names).",
        "INT_CLKO/AUXR2 (0x8F) is NOT bit addressable; EX2/EX3/EX4 live there, not in IE.",
        "The 22 instructions that execute in a single clock (1T core) and INC DPTR / MUL AB (24x) are the "
        "only timing differences from a classic 8051; the 111-instruction opcode set is fully compatible.",
        "Bit names for TCON/SCON/IE/IP/CCON in this table were byte-for-byte cross-checked against the "
        "official datasheet: TCON 0x88 TF1 TR1 TF0 TR0 IE1 IT1 IE0 IT0; SCON 0x98 SM0/FE SM1 SM2 REN TB8 RB8 TI RI; "
        "IE 0xA8 EA ELVD EADC ES ET1 EX1 ET0 EX0; IP 0xB8 PPCA PLVD PADC PS PT1 PX1 PT0 PX0; "
        "CCON 0xD8 CF CR - - - CCF2 CCF1 CCF0; PSW 0xD0 CY AC F0 RS1 RS0 OV - P.",
        "IMPORTANT for the simulator: on STC15F2K60S2 the IE.5 bit is EADC and IE.6 is ELVD - NOT ET2/ES2. "
        "Classic-8052 code that sets IE.5 to enable Timer 2 will instead enable the ADC interrupt.",
        "Reset values in reset_value / reset_value_bits come from the datasheet SFR map; 'x' bits are "
        "read as 0 in reset_value and are not defined at reset.",
        "IE2 is NOT bit addressable and IE2's bit layout is the single biggest open question: the STC15 "
        "manual prints two contradictory IE2 tables (see documented_bit_fields.IE2). The layout used by "
        "STC's own SPI sample code is ES2=b0, ESPI=b1, ET2=b2, ES3=b3, ES4=b4, ET3=b5, ET4=b6. On "
        "STC15F2K60S2 only ES2/ESPI/ET2 are meaningful (no T3/T4/UART3/UART4 on a 40/44-pin part).",
        "documented_bit_fields[] holds bit layouts that the datasheet documents in prose/prose tables "
        "(no sbit exists in the header for them) plus explicitly flagged conflicts; bits[] stays "
        "header-only as required.",
        "AUXR reset value is 0000,0001B on this family (S1ST2 defaults to 1), i.e. UART1 uses Timer 1 as "
        "the baud-rate generator by default and T0/T1 run in 12T mode until T0x12/T1x12 are set.",
    ]

    # mark availability / add unavailable extra SFRs coming from the family-wide header
    UNAVAILABLE = {"P6", "P7", "P6M0", "P6M1", "P7M0", "P7M1",
                   "T4T3M", "T3T4M", "T4H", "T4L", "T3H", "T3L",
                   "CMPCR1", "CMPCR2", "PWMCFG", "PWMCR", "PWMIF", "PWMFDCR"}
    for e in out_sfrs:
        if e["name"] in UNAVAILABLE:
            e["available_on_stc15f2k60s2"] = False
            e["unavailable_reason"] = ("exists in the family-wide STC15 SFR map / header, but is not "
                                       "implemented on STC15F2K60S2 (40/44-pin package)")
        else:
            e["available_on_stc15f2k60s2"] = True
        if e["name"] == "P5" and "bits" in e:
            for b in e["bits"]:
                if b["bit"] >= 6:
                    b["available"] = False
                    b["note"] = "reserved on STC15F2K60S2 (P5 has only P5.0-P5.5)"

    # reset values as printed in the official STC15F2K60S2 datasheet SFR map (chapter 3)
    RESET = {
        "P0": "1111,1111", "SP": "0000,0111", "DPL": "0000,0000", "DPH": "0000,0000",
        "S4CON": "0000,0000", "S4BUF": "xxxx,xxxx", "PCON": "0011,0000",
        "TCON": "0000,0000", "TMOD": "0000,0000", "TL0": "0000,0000", "TL1": "0000,0000",
        "TH0": "0000,0000", "TH1": "0000,0000",
        "AUXR": "0000,0001", "INT_CLKO": "x000,0000",
        "P1": "1111,1111", "P1M1": "0000,0000", "P1M0": "0000,0000",
        "P0M1": "0000,0000", "P0M0": "0000,0000", "P2M1": "0000,0000", "P2M0": "0000,0000",
        "CLK_DIV": "0000,0000", "SCON": "0000,0000", "SBUF": "xxxx,xxxx",
        "S2CON": "0100,0000", "S2BUF": "xxxx,xxxx", "P1ASF": "0000,0000",
        "P2": "1111,1111", "BUS_SPEED": "xxxx,xx10", "AUXR1": "0000,0000", "P_SW1": "0000,0000",
        "IE": "0000,0000", "SADDR": "0000,0000", "WKTCL": "1111,1111", "WKTCH": "0111,1111",
        "S3CON": "0000,0000", "S3BUF": "xxxx,xxxx", "IE2": "x000,0000",
        "P3": "1111,1111", "P3M1": "0000,0000", "P3M0": "0000,0000",
        "P4M1": "0000,0000", "P4M0": "0000,0000", "IP2": "xxx0,0000",
        "IP": "0000,0000", "SADEN": "0000,0000", "P_SW2": "xxxx,x000",
        "ADC_CONTR": "0000,0000", "ADC_RES": "0000,0000", "ADC_RESL": "0000,0000",
        "P4": "1111,1111", "WDT_CONTR": "0000,0000",
        "IAP_DATA": "1111,1111", "IAP_ADDRH": "0000,0000", "IAP_ADDRL": "0000,0000",
        "IAP_CMD": "xxxx,xx00", "IAP_TRIG": "xxxx,xxxx", "IAP_CONTR": "0000,x000",
        "P5": "xx11,1111", "P5M1": "xxx0,0000", "P5M0": "xxx0,0000",
        "SPSTAT": "00xx,xxxx", "SPCTL": "0000,0100", "SPDAT": "0000,0000",
        "PSW": "0000,0000", "T2H": "0000,0000", "T2L": "0000,0000",
        "CCON": "00xx,0000", "CMOD": "0xxx,0000",
        "CCAPM0": "x000,0000", "CCAPM1": "x000,0000", "CCAPM2": "x000,0000",
        "ACC": "0000,0000", "CL": "0000,0000", "CCAP0L": "0000,0000", "CCAP1L": "0000,0000",
        "CCAP2L": "0000,0000", "B": "0000,0000",
        "PCA_PWM0": "xxxx,xx00", "PCA_PWM1": "xxxx,xx00", "PCA_PWM2": "xxxx,xx00",
        "CH": "0000,0000", "CCAP0H": "0000,0000", "CCAP1H": "0000,0000", "CCAP2H": "0000,0000",
        "P6M1": "0000,0000", "P6M0": "0000,0000", "P7M1": "0000,0000", "P7M0": "0000,0000",
        "P6": "1111,1111", "P7": "1111,1111",
    }
    for e in out_sfrs:
        if e["name"] in RESET:
            e["reset_value_bits"] = RESET[e["name"]]
            e["reset_value"] = int(RESET[e["name"]].replace(",", "").replace("x", "0"), 2)

    # datasheet cross-check notes for individual bits
    BIT_NOTES = {
        ("SCON", "SM0"): "datasheet calls this bit SM0/FE: it is the frame-error flag when PCON.SMOD0=1",
        ("PSW", "P"): "datasheet shows PSW.0 = P, PSW.1 = reserved",
        ("CCON", "CF"): "PCA counter overflow flag, software clear only",
        ("CCON", "CR"): "PCA counter run control",
        ("IE", "ELVD"): "low-voltage-detect interrupt enable (STC specific; classic 8051 has no such bit)",
        ("IE", "EADC"): "ADC interrupt enable (STC specific); IE.5 is NOT ET2 on this part",
        ("IP", "PLVD"): "low-voltage-detect interrupt priority",
        ("IP", "PADC"): "ADC interrupt priority",
        ("IP", "PPCA"): "PCA/CCP interrupt priority",
    }
    for e in out_sfrs:
        for b in e.get("bits", []):
            key = (e["name"], b["name"])
            if key in BIT_NOTES:
                b["note"] = BIT_NOTES[key]

    # Bit fields that the datasheet documents only in prose (no sbit in the header),
    # or where the STC manual contradicts itself.  Kept as separate, clearly-flagged data
    # so the JSON schema keeps bits[] == "literally from the header" (as required).
    doc["documented_bit_fields"] = [
        {
            "sfr": "IE2", "addr": 175, "addr_hex": "0xAF", "bit_addressable": False,
            "confidence": "manual_conflict - the STC15 manual prints two DIFFERENT IE2 layouts",
            "layout_a_from_STC_official_spi_example": {
                "source": "datasheet ch.15 SPI sample code: '#define ESPI 0x02  //IE2.1' "
                          "and ch.7/ch.16 IE2 tables 'B2 ET2, B1 ESPI, B0 ES2'",
                "bits": {"ET4": 6, "ET3": 5, "ES4": 4, "ES3": 3, "ET2": 2, "ESPI": 1, "ES2": 0},
            },
            "layout_b_printed_as_STC15F2K60S2": {
                "source": "datasheet ch.6 '6.5 中断寄存器' table printed under the heading "
                          "'上表中列出了与STC15F2K60S2系列单片机中断相关的所有寄存器'",
                "bits": {"ET4": 6, "ET3": 5, "ES4": 4, "ES3": 3, "ET2": 4, "ESPI": 2, "ES2": 0},
                "problem": "layout_b is internally inconsistent (it skips bit 1) and contradicts the "
                           "same manual's SPI example which defines ESPI as IE2.1 = 0x02",
            },
            "recommendation": "use layout_a (ES2=bit0, ESPI=bit1, ET2=bit2, ES3=bit3, ES4=bit4, "
                              "ET3=bit5, ET4=bit6); verify on real silicon",
        },
        {
            "sfr": "INT_CLKO", "addr": 143, "addr_hex": "0x8F", "bit_addressable": False,
            "confidence": "confirmed by datasheet ch.6",
            "bits": {"EX4": 6, "EX3": 5, "EX2": 4, "MCKO_S2": 3, "T2CLKO": 2, "T1CLKO": 1, "T0CLKO": 0},
        },
        {
            "sfr": "IP2", "addr": 181, "addr_hex": "0xB5", "bit_addressable": False,
            "confidence": "datasheet ch.6 prints 'xxx0,0000: B4 PX4, B3 PPWMFD, B2 PPWM, B1 PSPI, B0 PS2' "
                          "and later 'IP2 B5H: B1 PSPI, B0 PS2' - layouts differ per family member",
            "bits_as_printed_ch6": {"PX4": 4, "PPWMFD": 3, "PPWM": 2, "PSPI": 1, "PS2": 0},
            "bits_as_printed_ch15_16": {"PSPI": 1, "PS2": 0},
            "recommendation": "for STC15F2K60S2 only PS2 (bit0) and PSPI (bit1) are meaningful; "
                              "PX4/PPWM belong to other family members",
        },
        {
            "sfr": "AUXR", "addr": 142, "addr_hex": "0x8E", "bit_addressable": False,
            "confidence": "confirmed by datasheet ch.3 and ch.6",
            "bits": {"T0x12": 7, "T1x12": 6, "UART_M0x6": 5, "T2R": 4, "T2_C/T": 3, "T2x12": 2,
                     "EXTRAM": 1, "S1ST2": 0},
            "reset_value_bits": "0000,0001",
        },
        {
            "sfr": "AUXR1 / P_SW1", "addr": 162, "addr_hex": "0xA2", "bit_addressable": False,
            "confidence": "confirmed by datasheet ch.15 '6. 控制SPI功能切换的寄存器AUXR1(P_SW1)'",
            "bits": {"S1_S1": 7, "S1_S0": 6, "CCP_S1": 5, "CCP_S0": 4, "SPI_S1": 3, "SPI_S0": 2,
                     "reserved": 1, "DPS": 0},
            "reset_value_bits": "0000,0000",
        },
        {
            "sfr": "PCON", "addr": 135, "addr_hex": "0x87", "bit_addressable": False,
            "confidence": "confirmed by datasheet ch.3",
            "bits": {"SMOD": 7, "SMOD0": 6, "LVDF": 5, "POF": 4, "GF1": 3, "GF0": 2, "PD": 1, "IDL": 0},
            "reset_value_bits": "0011,0000",
        },
        {
            "sfr": "CCON", "addr": 216, "addr_hex": "0xD8", "bit_addressable": True,
            "confidence": "confirmed by datasheet PCA chapter; note CCF3 exists on other family members",
            "bits": {"CF": 7, "CR": 6, "CCF2": 2, "CCF1": 1, "CCF0": 0},
            "reset_value_bits": "00xx,0000",
        },
        {
            "sfr": "SPCTL", "addr": 206, "addr_hex": "0xCE", "bit_addressable": False,
            "confidence": "confirmed by datasheet SPI chapter",
            "bits": {"SSIG": 7, "SPEN": 6, "DORD": 5, "MSTR": 4, "CPOL": 3, "CPHA": 2,
                     "SPR1": 1, "SPR0": 0},
            "reset_value_bits": "0000,0100",
        },
        {
            "sfr": "WDT_CONTR", "addr": 193, "addr_hex": "0xC1", "bit_addressable": False,
            "confidence": "confirmed by datasheet ch.3",
            "bits": {"WDT_FLAG": 7, "EN_WDT": 5, "CLR_WDT": 4, "IDLE_WDT": 3,
                     "PS2": 2, "PS1": 1, "PS0": 0},
            "reset_value_bits": "0000,0000",
        },
        {
            "sfr": "IAP_CONTR", "addr": 199, "addr_hex": "0xC7", "bit_addressable": False,
            "confidence": "confirmed by datasheet ch.3",
            "bits": {"IAPEN": 7, "SWBS": 6, "SWRST": 5, "CMD_FAIL": 4, "WT2": 2, "WT1": 1, "WT0": 0},
            "reset_value_bits": "0000,x000",
        },
        {
            "sfr": "IAP_CMD", "addr": 197, "addr_hex": "0xC5", "bit_addressable": False,
            "confidence": "confirmed by datasheet ch.3",
            "bits": {"MS1": 1, "MS0": 0},
            "reset_value_bits": "xxxx,xx00",
        },
        {
            "sfr": "P_SW2", "addr": 186, "addr_hex": "0xBA", "bit_addressable": False,
            "confidence": "confirmed by datasheet ch.3 for STC15F2K60S2 "
                          "(the PWM67_S/PWM2345_S/EAXSFR bits at the same address belong to STC15W4K)",
            "bits": {"S4_S": 2, "S3_S": 1, "S2_S": 0},
            "reset_value_bits": "xxxx,x000",
        },
        {
            "sfr": "ADC_CONTR", "addr": 188, "addr_hex": "0xBC", "bit_addressable": False,
            "confidence": "confirmed by datasheet ADC chapter",
            "bits": {"ADC_POWER": 7, "SPEED1": 6, "SPEED0": 5, "ADC_FLAG": 4, "ADC_START": 3,
                     "CHS2": 2, "CHS1": 1, "CHS0": 0},
            "reset_value_bits": "0000,0000",
        },
        {
            "sfr": "CLK_DIV", "addr": 151, "addr_hex": "0x97", "bit_addressable": False,
            "confidence": "datasheet ch.3 prints 'MCKO_S1 MCKO_S1 ADRJ Tx_Rx MCLKO_2 CLKS2 CLKS1 CLKS0' "
                          "(B6 is printed twice - typo for MCKO_S0)",
            "bits": {"MCKO_S1": 7, "MCKO_S0": 6, "ADRJ": 5, "Tx_Rx": 4, "MCLKO_2": 3,
                     "CLKS2": 2, "CLKS1": 1, "CLKS0": 0},
            "reset_value_bits": "0000,0000",
        },
    ]

    doc["sources"] = [
        "https://www.stcmicro.com/datasheet/STC15F2K60S2-cn.pdf",
        "https://www.stcmicro.com/stc/stc15f2k60s2.html",
        "https://github.com/uluo1226/51_Lanqiao_2019/blob/master/2_3peripherals/stc15f2k60s2.h",
        "https://github.com/uluo1226/51_Lanqiao_2019/blob/master/3_2011jue_door/stc15.h",
        "https://github.com/mogoreanu/8x16/blob/master/stc15f2k60s2.h",
        "https://www.mikrocontroller.net/attachment/428781/STC15-English.pdf",
    ]
    doc["raw_header_mirrors"] = {
        k: str(v.relative_to(RAW.parent.parent)).replace("\\", "/") for k, v in SOURCES.items()
    }
    doc["parser_cross_check"] = {
        "sfr_only_in_mogoreanu": extra_in_mog,
        "sfr_only_in_uluo_stc15": extra_in_ref,
    }
    doc["non_bit_addressable_sfrs"] = not_bit_addressable

    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")
    print("wrote", OUT)
    print("sfr count:", len(out_sfrs))
    print("bit-addressable:", [n for n in order if sfrs[n] % 8 == 0])
    print("sbit count:", len(sbits))
    print("only in mogoreanu:", extra_in_mog)
    print("only in uluo stc15.h:", extra_in_ref)


if __name__ == "__main__":
    main()
