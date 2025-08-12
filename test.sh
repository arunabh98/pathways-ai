#!/bin/bash

# Branching Chat App - Core Regression Test Suite
# This script tests the essential functionality that must never break
# Run this after any changes to ensure the app still works correctly

set -euo pipefail  # Exit on error, undefined variable, or pipe failure

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${API_URL:-http://localhost:3001/api}"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to run a test
run_test() {
    local test_name="$1"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "  $test_name... "
}

pass_test() {
    echo -e "${GREEN}✓${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

fail_test() {
    echo -e "${RED}✗${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

# Start of tests
echo "========================================="
echo "   Branching Chat App - Regression Tests"
echo "========================================="
echo ""

# Test 1: Server Health Check
echo "1. Core Server Functionality"
echo "----------------------------"

run_test "Server is running"
if curl -s "$BASE_URL/health" 2>/dev/null | grep -q "ok"; then
    pass_test
else
    fail_test
    echo "  ERROR: Server is not responding at $BASE_URL"
    exit 1
fi

# Test 2: Session Management
echo ""
echo "2. Session Management"
echo "--------------------"

run_test "Create session"
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/session" 2>/dev/null || echo "{}")
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId' 2>/dev/null || echo "")

if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
    pass_test
else
    fail_test
    echo "  ERROR: Failed to create session"
    exit 1
fi

run_test "Retrieve session"
if curl -s "$BASE_URL/session/$SESSION_ID" 2>/dev/null | jq -e '.sessionId' > /dev/null 2>&1; then
    pass_test
else
    fail_test
fi

# Test 3: Message Handling
echo ""
echo "3. Message Handling"
echo "------------------"

run_test "Send message"
CHAT_RESPONSE=$(curl -s -X POST "$BASE_URL/chat" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"Hello, this is a test message\"}" 2>/dev/null || echo "{}")

MESSAGE_ID=$(echo "$CHAT_RESPONSE" | jq -r '.messageId' 2>/dev/null || echo "")

if [ -n "$MESSAGE_ID" ] && [ "$MESSAGE_ID" != "null" ]; then
    pass_test
else
    fail_test
fi

run_test "Receive AI response"
if echo "$CHAT_RESPONSE" | jq -e '.response' > /dev/null 2>&1; then
    pass_test
else
    fail_test
fi

run_test "Messages saved to session"
SESSION_MESSAGES=$(curl -s "$BASE_URL/session/$SESSION_ID" 2>/dev/null || echo "{}")
MESSAGE_COUNT=$(echo "$SESSION_MESSAGES" | jq '.messages | length' 2>/dev/null || echo "0")

if [ "$MESSAGE_COUNT" -ge 2 ]; then
    pass_test
else
    fail_test
fi

# Test 4: Branching Functionality
echo ""
echo "4. Branching Functionality"
echo "-------------------------"

run_test "Create branch"
FIRST_MSG_ID=$(echo "$SESSION_MESSAGES" | jq -r '.messages[0].id' 2>/dev/null || echo "")
BRANCH_RESPONSE=$(curl -s -X POST "$BASE_URL/branch" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$SESSION_ID\", \"fromMessageId\": \"$FIRST_MSG_ID\"}" 2>/dev/null || echo "{}")

if echo "$BRANCH_RESPONSE" | jq -e '.currentBranch' > /dev/null 2>&1; then
    pass_test
else
    fail_test
fi

run_test "Send message on branch"
BRANCH_MSG_RESPONSE=$(curl -s -X POST "$BASE_URL/chat" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"Alternative message on branch\"}" 2>/dev/null || echo "{}")

if echo "$BRANCH_MSG_RESPONSE" | jq -e '.messageId' > /dev/null 2>&1; then
    pass_test
else
    fail_test
fi

# Test 5: Tree Structure
echo ""
echo "5. Tree Structure"
echo "----------------"

run_test "Retrieve conversation tree"
TREE_RESPONSE=$(curl -s "$BASE_URL/session/$SESSION_ID/tree" 2>/dev/null || echo "{}")

if echo "$TREE_RESPONSE" | jq -e '.tree' > /dev/null 2>&1; then
    pass_test
else
    fail_test
fi

run_test "Tree contains branches"
TREE_BRANCHES=$(echo "$TREE_RESPONSE" | jq '[.. | objects | select(has("children")) | .children | length] | add' 2>/dev/null || echo "0")

if [ "$TREE_BRANCHES" -gt 0 ]; then
    pass_test
else
    fail_test
fi

# Test 6: Error Handling
echo ""
echo "6. Error Handling"
echo "----------------"

run_test "Handle invalid session"
INVALID_SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/chat" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"invalid-session-id\", \"message\": \"Test\"}" 2>/dev/null || echo "{}")

if echo "$INVALID_SESSION_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    pass_test
else
    fail_test
fi

run_test "Handle missing message"
MISSING_MSG_RESPONSE=$(curl -s -X POST "$BASE_URL/chat" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$SESSION_ID\"}" 2>/dev/null || echo "{}")

if echo "$MISSING_MSG_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    pass_test
else
    fail_test
fi

run_test "Handle invalid branch point"
INVALID_BRANCH_RESPONSE=$(curl -s -X POST "$BASE_URL/branch" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$SESSION_ID\", \"fromMessageId\": \"invalid-id\"}" 2>/dev/null || echo "{}")

if echo "$INVALID_BRANCH_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    pass_test
else
    fail_test
fi

# Test 7: Data Persistence
echo ""
echo "7. Data Persistence"
echo "------------------"

run_test "Session data persists"
PERSIST_CHECK=$(curl -s "$BASE_URL/session/$SESSION_ID" 2>/dev/null || echo "{}")
PERSIST_MSG_COUNT=$(echo "$PERSIST_CHECK" | jq '.messages | length' 2>/dev/null || echo "0")

if [ "$PERSIST_MSG_COUNT" -gt 0 ]; then
    pass_test
else
    fail_test
fi

# Summary
echo ""
echo "========================================="
echo "              TEST SUMMARY               "
echo "========================================="
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo "  Total: $TOTAL_TESTS | Passed: $PASSED_TESTS | Failed: $FAILED_TESTS"
    echo ""
    echo "The application's core functionality is working correctly."
    echo "It's safe to deploy or continue development."
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo "  Total: $TOTAL_TESTS | Passed: $PASSED_TESTS | Failed: $FAILED_TESTS"
    echo ""
    echo "Critical functionality is broken. Please fix before proceeding."
    echo "Run with VERBOSE=true for more details."
    exit 1
fi