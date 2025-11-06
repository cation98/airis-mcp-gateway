#!/bin/bash
# Test repository-scoped memory management

set -e

echo "🧪 Testing Repository-Scoped Memory"
echo "===================================="
echo

# Test 1: Store from airis-mcp-gateway repo
echo "📝 Test 1: Storing conversation from airis-mcp-gateway repo..."
cd ~/github/airis-mcp-gateway
echo '{"source": "claude-code", "title": "Test from airis-mcp-gateway", "content": {"messages": [{"role": "user", "content": "This is a test from airis-mcp-gateway repository"}]}}' | node servers/mindbase/dist/index.js <<EOF
{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "mindbase_store", "arguments": $(cat -)}}
EOF
echo

# Test 2: Store from SuperClaude_Framework repo
echo "📝 Test 2: Storing conversation from SuperClaude_Framework repo..."
cd ~/github/SuperClaude_Framework
echo '{"source": "claude-code", "title": "Test from SuperClaude", "content": {"messages": [{"role": "user", "content": "This is a test from SuperClaude_Framework repository"}]}}' | node ~/github/airis-mcp-gateway/servers/mindbase/dist/index.js <<EOF
{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "mindbase_store", "arguments": $(cat -)}}
EOF
echo

# Test 3: Search from airis-mcp-gateway (should only find airis results)
echo "🔍 Test 3: Searching from airis-mcp-gateway repo (should filter by repo)..."
cd ~/github/airis-mcp-gateway
echo '{"query": "test", "limit": 10}' | node servers/mindbase/dist/index.js <<EOF
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "mindbase_search", "arguments": $(cat -)}}
EOF
echo

# Test 4: Search from SuperClaude_Framework (should only find SuperClaude results)
echo "🔍 Test 4: Searching from SuperClaude_Framework repo (should filter by repo)..."
cd ~/github/SuperClaude_Framework
echo '{"query": "test", "limit": 10}' | node ~/github/airis-mcp-gateway/servers/mindbase/dist/index.js <<EOF
{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "mindbase_search", "arguments": $(cat -)}}
EOF
echo

echo "✅ Repository scope test complete!"
echo "Expected: Each search should only return conversations from its own repository"
