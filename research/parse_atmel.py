# -*- coding: utf-8 -*-
"""Parse the Atmel 8051 Hardware Manual (doc4316) 'Instruction Set Summary'
   table -> mnemonic, operands, byte count, oscillator period (clocks)."""
import os, re, json

RAW = r"C:\Users\ZCB\Desktop\STCsimulator\research\raw"
OUT = r"C:\Users\ZCB\Desktop\STCsimulator\research\parsed"
os.makedirs(OUT, exist_ok=True)

MN = ("ADD|ADDC|SUBB|INC|DEC|MUL|DIV|DA|ANL|ORL|XRL|CLR|CPL|RL|RLC|RR|RRC|SWAP|"
      "MOV|MOVC|MOVX|PUSH|POP|XCH|XCHD|SETB|JC|JNC|JB|JNB|JBC|ACALL|LCALL|RET|RETI|"
      "AJMP|LJMP|SJMP|JMP|JZ|JNZ|CJNE|DJNZ|NOP")

lines = open(os.path.join(RAW, "atmel_8051_hw_manual.txt"), encoding="utf-8",
             errors="replace").read().splitlines()

start = next(i for i, l in enumerate(lines)
             if "1.11" in l and "Instruction Set" in l and i > 800)
end = len(lines)
for j in range(start + 50, len(lines)):
    if "Table 1-13" in lines[j] or re.match(r"^\s*1\.12\b", lines[j]):
        end = j
        break
print("atmel range lines %d..%d" % (start + 1, end + 1))
rows = []
# Atmel fixed-width columns:
#   cols 27..56 : mnemonic field (mnemonic + operands, operands padded inside it)
#   cols 56..98 : description (continuation lines are indented into this column only)
#   col  ~98    : Byte count
#   col ~110    : Oscillator Period (clocks)
for i in range(start, end):
    ln = lines[i]
    head = ln[27:56]
    m = re.match(r"^\s*(" + MN + r")\b(.*)$", head)
    if not m:
        continue
    mn = m.group(1)
    ops = m.group(2).strip()
    tail = ln[56:]
    mt = re.search(r"(\d+)\s+(\d+)\s*$", tail)
    if not mt:
        continue
    desc = tail[: mt.start()].strip()
    # The operand field is narrower than the gap in the pdftotext output, so the
    # first letter of the Description column can bleed into it (e.g. 'A,Rn  E' +
    # 'xchange...').  Detect it by "space(s) + one letter" and strip it; prepend the
    # letter back onto the description.  A pure single-token operand such as the
    # carry flag 'C' is kept as-is.
    mb = re.match(r"^(.*\S)\s+([A-Za-z])$", ops)
    if mb and desc[:1] == mb.group(2) and ops != mb.group(2):
        ops = mb.group(1)
        desc = mb.group(2) + desc
    rows.append({"line": i + 1, "mnemonic": mn, "operands": ops, "desc": desc,
                 "bytes": int(mt.group(1)), "clocks": int(mt.group(2))})

print("atmel rows:", len(rows))
for r in rows[:12]:
    print("  ", r)

doc = {"source": "atmel_hw_manual",
       "url": "https://ww1.microchip.com/downloads/en/DeviceDoc/doc4316.pdf",
       "note": "Atmel 8051 Microcontrollers Hardware Manual 4316E-8051-01/07, section 1.11 Instruction Set Summary; "
               "'Oscillator Period' is in oscillator clocks -> machine cycles = clocks/12",
       "rows": rows}
json.dump(doc, open(os.path.join(OUT, "atmel.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
