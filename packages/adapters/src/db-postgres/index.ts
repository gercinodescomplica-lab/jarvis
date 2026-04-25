import { DbPort } from '@jarvis/core/src/ports';
import { Project, Task, Message, ActionLog, Settings } from '@jarvis/core/src/domain/entities';
import postgres from 'postgres';

export class PostgresAdapter implements DbPort {
    private sql: postgres.Sql;

    constructor(connectionString: string) {
        this.sql = postgres(connectionString);
    }

    async getSettings(): Promise<Settings> {
        const rows = await this.sql`select key, value from settings`;
        const settings: any = {};
        for (const row of rows) {
            settings[row.key] = row.value; // simplistic mapping
        }
        // ensure defaults
        return {
            telegramAllowlist: (settings['allowed_telegram_chat_ids'] || '').split(',').filter(Boolean),
            notionProjectsDbId: settings['notion_projects_db_id'] || '',
            notionTasksDbId: settings['notion_tasks_db_id'] || '',
            dryRun: settings['dry_run'] === 'true'
        };
    }

    async createProject(project: Partial<Project>): Promise<Project> {
        const [row] = await this.sql`
      insert into projects (name, status, details, notion_id)
      values (${project.name || ''}, ${project.status || 'Backlog'}, ${project.details || null}, ${project.notionId || null})
      returning *
    `;
        return this.mapProject(row);
    }

    async getProjects(): Promise<Project[]> {
        const rows = await this.sql`select * from projects order by created_at desc`;
        return rows.map(this.mapProject);
    }

    async getProject(id: string): Promise<Project | null> {
        const [row] = await this.sql`select * from projects where id = ${id}`;
        return row ? this.mapProject(row) : null;
    }

    async getProjectByName(name: string): Promise<Project | null> {
        // Fuzzy or exact match
        const [row] = await this.sql`select * from projects where name ilike ${name} limit 1`;
        return row ? this.mapProject(row) : null;
    }

    async createTask(task: Partial<Task>): Promise<Task> {
        const [row] = await this.sql`
      insert into tasks (title, status, priority, project_id, notion_id)
      values (${task.title || ''}, ${task.status || 'Todo'}, ${task.priority || 'Medium'}, ${task.projectId || null}, ${task.notionId || null})
      returning *
    `;
        return this.mapTask(row);
    }

    async getTasksByProject(projectId: string): Promise<Task[]> {
        const rows = await this.sql`select * from tasks where project_id = ${projectId} order by created_at desc`;
        return rows.map(this.mapTask);
    }

    async saveMessage(message: Partial<Message>): Promise<Message> {
        const [row] = await this.sql`
      insert into messages (role, content, type, meta)
      values (${message.role || 'user'}, ${message.content || ''}, ${message.type || 'text'}, ${this.sql.json(message.meta || {})})
      returning *
    `;
        return this.mapMessage(row);
    }

    async getMessages(limit: number = 10): Promise<Message[]> {
        const rows = await this.sql`select * from messages order by created_at desc limit ${limit}`;
        return rows.map(this.mapMessage);
    }

    async logAction(action: Partial<ActionLog>): Promise<ActionLog> {
        const [row] = await this.sql`
      insert into action_logs (action_type, details)
      values (${action.actionType || 'unknown'}, ${this.sql.json(action.details || {})})
      returning *
    `;
        return {
            id: row.id,
            actionType: row.action_type,
            details: row.details,
            createdAt: row.created_at
        };
    }

    private mapProject(row: any): Project {
        return {
            id: row.id,
            name: row.name,
            status: row.status,
            owner: row.owner,
            notionId: row.notion_id,
            details: row.details,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private mapTask(row: any): Task {
        return {
            id: row.id,
            title: row.title,
            status: row.status,
            priority: row.priority,
            dueDate: row.due_date,
            projectId: row.project_id,
            notionId: row.notion_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }
    }

    private mapMessage(row: any): Message {
        return {
            id: row.id,
            role: row.role,
            content: row.content,
            type: row.type,
            meta: row.meta,
            createdAt: row.created_at
        }
    }
}
