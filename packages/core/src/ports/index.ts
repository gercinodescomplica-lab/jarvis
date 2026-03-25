import { Project, Task, Message, ActionLog, Settings, ProjectStatus, TaskStatus } from '../domain/entities';

export interface DbPort {
    getSettings(): Promise<Settings>;
    createProject(project: Partial<Project>): Promise<Project>;
    getProjects(): Promise<Project[]>;
    getProject(id: string): Promise<Project | null>;
    getProjectByName(name: string): Promise<Project | null>;

    createTask(task: Partial<Task>): Promise<Task>;
    getTasksByProject(projectId: string): Promise<Task[]>;

    saveMessage(message: Partial<Message>): Promise<Message>;
    getMessages(limit?: number): Promise<Message[]>;

    logAction(action: Partial<ActionLog>): Promise<ActionLog>;
}

export interface VectorPort {
    search(query: string, limit?: number): Promise<string[]>; // Returns relevant context (e.g. message content or project details)
    addEmbedding(content: string, metadata?: any): Promise<void>;
}

export interface NotionPort {
    createProject(project: Project): Promise<string>; // returns notionId
    createTask(task: Task): Promise<string>; // returns notionId
    updateProjectStatus(notionId: string, status: ProjectStatus): Promise<void>;
    updateTaskStatus(notionId: string, status: TaskStatus): Promise<void>;
    getProjectPages(): Promise<any[]>; // simplified for MVP
}

export interface LlmPort {
    generateResponse(systemPrompt: string, userMessage: string, context?: string): Promise<string>;
    extractIntent(userMessage: string): Promise<{ intent: string; entities: any }>;
}

export interface SttPort {
    transcribe(audio: Blob | Buffer): Promise<string>;
}

export interface TelegramPort {
    sendMessage(chatId: string, text: string): Promise<void>;
    getFile(fileId: string): Promise<Blob | Buffer>;
}

export interface CalendarPort {
    getEventsForUsers(emails: string[], days?: number): Promise<any[]>;
}
