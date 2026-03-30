import { tool, jsonSchema } from 'ai';
import { createLogger } from '@/lib/logger';

const logger = createLogger('tools');
import { cachedTool } from '@/lib/tool-middleware';
import { NotionService } from '@/lib/notion-service';
import { CalendarDB } from '@/lib/calendar-db';
import { GraphCalendarAdapter } from '@jarvis/adapters/src/ms-graph';
import { fetchDRMData, formatDRMContext } from '@/lib/drm-service';
import { supabase } from '@/db';
import { saveMemory, getMemoryContext } from '@/lib/memory-service';
import { configure, runs } from '@trigger.dev/sdk/v3';

// ─── Tools com CACHE (leitura) ───────────────────────────────────────────────
// Cada uma tem um TTL diferente baseado em quão rápido os dados mudam.

export const searchProjects = cachedTool({
    name: 'searchProjects',
    cacheTtlMs: 5 * 60 * 1000, // 5 minutos — projetos mudam moderadamente
    description: 'Search for projects or tasks in Notion. Use query="*" or query="todos" to list ALL projects. Use specific keywords to filter by name, status, urgency, etc.',
    inputSchema: jsonSchema<{ query: string }>({
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query. Use "*" or "todos" to list all projects. Or filter by keyword, status (e.g. "atrasado"), urgency, etc.'
            }
        },
        required: ['query'],
        additionalProperties: false,
    }),
    execute: async ({ query }) => {
        const lq = query.toLowerCase().trim();
        if (!lq || lq === '*' || lq === 'todos' || lq === 'all' || lq === 'tudo' || lq === 'todos projetos' || lq === 'listar') {
            const all = await NotionService.getAllProjects();
            return all.slice(0, 30);
        }
        if (lq.includes('atrasad')) {
            return await NotionService.getOverdueProjects();
        }
        if (lq.includes('prazo') || lq.includes('entrega')) {
            return await NotionService.getUpcomingDeadlines();
        }
        const results = await NotionService.searchProjects(query);
        if (results.length === 0) {
            const all = await NotionService.getAllProjects();
            return all.slice(0, 30);
        }
        return results.slice(0, 15);
    },
});

export const getCalendarEvents = cachedTool({
    name: 'getCalendarEvents',
    cacheTtlMs: 5 * 60 * 1000, // 5 minutos — agenda muda moderadamente
    description: 'Get upcoming calendar events and meetings from Microsoft Graph. You can specify a user email or name. Users available: tiagoluz@prodam.sp.gov.br (Tiago), danielleoliveira@prodam.sp.gov.br (Danielle), gercinoneto@prodam.sp.gov.br (Gercino). Use this tool also when asked for available times (free slots) or meetings with specific people, and calculate the results based on the returned events and their attendees. Assume working hours from 09:00 to 18:00.\n\nCRITICAL: You MUST explicitly set the "days" parameter based on the user\'s timeframe (e.g., set days to 30 or 31 if they ask for "next month", 7 for "next week", 1 for "today"). Otherwise, it defaults to 7 days and you will return incomplete/wrong data.',
    inputSchema: jsonSchema<{ days: number, userName?: string }>({
        type: 'object',
        properties: {
            days: {
                type: 'number',
                description: 'Number of days to look ahead based on user prompt (e.g. 30 for a month, 7 for a week, 1 for today). You MUST provide this.'
            },
            userName: {
                type: 'string',
                description: 'Name or email of the person to check (e.g. "Tiago", "Danielle", "Gercino").'
            }
        },
        required: ['days'],
        additionalProperties: false,
    }),
    execute: async ({ days = 7, userName }) => {
        try {
            const adapter = new GraphCalendarAdapter();
            const configEmails = process.env.GRAPH_USER_EMAILS?.split(',') || [];

            let targetEmails = configEmails;

            if (userName) {
                const lowerName = userName.toLowerCase();
                if (lowerName.includes('tiago')) targetEmails = ['tiagoluz@prodam.sp.gov.br'];
                else if (lowerName.includes('danielle') || lowerName.includes('dani')) targetEmails = ['danielleoliveira@prodam.sp.gov.br'];
                else if (lowerName.includes('gercino') || lowerName.includes('neto')) targetEmails = ['gercinoneto@prodam.sp.gov.br'];
                else if (userName.includes('@')) targetEmails = [userName];
            }

            const results = await adapter.getEventsForUsers(targetEmails, days);
            const allEvents = results.flatMap(r => r.events || []);

            if (allEvents.length === 0) {
                const start = new Date();
                start.setHours(0, 0, 0, 0);
                const end = new Date();
                end.setDate(end.getDate() + days);
                return await CalendarDB.getEvents(start, end);
            }

            return allEvents;
        } catch (error) {
            logger.error(" Graph API error, falling back to local DB:", error);
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setDate(end.getDate() + days);
            return await CalendarDB.getEvents(start, end);
        }
    },
});

