# -*- coding: utf-8 -*-
"""Verify the cycle/byte template (cycles.py) against the Atmel 8051 Hardware
   Manual instruction-set summary (4316E section 1.11) and the Keil opcode table.

Reference generic forms (Rn, @Ri, direct-as-metavariable, bit) are *expanded*
into every concrete Keil form first, so each opcode row is checked against an
exact reference row.
"""
import os, re, json, sys, itertools, collections

HERE = r"C:\Users\ZCB\Desktop\STCsimulator\research"
P = os.path.join(HERE, "parsed")
sys.path.insert(0, HERE)
from canon import canon_operands, ref_matches  # noqa: E402
import cycles as C  # noqa: E402

keil = {int(k): v for k, v in json.load(open(os.path.join(P, "keil.json"), encoding="utf-8"))["table"].items()}
actel = {int(k): v for k, v in json.load(open(os.path.join(P, "actel.json"), encoding="utf-8"))["table"].items()}
atmel_rows = json.load(open(os.path.join(P, "atmel.json"), encoding="utf-8"))["rows"]

ATMEL_FIX = {
    ("ANL", "direct,#da"): ("ANL", "direct,#data"),
    ("ORL", "direct,#da"): ("ORL", "direct,#data"),
    ("XRL", "direct,#da"): ("XRL", "direct,#data"),
    ("MOV", "direct,dir"): ("MOV", "direct,direct"),
    ("CJNE", "A,direct,r"): ("CJNE", "A,direct,rel"),
    ("CJNE", "A,#data,re"): ("CJNE", "A,#data,rel"),
    ("CJNE", "Rn,#data,r"): ("CJNE", "Rn,#data,rel"),
    ("CJNE", "@Ri,#data,"): ("CJNE", "@Ri,#data,rel"),
}
# tokens that legitimately end an operand field; anything else that duplicates
# the first letter of the Description column is column bleed
OK_TAIL = re.compile(r"(Rn|R[0-7]|A|C|bit|/bit|direct|rel|immed|immed16|data|data16|"
                     r"addr11|addr16|DPTR|AB|@Ri|@R[01]|@DPTR|@A\+DPTR|@A\+PC)$")

atmel = []
for r in atmel_rows:
    mn, ops, desc = r["mnemonic"], r["operands"], " ".join(r["desc"].split())
    if (mn, ops) in ATMEL_FIX:
        mn, ops = ATMEL_FIX[(mn, ops)]
    elif desc and ops and len(ops) > 4 and ops[-1].isalpha() and desc[0] == ops[-1] \
            and not OK_TAIL.search(ops):
        ops = ops[:-1].strip()
    atmel.append({"mnemonic": mn, "ops": canon_operands(ops), "bytes": r["bytes"],
                  "cycles": r["clocks"] // 12, "clocks": r["clocks"],
                  "raw_ops": r["operands"], "line": r["line"], "desc": desc})

REGS = ["R%d" % i for i in range(8)]
IRI = ["@R0", "@R1"]


def expand(ops):
    """Expand a generic reference operand string into concrete strings,
       most-specific first: Rn, @Ri, then direct-as-metavariable."""
    if ops is None:
        return []
    toks = ops.split(",") if ops != "" else [""]
    alts = []
    for t in toks:
        if t == "Rn":
            alts.append(REGS)
        elif t == "@Ri":
            alts.append(IRI)
        elif t == "direct":
            # Intel/Atmel spell the register operand 'Rn' and the indirect one
            # '@Ri' as separate rows, so 'direct' here means the directly
            # addressed byte only.
            alts.append(["direct"])
        elif t == "bit":
            alts.append(["bit"])
        else:
            alts.append([t])
    # sort so that register/indirect interpretations precede the 'direct' reading
    order = {"Rn": 0, "@Ri": 0, "direct": 2, "bit": 1, "": 0}
    per_tok = []
    for t, a in zip(toks, alts):
        per_tok.append(sorted(a, key=lambda v: (v == "direct") * 3 + (v in REGS) * 1 + (v in IRI) * 2))
    return [",".join(c) for c in itertools.product(*per_tok)]


