# -*- coding: utf-8 -*-
"""
Parse multiple independent 8051 opcode-table sources into a common JSON form.
Each source -> {opcode: {"mnemonic":..., "operands":..., "bytes":...}}
Output: research\parsed\<source>.json  (raw per-source extraction, untouched)
"""
import os, re, json, html, sys

RAW = r"C:\Users\ZCB\Desktop\STCsimulator\research\raw"
OUT = r"C:\Users\ZCB\Desktop\STCsimulator\research\parsed"
os.makedirs(OUT, exist_ok=True)


def strip_tags(s):
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = s.replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def save(name, table, meta):
    doc = {"source": name, "meta": meta, "table": {str(k): v for k, v in sorted(table.items())}}
    with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print("%-14s entries=%d" % (name, len(table)))


# ---------------------------------------------------------------- SOURCE 1: Keil
def parse_keil():
    p = os.path.join(RAW, "keil_is51_opcodes_full.html")
    h = open(p, encoding="utf-8", errors="replace").read()
    tables = re.findall(r'(?s)<table class="kt".*?</table>', h)
    rows = []
    for t in tables:
        for tr in re.findall(r"(?s)<tr class=\"kt\">(.*?)</tr>", t):
            tds = re.findall(r"(?s)<t[dh][^>]*>(.*?)</t[dh]>", tr)
            if len(tds) != 4:
                continue
            code = strip_tags(tds[0])
            if not re.fullmatch(r"[0-9A-Fa-f]{2}", code):
                continue
            rows.append((code, strip_tags(tds[1]), strip_tags(tds[2]), strip_tags(tds[3])))
    table = {}
    for code, nbytes, mn, ops in rows:
        op = int(code, 16)
        table[op] = {"mnemonic": mn.upper(), "operands": ops, "bytes": int(nbytes) if nbytes.isdigit() else None}
    save("keil", table, {"url": "https://www.keil.com/support/man/docs/is51/is51_opcodes.asp",
                         "rows_parsed": len(rows)})
    return table


# ---------------------------------------------------------------- SOURCE 2: AEB / GSE
def parse_aeb():
    """aeb_set8051.html: (a) 16x16 opcode map of mnemonics, (b) detail tables with bytes+flags."""
    p = os.path.join(RAW, "aeb_set8051.html")
    h = open(p, encoding="utf-8", errors="replace").read()
    map_tbl = h[: h.index("</TABLE>", h.index("<TABLE BORDER=1>"))]
    grid = {}
    for tr in re.findall(r"(?s)<TR>(.*?)</TR>", map_tbl):
        cells = re.findall(r"(?s)<T[HD][^>]*>(.*?)</T[HD]>", tr)
        if not cells:
            continue
        hi = strip_tags(cells[0])
        m = re.fullmatch(r"0x([0-9a-fA-F]{2})", hi)
        if not m:
            continue
        base = int(m.group(1), 16)
        for i, c in enumerate(cells[1:]):
            txt = strip_tags(c)
            if txt:
                grid[base + i] = txt.upper()
    # detail tables: Instructions | OpCode | Bytes | Flags
    detail = {}
    for tbl in re.findall(r"(?s)<TABLE BORDER=1 CELLPADDING=4 >(.*?)</TABLE>", h):
        for tr in re.findall(r"(?s)<TR ALIGN=CENTER>(.*?)</TR>", tbl):
            cells = re.findall(r"(?s)<TD[^>]*>(.*?)</TD>", tr)
            if len(cells) != 4:
                continue
            instr = strip_tags(cells[0])
            opc = strip_tags(cells[1])
            if not re.fullmatch(r"0x[0-9a-fA-F]{2}", opc):
                continue
            detail[int(opc, 16)] = {"instruction": instr,
                                    "bytes": int(strip_tags(cells[2])) if strip_tags(cells[2]).isdigit() else None,
                                    "flags": strip_tags(cells[3])}
    table = {}
    for op in sorted(set(grid) | set(detail)):
        d = detail.get(op, {})
        table[op] = {"mnemonic": grid.get(op),
                     "operands": None,
                     "bytes": d.get("bytes"),
                     "instruction": d.get("instruction"),
                     "flags_raw": d.get("flags")}
    save("aeb", table, {"url": "https://www.win.tue.nl/~aeb/comp/8051/set8051.html",
                        "opcode_map_entries": len(grid), "detail_entries": len(detail)})
    return table


