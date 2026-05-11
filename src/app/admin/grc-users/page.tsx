'use client';
import { useEffect, useState } from 'react';
import { useAdminToken } from '../AdminTokenContext';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Search, Link2 } from 'lucide-react';

type GRCUser = {
  id: string;
  phone: string;
  manager_id: string;
  display_name: string;
  active: boolean;
  created_at: string;
};

const emptyForm = { phone: '', manager_id: '', display_name: '', active: true };

export default function GRCUsersPage() {
  const token = useAdminToken();
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [users, setUsers] = useState<GRCUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/grc-users', { headers })
      .then(r => r.json())
      .then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(load, [token]);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (u: GRCUser) => {
    setForm({ phone: u.phone, manager_id: u.manager_id, display_name: u.display_name, active: u.active });
    setEditId(u.id);
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    if (editId) {
      await fetch(`/api/admin/grc-users/${editId}`, { method: 'PATCH', headers, body: JSON.stringify(form) });
    } else {
      await fetch('/api/admin/grc-users', { method: 'POST', headers, body: JSON.stringify(form) });
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const remove = async (u: GRCUser) => {
    if (!confirm(`Remover ${u.display_name} (${u.phone})?`)) return;
    await fetch(`/api/admin/grc-users/${u.id}`, { method: 'DELETE', headers });
    load();
  };

  const toggle = async (u: GRCUser) => {
    await fetch(`/api/admin/grc-users/${u.id}`, { method: 'PATCH', headers, body: JSON.stringify({ active: !u.active }) });
    load();
  };

  const filtered = users.filter(u =>
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search) ||
    u.manager_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-foreground">Gerentes GRC</h1>
          <p className="text-muted-foreground">Mapeamento WhatsApp → manager do Dashboard Comercial</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20"
        >
          <Plus size={18} /> Novo Gerente
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou manager ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-6">
            <h2 className="text-xl font-bold">{editId ? 'Editar Gerente' : 'Novo Gerente'}</h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Nome de exibição</label>
                <input
                  type="text"
                  placeholder="ex: Malde"
                  value={form.display_name}
                  onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Telefone WhatsApp</label>
                <input
                  type="text"
                  placeholder="5511999990000 (só dígitos, com DDI)"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Manager ID (dashboard)</label>
                <input
                  type="text"
                  placeholder="ex: kam1-malde"
                  value={form.manager_id}
                  onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-muted-foreground">{form.active ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Telefone</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Manager ID</th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Ativo</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-12">Carregando…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-12">Nenhum gerente cadastrado.</td></tr>
            )}
            {filtered.map(u => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{u.display_name}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{u.phone}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-mono">
                    <Link2 size={11} />{u.manager_id}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggle(u)} className="inline-flex">
                    {u.active
                      ? <CheckCircle2 size={18} className="text-emerald-500" />
                      : <XCircle size={18} className="text-muted-foreground" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => remove(u)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
