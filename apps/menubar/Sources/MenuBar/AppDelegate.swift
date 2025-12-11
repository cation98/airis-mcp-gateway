import AppKit
import Foundation

@MainActor
class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem?
    var statusMenu: NSMenu?
    var api: GatewayAPI?
    var updateTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Hide dock icon (menu bar only app)
        NSApp.setActivationPolicy(.accessory)

        // Create status bar item
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem?.button {
            button.title = "⚪️ Gateway"
        }

        // Create menu
        statusMenu = NSMenu()

        let headerItem = NSMenuItem(title: "AIRIS MCP Gateway", action: nil, keyEquivalent: "")
        headerItem.isEnabled = false
        statusMenu?.addItem(headerItem)

        statusMenu?.addItem(NSMenuItem.separator())

        let statusMenuItem = NSMenuItem(title: "Status: Connecting...", action: nil, keyEquivalent: "")
        statusMenuItem.isEnabled = false
        statusMenu?.addItem(statusMenuItem)

        statusMenu?.addItem(NSMenuItem.separator())

        let refreshItem = NSMenuItem(title: "Refresh", action: #selector(refresh), keyEquivalent: "r")
        refreshItem.target = self
        statusMenu?.addItem(refreshItem)

        let openSettingsItem = NSMenuItem(title: "Open Settings...", action: #selector(openSettings), keyEquivalent: "s")
        openSettingsItem.target = self
        statusMenu?.addItem(openSettingsItem)

        statusMenu?.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        statusMenu?.addItem(quitItem)

        statusItem?.menu = statusMenu

        // Initialize API client
        api = GatewayAPI()

        // Start periodic updates
        updateTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateStatus()
            }
        }

        // Initial update
        updateStatus()
    }

    @objc func refresh() {
        updateStatus()
    }

    @objc func openSettings() {
        if let url = URL(string: "http://settings.localhost:8081") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc func quit() {
        updateTimer?.invalidate()
        NSApp.terminate(nil)
    }

    private func updateStatus() {
        Task {
            do {
                let servers = try await api?.fetchServers() ?? []
                let activeCount = servers.filter { $0.enabled }.count

                await MainActor.run {
                    if let button = statusItem?.button {
                        button.title = "🟢 Gateway (\(activeCount))"
                    }

                    updateServerList(servers)
                }
            } catch {
                await MainActor.run {
                    if let button = statusItem?.button {
                        button.title = "🔴 Gateway"
                    }
                    print("Error fetching servers: \(error)")
                }
            }
        }
    }

    private func updateServerList(_ servers: [MCPServer]) {
        // Remove old server items
        if let menu = statusMenu {
            let serversStartIndex = 3  // After header, separator, status
            let serversEndIndex = menu.items.count - 4  // Before separator, refresh, settings, quit

            for i in stride(from: serversEndIndex, through: serversStartIndex, by: -1) {
                if i < menu.items.count && i >= 0 {
                    menu.removeItem(at: i)
                }
            }
        }

        // Update status item
        if let statusMenuItem = statusMenu?.items[2] {
            statusMenuItem.title = "Status: \(servers.count) servers, \(servers.filter { $0.enabled }.count) active"
        }

        // Add server items
        for (index, server) in servers.prefix(10).enumerated() {
            let serverItem = NSMenuItem(
                title: "\(server.enabled ? "✓" : "○") \(server.name)",
                action: nil,
                keyEquivalent: ""
            )
            serverItem.isEnabled = false
            statusMenu?.insertItem(serverItem, at: 3 + index)
        }
    }
}
