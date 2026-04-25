import { NotionPort } from '@jarvis/core/src/ports';
import { Project, Task, ProjectStatus, TaskStatus } from '@jarvis/core/src/domain/entities';
import { Client } from '@notionhq/client';

export class NotionAdapter implements NotionPort {
    private notion: Client;

    constructor(auth: string, private projectsDbId: string, private tasksDbId: string) {
        this.notion = new Client({ auth });
    }

    async createProject(project: Project): Promise<string> {
        if (!this.projectsDbId) return 'MOCK_NOTION_ID';

        // Simplistic implementation
        const response = await this.notion.pages.create({
            parent: { database_id: this.projectsDbId },
            properties: {
                Name: { title: [{ text: { content: project.name } }] },
                Status: { select: { name: project.status } },
            }
        });
        return response.id;
    }

    async createTask(task: Task): Promise<string> {
        if (!this.tasksDbId) return 'MOCK_NOTION_ID';

        const response = await this.notion.pages.create({
            parent: { database_id: this.tasksDbId },
            properties: {
                Name: { title: [{ text: { content: task.title } }] },
                Status: { select: { name: task.status } },
                Priority: { select: { name: task.priority || 'Medium' } }
            }
        });
        return response.id;
    }

    async updateProjectStatus(notionId: string, status: ProjectStatus): Promise<void> {
        await this.notion.pages.update({
            page_id: notionId,
            properties: {
                Status: { select: { name: status } }
            }
        });
    }

    async updateTaskStatus(notionId: string, status: TaskStatus): Promise<void> {
        await this.notion.pages.update({
            page_id: notionId,
            properties: {
                Status: { select: { name: status } }
            }
        });
    }

    async getProjectPages(): Promise<any[]> {
        return [];
    }
}