def specificity(a):
    """Lower = more specific. Rows that use Rn / @Ri / bit are preferred over
       rows that use the 'direct' metavariable in the same position."""
    toks = (a["ops"] or "").split(",")
    generics = sum(1 for t in toks if t in ("direct", "bit"))
    specials = sum(1 for t in toks if t in ("Rn", "@Ri"))
    return (generics * 2, -specials, len(toks))


# exact reference map: (mnemonic, concrete-canon-operands) -> (bytes, cycles).
# Rows are inserted most-specific-first (rows whose operands use the generic
# 'direct'/'bit' metavariables are considered last); a concrete key that two rows
# disagree about is marked disputed and dropped from the comparison rather than
# silently resolved.
ref, disputed, ref_conflict = {}, set(), []


def specificity(a):
    toks = a["ops"].split(",") if a["ops"] else [""]
    generics = sum(1 for t in toks if t in ("direct", "bit"))
    specials = sum(1 for t in toks if t in ("Rn", "@Ri"))
    return (generics, -specials, len(toks))


for a in sorted(atmel, key=specificity):
    v = (a["bytes"], a["cycles"])
    for c in expand(a["ops"]):
        k = (a["mnemonic"], c)
        if k in ref and ref[k] != v:
            ref_conflict.append((k, ref[k], v, a["line"], a["raw_ops"]))
            disputed.add(k)
            continue
        ref.setdefault(k, v)
for k in disputed:
    ref.pop(k, None)

print("=== Atmel reference entries: %d (from %d rows) ===" % (len(ref), len(atmel)))
print("conflicting expansions:", len(ref_conflict))
for c in ref_conflict[:20]:
    print("   ", c)

# ---- 1. template vs Keil bytes, all 256
print("\n=== 1. template (cycles.py) vs Keil bytes, all 256 opcodes ===")
rows, problems = [], []
for op in range(256):
    k = keil[op]
    mn = k["mnemonic"].strip().upper()
    if mn == "RESERVED":
        rows.append({"op": op, "mnemonic": mn, "canon": "", "bytes": None, "cycles": None})
        continue
    c = canon_operands(k["operands"])
    nb, nc = C.lookup(mn, c)
    rows.append({"op": op, "mnemonic": mn, "canon": c, "bytes": nb, "cycles": nc})
    if nb is None:
        problems.append(("no-template", "0x%02X" % op, mn, c))
    elif k["bytes"] is not None and nb != k["bytes"]:
        problems.append(("bytes-vs-keil", "0x%02X" % op, mn, c, "template=%d keil=%d" % (nb, k["bytes"])))
print("problems:", len(problems))
for p in problems:
    print("   ", p)

# ---- 2. template vs Atmel reference, all 256
print("\n=== 2. template vs Atmel instruction-set-summary, all 256 opcodes ===")
diffs, noref = [], []
for r in rows:
    if r["mnemonic"] == "RESERVED":
        continue
    key = (r["mnemonic"], r["canon"])
    if key not in ref:
        noref.append(("0x%02X" % r["op"], r["mnemonic"], r["canon"]))
        continue
    if (r["bytes"], r["cycles"]) != ref[key]:
        diffs.append(("0x%02X" % r["op"], r["mnemonic"], r["canon"],
                      "template=%s" % ((r["bytes"], r["cycles"]),), "atmel=%s" % (ref[key],)))
print("value differences:", len(diffs))
for d in diffs:
    print("   ", d)
print("no Atmel reference row:", len(noref))
for n in noref:
    print("   ", n)

json.dump({"template_problems": problems, "atmel_diffs": diffs, "no_atmel_ref": noref,
           "ref_rows": {"%s|%s" % k: v for k, v in ref.items()},
           "atmel_rows": atmel, "ref_conflicts": [list(map(str, c)) for c in ref_conflict]},
          open(os.path.join(P, "verify.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
