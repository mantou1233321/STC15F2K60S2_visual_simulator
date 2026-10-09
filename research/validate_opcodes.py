# -*- coding: utf-8 -*-
"""Standalone validation of research/8051-opcodes.json.

Run:  python research/validate_opcodes.py
Exit code 0 = all checks passed.
"""
import json, os, sys, collections, re

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "8051-opcodes.json")

errors, warnings = [], []

doc = json.load(open(PATH, encoding="utf-8"))
assert isinstance(doc, dict) and "opcodes" in doc, "top level must be an object with an 'opcodes' array"
rows = doc["opcodes"]

# ---- 1. coverage
ops = [r["op"] for r in rows]
if len(rows) != 256:
    errors.append("expected 256 entries, got %d" % len(rows))
if sorted(ops) != list(range(256)):
    missing = sorted(set(range(256)) - set(ops))
    dupes = [o for o, n in collections.Counter(ops).items() if n > 1]
    errors.append("opcode coverage broken: missing=%s duplicates=%s"
                  % (["0x%02X" % m for m in missing], ["0x%02X" % d for d in dupes]))

# ---- 2. field sanity
ALLOWED_TOK = {"A", "B", "C", "AB", "DPTR", "Rn", "@Ri", "@DPTR", "@A+DPTR", "@A+PC",
               "direct", "bit", "/bit", "rel", "addr11", "addr16", "#immed", "#immed16"}
for r in rows:
    for f in ("op", "mnemonic", "operands", "bytes", "cycles", "flags"):
        if f not in r:
            errors.append("0x%02X missing field %s" % (r["op"], f))
    if r["mnemonic"] != r["mnemonic"].upper():
        errors.append("0x%02X mnemonic not upper case: %r" % (r["op"], r["mnemonic"]))
    if r["mnemonic"] == "RESERVED":
        continue
    if r["bytes"] not in (1, 2, 3):
        errors.append("0x%02X %s invalid byte count %r" % (r["op"], r["mnemonic"], r["bytes"]))
    if r["cycles"] not in (1, 2, 4):
        errors.append("0x%02X %s invalid cycle count %r" % (r["op"], r["mnemonic"], r["cycles"]))
    for f in r["flags"]:
        if f not in ("CY", "AC", "OV", "P"):
            errors.append("0x%02X unknown flag %r" % (r["op"], f))
    # operands must be reachable from the allowed vocabulary
    for t in (r["operands"] or "").split(","):
        t = t.strip()
        if not t:
            continue
        if t in ALLOWED_TOK or re.fullmatch(r"R[0-7]", t) or re.fullmatch(r"@R[01]", t):
            continue
        if re.fullmatch(r"#immed(16)?", t):
            continue
        errors.append("0x%02X %s operand token not in vocabulary: %r"
                      % (r["op"], r["mnemonic"], t))

# ---- 3. documented structural rules (the ones the task called out)
def expect(op, mnem, operands, nbytes, ncyc, flags=None):
    r = rows[op]
    if r["mnemonic"] != mnem or r["operands"] != operands:
        errors.append("0x%02X expected %s %s, got %s %s"
                      % (op, mnem, operands, r["mnemonic"], r["operands"]))
        return
    if r["bytes"] != nbytes:
        errors.append("0x%02X %s %s expected %d bytes, got %s" % (op, mnem, operands, nbytes, r["bytes"]))
    if r["cycles"] != ncyc:
        errors.append("0x%02X %s %s expected %d cycles, got %s" % (op, mnem, operands, ncyc, r["cycles"]))
    if flags is not None and sorted(r["flags"]) != sorted(flags):
        errors.append("0x%02X %s %s expected flags %s, got %s"
                      % (op, mnem, operands, flags, r["flags"]))

