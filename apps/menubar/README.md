# AIRIS MCP Menubar (Preview)

A lightweight Electron tray app that surfaces MCP Gateway status directly from the macOS menu bar (works on Windows/Linux system trays as well).

## Commands

```bash
# from repo root
pnpm menubar
```

## Environment variables

- `MCP_GATEWAY_API` (defaults to `http://localhost:9100/api/v1`)
- `MCP_GATEWAY_DASHBOARD` (defaults to `http://ui.gateway.localhost:5174`)
- `MCP_GATEWAY_REFRESH_MS` (defaults to `10000`)

## Features
- Shows total/active servers and API-key-missing count.
- Lists each MCP server with quick enable/disable action.
- Opens the web dashboard for deeper configuration.
- Auto-refreshes every 10 seconds.

> ⚠️ This is an early preview: authentication, notifications, and error badges still need polishing.