export const getProjectDetails = cachedTool({
    name: 'getProjectDetails',
    cacheTtlMs: 10 * 60 * 1000, // 10 minutos — detalhes de um projeto mudam pouco
    description: 'Get detailed content/blocks of a specific project.',
    inputSchema: jsonSchema<{ id: string }>({
        type: 'object',
        properties: {
            id: { type: 'string', description: 'The UUID of the project' },
        },
        required: ['id'],
        additionalProperties: false,
    }),
    execute: async ({ id }) => {
        const details = await NotionService.getProjectDetails(id);
        return { details };
    }
});

export const getDRMData = cachedTool({
    name: 'getDRMData',
    cacheTtlMs: 30 * 60 * 1000, // 30 minutos — dados comerciais mudam pouco durante o dia
    description: `Busca dados comerciais em tempo real do Dashboard DRM (Diretoria Regional de Mercado).
Use esta ferramenta SEMPRE que o usuário perguntar sobre:
- Metas, contratado, forecast ou atingimento (geral ou de um gerente específico)
- Carteira de clientes de um gerente (servedClients)
- Pipeline de projetos (quente, morno, frio) por gerente ou trimestre (Q1/Q2/Q3/Q4)
- Chamados de Customer Experience (CX)
- Visitas comerciais
- Ranking ou comparação entre gerentes
- Qualquer dado da DRM ou dashboard comercial`,
    inputSchema: jsonSchema<{ query: string; managerName?: string }>({
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'A pergunta original do usuário sobre dados comerciais.'
            },
            managerName: {
                type: 'string',
                description: 'Nome do gerente específico, se mencionado (ex: "Bruno Ítalo", "Paulo"). Omitir para dados gerais.'
            }
        },
        required: ['query'],
        additionalProperties: false,
    }),
    execute: async ({ query, managerName }) => {
        const drmData = await fetchDRMData();
        const effectiveQuery = managerName ? `${query} ${managerName}` : query;
        return {
            success: true,
            context: formatDRMContext(drmData, effectiveQuery),
            summary: drmData.summary,
            managersCount: drmData.data.length,
            timestamp: drmData.timestamp,
        };
    }
});

export const analyzeProjects = cachedTool({
    name: 'analyzeProjects',
    cacheTtlMs: 5 * 60 * 1000, // 5 minutos
    description: 'Analyze project data to generate metrics, charts, or comparisons. queries: "status overview", "risk analysis", "urgency matrix".',
    inputSchema: jsonSchema<{ dimension: string, chartType?: string }>({
        type: 'object',
        properties: {
            dimension: { type: 'string', description: 'The dimension to analyze (status, importance, urgency, risk)' },
            chartType: { type: 'string', description: 'Recommended chart type (bar, pie, scatter) - defaults to bar' },
        },
        required: ['dimension'],
        additionalProperties: false,
    }),
    execute: async ({ dimension, chartType }) => {
        const safeChartType = chartType || 'bar';
        const projects = await NotionService.getAllProjects();

        if (safeChartType === 'scatter') {
            const mapScore = (str: string) => {
                const s = str?.toLowerCase() || '';
                if (s.includes('alta') || s.includes('crítica') || s.includes('alto')) return 9;
                if (s.includes('média') || s.includes('médio')) return 5;
                return 2;
            };

            return {
                type: 'scatter',
                title: `Matriz: Importância x Urgência`,
                data: projects.map(p => ({
                    name: p.title,
                    x: mapScore(p.importance),
                    y: mapScore(p.urgency),
                    z: 100,
                    status: p.status
                }))
            };
        }

        const distribution: Record<string, number> = {};
        projects.forEach(p => {
            const key = (p as any)[dimension] || 'Unknown';
            distribution[key] = (distribution[key] || 0) + 1;
        });

        const data = Object.entries(distribution).map(([name, value]) => ({ name, value }));

        return {
            type: safeChartType,
            title: `Distribuição por ${dimension}`,
            data
        };
    }
});

export const searchDocuments = cachedTool({
    name: 'searchDocuments',
    cacheTtlMs: 10 * 60 * 1000, // 10 minutos — documentos salvos mudam raramente
    description: `Busca em documentos e PDFs que foram enviados e salvos na base de conhecimento.
Use SEMPRE que o usuário perguntar sobre conteúdo de documentos, relatórios, PDFs, ou qualquer arquivo enviado (ex: GRI, relatório, contrato, manual).
Exemplos: "o que é GRI?", "o que diz o relatório X?", "me fala sobre o documento Y".
IMPORTANTE: Se o usuário pedir para LISTAR TODOS os critérios/itens/seções de um documento específico, use getDocumentContent em vez desta ferramenta.`,
    inputSchema: jsonSchema<{ query: string }>({
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Termos a buscar no conteúdo dos documentos. Use palavras-chave relevantes.'
            }
        },
        required: ['query'],
        additionalProperties: false,
    }),
    execute: async ({ query }) => {
        const terms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
        const safeTerms = terms.map((t: string) => t.replace(/[%_]/g, '\\$&'));
        const ilikeFilter = safeTerms.map((t: string) => `content.ilike.%${t}%`).join(',');

        const { data: chunks, error } = await supabase
            .from('document_chunks')
            .select('content, document_title')
            .or(ilikeFilter)
            .limit(20);

        if (error) throw error;

        if (!chunks || chunks.length === 0) {
            const { data: docs } = await supabase
                .from('documents')
                .select('filename, description')
                .or(terms.map((t: string) => `description.ilike.%${t}%,filename.ilike.%${t}%`).join(','))
                .limit(5);

            if (!docs || docs.length === 0) {
                return { found: false, message: 'Nenhum documento encontrado com esses termos.' };
            }
            return { found: true, documents: docs, chunks: [] };
        }

        const grouped: Record<string, string[]> = {};
        for (const c of chunks) {
            const title = c.document_title || 'Sem título';
            if (!grouped[title]) grouped[title] = [];
            grouped[title].push(c.content);
        }

        return {
            found: true,
            results: Object.entries(grouped).map(([title, contents]) => ({
                document: title,
                excerpts: contents,
            })),
        };
    }
});

export const getDocumentContent = cachedTool({
    name: 'getDocumentContent',
    cacheTtlMs: 10 * 60 * 1000,
    description: `Retorna o conteúdo COMPLETO de um documento específico, em ordem, sem limite de trechos.
Use quando o usuário pedir para LISTAR TODOS os itens, critérios, seções, ou requisitos de um documento.
Exemplos: "lista todos os critérios do PDF", "me dá todos os requisitos da POC", "quais são todos os itens do edital?".`,
    inputSchema: jsonSchema<{ documentName: string }>({
        type: 'object',
        properties: {
            documentName: {
                type: 'string',
                description: 'Nome ou parte do nome do documento (ex: "POC", "GRI", "edital"). Não precisa ser exato.'
            }
        },
        required: ['documentName'],
        additionalProperties: false,
    }),
    execute: async ({ documentName }) => {
        const safeName = documentName.replace(/[%_]/g, '\\$&');

        // Busca o documento pelo nome
        const { data: docs } = await supabase
            .from('documents')
            .select('id, filename, description')
            .or(`filename.ilike.%${safeName}%,description.ilike.%${safeName}%`)
            .limit(3);

        let documentId: string | null = null;
        let documentTitle: string | null = null;

        if (docs && docs.length > 0) {
            documentId = docs[0].id;
            documentTitle = docs[0].filename;
        }

        // Busca todos os chunks do documento (por ID ou por título)
        let query = supabase
            .from('document_chunks')
            .select('content, chunk_index, document_title')
            .order('chunk_index', { ascending: true })
            .limit(200);

        if (documentId) {
            query = query.eq('document_id', documentId);
        } else {
            query = query.ilike('document_title', `%${safeName}%`);
        }

        const { data: chunks, error } = await query;

        if (error) throw error;

        if (!chunks || chunks.length === 0) {
            return { found: false, message: `Nenhum documento encontrado com o nome "${documentName}". Tente searchDocuments para buscar por conteúdo.` };
        }

        return {
            found: true,
            document: documentTitle || chunks[0].document_title || documentName,
            totalChunks: chunks.length,
            content: chunks.map(c => c.content).join('\n\n'),
        };
    }
});

export const searchNotion = cachedTool({
    name: 'searchNotion',
    cacheTtlMs: 3 * 60 * 1000, // 3 minutos
    description: `Busca em todo o workspace do Notion (páginas, databases, notas, documentos).
Use quando o usuário perguntar sobre qualquer conteúdo no Notion que não seja especificamente o banco de projetos DRM.
Exemplos: "quantas páginas tenho no notion?", "tem algo sobre X no notion?", "encontra a página Y".`,
    inputSchema: jsonSchema<{ query: string }>({
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Termo a buscar no Notion. Use "*" ou "" para listar tudo.' }
        },
        required: ['query'],
        additionalProperties: false,
    }),
    execute: async ({ query }) => {
        const results = await NotionService.searchAll(query || '');
        return { count: results.length, results };
    },
});

// ─── Tools SEM CACHE (escrita) ───────────────────────────────────────────────
// Operações que criam/modificam dados nunca devem ser cacheadas.

export const createProject = tool({
    description: 'Create a new project or task in Notion.',
    inputSchema: jsonSchema<{
        title: string;
        importance?: 'Alta' | 'Média' | 'Baixa';
        urgency?: 'Alta' | 'Média' | 'Baixa';
        deadline?: string;
        risk?: 'Alto' | 'Médio' | 'Baixo';
    }>({
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Title of the task/project' },
            importance: { type: 'string', enum: ['Alta', 'Média', 'Baixa'] },
            urgency: { type: 'string', enum: ['Alta', 'Média', 'Baixa'] },
            deadline: { type: 'string', description: 'ISO Date string YYYY-MM-DD' },
            risk: { type: 'string', enum: ['Alto', 'Médio', 'Baixo'] },
        },
        required: ['title'],
        additionalProperties: false,
    }),
    execute: async (data: any) => {
        logger.info(` Creating Project:`, data);
        const payload = {
            ...data,
            importance: data.importance || 'Média',
            urgency: data.urgency || 'Média',
            risk: data.risk || 'Baixo'
        };
        const id = await NotionService.createProject(payload);
        if (!id) return { error: "Failed to create project" };
        return { success: true, id, url: `https://notion.so/${id.replace(/-/g, "")}`, ...payload };
    }
});

