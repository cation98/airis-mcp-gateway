class AirisMenubar < Formula
  desc "macOS menu bar app for AIRIS MCP Gateway monitoring"
  homepage "https://github.com/agiletec-inc/airis-mcp-gateway"
  url "https://github.com/agiletec-inc/airis-mcp-gateway.git", branch: "main"
  version "0.1.0"
  license "MIT"

  depends_on xcode: ["14.0", :build]
  depends_on :macos

  def install
    cd "servers/menubar" do
      system "swift", "build", "-c", "release"
      bin.install ".build/release/MenuBar" => "airis-menubar"
    end
  end

  def caveats
    <<~EOS
      AIRIS MenuBar has been installed!

      To start the menu bar app:
        airis-menubar

      The app will connect to the AIRIS MCP Gateway at:
        http://localhost:9400/api/v1

      Make sure the gateway is running:
        cd ~/github/airis-mcp-gateway && docker compose up -d
    EOS
  end

  test do
    assert_predicate bin/"airis-menubar", :exist?
  end
end
