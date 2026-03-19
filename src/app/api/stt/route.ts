import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || 'https://oia-gercinotest.openai.azure.com/';
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
    const deployment = process.env.AZURE_WHISPER_DEPLOYMENT_NAME || 'whisper';
    const azureUrl = `${endpoint}/openai/deployments/${deployment}/audio/transcriptions?api-version=${apiVersion}`;

    console.log(`[Azure Whisper] Transcrevendo ${(file.size / 1024).toFixed(1)} KB`);

    const azureFormData = new FormData();
    azureFormData.append('file', file);
    azureFormData.append('language', 'pt');

    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: { 'api-key': apiKey || '' },
      body: azureFormData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[Azure Whisper Error]', error);
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    console.log(`[Azure Whisper] Resultado: "${data.text?.slice(0, 100)}"`);

    return NextResponse.json({ text: data.text });
  } catch (error: any) {
    console.error('[STT API] Error:', error);
    return NextResponse.json({ error: 'Transcription Failed' }, { status: 500 });
  }
}
