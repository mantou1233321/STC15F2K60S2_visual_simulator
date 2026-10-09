# -*- coding: utf-8 -*-
"""Build the final 256-entry 8051 opcode table by combining *verified* sources
   and cross-checking every field.  Writes:
     research/8051-opcodes.json
     research/parsed/crosscheck.json   (all disagreements, machine readable)
"""
import os, re, json, sys
from collections import Counter, OrderedDict

HERE = r"C:\Users\ZCB\Desktop\STCsimulator\research"
P = os.path.join(HERE, "parsed")
sys.path.insert(0, HERE)
from canon import canon_operands, ref_matches, as_pattern  # noqa: E402

# ----------------------------------------------------------------- sources
keil = {int(k): v for k, v in json.load(open(os.path.join(P, "keil.json"), encoding="utf-8"))["table"].items()}
actel_doc = json.load(open(os.path.join(P, "actel.json"), encoding="utf-8"))
actel = {int(k): v for k, v in actel_doc["table"].items()}
aeb = {int(k): v for k, v in json.load(open(os.path.join(P, "aeb.json"), encoding="utf-8"))["table"].items()}
naken = {int(k): v for k, v in json.load(open(os.path.join(P, "naken_asm.json"), encoding="utf-8"))["table"].items()}
atmel_rows = json.load(open(os.path.join(P, "atmel.json"), encoding="utf-8"))["rows"]

# Atmel rows: fix the handful of column-spill artefacts seen in the extraction
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
# Strip a stray leading letter that belongs to the Description column
for r in atmel_rows:
    mn, ops = r["mnemonic"], r["operands"]
    if (mn, ops) in ATMEL_FIX:
        r["mnemonic"], r["operands"] = ATMEL_FIX[(mn, ops)]
    elif ops and r["desc"] and ops.endswith(r["desc"][0]) and len(ops) > 4:
        # e.g. operands 'direct,#data M' + desc 'ove immediate...'  -> drop the stray char
        if not re.match(r"^(Rn|R[0-7]|@Ri|A|C|bit|/bit|direct|addr11|addr16|DPTR|AB|rel|#)", ops[-2:].strip(" ")):
            r["operands"] = ops[:-1].strip()

# normalise Atmel into records keyed by canonical operand string
atmel_recs = []
for r in atmel_rows:
    c = canon_operands(r["operands"])
    atmel_recs.append({"mnemonic": r["mnemonic"], "operands": c,
                       "bytes": r["bytes"], "clocks": r["clocks"],
                       "desc": " ".join(r["desc"].split()), "line": r["line"]})

# ----------------------------------------------------------------- Keil base
BASE = []
for op in range(256):
    k = keil[op]
    mn = k["mnemonic"].strip().upper()
    raw_ops = k["operands"] or ""
    BASE.append({
        "op": op,
        "mnemonic": mn,
        "operands": raw_ops,
        "canon": canon_operands(raw_ops),
        "bytes_keil": k["bytes"],
    })

# ----------------------------------------------------------------- cross-check helpers
report = {"sources": {}, "disagreements": [], "notes": []}


def note(kind, op, field, values):
    report["disagreements"].append({"kind": kind, "op": "0x%02X" % op,
                                    "field": field, "values": values})


# 1) mnemonic: Keil vs Actel vs AEB vs naken
mn_counts = Counter()
for e in BASE:
    op, mn = e["op"], e["mnemonic"]
    others = {
        "actel": (actel.get(op) or {}).get("mnemonic"),
        "aeb": (aeb.get(op) or {}).get("mnemonic"),
        "naken": (naken.get(op) or {}).get("mnemonic"),
    }
    if op == 0xA5:
        continue
    for src, v in others.items():
        if v and v.upper() != mn:
            note("mnemonic", op, "mnemonic", {"keil": mn, src: v})
            mn_counts[src] += 1

# 2) bytes: Keil vs Actel? (Actel table has no bytes) -> use Atmel + AEB
bytes_disagree = []
for e in BASE:
    op = e["op"]
    if op == 0xA5:
        continue
    e["bytes_aeb"] = (aeb.get(op) or {}).get("bytes")
    if e["bytes_keil"] != e["bytes_aeb"]:
        bytes_disagree.append(op)
        note("bytes", op, "bytes", {"keil": e["bytes_keil"], "aeb": e["bytes_aeb"]})

# 3) cycles from Atmel; also capture Atmel bytes so they can be diffed
for e in BASE:
    if e["mnemonic"] == "RESERVED":
        e["cycles"] = None
        e["bytes_atmel"] = None
        e["atmel_desc"] = None
        continue
    pat = e["canon"]
    hits = [r for r in atmel_recs if r["mnemonic"] == e["mnemonic"] and ref_matches(r["operands"], pat)]
    if len(hits) == 1:
        e["cycles"] = hits[0]["clocks"] // 12
        e["clocks_raw"] = hits[0]["clocks"]
        e["bytes_atmel"] = hits[0]["bytes"]
        e["atmel_desc"] = hits[0]["desc"]
    else:
        e["cycles"] = None
        e["bytes_atmel"] = None
        e["atmel_desc"] = None
        e["atmel_hits"] = [(h["mnemonic"], h["operands"], h["bytes"], h["clocks"]) for h in hits]
        note("cycles-unmatched", e["op"], "cycles",
             {"keil_row": "%s %s" % (e["mnemonic"], e["operands"]), "atmel_candidates": e["atmel_hits"]})

missing_cycles = [e["op"] for e in BASE if e["cycles"] is None and e["mnemonic"] != "RESERVED"]
print("rows without a unique Atmel cycle match:", len(missing_cycles),
      ["0x%02X" % i for i in missing_cycles])

# 4) byte disagreement Keil vs Atmel
for e in BASE:
    if e["bytes_atmel"] is not None and e["bytes_keil"] != e["bytes_atmel"]:
        note("bytes", e["op"], "bytes", {"keil": e["bytes_keil"], "atmel": e["bytes_atmel"],
                                         "row": "%s %s" % (e["mnemonic"], e["operands"])})

out = {
    "base": BASE,
    "atmel_recs": atmel_recs,
    "missing_cycles": missing_cycles,
    "report": report,
}
json.dump(out, open(os.path.join(P, "build_stage1.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

print("\n=== disagreements ===")
for d in report["disagreements"]:
    print(d)
