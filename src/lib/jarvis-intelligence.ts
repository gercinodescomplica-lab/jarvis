import { NotionService, NotionProject } from "./notion-service";
import { OpenAIAdapter } from '@jarvis/adapters/src/openai';



const FIELD_MAPPING: Record<string, keyof NotionProject> = {
    "ROI": "roi",
    "Risco": "risk",
    "Urgência": "urgency",
    "Importância": "importance",
    "Status": "status",
    "Responsável": "responsavel",
    "Tipo": "type" as any, // "Type" might not exist on NotionProject interface yet, let's cast or ignore for now if strict. Actually let's assume it maps to something or remove if mapped elsewhere.
    "Valor Agregado": "valorAgregado" as any // Need to update interface if we want strict typing, but for now we map string to string.
};

// We don't need INTENT_MAPPING anymore with the new strategy


export class JarvisIntelligence {
    private static openai = new OpenAIAdapter();
    private static knownEntities: string[] = [];
    private static lastEntityFetch = 0;


    /**
     * Routes the natural language query using AI Classification.
     */
    static async processQuery(query: string): Promise<{
        type: "SEARCH" | "OVERDUE" | "IMPORTANT" | "RISK" | "DEADLINE" | "DETAILS" | "CALENDAR" | "CREATE_PROJECT" | "MISSING_INFO" | "CHIT_CHAT" | "URGENCY" | "FILTER";
        data: any[];
        summary: string;
        details?: string;
        missingFields?: string[];
        draft?: any;
    }> {
        // 0. QUICK CHECK: CHIT-CHAT (Avoid complex processing for "Hi")
        // We can do a regex check first to save latency? 
        // Or just let the Intent Classifier handle it (more robust).

        // 0. ENTITY CORRECTION (The "Spelling Fixer" Layer)
        await this.refreshEntityCache();

        // Skip entity correction for very short greetings to avoid weird matches
        let cleanQuery = query;
        if (query.length > 10) {
            cleanQuery = await this.correctEntities(query);
            console.log(`[JarvisIntelligence] Entity Correction: "${query}" -> "${cleanQuery}"`);
        }

        // 1. ANALYZE QUERY (Intent + Data Extraction in one go)
        console.log(`[JarvisIntelligence] Analyzing query: "${cleanQuery}"`);
        const analysis = await this.analyzeQuery(cleanQuery);
        console.log(`[JarvisIntelligence] Analysis Result:`, JSON.stringify(analysis, null, 2));

        const intent = analysis.intent;

        switch (intent) {
            case "CHIT_CHAT":
                return { type: "CHIT_CHAT", data: [], summary: "Interaction Social." };

            case "CREATE_PROJECT":
                return this.handleCreateIntent(cleanQuery) as any; // We could optimize passing 'analysis.slots' here

            case "DETAILS":
                return this.handleDetailsIntent(cleanQuery) as any;

            case "CALENDAR":
                return { type: "CALENDAR", data: [], summary: `Consultando agenda...` };

            case "FILTER":
                if (analysis.filters && analysis.filters.length > 0) {
                    // Map "Natural Language Field" -> "Notion Column"
                    const mappedFilters = analysis.filters.map(f => ({
                        field: FIELD_MAPPING[f.field] || f.field, // fallback to raw string if not mapped
                        value: f.value
                    }));

                    // Call Generic Engine
                    const { results, availableOptions } = await NotionService.filterProjects(mappedFilters as any);
                    const filterDesc = analysis.filters.map(f => `${f.field}=${f.value}`).join(", ");

                    if (results.length === 0 && availableOptions && availableOptions.length > 0) {
                        return {
                            type: "SEARCH",
                            data: [],
                            summary: `Não encontrei projetos com *${filterDesc}*. Mas encontrei estas opções em ${analysis.filters[0].field}: \n\n${availableOptions.map(o => `• ${o}`).join("\n")}\n\nDeseja filtrar por algum desses?`
                        };
                    }

                    return {
                        type: "SEARCH", // Frontend handles it as search result
                        data: results,
                        summary: `Encontrei ${results.length} projetos com ${filterDesc}.`
                    };
                }
                // Fallback to search if filter is empty
                return this.handleSearchIntent(cleanQuery) as any;

            case "LIST": {
                const all = await NotionService.getAllProjects();
                return { type: "SEARCH", data: all, summary: `Você tem ${all.length} projetos no Notion.` };
            }

            case "OVERDUE":
                const overdue = await NotionService.getOverdueProjects();
                return { type: "OVERDUE", data: overdue, summary: `Encontrei ${overdue.length} projetos atrasados.` };

            case "DEADLINE":
                const deadlines = await NotionService.getUpcomingDeadlines();
                return { type: "DEADLINE", data: deadlines, summary: `Agenda: ${deadlines.length} entregas próximas.` };

            case "SEARCH":
            default:
                return this.handleSearchIntent(cleanQuery) as any;
        }
    }

