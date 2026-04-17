import { schedules } from '@trigger.dev/sdk/v3';
import { monitorarEmailsChave } from '../cron/email-monitor';

export const emailMonitorTask = schedules.task({
  id: 'monitorar-emails-chave',
  cron: '*/10 * * * *', // a cada 10 minutos
  run: async () => {
    console.log('[EmailMonitor] Iniciando verificação de emails...');
    await monitorarEmailsChave();
    console.log('[EmailMonitor] Verificação concluída.');
  },
});
