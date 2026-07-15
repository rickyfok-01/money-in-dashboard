# ==========================================
# Run-StatisticQueries
# Executes 7 statistic queries, exports to CSV, zips results
# ==========================================

# Fail fast: native cmdlets (Export-Csv, Compress-Archive, Remove-Item) emit
# NON-terminating errors by default, which bypass catch blocks and let a failed
# step be counted as success. 'Stop' promotes them to terminating errors so the
# catches below actually fire and failures are reported honestly.
$ErrorActionPreference = 'Stop'

Import-Module "$PSScriptRoot\Modules\Config.psm1" -Force
Import-Module "$PSScriptRoot\Modules\Oracle.psm1" -Force

# Timestamped, severity-tagged logger. Every line carries HH:mm:ss + level so a
# transcript shows when each step ran; Start-Transcript still captures it (it
# calls Write-Host under the hood) and the console keeps its color.
function Write-Log {
    param(
        [Parameter(Position = 0)][string]$Message,
        [ValidateSet('INFO', 'SUCCESS', 'WARNING', 'ERROR')][string]$Level = 'INFO'
    )
    $Color = switch ($Level) {
        'INFO'    { 'Cyan' }
        'SUCCESS' { 'Green' }
        'WARNING' { 'Yellow' }
        'ERROR'   { 'Red' }
    }
    Write-Host ("[{0}] [{1}] {2}" -f (Get-Date -Format 'HH:mm:ss'), $Level, $Message) -ForegroundColor $Color
}

# Load configuration
$Config = Import-EnvConfig -EnvFile (Join-Path $PSScriptRoot ".env")
$ConnStr = Get-OracleConnectionString $Config

# Get today's date in YYYYMMDD format
$Today = Get-Date
$DateStr = $Today.ToString("yyyyMMdd")

# Define paths
$TempDir = Join-Path $PSScriptRoot "data\temp"
$LogDir = Join-Path $PSScriptRoot "data\log"
$OutputDir = Join-Path $PSScriptRoot "data"
$LogFile = Join-Path $LogDir "$DateStr.log"
$ZipFile = Join-Path $OutputDir "$DateStr.zip"

# Ensure output dirs exist (idempotent). With ErrorActionPreference=Stop, a
# missing log dir would otherwise terminate the run at Start-Transcript.
foreach ($d in @($OutputDir, $TempDir, $LogDir)) {
    New-Item -ItemType Directory -Path $d -Force | Out-Null
}

# Start logging
Start-Transcript -Path $LogFile -Append

$RunStart = [System.Diagnostics.Stopwatch]::StartNew()
Write-Log "Starting statistic queries execution (date=$DateStr)"

# Define queries
$Queries = @(
    @{
        QueryId = "sql-01"
        SqlFile = Join-Path $PSScriptRoot "sql\sql-01.sql"
        OutputFilePattern = "ddi-30day-{0}.csv"
    },
    @{
        QueryId = "sql-02"
        SqlFile = Join-Path $PSScriptRoot "sql\sql-02.sql"
        OutputFilePattern = "ddi-aging-{0}.csv"
    },
    @{
        QueryId = "sql-03"
        SqlFile = Join-Path $PSScriptRoot "sql\sql-03.sql"
        OutputFilePattern = "dda-30day-{0}.csv"
    },
    @{
        QueryId = "sql-04"
        SqlFile = Join-Path $PSScriptRoot "sql\sql-04.sql"
        OutputFilePattern = "dda-aging-{0}.csv"
    },
    @{
        QueryId = "sql-05"
        SqlFile = Join-Path $PSScriptRoot "sql\sql-05.sql"
        OutputFilePattern = "con-bill-6mon-{0}.csv"
    },
    @{
        QueryId = "sql-06"
        SqlFile = Join-Path $PSScriptRoot "sql\sql-06.sql"
        OutputFilePattern = "con-pym-6mon-{0}.csv"
    },
    @{
        QueryId = "sql-07"
        SqlFile = Join-Path $PSScriptRoot "sql\sql-07.sql"
        OutputFilePattern = "con-pym-ao-aging-{0}.csv"
    }
)

# Connect to Oracle
try {
    $Connection = Connect-OracleDatabase -ConnectionString $ConnStr -DllPath $Config['ORACLE_DLL_PATH']
}
catch {
    Write-Log "Failed to connect to Oracle database: $_" -Level ERROR
    Stop-Transcript
    exit 1
}

# Initialize session context (if configured)
$InitSql = $Config['DB_INIT_SQL']
if (-not [string]::IsNullOrWhiteSpace($InitSql)) {
    try {
        Invoke-OracleCommand -Connection $Connection -Sql $InitSql
        Write-Log "Session initialized: $InitSql"
    }
    catch {
        Write-Log "DB_INIT_SQL failed (skipped): $_" -Level WARNING
    }
}

