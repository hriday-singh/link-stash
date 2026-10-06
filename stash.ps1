# Link Stash Root CLI Runner (PowerShell)
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CommandArgs
)

$RootDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
uv run --directory "$RootDir\apps\core" stash @CommandArgs
