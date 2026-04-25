import { NextRequest, NextResponse } from 'next/server';
import { NotionService } from '@/lib/notion-service';
import { extractProjectCandidates } from '@/lib/project-extractor';
import { OpenAIAdapter } from '@jarvis/adapters/src/openai';

// Initialize OpenAI Adapter
const openai = new OpenAIAdapter();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project, text } = body;

        const input = text || project;

        if (!input) {
            return NextResponse.json({ error: 'Project name or text is required' }, { status: 400 });
        }

        // 1. Local Extraction
        let candidates = extractProjectCandidates(input);

        // 2. AI Extraction
        if (openai) {
            try {
                console.log(`[Project API] Requesting AI extraction for: "${input}"`);
                const aiPrompt = `Analyze the following user query: "${input}"
            
            Extract the most likely project names or project titles referred to in the text.
            If the text seems to be asking about a specific project, extract the name.
            If it uses variations like "Fenati" vs "Projeto Fenati", return both.
            
            Return STRICTLY a JSON array of strings. Do not add any markdown formatting, backticks, or explanation.
            
            Examples:
            Input: "Como ta o projeto do FENATI?" -> Output: ["FENATI", "Projeto FENATI"]
            Input: "Dados do Power Automate" -> Output: ["Power Automate", "Projeto Power Automate"]
            Input: "Status do novo website" -> Output: ["Novo Website", "Website"]`;

                const aiResponse = await openai.generateResponse(aiPrompt, input);

                // Clean up potentially md-formatted response
                let cleanJson = aiResponse.trim();
                cleanJson = cleanJson.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '');

                const aiCandidates = JSON.parse(cleanJson);

                if (Array.isArray(aiCandidates)) {
                    console.log(`[Project API] AI Candidates:`, aiCandidates);
                    // Prepend AI candidates (higher priority)
                    candidates = [...aiCandidates, ...candidates];
                }
            } catch (e) {
                console.error("[Project API] AI Extraction failed:", e);
                // Continue with local candidates silently
            }
        }

        // If we have a direct project name provided in body, make sure it's included
        if (project && !candidates.includes(project)) {
            candidates.unshift(project);
        }

        // De-duplicate and take top 5
        candidates = Array.from(new Set(candidates)).slice(0, 5);
        console.log(`[Project API] Final Candidates for "${input}":`, candidates);

        // Try to find in Notion
        for (const candidate of candidates) {
            console.log(`[Project API] Searching Notion for candidate: "${candidate}"`);
            const results = await NotionService.searchProjects(candidate);

            if (results && results.length > 0) {
                // Return the first best match
                const match = results[0];
                console.log(`[Project API] Found match: "${match.title}"`);

                // Fetch deep details (body content)
                const details = await NotionService.getProjectDetails(match.id);

                // Map to ProjectData format required by frontend
                const projectData = {
                    id: match.id,
                    name: match.title,
                    status: match.status,
                    urgencia: match.urgency,
                    risco: match.risk,
                    importancia: match.importance,
                    valorAgregado: "N/A", // Not mapped in NotionService yet
                    roi: match.roi,
                    responsavel: match.responsavel || [],
                    deadline: match.deadline,
                    tipo: "Projeto", // Hardcoded or extract if needed
                    url: match.url,
                    description: "Projeto encontrado no Notion",
                    details: details // The rich body content
                };

                return NextResponse.json(projectData);
            }
        }

        return NextResponse.json({
            error: 'Project not found',
            message: 'Não encontrei esse projeto no Notion. Deseja que eu busque na internet?',
            suggestWebSearch: true
        }, { status: 404 });

    } catch (err) {
        console.error("[API] /api/projects error:", err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
