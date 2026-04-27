'use client';
import { useEffect, useState } from 'react';
import { useAdminToken } from '../AdminTokenContext';
import { Plus, Trash2, Users, Cake, Phone, CheckCircle2, XCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/confirm-modal';

type Recipient = {
  id: string;
  whatsapp_id: string;
  label: string;
  active: boolean;
  created_at: string;
};

const emptyForm = { label: '', whatsapp_id: '', active: true };

function formatWhatsAppId(id: string) {
  if (id.endsWith('@g.us')) return { type: 'grupo', display: id.replace('@g.us', ''), icon: '👥' };
  return { type: 'contato', display: id.replace('@s.whatsapp.net', ''), icon: '👤' };
}

export default function BirthdayRecipientsPage() {
  const token = useAdminToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [idType, setIdType] = useState<'contact' | 'group'>('contact');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [toDelete, setToDelete] = useState<Recipient | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetch('/api/admin/birthday-recipients', { headers }).then(r => r.json());
    setRecipients(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  const toggle = async (r: Recipient) => {
    await fetch(`/api/admin/birthday-recipients/${r.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ active: !r.active }),
    });
    load();
  };

  const save = async () => {
    if (!form.label || !form.whatsapp_id) return;
    setSaving(true);
    const suffix = idType === 'group' ? '@g.us' : '@s.whatsapp.net';
    const raw = form.whatsapp_id.trim().replace(/@.+$/, ''); // remove sufixo se o usuário colou
    await fetch('/api/admin/birthday-recipients', {
      method: 'POST', headers,
      body: JSON.stringify({ label: form.label, whatsapp_id: `${raw}${suffix}`, active: form.active }),
    });
    setSaving(false);
    setShowForm(false);
    setForm(emptyForm);
    load();
  };

  const confirmDelete = (r: Recipient) => { setToDelete(r); setConfirmOpen(true); };
  const handleDelete = async () => {
    if (!toDelete) return;
    setConfirmLoading(true);
    await fetch(`/api/admin/birthday-recipients/${toDelete.id}`, { method: 'DELETE', headers });
    setConfirmLoading(false);
    setConfirmOpen(false);
    setToDelete(null);
    load();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Cake size={28} className="text-primary" /> Aniversários
          </h1>
          <p className="text-muted-foreground mt-1">Destinatários que recebem o aviso diário de aniversariantes</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setShowForm(true); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20"
        >
          <Plus size={18} /> Adicionar destinatário
        </button>
      </div>

      {/* Info card */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
        <Cake size={18} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          O aviso de aniversário é enviado todos os dias às <span className="font-semibold text-foreground">09h BRT</span> para cada destinatário ativo abaixo.
          Adicione números individuais (<code className="text-xs bg-muted px-1 rounded">...@s.whatsapp.net</code>) ou grupos (<code className="text-xs bg-muted px-1 rounded">...@g.us</code>).
        </p>
      </div>

      {/* Lista */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2 text-sm font-semibold">
          <Users size={15} className="text-primary" />
          <span>{recipients.filter(r => r.active).length} destinatário(s) ativo(s)</span>
        </div>

        {loading ? (
          <div className="p-8 flex flex-col gap-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recipients.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Cake size={36} className="opacity-20" />
            <p className="text-sm">Nenhum destinatário configurado.</p>
            <button onClick={() => setShowForm(true)} className="text-primary text-sm hover:underline">
              + Adicionar primeiro destinatário
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {recipients.map(r => {
              const fmt = formatWhatsAppId(r.whatsapp_id);
              return (
                <div key={r.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg shrink-0">
                    {fmt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate flex items-center gap-1 mt-0.5">
                      <Phone size={10} /> {fmt.display}
                      <span className="text-muted-foreground/50 ml-1">({fmt.type})</span>
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(r)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      r.active
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-900/50'
                        : 'bg-rose-500/10 text-rose-600 border-rose-200 hover:bg-rose-500/20 dark:text-rose-400 dark:border-rose-900/50'
                    }`}
                  >
                    {r.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {r.active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button
                    onClick={() => confirmDelete(r)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remover"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal — Adicionar */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><Cake size={20} className="text-primary" /> Novo Destinatário</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure quem receberá o aviso de aniversário.</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome / Label</label>
                <input
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Ex: Dani, Grupo Diretoria"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <div className="flex gap-2">
                  {(['contact', 'group'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setIdType(t)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        idType === t
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {t === 'contact' ? '👤 Contato' : '👥 Grupo'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {idType === 'contact' ? 'Número WhatsApp' : 'ID do Grupo'}
                </label>
                <div className="relative">
                  <input
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all pr-40"
                    value={form.whatsapp_id}
                    onChange={e => setForm(f => ({ ...f, whatsapp_id: e.target.value.replace(/[^\d]/g, '') }))}
                    placeholder={idType === 'contact' ? '5511999999999' : '120363424207983724'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                    {idType === 'contact' ? '@s.whatsapp.net' : '@g.us'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {idType === 'contact'
                    ? 'DDI + DDD + número. Ex: 5511949633602'
                    : 'ID numérico do grupo. Ex: 120363424207983724'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !form.label || !form.whatsapp_id}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md shadow-primary/20 min-w-[100px]"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmModal
        open={confirmOpen}
        title={`Remover "${toDelete?.label}"?`}
        description={`${toDelete?.whatsapp_id} deixará de receber os avisos de aniversário.`}
        confirmLabel="Remover"
        loading={confirmLoading}
        onConfirm={handleDelete}
        onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
      />
    </div>
  );
}
