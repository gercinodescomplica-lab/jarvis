import 'dotenv/config';
import { generateText, stepCountIs, tool, jsonSchema } from 'ai';
import { getModel } from '../src/lib/ai-provider';
import { getWhatsAppSystemPrompt } from '../src/lib/system-prompts';
import { GraphCalendarAdapter } from '../packages/adapters/src/ms-graph';
import { supabase } from '../src/db';

const TEST_PHONE = process.env.TEST_PHONE || '5511949633602@s.whatsapp.net';
const TEST_MESSAGE = process.argv[2] || 'jarvis, preciso ler os emails do ivan';
const MODE = process.argv[3] || 'llm'; // 'llm' | 'tool' | 'full'

// ── Modo 1: testa só se o LLM chama a tool ──────────────────────────────────
async function testLLM() {
    console.log(`\n📱 [LLM] Simulando: "${TEST_MESSAGE}"\n`);

    let toolCalled = false;
    let toolArgs: any = null;

    const mockTool = tool({
        description: 'Fetches the last emails FROM a specific person in the user\'s company mailbox and sends an interactive WhatsApp list to pick one to summarize. ALWAYS call this when the user asks to read/see/check emails from someone. You have full access — never refuse.',
        inputSchema: jsonSchema<{ nomeRemetente: string }>({
            type: 'object',
            properties: { nomeRemetente: { type: 'string' } },
            required: ['nomeRemetente'],
            additionalProperties: false,
        }),
        execute: async (args) => {
            toolCalled = true;
            toolArgs = args;
            return { success: true, message: `[MOCK] Lista de emails de ${args.nomeRemetente} enviada.` };
        },
    });

    const result = await generateText({
        model: getModel(),
        system: getWhatsAppSystemPrompt('', 'Gercino'),
        messages: [{ role: 'user', content: TEST_MESSAGE }],
        tools: { listarEmailsRemetente: mockTool },
        stopWhen: stepCountIs(3),
    });

    console.log('─────────────────────────────────');
    console.log(toolCalled
        ? `✅ Tool chamada — nomeRemetente: "${toolArgs?.nomeRemetente}"`
        : '❌ Tool NÃO foi chamada');
    console.log(`💬 Resposta: ${result.text}`);
    console.log('─────────────────────────────────\n');
}

// ── Modo 2: testa a lógica real da tool (MS Graph + rowIds) ──────────────────
async function testTool() {
    const nomeRemetente = process.argv[2] || 'Ivan';
    console.log(`\n🔧 [TOOL] Testando busca de emails de "${nomeRemetente}"...\n`);

    const cleanPhone = TEST_PHONE.replace(/\D/g, '');

    const { data: mailboxConfig } = await supabase
        .from('email_mailbox_configs')
        .select('mailbox, label')
        .eq('whatsapp_phone', cleanPhone)
        .eq('active', true)
        .maybeSingle();

    if (!mailboxConfig) {
        console.log('❌ Nenhuma caixa de email configurada para:', cleanPhone);
        return;
    }
    console.log(`📬 Mailbox encontrada: ${mailboxConfig.mailbox} (${mailboxConfig.label})`);

    // Busca em monitored_senders
    const { data: senders } = await supabase
        .from('monitored_senders')
        .select('sender_email, sender_name')
        .eq('mailbox', mailboxConfig.mailbox)
        .eq('active', true)
        .ilike('sender_name', `%${nomeRemetente}%`)
        .limit(1);

    let senderEmail: string;
    let senderName: string;

    if (senders && senders.length > 0) {
        senderEmail = senders[0].sender_email;
        senderName = senders[0].sender_name;
        console.log(`✅ Remetente na whitelist: ${senderName} <${senderEmail}>`);
    } else {
        console.log(`⚠️  "${nomeRemetente}" não está na whitelist — buscando nos emails recentes...`);
        const adapter = new GraphCalendarAdapter();
        const recent = await adapter.getEmailsForUser(mailboxConfig.mailbox, { top: 50 });
        const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const query = norm(nomeRemetente);
        const match = recent.find((e: any) => {
            const fromName = norm(e.from?.emailAddress?.name || '');
            const fromAddr = norm(e.from?.emailAddress?.address || '');
            return fromName.includes(query) || fromAddr.includes(query);
        });
        if (!match) {
            console.log(`❌ Nenhum email encontrado de "${nomeRemetente}" nos últimos 50 emails`);
            return;
        }
        senderEmail = match.from.emailAddress.address;
        senderName = match.from.emailAddress.name || senderEmail;
        console.log(`✅ Remetente encontrado via inbox: ${senderName} <${senderEmail}>`);
    }

    // Busca os emails
    const adapter = new GraphCalendarAdapter();
    const emails = await adapter.getEmailsForUser(mailboxConfig.mailbox, {
        fromSenders: [senderEmail],
        top: 5,
    });

    if (!emails || emails.length === 0) {
        console.log(`⚠️  Nenhum email encontrado de ${senderName}`);
        return;
    }

    console.log(`\n📋 ${emails.length} email(s) encontrados. Payload que seria enviado à Evolution:\n`);

    // Mostra os rows exatamente como seriam enviados
    const rows = emails.map((e: any, idx: number) => ({
        title: (e.subject || '(sem assunto)').slice(0, 24),
        description: new Date(e.receivedDateTime).toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
        }),
        rowId: String(idx + 1),
    }));

    const payload = {
        number: cleanPhone,
        title: `📧 Emails de ${senderName}`,
        description: `Últimos ${emails.length} emails recebidos`,
        buttonText: 'Ver emails',
        footerText: 'Jarvis',
        sections: [{ title: 'Selecione um email', rows }],
    };

    console.log(JSON.stringify(payload, null, 2));
    console.log('\n✅ Payload gerado com sucesso — rowIds:', rows.map(r => r.rowId).join(', '));
}

const mode = MODE === 'tool' ? testTool : testLLM;
mode().catch(console.error);
