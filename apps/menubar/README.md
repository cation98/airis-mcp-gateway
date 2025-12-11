# AIRIS MCP Gateway MenuBar

macOS menu bar app for monitoring MCP Gateway status.

## Quick Start

```bash
# Build
swift build

# Run
.build/debug/MenuBar
```

## Development

### Open in Xcode

```bash
open Package.swift
```

### Build & Run from Xcode

1. Open `Package.swift` in Xcode
2. Select MenuBar target
3. Build and run (⌘R)

## Features

- ✅ Real-time Gateway status in menu bar
- ✅ Server list display (top 10)
- ✅ Active server count indicator
- ✅ Refresh on demand
- ✅ Open Settings UI in browser
- 🚧 Server enable/disable toggle (TODO)
- 🚧 API key management (TODO)

## Status Indicators

- 🟢 Gateway (N) - Connected, N servers active
- ⚪️ Gateway - Connecting...
- 🔴 Gateway - Connection failed

## API Endpoint

Gateway API: `http://localhost:9400/api/v1`

## Built With

- Swift 6.2
- AppKit (native macOS UI)
- Swift Concurrency (async/await)
- URLSession for API calls

