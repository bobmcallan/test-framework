# -----------------------------------------------------------------------
# Value Australia Test Runner PowerShell Script
# Improved version with better structure and error handling
# -----------------------------------------------------------------------

Write-Host "🧪 Value Australia Test Runner" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# HELPER FUNCTIONS (Define first)
# ============================================================================

function Invoke-SingleTest {
    param($Test)
    
    try {
        # Execute the test
        node $Test.Path
        $exitCode = $LASTEXITCODE
        
        return @{
            Test = $Test.Title
            Success = ($exitCode -eq 0)
            ExitCode = $exitCode
            Error = $null
        }
    } catch {
        return @{
            Test = $Test.Title
            Success = $false
            ExitCode = -1
            Error = $_.Exception.Message
        }
    }
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================

# Get the directory of this script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check for .env file
$envFile = Join-Path $scriptDir ".env"
if (Test-Path $envFile) {
    Write-Host "✓ Environment configuration found" -ForegroundColor Green
} else {
    Write-Host "⚠️  No .env file found - using default settings" -ForegroundColor Yellow
    Write-Host "💡 Create a .env file with BASE_URL and other configuration" -ForegroundColor Yellow
}

# Check dependencies
$packageFile = Join-Path $scriptDir "package.json"
if (Test-Path $packageFile) {
    Write-Host "✓ Package configuration found" -ForegroundColor Green
    
    $nodeModules = Join-Path $scriptDir "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Write-Host "⚠️  Installing dependencies..." -ForegroundColor Yellow
        try {
            npm install
            Write-Host "✓ Dependencies installed" -ForegroundColor Green
        } catch {
            Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✓ Dependencies already installed" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  No package.json found" -ForegroundColor Yellow
}

# Auto-discover test files
Write-Host "🔍 Scanning for test files..." -ForegroundColor Cyan

# Look in both root directory and tests/ subdirectory
$testLocations = @(
    $scriptDir,
    (Join-Path $scriptDir "tests")
)

$allTestFiles = @()
foreach ($location in $testLocations) {
    if (Test-Path $location) {
        # Exclude utility files - only find actual test files
        $testFiles = Get-ChildItem -Path $location -Filter "*test*.js" -File | Where-Object { 
            $_.Name -notmatch "test-utils|utils-test|helpers" -and 
            $_.Name -match "test" 
        }
        
        foreach ($file in $testFiles) {
            $relativePath = if ($location -eq $scriptDir) { $file.Name } else { "tests/$($file.Name)" }
            $allTestFiles += @{
                Name = $file.Name
                Path = $file.FullName
                RelativePath = $relativePath
                Title = (([System.IO.Path]::GetFileNameWithoutExtension($file.Name)) -replace "[-_]", " " | ForEach-Object { (Get-Culture).TextInfo.ToTitleCase($_) })
                Location = if ($location -eq $scriptDir) { "Root" } else { "Tests" }
            }
        }
    }
}

if ($allTestFiles.Count -eq 0) {
    Write-Host "❌ No test files found" -ForegroundColor Red
    Write-Host "💡 Looking for files matching pattern: *test*.js" -ForegroundColor Yellow
    Write-Host "📁 Searched in: $scriptDir and $scriptDir/tests/" -ForegroundColor Yellow
    
    # Show all JS files for debugging
    $allJsFiles = @()
    foreach ($location in $testLocations) {
        if (Test-Path $location) {
            $jsFiles = Get-ChildItem -Path $location -Filter "*.js" -File
            $allJsFiles += $jsFiles
        }
    }
    
    if ($allJsFiles.Count -gt 0) {
        Write-Host ""
        Write-Host "📄 JavaScript files found:" -ForegroundColor Yellow
        foreach ($jsFile in $allJsFiles) {
            Write-Host "   - $($jsFile.Name) (in $(Split-Path -Leaf $jsFile.DirectoryName))" -ForegroundColor Gray
        }
    }
    
    exit 1
}

Write-Host "✓ Found $($allTestFiles.Count) test file(s)" -ForegroundColor Green
Write-Host ""

# Display tests grouped by location
Write-Host "📋 Available Tests:" -ForegroundColor Yellow
Write-Host ""

$testsByLocation = $allTestFiles | Group-Object -Property Location
$testIndex = 1
$testMap = @{}

foreach ($group in $testsByLocation) {
    Write-Host "  $($group.Name) Directory:" -ForegroundColor Magenta
    foreach ($test in $group.Group) {
        Write-Host "    [$testIndex] $($test.Title)" -ForegroundColor White
        Write-Host "        File: $($test.RelativePath)" -ForegroundColor Gray
        $testMap[$testIndex] = $test
        $testIndex++
    }
    Write-Host ""
}

Write-Host "  Options:" -ForegroundColor Magenta
Write-Host "    [A] Run All Tests" -ForegroundColor White
Write-Host "    [Q] Quit" -ForegroundColor White
Write-Host ""

# Get user choice
do {
    $choice = Read-Host "Select a test to run (1-$($allTestFiles.Count), A for all, Q to quit)"
    
    if ($choice -eq "Q" -or $choice -eq "q") {
        Write-Host "👋 Goodbye!" -ForegroundColor Cyan
        exit 0
    }
    
    if ($choice -eq "A" -or $choice -eq "a") {
        Write-Host ""
        Write-Host "🚀 Running All Tests..." -ForegroundColor Green
        Write-Host "========================" -ForegroundColor Green
        
        $testResults = @()
        $allPassed = $true
        
        foreach ($test in $allTestFiles) {
            Write-Host ""
            Write-Host "▶️  Running: $($test.Title)" -ForegroundColor Cyan
            Write-Host "   File: $($test.RelativePath)" -ForegroundColor Gray
            Write-Host ""
            
            try {
                node $test.Path
                $exitCode = $LASTEXITCODE
                
                $testResults += @{ 
                    Test = $test.Title; 
                    Success = ($exitCode -eq 0); 
                    ExitCode = $exitCode 
                }
                
                if ($exitCode -eq 0) {
                    Write-Host "✅ $($test.Title) - PASSED" -ForegroundColor Green
                } else {
                    Write-Host "❌ $($test.Title) - FAILED (Exit Code: $exitCode)" -ForegroundColor Red
                    $allPassed = $false
                }
            } catch {
                Write-Host "❌ $($test.Title) - ERROR: $($_.Exception.Message)" -ForegroundColor Red
                $testResults += @{ Test = $test.Title; Success = $false; Error = $_.Exception.Message }
                $allPassed = $false
            }
            
            Write-Host "----------------------------------------" -ForegroundColor Gray
        }
        
        # Display summary
        Write-Host ""
        Write-Host "📊 Test Execution Summary:" -ForegroundColor Cyan
        Write-Host "===========================" -ForegroundColor Cyan
        
        foreach ($result in $testResults) {
            $status = if ($result.Success) { "✅" } else { "❌" }
            $resultText = if ($result.Success) { "PASSED" } else { "FAILED" }
            Write-Host "$status $($result.Test) - $resultText" -ForegroundColor $(if ($result.Success) { "Green" } else { "Red" })
        }
        
        Write-Host ""
        if ($allPassed) {
            Write-Host "🎉 All tests completed successfully!" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "⚠️  Some tests failed. Check the output above for details." -ForegroundColor Yellow
            exit 1
        }
    }
    
    # Check if it's a valid number
    if ($choice -match '^\d+$') {
        $choiceNum = [int]$choice
        if ($testMap.ContainsKey($choiceNum)) {
            $selectedTest = $testMap[$choiceNum]
            break
        }
    }
    
    Write-Host "❌ Invalid choice. Please enter a number between 1-$($allTestFiles.Count), 'A' for all, or 'Q' to quit." -ForegroundColor Red
    
} while ($true)

# Run selected test
Write-Host ""
Write-Host "🚀 Running Selected Test..." -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host "📋 Test: $($selectedTest.Title)" -ForegroundColor Cyan
Write-Host "📄 File: $($selectedTest.RelativePath)" -ForegroundColor Cyan
Write-Host ""

Write-Host "🎬 Starting test execution..." -ForegroundColor Cyan
Write-Host "📝 Note: Browser will open for visual verification" -ForegroundColor Yellow
Write-Host ""

# Run the test
try {
    node $selectedTest.Path
    $exitCode = $LASTEXITCODE
    
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "🎉 Test '$($selectedTest.Title)' completed successfully!" -ForegroundColor Green
        Write-Host "📊 Check the results directory for detailed output" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Test '$($selectedTest.Title)' failed with exit code: $exitCode" -ForegroundColor Red
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error running test '$($selectedTest.Title)':" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📂 Test results saved in: results/[test-name]-[timestamp]/" -ForegroundColor Cyan
Write-Host "📄 Generated files include:" -ForegroundColor Cyan
Write-Host "   - session-summary.md (human-readable summary)" -ForegroundColor Gray
Write-Host "   - test-results.json (complete test data)" -ForegroundColor Gray
Write-Host "   - console-logs.json (browser console output)" -ForegroundColor Gray
Write-Host "   - network-events.json (network requests)" -ForegroundColor Gray
Write-Host "   - Screenshots of test execution" -ForegroundColor Gray
Write-Host ""

exit $exitCode