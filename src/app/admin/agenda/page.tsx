'use client';
import { useEffect, useState } from 'react';
import { useAdminToken } from '../AdminTokenContext';

export default function AgendaPage() {
  const token = useAdminToken();
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    fetch('/api/admin/agenda', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.report) setReport(d.report); else setError(d.error ?? 'Erro'); setLoading(false); })
      .catch(() => { setError('Falha ao carregar'); setLoading(false); });
  };
  useEffect(load, [token]);

  // Parse the WhatsApp-formatted report into structured lines
  const lines = report.split('\n');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">Agenda do Tiago</h1>
          <p className="text-muted-foreground">Próximos 7 dias — Microsoft Graph Calendar</p>
        </div>
        <button onClick={load} className="bg-muted hover:bg-muted/70 px-4 py-2 rounded-lg text-sm font-medium transition-colors">🔄 Atualizar</button>
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse">Carregando calendário...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : (
        <div className="bg-card/50 border border-border rounded-xl p-6 shadow space-y-1">
          {lines.map((line, i) => {
            const isHeader = line.startsWith('*🗓️') || line.startsWith('_Para');
            const isDay = line.startsWith('•');
            const isEmpty = line.trim() === '';
            if (isEmpty) return <div key={i} className="h-3" />;
            if (isHeader) return <div key={i} className="text-lg font-bold text-primary mb-2">{line.replace(/\*/g, '').replace(/_/g, '')}</div>;
            if (isDay) return <div key={i} className="text-sm font-semibold text-foreground mt-4">{line.replace(/\*/g, '')}</div>;
            return <div key={i} className="text-sm text-muted-foreground pl-4">{line}</div>;
          })}
        </div>
      )}
    </div>
  );
}
