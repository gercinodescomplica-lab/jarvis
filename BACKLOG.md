# Jarvis — Backlog de Melhorias

> Prioridade: 🔴 Alta · 🟡 Média · 🟢 Baixa
> Esforço: P (horas) · M (dias) · G (semanas)

---

## Lembretes

| # | Melhoria | Prioridade | Esforço | Detalhes |
|---|----------|-----------|---------|---------|
| L1 | Listar lembretes pendentes | 🔴 | P | Comando `meus lembretes` mostra os próximos agendados no Trigger.dev |
| L2 | Cancelar lembrete | 🔴 | M | Comando `cancela lembrete [descrição]` cancela o run no Trigger.dev |
| L3 | Lembretes recorrentes | 🟡 | M | Suporte a "todo dia às 8h", "toda segunda" usando `cron` do Trigger.dev |
| L4 | Editar lembrete | 🟡 | M | Reparsear e recriar o run com novo horário |
| L5 | Fallback quando LLM não encontra data | 🟡 | P | Responder "não entendi a data, pode ser mais específico?" em vez de ignorar |
| L6 | Confirmação com hora em BRT | 🟢 | P | Garantir que a hora confirmada sempre aparece em BRT (já funciona, mas validar edge cases de meia-noite/virada de dia) |

---

## PDF & Documentos

| # | Melhoria | Prioridade | Esforço | Detalhes |
|---|----------|-----------|---------|---------|
| D1 | Limite de tamanho de PDF | 🔴 | P | Rejeitar PDFs > 25 MB com mensagem amigável antes de tentar baixar |
| D2 | Suporte a PDF escaneado (OCR) | 🟡 | G | Integrar Google Document AI ou Tesseract para PDFs baseados em imagem |
| D3 | Listar documentos salvos | 🟡 | P | Comando `meus documentos` retorna lista com título e data de upload |
| D4 | Deletar documento | 🟡 | M | Comando `apaga documento [título]` remove do Supabase |
| D5 | Atualizar documento | 🟡 | M | Reenviar PDF substitui a versão anterior pelo mesmo nome |
| D6 | Busca semântica com embedding | 🟡 | M | Melhorar `searchDocuments` para usar vector similarity em vez de só `ilike` |
| D7 | Progresso durante upload grande | 🟢 | P | Enviar mensagem intermediária "ainda processando..." para PDFs > 5 MB |
| D8 | Segmentação de documentos por usuário no chat web | 🟢 | M | Filtrar `document_chunks` por `uploader_phone` também no chat web |

---

## Memória

| # | Melhoria | Prioridade | Esforço | Detalhes |
|---|----------|-----------|---------|---------|
| M1 | Listar memórias salvas | 🔴 | P | Comando `o que você sabe sobre mim?` lista as últimas N memórias do usuário |
| M2 | Deletar memória | 🟡 | P | Comando `esquece [assunto]` remove a memória do Supabase |
| M3 | TTL automático para memórias antigas | 🟢 | P | Job semanal que apaga memórias com > 6 meses sem acesso |
| M4 | Tags nas memórias | 🟢 | M | Categorizar automaticamente (trabalho, pessoal, financeiro) para buscas mais precisas |

---

## WhatsApp / Interação

| # | Melhoria | Prioridade | Esforço | Detalhes |
|---|----------|-----------|---------|---------|
| W1 | Deduplicação de mensagens | 🔴 | P | Ignorar messageId já processado para evitar resposta dupla em reenvios |
| W2 | Rate limiting por usuário | 🔴 | M | Máximo N mensagens por minuto por telefone; responde "aguarda um momento" |
| W3 | Indicador de digitação real | 🟡 | P | `sendPresence` já existe — garantir que sempre dispara antes da resposta |
| W4 | Comando `/ajuda` | 🟡 | P | Resposta fixa listando todos os comandos e capacidades do Jarvis |
| W5 | Mensagens de imagem | 🟡 | G | Aceitar imagem + texto e descrever/analisar via Gemini Vision |
| W6 | Gerenciar whitelist pelo próprio WhatsApp | 🟡 | M | Mensagem de número admin adiciona/remove usuários diretamente |
| W7 | Limpeza automática do histórico de chat | 🟡 | P | Apagar mensagens da tabela `chats` com > 30 dias (manter só contexto relevante) |
| W8 | Suporte a múltiplas instâncias | 🟢 | G | Configurar Jarvis para atender mais de uma instância do WhatsApp |

---

## Áudio

| # | Melhoria | Prioridade | Esforço | Detalhes |
|---|----------|-----------|---------|---------|
| A1 | Timeout na transcrição | 🔴 | P | Abortar chamada ao Google Speech após 30s e informar o usuário |
| A2 | Fallback para Whisper (OpenAI) | 🟡 | M | Se Google Speech falhar, tentar Whisper como backup |
| A3 | Confirmar transcrição para o usuário | 🟢 | P | Antes de responder, mostrar "Ouvi: _[transcrição]_" para o usuário validar |

---

## Integrações