    // --- ENTITY CORRECTION LOGIC ---

    private static async refreshEntityCache() {
        const now = Date.now();
        // Refresh every 10 minutes
        if (now - this.lastEntityFetch > 10 * 60 * 1000 || this.knownEntities.length === 0) {
            console.log("[JarvisIntelligence] Refreshing Entity Cache from Notion...");
            this.knownEntities = await NotionService.getKnownEntities();
            this.lastEntityFetch = now;
            console.log(`[JarvisIntelligence] Loaded ${this.knownEntities.length} entities.`);
        }
    }

    private static async correctEntities(text: string): Promise<string> {
        // If text is very short or we have no entities, skip
        if (text.length < 5 || this.knownEntities.length === 0) return text;

        const punc = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

        const entitiesList = this.knownEntities.slice(0, 50).join(", "); // Limit context size

        const prompt = `
        You are an Entity Corrector for a Voice Interface.
        Your goal is to fix phonetic spelling errors in the user's text, identifying proper names from the allowed list.

        Allowed Entities (Projects/Clients):
        [${entitiesList}]

        User Input: "${text}"

        Instructions:
        1. Replace ONLY phonetically similar words (misspellings) with the correct Entity name.
        2. Example: "Reunião na pro dan" (User) -> "Reunião na Prodam"
        3. Example: "Ver o projeto da siwi" (User) -> "Ver o projeto da Siwi"
        
        CRITICAL RULES (DO NOT IGNORE):
        4. **NO AUTOCOMPLETE**: Do NOT expand short words into long titles.
           - User: "Cobrar SEGES" -> Output: "Cobrar SEGES" (Correct).
           - User: "Cobrar SEGES" -> Output: "Cobrar Acesso ao SEI - SEGES" (WRONG! STOP!).
        
        5. **SUBSTRING RULE**: If the User's word is a SUBSTRING of an Allowed Entity, **KEEP THE USER'S WORD AS IS**.
           - If allowed list has "Project Alpha Beta", and user says "Alpha", keep "Alpha". NOT "Project Alpha Beta".
           
        6. Only replace if there is a clear phonetic mismatch (e.g. "Sequi" -> "SEI", "Ceges" -> "SEGES").
        7. If no entity from the list is detected phonetically, return input exactly as is.
        8. Return ONLY the corrected string.
        `;

        try {
            const correction = await this.openai.generateResponse(prompt, text);
            return correction.replace(/["`]/g, "").trim();
        } catch (e) {
            return text; // Fallback
        }
    }

    /**
     * Unified Analysis: Intent + Slot Extraction
     */
    private static async analyzeQuery(query: string): Promise<{
        intent: string;
        filters?: { field: string, value: string }[],
        slots?: any
    }> {
        const availableFields = Object.keys(FIELD_MAPPING).join(", ");

        const prompt = `
        You are a Semantic Parser for a Project Management AI.
        Analyze the user's input and extract Structured Data.

        AVAILABLE INTENTS:
        - [CHIT_CHAT]: Social greetings (Oi, Bom dia).
        - [CREATE_PROJECT]: Create new task (Criar tarefa, Lembrar de).
        - [DETAILS]: Ask for details of a specific project (Detalhes de X).
        - [CALENDAR]: Ask about meetings/schedule (Reuniões hoje).
        - [OVERDUE]: Ask about late projects (Atrasados).
        - [DEADLINE]: Ask about upcoming deadlines (Entregas, Prazos).
        - [FILTER]: User wants to FILTER projects by specific attributes (High Priority, Urgent, ROI High).
        - [LIST]: User wants to LIST or COUNT ALL projects (Quantos projetos tenho, Listar todos, Mostrar todos os projetos, Me dá a lista de projetos).
        - [SEARCH]: General search for a SPECIFIC project by name (Busca X, Projeto Y).

        AVAILABLE FIELDS FOR FILTERING:
        [${availableFields}]

        INPUT: "${query}"

        INSTRUCTIONS:
        1. If user says "ROI Alto", map to FILTER with field "ROI" and value "Alto".
        2. If user says "Urgente" or "Urgência Alta", map to FILTER with field "Urgência" and value "Alta".
        3. If user says "Importante" or "Crítico", map to FILTER with field "Importância" and value "Alta" (or "Crítica").
        4. If user says "Risco Alto", map to FILTER with field "Risco" and value "Alto".
        5. **LIST vs FILTER**: "Listar projetos com urgência alta" -> FILTER. But "Quantos projetos tenho", "Me lista todos os projetos", "Mostra todos" -> LIST.
        6. **LIST vs SEARCH**: LIST = count or show ALL projects with no filter. SEARCH = find a SPECIFIC project by name.
        7. Use "SEARCH" only when the user mentions a specific project name to look up.

        OUTPUT JSON ONLY:
        {
            "intent": "TOKEN",
            "filters": [ { "field": "...", "value": "..." } ] (Valid only for FILTER)
        }
        `;

        try {
            const response = await this.openai.generateResponse(prompt, query);
            const json = JSON.parse(response.replace(/```json|```/g, "").trim());
            return json;
        } catch (e) {
            console.error("Analysis Failed", e);
            return { intent: "SEARCH" };
        }
    }

    // --- HANDLERS ---

    private static async handleCreateIntent(query: string) {
        // Use AI to extract slots
        const extractionPrompt = `
        Extract project/task details from the user's request.
        Properties to extract:
        - title (string, required)
        - importance (enum: 'Alta', 'Média', 'Baixa') - infer from text (e.g. "importante", "crítico"). Default: "Média".
        - urgency (enum: 'Alta', 'Média', 'Baixa') - infer from text (e.g. "urgente", "pra ontem"). Default: "Média".
        - deadline (date YYYY-MM-DD) - infer from text (e.g. "amanhã", "next friday")

        Reference Date (Today): ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

        User Input: "${query}"

        Output JSON ONLY: { "title": "...", "importance": "...", "deadline": "...", "urgency": "..." }
        If a field is missing in text, set it to null.
        `;

        const extractedJson = await this.openai.generateResponse(extractionPrompt, query);
        let slots;
        try {
            slots = JSON.parse(extractedJson.replace(/```json|```/g, "").trim());
        } catch (e) {
            console.error("JSON Parse Error", e);
            return { type: "SEARCH", data: [], summary: "Não entendi os dados da tarefa." };
        }

        const missing = [];
        if (!slots.importance) missing.push("importância");
        if (!slots.deadline) missing.push("prazo");

        if (missing.length > 0) {
            return {
                type: "MISSING_INFO",
                data: [],
                summary: `Entendido. Para criar "${slots.title}", preciso de: ${missing.join(", ")}.`,
                missingFields: missing,
                draft: slots
            };
        }

        const newId = await NotionService.createProject({
            title: slots.title,
            importance: slots.importance,
            deadline: slots.deadline,
            risk: "Baixo",
            urgency: slots.urgency || "Média"
        });

        if (newId) {
            return {
                type: "CREATE_PROJECT",
                data: [{ id: newId, ...slots, url: `https://notion.so/${newId.replace(/-/g, "")}` }],
                summary: `✅ Tarefa criada: *${slots.title}* (Prazo: ${slots.deadline}, Importância: ${slots.importance}).`
            };
        } else {
            return { type: "SEARCH", data: [], summary: "Erro ao criar no Notion." };
        }
    }

    private static async handleDetailsIntent(query: string) {
        // Clean query to remove trigger words for better search
        const cleanQuery = query
            .replace(/detalhes?|participantes?|descrição|sobre o projeto|do projeto|no projeto|tarefas?|todos?|pendências?/gi, "")
            .trim();

        let data = await NotionService.searchProjects(cleanQuery || query);

        // SMART FALLBACK
        if (data.length === 0) {
            const bestMatch = await this.findBestMatch(cleanQuery || query);
            if (bestMatch) {
                data = await NotionService.searchProjects(bestMatch);
            }
        }

        if (data.length === 1) {
            const details = await NotionService.getProjectDetails(data[0].id);
            return {
                type: "DETAILS",
                data,
                summary: `Aqui estão os detalhes do projeto *${data[0].title}*:`,
                details
            };
        } else if (data.length > 1) {
            return {
                type: "SEARCH", // Fallback to list view if multiple found
                data,
                summary: `Encontrei ${data.length} projetos. Qual deles você quer ver?`,
            };
        }

        return { type: "SEARCH", data: [], summary: "Não encontrei os detalhes desse projeto." };
    }

    private static async handleSearchIntent(query: string) {
        let data = await NotionService.searchProjects(query);
        let summary = `Encontrei ${data.length} projetos buscando por "${query}".`;

        if (data.length === 0) {
            const bestMatch = await this.findBestMatch(query);
            if (bestMatch) {
                data = await NotionService.searchProjects(bestMatch);
                summary = `Não encontrei "${query}" exato, mas encontrei resultados para *${bestMatch}*.`;
            }
        }

        return {
            type: "SEARCH",
            data,
            summary,
        };
    }

    /**
     * Uses AI to find the best matching project title from the full list.
     */
    private static async findBestMatch(userQuery: string): Promise<string | null> {
        try {
            console.log(`[JarvisIntelligence] Attempting Fuzzy Match for: "${userQuery}"`);
            const allProjects = await NotionService.getAllProjects();
            const titles = allProjects.map(p => p.title).join("\n");

            const prompt = `
            You are a Fuzzy Search Assistant.
            User searched for: "${userQuery}"
            
            Here are the available Project Titles:
            ${titles}
            
            Task:
            1. Identify if any of the titles strongly corresponds to the user's search.
            2. Be flexible: "Power Automate" matches "Fluxos Power Automate" or "Automacao PA".
            3. If found, return ONLY the exact title from the list.
            4. If no reasonable match exists, return "null".
            `;

            const response = await this.openai.generateResponse(prompt, userQuery);
            const cleanResponse = response.replace(/["`]/g, "").trim();

            if (cleanResponse !== "null" && cleanResponse.length > 0) {
                console.log(`[JarvisIntelligence] Fuzzy Match Found: "${userQuery}" -> "${cleanResponse}"`);
                return cleanResponse;
            }

            console.log(`[JarvisIntelligence] No fuzzy match found.`);
            return null;

        } catch (error) {
            console.error("Error in findBestMatch:", error);
            return null;
        }
    }

    /**
     * Formats the list of projects into a Markdown string for Telegram.
     */
    static formatResponse(data: NotionProject[], summary: string, details?: string): string {
        let md = `🤖 *Jarvis Notion Intelligence*\n\n`;
        md += `_${summary}_\n\n`;

        if (details) {
            md += `${details}\n\n`;
            const p = data[0];
            if (p) {
                md += `[🔗 Ver no Notion](${p.url})\n`;
            }
            return md;
        }

        if (data.length === 0) {
            md += "🚫 Nenhum projeto encontrado com esses critérios.";
            return md;
        }

        data.slice(0, 10).forEach((p, idx) => { // Limit to 10 for telegram
            const statusIcon = p.status === "Concluído" ? "✅" : "🚧";
            const deadline = p.deadline ? `📅 ${p.deadline}` : "📅 Sem data";

            md += `*${idx + 1}. ${p.title}* ${statusIcon}\n`;
            md += `   • Status: ${p.status}\n`;
            md += `   • Risco: ${p.risk} | Imp: ${p.importance}\n`;
            md += `   • ${deadline}\n`;
            md += `   [🔗 Ver no Notion](${p.url})\n\n`;
        });

        if (data.length > 10) {
            md += `_... e mais ${data.length - 10} projetos._`;
        }

        return md;
    }
}
