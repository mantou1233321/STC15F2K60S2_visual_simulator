$ProgressPreference = 'SilentlyContinue'
$ua = @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
$repos = @(
  "Aimini/js51",
  "Vartan/JS51",
  "rodeo74/8051-Web-Emulator",
  "S2Sofficial/8051sim",
  "moltate/8051-emulator",
  "MentzJ/8051_simulator",
  "antboard/js-for-simulation8051",
  "sid-maddy/8051.js",
  "hsrzq/VSCode-ASM8052",
  "TecCheck/vscode-8051-assembly",
  "abhi3p/8051-simluator-using-python",
  "edsim51/edsim51di",
  "edsim51/edsim51",
  "daniel-sabra/8051-emulator",
  "bkazemi/8051-emulator",
  "faizahmad/8051-simulator",
  "anshul-16/8051-simulator",
  "harishkotra/8051",
  "amitkumarj441/8051",
  "sylefeb/8051",
  "jorgef/8051",
  "martin2250/Open8055",
  "sdcc-org/sdcc",
  "mikeakohn/8051sim",
  "nkasco/8051-Simulator",
  "NishantNP2000/8051-Simulator",
  "Nakul-Sharma/8051-emulator",
  "haneefdm/8051sim",
  "zephyrproject-rtos/8051"
)
foreach ($r in $repos) {
  try {
    $resp = Invoke-WebRequest -Uri "https://github.com/$r" -Headers $ua -TimeoutSec 40
    $h = $resp.Content
    $stars = [regex]::Match($h, 'id="repo-stars-counter-star"[^>]*title="([^"]+)"').Groups[1].Value
    if (-not $stars) { $stars = [regex]::Match($h, '"stargazerCount":(\d+)').Groups[1].Value }
    $lang = [regex]::Match($h, 'itemprop="programmingLanguage">\s*([^<\s][^<]*?)\s*<').Groups[1].Value
    if (-not $lang) { $lang = [regex]::Match($h, '"primaryLanguage":\{"name":"([^"]+)"').Groups[1].Value }
    $lic = [regex]::Match($h, '>\s*([A-Za-z0-9\.\- ]*[Ll]icense[A-Za-z0-9\.\- ]*)\s*</a>').Groups[1].Value
    $arch = [regex]::Match($h, '"isArchived":(true|false)').Groups[1].Value
    $desc = [regex]::Match($h, '<meta name="description" content="([^"]{0,300})').Groups[1].Value
    $push = [regex]::Match($h, 'relative-time[^>]*datetime="([^"]+)"').Groups[1].Value
    "$r | stars=$stars | lang=$lang | lic=$lic | archived=$arch | pushed=$push"
    if ($desc) { "    desc: $desc" }
  } catch { "$r | ERROR $($_.Exception.Message)" }
}
