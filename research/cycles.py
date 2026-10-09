# -*- coding: utf-8 -*-
"""Cycle (standard MCS-51 machine cycles, 12 clocks each) and byte-count
   template table.

CYCLE SOURCE OF TRUTH: Atmel 8051 Microcontrollers Hardware Manual 4316E
  section 1.11 "Instruction Set Summary" (Oscillator Period column, 12/24/48
  clocks = 1/2/4 machine cycles), cross-read against Intel MCS-51 User's
  Manual Jan81 Table 3-2 "Instruction Set Summary".

Each entry: (regex over canonical operand string, bytes, cycles, note)
Regex is matched against the canonical operand string with tokens like
  A B C AB DPTR R0..R7 Rn @R0 @R1 @Ri @DPTR @A+DPTR @A+PC
  direct bit /bit rel addr11 addr16 #immed #immed16
Constants embedded in opcodes (ANL/ORL C,/bit, MOVX) are written explicitly.
Order matters: first match wins.
"""
import re

R = r"R[0-7]"

IRI = r"@R[01]"

BYTE_CYCLE_PATTERNS = [
    # ---- arithmetic ----
    (r"^A,#immed$",                      2, 1, "ADD/ADDC/SUBB A,#data"),
    (r"^A,direct$",                      2, 1, "ADD/ADDC/SUBB A,direct"),
    (r"^A,@R[01]$",                         1, 1, "ADD/ADDC/SUBB A,@Ri"),
    (r"^A,%s$" % R,                      1, 1, "ADD/ADDC/SUBB A,Rn"),
    (r"^A$",                             1, 1, "INC/DEC/DA/CLR/CPL/RL/RLC/RR/RRC/SWAP A"),
    (r"^%s$" % R,                        1, 1, "INC/DEC Rn"),
    (r"^@R[01]$",                           1, 1, "INC/DEC @Ri"),
    (r"^direct$",                        2, 1, "INC/DEC direct"),
    (r"^DPTR$",                          1, 2, "INC DPTR"),
    (r"^AB$",                            1, 4, "MUL AB / DIV AB"),
    # ---- logic ----
    (r"^direct,A$",                      2, 1, "ANL/ORL/XRL direct,A"),
    (r"^direct,#immed$",                 3, 2, "ANL/ORL/XRL direct,#data"),
    # ---- data transfer ----
    (r"^A,%s$" % R,                      1, 1, "MOV A,Rn"),
    (r"^A,@R[01]$",                         1, 1, "MOV A,@Ri"),
    (r"^A,direct$",                      2, 1, "MOV A,direct"),
    (r"^A,#immed$",                      2, 1, "MOV A,#data"),
    (r"^%s,A$" % R,                      1, 1, "MOV Rn,A"),
    (r"^%s,direct$" % R,                 2, 2, "MOV Rn,direct"),
    (r"^%s,#immed$" % R,                 2, 1, "MOV Rn,#data"),
    (r"^direct,A$",                      2, 1, "MOV direct,A"),
    (r"^direct,%s$" % R,                 2, 2, "MOV direct,Rn"),
    (r"^direct,direct$",                 3, 2, "MOV direct,direct"),
    (r"^direct,@R[01]$",                    2, 2, "MOV direct,@Ri"),
    (r"^direct,#immed$",                 3, 2, "MOV direct,#data"),
    (r"^@R[01],A$",                         1, 1, "MOV @Ri,A"),
    (r"^@R[01],direct$",                    2, 2, "MOV @Ri,direct"),
    (r"^@R[01],#immed$",                    2, 1, "MOV @Ri,#data"),
    (r"^DPTR,#immed(16)?$",               3, 2, "MOV DPTR,#data16"),
    (r"^A,@A\+DPTR$",                    1, 2, "MOVC A,@A+DPTR"),
    (r"^A,@A\+PC$",                      1, 2, "MOVC A,@A+PC"),
    (r"^A,@DPTR$",                       1, 2, "MOVX A,@DPTR"),
    (r"^A,@R[01]$",                         1, 2, "MOVX A,@Ri"),
    (r"^@DPTR,A$",                       1, 2, "MOVX @DPTR,A"),
    (r"^@R[01],A$",                         1, 2, "MOVX @Ri,A"),
    (r"^direct$",                        2, 2, "PUSH direct / POP direct"),
    (r"^A,%s$" % R,                      1, 1, "XCH A,Rn"),
    (r"^A,direct$",                      2, 1, "XCH A,direct"),
    (r"^A,@R[01]$",                         1, 1, "XCH A,@Ri"),
    (r"^A,@R[01]$",                         1, 1, "XCHD A,@Ri"),
    # ---- boolean ----
    (r"^C$",                             1, 1, "CLR/SETB/CPL C"),
    (r"^bit$",                           2, 1, "CLR/SETB/CPL/MOV bit"),
    (r"^C,/bit$",                        2, 2, "ANL/ORL C,/bit"),
    (r"^C,bit$",                         2, 2, "ANL/ORL C,bit"),
    (r"^C,bit$",                         2, 1, "MOV C,bit"),
    (r"^bit,C$",                         2, 2, "MOV bit,C"),
    # ---- branches ----
    (r"^bit,rel$",                       3, 2, "JB/JNB/JBC bit,rel"),
    (r"^rel$",                           2, 2, "JC/JNC/JZ/JNZ/SJMP rel"),
    (r"^addr11$",                        2, 2, "AJMP/ACALL addr11"),
    (r"^addr16$",                        3, 2, "LJMP/LCALL addr16"),
    (r"^$",                              1, 2, "RET/RETI"),
    (r"^@A\+DPTR$",                      1, 2, "JMP @A+DPTR"),
    (r"^A,direct,rel$",                  3, 2, "CJNE A,direct,rel"),
    (r"^A,#immed,rel$",                  3, 2, "CJNE A,#data,rel"),
    (r"^%s,#immed,rel$" % R,             3, 2, "CJNE Rn,#data,rel"),
    (r"^@R[01],#immed,rel$",                3, 2, "CJNE @Ri,#data,rel"),
    (r"^%s,rel$" % R,                    2, 2, "DJNZ Rn,rel"),
    (r"^direct,rel$",                    3, 2, "DJNZ direct,rel"),
    (r"^$",                              1, 1, "NOP"),
]

