param([Parameter(Mandatory=$true)][string]$Version)
$p = Join-Path $PSScriptRoot '..\src\data.js'
$t = [IO.File]::ReadAllText($p)
$n = [regex]::Replace($t, "var VERSION = '[^']*'", "var VERSION = '$Version'")
[IO.File]::WriteAllText($p, $n, (New-Object System.Text.ASCIIEncoding))
