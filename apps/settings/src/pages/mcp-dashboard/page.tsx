
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MCPServerCard } from './components/MCPServerCard';
import { MultiFieldConfigModal } from './components/MultiFieldConfigModal';
import { getServerConfigSchema } from '../../types/mcp-config';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon, Zap } from 'lucide-react';
import companyLogo from '../../assets/company-logo.png';

interface MCPServer {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  command: string;
  args: string[];
  env?: Record<string, string> | null;
  apiKeyRequired: boolean;
  apiKey?: string;
  status: 'connected' | 'disconnected' | 'error';
  category: string;
  recommended: boolean;
  builtin: boolean;
}

interface SecretValueEntry {
  key_name: string;
  value: string;
}

interface ServerApiEntry {
  id: string;
  name: string;
  description: string;
  command: string | null;
  args?: string[];
  env?: Record<string, string> | null;
  apiKeyRequired: boolean;
  category: string;
  recommended: boolean;
  builtin: boolean;
}

interface SecretEntry {
  server_name: string;
  key_name: string;
}

interface ServerStateEntry {
  server_id: string;
  enabled: boolean;
}

interface ValidationResponse {
  valid: boolean;
  message?: string;
}

interface ApiErrorResponse {
  detail?: string;
}

interface DashboardStatsResponse {
  total: number;
  active: number;
  inactive: number;
  api_key_missing: number;
}

interface DashboardStats {
  total: number;
  active: number;
  inactive: number;
  apiKeyMissing: number;
}

const SINGLE_FIELD_KEY_NAMES: Record<string, string> = {
  tavily: 'TAVILY_API_KEY',
  magic: 'TWENTYFIRST_API_KEY',
  'morphllm-fast-apply': 'MORPH_API_KEY',
  stripe: 'STRIPE_SECRET_KEY',
  figma: 'FIGMA_ACCESS_TOKEN',
  'github-official': 'GITHUB_PERSONAL_ACCESS_TOKEN',
  notion: 'NOTION_API_KEY',
  'brave-search': 'BRAVE_API_KEY',
  dockerhub: 'DOCKERHUB_PAT_TOKEN',
  cloudflare: 'CLOUDFLARE_API_TOKEN',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isServerApiEntry = (value: unknown): value is ServerApiEntry => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    (typeof value.command === 'string' || value.command === null) &&
    (value.args === undefined || isStringArray(value.args)) &&
    (value.env === undefined || value.env === null || isStringRecord(value.env)) &&
    typeof value.apiKeyRequired === 'boolean' &&
    typeof value.category === 'string' &&
    typeof value.recommended === 'boolean' &&
    typeof value.builtin === 'boolean'
  );
};

const parseServerList = (value: unknown): ServerApiEntry[] => {
  if (!isRecord(value)) {
    return [];
  }

  const rawServers = (value as { servers?: unknown }).servers;
  if (!Array.isArray(rawServers)) {
    return [];
  }

  return rawServers.filter(isServerApiEntry);
};

const isSecretEntry = (value: unknown): value is SecretEntry =>
  isRecord(value) &&
  typeof value.server_name === 'string' &&
  typeof value.key_name === 'string';

const parseSecretEntries = (value: unknown): SecretEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isSecretEntry);
};

const isSecretValueEntry = (value: unknown): value is SecretValueEntry =>
  isRecord(value) &&
  typeof value.key_name === 'string' &&
  typeof value.value === 'string';

const parseSecretValueEntries = (value: unknown): SecretValueEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isSecretValueEntry);
};

const isServerStateEntry = (value: unknown): value is ServerStateEntry =>
  isRecord(value) &&
  typeof value.server_id === 'string' &&
  typeof value.enabled === 'boolean';

const parseServerStates = (value: unknown): ServerStateEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isServerStateEntry);
};

const isValidationResponse = (value: unknown): value is ValidationResponse =>
  isRecord(value) &&
  typeof value.valid === 'boolean' &&
  (value.message === undefined || typeof value.message === 'string');

const parseValidationResponse = (value: unknown): ValidationResponse | null =>
  isValidationResponse(value) ? value : null;

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
  isRecord(value) && (value.detail === undefined || typeof value.detail === 'string');

