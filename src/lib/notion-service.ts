import { Client } from "@notionhq/client";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

// Database ID constant
const PROJECT_DB_ID = "2483e292-52b4-81f3-b808-f2873f7aecac";

const notion = new Client({
    auth: process.env.NOTION_API_KEY,
});

// Strongly typed interface based on user's screenshot
export interface NotionProject {
    id: string;
    title: string;
    status: string;
    importance: string; // 'Média', 'Alta', 'Baixa'
    risk: string;       // 'Médio', 'Baixo', 'Alto'
    roi: string;
    deadline: string | null;
    urgency: string;
    url: string;
    responsavel: string[];
}

export type ProjectFilter = {
    status?: string;
    importance?: string;
    keyword?: string;
};

// ... existing code ...

// Helper: Safely extract property values from Notion API response "mess"
function mapPageToProject(page: any): NotionProject {
    const props = page.properties;

    // Helpers to avoid "undefined" crash on select/rich_text
    const getSelect = (prop: any) => prop?.select?.name || "N/A";
    const getTitle = (prop: any) => prop?.title?.[0]?.plain_text || "Sem Título";
    const getDate = (prop: any) => prop?.date?.start || null;
    const getStatus = (prop: any) => prop?.status?.name || "N/A";
    const getPeople = (prop: any) => prop?.people?.map((p: any) => p.name || "Unknown") || [];

    return {
        id: page.id,
        title: getTitle(props["Projeto"]),
        status: getStatus(props["Status"]),
        importance: getSelect(props["Importância"]),
        risk: getSelect(props["RISCO"]),
        roi: getSelect(props["ROI"]),
        deadline: getDate(props["DeadLine"]),
        urgency: getSelect(props["Urgência"]),
        url: page.url,
        responsavel: getPeople(props["Responsável"]),
    };
}

export class NotionService {
    /**
     * Fetches all projects from the "Projetos DRM" database using optimized query.
     * We filter in-memory for fuzzy search, but can use native filters for performance if exact match.
     */
    static async getAllProjects(): Promise<NotionProject[]> {
        try {
            console.log("[NotionService] Querying Database:", PROJECT_DB_ID);
            const response = await notion.databases.query({
                database_id: PROJECT_DB_ID,
                sorts: [
                    {
                        property: "Importância",
                        direction: "descending",
                    },
                ],
            });

            console.log(`[NotionService] Raw results count: ${response.results.length}`);
            if (response.results.length > 0) {
                const firstProp = (response.results[0] as any).properties;
                console.log("[NotionService] Sample First Item Properties Keys:", Object.keys(firstProp));
                console.log("[NotionService] Sample First Item 'Importância':", JSON.stringify(firstProp["Importância"]));
                console.log("[NotionService] Sample First Item 'Status':", JSON.stringify(firstProp["Status"]));
            }

            const projects = response.results
                .filter((page): page is PageObjectResponse => "properties" in page)
                .map(mapPageToProject);

            console.log(`[NotionService] Mapped projects count: ${projects.length}`);
            if (projects.length > 0) {
                console.log("[NotionService] Sample First Project Mapped:", JSON.stringify(projects[0], null, 2));
            }
            return projects;
        } catch (error) {
            console.error("Notion API Error:", error);
            return [];
        }
    }

    /**
     * Powerful search function that acts as the "Intelligence Layer"
     * Filters by fuzzy text, importance, etc.
     */
    static async searchProjects(query: string): Promise<NotionProject[]> {
        const allProjects = await this.getAllProjects();
        const lowerQuery = query.toLowerCase();

        return allProjects.filter((p) => {
            // SUPER QUERY: Check all searchable fields
            return (
                p.title.toLowerCase().includes(lowerQuery) ||
                p.status.toLowerCase().includes(lowerQuery) ||
                p.importance.toLowerCase().includes(lowerQuery) ||
                p.risk.toLowerCase().includes(lowerQuery) ||
                p.roi.toLowerCase().includes(lowerQuery) ||
                p.urgency.toLowerCase().includes(lowerQuery) ||
                p.responsavel.some(r => r.toLowerCase().includes(lowerQuery))
            );
        });
    }

    static async getOverdueProjects(): Promise<NotionProject[]> {
        const allProjects = await this.getAllProjects();
        const today = new Date().toISOString().split("T")[0];

        return allProjects.filter((p) => {
            // Only check projects that HAVE a deadline and are NOT finished
            if (!p.deadline) return false;

            const isDone = ["Concluído", "Entregue"].includes(p.status);
            if (isDone) return false;

            return p.deadline < today;
        });
    }

    static async getHighRiskProjects(): Promise<NotionProject[]> {
        const allProjects = await this.getAllProjects();
        return allProjects.filter(
            (p) => ["Alta", "Crítica"].includes(p.importance) && p.risk === "Alto"
        );
    }

    static async getHighUrgencyProjects(): Promise<NotionProject[]> {
        const allProjects = await this.getAllProjects();
        return allProjects.filter(
            (p) => ["Alta", "Urgente", "Imediata"].includes(p.urgency)
        );
    }

