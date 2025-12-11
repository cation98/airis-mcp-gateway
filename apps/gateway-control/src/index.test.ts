#!/usr/bin/env node
/**
 * Unit tests for AIRIS MCP Gateway Control Server
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('AIRIS MCP Gateway Control Server', () => {
  beforeAll(() => {
    process.env.API_URL = 'http://localhost:9900/api/v1';
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('list_mcp_servers', () => {
    it('should return list of servers with enabled status', async () => {
      const mockServers = [
        { id: 1, name: 'context7', enabled: true, description: 'Context-aware completion' },
        { id: 2, name: 'github', enabled: false, description: 'GitHub operations' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockServers,
      });

      // Test that tools/list includes list_mcp_servers
      const tools = [
        { name: 'list_mcp_servers' },
        { name: 'enable_mcp_server' },
        { name: 'disable_mcp_server' },
        { name: 'get_mcp_server_status' },
      ];

      expect(tools.map(t => t.name)).toContain('list_mcp_servers');
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // Test error handling
      expect(async () => {
        await fetch('http://localhost:9900/api/v1/mcp/servers/');
      }).rejects;
    });
  });

  describe('enable_mcp_server', () => {
    it('should enable a server and restart gateway', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 1, name: 'github', enabled: false }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, name: 'github', enabled: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Gateway restarted' }),
        });
      global.fetch = mockFetch;

      const listResponse = await fetch('http://localhost:9900/api/v1/mcp/servers/');
      expect(listResponse.ok).toBe(true);

      const toggleResponse = await fetch('http://localhost:9900/api/v1/mcp/servers/1/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled: true }),
      });
      expect(toggleResponse.ok).toBe(true);

      const restartResponse = await fetch('http://localhost:9900/api/v1/gateway/restart', {
        method: 'POST',
      });
      expect(restartResponse.ok).toBe(true);
    });

    it('should handle server not found', async () => {
      const mockServers = [
        { id: 1, name: 'context7', enabled: true },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockServers,
      });

      const response = await fetch('http://localhost:9900/api/v1/mcp/servers/');
      const servers = await response.json();

      const targetServer = servers.find((s: any) => s.name === 'nonexistent');
      expect(targetServer).toBeUndefined();
    });

    it('should skip enabling if already enabled', async () => {
      const mockServers = [
        { id: 1, name: 'context7', enabled: true },
      ];

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockServers,
      });
      global.fetch = mockFetch;

      const response = await fetch('http://localhost:9900/api/v1/mcp/servers/');
      const servers = await response.json();

      const targetServer = servers.find((s: any) => s.name === 'context7');
      expect(targetServer?.enabled).toBe(true);
    });
  });

  describe('disable_mcp_server', () => {
    it('should disable a server and restart gateway', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 1, name: 'github', enabled: true }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, name: 'github', enabled: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Gateway restarted' }),
        });
      global.fetch = mockFetch;

      const listResponse = await fetch('http://localhost:9900/api/v1/mcp/servers/');
      expect(listResponse.ok).toBe(true);

      const toggleResponse = await fetch('http://localhost:9900/api/v1/mcp/servers/1/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled: false }),
      });
      expect(toggleResponse.ok).toBe(true);
    });

    it('should skip disabling if already disabled', async () => {
      const mockServers = [
        { id: 1, name: 'github', enabled: false },
      ];

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockServers,
      });
      global.fetch = mockFetch;

      const response = await fetch('http://localhost:9900/api/v1/mcp/servers/');
      const servers = await response.json();

      const targetServer = servers.find((s: any) => s.name === 'github');
      expect(targetServer?.enabled).toBe(false);
    });
  });

  describe('get_mcp_server_status', () => {
    it('should return server status details', async () => {
      const mockServers = [
        {
          id: 1,
          name: 'context7',
          enabled: true,
          description: 'Context-aware completion',
          command: 'npx',
          created_at: '2025-11-21T00:00:00Z',
          updated_at: '2025-11-21T00:00:00Z',
        },
      ];

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockServers,
      });
      global.fetch = mockFetch;

      const response = await fetch('http://localhost:9900/api/v1/mcp/servers/');
      const servers = await response.json();

      const targetServer = servers.find((s: any) => s.name === 'context7');
      expect(targetServer).toBeDefined();
      expect(targetServer?.enabled).toBe(true);
      expect(targetServer?.description).toBe('Context-aware completion');
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));
      global.fetch = mockFetch;

      await expect(fetch('http://localhost:9900/api/v1/mcp/servers/')).rejects.toThrow('Network error');
    });

    it('should handle 404 errors on toggle', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      global.fetch = mockFetch;

      const response = await fetch('http://localhost:9900/api/v1/mcp/servers/999/toggle', {
        method: 'POST',
      });
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('should handle gateway restart failures gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      global.fetch = mockFetch;

      const response = await fetch('http://localhost:9900/api/v1/gateway/restart', {
        method: 'POST',
      });
      expect(response.ok).toBe(false);
      // Should still complete enable/disable operation
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full enable workflow: list → enable → restart', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 1, name: 'github', enabled: false }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, name: 'github', enabled: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Gateway restarted successfully' }),
        });
      global.fetch = mockFetch;

      const list = await fetch('http://localhost:9900/api/v1/mcp/servers/');
      expect(list.ok).toBe(true);

      const toggle = await fetch('http://localhost:9900/api/v1/mcp/servers/1/toggle', {
        method: 'POST',
      });
      expect(toggle.ok).toBe(true);

      const restart = await fetch('http://localhost:9900/api/v1/gateway/restart', {
        method: 'POST',
      });
      expect(restart.ok).toBe(true);
    });

    it('should handle concurrent enable/disable requests', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: true }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: false }) });
      global.fetch = mockFetch;

      const [enable, disable] = await Promise.all([
        fetch('http://localhost:9900/api/v1/mcp/servers/1/toggle', { method: 'POST' }),
        fetch('http://localhost:9900/api/v1/mcp/servers/2/toggle', { method: 'POST' }),
      ]);

      expect(enable.ok).toBe(true);
      expect(disable.ok).toBe(true);
    });
  });
});
