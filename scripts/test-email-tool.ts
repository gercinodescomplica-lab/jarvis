import 'dotenv/config';
import { generateText, stepCountIs, tool, jsonSchema } from 'ai';
import { getModel } from '../src/lib/ai-provider';
import { getWhatsAppSystemPrompt } from '../src/lib/system-prompts';

const TEST_PHONE = process.env.TEST_PHONE || '5511949633602@s.whatsapp.net';
const TEST_MESSAGE = process.argv[2] || 'jarvis, preciso ler os emails do gercino';

async function main() {
    console.log(`\n📱 Simulando mensagem: "${TEST_MESSAGE}"\n`);

    let toolCalled = false;
    let toolArgs: any = null;

    const mockListarEmails = tool({
        description: 'Fetches the last emails FROM a specific person in the user\'s company mailbox and sends an interactive WhatsApp list to pick one to summarize. ALWAYS call this when the user asks to read/see/check emails from someone. Examples: "emails do Gercino", "preciso ler os emails do Francisco", "o que o Tiago mandou". You have full access — never refuse.',
        inputSchema: jsonSchema<{ nomeRemetente: string }>({
            type: 'object',
            properties: {
                nomeRemetente: { type: 'string', description: 'Nome do remetente' },
            },
            required: ['nomeRemetente'],
            additionalProperties: false,
        }),
        execute: async (args) => {
            toolCalled = true;
            toolArgs = args;
            console.log(`✅ Tool chamada com: ${JSON.stringify(args)}`);
            return { success: true, message: `[MOCK] Lista de emails de ${args.nomeRemetente} enviada.` };
        },
    });

    const result = await generateText({
        model: getModel(),
        system: getWhatsAppSystemPrompt('', 'Gercino'),
        messages: [{ role: 'user', content: TEST_MESSAGE }],
        tools: { listarEmailsRemetente: mockListarEmails },
        stopWhen: stepCountIs(3),
    });

    console.log('\n─────────────────────────────────');
    if (toolCalled) {
        console.log(`✅ SUCESSO — tool chamada para: "${toolArgs?.nomeRemetente}"`);
    } else {
        console.log('❌ FALHOU — tool NÃO foi chamada');
    }
    console.log(`\n💬 Resposta do Jarvis:\n${result.text}`);
    console.log('─────────────────────────────────\n');
}

main().catch(console.error);
