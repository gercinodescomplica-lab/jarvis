# Jarvis
### O assistente executivo que vive no seu WhatsApp

---

## O Problema

Diretores e gestores perdem horas por dia em tarefas que deveriam ser instantâneas:

- Abrir 4 sistemas diferentes para responder uma pergunta simples
- Procurar manualmente qual contrato vence esse mês
- Lembrar de agendar follow-ups após reuniões
- Buscar um PDF enviado há semanas para recuperar uma informação
- Checar agenda, projetos e emails em ferramentas separadas

**O tempo de um gestor vale caro demais para ser gasto em navegação de sistemas.**

---

## A Solução

**Jarvis** é um assistente executivo de IA disponível diretamente no WhatsApp — o app que o gestor já usa o dia inteiro.

Sem novo app para instalar. Sem nova senha para lembrar. Sem treinamento.

Basta mandar uma mensagem — ou um áudio.

---

## Como Funciona

```
Gestor: "Qual contrato vence esse mês?"
Jarvis:  "2 contratos vencem em abril:
          • SEGES — R$ 45,1 mi — vence 30/04
          • SGM   — R$ 25,7 mi — vence 30/04"

Gestor: "Me lembra de ligar pro SEGES na sexta às 9h"
Jarvis:  "⏰ Lembrete criado! Te aviso sexta às 09:00."

Gestor: [envia áudio de 2 minutos]
Jarvis:  "🎤 Transcrição: [texto]
          Entendido — vou salvar isso na memória."
```

---

## Integrações Nativas

| Sistema | O que o Jarvis acessa |
|---|---|
| **WhatsApp** | Canal principal — texto, áudio, PDFs |
| **Notion** | Projetos, tarefas, status, prazos |
| **Microsoft 365** | Agenda, reuniões, emails |
| **Sistema de Contratos** | Valores, vencimentos, gerentes, objetos |
| **Dashboard Comercial (DRM)** | Metas, forecast, pipeline, CX |
| **Documentos (PDF)** | Indexação e busca semântica de conteúdo |

---

## Capacidades

**Contratos**
Quantos vencem esse mês? Qual o maior saldo a receber? Quem é o responsável pelo contrato da PGM? Qual o objeto?

**Projetos**
Quais projetos estão atrasados? Cria uma tarefa no Notion. Qual o status do projeto X?

**Agenda**
O que tenho hoje? Quando é minha próxima reunião com a SMS?

**Emails**
Mostra os últimos emails do Paulo. Resume o email da prefeitura.

**Memória**
Salva isso: decisão tomada na reunião de hoje. Lembra o que ficamos de fazer sobre o contrato SMUL?

**Lembretes**
Me lembra de enviar o relatório amanhã às 8h. Me avisa quando chegar sexta.

**Documentos**
Busca no contrato da FMS a cláusula de reajuste. Resume o PDF que enviei.

---

## Diferenciais

**Contexto persistente**
O Jarvis lembra do que foi dito em conversas anteriores. Você não precisa repetir contexto a cada pergunta.

**Voz nativa**
Fala em vez de digitar. O Jarvis transcreve, entende e responde — sem fricção.

**Dados sempre corretos**
Não chuta. Cada resposta vem de uma fonte real — API, banco de dados ou documento indexado. Se não tiver certeza, avisa.

**Funciona em grupos**
Adicione o Jarvis em grupos do WhatsApp. Ele responde quando mencionado (`@Jarvis`).

**Lembretes inteligentes**
"Me lembra de assinar o aditivo do contrato SMADS na terça às 14h" — e o Jarvis dispara o aviso na hora certa, mesmo que o servidor esteja inativo.

---

## Arquitetura

```
WhatsApp (Evolution API)
        │
        ▼
   Next.js API (Vercel)
        │
        ├── Claude (Anthropic) ←── raciocínio e linguagem
        │
        ├── Supabase ←── memória, histórico, documentos
        │
        ├── Trigger.dev ←── lembretes, agendamentos, crons
        │
        ├── Google Speech ←── transcrição de áudio
        │
        └── APIs externas ←── contratos, DRM, Notion, MS Graph
```

Serverless, escalável, zero manutenção de infraestrutura.

---

## Casos de Uso Reais

> *"Quantos contratos vencem nos próximos 90 dias?"*
> → 22 contratos, R$ 95 mi em risco de renovação — em 3 segundos.

> *"Qual gerência tem mais contratos?"*
> → GRC-4: 32 contratos. GRC-3: 20. GRC-2: 14 — ranking completo.

> *"Me lembra de ligar pro SEGES antes do vencimento"*
> → Lembrete criado para 28/04 às 09:00.

> *[envia PDF de 40 páginas]*
> → Indexado. "Qual a cláusula de penalidade?" → responde com a página exata.

---

## Estado Atual

- ✅ WhatsApp operacional (texto + áudio + PDF)
- ✅ Contratos integrados com analytics pré-computado
- ✅ Projetos Notion integrados
- ✅ Agenda Microsoft Graph integrada
- ✅ Emails Microsoft 365 integrados
- ✅ Memória semântica persistente
- ✅ Lembretes com disparo real via Trigger.dev
- ✅ Indexação e busca de PDFs
- ✅ Grupos WhatsApp com menção

---

## Próximos Passos

- [ ] Dashboard de analytics web para contratos
- [ ] Alertas proativos de vencimento (sem precisar perguntar)
- [ ] Integração com sistema de assinatura digital
- [ ] App mobile próprio (canal alternativo ao WhatsApp)
- [ ] Multi-tenant (outras diretorias / órgãos)

---

## Por que Agora

LLMs chegaram ao ponto onde entendem contexto, chamam APIs e raciocinam sobre dados reais — sem alucinação quando bem configurados.

WhatsApp tem 98% de penetração no Brasil. É o único app que todos abrem, o dia todo.

A combinação de IA + canal já instalado + dados reais cria um assistente que **realmente substitui trabalho manual** — não é um chatbot de FAQ.

---

*Jarvis — construído para quem não tem tempo a perder.*
