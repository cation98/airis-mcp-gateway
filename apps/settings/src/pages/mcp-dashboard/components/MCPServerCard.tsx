import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Brain,
  CheckCircle2,
  Chrome,
  Circle,
  Clock,
  Database,
  FileText,
  FolderTree,
  Github,
  GitBranch,
  Lightbulb,
  Loader2,
  Network,
  Search,
  Sliders,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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
  builtin: boolean;
}

interface MCPServerCardProps {
  server: MCPServer;
  onUpdateApiKey: (id: string, apiKey: string) => Promise<void>;
  onRequestSecretValue?: (id: string) => Promise<string | null>;
}

export function MCPServerCard({
  server,
  onUpdateApiKey,
  onRequestSecretValue,
}: MCPServerCardProps) {
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isFetchingSecret, setIsFetchingSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [revealApiKey, setRevealApiKey] = useState(false);
  const { t } = useTranslation();

  const hasConfiguredSecret = server.apiKey === 'configured';

  useEffect(() => {
    if (!showApiKeyInput) {
      setApiKeyInput('');
      setRevealApiKey(false);
    }
  }, [showApiKeyInput]);

  const commandPreview = useMemo(() => {
    const parts = [server.command, ...(Array.isArray(server.args) ? server.args.slice(0, 2) : [])]
      .filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : t('serverCard.commandPreview.builtin');
  }, [server.args, server.command, t]);

  const openApiKeyEditor = () => {
    setShowApiKeyInput(true);
    setRevealApiKey(false);

    if (!onRequestSecretValue) {
      setApiKeyInput('');
      return;
    }

    setIsFetchingSecret(true);
    void onRequestSecretValue(server.id)
      .then((value) => {
        setApiKeyInput(value ?? '');
      })
      .catch((error: unknown) => {
        console.error(`Failed to load secret for ${server.id}`, error);
        alert(t('dashboard.alerts.secretLoadFailed'));
      })
      .finally(() => {
        setIsFetchingSecret(false);
      });
  };

  const handleApiKeySubmit = async () => {
    if (apiKeyInput.trim().length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateApiKey(server.id, apiKeyInput);
      setShowApiKeyInput(false);
      setApiKeyInput('');
      setRevealApiKey(false);
    } catch {
      // Error surfaced upstream via alert
    } finally {
      setIsSaving(false);
    }
  };

  const renderServerIcon = () => {
    const iconClass = 'size-6 text-muted-foreground';
    switch (server.name) {
      case 'time':
        return <Clock className={iconClass} />;
      case 'fetch':
      case 'brave-search':
      case 'tavily':
        return <Search className={iconClass} />;
      case 'git':
        return <GitBranch className={iconClass} />;
      case 'memory':
      case 'mindbase':
        return <Brain className={iconClass} />;
      case 'filesystem':
        return <FolderTree className={iconClass} />;
      case 'context7':
        return <FileText className={iconClass} />;
      case 'airis-mcp-gateway-control':
        return <Sliders className={iconClass} />;
      case 'serena':
        return <Lightbulb className={iconClass} />;
      case 'github':
      case 'github-official':
        return <Github className={iconClass} />;
      case 'supabase':
      case 'airis-mcp-supabase-selfhost':
        return <Database className={iconClass} />;
      case 'playwright':
      case 'chrome-devtools':
      case 'chrome':
        return <Chrome className={iconClass} />;
      case 'magic':
      case 'morphllm-fast-apply':
        return <Zap className={iconClass} />;
      default:
        return <Network className={iconClass} />;
    }
  };

  const showDescription = server.enabled || server.status === 'connected';

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-border bg-card px-4 py-3 text-foreground last:border-b-0">
      <div className="flex min-w-[220px] items-center gap-3">
        {renderServerIcon()}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-mono text-foreground">
            <span>{server.name}</span>
            {server.recommended && (
              <Badge variant="secondary">{t('serverCard.badge.recommended')}</Badge>
            )}
            {server.apiKeyRequired && (
              <Badge variant="outline">{t('serverCard.badge.apiKeyRequired')}</Badge>
            )}
            {hasConfiguredSecret && (
              <Badge variant="outline" className="text-green-600 dark:text-green-300">
                {t('serverCard.badge.configured')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {showDescription ? server.description : t('serverCard.description.hidden')}
          </p>
        </div>
      </div>

        <div className="min-w-[200px] flex-1 text-xs text-muted-foreground">
        <p className="font-mono text-[11px] uppercase tracking-wide text-foreground/70">{commandPreview}</p>
      </div>

      {server.apiKeyRequired && (
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[260px]">
          {showApiKeyInput ? (
            <>
              <Input
                type={revealApiKey ? 'text' : 'password'}
                placeholder={t('serverCard.inputs.apiKeyPlaceholder')}
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                disabled={isFetchingSecret || isSaving}
                className="max-w-[280px]"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setRevealApiKey((prev) => !prev)}
                disabled={isFetchingSecret || isSaving}
              >
                {revealApiKey ? t('serverCard.inputs.hideSecret') : t('serverCard.inputs.showSecret')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void handleApiKeySubmit();
                }}
                disabled={isSaving || apiKeyInput.trim().length === 0}
              >
                {isSaving ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" />
                    {t('common.actions.saving')}
                  </span>
                ) : (
                  t('common.actions.save')
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowApiKeyInput(false)}
                disabled={isSaving}
              >
                {t('common.actions.cancel')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openApiKeyEditor}
              disabled={isFetchingSecret}
            >
              {hasConfiguredSecret ? t('serverCard.buttons.configured') : t('serverCard.buttons.configure')}
            </Button>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-3 min-w-[160px] justify-end">
        <Badge
          variant={server.status === 'connected' ? 'secondary' : 'outline'}
          className={server.status === 'connected' ? 'text-green-700 dark:text-green-300' : ''}
        >
          {server.status === 'connected' ? (
            <CheckCircle2 className="mr-1 size-3" />
          ) : (
            <Circle className="mr-1 size-3" />
          )}
          {t(`serverCard.status.${server.status}`)}
        </Badge>
        <span className="text-xs text-muted-foreground">{t('serverCard.badge.managedByAi')}</span>
      </div>
    </div>
  );
}