| # | Melhoria | Prioridade | Esforço | Detalhes |
|---|----------|-----------|---------|---------|
| I1 | Atualizar status de projeto no Notion | 🔴 | P | Comando "muda status do projeto X para Em andamento" via `notion.pages.update` |
| I2 | Criar evento no calendário | 🟡 | M | Ferramenta `createCalendarEvent` via Microsoft Graph |
| I3 | Paginação na busca do Notion | 🟡 | P | `getAllProjects` já traz N itens — adicionar cursor para bancos maiores |
| I4 | Webhook de atualização do Notion | 🟢 | G | Invalidar cache quando uma página Notion for editada via webhook do Notion |
| I5 | Integração com Google Calendar | 🟢 | G | Alternativa ao Graph API para usuários sem Microsoft 365 |

---

## Infraestrutura & Performance

| # | Melhoria | Prioridade | Esforço | Detalhes |
|---|----------|-----------|---------|---------|
| F1 | Cache compartilhado (Redis/Upstash) | 🔴 | M | Substituir cache in-memory por Upstash Redis — funciona em serverless e múltiplas instâncias |
| F2 | Validação de env vars na inicialização | 🔴 | P | Checar todas as variáveis obrigatórias no startup e logar erro claro se faltar |
| F3 | Migrar CalendarDB de JSON para Supabase | 🟡 | M | Arquivo JSON local não funciona em ambiente serverless (Vercel) após cold start |
| F4 | Embeddings em paralelo | 🟡 | P | Processar chunks do PDF com `Promise.all` em vez de loop sequencial |
| F5 | TTL na tabela `chats` | 🟡 | P | Migration no Supabase: deletar mensagens com > 30 dias via pg_cron ou job |
| F6 | Logs estruturados | 🟡 | M | Substituir `console.log` por logger com níveis (info/warn/error) e contexto (phone, requestId) |
| F7 | Health check endpoint | 🟢 | P | `GET /api/health` retorna status de todos os serviços (Supabase, Notion, Evolution) |
| F8 | Rastreamento de erros (Sentry) | 🟢 | P | Adicionar Sentry para capturar exceptions em produção com stack trace |

---

## Segurança

| # | Melhoria | Prioridade | Esforço | Detalhes |
|---|----------|-----------|---------|---------|
| S1 | Validação estrita do número de telefone | 🔴 | P | Usar regex `/^\d{10,15}$/` ao invés de `.includes()` para evitar match parcial |
| S2 | Autenticação no endpoint `/api/tools/stats` | 🔴 | P | Adicionar verificação de `CRON_SECRET` ou Bearer token — está aberto atualmente |
| S3 | Sanitização da query em `searchDocuments` | 🔴 | P | Escapar termos antes de montar filtro `ilike` no Supabase |
| S4 | Rotação de tokens da whitelist | 🟡 | M | Tokens do middleware com expiração e renovação automática |
| S5 | CORS restrito | 🟡 | P | Configurar `Access-Control-Allow-Origin` apenas para domínios conhecidos |

---

## UX / Chat Web

| # | Melhoria | Prioridade | Esforço | Detalhes |
|---|----------|-----------|---------|---------|
| U1 | Botão para limpar conversa | 🟡 | P | Limpa histórico local e inicia nova sessão |
| U2 | Histórico de conversas salvo | 🟡 | M | Persistir conversas no Supabase com sessões nomeadas |
| U3 | Upload de PDF no chat web | 🟡 | M | Drag-and-drop de PDF na interface web, igual ao WhatsApp |
| U4 | Indicador de qual ferramenta foi usada | 🟢 | P | Mostrar tag discreta "via Notion" / "via Agenda" abaixo da resposta |
| U5 | Tema escuro / claro | 🟢 | P | Toggle de tema na interface |

---

## Testes

| # | Melhoria | Prioridade | Esforço | Detalhes |
|---|----------|-----------|---------|---------|
| T1 | Testes unitários do `parseReminder` | 🔴 | P | Cobrir edge cases: "amanhã", "sexta", "daqui a 2h30", sem data |
| T2 | Testes do `checkAuthorization` | 🔴 | P | Cobrir: usuário autorizado, não autorizado, DB timeout (fallback JSON) |
| T3 | Testes de integração das tools | 🟡 | M | Mock Notion/Graph API e testar `searchProjects`, `getDRMData`, etc. |
| T4 | Teste end-to-end do webhook WhatsApp | 🟡 | M | Simular payload da Evolution API e verificar resposta |
| T5 | Teste de carga | 🟢 | M | Verificar comportamento com 50+ mensagens simultâneas |

---

## Resumo por prioridade

| Prioridade | Qtd | Itens chave |
|------------|-----|------------|
| 🔴 Alta | 14 | L1, L2, D1, W1, W2, F1, F2, S1, S2, S3, T1, T2, A1, I1 |
| 🟡 Média | 23 | Lembretes recorrentes, OCR, busca semântica, rate limit, cache Redis, logs, Sentry... |
| 🟢 Baixa | 13 | TTL memórias, múltiplas instâncias, Whisper, Google Calendar, tema escuro... |
