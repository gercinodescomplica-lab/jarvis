'use client';
import { useEffect, useState } from 'react';
import { useAdminToken } from '../AdminTokenContext';

type TriggerRun = {
  id: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  delayedUntil?: string;
  payload?: {
    reminder?: string;
    senderPhone?: string;
    jid?: string;
    isGroup?: boolean;
  };
};

const STATUS_STYLE: Record<string, string> = {
  DELAYED:        'bg-amber-900/30 text-amber-400',
  WAITING:        'bg-amber-900/30 text-amber-400',
  QUEUED:         'bg-blue-900/30 text-blue-400',
  EXECUTING:      'bg-blue-900/30 text-blue-400',
  COMPLETED:      'bg-green-900/30 text-green-400',
  CANCELED:       'bg-muted text-muted-foreground',
  FAILED:         'bg-red-900/30 text-red-400',
  CRASHED:        'bg-red-900/30 text-red-400',
  SYSTEM_FAILURE: 'bg-red-900/30 text-red-400',
};

const STATUS_LABEL: Record<string, string> = {
  DELAYED:        '⏳ Aguardando',
  WAITING:        '⏳ Aguardando',
  QUEUED:         '🔵 Na fila',
  EXECUTING:      '▶ Executando',
  COMPLETED:      '✅ Enviado',
  CANCELED:       '⛔ Cancelado',
  FAILED:         '❌ Falhou',
  CRASHED:        '💥 Crash',
  SYSTEM_FAILURE: '💥 Falha',
};

function isPending(r: TriggerRun) {
  return ['DELAYED', 'WAITING', 'QUEUED', 'EXECUTING'].includes(r.status);
}

export default function RemindersPage() {
  const token = useAdminToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [runs, setRuns] = useState<TriggerRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'pending' | 'done'>('pending');

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/api/admin/reminders', { headers })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setRuns(d);
        else setError(d.error ?? 'Erro ao carregar');
        setLoading(false);
      })
      .catch(() => { setError('Falha na requisição'); setLoading(false); });
  };
  useEffect(load, [token]);

  const cancel = async (id: string) => {
    if (!confirm('Cancelar este lembrete?')) return;
    await fetch(`/api/admin/reminders/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  const fmt = (s?: string) => s
    ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  const filtered = runs.filter(r => tab === 'pending' ? isPending(r) : !isPending(r));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">Lembretes</h1>
          <p className="text-muted-foreground text-sm">Runs do Trigger.dev — task <code className="bg-muted px-1 rounded">send-reminder</code></p>
        </div>
        <button onClick={load} className="bg-muted hover:bg-muted/70 px-4 py-2 rounded-lg text-sm font-medium transition-colors">🔄 Atualizar</button>
      </div>

      <div className="flex gap-2">
        {(['pending', 'done'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {t === 'pending'
              ? `⏳ Pendentes (${runs.filter(isPending).length})`
              : `✅ Finalizados (${runs.filter(r => !isPending(r)).length})`}
          </button>
        ))}
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="bg-card/50 border border-border rounded-xl overflow-hidden shadow">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Lembrete</th>
              <th className="px-5 py-4">Para</th>
              <th className="px-5 py-4">Dispara em</th>
              <th className="px-5 py-4">Criado em</th>
              <th className="px-5 py-4 text-center">Status</th>
              <th className="px-5 py-4 text-center">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground animate-pulse">Carregando runs do Trigger.dev...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">Nenhum lembrete aqui.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="bg-card hover:bg-muted/40 transition-colors">
                <td className="px-5 py-3 max-w-xs font-medium">{r.payload?.reminder ?? '—'}</td>
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                  {r.payload?.senderPhone ?? r.payload?.jid ?? '—'}
                  {r.payload?.isGroup && <span className="ml-1 text-blue-400">(grupo)</span>}
                </td>
                <td className="px-5 py-3 text-sm">{fmt(r.delayedUntil)}</td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{fmt(r.createdAt)}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  {isPending(r)
                    ? <button onClick={() => cancel(r.id)} className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors">Cancelar</button>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
