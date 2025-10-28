
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  recommended?: boolean;
}

interface MCPServerCardProps {
  server: MCPServer;
  onToggle: (id: string) => void;
  onUpdateApiKey: (id: string, apiKey: string) => void;
  compact?: boolean;
}

export function MCPServerCard({ server, onToggle, onUpdateApiKey, compact = false }: MCPServerCardProps) {
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const { t } = useTranslation();
  const paddingClass = compact ? 'p-3' : 'p-4';
  const descriptionClass = compact ? 'text-[11px]' : 'text-xs';

  const commandPreview = (() => {
    const parts = [
      server.command,
      ...(Array.isArray(server.args) ? server.args.slice(0, 2) : [])
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : t('serverCard.commandPreview.builtin');
  })();

  useEffect(() => {
    if (server.apiKey && server.apiKey !== 'configured') {
      setApiKeyInput(server.apiKey);
    } else {
      setApiKeyInput('');
    }
  }, [server.apiKey]);

  const handleApiKeySubmit = () => {
    onUpdateApiKey(server.id, apiKeyInput);
    setShowApiKeyInput(false);
  };

  const getStatusColor = () => {
    switch (server.status) {
      case 'connected': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (server.status) {
      case 'connected': return 'ri-checkbox-circle-fill';
      case 'error': return 'ri-error-warning-fill';
      default: return 'ri-stop-circle-line';
    }
  };

  return (
    <div className={`bg-white rounded-lg border transition-all ${paddingClass} ${
      server.enabled ? 'border-blue-200 shadow-sm' : 'border-gray-200'
    }`}>
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900 text-sm truncate">{server.name}</h4>
            <i className={`${getStatusIcon()} text-xs ${getStatusColor()}`}></i>
            {server.recommended && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                <i className="ri-star-fill mr-1 text-xs"></i>
                {t('serverCard.badge.recommended')}
              </span>
            )}
        </div>
          <p className={`${descriptionClass} text-gray-600 truncate`}>{server.description}</p>
          <div className="text-[11px] text-gray-500 mt-1 truncate">
            {commandPreview}
          </div>
        </div>
        
        {/* オン/オフスイッチ */}
        <button
          onClick={() => onToggle(server.id)}
          className={`ml-2 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            server.enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              server.enabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* APIキー設定 */}
      {server.apiKeyRequired && (
        <div className="mt-2">
          {!showApiKeyInput ? (
            <button
              onClick={() => {
                setApiKeyInput('');
                setShowApiKeyInput(true);
              }}
              className={`w-full px-2 py-1.5 text-xs rounded border transition-colors ${
                server.apiKey 
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-orange-200 bg-orange-50 text-orange-700'
              }`}
            >
              <i className={`${server.apiKey ? 'ri-key-fill' : 'ri-key-line'} mr-1`}></i>
              {server.apiKey ? t('serverCard.buttons.configured') : t('serverCard.buttons.configure')}
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={t('serverCard.inputs.apiKeyPlaceholder')}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex gap-1">
                <button
                  onClick={handleApiKeySubmit}
                  className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  {t('common.actions.save')}
                </button>
                <button
                  onClick={() => setShowApiKeyInput(false)}
                  className="flex-1 px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors whitespace-nowrap"
                >
                  {t('common.actions.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
