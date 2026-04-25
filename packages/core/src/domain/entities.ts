export type ProjectStatus = 'Backlog' | 'In Progress' | 'Blocked' | 'Done';
export type TaskStatus = 'Todo' | 'Doing' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Project {
    id: string;
    name: string;
    status: ProjectStatus;
    owner?: string;
    notionId?: string;
    details?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Task {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: Date;
    projectId?: string;
    notionId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Message {
    id: string;
    role: MessageRole;
    content: string;
    type: 'text' | 'audio';
    meta?: Record<string, any>;
    createdAt: Date;
}

export interface ActionLog {
    id: string;
    actionType: string;
    details: Record<string, any>;
    createdAt: Date;
}

export interface Settings {
    telegramAllowlist: string[];
    notionProjectsDbId: string;
    notionTasksDbId: string;
    dryRun: boolean;
}
