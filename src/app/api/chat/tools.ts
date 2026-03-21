import { tool, jsonSchema } from 'ai';
import { NotionService } from '@/lib/notion-service';
import { CalendarDB } from '@/lib/calendar-db';
import { GraphCalendarAdapter } from '@jarvis/adapters/src/ms-graph';
import { fetchDRMData, formatDRMContext } from '@/lib/drm-service';
import { supabase } from '@/db';

export const searchProjects = tool({
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
        console.log(`[Tool] Searching Projects: "${query}"`);
        const lq = query.toLowerCase().trim();
        // Lista tudo quando a query é genérica
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
        // Se não achou nada com o filtro, retorna todos
        if (results.length === 0) {
            const all = await NotionService.getAllProjects();
            return all.slice(0, 30);
        }
        return results.slice(0, 15);
    },
});

export const getCalendarEvents = tool({
    description: 'Get upcoming calendar events and meetings from Microsoft Graph. You can specify a user email or name. Users available: tiagoluz@prodam.sp.gov.br (Tiago), danielleoliveira@prodam.sp.gov.br (Danielle), gercinoneto@prodam.sp.gov.br (Gercino).',
    inputSchema: jsonSchema<{ days?: number, userName?: string }>({
        type: 'object',
        properties: {
            days: {
                type: 'number',
                description: 'Number of days to look ahead (default: 7)'
            },
            userName: {
                type: 'string',
                description: 'Name or email of the person to check (e.g. "Tiago", "Danielle", "Gercino").'
            }
        },
        additionalProperties: false,
    }),
    execute: async ({ days = 7, userName }) => {
        console.log(`[Tool] Fetching Calendar for ${userName || 'all'} for next ${days} days`);

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

            const results = await adapter.getEventsForUsers(targetEmails);

            // Flatten results for the UI (CalendarCard expects an array of events)
            const allEvents = results.flatMap(r => r.events || []);

            // Fallback to local DB if no events found in Graph
            if (allEvents.length === 0) {
                const start = new Date();
                start.setHours(0, 0, 0, 0);
                const end = new Date();
                end.setDate(end.getDate() + days);
                return await CalendarDB.getEvents(start, end);
            }

            return allEvents;
        } catch (error) {
            console.error("[Tool] Graph API error, falling back to local DB:", error);
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setDate(end.getDate() + days);
            return await CalendarDB.getEvents(start, end);
        }
    },
});

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
        console.log(`[Tool] Creating Project:`, data);
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

export const getProjectDetails = tool({
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
        console.log(`[Tool] Getting Details for: ${id}`);
        const details = await NotionService.getProjectDetails(id);
        return { details };
    }
});

export const getDRMData = tool({
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
        console.log(`[Tool] getDRMData — query: "${query}", manager: "${managerName || 'all'}"`);
        try {
            const drmData = await fetchDRMData();
            const effectiveQuery = managerName ? `${query} ${managerName}` : query;
            return {
                success: true,
                context: formatDRMContext(drmData, effectiveQuery),
                summary: drmData.summary,
                managersCount: drmData.data.length,
                timestamp: drmData.timestamp,
            };
        } catch (err: any) {
            console.error('[Tool] getDRMData error:', err);
            return { success: false, error: err.message || 'Falha ao buscar dados da DRM.' };
        }
    }
});

export const analyzeProjects = tool({
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
        console.log(`[Tool] Analyzing Projects by ${dimension} (${safeChartType})`);
        const projects = await NotionService.getAllProjects();

        // Aggregation Logic
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
        console.log(`[Tool] Creating Reminder: "${message}" at ${remindAt}`);
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

export const searchDocuments = tool({
    description: `Busca em documentos e PDFs que foram enviados e salvos na base de conhecimento.
Use SEMPRE que o usuário perguntar sobre conteúdo de documentos, relatórios, PDFs, ou qualquer arquivo enviado (ex: GRI, relatório, contrato, manual).
Exemplos: "o que é GRI?", "o que diz o relatório X?", "me fala sobre o documento Y".`,
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
        console.log(`[Tool] searchDocuments: "${query}"`);
        try {
            const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
            const ilikeFilter = terms.map(t => `content.ilike.%${t}%`).join(',');

            const { data: chunks, error } = await supabase
                .from('document_chunks')
                .select('content, document_title')
                .or(ilikeFilter)
                .limit(8);

            if (error) throw error;

            if (!chunks || chunks.length === 0) {
                // Tenta buscar só pelo nome do documento
                const { data: docs } = await supabase
                    .from('documents')
                    .select('filename, description')
                    .or(terms.map(t => `description.ilike.%${t}%,filename.ilike.%${t}%`).join(','))
                    .limit(5);

                if (!docs || docs.length === 0) {
                    return { found: false, message: 'Nenhum documento encontrado com esses termos.' };
                }
                return { found: true, documents: docs, chunks: [] };
            }

            // Agrupa por documento
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
                    excerpts: contents.slice(0, 3),
                })),
            };
        } catch (err: any) {
            console.error('[Tool] searchDocuments error:', err);
            return { error: err.message };
        }
    }
});
