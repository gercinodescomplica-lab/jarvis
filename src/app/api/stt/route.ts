import { NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';

const speechClient = new SpeechClient();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`[Google STT] Transcrevendo ${(file.size / 1024).toFixed(1)} KB`);

    const arrayBuffer = await file.arrayBuffer();
    const audioBytes = Buffer.from(arrayBuffer).toString('base64');

    const [response] = await speechClient.recognize({
      audio: { content: audioBytes },
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'pt-BR',
      },
    });

    const text = response.results
      ?.map(r => r.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(' ') || '';

    console.log(`[Google STT] Resultado: "${text.slice(0, 100)}"`);

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('[STT API] Error:', error);
    return NextResponse.json({ error: 'Transcription Failed' }, { status: 500 });
  }
}
