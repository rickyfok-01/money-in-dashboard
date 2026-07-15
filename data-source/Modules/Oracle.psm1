# ======================================================
# Oracle Module
# Connection management, query execution, JSONL formatting
# ======================================================

Import-Module (Join-Path $PSScriptRoot "Template.psm1") -Force

function Connect-OracleDatabase {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [string]$ConnectionString,

        [Parameter(Mandatory)]
        [string]$DllPath
    )

    if (-not (Test-Path $DllPath)) {
        throw "Oracle.ManagedDataAccess.dll not found: $DllPath"
    }
    Add-Type -Path $DllPath

    $Connection = New-Object Oracle.ManagedDataAccess.Client.OracleConnection($ConnectionString)
    $Connection.Open()

    if ($Connection.State -ne 'Open') {
        throw "Failed to open Oracle connection"
    }

    Write-Host "[SUCCESS] Oracle connection established" -ForegroundColor Green
    return $Connection
}

function Disconnect-OracleDatabase {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory, ValueFromPipeline)]
        $Connection
    )

    if ($null -ne $Connection -and $Connection.State -eq 'Open') {
        $Connection.Close()
        $Connection.Dispose()
    }
}

function Invoke-OracleQuery {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        $Connection,

        [Parameter(Mandatory)]
        [string]$Sql
    )

    $Command = $Connection.CreateCommand()
    $Command.CommandText = $Sql
    $Reader = $Command.ExecuteReader()

    $Columns = @()
    for ($i = 0; $i -lt $Reader.FieldCount; $i++) {
        $Columns += $Reader.GetName($i)
    }

    $Results = @()
    while ($Reader.Read()) {
        $Row = @{}
        for ($i = 0; $i -lt $Reader.FieldCount; $i++) {
            $Row[$Columns[$i]] = $Reader[$i]
        }
        $Results += $Row
    }

    $Reader.Close()
    $Command.Dispose()

    # Wrap in array to prevent PowerShell from unrolling empty array to null
    return ,@($Results)
}

function ConvertTo-Jsonl {
    [CmdletBinding()]
    param (
        [array]$Records
    )

    if (-not $Records -or $Records.Count -eq 0) {
        return ""
    }

    $JsonlParts = @()
    foreach ($Record in $Records) {
        $Pairs = @()
        foreach ($Key in $Record.Keys) {
            $Value = $Record[$Key]
            if ($Value -is [DBNull]) {
                $Pairs += """${Key}"":null"
            }
            elseif ($Value -is [datetime]) {
                $Pairs += """${Key}"":""$($Value.ToString('yyyy-MM-ddTHH:mm:ss'))"""
            }
            elseif ($Value -match '^\d+$' -and $Value -isnot [string]) {
                $Pairs += """${Key}"":$Value"
            }
            else {
                $Escaped = "$Value" -replace '\\', '\\' -replace '"', '\"'
                $Pairs += """${Key}"":""$Escaped"""
            }
        }
        $JsonlParts += "{$($Pairs -join ',')}"
    }

    return ($JsonlParts -join "`n")
}

function Build-SqlFromTemplate {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [string]$SqlFilePath,

        [Parameter(Mandatory)]
        [hashtable]$QueryMetadata
    )

    if (-not (Test-Path $SqlFilePath)) {
        throw "SQL file not found: $SqlFilePath"
    }

    # Read and strip comment/blank lines
    $Lines = Get-Content $SqlFilePath | Where-Object { $_ -notmatch "^\s*--" -and $_ -notmatch "^\s*$" }
    $Content = $Lines -join "`n"

    # Resolve template with line-skipping for missing params
    $Sql = Resolve-Template -Content $Content -Parameters $QueryMetadata -SkipMissingLines

    # Collapse to single-line for execution
    return ($Sql -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ } ) -join " "
}

function Invoke-OracleCommand {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        $Connection,

        [Parameter(Mandatory)]
        [string]$Sql
    )

    # Wrap PL/SQL in BEGIN...END if not already a block
    if ($Sql -notmatch '^\s*BEGIN\b') {
        $Sql = "BEGIN $Sql; END;"
    }

    $Command = $Connection.CreateCommand()
    $Command.CommandText = $Sql
    [void] $Command.ExecuteNonQuery()
    $Command.Dispose()
}

function Enable-DbmsOutput {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        $Connection
    )

    $Command = $Connection.CreateCommand()
    $Command.CommandText = "BEGIN DBMS_OUTPUT.ENABLE(NULL); END;"
    [void] $Command.ExecuteNonQuery()
    $Command.Dispose()
}

