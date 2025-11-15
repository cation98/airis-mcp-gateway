import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { expect, vi } from 'vitest';
import MCPDashboard from './page';

vi.mock('./components/MultiFieldConfigModal', () => ({ MultiFieldConfigModal: () => null }));
vi.mock('./components/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }));

type DashboardStatsResponse = {
  total: number;
  active: number;
  inactive: number;
  api_key_missing: number;
};

const jsonResponse = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

const normalizeUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if ('url' in input && typeof input.url === 'string') {
    return input.url;
  }
  throw new Error('Unsupported RequestInfo type');
};

interface FetchEntry {
  method: string;
  url: string;
  response: Response | ((init?: RequestInit) => Response);
}

const useFetchQueue = (entries: FetchEntry[]) => {
  const queue = [...entries];
  const implementation = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = normalizeUrl(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const next = queue.shift();
    if (!next) {
      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    }
    if (next.method !== method || next.url !== url) {
      throw new Error(`Expected ${next.method} ${next.url} but got ${method} ${url}`);
    }
    const payload = typeof next.response === 'function' ? next.response(init) : next.response;
    return Promise.resolve(payload);
  };
  (globalThis.fetch as unknown as Mock).mockImplementation(implementation);
  return { verifyExhausted: () => {
    if (queue.length) {
      throw new Error(`Unconsumed fetch expectations: ${queue.length}`);
    }
  }};
};

const summaryPayload = (stats: DashboardStatsResponse) => jsonResponse({ stats });

const serverDto = {
  id: 'tavily',
  name: 'Tavily',
  description: 'Search',
  command: 'tavily',
  args: [],
  env: null,
  apiKeyRequired: true,
  category: 'search',
  recommended: false,
  builtin: false,
};

describe('MCPDashboard API key flow', () => {
  test('collects API key configuration and refreshes stats', async () => {
    const { verifyExhausted } = useFetchQueue([
      { method: 'GET', url: '/api/v1/mcp-config/servers', response: jsonResponse({ servers: [serverDto] }) },
      { method: 'GET', url: '/api/v1/secrets/', response: jsonResponse({ secrets: [] }) },
      { method: 'GET', url: '/api/v1/server-states/', response: jsonResponse({ server_states: [] }) },
      { method: 'GET', url: '/api/v1/dashboard/summary', response: summaryPayload({ total: 1, active: 0, inactive: 1, api_key_missing: 1 }) },
      { method: 'GET', url: '/api/v1/secrets/tavily/values', response: jsonResponse([]) },
      {
        method: 'POST',
        url: '/api/v1/secrets/',
        response: (init) => {
          if (!init?.body || typeof init.body !== 'string') {
            throw new Error('Expected string body for secret creation');
          }
          const parsed = JSON.parse(init.body) as { value?: string };
          expect(parsed.value).toBe('tvly_api_key');
          return jsonResponse({ ok: true }, { status: 201 });
        },
      },
      { method: 'GET', url: '/api/v1/dashboard/summary', response: summaryPayload({ total: 1, active: 0, inactive: 1, api_key_missing: 0 }) },
    ]);

    const user = userEvent.setup();
    render(<MCPDashboard />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.header.title')).toBeTruthy();
    });

    await user.click(screen.getByText('serverCard.buttons.configure'));
    const input = await screen.findByPlaceholderText('serverCard.inputs.apiKeyPlaceholder');
    await user.type(input, ' tvly_api_key ');
    await user.click(screen.getByRole('button', { name: 'common.actions.save' }));

    await waitFor(() => {
      expect(screen.getByText('serverCard.buttons.configured')).toBeTruthy();
    });

    verifyExhausted();
  });
});
