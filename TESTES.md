# Jarvis — Script de Testes Completo

> Todos os testes de WhatsApp devem ser feitos a partir de um número autorizado em `jarvis-permissions.json` ou no Supabase.
> Marque cada item após validar. ✅ = passou | ❌ = falhou | ⚠️ = comportamento inesperado

---

## 1. Identidade

| # | Mensagem | Esperado |
|---|----------|----------|
| 1.1 | `Qual é o seu nome?` | Responde **Jarvis** (não Rex) |
| 1.2 | `Quem é você?` | Se apresenta como Jarvis |
| 1.3 | `Você é o Rex?` | Nega, confirma ser Jarvis |

---

## 2. Reconhecimento do Usuário

| # | Mensagem | Esperado |
|---|----------|----------|
| 2.1 | `Oi` | Cumprimenta pelo **nome cadastrado** na whitelist |
| 2.2 | `Qual minha agenda?` | Usa o nome do usuário na resposta (ex: "Gercino, sua agenda de hoje é...") |
| 2.3 | *(enviar de número não cadastrado)* | Silêncio — sem resposta |

---

## 3. Agenda / Calendário

| # | Mensagem | Esperado |
|---|----------|----------|
| 3.1 | `Qual minha agenda de hoje?` | Lista eventos do dia com horários em **BRT** (não UTC) |
| 3.2 | `E amanhã?` | Lista apenas eventos de amanhã |
| 3.3 | `Agenda da semana` | Lista eventos dos próximos 7 dias |
| 3.4 | `Agenda do Tiago` | Mostra agenda de tiagoluz@prodam.sp.gov.br |
| 3.5 | `Agenda da Danielle` | Mostra agenda de danielleoliveira@prodam.sp.gov.br |
| 3.6 | *(alterar evento no calendário e perguntar imediatamente)* | Resposta já reflete a alteração (sem cache) |
| 3.7 | `Quais são os horários livres do Gercino amanhã?` | Calcula slots livres entre 09:00–18:00 |

> ⚠️ **Verificar:** horários devem estar em BRT. Se mostrar +3h a mais, o bug de timezone voltou.

---

## 4. Lembretes

### 4.1 Criação direta (via REGEX)

| # | Mensagem | Esperado |
|---|----------|----------|
| 4.1 | `Me lembra amanhã às 9h de ligar pro João` | Confirma lembrete para amanhã às 09:00 |
| 4.2 | `Me avisa daqui a 5 minutos de tomar água` | Confirma lembrete em 5 min |
| 4.3 | `Lembrete: reunião com cliente sexta às 14h` | Cria lembrete para sexta 14:00 |
| 4.4 | `Não me deixa esquecer de enviar o relatório hoje às 17h` | Cria lembrete para hoje 17:00 |

### 4.2 Criação com datas dentro do conteúdo (bug corrigido)

| # | Mensagem | Esperado |
|---|----------|----------|
| 4.5 | `Me lembra hoje às 10h de: 1- Ligar pro João na terça. 2- Enviar relatório na sexta.` | Agenda para **hoje às 10h** — ignora "terça" e "sexta" do conteúdo |
| 4.6 | `Me lembra às 15h de confirmar a reunião de segunda` | Agenda para **hoje às 15h** — não para segunda |

### 4.3 Criação via conversa (bug corrigido — LLM sem tool)

| # | Fluxo | Esperado |
|---|-------|----------|
| 4.7 | 1. Criar lembrete com horário errado → bot confirma errado<br>2. Responder `"Não, quero para hoje às 16h"` | Bot usa a tool `createReminder` e cria de verdade (checar no Trigger.dev dashboard) |
| 4.8 | `Cria um lembrete para eu ligar pro Lucas amanhã às 8h` | Bot cria via tool sem precisar de regex |

### 4.4 Gerenciamento

| # | Mensagem | Esperado |
|---|----------|----------|
| 4.9 | `Quais são meus lembretes pendentes?` | Lista lembretes com horários via Trigger.dev |
| 4.10 | `Cancela o lembrete de ligar pro João` | Confirma cancelamento do lembrete correto |
| 4.11 | *(aguardar disparo de um lembrete)* | Recebe notificação no WhatsApp no horário exato |

### 4.5 Erros de lembrete

| # | Mensagem | Esperado |
|---|----------|----------|
| 4.12 | `Me lembra de fazer isso` *(sem hora)* | Bot pergunta quando ou responde sem criar lembrete |
| 4.13 | `Me lembra ontem às 10h de algo` | Não cria (data no passado) |

