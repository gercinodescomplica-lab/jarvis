import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { NextResponse } from "next/server";

// Initialize client outside of handler for performance
// Explicitly point to the file since environment variable might not be set
const client = new TextToSpeechClient({
    keyFilename: "google-credentials.json"
});

export async function POST(req: Request) {
    try {
        const { text, voice } = await req.json();

        // Default to 'pt-BR-Chirp3-HD-Fenrir' (Male, Deep, High Quality)
        const voiceName = voice || "pt-BR-Chirp3-HD-Fenrir";

        // Split text by punctuation to avoid "sentence too long" error in Google Cloud TTS
        // Regex splits by periods, exclamation marks, or question marks followed by a space
        const chunks = text.match(/[^.!?]+[.!?]*\s*/g) || [text];

        const audioContents: Buffer[] = [];

        for (const chunk of chunks) {
            if (!chunk.trim()) continue;

            const request = {
                input: { text: chunk.trim() },
                voice: { languageCode: "pt-BR", name: voiceName },
                audioConfig: { audioEncoding: "MP3" as const },
            };

            const [response] = await client.synthesizeSpeech(request);
            if (response.audioContent) {
                audioContents.push(Buffer.from(response.audioContent));
            }
        }

        if (audioContents.length === 0) {
            throw new Error("No audio content generated");
        }

        const combinedAudio = Buffer.concat(audioContents);

        return new NextResponse(combinedAudio, {
            headers: {
                "Content-Type": "audio/mpeg",
                "Content-Length": combinedAudio.length.toString(),
            },
        });

    } catch (error: any) {
        console.error("Google Cloud TTS Error:", error);

        // Check for common credential errors
        if (error.message?.includes("Could not load the default credentials")) {
            return NextResponse.json(
                { error: "Google Cloud Credentials missing. Please add google-credentials.json to project root." },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Error generating speech", details: error.message },
            { status: 500 }
        );
    }
}
