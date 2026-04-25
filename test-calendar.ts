// Teste Manual (Simula as 18:00)
import 'dotenv/config';
import { getAgendaSemana, enviarAvisoWhatsApp } from './src/cron/agenda';

async function testCron() {
    console.log("Simulando trigger do CRON 18h...");
    const relatorio = await getAgendaSemana();
    console.log("\nRELATÓRIO GERADO:");
    console.log(relatorio);
    console.log("\nEnviando para o WhatsApp...");
    await enviarAvisoWhatsApp('5511949633602', relatorio);
}

testCron();
