
import { useState } from 'react';
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
  builtin: boolean;
}

interface ConfigEditorProps {
  servers: MCPServer[];
}

type ConfigFormat = 'claude' | 'cursor' | 'json';

type ServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export function ConfigEditor({ servers }: ConfigEditorProps) {
  const [selectedFormat, setSelectedFormat] = useState<ConfigFormat>('claude');
  const { t } = useTranslation();

  const generateConfig = () => {
    const enabledServers = servers.filter(s => s.enabled);

    const buildServerConfig = (server: MCPServer): ServerConfig => {
      const config: ServerConfig = {
        command: server.command,
      };

      if (server.args.length > 0) {
        config.args = server.args;
      }

      if (server.env && Object.keys(server.env).length > 0) {
        config.env = server.env;
      }

      return config;
    };
    
    switch (selectedFormat) {
      case 'claude':
        return JSON.stringify({
          mcpServers: enabledServers.reduce<Record<string, ServerConfig>>((acc, server) => {
            const config = buildServerConfig(server);
            return { ...acc, [server.id]: config };
          }, {})
        }, null, 2);
        
      case 'cursor':
        return JSON.stringify({
          "mcp.servers": enabledServers.reduce<Record<string, ServerConfig>>((acc, server) => {
            const config = buildServerConfig(server);
            return { ...acc, [server.id]: config };
          }, {})
        }, null, 2);
        
      case 'json':
        return JSON.stringify({
          servers: enabledServers.map(server => ({
            id: server.id,
            name: server.name,
            enabled: server.enabled,
            command: server.command,
            args: server.args,
            env: server.env ?? null
          }))
        }, null, 2);
        
      default:
        return '';
    }
  };

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(generateConfig());
  };

  const formatOptions: Array<{ key: ConfigFormat; label: string }> = [
    { key: 'claude', label: t('configEditor.formats.claude') },
    { key: 'cursor', label: t('configEditor.formats.cursor') },
    { key: 'json', label: t('configEditor.formats.json') },
  ];

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          <i className="ri-code-line mr-2 text-blue-600"></i>
          {t('configEditor.title')}
        </h3>
        <div className="flex gap-1">
          {formatOptions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedFormat(key)}
              className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                selectedFormat === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto border max-h-64 overflow-y-auto">
          <code className="text-gray-800">{generateConfig()}</code>
        </pre>
        <button
          onClick={copyToClipboard}
          className="absolute top-2 right-2 px-2 py-1 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 transition-colors whitespace-nowrap"
        >
          <i className="ri-file-copy-line mr-1"></i>
          {t('common.actions.copy')}
        </button>
      </div>

      <div className="mt-3 p-3 bg-blue-50 rounded text-xs">
        <div className="text-blue-800">
          <span>
            <strong>{t('configEditor.destination.label')}</strong> {' '}
            {
              {
                claude: t('configEditor.destination.claude'),
                cursor: t('configEditor.destination.cursor'),
                json: t('configEditor.destination.json')
              }[selectedFormat]
            }
          </span>
        </div>
      </div>
    </div>
  );
}
