import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Check, X, Loader2, Settings, Zap, Clock, Globe, GitBranch, Database, FileText, Brain, Network, Code, FolderTree, Lightbulb, Github, Sliders, Chrome, Search } from 'lucide-react';
import companyLogo from 'figma:asset/5e49a8f935936121cfda0637f866fd694a487957.png';

type ConnectionStatus = 'connected' | 'testing' | 'failed' | 'none';

interface MCPServer {
  id: string;
  name: string;
  description?: string;
  requiresApiKey: boolean;
  apiKey?: string;
  status: ConnectionStatus;
  toolCount?: number;
  tokenEstimate?: number;
  category?: 'builtin' | 'gateway' | 'external';
}

type ServerSection = 'always-active' | 'ready' | 'unconfigured';

export function MCPGatewaySettings() {
  const [profile] = useState<'dynamic' | 'manual'>('dynamic');
  
  // Mock data based on actual airis-mcp-gateway spec
  const [servers, setServers] = useState<Record<ServerSection, MCPServer[]>>({
    'always-active': [
      // Built-in (10)
      { id: '1', name: 'time', description: 'Get current time (solves 2004 problem)', requiresApiKey: false, status: 'connected', toolCount: 2, tokenEstimate: 800, category: 'builtin' },
      { id: '2', name: 'fetch', description: 'Fetch URL content', requiresApiKey: false, status: 'connected', toolCount: 3, tokenEstimate: 1200, category: 'builtin' },
      { id: '3', name: 'git', description: 'Local git operations', requiresApiKey: false, status: 'connected', toolCount: 8, tokenEstimate: 3200, category: 'builtin' },
      { id: '4', name: 'memory', description: 'Short-term memory (built-in knowledge graph)', requiresApiKey: false, status: 'connected', toolCount: 5, tokenEstimate: 2000, category: 'builtin' },
      { id: '5', name: 'context7', description: 'Latest library docs (15,000+ libraries)', requiresApiKey: false, status: 'connected', toolCount: 12, tokenEstimate: 4800, category: 'builtin' },
      { id: '6', name: 'mindbase', description: 'Long-term memory (conversation history + failure learning)', requiresApiKey: false, status: 'connected', toolCount: 10, tokenEstimate: 4000, category: 'builtin' },
      { id: '7', name: 'self-management', description: 'Dynamic server management (LLM controls ON/OFF) ⭐', requiresApiKey: false, status: 'connected', toolCount: 6, tokenEstimate: 2400, category: 'builtin' },
      { id: '8', name: 'serena', description: 'Code understanding (LSP-based symbol search)', requiresApiKey: false, status: 'connected', toolCount: 15, tokenEstimate: 6000, category: 'builtin' },
      { id: '9', name: 'filesystem', description: 'File operations (read/write, image loading)', requiresApiKey: false, status: 'connected', toolCount: 14, tokenEstimate: 5600, category: 'builtin' },
      { id: '10', name: 'sequential-thinking', description: 'Complex reasoning (multi-step thinking, token optimization)', requiresApiKey: false, status: 'connected', toolCount: 8, tokenEstimate: 3200, category: 'builtin' },
    ],
    ready: [
      { id: '11', name: 'supabase', description: 'Database & Auth (Cloud)', requiresApiKey: true, status: 'connected', apiKey: '••••••••', toolCount: 22, tokenEstimate: 8900, category: 'external' },
      { id: '12', name: 'supabase-selfhosted', description: 'Database & Auth (Self-hosted)', requiresApiKey: true, status: 'connected', apiKey: '••••••••', toolCount: 22, tokenEstimate: 8900, category: 'external' },
      { id: '13', name: 'github', description: 'Repository & Issues', requiresApiKey: true, status: 'connected', apiKey: '••••••••', toolCount: 18, tokenEstimate: 7200, category: 'external' },
    ],
    unconfigured: [
      { id: '14', name: 'playwright', description: 'Browser automation', requiresApiKey: false, status: 'none', toolCount: 16, tokenEstimate: 6400, category: 'external' },
      { id: '15', name: 'puppeteer', description: 'Headless Chrome', requiresApiKey: false, status: 'none', toolCount: 14, tokenEstimate: 5600, category: 'external' },
      { id: '16', name: 'chrome-devtools', description: 'Chrome debugging', requiresApiKey: false, status: 'none', toolCount: 12, tokenEstimate: 4800, category: 'external' },
      { id: '17', name: 'sqlite', description: 'Local database', requiresApiKey: false, status: 'none', toolCount: 15, tokenEstimate: 6000, category: 'external' },
      { id: '18', name: 'tavily', description: 'Web search', requiresApiKey: true, status: 'none', toolCount: 8, tokenEstimate: 3200, category: 'external' },
      { id: '19', name: 'magic', description: 'Code transformation', requiresApiKey: true, status: 'none', toolCount: 10, tokenEstimate: 4000, category: 'external' },
      { id: '20', name: 'morphllm-fast-apply', description: 'Fast code edits', requiresApiKey: true, status: 'none', toolCount: 7, tokenEstimate: 2800, category: 'external' },
    ],
  });

  const handleTestConnection = (section: ServerSection, serverId: string) => {
    setServers(prev => ({
      ...prev,
      [section]: prev[section].map(server =>
        server.id === serverId
          ? { ...server, status: 'testing' as ConnectionStatus }
          : server
      ),
    }));

    // Simulate API test
    setTimeout(() => {
      setServers(prev => ({
        ...prev,
        [section]: prev[section].map(server =>
          server.id === serverId
            ? { ...server, status: Math.random() > 0.2 ? 'connected' : 'failed' }
            : server
        ),
      }));
    }, 1500);
  };

  const handleApiKeyChange = (section: ServerSection, serverId: string, value: string) => {
    setServers(prev => ({
      ...prev,
      [section]: prev[section].map(server =>
        server.id === serverId
          ? { ...server, apiKey: value }
          : server
      ),
    }));
  };

  const renderStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return <Check className="size-4 text-green-500" />;
      case 'testing':
        return <Loader2 className="size-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <X className="size-4 text-red-500" />;
      default:
        return null;
    }
  };

  const renderServerIcon = (serverName: string) => {
    const iconClass = "size-5 text-foreground";
    
    switch (serverName) {
      // Built-in servers with generic icons
      case 'self-management':
        return <Sliders className={iconClass} />;
      case 'mindbase':
        return <Database className="size-5 text-purple-400" />;
      case 'time':
        return <Clock className={iconClass} />;
      case 'fetch':
        return <Globe className={iconClass} />;
      case 'git':
        return <GitBranch className={iconClass} />;
      case 'memory':
        return <Brain className={iconClass} />;
      case 'context7':
        return <FileText className={iconClass} />;
      case 'serena':
        return <Code className={iconClass} />;
      case 'filesystem':
        return <FolderTree className={iconClass} />;
      case 'sequential-thinking':
        return <Lightbulb className={iconClass} />;
      
      // External services with official logos (SVG)
      case 'github':
        return <Github className="size-5 text-foreground" />;
      
      case 'supabase':
      case 'supabase-selfhosted':
        // Supabase logo SVG
        return (
          <svg className={iconClass} viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)" />
            <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2" />
            <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E" />
            <defs>
              <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
                <stop stopColor="#249361" />
                <stop offset="1" stopColor="#3ECF8E" />
              </linearGradient>
              <linearGradient id="paint1_linear" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
                <stop />
                <stop offset="1" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        );
      
      case 'playwright':
        // Playwright logo
        return (
          <svg className={iconClass} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="256" cy="256" r="256" fill="#2D2D2D"/>
            <path d="M395.636 141.818L256 32L116.364 141.818L256 251.636L395.636 141.818Z" fill="#45BA4B"/>
            <path d="M116.364 141.818V370.182L256 480L395.636 370.182V141.818L256 251.636L116.364 141.818Z" fill="#E8462E"/>
          </svg>
        );
      
      case 'puppeteer':
        // Puppeteer logo
        return (
          <svg className={iconClass} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M128 0L256 128L128 256L0 128L128 0Z" fill="#00D8A2"/>
            <circle cx="128" cy="100" r="20" fill="white"/>
            <circle cx="128" cy="156" r="20" fill="white"/>
          </svg>
        );
      
      case 'chrome-devtools':
      case 'chrome':
        return <Chrome className={iconClass} />;
      
      case 'sqlite':
        // SQLite logo
        return (
          <svg className={iconClass} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M150.5 5.4C131.5 8.9 119.7 17.8 108.9 37.2L102.7 48.5L99.4 48.2C88.4 47.3 78.1 50.8 70.2 58.1C64.8 62.9 60.8 69.3 58.7 76.5L57.4 81.1L52.3 85.3C43.1 92.8 37.1 102.8 35.1 114.4C34.1 120.1 34.1 135.9 35.1 141.6C37.1 153.2 43.1 163.2 52.3 170.7L57.4 174.9L58.7 179.5C60.8 186.7 64.8 193.1 70.2 197.9C78.1 205.2 88.4 208.7 99.4 207.8L102.7 207.5L108.9 218.8C119.7 238.2 131.5 247.1 150.5 250.6C156.2 251.6 172 251.6 177.7 250.6C196.7 247.1 208.5 238.2 219.3 218.8L225.5 207.5L228.8 207.8C239.8 208.7 250.1 205.2 258 197.9C263.4 193.1 267.4 186.7 269.5 179.5L270.8 174.9L275.9 170.7C285.1 163.2 291.1 153.2 293.1 141.6C294.1 135.9 294.1 120.1 293.1 114.4C291.1 102.8 285.1 92.8 275.9 85.3L270.8 81.1L269.5 76.5C267.4 69.3 263.4 62.9 258 58.1C250.1 50.8 239.8 47.3 228.8 48.2L225.5 48.5L219.3 37.2C208.5 17.8 196.7 8.9 177.7 5.4C172.8 4.5 155.4 4.5 150.5 5.4Z" fill="#003B57"/>
          </svg>
        );
      
      case 'tavily':
        return <Search className={iconClass} />;
      
      case 'magic':
        return <Zap className={`${iconClass} text-purple-500`} />;
      
      case 'morphllm-fast-apply':
        return <Zap className={`${iconClass} text-blue-500`} />;
      
      default:
        return <Network className={iconClass} />;
    }
  };

  const renderServerRow = (server: MCPServer, section: ServerSection) => (
    <div key={server.id} className="flex items-center gap-4 py-3 px-4 hover:bg-muted/50 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 min-w-[220px]">
        {renderServerIcon(server.name)}
        <span className="font-mono text-foreground">{server.name}</span>
      </div>
      
      <div className="flex-1 text-sm text-muted-foreground min-w-[200px]">
        {server.description}
      </div>

      <div className="flex items-center gap-2 min-w-[140px]">
        <span className="text-muted-foreground text-sm">{server.toolCount} tools</span>
        <span className="text-muted-foreground text-sm">·</span>
        <span className="text-muted-foreground text-sm">~{(server.tokenEstimate || 0).toLocaleString()}</span>
      </div>

      {server.requiresApiKey && section === 'unconfigured' && (
        <>
          <Input
            type="password"
            placeholder="Enter API Key"
            value={server.apiKey || ''}
            onChange={(e) => handleApiKeyChange(section, server.id, e.target.value)}
            className="max-w-[280px]"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTestConnection(section, server.id)}
            disabled={!server.apiKey || server.status === 'testing'}
          >
            {server.status === 'testing' ? (
              <>
                <Loader2 className="size-3 mr-1 animate-spin" />
                Testing
              </>
            ) : (
              'Test'
            )}
          </Button>
        </>
      )}

      {section === 'unconfigured' && !server.requiresApiKey && (
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
        >
          Enable
        </Button>
      )}

      {(section === 'always-active' || section === 'ready') && (
        <div className="ml-auto flex items-center gap-2">
          {renderStatusIcon(server.status)}
        </div>
      )}
    </div>
  );

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="size-6 text-foreground" />
          <h1 className="text-foreground">MCP Gateway Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your MCP server connections and API keys
        </p>
      </div>

      <div className="mb-6 flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <Zap className="size-5 text-blue-500" />
        <div className="text-foreground">
          <div className="flex items-center gap-2">
            <span>Profile: <span className="font-mono">Dynamic Mode</span></span>
            <Badge variant="secondary">Recommended</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            AI automatically manages which servers are active. You only need to register API keys.
          </p>
        </div>
      </div>

      {/* Built-in Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-2 rounded-full bg-green-500" />
          <h2 className="text-lg text-foreground">Built-in</h2>
          <Badge variant="outline" className="ml-2">10</Badge>
          <span className="text-sm text-muted-foreground ml-auto">
            Core servers - always enabled
          </span>
        </div>
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {servers['always-active'].map(server => renderServerRow(server, 'always-active'))}
        </div>
      </div>

      {/* Ready Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-2 rounded-full bg-yellow-500" />
          <h2 className="text-lg text-foreground">Ready</h2>
          <Badge variant="outline" className="ml-2">{servers.ready.length}</Badge>
          <span className="text-sm text-muted-foreground ml-auto">
            Configured and ready to use anytime
          </span>
        </div>
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {servers.ready.map(server => renderServerRow(server, 'ready'))}
        </div>
      </div>

      {/* Unconfigured Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-2 rounded-full bg-gray-400" />
          <h2 className="text-lg text-foreground">Unconfigured</h2>
          <Badge variant="outline" className="ml-2">{servers.unconfigured.length}</Badge>
          <span className="text-sm text-muted-foreground ml-auto">
            Available when needed - configure to enable
          </span>
        </div>
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {servers.unconfigured.map(server => renderServerRow(server, 'unconfigured'))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>💡 Tip: LLM can dynamically enable servers from the Ready pool via self-management when needed.</p>
      </div>
    </div>
  );
}