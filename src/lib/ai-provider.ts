import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export function getModel() {
    return google(modelName);
}
