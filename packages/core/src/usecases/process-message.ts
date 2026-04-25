import { DbPort, LlmPort, NotionPort, VectorPort } from '../ports';
import { Message, Project, Task } from '../domain/entities';

export class ProcessUserMessage {
    constructor(
        private db: DbPort,
        private llm: LlmPort,
        private vector: VectorPort,
        private notion: NotionPort
    ) { }

    async execute(userId: string, text: string): Promise<string> {
        // 1. Save User Message
        await this.db.saveMessage({ role: 'user', content: text, type: 'text' });

        // 2. Get Context (Recent messages)
        const recentMessages = await this.db.getMessages(5);
        const contextHistory = recentMessages.reverse().map(m => `${m.role}: ${m.content}`).join('\n');

        // 3. Get Vector Context (RAG)
        const vectorHits = await this.vector.search(text, 3);
        const ragContext = vectorHits.join('\n---\n');

        // 4. Determine Intent via LLM
        // This is a simplified chain; in production might use more steps.
        const analysis = await this.llm.extractIntent(text);

        let result = '';

        console.log('Intent:', analysis.intent);

        switch (analysis.intent) {
            case 'create_project':
                const projData = analysis.entities as Partial<Project>;
                const newProj = await this.db.createProject({ ...projData, status: 'Backlog' });
                // Async sync to Notion (or await if strict)
                if (newProj.name) {
                    const notionId = await this.notion.createProject(newProj as Project);
                    // Update local with notionId... skipped for now for brevity
                }
                result = `Projeto "${newProj.name}" criado com sucesso.`;
                break;

            case 'create_task':
                const taskData = analysis.entities as Partial<Task>;
                // Need project ID to link? LLM might give project name.
                let projectId = taskData.projectId;
                if (!projectId && (taskData as any).projectName) {
                    const p = await this.db.getProjectByName((taskData as any).projectName);
                    if (p) projectId = p.id;
                }
                const newTask = await this.db.createTask({ ...taskData, projectId, status: 'Todo' });
                if (newTask.title) {
                    await this.notion.createTask(newTask as Task);
                }
                result = `Tarefa "${newTask.title}" criada.`;
                break;

            case 'get_status':
                // Logic to get project status
                result = "Funcionalidade de status em desenvolvimento.";
                if ((analysis.entities as any).projectName) {
                    const p = await this.db.getProjectByName((analysis.entities as any).projectName);
                    if (p) {
                        const tasks = await this.db.getTasksByProject(p.id);
                        result = `Projeto: ${p.name}\nStatus: ${p.status}\nTarefas: ${tasks.length} (${tasks.filter(t => t.status === 'Done').length} concluídas)`;
                    } else {
                        result = "Projeto não encontrado.";
                    }
                }
                break;

            default:
                // Smalltalk or question
                const systemPrompt = `Você é um Project Manager Bot. Use o contexto abaixo para responder.\nContexto:\n${ragContext}`;
                result = await this.llm.generateResponse(systemPrompt, text, contextHistory);
        }

        // 5. Save Assistant Message
        await this.db.saveMessage({ role: 'assistant', content: result, type: 'text' });

        // 6. Embed User Message (fire and forget)
        // this.vector.addEmbedding(text, { type: 'message' });

        return result;
    }
}
