import { configure } from '@trigger.dev/sdk/v3';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

configure({ secretKey: process.env.TRIGGER_SECRET_KEY! });

async function checkDelayed() {
  try {
    const { runs: runsClient } = await import('@trigger.dev/sdk/v3');
    const page = await runsClient.list({ 
      limit: 10,
      status: ['DELAYED', 'QUEUED', 'EXECUTING', 'COMPLETED', 'CANCELED', 'FAILED', 'CRASHED', 'SYSTEM_FAILURE'] as any
    });
    console.log("Delayed runs count:", page.data.length);
    console.log("First:", page.data[0]?.status, page.data[0]?.id);

  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

checkDelayed();
