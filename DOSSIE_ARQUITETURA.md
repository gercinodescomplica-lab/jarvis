# Dossiê de Arquitetura: Jarvis

Este documento apresenta uma visão detalhada da arquitetura atual do sistema **Jarvis**, incluindo estrutura de pacotes (monorepo), mapeamento de rotas de API e integrações externas.

---

## 🏗 Visão Geral (Architecture)

O Jarvis é construído utilizando o padrão de **Monorepo** focado em desacoplamento de responsabilidades organizadas em espaços de trabalho (`workspaces`) do NPM/Yarn. O *frontend* e *controladores* principais vivem numa aplicação Next.js (App Router), enquanto o domínio da aplicação vive em pacotes separados.

Isso previne ciclos de dependência e permite que regras de negócio rodem puramente em Node, separadas da camada Web (Next.js).

---

## 📦 Estrutura Monorepo (Packages)

A base de código se divide nos seguintes pacotes:

1.  **`@jarvis/web` (Next.js Application)**
    - **Caminho:** `.` & `src/` (Raiz do projeto)
    - **Contexto:** Camada de apresentação e orquestração de APIs (API Routes).
    - **Responsabilidade:** Renderizar a interface rica em React (+ Tailwind + Radix + ShadCN) e expor endpoints REST para integrações via Webhook e consumo interno do Client-side.

2.  **`@jarvis/core`**
    - **Caminho:** `packages/core`
    - **Contexto:** Entidades centrais e Regras de Negócio (Domain Layer).
    - **Responsabilidade:** Fornecer interfaces estruturais agnósticas (que não dependem de frameworks externos).

3.  **`@jarvis/adapters`**
    - **Caminho:** `packages/adapters`
    - **Contexto:** Camada de persistência e comunicação (Infrastructure Layer).
    - **Responsabilidade:** Contém a implementação de clientes para infraestruturas ou APIs externas (como Notion HQ, PostgreSQL). Depende diretamente do `@jarvis/core`.

4.  **`@jarvis/shared`**
    - **Caminho:** `packages/shared`
    - **Contexto:** Tipagens, Utilitários e Helpers globais.
    - **Responsabilidade:** Impedir a duplicação de funções genéricas ou tipos e schemas (Zod) que são utilizados tanto pela engine do Next.js quanto pelos outros pacotes.

---

## 🛣 Mapeamento de Rotas (Next.js API)

Todas as rotas de servidor encontram-se no diretório `src/app/api/`.

### ⚡ Rotas de Inteligência Artificial & Áudio
*   **`POST /api/chat`**
    - Processa as interações de chat de UI via interface React usando o Vercel AI SDK (`@ai-sdk`).
*   **`POST /api/jarvis/query`**
    - Rota centralizada de inferência do modelo do Jarvis. Orquestrador para ferramentas via function calling (OpenAI).
*   **`POST /api/tts`** (Text-to-Speech)
    - Gera áudio a partir de texto utilizando a integração do `@google-cloud/text-to-speech`.
*   **`POST /api/stt`** (Speech-to-Text)
    - Transcreve áudios enviados para o backend de volta para texto (possivelmente utilizando Whisper/OpenAI).

### 🤖 Rotas de Bots & Webhooks
*   **`POST /api/telegram`**
    - Webhook do Bot do Telegram, responsável por capturar inputs de texto/áudio originados do App do Telegram, instanciar a IA do Jarvis e devolver a resposta via mensagem normal ou áudio.
*   **`POST /api/cron/calendar-bot`**
    - Rota agendada (Cron Job) que engatilha bots que analisam o calendário proativamente para ações ou alertas.
*   **`POST /api/webhooks/calendar`**
    - Webhook que recebe Push Notifications/Eventos das instâncias de calendário (Microsoft Graph).

### 🗄 Dados REST Internos
*   **`/api/users`** -> Gestão de Entidades de Usuário.
*   **`/api/projects`** ->  Gestão de Entidades de Projetos.
*   **`/api/calendar`** -> Orquestração de acessos as APIs de Agendas.

---

## 🔌 Principais Integrações & Dependências

### Stack de UI/Frontend
*   **Framework Base:** Next.js 16 (App Router) e React 19.
*   **Estilização:** TailwindCSS v4 com Tailwind-Merge.
*   **Componentes:** Radix UI (`@radix-ui/react-slot`, `react-switch`), Lucide React (Ícones), Lottie (Animações).

### Serviços Externos
*   **OpenAI (`openai`, `@ai-sdk/openai`):** Engine principal de processamento cognitivo do Jarvis.
*   **Google Cloud TTS (`@google-cloud/text-to-speech`):** Utilizada no pacote web para sintetizar o áudio das repostas da IA.
*   **Microsoft Azure (`@azure/identity`, `@microsoft/microsoft-graph-client`):** Utilizado para integração com suíte Microsoft (Outlook/Teams/Graph).
*   **Notion (`@notionhq/client`):** Driver oficial do Notion, localizado dentro da camada local `@jarvis/adapters`.
*   **Telegram:** Orquestrado sob os endpoints da Vercel.

### Banco de Dados e Criptografia
*   **PostgreSQL (`postgres`):** Driver leve de SQL cru contido na camada de adapters.
*   **Jose (`jose`):** Implementação JSON Web Tokens, assinaturas de segurança para rotas da API.

---

## 📌 Parecer do Arquiteto & Recomendações

1. **Documentação Viva (Living OpenAPI):** Atualmente não há garantias em tempo de build de que essa documentação reflete a realidade das rotas. Sugere-se fortemente a adoção de **tRPC** ou `next-swagger-doc` para que o próprio Typescript/Zod seja responsável por gerar uma documentação automática (Swagger).
2. **Segurança de Cron e Webhooks:** As rotas `api/cron/*` e `api/webhooks/*` precisam garantir a checagem rigorosa de headers (Ex: `Authorization` Bearer Token para as crons e validação de `x-telegram-bot-api-secret-token` com HMAC).
3. **Escopo de Responsabilidade de Adapters:** Manter o `@google-cloud/text-to-speech` e a API da `openai` estritamente na aplicação *web* acentua a dependência da cloud no frontend. Recomenda-se descer todos os provedores externos para a camada interna de `@jarvis/adapters` para garantir abstração isolada (Clean Architecture).
