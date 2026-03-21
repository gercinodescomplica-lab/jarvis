import { streamText, stepCountIs } from 'ai';
import { getModel } from '@/lib/ai-provider';
import { getWebSystemPrompt } from '@/lib/system-prompts';
import {
    searchProjects, getCalendarEvents, createProject,
    getProjectDetails, getDRMData, analyzeProjects, createReminder
} from './tools';

export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages } = await req.json();

    const result = streamText({
        model: getModel(),
        system: getWebSystemPrompt(),
        messages,
        tools: {
            searchProjects,
            getCalendarEvents,
            createProject,
            getProjectDetails,
            getDRMData,
            analyzeProjects,
            createReminder,
        },
        stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
}
