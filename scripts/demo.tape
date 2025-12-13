# VHS Recording Script for AIRIS MCP Gateway Demo

Output "assets/demo.gif"
Set FontSize 16
Set Width 800
Set Height 500
Set Theme "Catppuccin Mocha"
Set Padding 15
Set TypingSpeed 40ms

Hide
Type "cd ~/github/airis-mcp-gateway"
Enter
Sleep 500ms
Show

# Step 1: Start
Type "docker compose up -d"
Enter
Sleep 2s

# Step 2: Check status
Type "docker compose ps"
Enter
Sleep 2s

# Step 3: Register with Claude Code
Type "claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse"
Enter
Sleep 2s

# Done
Type "# Ready! MCP Gateway + Proxy running"
Enter
Sleep 2s
