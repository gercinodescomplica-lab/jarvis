'use client';
import React, { useEffect, useState } from 'react';
import { useAdminToken } from '../AdminTokenContext';
import { Search, FileText, Trash2, Library, Eye, EyeOff } from 'lucide-react';

type Doc = { id: string; uploader_phone: string; filename: string; description: string | null; total_chunks: number; created_at: number };
type Chunk = { id: string; chunk_index: number; content: string };

export default function DocumentsPage() {
  const token = useAdminToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/documents', { headers }).then(r => r.json()).then(d => { setDocs(Array.isArray(d) ? d : []); setLoading(false); });
  };
  useEffect(load, [token]);

  const expand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const res = await fetch(`/api/admin/documents/${id}`, { headers });
    const { chunks: c } = await res.json();
    setChunks(c ?? []);
  };

  const remove = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este documento e TODOS os seus chunks vinculados?')) return;
    await fetch(`/api/admin/documents/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setExpanded(null); load();
  };

  const fmt = (ms: number) => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const filtered = docs.filter(d => !search || d.filename.toLowerCase().includes(search.toLowerCase()) || (d.description ?? '').toLowerCase().includes(search.toLowerCase()) || d.uploader_phone.includes(search));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-foreground">Documentos</h1>
          <p className="text-muted-foreground">PDFs, apostilas e arquivos extensos divididos em banco vetorial</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative max-w-lg">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm" 
            placeholder="Buscar por arquivo, descrição ou telefone..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider w-1/3">Arquivo e Título</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Enviado Por</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-center">Tamanho (Vetores)</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-center">Data</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse bg-card">
                      <td className="px-6 py-5"><div className="h-4 bg-muted rounded w-3/4"></div></td>
                      <td className="px-6 py-5"><div className="h-4 bg-muted rounded w-28"></div></td>
                      <td className="px-6 py-5 text-center"><div className="h-6 bg-muted rounded-full w-12 mx-auto"></div></td>
                      <td className="px-6 py-5 text-center"><div className="h-4 bg-muted rounded w-24 mx-auto"></div></td>
                      <td className="px-6 py-5"><div className="h-8 bg-muted rounded-lg w-20 ml-auto"></div></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <Library size={32} className="opacity-20" />
                        <p>{search ? 'Nenhum documento encontrado.' : 'Nenhum PDF foi enviado pelo WhatsApp ainda.'}</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(doc => (
                  <React.Fragment key={doc.id}>
                    <tr className="bg-card hover:bg-muted/20 transition-colors group">
                      <td className="px-6 py-4 flex flex-col items-start justify-center gap-1.5 min-w-[300px]">
                        <span className="font-semibold flex items-center gap-2">
                          <FileText size={16} className="text-primary/70" /> {doc.description || doc.filename}
                        </span>
                        {doc.description && doc.filename !== doc.description && (
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-md">{doc.filename}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{doc.uploader_phone}</td>
                      <td className="px-6 py-4 text-center items-center">
                        <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold text-white bg-blue-600 shadow-md shadow-blue-500/20">
                          {doc.total_chunks} Chunks
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-muted-foreground whitespace-nowrap">{fmt(doc.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => expand(doc.id)} 
                            className="w-auto px-4 h-9 rounded-xl inline-flex gap-2 items-center justify-center font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all text-xs"
                            title={expanded === doc.id ? "Fechar" : "Ver texto cortado"}
                          >
                            {expanded === doc.id ? <EyeOff size={14} /> : <Eye size={14} />}
                            {expanded === doc.id ? 'Ocultar Conteúdo' : 'Ver Conteúdo'}
                          </button>
                          <button 
                            onClick={() => remove(doc.id)} 
                            className="w-9 h-9 rounded-xl inline-flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
                            title="Deletar Documento"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {expanded === doc.id && (
                      <tr className="bg-muted/10 border-b border-border/50">
                        <td colSpan={5} className="p-0">
                          <div className="bg-card/50 px-8 py-6 inset-shadow-sm space-y-3 relative before:content-[''] before:absolute before:inset-y-6 before:-left-px before:w-1 before:bg-primary before:rounded-full">
                            <h4 className="text-sm font-bold text-primary mb-4">Fragmentos Vetoriais (Texto Extraído)</h4>
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                              {chunks.map(c => (
                                <div key={c.id} className="bg-background border border-border/60 hover:border-border rounded-xl p-4 text-xs text-muted-foreground shadow-sm transition-all group/chunk">
                                  <div className="flex gap-4">
                                    <span className="text-primary font-mono font-bold bg-primary/10 w-8 h-8 rounded shrink-0 flex items-center justify-center">#{c.chunk_index}</span>
                                    <span className="leading-relaxed group-hover/chunk:text-foreground transition-colors">{c.content}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
