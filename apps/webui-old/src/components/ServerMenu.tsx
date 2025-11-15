import { Server } from '../App';
import { ChevronRight, Circle, CheckCircle2, Settings2 } from 'lucide-react';
import { Switch } from './ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "./ui/dropdown-menu";
import { useState } from 'react';

type ServerMenuProps = {
  server: Server;
  onToggle: (serverId: string) => void;
  level?: number;
};

export function ServerMenu({ server, onToggle, level = 0 }: ServerMenuProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = server.children && server.children.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors group">
        <div className="flex items-center gap-3 flex-1">
          {hasChildren ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              />
            </button>
          ) : (
            <div className="w-4" />
          )}

          {server.status === 'active' ? (
            <Circle className="w-2 h-2 text-emerald-500 fill-emerald-500" />
          ) : (
            <Circle className="w-2 h-2 text-slate-600 fill-slate-600" />
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-200">{server.name}</span>
              {server.needsSetup && (
                <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                  Setup needed
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={server.status === 'active'}
            onCheckedChange={() => onToggle(server.id)}
            className="data-[state=checked]:bg-emerald-600"
          />

          <DropdownMenu>
            <DropdownMenuTrigger className="text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity outline-none">
              <ChevronRight className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 w-56">
              <DropdownMenuItem className="text-slate-300 focus:bg-slate-800 focus:text-slate-100">
                <Settings2 className="w-4 h-4 mr-2" />
                詳細設定
              </DropdownMenuItem>
              <DropdownMenuItem className="text-slate-300 focus:bg-slate-800 focus:text-slate-100">
                ログを表示
              </DropdownMenuItem>
              <DropdownMenuItem className="text-slate-300 focus:bg-slate-800 focus:text-slate-100">
                再起動
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem className="text-red-400 focus:bg-red-950 focus:text-red-300">
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="bg-slate-950/30">
          {server.children!.map((child) => (
            <div key={child.id} className="pl-8">
              <ServerMenu
                server={child}
                onToggle={onToggle}
                level={level + 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
