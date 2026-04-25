import * as dotenv from 'dotenv';
dotenv.config();

// ── GEMINI ───────────────────────────────────────────────────────────────────
async function testGemini() {
  console.log('\n=== GEMINI ===');
  console.log('Key:', process.env.GEMINI_API_KEY?.slice(0, 20) + '...');
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text: 'teste' }], role: 'user' }, outputDimensionality: 768 }),
      }
    );
    const json = await res.json();
    if (res.ok) {
      console.log('✅ Gemini OK — embedding length:', json.embedding?.values?.length);
    } else {
      console.error('❌ Gemini ERRO:', JSON.stringify(json.error));
    }
  } catch (e) {
    console.error('❌ Gemini exception:', e.message);
  }
}

// ── AZURE ────────────────────────────────────────────────────────────────────
const AZURE_VERSIONS = [
  '2025-04-01-preview',
  '2025-03-01-preview',
  '2025-01-01-preview',
  '2024-12-01-preview',
  '2024-10-21',
  '2024-08-01-preview',
  '2024-05-01-preview',
  '2024-02-01',
];

async function testAzureVersion(version) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1-mini';
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
    });
    const json = await res.json();
    if (res.ok) {
      return { ok: true, version, reply: json.choices?.[0]?.message?.content };
    } else {
      return { ok: false, version, error: json.error?.message };
    }
  } catch (e) {
    return { ok: false, version, error: e.message };
  }
}

async function testAzure() {
  console.log('\n=== AZURE OPENAI ===');
  console.log('Endpoint:', process.env.AZURE_OPENAI_ENDPOINT);
  console.log('Deployment:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
  for (const v of AZURE_VERSIONS) {
    const r = await testAzureVersion(v);
    if (r.ok) {
      console.log(`✅ ${v} — reply: "${r.reply}"`);
      console.log(`\n👉 USE: AZURE_OPENAI_API_VERSION=${v}`);
      return v;
    } else {
      console.log(`❌ ${v} — ${r.error}`);
    }
  }
  console.log('\n⚠️  Nenhuma versão funcionou. Verifique o deployment no Azure Portal.');
}

await testGemini();
await testAzure();
