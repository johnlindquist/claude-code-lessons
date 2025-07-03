#!/bin/bash

echo "🚀 Running Claude Hooks Integration Tests"
echo "========================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    echo -e "\n📋 Test: $test_name"
    echo "Command: $test_command"
    
    if eval "$test_command"; then
        if [ "$expected_result" = "success" ]; then
            echo -e "${GREEN}✅ PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ FAILED - Expected failure but succeeded${NC}"
            ((TESTS_FAILED++))
        fi
    else
        if [ "$expected_result" = "failure" ]; then
            echo -e "${GREEN}✅ PASSED (expected failure)${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ FAILED${NC}"
            ((TESTS_FAILED++))
        fi
    fi
}

# Clean up test directories
echo "🧹 Cleaning up test directories..."
rm -rf /workspace/test-*

# Test 1: Help command
run_test "Help command works" \
    "/workspace/claude-hooks/bin/run.js --help 2>&1 | grep -q 'Interactive CLI to set up Claude Code hooks'" \
    "success"

# Test 2: Init help
run_test "Init help works" \
    "/workspace/claude-hooks/bin/run.js init --help 2>&1 | grep -q 'Initialize Claude Code hooks'" \
    "success"

# Test 3: Non-interactive installation
run_test "Non-interactive installation" \
    "mkdir -p /workspace/test-1 && cd /workspace/test-1 && /workspace/claude-hooks/bin/run.js init -y > /dev/null 2>&1 && test -f .claude/hooks/index.ts" \
    "success"

# Test 4: Check generated files
run_test "All required files generated" \
    "cd /workspace/test-1 && test -f .claude/settings.json && test -f .claude/hooks/lib.ts && test -f .claude/hooks/.gitignore && test -d .claude/hooks/sessions" \
    "success"

# Test 5: Settings.json has correct structure
run_test "settings.json has correct structure" \
    "cd /workspace/test-1 && grep -q '\"command\": \"bun .claude/hooks/index.ts\"' .claude/settings.json" \
    "success"

# Test 6: Generated hooks have security patterns
run_test "Generated hooks have security patterns" \
    "cd /workspace/test-1 && grep -q 'DANGEROUS_FILE_OPS' .claude/hooks/index.ts && grep -q 'SECRET_PATTERNS' .claude/hooks/index.ts" \
    "success"

# Test 7: Force overwrite works
run_test "Force overwrite works" \
    "cd /workspace/test-1 && /workspace/claude-hooks/bin/run.js init -y -f > /dev/null 2>&1" \
    "success"

# Test 8: Read-only directory fails gracefully
run_test "Read-only directory fails gracefully" \
    "mkdir -p /workspace/test-readonly && chmod 555 /workspace/test-readonly && cd /workspace/test-readonly && /workspace/claude-hooks/bin/run.js init -y 2>&1 | grep -q 'permission denied' && chmod 755 /workspace/test-readonly" \
    "success"

# Test 9: Bun warning is shown
run_test "Bun warning is shown" \
    "mkdir -p /workspace/test-2 && cd /workspace/test-2 && /workspace/claude-hooks/bin/run.js init -y 2>&1 | grep -q 'Bun is required'" \
    "success"

# Test 10: Package can be packed
run_test "NPM package can be packed" \
    "cd /workspace/claude-hooks && npm pack --dry-run > /dev/null 2>&1" \
    "success"

# Summary
echo -e "\n========================================"
echo -e "📊 Test Summary"
echo -e "========================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✨ All tests passed! The claude-hooks package is ready for use.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi