import { Server, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

type StatsOverviewProps = {
  totalServers: number;
  activeCount: number;
  disabledCount: number;
  apiKeyMissingCount: number;
};

export function StatsOverview({
  totalServers,
  activeCount,
  disabledCount,
  apiKeyMissingCount,
}: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center">
            <Server className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total servers</p>
            <p className="text-slate-100 text-2xl">{totalServers}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Active</p>
            <p className="text-emerald-400 text-2xl">{activeCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center">
            <Activity className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Inactive</p>
            <p className="text-slate-100 text-2xl">{disabledCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">API key missing</p>
            <p className="text-amber-400 text-2xl">{apiKeyMissingCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
