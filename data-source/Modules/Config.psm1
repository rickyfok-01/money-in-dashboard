# ======================================================
# Config Module
# Unified .env loading for Oracle + Jira configuration
# ======================================================

function Import-EnvConfig {
    [CmdletBinding()]
    param (
        [string]$EnvFile = (Join-Path $PSScriptRoot "..\.env")
    )

    if (-not (Test-Path $EnvFile)) {
        throw "Configuration file not found: $EnvFile"
    }

    $Config = @{}

    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^\s*#" -or $_ -match "^\s*$") { return }
        if ($_ -match "^([^=]+)=(.*)$") {
            $Key = $Matches[1].Trim()
            $Value = $Matches[2].Trim()
            $Config[$Key] = $Value
        }
    }

    Write-Host "[INFO] Loaded configuration from .env" -ForegroundColor Cyan
    return $Config
}

function Get-OracleConnectionString {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [hashtable]$Config
    )

    $TnsString = "(DESCRIPTION=(ADDRESS=(PROTOCOL=$($Config['DB_PROTOCOL']))(HOST=$($Config['DB_HOST']))(PORT=$($Config['DB_PORT'])))(CONNECT_DATA=(SERVICE_NAME=$($Config['DB_SERVICE_NAME']))))"
    return "Data Source=$TnsString;User Id=$($Config['DB_USERNAME']);Password=$($Config['DB_PASSWORD']);"
}

function Get-JiraConfig {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [hashtable]$Config
    )

    return [PSCustomObject]@{
        BaseUrl  = $Config['JIRA_BASE_URL']
        Username = $Config['JIRA_USERNAME']
        Password = $Config['JIRA_PASSWORD']
    }
}

Export-ModuleMember -Function Import-EnvConfig, Get-OracleConnectionString, Get-JiraConfig
