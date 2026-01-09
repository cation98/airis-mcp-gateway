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
const WORKSPACE_DIR = process.env.HOST_WORKSPACE_DIR || "/workspace/host";

// MCP mapping database - maps tech stack to official MCPs
const MCP_MAPPINGS: Record<string, {
  packages: string[];
  detect?: string[];
  mcp: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  envRequired: string[];
  description: string;
}> = {
  stripe: {
    packages: ["stripe", "@stripe/stripe-js"],
    mcp: "@stripe/mcp",
    command: "npx",
    args: ["-y", "@stripe/mcp", "--tools=all", "--api-key", "${STRIPE_SECRET_KEY}"],
    env: {},
    envRequired: ["STRIPE_SECRET_KEY"],
    description: "Stripe payments API",
  },
  twilio: {
    packages: ["twilio"],
    mcp: "@twilio-alpha/mcp",
    command: "npx",
    args: ["-y", "@twilio-alpha/mcp"],
    env: {
      TWILIO_ACCOUNT_SID: "${TWILIO_ACCOUNT_SID}",
      TWILIO_API_KEY: "${TWILIO_API_KEY}",
      TWILIO_API_SECRET: "${TWILIO_API_SECRET}",
    },
    envRequired: ["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY", "TWILIO_API_SECRET"],
    description: "Twilio voice/SMS API",
  },
  supabase: {
    packages: ["@supabase/supabase-js", "@supabase/ssr"],
    mcp: "@supabase/mcp-server-supabase",
    command: "npx",
    args: ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "${SUPABASE_ACCESS_TOKEN}"],
    env: {},
    envRequired: ["SUPABASE_ACCESS_TOKEN"],
    description: "Supabase database management",
  },
  postgres: {
    packages: ["pg", "postgres", "@prisma/client", "drizzle-orm"],
    mcp: "@modelcontextprotocol/server-postgres",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"],
    env: {},
    envRequired: ["DATABASE_URL"],
    description: "Direct PostgreSQL access",
  },
  github: {
    packages: ["@octokit/rest", "octokit"],
    detect: [".git"],
    mcp: "@modelcontextprotocol/server-github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}" },
    envRequired: ["GITHUB_TOKEN"],
    description: "GitHub API",
  },
  cloudflare: {
    packages: ["@cloudflare/workers-types", "wrangler"],
    mcp: "@cloudflare/mcp-server-cloudflare",
    command: "npx",
    args: ["-y", "@cloudflare/mcp-server-cloudflare@latest"],
    env: {
      CLOUDFLARE_ACCOUNT_ID: "${CLOUDFLARE_ACCOUNT_ID}",
      CLOUDFLARE_API_TOKEN: "${CLOUDFLARE_API_TOKEN}",
    },
    envRequired: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
    description: "Cloudflare Workers, KV, R2",
  },
  playwright: {
    packages: ["playwright", "@playwright/test"],
    mcp: "@playwright/mcp",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    env: {},
    envRequired: [],
    description: "Browser automation",
  },
};

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
      {
        name: "airis_mcp_detect",
        description: "Detect tech stack in a repository and suggest relevant MCPs to add",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to repository (default: /workspace/host)",
            },
            autoAdd: {
              type: "boolean",
              description: "Automatically add detected MCPs (default: false, just suggest)",
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

      case "airis_mcp_detect": {
        const repoPath = (args as any)?.path || WORKSPACE_DIR;
        const autoAdd = (args as any)?.autoAdd === true;
        const config = await readConfig();

        const detected: Array<{
          name: string;
          reason: string;
          mcp: string;
          description: string;
          envRequired: string[];
          alreadyExists: boolean;
        }> = [];

        // Scan package.json for Node.js dependencies
        try {
          const pkgPath = path.join(repoPath, "package.json");
          const pkgContent = await fs.readFile(pkgPath, "utf-8");
          const pkg = JSON.parse(pkgContent);
          const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
          };

          for (const [mcpName, mapping] of Object.entries(MCP_MAPPINGS)) {
            for (const pkgName of mapping.packages) {
              if (allDeps[pkgName]) {
                detected.push({
                  name: mcpName,
                  reason: `Found "${pkgName}" in package.json`,
                  mcp: mapping.mcp,
                  description: mapping.description,
                  envRequired: mapping.envRequired,
                  alreadyExists: !!config.mcpServers[mcpName],
                });
                break;
              }
            }
          }
        } catch {
          // No package.json or parse error
        }

        // Check for .git directory
        try {
          await fs.access(path.join(repoPath, ".git"));
          const githubMapping = MCP_MAPPINGS.github;
          if (!detected.find(d => d.name === "github")) {
            detected.push({
              name: "github",
              reason: "Found .git directory",
              mcp: githubMapping.mcp,
              description: githubMapping.description,
              envRequired: githubMapping.envRequired,
              alreadyExists: !!config.mcpServers.github,
            });
          }
        } catch {
          // No .git directory
        }

        // Scan requirements.txt for Python dependencies
        try {
          const reqPath = path.join(repoPath, "requirements.txt");
          const reqContent = await fs.readFile(reqPath, "utf-8");
          const lines = reqContent.split("\n");

          for (const [mcpName, mapping] of Object.entries(MCP_MAPPINGS)) {
            for (const pkgName of mapping.packages) {
              if (lines.some(line => line.toLowerCase().startsWith(pkgName.toLowerCase()))) {
                if (!detected.find(d => d.name === mcpName)) {
                  detected.push({
                    name: mcpName,
                    reason: `Found "${pkgName}" in requirements.txt`,
                    mcp: mapping.mcp,
                    description: mapping.description,
                    envRequired: mapping.envRequired,
                    alreadyExists: !!config.mcpServers[mcpName],
                  });
                }
                break;
              }
            }
          }
        } catch {
          // No requirements.txt
        }

        if (detected.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No known MCPs detected in ${repoPath}.\n\nAvailable MCPs: ${Object.keys(MCP_MAPPINGS).join(", ")}`,
            }],
          };
        }

        // Filter to only new MCPs
        const newMcps = detected.filter(d => !d.alreadyExists);
        const existingMcps = detected.filter(d => d.alreadyExists);

        // Auto-add if requested
        if (autoAdd && newMcps.length > 0) {
          for (const mcp of newMcps) {
            const mapping = MCP_MAPPINGS[mcp.name];
            config.mcpServers[mcp.name] = {
              command: mapping.command,
              args: mapping.args,
              env: mapping.env,
              enabled: false, // Start disabled, user needs to set env vars
            };
          }
          await writeConfig(config);
        }

        // Format output
        let output = `## Detected Tech Stack in ${repoPath}\n\n`;

        if (newMcps.length > 0) {
          output += `### ${autoAdd ? "Added" : "Suggested"} MCPs\n\n`;
          for (const mcp of newMcps) {
            output += `- **${mcp.name}**: ${mcp.description}\n`;
            output += `  - Reason: ${mcp.reason}\n`;
            output += `  - Package: \`${mcp.mcp}\`\n`;
            if (mcp.envRequired.length > 0) {
              output += `  - Required env: ${mcp.envRequired.map(e => `\`${e}\``).join(", ")}\n`;
            }
            output += "\n";
          }
          if (autoAdd) {
            output += `\n> ${newMcps.length} MCPs added (disabled). Set required env vars and restart to use.\n`;
          } else {
            output += `\n> Run with \`autoAdd: true\` to add these MCPs to config.\n`;
          }
        }

        if (existingMcps.length > 0) {
          output += `### Already Configured\n\n`;
          for (const mcp of existingMcps) {
            output += `- **${mcp.name}**: ${mcp.reason}\n`;
          }
        }

        return {
          content: [{ type: "text", text: output }],
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
