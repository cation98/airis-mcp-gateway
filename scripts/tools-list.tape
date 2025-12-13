# Tools List Screenshot
# Shows all 34+ tools available

Output "assets/tools-list.gif"
Set FontSize 14
Set Width 900
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 15
Set TypingSpeed 30ms

Type "# Available MCP Tools"
Enter
Sleep 500ms

Type "curl -s http://localhost:9400/health | jq '.tools[] | .name' | head -40"
Enter
Sleep 3s
