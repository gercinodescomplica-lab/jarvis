// MOCKING the import to avoid TS complexity in script
// import { JarvisIntelligence } from '../src/lib/jarvis-intelligence'; 
import { OpenAI } from 'openai'; // Using direct OpenAI package for test script simplicity or Adapter if resolved.

// Actually, to use the adapter, we need relative path.
// Let's just use 'openai' package directly to reproduce the PROMPT logic, which is generic.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Mock the NotionService.getKnownEntities to simulate what the AI sees
// Based on the user's screenshot, there is a project called "Ver o contrato de Acesso ao SEI - Realizar comunicação sobre lentidão -> SEGES"
const MOCK_ENTITIES = [
    "Prodam",
    "Siwi",
    "Ver o contrato de Acesso ao SEI - Realizar comunicação sobre lentidão → SEGES",
    "Outro Projeto"
];

// We need to hijack the private method or mock the retrieval.
// Since correctEntities is private, we can't call it directly in valid TS without suppression or using the public flow.
// However, the public method `processQuery` calls it.
// Let's try to mock the internal state of JarvisIntelligence if possible, or just modify the class temporarily to test.

// Actually, easier approach: I will modify `src/lib/jarvis-intelligence.ts` to log the EXACT prompt and entities it is using during the user's request.
// But to "Create a test for real", I'll create a script that mimicks the LLM call.

// import { OpenAIAdapter } from '@jarvis/adapters/src/openai';

async function testCorrection() {
    // const openai = new OpenAIAdapter(process.env.OPENAI_API_KEY || '');

    const userQuery = "Me lembra de cobrar SEGES do pagamento do contrato.";

    const entitiesList = MOCK_ENTITIES.join(", ");

    const prompt = `
        You are an Entity Corrector for a Voice Interface.
        Your goal is to fix phonetic spelling errors in the user's text, identifying proper names from the allowed list.

        Allowed Entities (Projects/Clients):
        [${entitiesList}]

        User Input: "${userQuery}"

        Instructions:
        1. Replace phonetically similar words with the correct Entity name.
        2. Example: "Reunião na pro dan" (User) + List includes "Prodam" -> Output: "Reunião na Prodam"
        3. Example: "Ver o projeto da siwi" (User) + List includes "Siwi" -> Output: "Ver o projeto da Siwi"
        4. Preserve the rest of the sentence exactly.
        5. CRITICAL: DO NOT Autocomplete or Expand. 
           - INVALID: "Ver contrato de Seges" -> "Ver contrato de Acesso ao SEI - Realizar comunicação..." (STOP!)
           - VALID: "Ver contrato de Seges" -> "Ver contrato de Seges" (No phonetic error found, keep as is).
        6. Only replace if there is a clear phonetic mismatch (e.g. "Sequi" -> "Sequi"). If the word matches a part of a name, KEEP IT AS IS.
        7. If no entity from the list is detected phonetically, return input exactly as is.
        8. Return ONLY the corrected string.
        `;

    // console.log("--- PROMPT ---");
    // console.log(prompt);
    // console.log("--- END PROMPT ---");

    const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
    });

    console.log("\n--- RESPONSE ---");
    console.log(chatCompletion.choices[0].message.content);
}

testCorrection();
