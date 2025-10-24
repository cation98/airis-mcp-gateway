
import { useState, useEffect } from 'react';
import { MCPServerCard } from './components/MCPServerCard';
import { ConfigEditor } from './components/ConfigEditor';
import { TipsModal } from './components/TipsModal';
import { MultiFieldConfigModal } from './components/MultiFieldConfigModal';
import { getServerConfigSchema } from '../../types/mcp-config';

interface MCPServer {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  apiKeyRequired: boolean;
  apiKey?: string;
  status: 'connected' | 'disconnected' | 'error';
  category: string;
  recommended: boolean;
  builtin: boolean;
}

interface SecretValue {
  key_name: string;
  value: string;
}

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

  const fetchServerSecretConfig = async (serverId: string) => {
    try {
      const response = await apiFetch(`/secrets/${serverId}/values`);
      if (!response.ok) {
        return {};
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        return {};
      }

      const config: Record<string, string> = {};
      (data as SecretValue[]).forEach((secret) => {
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

  const persistServerState = async (serverId: string, enabled: boolean) => {
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

  const upsertSecret = async (serverName: string, keyName: string, value: string) => {
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

      const error = await updateResponse.json().catch(() => ({}));
      const message = error?.detail ?? `Failed to update ${keyName}`;
      throw new Error(message);
    }

    const error = await createResponse.json().catch(() => ({}));
    const message = error?.detail ?? `Failed to save ${keyName}`;
    throw new Error(message);
  };

  const restartGateway = async () => {
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
        const serversData = await serversResponse.json();
        const serverList = serversData.servers || [];

        // Load saved secrets
        const secretsResponse = await apiFetch('/secrets/');
        const secretsData = secretsResponse.ok ? await secretsResponse.json() : { secrets: [] };
        const savedSecrets = secretsData.secrets || [];

        // Group secrets by server_name
        const secretsByServer: Record<string, string[]> = {};
        savedSecrets.forEach((secret: any) => {
          if (!secretsByServer[secret.server_name]) {
            secretsByServer[secret.server_name] = [];
          }
          secretsByServer[secret.server_name].push(secret.key_name);
        });

        // Load server states (toggle persistence)
        const statesResponse = await apiFetch('/server-states/');
        const statesData = statesResponse.ok ? await statesResponse.json() : { server_states: [] };
        const serverStates = statesData.server_states || [];

        // Create state lookup map
        const statesByServer: Record<string, boolean> = {};
        serverStates.forEach((state: any) => {
          statesByServer[state.server_id] = state.enabled;
        });

        // Merge server list with secrets and toggle states
        const mergedServers: MCPServer[] = serverList.map((server: any) => {
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
            enabled: enabled,
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

    loadServerData();
  }, []);

  const toggleServer = async (id: string) => {
    const currentServer = servers.find(s => s.id === id);
    if (!currentServer) return;

    const newEnabledState = !currentServer.enabled;

    if (newEnabledState && currentServer.apiKeyRequired) {
      const config = await fetchServerSecretConfig(id);

      if (Object.keys(config).length === 0) {
        alert('このサーバーの資格情報が見つかりません。APIキーを設定してから再度有効化してください。');
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
          alert('接続テストのリクエストに失敗しました。');
          return;
        }

        const validation = await validateResponse.json();
        if (!validation.valid) {
          alert(`接続テスト失敗: ${validation.message}\n\nAPIキーが正しいか確認してください。`);
          return;
        }

        alert(`接続成功: ${validation.message}`);
      } catch (error) {
        console.error('Validation error:', error);
        alert(`エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }
    }

    setServers(prev => prev.map(server =>
      server.id === id
        ? { ...server, enabled: newEnabledState, status: newEnabledState ? 'connected' : 'disconnected' }
        : server
    ));

    const persisted = await persistServerState(id, newEnabledState);

    if (!persisted) {
      console.error('Failed to persist server state');
      setServers(prev => prev.map(server =>
        server.id === id
          ? { ...server, enabled: currentServer.enabled, status: currentServer.status }
          : server
      ));
    }
  };

  const updateApiKey = async (id: string, apiKey: string) => {
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
      'stripe': 'STRIPE_SECRET_KEY',
      'figma': 'FIGMA_ACCESS_TOKEN',
      'github': 'GITHUB_PERSONAL_ACCESS_TOKEN',
      'notion': 'NOTION_API_KEY',
      'brave-search': 'BRAVE_API_KEY',
    };

    const keyName = keyNameMap[id];
    if (!keyName) {
      alert(`Unknown server: ${id}`);
      return;
    }

    try {
      // Save to API
      await upsertSecret(id, keyName, apiKey);

      // Save enabled state to DB
      const persisted = await persistServerState(id, true);
      if (!persisted) {
        throw new Error('サーバー状態の保存に失敗しました。');
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
      alert('APIキーを保存しました。Gatewayを再起動しています...');

      const restarted = await restartGateway();
      if (restarted) {
        alert('Gateway再起動完了！ツールが利用可能になりました。');
      } else {
        alert('Gateway再起動に失敗しました。手動で再起動してください。');
      }

    } catch (error) {
      alert(`エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const saveMultiFieldConfig = async (serverId: string, config: Record<string, string>) => {
    try {
      // Save all fields to API
      for (const [keyName, value] of Object.entries(config)) {
        await upsertSecret(serverId, keyName, value);
      }

      // Save enabled state to DB
      const persisted = await persistServerState(serverId, true);
      if (!persisted) {
        throw new Error('サーバー状態の保存に失敗しました。');
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
      alert('設定を保存しました。Gatewayを再起動しています...');

      const restarted = await restartGateway();

      if (restarted) {
        alert('Gateway再起動完了！ツールが利用可能になりました。');
      } else {
        alert('Gateway再起動に失敗しました。手動で再起動してください。');
      }

    } catch (error) {
      throw error; // Re-throw for modal to handle
    }
  };

  const applyOfficialRecommended = (withApi: boolean = false) => {
    setServers(prev => prev.map(server => {
      // 公式推奨（APIなし）の設定
      const officialNoApi = [
        'sequentialthinking', 'time', 'fetch', 'git', 'memory',
        'filesystem', 'context7', 'serena', 'mindbase'
      ];
      
      // 公式推奨（APIあり）の追加設定
      const officialWithApi = ['tavily', 'supabase', 'github', 'brave-search'];
      
      if (officialNoApi.includes(server.id)) {
        return { ...server, enabled: true, status: 'connected' as const };
      }
      
      if (withApi && officialWithApi.includes(server.id) && server.apiKey) {
        return { ...server, enabled: true, status: 'connected' as const };
      }
      
      return { ...server, enabled: false, status: 'disconnected' as const };
    }));
  };

  const activeServers = servers.filter(s => s.enabled && s.status === 'connected');
  const needsApiKey = servers.filter(s => s.apiKeyRequired && !s.apiKey);
  const disabledServers = servers.filter(s => !s.enabled && (!s.apiKeyRequired || s.apiKey));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">MCP Gateway Dashboard</h1>
              <p className="text-sm text-gray-600">MCPサーバー管理 - {servers.length}個のサーバー</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm">
                <span className="text-green-600 font-medium">{activeServers.length}</span>
                <span className="text-gray-500 mx-1">/</span>
                <span className="text-gray-600">{servers.length} アクティブ</span>
              </div>
              
              {/* 公式推奨設定ボタン */}
              <div className="flex gap-2">
                <button
                  onClick={() => applyOfficialRecommended(false)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  <i className="ri-star-line mr-1"></i>
                  公式推奨（APIなし）
                </button>
                <button
                  onClick={() => applyOfficialRecommended(true)}
                  className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  <i className="ri-star-fill mr-1"></i>
                  公式推奨（APIあり）
                </button>
              </div>

              {/* Tipsボタン */}
              <button
                onClick={() => setShowTips(true)}
                className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-7

                00 transition-colors whitespace-nowrap"
              >
                <i className="ri-lightbulb-line mr-1"></i>
                Tips
              </button>

              <button
                onClick={() => setShowConfigEditor(!showConfigEditor)}
                className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
              >
                <i className="ri-code-line mr-1"></i>
                設定生成
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* アクティブなサーバー */}
          <div>
            <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center">
              <i className="ri-checkbox-circle-fill mr-2"></i>
              アクティブ ({activeServers.length})
            </h3>
            <div className="space-y-3">
              {activeServers.map(server => (
                <MCPServerCard
                  key={server.id}
                  server={server}
                  onToggle={toggleServer}
                  onUpdateApiKey={updateApiKey}
                  compact={true}
                />
              ))}
            </div>
          </div>

          {/* APIキー設定が必要 */}
          <div>
            <h3 className="text-sm font-semibold text-orange-700 mb-3 flex items-center">
              <i className="ri-key-line mr-2"></i>
              APIキー設定が必要 ({needsApiKey.length})
            </h3>
            <div className="space-y-3">
              {needsApiKey.map(server => (
                <MCPServerCard
                  key={server.id}
                  server={server}
                  onToggle={toggleServer}
                  onUpdateApiKey={updateApiKey}
                  compact={true}
                />
              ))}
            </div>
          </div>

          {/* 無効化されたサーバー */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <i className="ri-stop-circle-line mr-2"></i>
              無効化 ({disabledServers.length})
            </h3>
            <div className="space-y-3">
              {disabledServers.map(server => (
                <MCPServerCard
                  key={server.id}
                  server={server}
                  onToggle={toggleServer}
                  onUpdateApiKey={updateApiKey}
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
