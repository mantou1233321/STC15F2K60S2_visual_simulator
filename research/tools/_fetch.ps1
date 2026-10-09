# Helper: fetch GitHub repo metadata (stars/language/license/last push) from repo HTML page
param([string]$Repo)
$ProgressPreference = 'SilentlyContinue'
$url = "https://github.com/$Repo"
try {
    $r = Invoke-WebRequest -Uri $url -Headers @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) research" } -TimeoutSec 45
} catch {
    "REPO=$Repo`nERROR=$($_.Exception.Message)`n"
    exit
}
$h = $r.Content
function Grab($pat, $name) {
    $m = [regex]::Match($h, $pat)
    if ($m.Success) { return $m.Groups[1].Value } else { return "?" }
}
$stars   = Grab '"stargazerCount":(\d+)' 'stars'
if ($stars -eq "?") { $stars = Grab 'aria-label="(\d[\d,]*) users starred' 'stars2' }
$lang    = Grab '"primaryLanguage":\{"name":"([^"]+)"' 'lang'
if ($lang -eq "?") { $lang = Grab 'itemprop="programmingLanguage">([^<]+)<' 'lang2' }
$license = Grab '"licenseInfo":\{"[^}]*?"name":"([^"]+)"' 'lic'
if ($license -eq "?") { $license = Grab '([A-Za-z0-9\-\. ]+) license' 'lic2' }
$pushed  = Grab '"pushedAt":"([^"]+)"' 'pushed'
if ($pushed -eq "?") { $pushed = Grab 'datetime="([^"]+)"' 'pushed2' }
$desc    = Grab '"description":"((?:[^"\\]|\\.)*)"' 'desc'
$arch    = Grab '"isArchived":(true|false)' 'archived'
"REPO=$Repo"
"STARS=$stars"
"LANG=$lang"
"LICENSE=$license"
"PUSHED=$pushed"
"ARCHIVED=$arch"
"DESC=$desc"
"---"