$SuccessCount = 0
$FailCount = 0
$Failures = @()          # [PSCustomObject]{ Id, Stage, Error } per failure — surfaced in the summary
$GeneratedCsvFiles = @()

try {
    foreach ($Query in $Queries) {
        $QueryId = $Query.QueryId
        $SqlFile = $Query.SqlFile
        $OutputFileName = $Query.OutputFilePattern -f $DateStr
        $OutputFilePath = Join-Path $TempDir $OutputFileName

        Write-Log "--- Processing $QueryId ---"
        $QStart = [System.Diagnostics.Stopwatch]::StartNew()

        # Read SQL file
        try {
            if (-not (Test-Path $SqlFile)) {
                throw "SQL file not found: $SqlFile"
            }
            $Lines = Get-Content $SqlFile | Where-Object { $_ -notmatch "^\s*--" -and $_ -notmatch "^\s*$" }
            $Sql = ($Lines -join "`n" -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ } ) -join " "
            # Remove trailing semicolon
            $Sql = $Sql.TrimEnd(';')
        }
        catch {
            Write-Log "Failed to read SQL file for $QueryId : $_" -Level ERROR
            $Failures += [PSCustomObject]@{ Id = $QueryId; Stage = 'read'; Error = "$_" }
            $FailCount++
            continue
        }

        # Execute query
        try {
            Write-Log "Executing query..."
            $Results = Invoke-OracleQuery -Connection $Connection -Sql $Sql
            Write-Log "Query returned $($Results.Count) rows" -Level SUCCESS
        }
        catch {
            Write-Log "Failed to execute query for $QueryId : $_" -Level ERROR
            $Failures += [PSCustomObject]@{ Id = $QueryId; Stage = 'execute'; Error = "$_" }
            $FailCount++
            continue
        }

        # Export to CSV
        try {
            Write-Log "Exporting to CSV: $OutputFilePath"
            $Results | ForEach-Object {
                $Obj = New-Object PSObject
                foreach ($Key in $_.Keys) {
                    $Value = $_[$Key]
                    if ($Value -is [DBNull]) {
                        $Value = $null
                    }
                    $Obj | Add-Member -MemberType NoteProperty -Name $Key -Value $Value
                }
                $Obj
            } | Export-Csv -Path $OutputFilePath -NoTypeInformation -Encoding UTF8
            $GeneratedCsvFiles += $OutputFilePath
            $QStart.Stop()
            Write-Log ("CSV generated: {0} ({1} rows in {2}s)" -f $OutputFilePath, $Results.Count, [math]::Round($QStart.Elapsed.TotalSeconds, 1)) -Level SUCCESS
            $SuccessCount++
        }
        catch {
            Write-Log "Failed to export CSV for $QueryId : $_" -Level ERROR
            $Failures += [PSCustomObject]@{ Id = $QueryId; Stage = 'export'; Error = "$_" }
            $FailCount++
            continue
        }
    }

    # Zip the files
    if ($SuccessCount -gt 0) {
        Write-Log "Creating zip file: $ZipFile"

        try {
            # Remove existing zip if exists
            if (Test-Path $ZipFile) {
                Remove-Item $ZipFile -Force
                Write-Log "Removed existing zip file" -Level WARNING
            }

            # Create zip
            Compress-Archive -Path $GeneratedCsvFiles -DestinationPath $ZipFile -Force
            Write-Log "Zip file created: $ZipFile" -Level SUCCESS
        }
        catch {
            Write-Log "Failed to create zip file: $_" -Level ERROR
        }
    }
}
finally {
    Disconnect-OracleDatabase $Connection

    # Clean up temp files
    Write-Log "Cleaning up temp directory"
    try {
        Get-ChildItem -Path $TempDir -File | Remove-Item -Force
        Write-Log "Temp directory cleaned" -Level SUCCESS
    }
    catch {
        Write-Log "Failed to clean temp directory: $_" -Level WARNING
    }

    # Summary
    $RunStart.Stop()
    $SummaryLevel = if ($FailCount -gt 0) { 'ERROR' } else { 'SUCCESS' }
    Write-Log ("Execution summary: success={0} failed={1} elapsed={2}s" -f $SuccessCount, $FailCount, [math]::Round($RunStart.Elapsed.TotalSeconds, 1)) -Level $SummaryLevel
    if ($Failures.Count -gt 0) {
        Write-Log "Failed queries:" -Level ERROR
        foreach ($f in $Failures) {
            Write-Log ("  {0} [{1}]: {2}" -f $f.Id, $f.Stage, $f.Error) -Level ERROR
        }
    }

    Stop-Transcript
}

if ($FailCount -gt 0) {
    exit 1
}
else {
    exit 0
}