# first-match-wins is ambiguous for several duplicate patterns, so the table is
# consulted with the mnemonic as a discriminator instead.
MNEMONIC_CYCLES = {
    ("MOVX", "A,@DPTR"): (1, 2), ("MOVX", "A,@R0"): (1, 2), ("MOVX", "A,@R1"): (1, 2),
    ("MOVX", "@DPTR,A"): (1, 2), ("MOVX", "@R0,A"): (1, 2), ("MOVX", "@R1,A"): (1, 2),
    ("MOV", "A,@R0"): (1, 1), ("MOV", "A,@R1"): (1, 1),
    ("MOV", "@R0,A"): (1, 1), ("MOV", "@R1,A"): (1, 1),
    ("XCHD", "A,@R0"): (1, 1), ("XCHD", "A,@R1"): (1, 1),
    ("XCH", "A,@R0"): (1, 1), ("XCH", "A,@R1"): (1, 1),
    ("MOVC", "A,@A+DPTR"): (1, 2), ("MOVC", "A,@A+PC"): (1, 2),
    ("PUSH", "direct"): (2, 2), ("POP", "direct"): (2, 2),
    ("CLR", "C"): (1, 1), ("CLR", "bit"): (2, 1), ("CLR", "A"): (1, 1),
    ("SETB", "C"): (1, 1), ("SETB", "bit"): (2, 1),
    ("CPL", "C"): (1, 1), ("CPL", "bit"): (2, 1), ("CPL", "A"): (1, 1),
    ("ANL", "C,bit"): (2, 2), ("ANL", "C,/bit"): (2, 2),
    ("ORL", "C,bit"): (2, 2), ("ORL", "C,/bit"): (2, 2),
    ("MOV", "C,bit"): (2, 1), ("MOV", "bit,C"): (2, 2),
    ("RET", ""): (1, 2), ("RETI", ""): (1, 2), ("NOP", ""): (1, 1),
    ("INC", "A"): (1, 1), ("INC", "DPTR"): (1, 2),
    ("MUL", "AB"): (1, 4), ("DIV", "AB"): (1, 4),
    ("DA", "A"): (1, 1),
}


def lookup(mnemonic, canon_ops):
    """Return (bytes, cycles) or (None, None) if unknown."""
    key = (mnemonic, canon_ops)
    if key in MNEMONIC_CYCLES:
        return MNEMONIC_CYCLES[key]
    for pat, nb, nc, _ in BYTE_CYCLE_PATTERNS:
        if re.match(pat, canon_ops or ""):
            return nb, nc
    return None, None
