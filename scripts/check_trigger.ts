import { configure, runs } from '@trigger.dev/sdk/v3';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

configure({ secretKey: process.env.TRIGGER_SECRET_KEY! });

async function listRuns() {
  try {
    const page = await runs.list({ taskIdentifier: 'send-reminder', limit: 10 });
    console.log("Got page data:", JSON.stringify(page.data, null, 2));

    // Also get the first run details to see if payload is there
    if (page.data.length > 0) {
      const runId = page.data[0].id;
      const details = await runs.retrieve(runId);
      console.log("Run details:", JSON.stringify(details, null, 2));
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

listRuns();
