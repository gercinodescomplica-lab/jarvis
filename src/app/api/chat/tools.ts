import { tool, jsonSchema } from 'ai';
import { NotionService } from '@/lib/notion-service';
import { CalendarDB } from '@/lib/calendar-db';
import { GraphCalendarAdapter } from '@jarvis/adapters/src/ms-graph';

export const searchProjects = tool({
    description: 'Search for projects or tasks in Notion by keyword, status (e.g. "atrasado"), or urgency.',
    inputSchema: jsonSchema<{ query: string }>({
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query, project name, or filter (e.g. "urgente", "atrasado").'
            }
        },
        required: ['query'],
        additionalProperties: false,
    }),
    execute: async ({ query }) => {
        console.log(`[Tool] Searching Projects: "${query}"`);
        if (query.toLowerCase().includes('atrasad')) {
            return await NotionService.getOverdueProjects();
        }
        if (query.toLowerCase().includes('prazo') || query.toLowerCase().includes('entrega')) {
            return await NotionService.getUpcomingDeadlines();
        }
        const results = await NotionService.searchProjects(query);
        return results.slice(0, 10);
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
