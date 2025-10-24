
import { useState } from 'react';

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

export function ConfigEditor({ servers }: ConfigEditorProps) {
  const [selectedFormat, setSelectedFormat] = useState<'claude' | 'cursor' | 'json'>('claude');

  const generateConfig = () => {
    const enabledServers = servers.filter(s => s.enabled);

    const buildServerConfig = (server: MCPServer) => {
      const config: Record<string, unknown> = {
        command: server.command
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
          mcpServers: enabledServers.reduce((acc, server) => {
            acc[server.id] = buildServerConfig(server);
            return acc;
          }, {} as any)
        }, null, 2);
        
      case 'cursor':
        return JSON.stringify({
          "mcp.servers": enabledServers.reduce((acc, server) => {
            acc[server.id] = buildServerConfig(server);
            return acc;
          }, {} as any)
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
    navigator.clipboard.writeText(generateConfig());
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          <i className="ri-code-line mr-2 text-blue-600"></i>
          設定ファイル生成
        </h3>
        <div className="flex gap-1">
          {[
            { key: 'claude', label: 'Claude' },
            { key: 'cursor', label: 'Cursor' },
            { key: 'json', label: 'JSON' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedFormat(key as any)}
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
          コピー
        </button>
      </div>

      <div className="mt-3 p-3 bg-blue-50 rounded text-xs">
        <div className="text-blue-800">
          {selectedFormat === 'claude' && (
            <span><strong>配置先:</strong> ~/.claude/claude_desktop_config.json</span>
          )}
          {selectedFormat === 'cursor' && (
            <span><strong>配置先:</strong> 設定 &gt; MCP Servers</span>
          )}
          {selectedFormat === 'json' && (
            <span><strong>配置先:</strong> 任意の場所に保存</span>
          )}
        </div>
      </div>
    </div>
  );
}
