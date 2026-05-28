# Test script to verify cost-monitor.py hook works correctly
# Run this script to test if the hook can generate .cost-state.json

Write-Host "=== Cost Monitor Hook Test ===" -ForegroundColor Cyan
Write-Host ""

# Check if cost-monitor.py exists
if (-not (Test-Path "cost-monitor.py")) {
    Write-Host "ERROR: cost-monitor.py not found in current directory" -ForegroundColor Red
    Write-Host "Please run this script from the Cost-Monitor directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] cost-monitor.py found" -ForegroundColor Green

# Create test .codebuddy/hooks directory
$hooksDir = ".codebuddy/hooks"
if (-not (Test-Path $hooksDir)) {
    New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null
    Write-Host "[OK] Created $hooksDir directory" -ForegroundColor Green
} else {
    Write-Host "[OK] $hooksDir directory already exists" -ForegroundColor Green
}

# Test 1: Run hook in CLI mode (CodeBuddy/Claude Code)
Write-Host ""
Write-Host "Test 1: CLI Mode (CodeBuddy/Claude Code)" -ForegroundColor Cyan
Write-Host "Running: echo '{}' | python cost-monitor.py" -ForegroundColor Gray

$testInput = '{"transcript_path": ""}'
$testInput | python cost-monitor.py 2>&1 | Out-Null

if (Test-Path "$hooksDir/.cost-state.json") {
    Write-Host "[OK] .cost-state.json generated successfully" -ForegroundColor Green
    $content = Get-Content "$hooksDir/.cost-state.json" -Raw
    Write-Host "Content: $content" -ForegroundColor Gray
} else {
    Write-Host "[FAIL] .cost-state.json was not generated" -ForegroundColor Red
}

# Test 2: Run hook in Cursor mode
Write-Host ""
Write-Host "Test 2: Cursor Mode (--cursor flag)" -ForegroundColor Cyan
Write-Host "Running: echo '{}' | python cost-monitor.py --cursor" -ForegroundColor Gray

# Need to create .cursor/hooks directory for Cursor mode test
$cursorHooksDir = ".cursor/hooks"
if (-not (Test-Path $cursorHooksDir)) {
    New-Item -ItemType Directory -Path $cursorHooksDir -Force | Out-Null
}

# Copy cost-monitor.py to .cursor/hooks for test
Copy-Item "cost-monitor.py" "$cursorHooksDir/cost-monitor.py"

$testInput2 = '{}'
$testInput2 | python "$cursorHooksDir/cost-monitor.py" --cursor 2>&1 | Out-Null

if (Test-Path "$cursorHooksDir/.cost-state.json") {
    Write-Host "[OK] .cursor/hooks/.cost-state.json generated successfully" -ForegroundColor Green
    $content2 = Get-Content "$cursorHooksDir/.cost-state.json" -Raw
    Write-Host "Content: $content2" -ForegroundColor Gray
} else {
    Write-Host "[FAIL] .cursor/hooks/.cost-state.json was not generated" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Hook script: cost-monitor.py" -ForegroundColor White
Write-Host "CLI mode output: .codebuddy/hooks/.cost-state.json" -ForegroundColor White
Write-Host "Cursor mode output: .cursor/hooks/.cost-state.json" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy cost-monitor.py to your project's .codebuddy/hooks/ directory" -ForegroundColor Yellow
Write-Host "2. Configure .codebuddy/settings.json with the hook (see templates/.codebuddy/settings.json)" -ForegroundColor Yellow
Write-Host "3. Start a chat in CodeBuddy IDE to trigger the hook" -ForegroundColor Yellow
Write-Host "4. Check if .codebuddy/hooks/.cost-state.json is created" -ForegroundColor Yellow
