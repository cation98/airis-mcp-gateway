#!/usr/bin/env node

/**
 * AIRIS MCP Gateway Control Server
 *
 * Provides dynamic MCP server enable/disable control for intelligent resource management
 * Allows PM Agent and other orchestrators to optimize token usage by enabling servers on-demand
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Gateway API configuration
const GATEWAY_API_BASE = process.env.API_URL || "http://api:9900/api/v1";

interface MCPServer {
  id: number;
  name: string;
  enabled: boolean;
  description?: string;
  command?: string;
  created_at: string;
  updated_at: string;
}

interface ToggleRequest {
  enabled: boolean;
}

// Initialize MCP Server
const server = new Server(
  {
    name: "airis-mcp-gateway-control",
    version: "1.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_mcp_servers",
        description: "List all MCP servers with their status (enabled/disabled). Use this to see available servers before enabling/disabling them.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "enable_mcp_server",
        description: "Enable an MCP server by name. Use this when you need a specific tool (e.g., 'time' for current timestamp, 'tavily' for web search). The server becomes immediately available after enabling.",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Name of the MCP server to enable (e.g., 'time', 'tavily', 'supabase')",
              minLength: 1
            }
          },
          required: ["server_name"]
        }
      },
      {
        name: "disable_mcp_server",
        description: "Disable an MCP server by name. Use this after completing tasks to optimize token usage. Disabled servers won't consume context until re-enabled.",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Name of the MCP server to disable",
              minLength: 1
            }
          },
          required: ["server_name"]
        }
      },
      {
        name: "get_mcp_server_status",
        description: "Get detailed status of a specific MCP server including enabled state, description, and configuration.",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Name of the MCP server to check",
              minLength: 1
            }
          },
          required: ["server_name"]
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_mcp_servers": {
        const response = await fetch(`${GATEWAY_API_BASE}/mcp/servers/`);

        if (!response.ok) {
          throw new Error(`Gateway API error: ${response.status} ${response.statusText}`);
        }

        const servers: MCPServer[] = await response.json();

        if (servers.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "📋 No MCP servers configured.\n\nCheck mcp-config.json to add servers."
              }
            ]
          };
        }

        // Format server list
        const serverList = servers.map(s => {
          const status = s.enabled ? "✅ enabled" : "⏸️ disabled";
          const desc = s.description ? `\n   ${s.description}` : "";
          return `• ${s.name}: ${status}${desc}`;
        }).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `📋 MCP Servers (${servers.length} total):\n\n${serverList}\n\n💡 Use enable_mcp_server/disable_mcp_server to manage.`
            }
          ]
        };
      }

      case "enable_mcp_server": {
        const { server_name } = args as { server_name: string };

        // Get server ID
        const listResponse = await fetch(`${GATEWAY_API_BASE}/mcp/servers/`);
        if (!listResponse.ok) {
          throw new Error(`Gateway API error: ${listResponse.status}`);
        }

        const servers: MCPServer[] = await listResponse.json();
        const targetServer = servers.find(s => s.name === server_name);

        if (!targetServer) {
          const available = servers.map(s => s.name).join(", ");
          return {
            content: [
              {
                type: "text",
                text: `❌ Server '${server_name}' not found.\n\n📋 Available servers:\n${available}\n\n💡 Use list_mcp_servers for detailed info.`
              }
            ]
          };
        }

        // Check if already enabled
        if (targetServer.enabled) {
          return {
            content: [
              {
                type: "text",
                text: `ℹ️ Server '${server_name}' is already enabled.\n\nNo action needed.`
              }
            ]
          };
        }

        // Enable server
        const toggleResponse = await fetch(
          `${GATEWAY_API_BASE}/mcp/servers/${targetServer.id}/toggle`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ enabled: true } as ToggleRequest),
          }
        );

        if (!toggleResponse.ok) {
          throw new Error(`Failed to enable server: ${toggleResponse.status}`);
        }

        // Restart Gateway to apply changes
        const restartResponse = await fetch(
          `${GATEWAY_API_BASE}/gateway/restart`,
          { method: "POST" }
        );

        if (!restartResponse.ok) {
          console.error(`Warning: Gateway restart failed: ${restartResponse.status}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `✅ MCP server '${server_name}' enabled successfully.\n\nGateway restarted - tools from this server are now available.`
            }
          ]
        };
      }

      case "disable_mcp_server": {
        const { server_name } = args as { server_name: string };

        // Get server ID
        const listResponse = await fetch(`${GATEWAY_API_BASE}/mcp/servers/`);
        if (!listResponse.ok) {
          throw new Error(`Gateway API error: ${listResponse.status}`);
        }

        const servers: MCPServer[] = await listResponse.json();
        const targetServer = servers.find(s => s.name === server_name);

        if (!targetServer) {
          const available = servers.map(s => s.name).join(", ");
          return {
            content: [
              {
                type: "text",
                text: `❌ Server '${server_name}' not found.\n\n📋 Available servers:\n${available}`
              }
            ]
          };
        }

        // Check if already disabled
        if (!targetServer.enabled) {
          return {
            content: [
              {
                type: "text",
                text: `ℹ️ Server '${server_name}' is already disabled.\n\nNo action needed.`
              }
            ]
          };
        }

        // Disable server
        const toggleResponse = await fetch(
          `${GATEWAY_API_BASE}/mcp/servers/${targetServer.id}/toggle`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ enabled: false } as ToggleRequest),
          }
        );

        if (!toggleResponse.ok) {
          throw new Error(`Failed to disable server: ${toggleResponse.status}`);
        }

        // Restart Gateway to apply changes
        const restartResponse = await fetch(
          `${GATEWAY_API_BASE}/gateway/restart`,
          { method: "POST" }
        );

        if (!restartResponse.ok) {
          console.error(`Warning: Gateway restart failed: ${restartResponse.status}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `⏸️ MCP server '${server_name}' disabled successfully.\n\nGateway restarted - token usage optimized, server won't consume context until re-enabled.`
            }
          ]
        };
      }

      case "get_mcp_server_status": {
        const { server_name } = args as { server_name: string };

        const response = await fetch(`${GATEWAY_API_BASE}/mcp-servers/`);
        if (!response.ok) {
          throw new Error(`Gateway API error: ${response.status}`);
        }

        const servers: MCPServer[] = await response.json();
        const targetServer = servers.find(s => s.name === server_name);

        if (!targetServer) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Server '${server_name}' not found.\n\n💡 Use list_mcp_servers to see available servers.`
              }
            ]
          };
        }

        const status = targetServer.enabled ? "✅ enabled" : "⏸️ disabled";
        const desc = targetServer.description || "No description";
        const cmd = targetServer.command || "N/A";
        const created = new Date(targetServer.created_at).toLocaleString();
        const updated = new Date(targetServer.updated_at).toLocaleString();

        return {
          content: [
            {
              type: "text",
              text: `📊 MCP Server: ${server_name}\n\n` +
                `Status: ${status}\n` +
                `Description: ${desc}\n` +
                `Command: ${cmd}\n` +
                `Created: ${created}\n` +
                `Updated: ${updated}\n\n` +
                `💡 Use enable_mcp_server('${server_name}') to activate.`
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `❌ Error: ${errorMessage}\n\n` +
            `Make sure AIRIS MCP Gateway is running:\n` +
            `  docker compose up -d\n\n` +
            `Gateway API: ${GATEWAY_API_BASE}`
        }
      ],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AIRIS MCP Gateway Control Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
