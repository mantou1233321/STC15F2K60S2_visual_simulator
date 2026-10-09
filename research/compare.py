# -*- coding: utf-8 -*-
"""Cross-compare parsed sources: mnemonic + bytes per opcode."""
import os, json, re

P = r"C:\Users\ZCB\Desktop\STCsimulator\research\parsed"


def load(n):
    d = json.load(open(os.path.join(P, n + ".json"), encoding="utf-8"))
    return {int(k): v for k, v in d["table"].items()}


keil = load("keil")
aeb = load("aeb")
naken = load("naken_asm")

# normalise Keil operands -> canonical notation
def norm_ops(s):
    if s is None:
        return None
    s = s.strip()
    if s == "":
        return ""
    s = re.sub(r"\s*,\s*", ",", s)
    rep = [
        (r"^#immed$", "#immed"), (r"#immed", "#immed"),
        (r"\boffset\b", "rel"), (r"\breladdr\b", "rel"),
        (r"\biram addr\b", "direct"), (r"\bdata\b", "#immed"),
        (r"\bbit addr\b", "bit"),
    ]
    for a, b in rep:
        s = re.sub(a, b, s, flags=re.I)
    return s


print("=== A: opcode -> mnemonic  (Keil vs AEB grid vs naken) ===")
mm, bb = [], []
for op in range(256):
    km = keil[op]["mnemonic"]
    am = aeb[op]["mnemonic"]
    nm = naken.get(op, {}).get("mnemonic")
    if km != am:
        mm.append((op, km, am, nm))
    kb, ab = keil[op]["bytes"], aeb[op]["bytes"]
    if kb != ab:
        bb.append((op, kb, ab, aeb[op].get("instruction")))
print("mnemonic mismatches keil vs aeb:", len(mm))
for op, k, a, n in mm:
    print("  0x%02X keil=%-6s aeb=%-8s naken=%s" % (op, k, a, n))
print("byte-count mismatches keil vs aeb:", len(bb))
for op, k, a, ins in bb:
    print("  0x%02X keil=%s aeb=%s   (%s)  keil_ops=%r" % (op, k, a, ins, keil[op]["operands"]))

print("\n=== B: present in naken but opcode differs / naken missing ===")
print("naken missing:", [hex(i) for i in range(256) if i not in naken])
for op in range(256):
    k = keil[op]["mnemonic"]
    n = naken.get(op, {}).get("mnemonic")
    if n and k.lower() != n.lower():
        print("  0x%02X keil=%-6s naken=%-6s keil_ops=%r naken_ops=%r" % (op, k, n, keil[op]["operands"], naken[op]["operands_raw"]))

print("\n=== C: reserved / undefined ===")
for op in range(256):
    k = keil[op]
    if k["mnemonic"].lower() in ("reserved", "undefined", "") or k["bytes"] is None:
        print("  0x%02X keil=%r bytes=%r aeb=%r" % (op, k["mnemonic"], k["bytes"], aeb[op]))

print("\n=== D: byte-length distribution (Keil / AEB) ===")
from collections import Counter
ck = Counter(v["bytes"] for v in keil.values())
ca = Counter(v["bytes"] for v in aeb.values())
print("keil:", dict(sorted(ck.items(), key=lambda x: (x[0] is None, x[0]))))
print("aeb :", dict(sorted(ca.items(), key=lambda x: (x[0] is None, x[0]))))

print("\n=== E: AEB flags coverage ===")
print("distinct flags_raw:", sorted({v.get("flags_raw") for v in aeb.values() if v.get("flags_raw")}))