    static async getMostImportantProjects(): Promise<NotionProject[]> {
        const allProjects = await this.getAllProjects();
        // Filter for High Importance
        const important = allProjects.filter(p => ["Alta", "Crítica"].includes(p.importance));
        // Sort by Deadline (asc) so easiest to deliver is first, or by Risk? Let's use urgency/deadline.
        return important.sort((a, b) => (a.deadline || "9999") > (b.deadline || "9999") ? 1 : -1);
    }

    static async getUpcomingDeadlines(): Promise<NotionProject[]> {
        const allProjects = await this.getAllProjects();
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 14);

        const todayStr = today.toISOString().split("T")[0];
        const nextWeekStr = nextWeek.toISOString().split("T")[0];

        return allProjects.filter(p => {
            if (!p.deadline) return false;
            const isDone = ["Concluído", "Entregue", "Resolvido"].includes(p.status); // Add Resolvido
            if (isDone) return false;
            return p.deadline >= todayStr && p.deadline <= nextWeekStr;
        });
    }

    /**
     * Generic Filtering Engine with Smart Suggestions.
     */
    static async filterProjects(filters: { field: keyof NotionProject, value: string }[]): Promise<{ results: NotionProject[], availableOptions?: string[] }> {
        const allProjects = await this.getAllProjects();

        const results = allProjects.filter(project => {
            return filters.every(filter => {
                const projectValue = project[filter.field];
                if (!projectValue) return false;

                if (Array.isArray(projectValue)) {
                    return projectValue.some(v => v.toLowerCase().includes(filter.value.toLowerCase()));
                }

                return String(projectValue).toLowerCase() === filter.value.toLowerCase() ||
                    String(projectValue).toLowerCase().includes(filter.value.toLowerCase());
            });
        });

        // Smart Suggestion Logic
        if (results.length === 0 && filters.length === 1) {
            const field = filters[0].field;
            // Collect all unique values for this field from the database
            const options = new Set<string>();
            allProjects.forEach(p => {
                const val = p[field];
                if (val) {
                    if (Array.isArray(val)) val.forEach(v => options.add(v));
                    else options.add(String(val));
                }
            });

            return { results: [], availableOptions: Array.from(options) };
        }

        return { results };
    }

    static async getProjectDetails(pageId: string): Promise<string> {
        try {
            const blocks = await notion.blocks.children.list({
                block_id: pageId,
            });

            let content = "";

            blocks.results.forEach((block: any) => {
                if (block.type === "paragraph" && block.paragraph.rich_text.length > 0) {
                    content += `${block.paragraph.rich_text[0].plain_text}\n\n`;
                } else if (block.type === "heading_1") {
                    content += `# ${block.heading_1.rich_text[0]?.plain_text || ""}\n\n`;
                } else if (block.type === "heading_2") {
                    content += `## ${block.heading_2.rich_text[0]?.plain_text || ""}\n\n`;
                } else if (block.type === "heading_3") {
                    content += `### ${block.heading_3.rich_text[0]?.plain_text || ""}\n\n`;
                } else if (block.type === "bulleted_list_item") {
                    const text = block.bulleted_list_item.rich_text[0]?.plain_text || "";
                    content += `• ${text}\n`;
                } else if (block.type === "to_do") {
                    const text = block.to_do.rich_text[0]?.plain_text || "";
                    const check = block.to_do.checked ? "[x]" : "[ ]";
                    content += `${check} ${text}\n`;
                }
            });

            return content || "Sem conteúdo adicional.";
        } catch (error) {
            console.error("Error fetching project details:", error);
            return "Erro ao carregar detalhes.";
        }
    }

    /**
     * Creates a new project/task in the Notion Database.
     */
    static async createProject(data: {
        title: string;
        importance?: string;
        deadline?: string;
        risk?: string;
        urgency?: string;
    }): Promise<string | null> {
        try {
            const properties: any = {
                "Projeto": {
                    title: [
                        { text: { content: data.title } }
                    ]
                },
                "Status": {
                    status: { name: "Não iniciado" } // Default status
                }
            };

            if (data.importance) {
                properties["Importância"] = { select: { name: data.importance } };
            }

            if (data.risk) {
                properties["RISCO"] = { select: { name: data.risk } };
            }

            if (data.deadline) {
                properties["DeadLine"] = { date: { start: data.deadline } };
            }

            if (data.urgency) {
                properties["Urgência"] = { select: { name: data.urgency } };
            }

            const response = await notion.pages.create({
                parent: { database_id: PROJECT_DB_ID },
                properties: properties,
            });

            return response.id;
        } catch (error) {
            console.error("Error creating project:", error);
            return null;
        }
    }

    /**
     * Fetches all unique project titles to serve as a vocabulary for the AI.
     * Cached for performance in JarvisIntelligence.
     */
    static async getKnownEntities(): Promise<string[]> {
        try {
            const projects = await this.getAllProjects();
            // Extract titles and unique words from titles (e.g. "Prodam" from "Projeto Prodam")
            const titles = projects.map(p => p.title);
            return [...new Set(titles)];
        } catch (error) {
            console.error("Error fetching entities:", error);
            return [];
        }
    }
}
