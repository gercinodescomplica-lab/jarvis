import 'dotenv/config';
import { generateText } from 'ai';
import { getModel } from '../src/lib/ai-provider';
import { getWhatsAppSystemPrompt } from '../src/lib/system-prompts';
import { GraphCalendarAdapter } from '../packages/adapters/src/ms-graph';
import { tool, jsonSchema } from 'ai';
import { stepCountIs } from 'ai';

const TEST_MESSAGE = process.argv[2] || 'liste os ultimos emails do ivan';
const MAILBOX = process.env.TEST_MAILBOX || 'gercinoneto@prodam.sp.gov.br';
const SENDER_EMAIL = process.env.TEST_SENDER_EMAIL || '';
const MODE = process.argv[3] || 'llm';

// ── Modo 1: testa se o LLM chama a tool e fica em silêncio depois ────────────
async function testLLM() {
    console.log(`\n📱 Mensagem: "${TEST_MESSAGE}"\n`);
    let toolCalled = false;

    const mockTool = tool({
        description: 'Fetches the last 5 emails FROM a specific person and sends a numbered list via WhatsApp. ALWAYS call this when the user asks to read/see/check emails from someone. When this tool returns success, respond ONLY with an empty string.',
        inputSchema: jsonSchema<{ nomeRemetente: string }>({
            type: 'object',
            properties: { nomeRemetente: { type: 'string' } },
            required: ['nomeRemetente'],
            additionalProperties: false,
        }),
        execute: async (args) => {
            toolCalled = true;
            console.log(`✅ Tool chamada: nomeRemetente="${args.nomeRemetente}"`);
            return { success: true, message: '' };
        },
    });

    const result = await generateText({
        model: getModel(),
        system: getWhatsAppSystemPrompt('', 'Gercino'),
        messages: [{ role: 'user', content: TEST_MESSAGE }],
        tools: { listarEmailsRemetente: mockTool },
        stopWhen: stepCountIs(3),
    });

    console.log('\n─────────────────────────────────');
    console.log(toolCalled ? '✅ Tool chamada' : '❌ Tool NÃO foi chamada');
    console.log(`💬 Resposta do LLM: "${result.text}" ${result.text ? '← PROBLEMA: deveria estar em branco' : '← OK (silêncio)'}`);
    console.log('─────────────────────────────────\n');
}

// ── Modo 2: testa fetch do Graph (IDs + ordem) ───────────────────────────────
async function testGraph() {
    const senderEmail = SENDER_EMAIL;
    if (!senderEmail) {
        console.error('❌ Defina TEST_SENDER_EMAIL no .env');
        process.exit(1);
    }

    console.log(`\n📬 Buscando emails de ${senderEmail} na caixa ${MAILBOX}...\n`);
    const adapter = new GraphCalendarAdapter();
    const emails = await adapter.getEmailsForUser(MAILBOX, {
        fromSenders: [senderEmail],
        top: 50,
    });

    const top5 = emails.slice(0, 5);
    console.log(`${emails.length} emails encontrados, mostrando os 5 mais recentes:\n`);
    top5.forEach((e: any, i: number) => {
        const hasId = !!e.id;
        console.log(`${i + 1}. [id:${hasId ? '✅' : '❌ FALTANDO'}] ${e.subject?.slice(0, 50)} — ${e.receivedDateTime?.slice(0, 10)}`);
    });

    if (!top5[0]?.id) {
        console.error('\n❌ IDs não estão vindo do Graph — checar $select');
    }
}

// ── Modo 3: testa o resumo de um email específico ────────────────────────────
async function testSummary() {
    const senderEmail = SENDER_EMAIL;
    if (!senderEmail) {
        console.error('❌ Defina TEST_SENDER_EMAIL no .env');
        process.exit(1);
    }

    const adapter = new GraphCalendarAdapter();
    const emails = await adapter.getEmailsForUser(MAILBOX, {
        fromSenders: [senderEmail],
        top: 50,
    });

    const email = emails[0];
    if (!email?.id) {
        console.error('❌ Nenhum email encontrado ou ID ausente');
        process.exit(1);
    }

    console.log(`\n📧 Resumindo: "${email.subject}"\n`);
    const full = await adapter.getFullEmail(MAILBOX, email.id);
    const body = (full.body?.content || full.bodyPreview || '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);

    const result = await generateText({
        model: getModel(),
        system: 'Resuma o email abaixo em português. Bullet points. Máximo 5 itens. Destaque ações necessárias.',
        messages: [{ role: 'user', content: `Assunto: ${full.subject}\n\n${body}` }],
    });

    console.log('─────────────────────────────────');
    console.log(`📧 *${full.subject}*`);
    console.log(`_De: ${full.from?.emailAddress?.name} • ${new Date(full.receivedDateTime).toLocaleDateString('pt-BR')}_\n`);
    console.log(result.text);
    console.log('─────────────────────────────────\n');
}

const modes: Record<string, () => Promise<void>> = { llm: testLLM, graph: testGraph, summary: testSummary };
(modes[MODE] || testLLM)().catch(console.error);
