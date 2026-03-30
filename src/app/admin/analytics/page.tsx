'use client';

import { useEffect, useState } from 'react';
import { useAdminToken } from '@/app/admin/AdminTokenContext';

interface UserAnalytics {
  phone: string;
  total_msgs: number;
  user_msgs: number;
  last_active: number;
  memories_count: number;
  docs_count: number;
}

export default function AnalyticsPage() {
  const token = useAdminToken();
  const [analytics, setAnalytics] = useState<UserAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setAnalytics(d.analytics ?? []))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = analytics.filter(u =>
    !search || u.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics de Uso</h1>
        <p className="text-muted-foreground text-sm mt-1">Atividade por usuário</p>
      </div>

      <input
        className="w-full max-w-sm border rounded-lg px-3 py-2 text-sm bg-background"
        placeholder="Filtrar por telefone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Telefone</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Msgs Enviadas</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Trocas</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Memórias</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Docs</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Último Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum dado encontrado</td>
                </tr>
              ) : filtered.map(u => (
                <tr key={u.phone} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{u.phone}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.user_msgs}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{u.total_msgs}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.memories_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.docs_count}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {u.last_active
                      ? new Date(u.last_active).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
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
