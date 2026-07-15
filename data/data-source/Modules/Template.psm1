# ======================================================
# Template Module
# Shared {{param}} placeholder engine for SQL and reply templates
# ======================================================

function Resolve-Template {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [string]$Content,

        [Parameter(Mandatory)]
        [hashtable]$Parameters,

        [switch]$SkipMissingLines
    )

    $Lines = $Content -split "`n"

    $KeptLines = @()
    foreach ($Line in $Lines) {
        $Placeholders = [regex]::Matches($Line, "\{\{(\w+)\}\}")

        if ($Placeholders.Count -eq 0) {
            if ($SkipMissingLines) {
                # In SQL mode, still keep lines without placeholders
            }
            $KeptLines += $Line
        }
        else {
            $AllFound = $true
            $ProcessedLine = $Line
            foreach ($Match in $Placeholders) {
                $ParamName = $Match.Groups[1].Value
                if ($Parameters.ContainsKey($ParamName)) {
                    $ProcessedLine = $ProcessedLine.Replace("{{$ParamName}}", $Parameters[$ParamName])
                }
                else {
                    $AllFound = $false
                    break
                }
            }

            if ($SkipMissingLines) {
                # SQL mode: skip entire line if any placeholder is unresolved
                if ($AllFound) {
                    $KeptLines += $ProcessedLine
                }
            }
            else {
                # Reply template mode: leave unresolved placeholders as-is
                $KeptLines += $ProcessedLine
            }
        }
    }

    return ($KeptLines -join "`n")
}

Export-ModuleMember -Function Resolve-Template
