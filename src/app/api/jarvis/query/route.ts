import { NextResponse } from "next/server";
import { JarvisIntelligence } from "@/lib/jarvis-intelligence";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { query, secret } = body;

        // Simple security check (user can set JARVIS_SECRET in .env later)
        // For now, accepts any request locally or checks if secret matches (optional)
        // if (process.env.JARVIS_SECRET && secret !== process.env.JARVIS_SECRET) {
        //  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        // }

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        console.log(`[Jarvis Intelligence] Processing query: "${query}"`);

        // 1. Process intent & fetch data
        const result = await JarvisIntelligence.processQuery(query);

        // 2. Format as Markdown for Telegram
        const markdown = JarvisIntelligence.formatResponse(result.data, result.summary, result.details);

        return NextResponse.json({
            success: true,
            intent: result.type,
            count: result.data.length,
            markdown_response: markdown
        });

    } catch (error: any) {
        console.error("[Jarvis Intelligence] Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
