# -*- coding: utf-8 -*-
"""Canonicalise operand notation across sources into a common token form.

Canonical tokens (task spec):
  A B C AB DPTR R0..R7 Rn @R0 @R1 @Ri @DPTR @A+DPTR @A+PC
  direct bit /bit rel addr11 addr16 #immed #immed16
"""
import re

# single-pass substitution: longest / most specific alternatives first
_PAT = re.compile(
    r"#\s*data\s*16\b|#\s*data16\b|#\s*immed16\b|#\s*data\b|#\s*immed\b|#\s*d\b|"
    r"\bimmed16\b|\bimmed\b|\bdata16\b|\bdata\b|"
    r"\boffset\b|\breladdr\b|\brel\b|"
    r"\biram\s*addr\b|\bbit\s*addr\b|\bcode\s*addr\b|\bdir\b|"
    r"@\s*A\s*\+\s*DPTR|@\s*A\s*\+\s*PC|@\s*A\s*\+\s*R0|"
    r"@\s*Ri\b|@\s*R0\b|@\s*R1\b|@\s*DPTR\b|"
    r"\baddr\s*11\b|\baddr\s*16\b|\bpage\b|\baccumulator\b",
    re.I,
)


def _repl(m):
    t = re.sub(r"\s+", "", m.group(0)).lower()
    if t.startswith("#"):
        t = t[1:]
        if t in ("data16", "immed16", "d16"):
            return "#immed16"
        return "#immed"
    return {
        "immed16": "#immed16", "data16": "#immed16",
        "immed": "#immed", "data": "#immed",
        "offset": "rel", "reladdr": "rel", "rel": "rel",
        "iramaddr": "direct", "bitaddr": "bit", "codeaddr": "addr16",
        "dir": "direct",
        "@a+dptr": "@A+DPTR", "@a+pc": "@A+PC", "@a+r0": "@A+DPTR",
        "@ri": "@Ri", "@r0": "@R0", "@r1": "@R1", "@dptr": "@DPTR",
        "addr11": "addr11", "addr16": "addr16", "page": "addr11",
        "accumulator": "A",
    }[t]


def canon_operands(s):
    """Return canonical comma-joined operand string (spaces removed)."""
    if s is None:
        return None
    s = s.strip().replace("\u2013", "-").replace("\u2014", "-")
    if s in ("", "-", "none"):
        return ""
    s = re.sub(r"\s+", " ", s)
    parts = [p.strip() for p in s.split(",")]
    return ",".join(_PAT.sub(_repl, p).replace(" ", "") for p in parts)


def as_pattern(canon):
    """Reference-canonical string -> regex matching expanded Keil forms."""
    if canon is None:
        return None
    toks = canon.split(",") if canon != "" else []

    def esc(t):
        return re.sub(r"([.^$*+?()\[\]{}|\\])", r"\\\1", t)

    out = []
    for t in toks:
        if t == "Rn":
            out.append("R[0-7]")
        elif t == "@Ri":
            out.append("@R[01]")
        elif t == "direct":
            out.append("(?:direct|R[0-7]|@R[01])")
        elif t == "bit":
            out.append("(?:bit|C)")
        else:
            out.append(esc(t))
    return "^" + ",".join(out) + "$"


def ref_matches(ref_canon, keil_canon):
    """True if a (possibly generic) reference operand string expands onto the
       fully expanded Keil operand string."""
    if ref_canon is None or keil_canon is None:
        return False
    p = as_pattern(ref_canon)
    return re.fullmatch(p, keil_canon) is not None


if __name__ == "__main__":
    for t in ["A, #immed", "bit, offset", "direct, #immed", "DPTR, #immed16",
              "A, @A+DPTR", "C, /bit", "A, #data", "addr11", "", "Rn, #data, rel",
              "A, @Ri", "A, R7", "direct, direct", "@Ri, #data", "C, bit"]:
        c = canon_operands(t)
        print("%-22r -> %-26r pat=%s" % (t, c, as_pattern(c)))
