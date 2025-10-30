
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MCPServerCard, ConflictNotice } from './components/MCPServerCard';
import { ConfigEditor } from './components/ConfigEditor';
import { TipsModal } from './components/TipsModal';
import { MultiFieldConfigModal } from './components/MultiFieldConfigModal';
import { getServerConfigSchema } from '../../types/mcp-config';
import { LanguageSwitcher } from './components/LanguageSwitcher';

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

const CONFLICT_RULES: Record<string, { conflictsWith: string[]; messageKey: string }> = {
  tavily: {
    conflictsWith: ['fetch', 'brave-search'],
    messageKey: 'dashboard.alerts.conflicts.tavily',
  },
  fetch: {
    conflictsWith: ['tavily'],
    messageKey: 'dashboard.alerts.conflicts.fetch',
  },
  'brave-search': {
    conflictsWith: ['tavily'],
    messageKey: 'dashboard.alerts.conflicts.braveSearch',
  },
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

export default function MCPDashboard() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [configModalServer, setConfigModalServer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

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

  const persistServerState = async (serverId: string, enabled: boolean): Promise<boolean> => {
    try {
      const response = await apiFetch(`/server-states/${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to persist server state', error);
      return false;
    }
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

  const restartGateway = async (): Promise<boolean> => {
    try {
      const response = await apiFetch('/gateway/restart', { method: 'POST' });
      return response.ok;
    } catch (error) {
      console.error('Failed to restart gateway', error);
      return false;
    }
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
      } catch (error) {
        console.error('Error loading server data:', error);
        setIsLoading(false);
      }
    };

    void loadServerData();
  }, []);

  const toggleServer = async (id: string): Promise<void> => {
    const currentServer = servers.find(s => s.id === id);
    if (!currentServer) return;

    const newEnabledState = !currentServer.enabled;

    if (newEnabledState && currentServer.apiKeyRequired) {
      const config = await fetchServerSecretConfig(id);

      if (Object.keys(config).length === 0) {
        alert(t('dashboard.alerts.credentialsMissing'));
        return;
      }

      try {
        const validateResponse = await apiFetch(`/validate/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            server_id: id,
            config,
          }),
        });

        if (!validateResponse.ok) {
          alert(t('dashboard.alerts.validationRequestFailed'));
          return;
        }

        const validationRaw: unknown = await validateResponse.json().catch(() => null);
        const validation = parseValidationResponse(validationRaw);
        if (!validation) {
          alert(t('dashboard.alerts.validationRequestFailed'));
          return;
        }

        if (!validation.valid) {
          alert(t('dashboard.alerts.validationFailed', { message: validation.message ?? '' }));
          return;
        }

        alert(t('dashboard.alerts.validationSuccess', { message: validation.message ?? '' }));
      } catch (error) {
        console.error('Validation error:', error);
        const message = error instanceof Error ? error.message : t('common.feedback.unknownError');
        alert(t('common.feedback.error', { message }));
        return;
      }
    }

    if (newEnabledState) {
      const rule = CONFLICT_RULES[id];
      if (rule) {
        const conflictingActiveServers = servers.filter(
          (server) => rule.conflictsWith.includes(server.id) && server.enabled,
        );
        if (conflictingActiveServers.length > 0) {
          const names = conflictingActiveServers.map((server) => server.name).join(', ');
          alert(t(rule.messageKey, { server: names }));
        }
      }
    }

    setServers(prev => prev.map(server =>
      server.id === id
        ? { ...server, enabled: newEnabledState, status: newEnabledState ? 'connected' : 'disconnected' }
        : server
    ));

    const persisted = await persistServerState(id, newEnabledState);

    if (!persisted) {
      console.error(t('dashboard.alerts.saveStateFailed'));
      setServers(prev => prev.map(server =>
        server.id === id
          ? { ...server, enabled: currentServer.enabled, status: currentServer.status }
          : server
      ));
    }
  };

  const updateApiKey = async (id: string, apiKey: string): Promise<void> => {
    // Check if server has multiple fields configuration
    const schema = getServerConfigSchema(id);

    if (schema && schema.configType !== 'single') {
      // Show multi-field modal
      setConfigModalServer(id);
      return;
    }

    // Single field configuration - legacy flow
    const keyNameMap: Record<string, string> = {
      'tavily': 'TAVILY_API_KEY',
      'magic': 'TWENTYFIRST_API_KEY',
      'morphllm-fast-apply': 'MORPH_API_KEY',
      'stripe': 'STRIPE_SECRET_KEY',
      'figma': 'FIGMA_ACCESS_TOKEN',
      'github': 'GITHUB_PERSONAL_ACCESS_TOKEN',
      'notion': 'NOTION_API_KEY',
      'brave-search': 'BRAVE_API_KEY',
    };

    const keyName = keyNameMap[id];
    if (!keyName) {
      alert(t('dashboard.alerts.unknownServer', { id }));
      return;
    }

    try {
      // Save to API
      await upsertSecret(id, keyName, apiKey);

      // Save enabled state to DB
      const persisted = await persistServerState(id, true);
      if (!persisted) {
        throw new Error(t('dashboard.alerts.saveStateFailed'));
      }

      // Update local state
      setServers(prev => prev.map(server =>
        server.id === id
          ? {
              ...server,
              apiKey: 'configured',
              enabled: true,
              status: 'connected' as const
            }
          : server
      ));

      // Restart Gateway to apply changes
      alert(t('dashboard.alerts.apiKeySaved'));

      const restarted = await restartGateway();
      if (restarted) {
        alert(t('dashboard.alerts.gatewayRestartSuccess'));
      } else {
        alert(t('dashboard.alerts.gatewayRestartFailure'));
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.feedback.unknownError');
      alert(t('common.feedback.error', { message }));
    }
  };

  const saveMultiFieldConfig = async (serverId: string, config: Record<string, string>): Promise<void> => {
    for (const [keyName, value] of Object.entries(config)) {
      if (typeof value !== 'string' || value.trim() === '') {
        continue;
      }
      await upsertSecret(serverId, keyName, value);
    }

    // Save enabled state to DB
    const persisted = await persistServerState(serverId, true);
    if (!persisted) {
      throw new Error(t('dashboard.alerts.saveStateFailed'));
    }

    // Update local state
    setServers(prev => prev.map(server =>
      server.id === serverId
        ? {
            ...server,
            apiKey: 'configured',
            enabled: true,
            status: 'connected' as const
          }
        : server
    ));

    // Restart Gateway to apply changes
    alert(t('dashboard.alerts.configSaved'));

    const restarted = await restartGateway();

    if (restarted) {
      alert(t('dashboard.alerts.gatewayRestartSuccess'));
    } else {
      alert(t('dashboard.alerts.gatewayRestartFailure'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-sm text-gray-600">{t('common.status.loading')}</span>
      </div>
    );
  }

  const handleToggleServer = (id: string) => {
    void toggleServer(id);
  };

  const handleUpdateApiKey = (id: string, apiKey: string) => {
    void updateApiKey(id, apiKey);
  };

  const activeServers = servers.filter(s => s.enabled && s.status === 'connected');
  const disabledServers = servers.filter(s => !s.enabled);

  const resolveConflicts = (server: MCPServer): ConflictNotice[] => {
    const rule = CONFLICT_RULES[server.id];
    if (!rule) {
      return [];
    }
    return rule.conflictsWith.map((otherId) => {
      const counterpart = servers.find((item) => item.id === otherId);
      return {
        id: otherId,
        message: t(rule.messageKey, { server: counterpart?.name ?? otherId }),
        active: Boolean(counterpart?.enabled),
      };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t('dashboard.header.title')}</h1>
              <p className="text-sm text-gray-600">
                {t('dashboard.header.subtitle', { count: servers.length })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 justify-end">
              <div className="text-sm text-gray-600">
                {t('dashboard.header.activeSummary', { active: activeServers.length, total: servers.length })}
              </div>
              <LanguageSwitcher />
              <button
                onClick={() => setShowTips(true)}
                className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
              >
                <i className="ri-lightbulb-line mr-1"></i>
                {t('dashboard.actions.tips')}
              </button>
              <button
                onClick={() => setShowConfigEditor(!showConfigEditor)}
                className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
              >
                <i className="ri-code-line mr-1"></i>
                {showConfigEditor ? t('dashboard.actions.hideConfigGenerator') : t('dashboard.actions.showConfigGenerator')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* 設定エディター */}
        {showConfigEditor && (
          <div className="mb-6">
            <ConfigEditor servers={servers} />
          </div>
        )}

        {/* Tipsモーダル */}
        {showTips && (
          <TipsModal onClose={() => setShowTips(false)} />
        )}

        {/* 複数フィールド設定モーダル */}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center">
              <i className="ri-checkbox-circle-fill mr-2"></i>
              {t('dashboard.sections.active', { count: activeServers.length })}
            </h3>
            <div className="space-y-3">
              {activeServers.map(server => (
                <MCPServerCard
                  key={server.id}
                  server={server}
                  onToggle={handleToggleServer}
                  onUpdateApiKey={handleUpdateApiKey}
                  conflicts={resolveConflicts(server)}
                  compact={true}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <i className="ri-stop-circle-line mr-2"></i>
              {t('dashboard.sections.disabled', { count: disabledServers.length })}
            </h3>
            <div className="space-y-3">
              {disabledServers.map(server => (
                <MCPServerCard
                  key={server.id}
                  server={server}
                  onToggle={handleToggleServer}
                  onUpdateApiKey={handleUpdateApiKey}
                  conflicts={resolveConflicts(server)}
                  compact={true}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
