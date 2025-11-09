import { Server } from '../App';
import { Badge } from './ui/badge';
import { CheckCircle2, AlertTriangle, Circle } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

type ServerListProps = {
  servers: Server[];
  selectedServer: Server | null;
  onSelectServer: (server: Server) => void;
};

export function ServerList({ servers, selectedServer, onSelectServer }: ServerListProps) {
  return (
    <ScrollArea className="h-[600px]">
      <div className="divide-y divide-slate-800">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => onSelectServer(server)}
            className={`w-full p-4 text-left transition-colors hover:bg-slate-800/30 ${
              selectedServer?.id === server.id ? 'bg-slate-800/50' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-slate-200 truncate">{server.name}</h3>
                  {server.status === 'active' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  )}
                </div>
                <p className="text-slate-400 text-sm line-clamp-2">
                  {server.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {server.recommended && (
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                      Recommended
                    </Badge>
                  )}
                  {server.setupNeeded && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                      Setup needed
                    </Badge>
                  )}
                  {server.apiKeyMissing && (
                    <Badge variant="secondary" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      API key missing
                    </Badge>
                  )}
                  {server.apiKeyConfigured && (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                      Configured
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