---

## 5. Projetos (Notion)

| # | Mensagem | Esperado |
|---|----------|----------|
| 5.1 | `Mostra todos os projetos` | Lista até 30 projetos |
| 5.2 | `Quais projetos estão atrasados?` | Filtra e lista projetos atrasados |
| 5.3 | `Projetos com prazo próximo` | Lista projetos por deadline |
| 5.4 | `Cria um projeto chamado Teste de API` | Cria no Notion, retorna link |
| 5.5 | `Cria projeto urgente: Migração do servidor` | Cria com urgência Alta |
| 5.6 | `Muda o status do projeto [nome] para Concluído` | Atualiza status no Notion |
| 5.7 | `Me dá os detalhes do projeto [nome]` | Retorna blocos completos do projeto |

---

## 6. Memória

### 6.1 Salvar

| # | Mensagem | Esperado |
|---|----------|----------|
| 6.1 | `salva isso: o cliente preferido é sempre o de São Paulo` | Bot pede título |
| 6.2 | *(após 6.1)* `Preferência de cliente` | "✅ Memorizado com titulo: *Preferência de cliente*" |
| 6.3 | `Me lembra que o Marcos prefere reuniões às terças` | Bot salva via tool de memória |

### 6.2 Recuperar

| # | Mensagem | Esperado |
|---|----------|----------|
| 6.4 | `O que você sabe sobre mim?` | Lista memórias salvas |
| 6.5 | *(pergunta relacionada ao que foi salvo)* | Usa memória no contexto da resposta |

### 6.3 Deletar

| # | Mensagem | Esperado |
|---|----------|----------|
| 6.6 | `Esquece a preferência de cliente` | Confirma deleção da memória |

### 6.4 Erros

| # | Mensagem | Esperado |
|---|----------|----------|
| 6.7 | *(de número sem `can_store_memory`)* `salva isso: algo` | "❌ Você não tem permissão para salvar memórias." |

---

## 7. Documentos PDF

### 7.1 Chat individual — fluxo normal

| # | Ação | Esperado |
|---|------|----------|
| 7.1 | Enviar PDF normal | "📄 Recebi o PDF..." → processa → pede assunto |
| 7.2 | *(após 7.1)* Enviar título `Manual de TI` | "✅ Titulo definido: *Manual de TI*. Documento pronto para consulta!" |
| 7.3 | `O que diz o Manual de TI?` | Busca e retorna trechos do PDF indexado |
| 7.4 | `Lista todos os critérios do PDF` | Retorna conteúdo completo em ordem |

### 7.2 Chat individual — erros

| # | Ação | Esperado |
|---|------|----------|
| 7.5 | Enviar PDF > 25 MB | "❌ O PDF enviado tem mais de 25MB..." |
| 7.6 | Enviar PDF corrompido | "O PDF parece estar corrompido ou em formato inválido..." |
| 7.7 | Enviar PDF de imagem escaneada (sem texto) | "PDF sem texto extraível (pode ser escaneado/imagem)." |
| 7.8 | *(de número sem permissão)* Enviar PDF | "❌ Você não tem permissão para salvar documentos na minha memória." |

### 7.3 Grupo — sem menção

| # | Ação | Esperado |
|---|------|----------|
| 7.9 | No grupo, enviar PDF **sem** mencionar Jarvis | Silêncio total — Jarvis não reage |

### 7.4 Grupo — com menção

| # | Ação | Esperado |
|---|------|----------|
| 7.10 | No grupo, enviar PDF com legenda `@Jarvis analisa esse doc` | Processa o PDF, pede assunto |

---

## 8. Áudio

### 8.1 Chat individual

| # | Ação | Esperado |
|---|------|----------|
| 8.1 | Enviar áudio: *"qual é minha agenda de hoje?"* | Transcreve e responde com agenda |
| 8.2 | Enviar áudio: *"salva isso: prefiro reuniões pela manhã"* | Salva memória com título inferido automaticamente |
| 8.3 | Enviar áudio: *"me lembra amanhã às 9h de ligar pro cliente"* | Cria lembrete via transcrição |

### 8.2 Chat individual — erros

| # | Ação | Esperado |
|---|------|----------|
| 8.4 | Enviar áudio com ruído extremo / inaudível | "❌ Não consegui entender o áudio. Pode tentar de novo?" |

### 8.3 Grupo — sem mencionar Jarvis