function Get-DbmsOutput {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        $Connection
    )

    # DBMS_OUTPUT.GET_LINE returns up to 255 bytes per call. Loop client-side to avoid
    # provider-specific truncation issues when binding a large OUT string.
    $Command = $Connection.CreateCommand()
    $Command.BindByName = $true
    $Command.CommandText = "BEGIN DBMS_OUTPUT.GET_LINE(:line, :status); END;"

    $LineParam = $Command.CreateParameter()
    $LineParam.ParameterName = "line"
    $LineParam.OracleDbType = [Oracle.ManagedDataAccess.Client.OracleDbType]::Varchar2
    # DBMS_OUTPUT.GET_LINE's line OUT is effectively limited (historically 255 bytes).
    # Some providers behave unexpectedly with larger sizes, so keep this conservative.
    $LineParam.Size = 255
    $LineParam.Direction = [System.Data.ParameterDirection]::Output
    [void] $Command.Parameters.Add($LineParam)

    $StatusParam = $Command.CreateParameter()
    $StatusParam.ParameterName = "status"
    $StatusParam.OracleDbType = [Oracle.ManagedDataAccess.Client.OracleDbType]::Int32
    $StatusParam.Direction = [System.Data.ParameterDirection]::Output
    [void] $Command.Parameters.Add($StatusParam)

    $Lines = New-Object System.Collections.Generic.List[string]
    while ($true) {
        [void] $Command.ExecuteNonQuery()

        $Status = 1
        if ($StatusParam.Value -isnot [DBNull] -and $null -ne $StatusParam.Value) {
            $Status = [int] $StatusParam.Value
        }

        if ($Status -eq 1) { break }

        $Line = ""
        if ($LineParam.Value -isnot [DBNull] -and $null -ne $LineParam.Value) {
            $Line = [string] $LineParam.Value
        }
        $Lines.Add($Line)
    }

    $Command.Dispose()
    return ($Lines -join "`n")
}

function Get-FirstQueryScalar {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        $Connection,

        [Parameter(Mandatory)]
        [string]$Sql
    )

    $Command = $Connection.CreateCommand()
    $Command.CommandText = $Sql
    $Reader = $Command.ExecuteReader()

    $Value = ""
    if ($Reader.Read()) {
        if ($Reader.FieldCount -gt 0) {
            $Raw = $Reader.GetValue(0)
            if ($Raw -isnot [DBNull] -and $null -ne $Raw) {
                $Value = [string] $Raw
            }
        }
    }

    $Reader.Close()
    $Command.Dispose()

    return $Value
}

function Convert-OracleOutToString {
    [CmdletBinding()]
    param (
        $Value
    )

    if ($null -eq $Value -or $Value -is [DBNull]) {
        return ""
    }

    # For CLOB outputs, ODP.NET returns an OracleClob.
    if ($Value -is [Oracle.ManagedDataAccess.Types.OracleClob]) {
        if ($Value.IsNull) { return "" }
        return $Value.Value
    }

    return [string] $Value
}

function Invoke-OracleProcedure {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        $Connection,

        [Parameter(Mandatory)]
        [string]$Sql
    )

    # Preferred: capture from an explicit OUT bind variable (:output) for reliability.
    # Fallback: DBMS_OUTPUT (best-effort; some environments truncate it).
    $HasOutputBind = ($Sql -match '(?is):\s*output\b')

    # Enable DBMS_OUTPUT buffer for optional debug/fallback capture.
    Enable-DbmsOutput $Connection

    $Command = $Connection.CreateCommand()
    $Command.BindByName = $true
    $Command.CommandText = $Sql

    $OutputParam = $null
    if ($HasOutputBind) {
        $OutputParam = $Command.CreateParameter()
        # The colon is important for binding to :output in the PL/SQL text.
        $OutputParam.ParameterName = "output"
        $OutputParam.OracleDbType = [Oracle.ManagedDataAccess.Client.OracleDbType]::Clob
        $OutputParam.Direction = [System.Data.ParameterDirection]::Output
        [void] $Command.Parameters.Add($OutputParam)
    }

    [void] $Command.ExecuteNonQuery()

    $OutText = ""
    if ($HasOutputBind -and $null -ne $OutputParam) {
        $OutText = Convert-OracleOutToString -Value $OutputParam.Value
    }

    $Command.Dispose()

    if ($HasOutputBind) {
        # If the caller provided :output, always return it (even if empty).
        # Do not fallback to DBMS_OUTPUT, otherwise debug logs can overwrite intended output.
        return $OutText
    }

    return (Get-DbmsOutput -Connection $Connection)
}

function Build-ProcedureFromTemplate {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [string]$SqlFilePath,

        [Parameter(Mandatory)]
        [hashtable]$QueryMetadata
    )

    if (-not (Test-Path $SqlFilePath)) {
        throw "Procedure file not found: $SqlFilePath"
    }

    $Content = Get-Content $SqlFilePath -Raw

    # Strip trailing / (SQL*Plus terminator)
    $Content = $Content -replace '\r?\n/\s*$', ''

    # Resolve template placeholders (preserve multi-line structure)
    $Sql = Resolve-Template -Content $Content -Parameters $QueryMetadata

    return $Sql.Trim()
}

Export-ModuleMember -Function Connect-OracleDatabase, Disconnect-OracleDatabase, Invoke-OracleQuery, Invoke-OracleCommand, ConvertTo-Jsonl, Build-SqlFromTemplate, Invoke-OracleProcedure, Build-ProcedureFromTemplate
