# -*- coding: utf-8 -*-
"""Write research/raw/SOURCES-MANIFEST.md: every downloaded raw file with the
   URL it came from, its size and its SHA-256 (provenance for the report)."""
import os, hashlib, datetime

RAW = r"C:\Users\ZCB\Desktop\STCsimulator\research\raw"

# file name -> source URL (or "cloned from" / "extracted from")
URLS = {
    "keil_is51_opcodes.html": "https://www.keil.com/support/man/docs/is51/is51_opcodes.asp (partial stream capture)",
    "keil_is51_opcodes_full.html": "https://www.keil.com/support/man/docs/is51/is51_opcodes.asp",
    "keil_is51_instructions_full.html": "https://www.keil.com/support/man/docs/is51/is51_instructions.asp",
    "keil_is51_instructions.html": "https://www.keil.com/support/man/docs/is51/is51_instructions.asp",
    "aeb_set8051.html": "https://www.win.tue.nl/~aeb/comp/8051/set8051.html",
    "gse_8051instr": "https://gse.ufsc.br/bezerra/disciplinas/Microprocessadores/8051/doc/8051InstructionSet.htm (mirror of the tu/e page)",
    "actel_8051ds-adv.pdf": "https://www.keil.com/dd/docs/datashts/actel/8051ds-adv.pdf (Actel Core8051 Handbook)",
    "actel_8051ds-adv.txt": "pdftotext -layout actel_8051ds-adv.pdf",
    "atmel_8051_hw_manual.pdf": "https://ww1.microchip.com/downloads/en/DeviceDoc/doc4316.pdf (Atmel 8051 Microcontrollers Hardware Manual 4316E)",
    "atmel_8051_hw_manual.txt": "pdftotext -layout atmel_8051_hw_manual.pdf",
    "intel_MCS-51_Users_Manual_Jan81.pdf": "https://www.bitsavers.org/components/intel/8051/MCS-51_Users_Manual_Jan81.pdf",
    "intel_MCS-51_Users_Manual_Jan81.txt": "pdftotext -layout intel_MCS-51_Users_Manual_Jan81.pdf",
    "intel-1988-embedded-controller-handbook-vol1.pdf": "https://mirrorservice.org/sites/www.bitsavers.org/components/intel/_dataBooks/1988_Intel_Embedded_Controller_Handbook_Volume_I_8-Bit.pdf",
    "intel-1988-handbook-vol1.txt": "pdftotext -layout intel-1988-embedded-controller-handbook-vol1.pdf",
    "intel-MCS-51-Macro-Assembler-Users-Guide-1979.pdf": "http://ftpmirror.infania.net/sites/bitsavers/components/intel/8051/9800937-01_MCS-51_Macro_Assembler_Users_Guide_Dec1979.pdf",
    "naken_asm_8051_alt.cpp": "https://raw.githubusercontent.com/mikeakohn/naken_asm/master/table/8051.cpp",
    "vjs51_JS51.js": "https://raw.githubusercontent.com/Vartan/JS51/master/js/JS51.js",
    "mentzj_opcodes.ts": "https://raw.githubusercontent.com/MentzJ/8051_simulator/main/src/opcodes.ts",
    "sidmaddy_instructions.js": "https://raw.githubusercontent.com/sid-maddy/8051.js/master/src/back-end/instructions.js",
    "antboard_ant8051.js": "https://raw.githubusercontent.com/antboard/js-for-simulation8051/master/ant8051.js",
    "rodeo74_mcu.cpp": "https://raw.githubusercontent.com/rodeo74/8051-Web-Emulator/main/src/mcu.cpp",
    "pysim_opcode_write.txt": "https://raw.githubusercontent.com/abhi3p/8051-simluator-using-python/master/opcode_write.txt",
    "abhi3p_decoder.py": "https://raw.githubusercontent.com/abhi3p/8051-simluator-using-python/master/decoder.py",
    "js51_51vm_opcode_decoder.js": "https://raw.githubusercontent.com/Aimini/js51/binary_decoder/51vm_opcode_decoder.js",
    "js51_51vm.js": "https://raw.githubusercontent.com/Aimini/js51/binary_decoder/test/51vm.js",
    "js51_51vm_operand.js": "https://raw.githubusercontent.com/Aimini/js51/binary_decoder/51vm_operand.js",
    "js51_51vm_operation.js": "https://raw.githubusercontent.com/Aimini/js51/binary_decoder/51vm_operation.js",
    "js51_51vm_core.js": "https://raw.githubusercontent.com/Aimini/js51/binary_decoder/51vm_core.js",
    "js51_51vm_ctl.js": "https://raw.githubusercontent.com/Aimini/js51/binary_decoder/51vm_ctl.js",
    "js51_README.md": "https://raw.githubusercontent.com/Aimini/js51/binary_decoder/README.md",
    "megawin_MDRH40.pdf": "https://www.megawin.com.tw/files/Download/DataSheet/BLDC/(EN)MDRH40_Datasheet_V0.1_202011.pdf",
    "megawin_MDRH40.txt": "pdftotext -layout megawin_MDRH40.pdf",
    "abov_A96R725.pdf": "http://abov.co.kr/document/download.php?d_it_id=1566817162&file=1566817162.pdf&fileName=UM_A96R725_Eng.pdf",
    "abov_A96R725.txt": "pdftotext -layout abov_A96R725.pdf",
    "atmel_at89c51_doc0265.pdf": "https://ww1.microchip.com/downloads/en/DeviceDoc/doc0265.pdf",
    "atmel_at89c51_doc0265.htm": "https://ww1.microchip.com/downloads/en/DeviceDoc/doc0265.pdf",
    "STC15F2K60S2-cn.pdf": "https://www.stcmicro.com/datasheet/STC15F2K60S2-cn.pdf (STC 官方数据手册, 已存在于 raw/)",
    "STC15F2K60S2-cn.txt": "pdftotext -layout STC15F2K60S2-cn.pdf",
    "atmel_at89c51_doc0265.txt": "pdftotext -layout atmel_at89c51_doc0265.pdf",
}
CLONES = {
    "git_8051-simluator-using-python": "https://github.com/abhi3p/8051-simluator-using-python (git clone --depth 1)",
}
DL_CLONES = {
    "dl/x_js51": "Aimini/js51 @ binary_decoder (tarball, earlier session)",
    "dl/x_vjs51": "Vartan/JS51 @ master (tarball)",
    "dl/x_mentzj": "MentzJ/8051_simulator @ main (tarball)",
    "dl/x_moltate": "moltate/8051-emulator @ main (tarball)",
    "dl/x_pysim": "abhi3p/8051-simluator-using-python @ master (tarball)",
    "dl/x_rodeo74": "rodeo74/8051-Web-Emulator @ main (tarball)",
    "dl/x_s2s": "S2Sofficial/8051sim @ main (tarball)",
    "dl/x_sidmaddy": "sid-maddy/8051.js @ master (tarball)",
    "dl/x_antboard": "antboard/js-for-simulation8051 @ master (tarball)",
    "dl/x_vscodeasm8052": "hsrzq/VSCode-ASM8052 @ develop (tarball)",
}


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


