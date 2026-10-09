# -*- coding: utf-8 -*-
"""Parse the Actel Core8051 datasheet (8051ds-adv.pdf) Table 16 (hex-ordered
   instruction set) -> opcode -> mnemonic + operands."""
import os, re, json

RAW = r"C:\Users\ZCB\Desktop\STCsimulator\research\raw"
OUT = r"C:\Users\ZCB\Desktop\STCsimulator\research\parsed"
os.makedirs(OUT, exist_ok=True)

txt = open(os.path.join(RAW, "actel_8051ds-adv.txt"), encoding="utf-8", errors="replace").read()
lines = txt.splitlines()

cell = re.compile(r"^\s*([0-9A-F]{2})\s*H?\s+(\S.*?)\s{2,}([0-9A-F]{2})\s*H?\s+(\S.*?)\s*$")
table, raw_rows = {}, []
for i, ln in enumerate(lines):
    if not re.match(r"^\s*[0-9A-F]{2}\s*H", ln):
        continue
    m = cell.match(ln)
    if not m:
        continue
    for code_s, ins in ((m.group(1), m.group(2)), (m.group(3), m.group(4))):
        code = int(code_s, 16)
        ins = re.sub(r"\s+", " ", ins).strip()
        if code in table:
            continue
        table[code] = ins
        raw_rows.append({"line": i + 1, "opcode": "0x%02X" % code, "text": ins})

print("actel cells:", len(table))
missing = [i for i in range(256) if i not in table]
print("missing:", ["0x%02X" % i for i in missing])

# split mnemonic / operands
recs = {}
for code, ins in table.items():
    m = re.match(r"^([A-Z][A-Z0-9]*)\s*(.*)$", ins)
    if not m:
        recs[code] = {"raw": ins, "mnemonic": None, "operands": None}
        continue
    recs[code] = {"raw": ins, "mnemonic": m.group(1), "operands": re.sub(r"\s*,\s*", ",", m.group(2).strip())}

flags = {}
for ln in lines:
    m = re.match(r"^\s*(ADD|ADDC|SUBB|MUL|DIV|DA|RRC|RLC|SETB C|CLR C|CPL C|"
                 r"ANL C,/?bit|ORL C,/?bit|MOV C,bit|CJNE)\s+(.*\S)\s*$", ln)
    if m and ("X" in ln or re.search(r"\s[01]\s*$", ln)):
        flags.setdefault(m.group(1), m.group(2))
print("flag rows:", flags)

json.dump({"source": "Actel Core8051 Handbook / 8051ds-adv.pdf",
           "url": "https://www.keil.com/dd/docs/datashts/actel/8051ds-adv.pdf",
           "note": "Table 16 Core8051 Instruction Set in Hexadecimal Order (covers 0x00-0xFF; 0xA5 is documented as '-' / not used by the original ASM51 set). "
                   "Table 17 PSW Flag Modification (CY,OV,AC). NOTE: Core8051 cycle counts are 1-clock-per-cycle and are NOT standard 8051 machine cycles.",
           "flag_table": flags,
           "table": {str(k): v for k, v in sorted(recs.items())},
           "raw_rows": raw_rows},
          open(os.path.join(OUT, "actel.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
