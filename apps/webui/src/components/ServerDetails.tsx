import { Server } from '../App';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import {
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Key,
  Terminal,
  Package,
  Info,
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

type ServerDetailsProps = {
  server: Server | null;
  onToggleServer: (serverId: string) => void;
};

export function ServerDetails({ server, onToggleServer }: ServerDetailsProps) {
  if (!server) {
    return (
      <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-12 flex items-center justify-center h-[690px]">
        <div className="text-center">
          <Package className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-slate-400 mb-2">No server selected</h3>
          <p className="text-slate-500 text-sm">
            Select a server from the list to view details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-slate-100">{server.name}</h2>
              {server.status === 'active' ? (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-slate-700/30 text-slate-400">
                  Disabled
                </Badge>
              )}
            </div>
            <p className="text-slate-400">{server.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="server-toggle" className="text-slate-400 text-sm">
              {server.status === 'active' ? 'Enabled' : 'Disabled'}
            </Label>
            <Switch
              id="server-toggle"
              checked={server.status === 'active'}
              onCheckedChange={() => onToggleServer(server.id)}
            />
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          {server.recommended && (
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
              Recommended
            </Badge>
          )}
          {server.setupNeeded && (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
              Setup needed
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Alerts */}
        {server.apiKeyMissing && (
          <Alert className="bg-red-500/10 border-red-500/30">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300">
              API key is required but not configured. Please add your API key below to enable this server.
            </AlertDescription>
          </Alert>
        )}

        {server.apiKeyConfigured && !server.apiKeyMissing && (
          <Alert className="bg-emerald-500/10 border-emerald-500/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <AlertDescription className="text-emerald-300">
              API key is configured and ready to use.
            </AlertDescription>
          </Alert>
        )}

        {/* API Key Configuration */}
        {server.apiKeyRequired && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-400" />
              <Label className="text-slate-300">API Key Configuration</Label>
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter your API key..."
                defaultValue={server.apiKeyConfigured ? '••••••••••••••••' : ''}
                className="bg-slate-950/50 border-slate-700 text-slate-200 placeholder:text-slate-500"
              />
              <p className="text-slate-500 text-sm">
                Your API key will be stored securely and used for authentication.
              </p>
            </div>
          </div>
        )}

        <Separator className="bg-slate-800" />

        {/* Installation */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <Label className="text-slate-300">Installation</Label>
          </div>
          {server.npm && (
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">NPM Package</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={server.npm}
                  className="bg-slate-950/50 border-slate-700 text-slate-200 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-slate-950/50 border-slate-700 text-slate-400 hover:text-slate-200"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          {server.command && (
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">Command</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={server.command}
                  className="bg-slate-950/50 border-slate-700 text-slate-200 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-slate-950/50 border-slate-700 text-slate-400 hover:text-slate-200"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator className="bg-slate-800" />

        {/* Configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" />
            <Label className="text-slate-300">Advanced Configuration</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="config" className="text-slate-400 text-sm">
              Custom Configuration (JSON)
            </Label>
            <Textarea
              id="config"
              placeholder='{&#10;  "option": "value"&#10;}'
              rows={6}
              className="bg-slate-950/50 border-slate-700 text-slate-200 placeholder:text-slate-500 font-mono text-sm"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
            Save Changes
          </Button>
          <Button
            variant="outline"
            className="bg-slate-950/50 border-slate-700 text-slate-300"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Documentation
          </Button>
        </div>
      </div>
    </div>
  );
}