out = ["# research/raw - source file manifest", "",
       "Generated %s" % datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
       "",
       "Every file used to build `research/8051-opcodes.json`, with the URL it was",
       "downloaded from and its SHA-256 so the exact revision stays identifiable.",
       "",
       "| file | bytes | sha256 (first 16) | source |",
       "|---|---|---|---|"]

files = sorted(f for f in os.listdir(RAW) if os.path.isfile(os.path.join(RAW, f)))
for f in files:
    p = os.path.join(RAW, f)
    url = URLS.get(f, "_not recorded_")
    out.append("| `%s` | %d | `%s` | %s |" % (f, os.path.getsize(p), sha256(p)[:16], url))

out += ["", "## directories", "",
        "| dir | contents | source |", "|---|---|---|"]
for d, u in list(CLONES.items()) + list(DL_CLONES.items()):
    p = os.path.join(RAW, d.replace("/", os.sep))
    n = sum(len(fs) for _, _, fs in os.walk(p)) if os.path.isdir(p) else 0
    out.append("| `%s/` | %d files | %s |" % (d, n, u))

out += ["", "## pdftotext command used", "",
        "```", 'pdftotext.exe -layout <file>.pdf <file>.txt',
        "# pdftotext 4.x from MiKTeX:", r"C:\Users\ZCB\AppData\Local\Programs\MiKTeX\miktex\bin\x64\pdftotext.exe", "```", ""]

with open(os.path.join(RAW, "SOURCES-MANIFEST.md"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out) + "\n")
print("wrote SOURCES-MANIFEST.md with %d files" % len(files))
