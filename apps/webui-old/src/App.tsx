import { useState } from 'react';
import { ServerCard } from './components/ServerCard';
import { DynamicModeDialog } from './components/DynamicModeDialog';
import { Settings, Download, Info, Zap, Search } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Switch } from './components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';

export type Server = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'disabled';
  setupNeeded: boolean;
  recommended: boolean;
  apiKeyRequired: boolean;
  apiKeyConfigured?: boolean;
  alwaysEnabled?: boolean;
  stars: number;
  icon: string;
  verified?: boolean;
  npm?: string;
  command?: string;
};

const mockServers: Server[] = [
  // Always enabled in Dynamic mode
  {
    id: 'self-management',
    name: 'self-management',
    description: 'LLM dynamically enables/disables other servers based on context',
    status: 'active',
    setupNeeded: false,
    recommended: true,
    apiKeyRequired: false,
    alwaysEnabled: true,
    stars: 1243,
    icon: '🎯',
    verified: true,
    npm: '@self-management/mcp',
  },
  {
    id: 'serena',
    name: 'serena',
    description: 'Code understanding and semantic search capabilities',
    status: 'active',
    setupNeeded: false,
    recommended: true,
    apiKeyRequired: false,
    alwaysEnabled: true,
    stars: 2156,
    icon: '🔍',
    verified: true,
    command: 'uvx mcp-server-serena',
  },
  {
    id: 'context7',
    name: 'context7',
    description: 'Latest documentation for 15,000+ libraries',
    status: 'active',
    setupNeeded: false,
    recommended: true,
    apiKeyRequired: false,
    alwaysEnabled: true,
    stars: 3421,
    icon: '📚',
    verified: true,
    npm: '@context7/server',
  },
  {
    id: 'filesystem',
    name: 'filesystem',
    description: 'Workspace file access (required)',
    status: 'active',
    setupNeeded: false,
    recommended: true,
    apiKeyRequired: false,
    alwaysEnabled: true,
    stars: 5234,
    icon: '📁',
    verified: true,
    npm: '@modelcontextprotocol/server-filesystem',
  },

  // Other servers
  {
    id: 'sequential-thinking',
    name: 'sequential-thinking',
    description: 'Token-efficient reasoning',
    status: 'disabled',
    setupNeeded: false,
    recommended: true,
    apiKeyRequired: false,
    stars: 1876,
    icon: '🧠',
    verified: true,
    npm: '@modelcontextprotocol/server-sequential-thinking',
  },
  {
    id: 'playwright',
    name: 'playwright',
    description: 'JavaScript-heavy content extraction',
    status: 'disabled',
    setupNeeded: false,
    recommended: true,
    apiKeyRequired: false,
    stars: 2543,
    icon: '🎭',
    verified: true,
    npm: '@playwright/mcp/server',
  },
  {
    id: 'puppeteer',
    name: 'puppeteer',
    description: 'Headless browser automation (E2E testing only)',
    status: 'disabled',
    setupNeeded: false,
    recommended: false,
    apiKeyRequired: false,
    stars: 1234,
    icon: '🤖',
    verified: true,
    npm: '@modelcontextprotocol/server-puppeteer',
  },
  {
    id: 'mindbase',
    name: 'mindbase',
    description: 'Knowledge base and notes management',
    status: 'active',
    setupNeeded: false,
    recommended: true,
    apiKeyRequired: false,
    alwaysEnabled: true,
    stars: 876,
    icon: '🧩',
    verified: true,
    npm: '@mindbase/mcp-server',
  },
  {
    id: 'chrome-devtools',
    name: 'chrome-devtools',
    description: 'Browser debugging and inspection',
    status: 'disabled',
    setupNeeded: false,
    recommended: false,
    apiKeyRequired: false,
    stars: 1543,
    icon: '🔧',
    verified: true,
    npm: '@chrome/devtools-mcp',
  },
  {
    id: 'time',
    name: 'time',
    description: 'Time and scheduling utilities',
    status: 'disabled',
    setupNeeded: false,
    recommended: false,
    apiKeyRequired: false,
    stars: 654,
    icon: '⏰',
    verified: true,
    npm: '@mcp/time-server',
  },
  {
    id: 'fetch',
    name: 'fetch',
    description: 'HTTP requests and API calls',
    status: 'disabled',
    setupNeeded: false,
    recommended: false,
    apiKeyRequired: false,
    stars: 2134,
    icon: '🌐',
    verified: true,
    npm: '@modelcontextprotocol/server-fetch',
  },
  {
    id: 'git',
    name: 'git',
    description: 'Git repository operations',
    status: 'disabled',
    setupNeeded: false,
    recommended: false,
    apiKeyRequired: false,
    stars: 3214,
    icon: '🔀',
    verified: true,
    npm: '@modelcontextprotocol/server-git',
  },
  {
    id: 'memory',
    name: 'memory',
    description: 'Persistent memory and context',
    status: 'disabled',
    setupNeeded: false,
    recommended: false,
    apiKeyRequired: false,
    stars: 1987,
    icon: '💾',
    verified: true,
    npm: '@modelcontextprotocol/server-memory',
  },

  // API key required servers
  {
    id: 'magic',
    name: 'magic',
    description: 'UI component generation',
    status: 'disabled',
    setupNeeded: true,
    recommended: true,
    apiKeyRequired: true,
    apiKeyConfigured: true,
    stars: 2876,
    icon: '✨',
    verified: true,
    npm: '@magic/mcp-server',
  },
  {
    id: 'morph-llm',
    name: 'morph-llm',
    description: 'Pattern-based refactoring and bulk code updates',
    status: 'disabled',
    setupNeeded: true,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 1432,
    icon: '⚡',
    verified: true,
    npm: '@morph-llm/mcp-fast-apply',
  },
  {
    id: 'sqlite',
    name: 'sqlite',
    description: 'SQLite database operations (unwise only for DB work)',
    status: 'disabled',
    setupNeeded: false,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 3456,
    icon: '🗄️',
    verified: true,
    npm: 'mcp-server-sqlite',
  },
  {
    id: 'postgresql',
    name: 'postgres',
    description: 'PostgreSQL database access',
    status: 'disabled',
    setupNeeded: true,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 4123,
    icon: '🐘',
    verified: true,
    npm: 'mcp-postgres-server',
  },
  {
    id: 'tavily',
    name: 'tavily',
    description: 'Privacy web search for deep research',
    status: 'disabled',
    setupNeeded: true,
    recommended: true,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 2345,
    icon: '🔎',
    verified: true,
    npm: '@tavily/mcp-server',
  },
  {
    id: 'figma',
    name: 'figma',
    description: 'Figma design file access and manipulation',
    status: 'disabled',
    setupNeeded: true,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 1876,
    icon: '🎨',
    verified: true,
    npm: '@figma/mcp-server',
  },
  {
    id: 'stripe',
    name: 'stripe',
    description: 'Payment processing and billing',
    status: 'disabled',
    setupNeeded: true,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 3214,
    icon: '💳',
    verified: true,
    npm: '@stripe/mcp-server',
  },
  {
    id: 'github',
    name: 'github',
    description: 'GitHub repository and issue management',
    status: 'disabled',
    setupNeeded: true,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 5432,
    icon: '🐙',
    verified: true,
    npm: '@github/mcp-server',
  },
  {
    id: 'docker',
    name: 'docker',
    description: 'Docker container management',
    status: 'disabled',
    setupNeeded: true,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 4567,
    icon: '🐳',
    verified: true,
    npm: '@docker/mcp-server',
  },
  {
    id: 'dockerhub',
    name: 'dockerhub',
    description: 'Docker Hub image registry access',
    status: 'disabled',
    setupNeeded: true,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 2134,
    icon: '🐋',
    verified: true,
    npm: '@dockerhub/mcp-server',
  },
  {
    id: 'supabase-selfhost',
    name: 'supabase',
    description: 'Self-hosted Supabase instance management',
    status: 'disabled',
    setupNeeded: true,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 1654,
    icon: '⚡',
    verified: true,
    npm: '@supabase/mcp-server-selfhost',
  },
  {
    id: 'twilio',
    name: 'twilio',
    description: 'SMS and voice communication',
    status: 'disabled',
    setupNeeded: true,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 2876,
    icon: '📞',
    verified: true,
    npm: '@twilio/mcp-server',
  },
  {
    id: 'cloudflare',
    name: 'cloudflare',
    description: 'Cloudflare Workers and CDN management',
    status: 'disabled',
    setupNeeded: true,
    recommended: false,
    apiKeyRequired: true,
    apiKeyConfigured: false,
    stars: 3456,
    icon: '☁️',
    verified: true,
    npm: '@cloudflare/mcp-server',
  },
];

