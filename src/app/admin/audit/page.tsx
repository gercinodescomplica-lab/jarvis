'use client';

import { useEffect, useState } from 'react';
import { useAdminToken } from '@/app/admin/AdminTokenContext';

interface AuditLog {
  id: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
  created_at: number;
}

const ACTION_BADGE: Record<string, string> = {
  edit_memory: 'bg-blue-500/15 text-blue-600',
  delete_memory: 'bg-red-500/15 text-red-600',
  delete_document: 'bg-red-500/15 text-red-600',
  update_whitelist: 'bg-amber-500/15 text-amber-600',
  delete_whitelist: 'bg-red-500/15 text-red-600',
};

export default function AuditPage() {
  const token = useAdminToken();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/audit', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setLogs(d.logs ?? []))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">Histórico de ações administrativas</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ação</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Alvo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma ação registrada ainda</td>
                </tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_BADGE[log.action] ?? 'bg-muted text-muted-foreground'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[180px]">{log.target}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[240px]">
                    {Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
