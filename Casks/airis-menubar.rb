cask "airis-menubar" do
  version "0.1.0"
  sha256 :no_check

  url "file:///Users/kazuki/github/airis-mcp-gateway/servers/menubar/.build/release/MenuBar"
  name "AIRIS MenuBar"
  desc "macOS menu bar app for AIRIS MCP Gateway monitoring"
  homepage "https://github.com/agiletec-inc/airis-mcp-gateway"

  # Install the binary directly
  binary "MenuBar", target: "airis-menubar"

  postflight do
    puts <<~EOS
      AIRIS MenuBar has been installed!

      To start the menu bar app:
        airis-menubar

      The app will connect to the AIRIS MCP Gateway at:
        http://localhost:9400/api/v1

      Make sure the gateway is running:
        cd ~/github/airis-mcp-gateway && docker compose up -d
    EOS
  end

  zap trash: [
    "~/Library/Preferences/com.agiletec.airis-menubar.plist",
  ]
end