# ---------------------------------------------------------------- SOURCE 3: naken_asm
def parse_naken():
    p = os.path.join(RAW, "naken_asm_8051_alt.cpp")
    txt = open(p, encoding="utf-8", errors="replace").read()
    table = {}
    for m in re.finditer(r'\{\s*"([a-z0-9]+)"\s*,\s*\{([^}]*)\}\s*,\s*(-?\d+)\s*\}\s*,\s*//\s*(0x[0-9a-fA-F]{2})', txt):
        mn, args, variant, code = m.group(1), m.group(2), int(m.group(3)), int(m.group(4), 16)
        ops = [a.strip().replace("OP_", "").lower() for a in args.split(",")]
        ops = [o for o in ops if o and o != "none"]
        table[code] = {"mnemonic": mn.upper(), "operands_raw": ops, "variant": variant, "bytes": None}
    save("naken_asm", table, {"url": "https://raw.githubusercontent.com/mikeakohn/naken_asm/master/table/8051.cpp",
                              "note": "assembler table; operands are addressing-mode enums", "count": len(table)})
    return table


# ---------------------------------------------------------------- SOURCE 4: Vartan/JS51.js emulator
def parse_js51_vartan():
    p = os.path.join(RAW, "vjs51_JS51.js")
    txt = open(p, encoding="utf-8", errors="replace").read()
    table = {}
    # look for opcode table definitions e.g.  opcodes[0x00] = ...
    for m in re.finditer(r"(?m)^\s*(?:opcodes?|OPCODES?|instructionTable)\s*\[\s*(0x[0-9a-fA-F]+|\d+)\s*\]\s*=", txt):
        pass
    # Fallback: find "INS.<NAME>" style dispatch or a big switch
    for m in re.finditer(r"case\s+(0x[0-9a-fA-F]+|\d+)\s*:\s*//\s*([A-Za-z0-9 ,#@+\.\-/]+)", txt):
        code = int(m.group(1), 16) if m.group(1).lower().startswith("0x") else int(m.group(1))
        table[code] = {"comment": m.group(2).strip()}
    if table:
        save("js51_vartan", table, {"url": "https://raw.githubusercontent.com/Vartan/JS51/master/js/JS51.js",
                                    "kind": "switch-case comments", "count": len(table)})
    else:
        print("js51_vartan   : no table found")
    return table


# ---------------------------------------------------------------- SOURCE 5: MentzJ opcodes.ts
def parse_mentzj():
    p = os.path.join(RAW, "mentzj_opcodes.ts")
    txt = open(p, encoding="utf-8", errors="replace").read()
    table = {}
    for m in re.finditer(r"table\[(0x[0-9a-fA-F]+|\d+)\]\s*=", txt):
        code = int(m.group(1), 16) if m.group(1).lower().startswith("0x") else int(m.group(1))
        table[code] = {"source": "mentzj"}
    # enrich with nearest preceding comment
    lines = txt.splitlines()
    for i, ln in enumerate(lines):
        m = re.match(r"\s*table\[(0x[0-9a-fA-F]+|\d+)\]\s*=", ln)
        if m:
            code = int(m.group(1), 16) if m.group(1).lower().startswith("0x") else int(m.group(1))
            # find comment above
            for j in range(i, max(-1, i - 8), -1):
                c = re.search(r"//\s*([A-Za-z0-9 ,#@+\.\-/\[\]]+)", lines[j])
                if c:
                    table[code] = {"comment": c.group(1).strip()}
                    break
    save("mentzj", table, {"url": "https://raw.githubusercontent.com/MentzJ/8051_simulator/main/src/opcodes.ts",
                           "kind": "switch table + comments", "count": len(table)})
    return table


# ---------------------------------------------------------------- SOURCE 6: Intel PDF (if text extractable)
def parse_intel_pdf():
    p = os.path.join(RAW, "intel_MCS-51_Users_Manual_Jan81.pdf")
    try:
        import pypdf  # noqa
    except Exception:
        print("intel_pdf     : pypdf unavailable")
        return {}
    return {}


if __name__ == "__main__":
    k = parse_keil()
    a = parse_aeb()
    n = parse_naken()
    v = parse_js51_vartan()
    mz = parse_mentzj()
    print("\nkeil codes missing:", [hex(i) for i in range(256) if i not in k])
    print("aeb  codes missing:", [hex(i) for i in range(256) if i not in a])