const extractErrorDetail = async (response: Response, fallback: string) => {
  try {
    const data: unknown = await response.json();
    if (isApiErrorResponse(data) && data.detail) {
      return data.detail;
    }
  } catch {
    // Ignore JSON parse errors and use fallback
  }
  return fallback;
};

const rawApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';
const API_BASE = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;

const apiFetch = (path: string, options?: RequestInit) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${API_BASE}${normalizedPath}`, options);
};

const isDashboardStatsResponse = (value: unknown): value is DashboardStatsResponse =>
  isRecord(value) &&
  typeof value.total === 'number' &&
  typeof value.active === 'number' &&
  typeof value.inactive === 'number' &&
  typeof value.api_key_missing === 'number';

const isDashboardSummaryResponse = (value: unknown): value is { stats: DashboardStatsResponse } =>
  isRecord(value) && isDashboardStatsResponse((value as { stats?: unknown }).stats);

const parseDashboardSummary = (value: unknown): DashboardStats | null => {
  if (!isDashboardSummaryResponse(value)) {
    return null;
  }

  const stats = value.stats;

  return {
    total: stats.total,
    active: stats.active,
    inactive: stats.inactive,
    apiKeyMissing: stats.api_key_missing,
  };
};

export default function MCPDashboard() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [configModalServer, setConfigModalServer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const { t } = useTranslation();

  const loadDashboardSummary = async () => {
    try {
      const response = await apiFetch('/dashboard/summary');
      if (!response.ok) {
        return;
      }
      const summaryRaw: unknown = await response.json().catch(() => null);
      const stats = parseDashboardSummary(summaryRaw);
      if (stats) {
        setDashboardStats(stats);
      }
    } catch (error) {
      console.error('Failed to load dashboard summary', error);
    }
  };

  const fetchServerSecretConfig = async (serverId: string): Promise<Record<string, string>> => {
    try {
      const response = await apiFetch(`/secrets/${serverId}/values`);
      if (!response.ok) {
        return {};
      }
      const data: unknown = await response.json().catch(() => null);
      const secretValues = parseSecretValueEntries(data);

      const config: Record<string, string> = {};
      secretValues.forEach((secret) => {
        if (secret.key_name && typeof secret.value === 'string') {
          config[secret.key_name] = secret.value;
        }
      });
      return config;
    } catch (error) {
      console.error(`Failed to load secrets for ${serverId}`, error);
      return {};
    }
  };

  const resolveSingleFieldKeyName = (serverId: string): string | undefined => {
    const schema = getServerConfigSchema(serverId);
    if (schema && schema.configType === 'single' && schema.fields.length > 0) {
      return schema.fields[0].key;
    }

    return SINGLE_FIELD_KEY_NAMES[serverId];
  };

  const loadSingleFieldSecretValue = async (serverId: string): Promise<string | null> => {
    const keyName = resolveSingleFieldKeyName(serverId);
    if (!keyName) {
      return null;
    }

    const config = await fetchServerSecretConfig(serverId);
    if (Object.prototype.hasOwnProperty.call(config, keyName)) {
      return config[keyName];
    }

    return null;
  };

  const upsertSecret = async (serverName: string, keyName: string, value: string): Promise<void> => {
    const createResponse = await apiFetch('/secrets/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        server_name: serverName,
        key_name: keyName,
        value,
      }),
    });

    if (createResponse.ok) {
      return;
    }

    if (createResponse.status === 409) {
      const updateResponse = await apiFetch(`/secrets/${serverName}/${keyName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });

      if (updateResponse.ok) {
        return;
      }

      const message = await extractErrorDetail(updateResponse, `Failed to update ${keyName}`);
      throw new Error(message);
    }

    const message = await extractErrorDetail(createResponse, `Failed to save ${keyName}`);
    throw new Error(message);
  };

  // Load server list, secrets, and toggle states from database on mount
  useEffect(() => {
    const loadServerData = async () => {
      try {
        // Load server list from mcp-config.json
        const serversResponse = await apiFetch('/mcp-config/servers');
        if (!serversResponse.ok) {
          console.error('Failed to load server list');
          setIsLoading(false);
          return;
        }
        const serversDataRaw: unknown = await serversResponse.json().catch(() => null);
        const serverList = parseServerList(serversDataRaw);

        // Load saved secrets
        const secretsResponse = await apiFetch('/secrets/');
        const secretsDataRaw: unknown = secretsResponse.ok ? await secretsResponse.json().catch(() => null) : null;
        const savedSecrets = isRecord(secretsDataRaw)
          ? parseSecretEntries((secretsDataRaw as { secrets?: unknown }).secrets)
          : [];

        // Group secrets by server_name
        const secretsByServer: Record<string, string[]> = {};
        savedSecrets.forEach((secret) => {
          if (!secretsByServer[secret.server_name]) {
            secretsByServer[secret.server_name] = [];
          }
          secretsByServer[secret.server_name].push(secret.key_name);
        });

        // Load server states (toggle persistence)
        const statesResponse = await apiFetch('/server-states/');
        const statesDataRaw: unknown = statesResponse.ok ? await statesResponse.json().catch(() => null) : null;
        const serverStates = isRecord(statesDataRaw)
          ? parseServerStates((statesDataRaw as { server_states?: unknown }).server_states)
          : [];

        // Create state lookup map
        const statesByServer: Record<string, boolean> = {};
        serverStates.forEach((state) => {
          statesByServer[state.server_id] = state.enabled;
        });

        // Merge server list with secrets and toggle states
        const mergedServers: MCPServer[] = serverList.map((server) => {
          const hasSecrets = secretsByServer[server.id]?.length > 0;
          const hasState = server.id in statesByServer;

          // Determine enabled state: DB state (highest priority) > default (false)
          // User must explicitly enable servers - no auto-enable
          let enabled = false; // Default: OFF
          if (hasState) {
            // DB state has highest priority - always use it
            enabled = statesByServer[server.id];
          }

          return {
            id: server.id,
            name: server.name,
            description: server.description,
            enabled,
            command: server.command ?? '',
            args: Array.isArray(server.args) ? server.args : [],
            env: server.env ?? null,
            apiKeyRequired: server.apiKeyRequired,
            apiKey: hasSecrets ? 'configured' : undefined,
            status: enabled ? ('connected' as const) : ('disconnected' as const),
            category: server.category,
            recommended: server.recommended,
            builtin: server.builtin
          };
        });

        setServers(mergedServers);
        setIsLoading(false);
        void loadDashboardSummary();
      } catch (error) {
        console.error('Error loading server data:', error);
        setIsLoading(false);
      }
    };

    void loadServerData();
  }, []);

  const updateApiKey = async (id: string, apiKey: string): Promise<void> => {
    // Check if server has multiple fields configuration
    const schema = getServerConfigSchema(id);

    if (schema && schema.configType !== 'single') {
      // Show multi-field modal
      setConfigModalServer(id);
      return;
    }

    const keyName = resolveSingleFieldKeyName(id);
    if (!keyName) {
      alert(t('dashboard.alerts.unknownServer', { id }));
      return;
    }

    try {
      // Save to API
      await upsertSecret(id, keyName, apiKey.trim());

      // Update local state
      setServers(prev => prev.map(server =>
        server.id === id
          ? {
              ...server,
              apiKey: 'configured'
            }
          : server
      ));

      alert(t('dashboard.alerts.apiKeySaved'));
      void loadDashboardSummary();

    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.feedback.unknownError');
      alert(t('common.feedback.error', { message }));
      throw (error instanceof Error ? error : new Error(String(error)));
    }
  };

  const saveMultiFieldConfig = async (serverId: string, config: Record<string, string>): Promise<void> => {
    for (const [keyName, value] of Object.entries(config)) {
      if (typeof value !== 'string' || value.trim() === '') {
        continue;
      }
      await upsertSecret(serverId, keyName, value);
    }

    // Update local state
    setServers(prev => prev.map(server =>
      server.id === serverId
        ? {
            ...server,
            apiKey: 'configured'
          }
        : server
    ));

    alert(t('dashboard.alerts.configSaved'));
    void loadDashboardSummary();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.status.loading')}</span>
      </div>
    );
  }

  const handleUpdateApiKey = (id: string, apiKey: string) => updateApiKey(id, apiKey);

  const builtinServers = servers.filter((server) => server.builtin);
  const managedServers = servers.filter((server) => !server.builtin);
  const configuredManagedServers = managedServers.filter((server) => server.apiKey === 'configured');
  const needsAttentionServers = managedServers.filter(
    (server) => server.apiKeyRequired && server.apiKey !== 'configured',
  );

  const renderServerList = (items: MCPServer[], emptyLabelKey: string) => (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{t(emptyLabelKey)}</p>
      ) : (
        items.map((server) => (
          <MCPServerCard
            key={server.id}
            server={server}
            onUpdateApiKey={handleUpdateApiKey}
            onRequestSecretValue={loadSingleFieldSecretValue}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={companyLogo} alt="AIRIS logo" className="h-10 w-10 rounded-full border border-border object-cover" />
            <div>
              <p className="text-base font-semibold text-foreground">{t('dashboard.header.title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.header.subtitle', { count: servers.length })}
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              {t('dashboard.header.activeSummary', {
                active: builtinServers.length + configuredManagedServers.length,
                total: servers.length,
              })}
            </span>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex items-center gap-3">
              <SettingsIcon className="size-6 text-foreground" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">{t('dashboard.hero.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('dashboard.hero.subtitle')}</p>
              </div>
            </div>
            <div className="ml-auto max-w-lg text-sm text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground">
                <Zap className="size-4 text-yellow-500" />
                <span className="font-medium">{t('dashboard.profile.dynamicTitle')}</span>
                <Badge variant="secondary">{t('dashboard.profile.recommended')}</Badge>
              </div>
              <p className="mt-2">{t('dashboard.profile.dynamicBody')}</p>
              <p className="mt-1 text-xs">{t('dashboard.profile.dynamicNote')}</p>
            </div>
          </div>
        </section>

        {dashboardStats && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">{t('dashboard.summary.total')}</p>
              <p className="text-2xl font-semibold text-foreground">{dashboardStats.total}</p>
            </div>
            <div className="rounded-2xl border border-green-400/40 bg-card p-4 shadow-sm">
              <p className="text-xs text-green-500">{t('dashboard.summary.active')}</p>
              <p className="text-2xl font-semibold text-green-500">{dashboardStats.active}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">{t('dashboard.summary.inactive')}</p>
              <p className="text-2xl font-semibold text-foreground">{dashboardStats.inactive}</p>
            </div>
            <div className="rounded-2xl border border-amber-400/40 bg-card p-4 shadow-sm">
              <p className="text-xs text-amber-500">{t('dashboard.summary.apiKeyMissing')}</p>
              <p className="text-2xl font-semibold text-amber-500">{dashboardStats.apiKeyMissing}</p>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="size-2 rounded-full bg-green-500" />
            <h2 className="text-lg font-medium text-foreground">{t('dashboard.sections.builtin', { count: builtinServers.length })}</h2>
            <Badge variant="outline">{builtinServers.length}</Badge>
            <span className="ml-auto text-xs text-muted-foreground">{t('dashboard.sections.detail.builtin')}</span>
          </div>
          {renderServerList(builtinServers, 'dashboard.sections.empty')}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="size-2 rounded-full bg-blue-500" />
            <h2 className="text-lg font-medium text-foreground">{t('dashboard.sections.managed', { count: managedServers.length })}</h2>
            <Badge variant="outline">{configuredManagedServers.length}/{managedServers.length}</Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              {t('dashboard.sections.detail.managed', { missing: needsAttentionServers.length })}
            </span>
          </div>
          {renderServerList(managedServers, 'dashboard.sections.emptyManaged')}
        </section>
      </main>

      {configModalServer && (() => {
        const schema = getServerConfigSchema(configModalServer);
        return schema ? (
          <MultiFieldConfigModal
            schema={schema}
            onSave={(config) => saveMultiFieldConfig(configModalServer, config)}
            onClose={() => setConfigModalServer(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
