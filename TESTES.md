# Jarvis — Guia de Testes

> Todos os testes de WhatsApp devem ser feitos a partir de um número autorizado em `jarvis-permissions.json`.

---

## 1. Script de Integração (terminal)

Valida todos os serviços de uma vez.

```bash
npx tsx --tsconfig tsconfig.json scripts/test-integrations.ts
```

### O que verifica

| # | Verificação | Resultado esperado |
|---|-------------|-------------------|
| 1 | Variáveis de ambiente | Todas as 7 chaves presentes |
| 2 | Notion — banco DRM | `> 0 projetos` encontrados |
| 3 | Notion — workspace | Retorna páginas/databases |
| 4 | Evolution API | Instância encontrada, status `open` |
| 5 | Trigger.dev | Run criado com ID (dispara em ~1 min) |
| 6 | Supabase | Conectado, tabela `chats` acessível |
| 7 | LLM reminder parsing | Timestamp ~5 min no futuro parseado |

**Resultado esperado no final:**
```
Resultado: 7 passou, 0 falhou
✅ Tudo funcionando!
```

---

## 2. WhatsApp — Conversa simples

**Mande:** `oi, tudo bem?`

**Esperado:** resposta em linguagem natural, sem acionar nenhuma ferramenta.

---

## 3. WhatsApp — Projetos DRM (Notion)

**Mande:** `quais são os projetos em andamento?`

**Esperado:** lista com nome, status, importância e prazo dos projetos do banco DRM.

Variações para testar:
- `tem algum projeto atrasado?` → filtra por deadline < hoje
- `projetos com prazo nos próximos 14 dias` → mostra upcoming deadlines
- `me fala do projeto [nome]` → busca por palavra-chave

---

## 4. WhatsApp — Dados DRM (dashboard comercial)

**Mande:** `qual o atingimento de metas da DRM?`

**Esperado:** dados do dashboard comercial com metas, contratado, forecast, pipeline.

Variações:
- `metas do [nome do gerente]`
- `pipeline quente do Q2`
- `ranking de gerentes`

---

## 5. WhatsApp — Agenda (Microsoft Graph)

**Mande:** `quais são meus compromissos essa semana?`

**Esperado:** lista de eventos dos próximos 7 dias do calendário Microsoft.

Variações:
- `agenda do Tiago amanhã`
- `reuniões da Danielle essa semana`
- `o que o Gercino tem hoje?`

---

## 6. WhatsApp — Lembrete

**Mande:** `me lembre de ligar pro cliente daqui a 2 minutos`

**Esperado imediato:**
```
⏰ Lembrete criado!

*ligar pro cliente*

📅 Vou te avisar [dia da semana], [data] às [hora].
```

**Esperado após ~2 minutos:**
```
🔔 *Lembrete!*

ligar pro cliente
```

Variações para testar:
- `me lembra de mandar o relatório amanhã às 9h`
- `lembrete: reunião sexta às 14h`
- `não me deixa esquecer de revisar o contrato hoje às 18h`

> **Atenção:** requer `TRIGGER_SECRET_KEY` com `tr_prod_` no Vercel, ou worker local rodando com `npx trigger.dev@latest dev`.

---

## 7. WhatsApp — Criar projeto no Notion

**Mande:** `cria um projeto chamado Revisão de Contratos com importância alta e prazo 2026-04-30`

**Esperado:**
```
✅ Projeto criado no Notion!
*Revisão de Contratos*
Importância: Alta | Prazo: 2026-04-30
🔗 [link notion]
```

---

## 8. WhatsApp — Busca no Notion (workspace)

**Mande:** `tem algo sobre treinamento no meu notion?`

**Esperado:** lista de páginas/databases do workspace que mencionam "treinamento".

---

## 9. WhatsApp — PDF

### 9a. PDF válido
1. Envie um PDF com texto real (ex: um contrato, relatório)
2. **Esperado imediato:** `📄 Recebi o PDF *nome.pdf*! Processando...`
3. **Após processamento:** `✅ PDF processado! Qual o *assunto* deste documento?`
4. Responda: `Relatório de vendas Q1`
5. **Esperado:** `✅ Titulo definido: *Relatório de vendas Q1*. Documento pronto para consulta!`

Depois teste a busca:
- `o que diz o relatório de vendas?` → deve retornar trechos do documento

### 9b. PDF corrompido / muito pequeno
- **Esperado:** `❌ O PDF parece estar corrompido ou em formato inválido. Tente reenviar o arquivo original.`

### 9c. Número não autorizado
- **Esperado:** sem resposta (webhook retorna `unauthorized` silenciosamente)

---

## 10. WhatsApp — Áudio / nota de voz

1. Grave e envie uma nota de voz: _"me lembre de tomar café daqui a 5 minutos"_
2. **Esperado:** transcrição pelo Google Speech-to-Text → mesmo fluxo do lembrete
3. Ou envie: _"quais projetos estão atrasados"_ → mesmo fluxo de conversa

---

## 11. WhatsApp — Salvar memória

### Texto
**Mande:** `salva isso: o cliente Acme prefere reuniões às sextas`

**Esperado:** `📝 Entendido! Qual o *titulo* para essa memoria?`

Responda: `Preferência Acme`

**Esperado:** `✅ Memorizado com titulo: *Preferência Acme*`

### Áudio
Grave: _"salva isso: senha do servidor é 1234"_ (exemplo)

**Esperado:** salva automaticamente com título inferido pelo LLM, sem perguntar.

### Verificar que a memória foi usada
**Mande:** `como o cliente Acme prefere se reunir?`

**Esperado:** resposta usando o contexto memorizado.

---

## 12. WhatsApp — Grupos

1. O grupo precisa ter o JID cadastrado em `jarvis-permissions.json`
2. Mande `@Jarvis` no grupo com uma pergunta
3. **Esperado:** resposta normal, igual ao chat individual
4. Em lembretes de grupo: a mensagem menciona o remetente com `@numero`

---

## 13. Chat Web

Acesse a interface web do Jarvis e teste as mesmas ferramentas via chat.
As ferramentas disponíveis são as mesmas do WhatsApp (projetos, agenda, DRM, documentos, lembretes, criar projeto).

---

## 14. Easter egg

**Mande:** `🦴` (emoji de osso)

**Esperado:** Jarvis responde com um sticker.

---

## Variáveis que precisam estar configuradas

| Variável | Onde | Para quê |
|----------|------|---------|
| `NOTION_API_KEY` | Vercel + `.env` | Todos os testes Notion |
| `TRIGGER_SECRET_KEY` (tr_prod_) | Vercel | Lembretes em produção |
| `EVOLUTION_API_URL` | Vercel + `.env` | Todas as mensagens WhatsApp |
| `EVOLUTION_API_TOKEN` | Vercel + `.env` | Auth na Evolution API |
| `EVOLUTION_INSTANCE` | Vercel + `.env` | Nome da instância WA |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env` | Banco de dados |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env` | Banco de dados |
| `EXTERNAL_API_BASE_URL` | Vercel + `.env` | Dashboard DRM |
| `EXTERNAL_API_KEY` | Vercel + `.env` | Auth no dashboard DRM |
| `GOOGLE_CLOUD_CREDENTIALS` | Vercel | Transcrição de áudio |
| `GRAPH_CLIENT_ID/SECRET/TENANT` | Vercel | Calendário Microsoft |
