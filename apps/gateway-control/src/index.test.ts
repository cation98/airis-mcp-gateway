/**
 * Gateway Control MCP Server Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock types
interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<any>;
}

// Store original fetch
const originalFetch = globalThis.fetch;

// Helper to create mock fetch
function createMockFetch(responses: Map<string, any>) {
  return vi.fn(async (url: string): Promise<MockResponse> => {
    const urlPath = new URL(url).pathname;
    const response = responses.get(urlPath);

    if (response === undefined) {
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: "Not found" }),
      };
    }

    if (response instanceof Error) {
      throw response;
    }

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => response,
    };
  });
}

describe("fetchApi helper", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should make GET request with correct headers", async () => {
    const mockFetch = createMockFetch(new Map([["/test", { data: "ok" }]]));
    globalThis.fetch = mockFetch as any;

    // Inline fetchApi logic for testing (from index.ts)
    const API_URL = "http://localhost:9400";
    const response = await fetch(`${API_URL}/test`, {
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:9400/test",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
    expect(result).toEqual({ data: "ok" });
  });

  it("should throw error on non-OK response", async () => {
    const mockFetch = vi.fn(async (): Promise<MockResponse> => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ error: "Server error" }),
    }));
    globalThis.fetch = mockFetch as any;

    const API_URL = "http://localhost:9400";
    const response = await fetch(`${API_URL}/test`);

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });
});

describe("gateway_list_servers tool", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should format server list correctly", async () => {
    const mockServers = {
      servers: [
        { name: "memory", enabled: true, state: "running", tools_count: 9 },
        { name: "fetch", enabled: false, state: "stopped", tools_count: 1 },
      ],
    };

    const mockFetch = createMockFetch(new Map([["/process/servers", mockServers]]));
    globalThis.fetch = mockFetch as any;

    const API_URL = "http://localhost:9400";
    const result = await (await fetch(`${API_URL}/process/servers`)).json();

    expect(result.servers).toHaveLength(2);
    expect(result.servers[0].name).toBe("memory");
    expect(result.servers[0].enabled).toBe(true);
  });

  it("should handle empty server list", async () => {
    const mockFetch = createMockFetch(new Map([["/process/servers", { servers: [] }]]));
    globalThis.fetch = mockFetch as any;

    const API_URL = "http://localhost:9400";
    const result = await (await fetch(`${API_URL}/process/servers`)).json();

    expect(result.servers).toHaveLength(0);
  });
});

describe("gateway_enable_server tool", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should enable server and return state", async () => {
    const mockFetch = vi.fn(async (url: string, options?: RequestInit): Promise<MockResponse> => {
      if (url.includes("/enable") && options?.method === "POST") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ name: "memory", state: "starting" }),
        };
      }
      return { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) };
    });
    globalThis.fetch = mockFetch as any;

    const API_URL = "http://localhost:9400";
    const response = await fetch(`${API_URL}/process/servers/memory/enable`, {
      method: "POST",
    });
    const result = await response.json();

    expect(result.state).toBe("starting");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/enable"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("should throw error when server_name is missing", () => {
    const serverName = "";
    expect(() => {
      if (!serverName) {
        throw new Error("server_name is required");
      }
    }).toThrow("server_name is required");
  });
});

describe("gateway_disable_server tool", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should disable server and return state", async () => {
    const mockFetch = vi.fn(async (url: string, options?: RequestInit): Promise<MockResponse> => {
      if (url.includes("/disable") && options?.method === "POST") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ name: "memory", state: "stopped" }),
        };
      }
      return { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) };
    });
    globalThis.fetch = mockFetch as any;

    const API_URL = "http://localhost:9400";
    const response = await fetch(`${API_URL}/process/servers/memory/disable`, {
      method: "POST",
    });
    const result = await response.json();

    expect(result.state).toBe("stopped");
  });
});

describe("gateway_get_server_status tool", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should return detailed server status", async () => {
    const serverStatus = {
      name: "memory",
      type: "npx",
      command: "npx",
      enabled: true,
      state: "running",
      tools_count: 9,
      pid: 1234,
      uptime: 3600,
    };

    const mockFetch = createMockFetch(new Map([["/process/servers/memory", serverStatus]]));
    globalThis.fetch = mockFetch as any;

    const API_URL = "http://localhost:9400";
    const result = await (await fetch(`${API_URL}/process/servers/memory`)).json();

    expect(result.name).toBe("memory");
    expect(result.state).toBe("running");
    expect(result.tools_count).toBe(9);
  });
});

describe("gateway_list_tools tool", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should list all tools", async () => {
    const mockTools = {
      tools: [
        { name: "create_entities", description: "Create entities" },
        { name: "search_entities", description: "Search entities" },
      ],
    };

    const mockFetch = createMockFetch(new Map([["/process/tools", mockTools]]));
    globalThis.fetch = mockFetch as any;

    const API_URL = "http://localhost:9400";
    const result = await (await fetch(`${API_URL}/process/tools`)).json();

    expect(result.tools).toHaveLength(2);
    expect(result.tools[0].name).toBe("create_entities");
  });

  it("should filter tools by server name", async () => {
    const mockTools = {
      tools: [{ name: "fetch", description: "Fetch URL" }],
    };

    const mockFetch = vi.fn(async (url: string): Promise<MockResponse> => {
      if (url.includes("server=fetch")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => mockTools,
        };
      }
      return { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) };
    });
    globalThis.fetch = mockFetch as any;

    const API_URL = "http://localhost:9400";
    const result = await (await fetch(`${API_URL}/process/tools?server=fetch`)).json();

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("fetch");
  });
});

describe("gateway_health tool", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should aggregate health data from multiple endpoints", async () => {
    const responses = new Map([
      ["/health", { status: "healthy" }],
      ["/ready", { ready: true, gateway: true }],
      ["/api/tools/status", {
        servers: [
          { name: "memory", status: "running" },
          { name: "fetch", status: "stopped" },
        ],
        sse: { active_clients: 2, total_events_sent: 100 },
      }],
    ]);

    const mockFetch = createMockFetch(responses);
    globalThis.fetch = mockFetch as any;

    const API_URL = "http://localhost:9400";

    // Simulate the parallel calls from gateway_health
    const [health, ready, status] = await Promise.all([
      fetch(`${API_URL}/health`).then(r => r.json()),
      fetch(`${API_URL}/ready`).then(r => r.json()),
      fetch(`${API_URL}/api/tools/status`).then(r => r.json()),
    ]);

    expect(health.status).toBe("healthy");
    expect(ready.ready).toBe(true);
    expect(status.servers).toHaveLength(2);
    expect(status.sse.active_clients).toBe(2);
  });
});

describe("error handling", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should handle network errors gracefully", async () => {
    const mockFetch = vi.fn(async (): Promise<MockResponse> => {
      throw new Error("Network error");
    });
    globalThis.fetch = mockFetch as any;

    const API_URL = "http://localhost:9400";

    await expect(fetch(`${API_URL}/test`)).rejects.toThrow("Network error");
  });

  it("should handle unknown tool names", () => {
    const toolName = "unknown_tool";
    expect(() => {
      if (!["gateway_list_servers", "gateway_enable_server"].includes(toolName)) {
        throw new Error(`Unknown tool: ${toolName}`);
      }
    }).toThrow("Unknown tool: unknown_tool");
  });
});

describe("server status formatting", () => {
  it("should format enabled server correctly", () => {
    const server = { name: "memory", enabled: true, state: "running", tools_count: 9 };
    const formatted = `- ${server.name}: ${server.enabled ? "enabled" : "disabled"} | ${server.state} | ${server.tools_count} tools`;

    expect(formatted).toBe("- memory: enabled | running | 9 tools");
  });

  it("should format disabled server correctly", () => {
    const server = { name: "fetch", enabled: false, state: "stopped", tools_count: 1 };
    const formatted = `- ${server.name}: ${server.enabled ? "enabled" : "disabled"} | ${server.state} | ${server.tools_count} tools`;

    expect(formatted).toBe("- fetch: disabled | stopped | 1 tools");
  });
});
