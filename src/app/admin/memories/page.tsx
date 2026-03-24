'use client';
import { useEffect, useState } from 'react';
import { useAdminToken } from '../AdminTokenContext';
import { Search, BrainCircuit, FileText, Trash2, Database } from 'lucide-react';

type Memory = { id: string; phone: string; content: string; source: string; created_at: number };

export default function MemoriesPage() {
  const token = useAdminToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/memories', { headers }).then(r => r.json()).then(d => { setMemories(Array.isArray(d) ? d : []); setLoading(false); });
  };
  useEffect(() => { load(); }, [token]);

  const remove = async (id: string) => {
    if (!confirm('Deletar esta memória? Você não poderá recuperar a informação.')) return;
    await fetch(`/api/admin/memories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  const filtered = memories.filter(m => !search || m.content.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search));
  const fmt = (ms: number) => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-foreground">Memórias</h1>
          <p className="text-muted-foreground">Pequenos textos e aprendizados ensinados à Inteligência Artificial</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative max-w-lg">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm" 
            placeholder="Buscar por telefone ou conteúdo..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Telefone</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Conteúdo Gravado</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-center">Fonte</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-center">Data</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse bg-card">
                      <td className="px-6 py-5"><div className="h-4 bg-muted rounded w-24"></div></td>
                      <td className="px-6 py-5"><div className="h-4 bg-muted rounded w-3/4"></div></td>
                      <td className="px-6 py-5 text-center"><div className="h-6 bg-muted rounded-full w-16 mx-auto"></div></td>
                      <td className="px-6 py-5 text-center"><div className="h-4 bg-muted rounded w-24 mx-auto"></div></td>
                      <td className="px-6 py-5"><div className="h-8 bg-muted rounded-lg w-10 ml-auto"></div></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                       <div className="flex flex-col items-center gap-3">
                        <BrainCircuit size={32} className="opacity-20" />
                        <p>{search ? 'Nenhuma memória encontrada na busca.' : 'Ainda não existem memórias curtas cadastradas no banco.'}</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(m => (
                  <tr key={m.id} className="bg-card hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{m.phone}</td>
                    <td className="px-6 py-4 w-1/2">
                      <div className="text-sm font-medium leading-relaxed">{m.content}</div>
                    </td>
                    <td className="px-6 py-4 text-center items-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${m.source === 'pdf' ? 'bg-blue-500/10 text-blue-600 border-blue-200' : 'bg-purple-500/10 text-purple-600 border-purple-200'}`}>
                        {m.source === 'pdf' ? <FileText size={12} /> : <Database size={12} />}
                        {m.source === 'pdf' ? 'PDF' : 'Chat'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-xs text-muted-foreground whitespace-nowrap">{fmt(m.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => remove(m.id)} 
                        className="w-8 h-8 rounded-lg inline-flex items-center justify-center opacity-50 group-hover:opacity-100 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
                        title="Deletar Memória"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