| # | Ação | Esperado |
|---|------|----------|
| 8.5 | Áudio no grupo: *"preciso de ajuda com o projeto"* | Silêncio — "Jarvis" não foi mencionado |
| 8.6 | Áudio no grupo: *"alguém viu o relatório?"* | Silêncio |

### 8.4 Grupo — mencionando Jarvis

| # | Ação | Esperado |
|---|------|----------|
| 8.7 | Áudio no grupo: *"Jarvis, qual é a agenda de hoje?"* | Transcreve e responde no grupo |
| 8.8 | Áudio no grupo: *"ei Jarvis, quais projetos estão atrasados?"* | Responde com projetos atrasados |

---

## 9. DRM / Dashboard Comercial

| # | Mensagem | Esperado |
|---|----------|----------|
| 9.1 | `Qual a meta da DRM?` | Retorna dados de meta/atingimento |
| 9.2 | `Pipeline do Bruno Ítalo` | Retorna pipeline quente/morno/frio do gerente |
| 9.3 | `Chamados de CX desta semana` | Retorna dados de Customer Experience |
| 9.4 | `Ranking de gerentes` | Comparação de atingimento entre gerentes |

---

## 10. Gráficos

| # | Mensagem | Esperado |
|---|----------|----------|
| 10.1 | `Me faz um gráfico de pizza dos status dos projetos` | Envia imagem com gráfico de pizza |
| 10.2 | `Gráfico de barras do atingimento por gerente` | Envia gráfico de barras com dados DRM |
| 10.3 | `Matriz de urgência x importância dos projetos` | Envia scatter plot |

---

## 11. Easter Eggs

| # | Mensagem | Esperado |
|---|----------|----------|
| 11.1 | `🦴` | Sticker de cachorro + "Au au! 🐾❤️" |
| 11.2 | `🐱` | Sticker de gato + "Errrrrh.." |
| 11.3 | `🐈` | Mesmo que 11.2 |
| 11.4 | `😺` | Mesmo que 11.2 |

---

## 12. Ajuda

| # | Mensagem | Esperado |
|---|----------|----------|
| 12.1 | `/ajuda` | Retorna lista formatada de comandos disponíveis |

---

## 13. Comportamentos em Grupo

| # | Ação | Esperado |
|---|------|----------|
| 13.1 | Texto no grupo sem mencionar Jarvis | Silêncio |
| 13.2 | Marcar `@Jarvis` via WhatsApp (mention nativo) | Responde normalmente |
| 13.3 | Digitar `@jarvis` no texto (minúsculo) | Responde normalmente |
| 13.4 | Digitar `@ninja` no texto | Responde normalmente |
| 13.5 | Mensagem em grupo **não cadastrado** | Silêncio total |

---

## 14. Rate Limiting

| # | Ação | Esperado |
|---|------|----------|
| 14.1 | Enviar 11 mensagens em < 1 minuto (chat individual) | Na 11ª: "⏳ Você está enviando mensagens rápido demais..." |
| 14.2 | Aguardar 1 minuto após rate limit | Volta a responder normalmente |
| 14.3 | Rate limit em grupo (> 30 msgs/min) | Silêncio no grupo — sem aviso |

---

## 15. Proteções e Erros de Sistema

| # | Ação | Esperado |
|---|------|----------|
| 15.1 | Perguntar agenda com Graph API indisponível | Fallback para banco local — sem crash |
| 15.2 | Perguntar projetos com Notion API fora do ar | Retorna erro amigável do LLM |
| 15.3 | Enviar a mesma mensagem duas vezes (retry) | Processada apenas uma vez (deduplicação por ID) |
| 15.4 | Mensagem com `fromMe=true` (bot enviou) | Ignorada — sem loop infinito |
| 15.5 | Mensagem para `status@broadcast` | Ignorada |
| 15.6 | Payload JSON inválido no webhook | Retorna `400 Invalid payload` |

---

## 16. Checklist de Regressão — Executar a Cada Deploy

- [ ] Bot responde e se identifica como **Jarvis**
- [ ] Bot usa o nome do usuário na resposta
- [ ] Agenda mostra horários em **BRT** (não UTC — verificar reunião com hora conhecida)
- [ ] Lembrete criado aparece no **Trigger.dev dashboard**
- [ ] Lembrete dispara no horário correto
- [ ] PDF individual é indexado e consultável
- [ ] Grupo **não** responde sem menção (texto, áudio e PDF)
- [ ] Grupo **responde** quando mencionado
- [ ] Memória salva e recuperada corretamente

---

## Anotações

| Data | # Teste | Resultado | Observação |
|------|---------|-----------|------------|
| | | | |