export default function App() {
  const [servers, setServers] = useState<Server[]>(mockServers);
  const [dynamicMode, setDynamicMode] = useState(true);
  const [showDynamicDialog, setShowDynamicDialog] = useState(false);
  const [pendingServerId, setPendingServerId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'disabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredServers = servers.filter(server => {
    const matchesFilter = filterTab === 'all' || server.status === filterTab;
    const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         server.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const activeServers = servers.filter(s => s.status === 'active');
  const disabledServers = servers.filter(s => s.status === 'disabled');
  const apiKeyMissingCount = servers.filter(s => s.apiKeyRequired && !s.apiKeyConfigured).length;

  const handleToggleServer = (serverId: string, forceToggle: boolean = false) => {
    const server = servers.find(s => s.id === serverId);

    // Simply toggle without showing dialog
    setServers(servers.map(s =>
      s.id === serverId
        ? { ...s, status: s.status === 'active' ? 'disabled' : 'active' } as Server
        : s
    ));
  };

  const handleDynamicDialogConfirm = () => {
    setDynamicMode(false);
    if (pendingServerId) {
      handleToggleServer(pendingServerId, true);
    }
    setShowDynamicDialog(false);
    setPendingServerId(null);
  };

  const handleDynamicDialogCancel = () => {
    setShowDynamicDialog(false);
    setPendingServerId(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] bg-[#141414]">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[#e8e8e8] mb-1">MCP Servers</h1>
              <p className="text-[#888] text-sm">
                Browse and manage Model Context Protocol servers
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" className="bg-[#ff9500] hover:bg-[#ff9500]/90 text-white h-9">
                Tips
              </Button>
              <Button size="sm" variant="outline" className="bg-[#1a1a1a] border-[#2a2a2a] text-[#e8e8e8] hover:bg-[#222] h-9">
                <Download className="w-4 h-4 mr-2" />
                Generate config
              </Button>
            </div>
          </div>

          {/* Dynamic Mode Section */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-[#5ac8fa]" />
                  <h3 className="text-[#e8e8e8]">Dynamic Mode</h3>
                  <Switch
                    checked={dynamicMode}
                    onCheckedChange={setDynamicMode}
                    className="data-[state=checked]:bg-[#5ac8fa]"
                  />
                </div>
                <p className="text-[#888] text-sm mb-3">
                  Let the LLM automatically enable/disable MCP servers based on context. Reduces token usage and improves performance.
                </p>
                <div className="flex items-start gap-2 text-[#888] text-sm">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#5ac8fa]" />
                  <div>
                    <span className="text-[#e8e8e8]">Always enabled:</span> self-management, serena, context7, filesystem, mindbase ·
                    <span className="text-[#888]"> Other servers dynamically enabled via </span>
                    <code className="text-[#5ac8fa] bg-[#0a0a0a] px-1.5 py-0.5 rounded text-xs">enable_mcp_server()</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[#888] text-sm mb-1">Total servers</div>
              <div className="text-[#e8e8e8] text-2xl">{servers.length}</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[#888] text-sm mb-1">Active</div>
              <div className="text-[#30d158] text-2xl">{activeServers.length}</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[#888] text-sm mb-1">Inactive</div>
              <div className="text-[#e8e8e8] text-2xl">{disabledServers.length}</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[#888] text-sm mb-1">API key missing</div>
              <div className="text-[#ff9f0a] text-2xl">{apiKeyMissingCount}</div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366]" />
              <Input
                placeholder="Search servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#1a1a1a] border-[#2a2a2a] text-[#e8e8e8] placeholder:text-[#636366]"
              />
            </div>
            <Tabs value={filterTab} onValueChange={(v: any) => setFilterTab(v)}>
              <TabsList className="bg-[#1a1a1a] border border-[#2a2a2a]">
                <TabsTrigger value="all" className="data-[state=active]:bg-[#2a2a2a] data-[state=active]:text-[#e8e8e8]">
                  All ({servers.length})
                </TabsTrigger>
                <TabsTrigger value="active" className="data-[state=active]:bg-[#2a2a2a] data-[state=active]:text-[#e8e8e8]">
                  Active ({activeServers.length})
                </TabsTrigger>
                <TabsTrigger value="disabled" className="data-[state=active]:bg-[#2a2a2a] data-[state=active]:text-[#e8e8e8]">
                  Disabled ({disabledServers.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Main Content - Grid Layout */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredServers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onToggle={handleToggleServer}
              dynamicMode={dynamicMode}
            />
          ))}
        </div>

        {filteredServers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#888]">No servers found</p>
          </div>
        )}
      </div>

      {/* Dynamic Mode Dialog */}
      <DynamicModeDialog
        open={showDynamicDialog}
        onConfirm={handleDynamicDialogConfirm}
        onCancel={handleDynamicDialogCancel}
      />
    </div>
  );
}
