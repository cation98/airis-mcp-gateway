
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

export interface ConflictNotice {
  id: string;
  message: string;
  active: boolean;
}

interface MCPServerCardProps {
  server: MCPServer;
  onToggle: (id: string) => void;
  onUpdateApiKey: (id: string, apiKey: string) => Promise<void>;
  onRequestSecretValue?: (id: string) => Promise<string | null>;
  compact?: boolean;
  conflicts?: ConflictNotice[];
}

export function MCPServerCard({
  server,
  onToggle,
  onUpdateApiKey,
  onRequestSecretValue,
  compact = false,
  conflicts = [],
}: MCPServerCardProps) {
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isFetchingSecret, setIsFetchingSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [revealApiKey, setRevealApiKey] = useState(false);
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
    }
  }, [server.apiKey]);

  const handleApiKeySubmit = async () => {
    if (isFetchingSecret) {
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateApiKey(server.id, apiKeyInput);
      setShowApiKeyInput(false);
      setApiKeyInput('');
      setRevealApiKey(false);
    } catch {
      // Error is surfaced via alert in the caller; keep editor open for corrections.
    } finally {
      setIsSaving(false);
    }
  };

  const openApiKeyEditor = () => {
    setRevealApiKey(false);
    setShowApiKeyInput(true);

    if (!onRequestSecretValue) {
      setApiKeyInput('');
      return;
    }

    setIsFetchingSecret(true);
    void onRequestSecretValue(server.id)
      .then((value) => {
        if (value !== null && value !== undefined) {
          setApiKeyInput(value);
        } else {
          setApiKeyInput('');
        }
      })
      .catch((error: unknown) => {
        console.error(`Failed to load secret for ${server.id}`, error);
        alert(t('dashboard.alerts.secretLoadFailed'));
        setApiKeyInput('');
      })
      .finally(() => {
        setIsFetchingSecret(false);
      });
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

  const hasEnvRequirements = Boolean(server.env && Object.keys(server.env).length > 0);

  const headerBadges = [];

  if (server.apiKeyRequired) {
    headerBadges.push({
      key: 'api-required',
      icon: 'ri-key-2-line',
      text: t('serverCard.badge.apiKeyRequired'),
      className: 'bg-amber-100 text-amber-800 border border-amber-200',
    });
  } else if (!hasEnvRequirements) {
    headerBadges.push({
      key: 'no-setup',
      icon: 'ri-flashlight-fill',
      text: t('serverCard.badge.noSetupNeeded'),
      className: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    });
  }

  if (server.recommended) {
    headerBadges.push({
      key: 'recommended',
      icon: 'ri-star-smile-line',
      text: t('serverCard.badge.recommended'),
      className: 'bg-blue-50 text-blue-700 border border-blue-200',
    });
  }

  const conflictTooltip = conflicts.map((conflict) => `• ${conflict.message}`).join('\n');
  const hasConflicts = conflicts.length > 0;
  const activeConflicts = conflicts.filter(conflict => conflict.active);
  const toggleLabel = server.enabled
    ? t('serverCard.accessibility.disable', { name: server.name })
    : t('serverCard.accessibility.enable', { name: server.name });

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
            {hasConflicts && (
              <span
                className="inline-flex items-center justify-center"
                title={conflictTooltip}
              >
                <i
                  className={`ri-alert-line text-xs ${
                    activeConflicts.length > 0 ? 'text-amber-600' : 'text-gray-400'
                  }`}
                ></i>
              </span>
            )}
          </div>
          {headerBadges.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {headerBadges.map(badge => (
                <span
                  key={badge.key}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${badge.className}`}
                >
                  <i className={`${badge.icon} mr-1 text-xs`}></i>
                  {badge.text}
                </span>
              ))}
            </div>
          )}
          <p className={`${descriptionClass} text-gray-600 truncate`}>{server.description}</p>
          <div className="text-[11px] text-gray-500 mt-1 truncate">
            {commandPreview}
          </div>
        </div>
        
        {/* オン/オフスイッチ */}
        <button
          type="button"
          data-testid={`server-toggle-${server.id}`}
          aria-pressed={server.enabled}
          aria-label={toggleLabel}
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
              onClick={() => { openApiKeyEditor(); }}
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
              <div className="relative">
                <input
                  type={revealApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={t('serverCard.inputs.apiKeyPlaceholder')}
                  className="w-full px-2 py-1.5 pr-16 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSaving || isFetchingSecret}
                />
                <button
                  type="button"
                  onClick={() => setRevealApiKey(prev => !prev)}
                  className="absolute inset-y-0 right-2 flex items-center text-[11px] text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                  disabled={isSaving || isFetchingSecret || apiKeyInput.length === 0}
                >
                  <i className={`mr-1 text-xs ${revealApiKey ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                  {revealApiKey
                    ? t('serverCard.inputs.hideSecret')
                    : t('serverCard.inputs.showSecret')}
                </button>
              </div>
              {isFetchingSecret && (
                <p className="text-[11px] text-gray-500">
                  {t('common.status.loading')}
                </p>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => { void handleApiKeySubmit(); }}
                  className={`flex-1 px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                    isSaving || isFetchingSecret
                      ? 'bg-blue-300 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  disabled={isSaving || isFetchingSecret}
                >
                  {isSaving ? (
                    <span className="inline-flex items-center gap-1">
                      <i className="ri-loader-4-line animate-spin"></i>
                      {t('common.actions.saving') ?? t('common.actions.save')}
                    </span>
                  ) : (
                    t('common.actions.save')
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowApiKeyInput(false);
                    setApiKeyInput('');
                    setRevealApiKey(false);
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors whitespace-nowrap"
                  disabled={isSaving}
                >
                  {t('common.actions.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeConflicts.length > 0 && (
        <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-start gap-2">
          <i className="ri-alert-fill mt-0.5"></i>
          <span>
            {activeConflicts.map(conflict => conflict.message).join(' ')}
          </span>
        </div>
      )}
    </div>
  );
}