expect(0x01, "AJMP", "addr11", 2, 2)
expect(0x11, "ACALL", "addr11", 2, 2)
expect(0x02, "LJMP", "addr16", 3, 2)
expect(0x12, "LCALL", "addr16", 3, 2)
expect(0x90, "MOV", "DPTR,#immed", 3, 2)
expect(0x85, "MOV", "direct,direct", 3, 2)
expect(0x10, "JBC", "bit,rel", 3, 2)
expect(0x20, "JB", "bit,rel", 3, 2)
expect(0x30, "JNB", "bit,rel", 3, 2)
expect(0xB4, "CJNE", "A,#immed,rel", 3, 2)
expect(0xB5, "CJNE", "A,direct,rel", 3, 2)
expect(0xD5, "DJNZ", "direct,rel", 3, 2)
expect(0xD8, "DJNZ", "R0,rel", 2, 2)
expect(0x80, "SJMP", "rel", 2, 2)
expect(0x00, "NOP", "", 1, 1)
expect(0x22, "RET", "", 1, 2)
expect(0x32, "RETI", "", 1, 2)
expect(0x73, "JMP", "@A+DPTR", 1, 2)
expect(0xA3, "INC", "DPTR", 1, 2)
expect(0xA4, "MUL", "AB", 1, 4, ["CY", "OV", "P"])
expect(0x84, "DIV", "AB", 1, 4, ["CY", "OV", "P"])
expect(0x24, "ADD", "A,#immed", 2, 1, ["CY", "AC", "OV", "P"])
expect(0x74, "MOV", "A,#immed", 2, 1, ["P"])
expect(0x75, "MOV", "direct,#immed", 3, 2, [])
expect(0xF5, "MOV", "direct,A", 2, 1, [])
expect(0xE0, "MOVX", "A,@DPTR", 1, 2, ["P"])
expect(0xF0, "MOVX", "@DPTR,A", 1, 2, [])
expect(0xC0, "PUSH", "direct", 2, 2, [])
expect(0xC3, "CLR", "C", 1, 1, ["CY"])
expect(0xE4, "CLR", "A", 1, 1, ["P"])
expect(0x92, "MOV", "bit,C", 2, 2, [])
expect(0xA2, "MOV", "C,bit", 2, 1, ["CY"])
expect(0x33, "RLC", "A", 1, 1, ["CY", "P"])
expect(0xD4, "DA", "A", 1, 1, ["CY", "P"])

# ---- 4. statistics
by_len = collections.Counter(r["bytes"] for r in rows)
by_cyc = collections.Counter(r["cycles"] for r in rows)
reserved = [r["op"] for r in rows if r["mnemonic"] == "RESERVED"]
undef = [r["op"] for r in rows if r["mnemonic"] != "RESERVED" and (r["bytes"] is None or r["cycles"] is None)]
mnemonics = sorted({r["mnemonic"] for r in rows if r["mnemonic"] != "RESERVED"})

lines = []
lines.append("8051-opcodes.json validation")
lines.append("=" * 60)
lines.append("file            : %s" % PATH)
lines.append("entries         : %d" % len(rows))
lines.append("opcode coverage : 0..255 complete, no gaps, no duplicates" if not errors else "opcode coverage: FAILED")
lines.append("bytes dist.     : " + ", ".join("%s bytes = %d" % (k if k is not None else "null", v)
                                                 for k, v in sorted(by_len.items(), key=lambda x: (x[0] is None, x[0]))))
lines.append("cycles dist.    : " + ", ".join("%s cycles = %d" % (k if k is not None else "null", v)
                                                 for k, v in sorted(by_cyc.items(), key=lambda x: (x[0] is None, x[0]))))
lines.append("reserved codes  : " + (", ".join("0x%02X" % o for o in reserved) or "none"))
lines.append("undefined codes : " + (", ".join("0x%02X" % o for o in undef) or "none"))
lines.append("distinct mnemonics (%d): %s" % (len(mnemonics), " ".join(mnemonics)))
lines.append("")
lines.append("ERRORS   : %d" % len(errors))
for e in errors:
    lines.append("   " + e)
lines.append("WARNINGS : %d" % len(warnings))
for w in warnings:
    lines.append("   " + w)

text = "\n".join(lines)
print(text)
with open(os.path.join(HERE, "parsed", "validation-report.txt"), "w", encoding="utf-8") as f:
    f.write(text + "\n")
sys.exit(1 if errors else 0)
