$ProgressPreference = 'SilentlyContinue'
$ua = @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
$repos = @(
  "Aimini/js51","Vartan/JS51","rodeo74/8051-Web-Emulator","S2Sofficial/8051sim",
  "moltate/8051-emulator","MentzJ/8051_simulator","antboard/js-for-simulation8051",
  "sid-maddy/8051.js","hsrzq/VSCode-ASM8052","TecCheck/vscode-8051-assembly",
  "abhi3p/8051-simluator-using-python"
)
foreach ($r in $repos) {
  try {
    $resp = Invoke-WebRequest -Uri "https://github.com/$r" -Headers $ua -TimeoutSec 40
    $h = $resp.Content
    $branch = [regex]::Match($h, '"defaultBranch":"([^"]+)"').Groups[1].Value
    if (-not $branch) { $branch = [regex]::Match($h, 'refName&quot;:&quot;([^&]+)&quot;').Groups[1].Value }
    if (-not $branch) { $branch = [regex]::Match($h, '"refInfo":\{"name":"([^"]+)"').Groups[1].Value }
    $rel = [regex]::Match($h, 'datetime="([^"]+)"').Groups[1].Value
    $lic = [regex]::Match($h, '([A-Za-z0-9\.\- ]{2,40}) license').Groups[1].Value
    $licFile = [regex]::Match($h, 'href="/' + [regex]::Escape($r) + '/blob/[^"]*?(LICENSE[^"/]*)"').Groups[1].Value
    "$r | branch=$branch | licText=$lic | licFile=$licFile | time=$rel"
  } catch { "$r | ERROR $($_.Exception.Message)" }
}