export const createReminder = tool({
    description: 'Create a reminder for the user. Use when the user asks to be reminded about something at a specific time or date.',
    inputSchema: jsonSchema<{ message: string; remindAt: string }>({
        type: 'object',
        properties: {
            message: { type: 'string', description: 'What to remind the user about' },
            remindAt: { type: 'string', description: 'ISO 8601 datetime for when to send the reminder (use America/Sao_Paulo timezone, e.g. 2026-03-20T15:00:00-03:00)' },
        },
        required: ['message', 'remindAt'],
        additionalProperties: false,
    }),
    execute: async ({ message, remindAt }) => {
        logger.info(` Creating Reminder: "${message}" at ${remindAt}`);
        try {
            const { ReminderService } = await import('@/lib/reminder-service');
            const { TelegramConfigService } = await import('@/lib/telegram-config');
            const when = new Date(remindAt);
            if (isNaN(when.getTime())) return { error: 'Data inválida' };
            const chatId = TelegramConfigService.getChatId() || '';
            await ReminderService.create(message, when, chatId);
            const timeStr = when.toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                weekday: 'long', day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit',
            });
            return { success: true, message, remindAt: timeStr };
        } catch (err: any) {
            console.error('[Tool] createReminder error:', err);
            return { error: err.message || 'Falha ao criar lembrete.' };
        }
    }
});

export const createMemoryTool = (phone: string, isAllowed: boolean) => tool({
    description: 'Save important knowledge, rules, preferences, or summaries to the user\'s permanent memory in Supabase. Use this WHENEVER the user asks you to "remember", "save", "learn", or "gravitar" something important. You MUST use this tool to actually save the data.',
    inputSchema: jsonSchema<{ title: string; content: string }>({
        type: 'object',
        properties: {
            title: { type: 'string', description: 'A short subject or title for this memory (3-5 words)' },
            content: { type: 'string', description: 'The detailed information to save' }
        },
        required: ['title', 'content'],
        additionalProperties: false,
    }),
    execute: async ({ title, content }) => {
        if (!isAllowed) {
            return { error: 'O usuário não tem permissão para salvar memórias no sistema.' };
        }
        try {
            await saveMemory(`[${title}] ${content}`, phone, 'message');
            return { success: true, message: `Memória "${title}" salva com sucesso!` };
        } catch (err: any) {
            console.error('[Tool] saveMemory error:', err);
            return { error: 'Falha ao salvar a memória no banco de dados.' };
        }
    }
});

export const searchMemoriesTool = (phone: string) => tool({
    description: 'Puxa a lista de memórias e fatos que você já aprendeu sobre o usuário (Comando "O que você sabe sobre mim?").',
    inputSchema: jsonSchema<{}>({
        type: 'object',
        properties: {},
        additionalProperties: false,
    }),
    execute: async () => {
        try {
            const mems = await getMemoryContext('', phone);
            if (!mems) return { result: 'Você ainda não possui nenhuma memória ou fato salvo sobre este usuário.' };
            return { result: mems };
        } catch {
            return { error: 'Falha ao buscar memórias.' };
        }
    }
});

export const deleteMemoryTool = (phone: string, isAllowed: boolean) => tool({
    description: 'Deleta uma memória específica do banco de dados (Comando "esquece tal assunto"). Use uma palavra-chave para buscar e deletar a memória correta.',
    inputSchema: jsonSchema<{ search: string }>({
        type: 'object',
        properties: {
            search: { type: 'string', description: 'Palavra-chave curta para encontrar a memória a ser deletada.' }
        },
        required: ['search'],
        additionalProperties: false,
    }),
    execute: async ({ search }) => {
        if (!isAllowed) return { error: 'O usuário não tem permissão para gerenciar memórias.' };
        try {
            const { data } = await supabase.from('memories').select('id, content').eq('phone', phone).ilike('content', `%${search}%`).limit(1);
            if (!data || data.length === 0) return { error: `Nenhuma memória encontrada contendo "${search}".` };
            await supabase.from('memories').delete().eq('id', data[0].id);
            return { success: true, message: `Memória apagada: "${data[0].content}"` };
        } catch {
            return { error: 'Falha ao deletar memória.' };
        }
    }
});

