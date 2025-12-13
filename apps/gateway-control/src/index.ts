#!/usr/bin/env node
/**
 * Gateway Control MCP Server
 *
 * Provides tools for controlling the AIRIS MCP Gateway:
 * - list_servers: List all MCP servers and their status
 * - enable_server: Enable a server
 * - disable_server: Disable a server
 * - get_server_status: Get detailed status of a server
 * - restart_server: Restart a server
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.API_URL || "http://localhost:9400";

interface ServerStatus {
  name: string;
  type: string;
  command?: string;
  enabled: boolean;
  state: string;
  tools_count: number;
}

async function fetchApi(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

const server = new Server(
  {
    name: "gateway-control",
    version: "1.0.0",
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
        name: "gateway_list_servers",
        description: "List all MCP servers registered in the gateway with their current status (enabled/disabled, running/stopped, tools count)",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "gateway_enable_server",
        description: "Enable an MCP server in the gateway. The server will start on next request.",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Name of the server to enable",
            },
          },
          required: ["server_name"],
        },
      },
      {
        name: "gateway_disable_server",
        description: "Disable an MCP server in the gateway. Running process will be stopped.",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Name of the server to disable",
            },
          },
          required: ["server_name"],
        },
      },
      {
        name: "gateway_get_server_status",
        description: "Get detailed status of a specific MCP server",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Name of the server to get status for",
            },
          },
          required: ["server_name"],
        },
      },
      {
        name: "gateway_list_tools",
        description: "List all available tools from all enabled MCP servers",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Optional: filter tools by server name",
            },
          },
          required: [],
        },
      },
      {
        name: "gateway_health",
        description: "Check gateway health and get overview of all servers",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "gateway_list_servers": {
        const result = await fetchApi("/process/servers");
        const servers: ServerStatus[] = result.servers || [];

        const formatted = servers.map((s) =>
          `- ${s.name}: ${s.enabled ? "enabled" : "disabled"} | ${s.state} | ${s.tools_count} tools`
        ).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `MCP Servers (${servers.length}):\n\n${formatted}`,
            },
          ],
        };
      }

      case "gateway_enable_server": {
        const serverName = (args as any).server_name;
        if (!serverName) {
          throw new Error("server_name is required");
        }

        const result = await fetchApi(`/process/servers/${serverName}/enable`, {
          method: "POST",
        });

        return {
          content: [
            {
              type: "text",
              text: `Server "${serverName}" enabled. State: ${result.state}`,
            },
          ],
        };
      }

      case "gateway_disable_server": {
        const serverName = (args as any).server_name;
        if (!serverName) {
          throw new Error("server_name is required");
        }

        const result = await fetchApi(`/process/servers/${serverName}/disable`, {
          method: "POST",
        });

        return {
          content: [
            {
              type: "text",
              text: `Server "${serverName}" disabled. State: ${result.state}`,
            },
          ],
        };
      }

      case "gateway_get_server_status": {
        const serverName = (args as any).server_name;
        if (!serverName) {
          throw new Error("server_name is required");
        }

        const result = await fetchApi(`/process/servers/${serverName}`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "gateway_list_tools": {
        const serverName = (args as any)?.server_name;
        const path = serverName
          ? `/process/tools?server=${serverName}`
          : "/process/tools";

        const result = await fetchApi(path);
        const tools = result.tools || [];

        const formatted = tools.map((t: any) => `- ${t.name}: ${t.description || "(no description)"}`).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Available Tools (${tools.length}):\n\n${formatted}`,
            },
          ],
        };
      }

      case "gateway_health": {
        const [health, ready, status] = await Promise.all([
          fetchApi("/health"),
          fetchApi("/ready"),
          fetchApi("/api/tools/status"),
        ]);

        const servers = status.servers || [];
        const serverSummary = servers.map((s: any) =>
          `  - ${s.name}: ${s.status || s.state}`
        ).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Gateway Health:
- Status: ${health.status}
- Ready: ${ready.ready}
- Gateway: ${ready.gateway}

Servers (${servers.length}):
${serverSummary}

SSE Stats:
- Active clients: ${status.sse?.active_clients || 0}
- Total events: ${status.sse?.total_events_sent || 0}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Gateway Control MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
