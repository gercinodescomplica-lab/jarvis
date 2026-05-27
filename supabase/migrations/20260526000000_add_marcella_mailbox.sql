-- Caixa de email da Marcella Batista monitorada pelo Jarvis
insert into public.email_mailbox_configs (mailbox, label, whatsapp_phone, active)
values ('marcellabatista@prodam.sp.gov.br', 'Marcella Batista', '5511961117448', true)
on conflict (mailbox) do update set
  label          = excluded.label,
  whatsapp_phone = excluded.whatsapp_phone,
  active         = excluded.active;
