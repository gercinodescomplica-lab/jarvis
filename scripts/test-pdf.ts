/**
 * Testa o pipeline completo de PDF no Supabase:
 * 1. Lê o PDF da pasta temp/
 * 2. Extrai texto, gera embeddings e salva no Supabase
 * 3. Faz uma busca semântica e exibe os resultados
 *
 * Uso: npx tsx scripts/test-pdf.ts [caminho-do-pdf]
 *
 * Exemplos:
 *   npx tsx scripts/test-pdf.ts
 *   npx tsx scripts/test-pdf.ts temp/outro.pdf
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  const pdfArg = process.argv[2];
  const pdfPath = pdfArg
    ? path.resolve(process.cwd(), pdfArg)
    : path.resolve(process.cwd(), 'temp/gri.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF não encontrado: ${pdfPath}`);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const filename = path.basename(pdfPath);
  const uploaderPhone = '5500000000000'; // número fictício para teste

  console.log(`\n📄 PDF: ${filename} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
  console.log(`🗄️  Supabase: ${process.env.SUPABASE_PROJECT_ID}.supabase.co\n`);

  const { saveDocument, searchDocuments } = await import('../src/lib/memory-service');

  // ── Salvar ────────────────────────────────────────────────────────────────
  console.log('━'.repeat(50));
  console.log('FASE 1: Salvando PDF + embeddings no Supabase');
  console.log('━'.repeat(50));

  let docId: string;
  try {
    docId = await saveDocument(pdfBuffer, filename, uploaderPhone);
    console.log(`\n✅ Documento salvo! ID: ${docId}`);
  } catch (err) {
    console.error('\n❌ Erro ao salvar documento:', err);
    process.exit(1);
  }

  // ── Busca semântica ───────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(50));
  console.log('FASE 2: Busca semântica (pgvector)');
  console.log('━'.repeat(50));

  const queries = [
    'informações principais do documento',
    'resumo e conclusões',
  ];

  for (const query of queries) {
    console.log(`\n🔍 Query: "${query}"`);
    try {
      const results = await searchDocuments(query, 3);
      if (results.length === 0) {
        console.log('   (nenhum resultado)');
      } else {
        results.forEach((r, i) => {
          console.log(`\n   [${i + 1}] ${r.slice(0, 250).replace(/\n/g, ' ')}...`);
        });
      }
    } catch (err) {
      console.error(`   ❌ Erro na busca: ${err}`);
    }
  }

  console.log('\n' + '━'.repeat(50));
  console.log('✅ Teste concluído com sucesso!');
  console.log('━'.repeat(50) + '\n');
}

main();
