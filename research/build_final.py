# -*- coding: utf-8 -*-
"""FINAL BUILD: research/8051-opcodes.json  (256 opcode entries)

Structure (top level is an object with an "opcodes" array):
{
  "about": {...},
  "opcodes": [ {op, mnemonic, operands, bytes, cycles, flags}, ... ],
  "mnemonics": [...],          # deduplicated mnemonic set
  "reserved": [...],           # reserved/undefined opcodes
  "stats": {...}
}

Data provenance (see 8051-opcodes-sources.md):
  structure/mnemonic/operands/bytes : Keil 8051 opcode table  (hex -> mnemonic, bytes, operands)
                                      cross-checked against Actel Core8051 Table 16 (hex -> mnemonic+operands)
                                      and Atmel 4316E section 1.11
  cycles                            : Intel MCS-51 User's Manual Jan81 Table 3-2 + Table 4 (machine cycles)
                                      and Atmel 4316E section 1.11 (oscillator period / 12)
  flags                             : Actel Core8051 Table 17 + Atmel 4316E Table 1-13 (CY/OV/AC),
                                      parity flag derived from "instruction writes the Accumulator"
"""
import os, re, json, sys, collections

HERE = r"C:\Users\ZCB\Desktop\STCsimulator\research"
P = os.path.join(HERE, "parsed")
sys.path.insert(0, HERE)
from canon import canon_operands  # noqa: E402
from cn_notes import CN_NOTES  # noqa: E402
import cycles as C  # noqa: E402

keil = {int(k): v for k, v in json.load(open(os.path.join(P, "keil.json"), encoding="utf-8"))["table"].items()}
actel_doc = json.load(open(os.path.join(P, "actel.json"), encoding="utf-8"))
actel = {int(k): v for k, v in actel_doc["table"].items()}
aeb = {int(k): v for k, v in json.load(open(os.path.join(P, "aeb.json"), encoding="utf-8"))["table"].items()}

# ---------------------------------------------------------------- flags
# CY/OV/AC affected (verbatim from Actel Core8051 Table 17 "PSW Flag
# Modification (CY, OV, AC)", confirmed by Atmel 4316E Table 1-13).
FLAG_BASE = {
    ("ADD", None): ["CY", "OV", "AC"], ("ADDC", None): ["CY", "OV", "AC"],
    ("SUBB", None): ["CY", "OV", "AC"], ("MUL", "AB"): ["CY", "OV"],
    ("DIV", "AB"): ["CY", "OV"], ("DA", "A"): ["CY"],
    ("RRC", "A"): ["CY"], ("RLC", "A"): ["CY"],
    ("SETB", "C"): ["CY"], ("CLR", "C"): ["CY"], ("CPL", "C"): ["CY"],
    ("ANL", "C,bit"): ["CY"], ("ANL", "C,/bit"): ["CY"],
    ("ORL", "C,bit"): ["CY"], ("ORL", "C,/bit"): ["CY"],
    ("MOV", "C,bit"): ["CY"], ("CJNE", None): ["CY"],
}
# instructions that write the Accumulator -> parity flag P is recomputed
WRITES_A = {
    ("ADD",), ("ADDC",), ("SUBB",), ("INC", "A"), ("DEC", "A"), ("MUL",), ("DIV",),
    ("DA", "A"), ("ANL", "A"), ("ORL", "A"), ("XRL", "A"), ("CLR", "A"),
    ("CPL", "A"), ("RL", "A"), ("RLC", "A"), ("RR", "A"), ("RRC", "A"),
    ("SWAP", "A"), ("MOV", "A"), ("MOVC", "A"), ("MOVX", "A"), ("XCH", "A"),
    ("XCHD", "A"), ("POP", "A"),
}


def flags_for(mn, canon):
    """Return the sorted list of PSW flags affected by this instruction."""
    out = set()
    for (k1, k2), fl in FLAG_BASE.items():
        if k1 != mn:
            continue
        if k2 is None or k2 == canon:
            out.update(fl)
    # parity: set when the instruction writes the Accumulator
    for w in WRITES_A:
        if w[0] != mn:
            continue
        if len(w) == 1 or (canon or "").split(",")[0] == w[1] or (canon or "").startswith("A,"):
            out.add("P")
            break
    order = {"CY": 0, "AC": 1, "OV": 2, "P": 3}
    return sorted(out, key=lambda f: order.get(f, 9))


# Keil spells two operand tokens differently from the requested notation
OPERAND_SPELLING = [
    (r"\boffset\b", "rel"),
    (r"#immed16\b", "#immed16"),
    (r"#immed\b", "#immed"),
]


def pretty_operands(raw):
    """Uniform operand notation: 'rel' instead of 'offset', '#immed' instead of '#immed'."""
    s = (raw or "").strip()
    if not s:
        return ""
    for pat, rep in OPERAND_SPELLING:
        s = re.sub(pat, rep, s)
    return re.sub(r"\s*,\s*", ",", s)


# ---------------------------------------------------------------- build
opcodes, discrepancies = [], []

