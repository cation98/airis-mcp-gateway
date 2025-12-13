#!/usr/bin/env node
/**
 * AIRIS Commands MCP Server
 *
 * Provides utility commands for AIRIS MCP Gateway:
 * - airis_config_get: Get current mcp-config.json
 * - airis_config_set: Update server configuration
 * - airis_profile_save: Save current config as a profile
 * - airis_profile_load: Load a saved profile
 * - airis_profile_list: List saved profiles
 * - airis_quick_setup: Interactive setup wizard
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";

const CONFIG_PATH = process.env.MCP_CONFIG_PATH || "/app/mcp-config.json";
const PROFILES_DIR = process.env.PROFILES_DIR || "/app/profiles";

interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
  log?: { level: string };
}

async function readConfig(): Promise<McpConfig> {
  const content = await fs.readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(content);
}

async function writeConfig(config: McpConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function ensureProfilesDir(): Promise<void> {
  try {
    await fs.mkdir(PROFILES_DIR, { recursive: true });
  } catch {
    // Ignore if exists
  }
}

const server = new Server(
  {
    name: "airis-commands",
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
        name: "airis_config_get",
        description: "Get current MCP configuration (all servers and their settings)",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Optional: get config for specific server only",
            },
          },
          required: [],
        },
      },
      {
        name: "airis_config_set_enabled",
        description: "Enable or disable a server in the config file",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Name of the server",
            },
            enabled: {
              type: "boolean",
              description: "Whether to enable or disable",
            },
          },
          required: ["server_name", "enabled"],
        },
      },
      {
        name: "airis_config_add_server",
        description: "Add a new MCP server to the configuration",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Server name (unique identifier)",
            },
            command: {
              type: "string",
              description: "Command to run (uvx, npx, node, etc.)",
            },
            args: {
              type: "array",
              items: { type: "string" },
              description: "Command arguments",
            },
            env: {
              type: "object",
              description: "Environment variables",
            },
            enabled: {
              type: "boolean",
              description: "Whether to enable on add (default: true)",
            },
          },
          required: ["name", "command", "args"],
        },
      },
      {
        name: "airis_config_remove_server",
        description: "Remove a server from the configuration",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Name of the server to remove",
            },
          },
          required: ["server_name"],
        },
      },
      {
        name: "airis_profile_save",
        description: "Save current configuration as a named profile",
        inputSchema: {
          type: "object",
          properties: {
            profile_name: {
              type: "string",
              description: "Name for the profile",
            },
          },
          required: ["profile_name"],
        },
      },
      {
        name: "airis_profile_load",
        description: "Load a saved profile (replaces current config)",
        inputSchema: {
          type: "object",
          properties: {
            profile_name: {
              type: "string",
              description: "Name of the profile to load",
            },
          },
          required: ["profile_name"],
        },
      },
      {
        name: "airis_profile_list",
        description: "List all saved profiles",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "airis_quick_enable",
        description: "Quickly enable multiple servers by name",
        inputSchema: {
          type: "object",
          properties: {
            servers: {
              type: "array",
              items: { type: "string" },
              description: "List of server names to enable",
            },
          },
          required: ["servers"],
        },
      },
      {
        name: "airis_quick_disable_all",
        description: "Disable all servers (for minimal config)",
        inputSchema: {
          type: "object",
          properties: {
            except: {
              type: "array",
              items: { type: "string" },
              description: "Servers to keep enabled",
            },
          },
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
      case "airis_config_get": {
        const config = await readConfig();
        const serverName = (args as any)?.server_name;

        if (serverName) {
          const serverConfig = config.mcpServers[serverName];
          if (!serverConfig) {
            throw new Error(`Server not found: ${serverName}`);
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ [serverName]: serverConfig }, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(config, null, 2),
            },
          ],
        };
      }

      case "airis_config_set_enabled": {
        const config = await readConfig();
        const serverName = (args as any).server_name;
        const enabled = (args as any).enabled;

        if (!config.mcpServers[serverName]) {
          throw new Error(`Server not found: ${serverName}`);
        }

        config.mcpServers[serverName].enabled = enabled;
        await writeConfig(config);

        return {
          content: [
            {
              type: "text",
              text: `Server "${serverName}" ${enabled ? "enabled" : "disabled"} in config. Restart API to apply.`,
            },
          ],
        };
      }

      case "airis_config_add_server": {
        const config = await readConfig();
        const { name: serverName, command, args: cmdArgs, env, enabled } = args as any;

        if (config.mcpServers[serverName]) {
          throw new Error(`Server already exists: ${serverName}`);
        }

        config.mcpServers[serverName] = {
          command,
          args: cmdArgs || [],
          env: env || {},
          enabled: enabled !== false,
        };

        await writeConfig(config);

        return {
          content: [
            {
              type: "text",
              text: `Server "${serverName}" added to config. Restart API to apply.`,
            },
          ],
        };
      }

      case "airis_config_remove_server": {
        const config = await readConfig();
        const serverName = (args as any).server_name;

        if (!config.mcpServers[serverName]) {
          throw new Error(`Server not found: ${serverName}`);
        }

        delete config.mcpServers[serverName];
        await writeConfig(config);

        return {
          content: [
            {
              type: "text",
              text: `Server "${serverName}" removed from config.`,
            },
          ],
        };
      }

      case "airis_profile_save": {
        await ensureProfilesDir();
        const config = await readConfig();
        const profileName = (args as any).profile_name;
        const profilePath = path.join(PROFILES_DIR, `${profileName}.json`);

        await fs.writeFile(profilePath, JSON.stringify(config, null, 2));

        return {
          content: [
            {
              type: "text",
              text: `Profile "${profileName}" saved.`,
            },
          ],
        };
      }

      case "airis_profile_load": {
        const profileName = (args as any).profile_name;
        const profilePath = path.join(PROFILES_DIR, `${profileName}.json`);

        const content = await fs.readFile(profilePath, "utf-8");
        const config = JSON.parse(content);
        await writeConfig(config);

        return {
          content: [
            {
              type: "text",
              text: `Profile "${profileName}" loaded. Restart API to apply.`,
            },
          ],
        };
      }

      case "airis_profile_list": {
        await ensureProfilesDir();
        const files = await fs.readdir(PROFILES_DIR);
        const profiles = files
          .filter((f) => f.endsWith(".json"))
          .map((f) => f.replace(".json", ""));

        if (profiles.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No profiles saved yet.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Saved profiles:\n${profiles.map((p) => `- ${p}`).join("\n")}`,
            },
          ],
        };
      }

      case "airis_quick_enable": {
        const config = await readConfig();
        const servers = (args as any).servers as string[];
        const enabled: string[] = [];
        const notFound: string[] = [];

        for (const serverName of servers) {
          if (config.mcpServers[serverName]) {
            config.mcpServers[serverName].enabled = true;
            enabled.push(serverName);
          } else {
            notFound.push(serverName);
          }
        }

        await writeConfig(config);

        let message = `Enabled: ${enabled.join(", ")}`;
        if (notFound.length > 0) {
          message += `\nNot found: ${notFound.join(", ")}`;
        }
        message += "\nRestart API to apply.";

        return {
          content: [{ type: "text", text: message }],
        };
      }

      case "airis_quick_disable_all": {
        const config = await readConfig();
        const except = ((args as any)?.except as string[]) || [];
        const disabled: string[] = [];

        for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
          if (!except.includes(serverName)) {
            serverConfig.enabled = false;
            disabled.push(serverName);
          }
        }

        await writeConfig(config);

        return {
          content: [
            {
              type: "text",
              text: `Disabled ${disabled.length} servers (kept: ${except.join(", ") || "none"}). Restart API to apply.`,
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
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AIRIS Commands MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
