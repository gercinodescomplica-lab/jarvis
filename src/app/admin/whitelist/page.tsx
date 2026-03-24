'use client';
import { useEffect, useState } from 'react';
import { useAdminToken } from '../AdminTokenContext';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Search, Shield, BrainCircuit, Users } from 'lucide-react';

type WLEntry = { phone: string; name: string; can_store_memory: boolean; active: boolean; created_at: number };

const emptyForm = { phone: '', name: '', can_store_memory: false, active: true };

export default function WhitelistPage() {
  const token = useAdminToken();
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [entries, setEntries] = useState<WLEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editPhone, setEditPhone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/whitelist', { headers }).then(r => r.json()).then(d => { setEntries(d); setLoading(false); });
  };
  useEffect(load, [token]);

  const openAdd = () => { setForm(emptyForm); setEditPhone(null); setShowForm(true); };
  const openEdit = (e: WLEntry) => { setForm({ phone: e.phone, name: e.name, can_store_memory: e.can_store_memory, active: e.active }); setEditPhone(e.phone); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    if (editPhone) {
      await fetch(`/api/admin/whitelist/${editPhone}`, { method: 'PATCH', headers, body: JSON.stringify({ name: form.name, can_store_memory: form.can_store_memory, active: form.active }) });
    } else {
      await fetch('/api/admin/whitelist', { method: 'POST', headers, body: JSON.stringify(form) });
    }
    setSaving(false); setShowForm(false); load();
  };

  const remove = async (phone: string) => {
    if (!confirm(`Remover ${phone}?`)) return;
    await fetch(`/api/admin/whitelist/${phone}`, { method: 'DELETE', headers });
    load();
  };

  const toggle = async (e: WLEntry, field: 'active' | 'can_store_memory') => {
    await fetch(`/api/admin/whitelist/${e.phone}`, { method: 'PATCH', headers, body: JSON.stringify({ [field]: !e[field] }) });
    load();
  };

  const filteredEntries = entries.filter(e => 
    e.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-foreground">Whitelist</h1>
          <p className="text-muted-foreground">Gerencie quem tem acesso ao Jarvis</p>
        </div>
        <button 
          onClick={openAdd} 
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20"
        >
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">{editPhone ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <p className="text-sm text-muted-foreground">Preencha os dados do acesso abaixo.</p>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefone</label>
                <input 
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50" 
                  value={form.phone} 
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} 
                  disabled={!!editPhone} 
                  placeholder="5511999999999" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <input 
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" 
                  value={form.name} 
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                  placeholder="Nome do usuário" 
                />
              </div>
              
              <div className="flex flex-col gap-3 mt-2 bg-muted/30 p-4 rounded-xl border border-border/50">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${form.active ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background group-hover:border-primary/50'}`}>
                    {form.active && <CheckCircle2 size={14} />}
                  </div>
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="hidden" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Acesso Ativo</span>
                    <span className="text-xs text-muted-foreground">Pode enviar mensagens ao bot</span>
                  </div>
                </label>
                
                <div className="h-px bg-border/50 w-full my-1"></div>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${form.can_store_memory ? 'bg-blue-600 border-blue-600 text-white' : 'border-input bg-background group-hover:border-blue-600/50'}`}>
                    {form.can_store_memory && <CheckCircle2 size={14} />}
                  </div>
                  <input type="checkbox" checked={form.can_store_memory} onChange={e => setForm(f => ({ ...f, can_store_memory: e.target.checked }))} className="hidden" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Salvar Memória & Docs</span>
                    <span className="text-xs text-muted-foreground">Permite salvar novos conhecimentos</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                onClick={() => setShowForm(false)} 
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={save} 
                disabled={saving || !form.phone || !form.name} 
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20 min-w-[100px]"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="relative max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou número..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm"
          />
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Usuário</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Telefone</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-center">Poderes</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse bg-card">
                      <td className="px-6 py-5"><div className="h-4 bg-muted rounded w-24"></div></td>
                      <td className="px-6 py-5"><div className="h-4 bg-muted rounded w-32"></div></td>
                      <td className="px-6 py-5 text-center"><div className="h-6 bg-muted rounded-full w-16 mx-auto"></div></td>
                      <td className="px-6 py-5 text-center"><div className="h-6 bg-muted rounded-full w-24 mx-auto"></div></td>
                      <td className="px-6 py-5"><div className="h-8 bg-muted rounded-lg w-20 ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={32} className="opacity-20" />
                        <p>{searchTerm ? 'Nenhum usuário encontrado na busca.' : 'Nenhum usuário cadastrado.'}</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredEntries.map(e => (
                  <tr key={e.phone} className="bg-card hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 font-medium text-foreground flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                        {e.name?.[0] || '?'}
                      </div>
                      {e.name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{e.phone}</td>
                    <td className="px-6 py-4 text-center items-center">
                      <button 
                        onClick={() => toggle(e, 'active')} 
                        className={`inline-flex w-24 justify-center items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${e.active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20 dark:border-emerald-900/50 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 border-rose-200 hover:bg-rose-500/20 dark:border-rose-900/50 dark:text-rose-400'}`}
                      >
                        {e.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {e.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center items-center">
                      <button 
                        onClick={() => toggle(e, 'can_store_memory')} 
                        title="Permissão para salvar memórias e PDFs"
                        className={`inline-flex w-36 justify-center items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors border whitespace-nowrap ${e.can_store_memory ? 'bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20 dark:border-blue-900/50 dark:text-blue-400' : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'}`}
                      >
                        {e.can_store_memory ? <BrainCircuit size={12} /> : <Shield size={12} className="opacity-50" />}
                        {e.can_store_memory ? 'Pode Salvar' : 'Apenas Leitura'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEdit(e)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button 
                          onClick={() => remove(e.phone)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