for op in range(256):
    k = keil[op]
    mn = k["mnemonic"].strip().upper()
    if mn == "RESERVED":
        opcodes.append({
            "op": op, "mnemonic": "RESERVED", "operands": "", "bytes": None,
            "cycles": None, "flags": [],
            "note": "Reserved / undefined in the standard MCS-51 opcode map. Intel, Keil and Actel "
                    "all leave 0xA5 undefined; Atmel notes it behaves as a 1-cycle NOP-like no-op "
                    "on the original 8051. Several vendors reuse it (Philips P89C669 SFR-page "
                    "prefix, M8051W/M8051EW MOVC @(DPTR++),A / TRAP).",
        })
        continue

    raw_ops = k["operands"] or ""
    canon = canon_operands(raw_ops)
    nb, nc = C.lookup(mn, canon)

    # --- provenance / agreement checks
    actel_mn = (actel.get(op) or {}).get("mnemonic")
    actel_raw = (actel.get(op) or {}).get("raw")
    aeb_b = (aeb.get(op) or {}).get("bytes")
    if actel_mn and actel_mn != mn:
        discrepancies.append({"op": "0x%02X" % op, "field": "mnemonic",
                              "keil": mn, "actel": actel_raw})
    if aeb_b is not None and nb is not None and aeb_b != nb:
        discrepancies.append({"op": "0x%02X" % op, "field": "bytes",
                              "keil": nb, "aeb": aeb_b})

    opcodes.append({
        "op": op,
        "mnemonic": mn,
        "operands": pretty_operands(raw_ops),
        "bytes": nb if nb is not None else k["bytes"],
        "cycles": nc,
        "flags": flags_for(mn, canon),
        "cn": CN_NOTES.get(mn, ""),
    })

# ---------------------------------------------------------------- checks
assert len(opcodes) == 256, len(opcodes)
ops = [e["op"] for e in opcodes]
assert ops == list(range(256)), "opcode coverage broken"
assert len(set(ops)) == 256, "duplicate opcodes"

missing = [e for e in opcodes if e["mnemonic"] != "RESERVED" and (e["bytes"] is None or e["cycles"] is None)]
by_len = collections.Counter(e["bytes"] for e in opcodes)
reserved = [e["op"] for e in opcodes if e["mnemonic"] == "RESERVED"]
mnemonics = sorted({e["mnemonic"] for e in opcodes})
mnemonics_no_res = [m for m in mnemonics if m != "RESERVED"]

doc = {
    "about": {
        "name": "8051 (MCS-51) complete opcode table",
        "description": "All 256 opcodes of the Intel MCS-51 (8051) instruction set. Top level is an "
                       "object; the 256 entries are in the \"opcodes\" array, ordered by decimal opcode 0..255.",
        "notation": {
            "operands": "comma separated. Tokens: A B C AB DPTR R0..R7 Rn @R0 @R1 @Ri @DPTR "
                        "@A+DPTR @A+PC direct bit /bit rel addr11 addr16 #immed #immed16. "
                        "Note: the table lists every concrete opcode, so register/indirect forms are "
                        "expanded (R0..R7, @R0, @R1) rather than left as Rn/@Ri.",
            "bytes": "instruction length in bytes including the opcode",
            "cycles": "standard 8051 machine cycles (12 oscillator clocks each). null only for the reserved opcode.",
            "flags": "PSW flags affected by the instruction: CY, AC, OV, P. Empty array = no PSW flag affected.",
        },
        "sources": [
            "https://www.keil.com/support/man/docs/is51/is51_opcodes.asp",
            "https://www.keil.com/dd/docs/datashts/actel/8051ds-adv.pdf",
            "https://ww1.microchip.com/downloads/en/DeviceDoc/doc4316.pdf",
            "https://www.bitsavers.org/components/intel/8051/MCS-51_Users_Manual_Jan81.pdf",
            "https://mirrorservice.org/sites/www.bitsavers.org/components/intel/_dataBooks/1988_Intel_Embedded_Controller_Handbook_Volume_I_8-Bit.pdf",
            "https://www.win.tue.nl/~aeb/comp/8051/set8051.html",
            "https://raw.githubusercontent.com/mikeakohn/naken_asm/master/table/8051.cpp",
        ],
        "generated_by": "research/build_final.py",
    },
    "stats": {
        "total": 256,
        "reserved": reserved,
        "undefined_or_incomplete": [e["op"] for e in missing],
        "bytes_distribution": {str(k): v for k, v in sorted(by_len.items(), key=lambda x: (x[0] is None, x[0]))},
        "cycles_distribution": {str(k): v for k, v in sorted(
            collections.Counter(e["cycles"] for e in opcodes).items(), key=lambda x: (x[0] is None, x[0]))},
        "distinct_mnemonics": len(mnemonics_no_res),
        "mnemonic_list": mnemonics_no_res,
    },
    "opcodes": opcodes,
}

with open(os.path.join(HERE, "8051-opcodes.json"), "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)

print("wrote 8051-opcodes.json  entries=%d" % len(opcodes))
print("bytes distribution:", doc["stats"]["bytes_distribution"])
print("cycles distribution:", doc["stats"]["cycles_distribution"])
print("reserved:", ["0x%02X" % r for r in reserved])
print("incomplete:", ["0x%02X" % e["op"] for e in missing])
print("distinct mnemonics (%d): %s" % (len(mnemonics_no_res), " ".join(mnemonics_no_res)))
print("\ninternal cross-source discrepancies (non-fatal):", len(discrepancies))
for d in discrepancies:
    print("  ", d)
json.dump(discrepancies, open(os.path.join(P, "final_discrepancies.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
