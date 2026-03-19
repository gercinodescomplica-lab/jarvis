import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testTurso() {
  console.log('🔌 Conectando ao Turso...');
  console.log('URL:', process.env.TURSO_DATABASE_URL);

  try {
    // 1. Listar tabelas existentes
    const tables = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table'`
    );
    console.log('\n📋 Tabelas existentes:');
    if (tables.rows.length === 0) {
      console.log('  (nenhuma tabela encontrada)');
    } else {
      tables.rows.forEach(row => console.log('  -', row.name));
    }

    // 2. Contar registros nas tabelas principais
    const tableNames = ['chats', 'whitelist', 'documents', 'document_chunks', 'memories'];
    console.log('\n📊 Contagem de registros:');
    for (const table of tableNames) {
      try {
        const count = await client.execute(`SELECT COUNT(*) as total FROM ${table}`);
        console.log(`  ${table}: ${count.rows[0].total} registros`);
      } catch {
        console.log(`  ${table}: tabela não existe ainda`);
      }
    }

    // 3. Testar inserção e leitura na tabela chats
    console.log('\n✏️  Testando inserção em chats...');
    const testId = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO chats (id, phone, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [testId, '+5511999999999', 'user', 'Teste de conexão Turso', Date.now()],
    });
    console.log('  Inserção OK, id:', testId);

    const row = await client.execute({
      sql: `SELECT * FROM chats WHERE id = ?`,
      args: [testId],
    });
    console.log('  Leitura OK:', row.rows[0]);

    // Limpar registro de teste
    await client.execute({ sql: `DELETE FROM chats WHERE id = ?`, args: [testId] });
    console.log('  Limpeza OK');

    console.log('\n✅ Turso funcionando corretamente!');
  } catch (err) {
    console.error('\n❌ Erro:', err);
  } finally {
    client.close();
  }
}

testTurso();
