# Xcode プロジェクト作成手順

## 1. Xcode で新規プロジェクトを作成

```bash
cd /Users/kazuki/github/airis-mcp-gateway/servers/menubar
open -a Xcode .
```

Xcode で:
1. File > New > Project
2. macOS > App を選択
3. プロジェクト名: `MenuBar`
4. Interface: SwiftUI
5. Language: Swift
6. 保存先: `/Users/kazuki/github/airis-mcp-gateway/servers/menubar`

## 2. LSUIElement を追加（メニューバーのみで起動）

`Info.plist` に追加:
```xml
<key>LSUIElement</key>
<true/>
```

## 3. API クライアントを実装

```swift
// GatewayAPI.swift
class GatewayAPI: ObservableObject {
    let baseURL = "http://localhost:9400/api/v1"
    
    func fetchServers() async throws -> [MCPServer] {
        // GET /mcp/servers/
    }
}
```

## 4. メニューバー UI

```swift
// MenuBarApp.swift
@main
struct MenuBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings { EmptyView() }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem?.button?.title = "🔷 Gateway"
        // メニュー構築
    }
}
```

