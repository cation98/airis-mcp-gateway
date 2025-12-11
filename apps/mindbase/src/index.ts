#!/usr/bin/env node

/**
 * MindBase MCP Server
 *
 * Wraps MindBase REST API (default: http://mindbase-api:18002) for MCP protocol integration
 * Provides semantic search and conversation storage via qwen3-embedding:8b
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { simpleGit } from "simple-git";
import path from "path";

// MindBase API configuration
const MINDBASE_API_BASE = process.env.MINDBASE_API_URL || "http://mindbase-api:18002";

// Repository detection utility
interface RepositoryInfo {
  name: string;
  path: string;
  branch: string;
}

async function detectRepository(cwd: string = process.cwd()): Promise<RepositoryInfo | null> {
  try {
    const git = simpleGit(cwd);
    const isRepo = await git.checkIsRepo();

    if (!isRepo) {
      return null;
    }

    const root = await git.revparse(['--show-toplevel']);
    const repoPath = root.trim();
    const repoName = path.basename(repoPath);
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);

    return {
      name: repoName,
      path: repoPath,
      branch: branch.trim()
    };
  } catch (error) {
    console.error("Failed to detect repository:", error);
    return null;
  }
}

interface ConversationCreate {
  source: string;
  source_conversation_id?: string;
  title?: string;
  content: Record<string, any>;
  metadata?: Record<string, any>;
  source_created_at?: string;
}

interface SearchQuery {
  query: string;
  limit?: number;
  threshold?: number;
  source?: string;
}

interface SearchResult {
  id: string;
  title?: string;
  source: string;
  similarity: number;
  created_at: string;
  content_preview: string;
}

// Initialize MCP Server
const server = new Server(
  {
    name: "mindbase",
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
        name: "mindbase_store",
        description: "Store a conversation in MindBase with automatic embedding generation using qwen3-embedding:8b. Conversations are stored in PostgreSQL with pgvector for semantic search.",
        inputSchema: {
          type: "object",
          properties: {
            source: {
              type: "string",
              enum: ["claude-code", "claude-desktop", "chatgpt", "cursor", "windsurf", "slack", "email", "google-docs"],
              description: "Source of the conversation"
            },
            title: {
              type: "string",
              description: "Conversation title (optional)"
            },
            content: {
              type: "object",
              description: "Full conversation content in JSONB format. Should contain 'messages' array with role and content."
            },
            metadata: {
              type: "object",
              description: "Custom metadata (project, tags, etc.)"
            }
          },
          required: ["source", "content"]
        }
      },
      {
        name: "mindbase_search",
        description: "Semantic search across all stored conversations using qwen3-embedding:8b + pgvector. Returns ranked results by similarity score.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query text",
              minLength: 1
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 10)",
              minimum: 1,
              maximum: 100,
              default: 10
            },
            threshold: {
              type: "number",
              description: "Similarity threshold (0.0-1.0, default: 0.8)",
              minimum: 0.0,
              maximum: 1.0,
              default: 0.8
            },
            source: {
              type: "string",
              enum: ["claude-code", "claude-desktop", "chatgpt", "cursor", "windsurf", "slack", "email", "google-docs"],
              description: "Filter by source (optional)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "mindbase_health",
        description: "Check MindBase API health status",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
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
      case "mindbase_store": {
        const conversation = args as unknown as ConversationCreate;

        // Auto-detect repository and add to metadata
        const repoInfo = await detectRepository();
        const enrichedMetadata = {
          ...conversation.metadata,
          ...(repoInfo && {
            repository: repoInfo.name,
            repository_path: repoInfo.path,
            repository_branch: repoInfo.branch
          })
        };

        const payload = {
          ...conversation,
          metadata: enrichedMetadata
        };

        const response = await fetch(`${MINDBASE_API_BASE}/conversations/store`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MindBase API error: ${response.status} ${errorText}`);
        }

        const result = await response.json();

        return {
          content: [
            {
              type: "text",
              text: `✅ Conversation stored successfully!\n\nID: ${result.id}\nSource: ${result.source}\nTitle: ${result.title || "(no title)"}\nMessages: ${result.message_count}\n\nStored with qwen3-embedding:8b (1024 dimensions) for semantic search.`
            }
          ]
        };
      }

      case "mindbase_search": {
        const query = args as unknown as SearchQuery;

        // Auto-detect repository and filter by current repo
        const repoInfo = await detectRepository();
        const searchPayload = {
          ...query,
          ...(repoInfo && {
            metadata_filter: {
              repository: repoInfo.name
            }
          })
        };

        const response = await fetch(`${MINDBASE_API_BASE}/conversations/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(searchPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MindBase API error: ${response.status} ${errorText}`);
        }

        const results: SearchResult[] = await response.json();

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No conversations found matching: "${query.query}"\n\nTry:\n- Lowering threshold (current: ${query.threshold || 0.8})\n- Using different keywords\n- Broader search terms`
              }
            ]
          };
        }

        const formattedResults = results.map((r, i) =>
          `${i + 1}. [${r.source}] ${r.title || "(no title)"}\n   Similarity: ${(r.similarity * 100).toFixed(1)}%\n   Preview: ${r.content_preview}\n   Date: ${new Date(r.created_at).toLocaleDateString()}\n   ID: ${r.id}`
        ).join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `🔍 Found ${results.length} conversations:\n\n${formattedResults}\n\n✨ Powered by qwen3-embedding:8b + pgvector`
            }
          ]
        };
      }

      case "mindbase_health": {
        const response = await fetch(`${MINDBASE_API_BASE}/health`);

        if (!response.ok) {
          throw new Error(`MindBase API is unhealthy: ${response.status}`);
        }

        const health = await response.json();

        return {
          content: [
            {
              type: "text",
              text: `✅ MindBase API is healthy\n\nStatus: ${health.status}\nService: ${health.service}\nVersion: ${health.version}\nTimestamp: ${health.timestamp}\n\nAPI: ${MINDBASE_API_BASE}`
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
          text: `❌ Error: ${errorMessage}\n\nMake sure MindBase is running:\n  cd ~/github/mindbase && make up`
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
  console.error("MindBase MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
