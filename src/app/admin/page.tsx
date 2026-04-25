'use client';
import { useEffect, useState } from 'react';
import { useAdminToken } from './AdminTokenContext';

type Stats = {
  whitelist: { total: number; active: number; inactive: number };
  memories: number;
  documents: number;
  pendingReminders: number;
};

function StatCard({ title, value, sub, color }: { title: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="text-sm text-muted-foreground mb-1">{title}</div>
      <div className={`text-4xl font-bold ${color ?? 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const token = useAdminToken();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setStats)
      .catch(() => setError('Erro ao carregar stats'));
  }, [token]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do Jarvis</p>
      </div>
      {error && <div className="text-red-500">{error}</div>}
      {!stats ? (
        <div className="text-muted-foreground animate-pulse">Carregando...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Usuários na whitelist" value={stats.whitelist.total} sub={`${stats.whitelist.active} ativos · ${stats.whitelist.inactive} inativos`} color="text-primary" />
          <StatCard title="Memórias salvas" value={stats.memories} color="text-purple-500" />
          <StatCard title="Documentos" value={stats.documents} color="text-blue-500" />
          <StatCard title="Lembretes pendentes" value={stats.pendingReminders} color="text-amber-500" />
        </div>
      )}
    </div>
  );
}
