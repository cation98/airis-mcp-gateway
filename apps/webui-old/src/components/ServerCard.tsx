import { Server } from '../App';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { MCPLogo } from './MCPLogo';
import { Star, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { useState } from 'react';

type ServerCardProps = {
  server: Server;
  onToggle: (serverId: string) => void;
  dynamicMode: boolean;
};

export function ServerCard({ server, onToggle, dynamicMode }: ServerCardProps) {
  const [testingApiKey, setTestingApiKey] = useState(false);
  const isActive = server.status === 'active';

  const handleTestApiKey = async () => {
    setTestingApiKey(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setTestingApiKey(false);
  };

  return (
    <div className={`border rounded-lg p-4 transition-all hover:border-[#3a3a3a] ${
      isActive 
        ? 'bg-[#1a1a1a] border-[#2a2a2a]' 
        : 'bg-[#141414] border-[#222]'
    }`}>
      {/* Header with MCP Logo and Verified Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <MCPLogo className="w-10 h-10 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[#e8e8e8] text-sm truncate">{server.name}</h3>
              {server.verified && (
                <CheckCircle2 className="w-4 h-4 text-[#0a84ff] flex-shrink-0" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-[#888] text-sm mb-3 line-clamp-2 min-h-[40px]">
        {server.description}
      </p>

      {/* Stars */}
      <div className="flex items-center gap-1 text-[#888] text-sm mb-3">
        <Star className="w-4 h-4" />
        <span>{server.stars >= 1000 ? `${(server.stars / 1000).toFixed(1)}K` : server.stars}</span>
      </div>

      {/* Badges and Status */}
      <div className="space-y-2">
        {/* Status Badges */}
        <div className="flex flex-wrap gap-1.5">
          {isActive && (
            <Badge className="bg-[#30d158]/10 text-[#30d158] border-[#30d158]/20 text-xs">
              Active
            </Badge>
          )}
          {server.alwaysEnabled && dynamicMode && (
            <Badge className="bg-[#5ac8fa]/10 text-[#5ac8fa] border-[#5ac8fa]/20 text-xs">
              Always on
            </Badge>
          )}
          {server.recommended && (
            <Badge variant="secondary" className="bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/20 text-xs">
              Recommended
            </Badge>
          )}
          {server.apiKeyRequired && !server.apiKeyConfigured && (
            <Badge variant="secondary" className="bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/20 text-xs">
              API key needed
            </Badge>
          )}
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a]">
          <span className="text-[#888] text-sm">
            {isActive ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={isActive}
            onCheckedChange={() => onToggle(server.id)}
            className="data-[state=checked]:bg-[#5ac8fa]"
          />
        </div>

        {/* API Key Actions */}
        {server.apiKeyRequired && (
          <div className="pt-2 border-t border-[#2a2a2a]">
            {server.apiKeyConfigured ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#30d158] text-xs">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Configured</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-[#2a2a2a] border-[#333] text-[#888] hover:bg-[#333] hover:text-[#e8e8e8] h-7 text-xs"
                  onClick={handleTestApiKey}
                  disabled={testingApiKey}
                >
                  {testingApiKey ? 'Testing...' : 'Test'}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="w-full bg-[#5ac8fa] hover:bg-[#5ac8fa]/90 text-white h-7 text-xs"
              >
                Set API Key
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
