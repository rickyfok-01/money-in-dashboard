# ==========================================
# Run-StatisticQueries
# Executes 7 statistic queries, exports to CSV, zips results
# ==========================================

Import-Module "$PSScriptRoot\Modules\Config.psm1" -Force
Import-Module "$PSScriptRoot\Modules\Oracle.psm1" -Force

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

# Start logging
Start-Transcript -Path $LogFile -Append

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting statistic queries execution" -ForegroundColor Cyan
Write-Host "Date: $DateStr" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

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
    Write-Host "[ERROR] Failed to connect to Oracle database: $_" -ForegroundColor Red
    Stop-Transcript
    exit 1
}

# Initialize session context (if configured)
$InitSql = $Config['DB_INIT_SQL']
if (-not [string]::IsNullOrWhiteSpace($InitSql)) {
    try {
        Invoke-OracleCommand -Connection $Connection -Sql $InitSql
        Write-Host "[INFO] Session initialized: $InitSql" -ForegroundColor Cyan
    }
    catch {
        Write-Host "[WARNING] DB_INIT_SQL failed (skipped): $_" -ForegroundColor Yellow
    }
}

$SuccessCount = 0
$FailCount = 0
$GeneratedCsvFiles = @()

try {
    foreach ($Query in $Queries) {
        $QueryId = $Query.QueryId
        $SqlFile = $Query.SqlFile
        $OutputFileName = $Query.OutputFilePattern -f $DateStr
        $OutputFilePath = Join-Path $TempDir $OutputFileName

        Write-Host "`n--- Processing $QueryId ---" -ForegroundColor White

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
            Write-Host "[ERROR] Failed to read SQL file for $QueryId : $_" -ForegroundColor Red
            $FailCount++
            continue
        }

        # Execute query
        try {
            Write-Host "[INFO] Executing query..." -ForegroundColor Cyan
            $Results = Invoke-OracleQuery -Connection $Connection -Sql $Sql
            Write-Host "[INFO] Query returned $($Results.Count) rows" -ForegroundColor Green
        }
        catch {
            Write-Host "[ERROR] Failed to execute query for $QueryId : $_" -ForegroundColor Red
            $FailCount++
            continue
        }

        # Export to CSV
        try {
            Write-Host "[INFO] Exporting to CSV: $OutputFilePath" -ForegroundColor Cyan
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
            Write-Host "[SUCCESS] CSV generated: $OutputFilePath" -ForegroundColor Green
            $SuccessCount++
        }
        catch {
            Write-Host "[ERROR] Failed to export CSV for $QueryId : $_" -ForegroundColor Red
            $FailCount++
            continue
        }
    }

    # Zip the files
    if ($SuccessCount -gt 0) {
        Write-Host "`n========================================" -ForegroundColor Cyan
        Write-Host "Creating zip file: $ZipFile" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan

        try {
            # Remove existing zip if exists
            if (Test-Path $ZipFile) {
                Remove-Item $ZipFile -Force
                Write-Host "[INFO] Removed existing zip file" -ForegroundColor Yellow
            }

            # Create zip
            Compress-Archive -Path $GeneratedCsvFiles -DestinationPath $ZipFile -Force
            Write-Host "[SUCCESS] Zip file created: $ZipFile" -ForegroundColor Green
        }
        catch {
            Write-Host "[ERROR] Failed to create zip file: $_" -ForegroundColor Red
        }
    }
}
finally {
    Disconnect-OracleDatabase $Connection

    # Clean up temp files
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Cleaning up temp directory" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    try {
        Get-ChildItem -Path $TempDir -File | Remove-Item -Force
        Write-Host "[SUCCESS] Temp directory cleaned" -ForegroundColor Green
    }
    catch {
        Write-Host "[WARNING] Failed to clean temp directory: $_" -ForegroundColor Yellow
    }

    # Summary
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Execution Summary" -ForegroundColor Cyan
    Write-Host "Success: $SuccessCount" -ForegroundColor Green
    Write-Host "Failed: $FailCount" -ForegroundColor $(if ($FailCount -gt 0) { "Red" } else { "Green" })
    Write-Host "========================================" -ForegroundColor Cyan

    Stop-Transcript
}

if ($FailCount -gt 0) {
    exit 1
}
else {
    exit 0
}