export const updateProjectStatusTool = tool({
    description: 'Atualiza o status de um projeto existente no Notion (Ex: "mudar o status de concluído", "mover projeto X para em andamento").',
    inputSchema: jsonSchema<{ pageId: string, status: string }>({
        type: 'object',
        properties: {
            pageId: { type: 'string', description: 'O ID do projeto (UUID do Notion)' },
            status: { type: 'string', description: 'O novo status. Valores comuns: "Não iniciado", "Em andamento", "Concluído", "Pausado", "Cancelado"' }
        },
        required: ['pageId', 'status'],
        additionalProperties: false,
    }),
    execute: async ({ pageId, status }) => {
        const success = await NotionService.updateProjectStatus(pageId, status);
        if (!success) return { error: 'Falha ao atualizar o status do projeto no Notion.' };
        return { success: true, message: `Status alterado para ${status}` };
    }
});

export const listRemindersTool = (phone: string) => tool({
    description: 'Lista os próximos lembretes pendentes agendados no Trigger.dev para este usuário (Comando "quais são os meus lembretes?").',
    inputSchema: jsonSchema<{}>({
        type: 'object',
        properties: {},
        additionalProperties: false,
    }),
    execute: async () => {
        try {
            configure({ secretKey: process.env.TRIGGER_SECRET_KEY! });
            const page = await runs.list({ 
                taskIdentifier: 'send-reminder', 
                limit: 20,
                status: ['DELAYED', 'QUEUED', 'EXECUTING'] as any
            });
            const runsDetailed = await Promise.all(page.data.map((r: any) => runs.retrieve(r.id).catch(() => r)));
            const pending = runsDetailed.filter((r: any) => r.payload?.senderPhone === phone || r.payload?.jid === phone);
            if (pending.length === 0) return { result: 'Você não tem nenhum lembrete pendente.' };
            return { result: pending.map((r: any) => ({ id: r.id, reminder: r.payload?.reminder, delayedUntil: r.delayedUntil })) };
        } catch (e: any) {
            return { error: 'Erro ao listar lembretes: ' + e.message };
        }
    }
});

export const cancelReminderTool = (phone: string) => tool({
    description: 'Cancela um lembrete específico previamente agendado no Trigger.dev (Comando "cancela o lembrete de teste"). Use ID ou palavra-chave.',
    inputSchema: jsonSchema<{ search: string }>({
        type: 'object',
        properties: {
            search: { type: 'string', description: 'ID exato da run (run_xxx) OU um trecho de texto do lembrete (ex: "comprar")' }
        },
        required: ['search'],
        additionalProperties: false,
    }),
    execute: async ({ search }) => {
        try {
            configure({ secretKey: process.env.TRIGGER_SECRET_KEY! });
            // Se for ID direto
            if (search.startsWith('run_')) {
                await runs.cancel(search);
                return { success: true, message: 'Lembrete cancelado com sucesso.' };
            }
            
            // Busca por texto
            const page = await runs.list({ 
                taskIdentifier: 'send-reminder', 
                limit: 20,
                status: ['DELAYED', 'QUEUED', 'EXECUTING'] as any
            });
            
            const runsDetailed = await Promise.all(page.data.map((r: any) => runs.retrieve(r.id).catch(() => r)));
            const match = runsDetailed.find((r: any) => 
                (r.payload?.senderPhone === phone || r.payload?.jid === phone) &&
                (r.payload?.reminder || '').toLowerCase().includes(search.toLowerCase())
            );
            
            if (!match) return { error: 'Nenhum lembrete encontrado contendo esse texto.' };
            
            await runs.cancel(match.id);
            return { success: true, message: `Lembrete "${match.payload?.reminder}" cancelado com sucesso.` };
        } catch (e: any) {
            return { error: 'Falha ao cancelar o lembrete: ' + e.message };
        }
    }
});
