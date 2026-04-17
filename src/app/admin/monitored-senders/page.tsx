'use client';
import { useEffect, useState } from 'react';
import { useAdminToken } from '../AdminTokenContext';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Search, Mail, Inbox, AlertCircle } from 'lucide-react';

type Mailbox = { mailbox: string; label: string; whatsapp_phone: string; active: boolean };
type Sender  = { id: string; mailbox: string; sender_email: string; sender_name: string; priority: 'high' | 'medium' | 'low'; active: boolean; created_at: string };

const PRIORITY_CONFIG = {
  high:   { label: 'Alta',  dot: 'bg-rose-500',    badge: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-900/50 dark:text-rose-400' },
  medium: { label: 'Média', dot: 'bg-amber-400',   badge: 'bg-amber-400/10 text-amber-600 border-amber-200 dark:border-amber-900/50 dark:text-amber-400' },
  low:    { label: 'Baixa', dot: 'bg-sky-400',     badge: 'bg-sky-400/10 text-sky-600 border-sky-200 dark:border-sky-900/50 dark:text-sky-400' },
};

const emptyForm = { sender_email: '', sender_name: '', priority: 'medium' as const };
const emptyMailboxForm = { mailbox: '', label: '', whatsapp_phone: '' };

export default function MonitoredSendersPage() {
  const token = useAdminToken();
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [mailboxes, setMailboxes]       = useState<Mailbox[]>([]);
  const [selectedMb, setSelectedMb]     = useState<string>('');
  const [senders, setSenders]           = useState<Sender[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');

  // Modal remetente
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [editId, setEditId]             = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);

  // Modal caixa
  const [showMailboxForm, setShowMailboxForm] = useState(false);
  const [mbForm, setMbForm]             = useState(emptyMailboxForm);
  const [savingMb, setSavingMb]         = useState(false);

  const loadMailboxes = async () => {
    const data = await fetch('/api/admin/email-mailbox-configs', { headers }).then(r => r.json());
    setMailboxes(Array.isArray(data) ? data : []);
    if (Array.isArray(data) && data.length > 0 && !selectedMb) {
      setSelectedMb(data[0].mailbox);
    }
  };

  const loadSenders = async (mb: string) => {
    if (!mb) return;
    setLoading(true);
    const data = await fetch(`/api/admin/monitored-senders?mailbox=${encodeURIComponent(mb)}`, { headers }).then(r => r.json());
    setSenders(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { loadMailboxes(); }, [token]);
  useEffect(() => { if (selectedMb) loadSenders(selectedMb); }, [selectedMb]);

  // ── Remetentes ──────────────────────────────────────────────────────────────
  const openAdd  = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (s: Sender) => { setForm({ sender_email: s.sender_email, sender_name: s.sender_name, priority: s.priority }); setEditId(s.id); setShowForm(true); };

  const saveSender = async () => {
    if (!form.sender_email || !form.sender_name || !selectedMb) return;
    setSaving(true);
    if (editId) {
      await fetch(`/api/admin/monitored-senders/${editId}`, { method: 'PATCH', headers, body: JSON.stringify({ sender_name: form.sender_name, priority: form.priority }) });
    } else {
      await fetch('/api/admin/monitored-senders', { method: 'POST', headers, body: JSON.stringify({ ...form, mailbox: selectedMb }) });
    }
    setSaving(false); setShowForm(false); loadSenders(selectedMb);
  };

  const removeSender = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}" da lista?`)) return;
    await fetch(`/api/admin/monitored-senders/${id}`, { method: 'DELETE', headers });
    loadSenders(selectedMb);
  };

  const toggleActive = async (s: Sender) => {
    await fetch(`/api/admin/monitored-senders/${s.id}`, { method: 'PATCH', headers, body: JSON.stringify({ active: !s.active }) });
    loadSenders(selectedMb);
  };

  // ── Caixas ──────────────────────────────────────────────────────────────────
  const saveMailbox = async () => {
    if (!mbForm.mailbox || !mbForm.label || !mbForm.whatsapp_phone) return;
    setSavingMb(true);
    await fetch('/api/admin/email-mailbox-configs', { method: 'POST', headers, body: JSON.stringify(mbForm) });
    setSavingMb(false); setShowMailboxForm(false); setMbForm(emptyMailboxForm);
    await loadMailboxes();
    setSelectedMb(mbForm.mailbox);
  };

  const toggleMailbox = async (mb: Mailbox) => {
    await fetch(`/api/admin/email-mailbox-configs/${encodeURIComponent(mb.mailbox)}`, { method: 'PATCH', headers, body: JSON.stringify({ active: !mb.active }) });
    loadMailboxes();
  };

  const filtered = senders.filter(s =>
    s.sender_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.sender_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedMailboxData = mailboxes.find(m => m.mailbox === selectedMb);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-foreground">Monitored Senders</h1>
          <p className="text-muted-foreground">Remetentes monitorados por caixa de email</p>
        </div>
        <button
          onClick={openAdd}
          disabled={!selectedMb}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus size={18} /> Novo Remetente
        </button>
      </div>

      {/* Caixas de email */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Inbox size={16} className="text-primary" /> Caixas Monitoradas
          </div>
          <button
            onClick={() => { setMbForm(emptyMailboxForm); setShowMailboxForm(true); }}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={14} /> Adicionar caixa
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {mailboxes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma caixa configurada ainda.</p>
          )}
          {mailboxes.map(mb => (
            <button
              key={mb.mailbox}
              onClick={() => setSelectedMb(mb.mailbox)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                selectedMb === mb.mailbox
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                  : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${mb.active ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
              {mb.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de remetentes */}
      {selectedMb && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm"
              />
            </div>
            {selectedMailboxData && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail size={13} />
                <span className="font-mono">{selectedMb}</span>
                <span>·</span>
                <button
                  onClick={() => toggleMailbox(selectedMailboxData)}
                  className={`font-semibold ${selectedMailboxData.active ? 'text-emerald-500 hover:text-emerald-600' : 'text-rose-500 hover:text-rose-600'} transition-colors`}
                >
                  {selectedMailboxData.active ? 'Ativa' : 'Inativa'}
                </button>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Remetente</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-center">Prioridade</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-center">Status</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-5"><div className="h-4 bg-muted rounded w-28" /></td>
                        <td className="px-6 py-5"><div className="h-4 bg-muted rounded w-40" /></td>
                        <td className="px-6 py-5 text-center"><div className="h-6 bg-muted rounded-full w-16 mx-auto" /></td>
                        <td className="px-6 py-5 text-center"><div className="h-6 bg-muted rounded-full w-16 mx-auto" /></td>
                        <td className="px-6 py-5"><div className="h-8 bg-muted rounded-lg w-20 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={32} className="opacity-20" />
                          <p>{searchTerm ? 'Nenhum remetente encontrado.' : 'Nenhum remetente monitorado nesta caixa.'}</p>
                          {!searchTerm && (
                            <button onClick={openAdd} className="mt-2 text-primary text-sm hover:underline">
                              + Adicionar primeiro remetente
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(s => {
                    const prio = PRIORITY_CONFIG[s.priority] ?? PRIORITY_CONFIG.medium;
                    return (
                      <tr key={s.id} className="bg-card hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4 font-medium text-foreground flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                            {s.sender_name[0]}
                          </div>
                          {s.sender_name}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{s.sender_email}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${prio.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                            {prio.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleActive(s)}
                            className={`inline-flex w-20 justify-center items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                              s.active
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20 dark:border-emerald-900/50 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 border-rose-200 hover:bg-rose-500/20 dark:border-rose-900/50 dark:text-rose-400'
                            }`}
                          >
                            {s.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {s.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(s)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => removeSender(s.id, s.sender_name)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                              title="Remover"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Remetente */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold">{editId ? 'Editar Remetente' : 'Novo Remetente'}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Caixa: <span className="font-mono text-foreground">{selectedMailboxData?.label ?? selectedMb}</span>
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <input
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  value={form.sender_name}
                  onChange={e => setForm(f => ({ ...f, sender_name: e.target.value }))}
                  placeholder="Ex: Fulano da Silva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50"
                  value={form.sender_email}
                  onChange={e => setForm(f => ({ ...f, sender_email: e.target.value.toLowerCase().trim() }))}
                  disabled={!!editId}
                  placeholder="fulano@empresa.com"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prioridade</label>
                <div className="flex gap-2">
                  {(['high', 'medium', 'low'] as const).map(p => {
                    const cfg = PRIORITY_CONFIG[p];
                    return (
                      <button
                        key={p}
                        onClick={() => setForm(f => ({ ...f, priority: p }))}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          form.priority === p
                            ? `${cfg.badge} border-current`
                            : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all">
                Cancelar
              </button>
              <button
                onClick={saveSender}
                disabled={saving || !form.sender_name || !form.sender_email}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20 min-w-[100px]"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Caixa de email */}
      {showMailboxForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold">Nova Caixa Monitorada</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure o email e o WhatsApp de notificação.</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email da caixa</label>
                <input
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  value={mbForm.mailbox}
                  onChange={e => setMbForm(f => ({ ...f, mailbox: e.target.value.toLowerCase().trim() }))}
                  placeholder="tiagoluz@prodam.sp.gov.br"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome / Label</label>
                <input
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  value={mbForm.label}
                  onChange={e => setMbForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Tiago Luz"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp para notificações</label>
                <input
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  value={mbForm.whatsapp_phone}
                  onChange={e => setMbForm(f => ({ ...f, whatsapp_phone: e.target.value.replace(/\D/g, '') }))}
                  placeholder="5511999999999"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowMailboxForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all">
                Cancelar
              </button>
              <button
                onClick={saveMailbox}
                disabled={savingMb || !mbForm.mailbox || !mbForm.label || !mbForm.whatsapp_phone}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20 min-w-[100px]"
              >
                {savingMb ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
