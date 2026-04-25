import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { configure, runs } from '@trigger.dev/sdk/v3';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  configure({ secretKey: process.env.TRIGGER_SECRET_KEY! });

  try {
    const page = await runs.list({ 
      taskIdentifier: 'send-reminder', 
      limit: 50,
      status: [
        'DELAYED', 'QUEUED', 'EXECUTING', 
        'COMPLETED', 'CANCELED', 'FAILED', 'CRASHED', 'SYSTEM_FAILURE'
      ] as any
    });
    
    // We try to gracefully fetch payload. In some SDK versions payload is minimal or missing in list() 
    // unless retrieved directly. We'll do a focused retrieval ONLY for pending runs.
    const items = await Promise.all(page.data.map(async (r: any) => {
      let payload = r.payload;
      
      // se é pendente e a payload veio vazia da lista, vamos buscar os detalhes especificos
      if (!payload && ['DELAYED', 'QUEUED', 'EXECUTING'].includes(r.status)) {
        try {
          const details = await runs.retrieve(r.id);
          payload = details.payload;
        } catch { /* erro silencioso caso seja excluido */ }
      }

      return {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        startedAt: r.startedAt,
        payload: payload ?? null,
        delayedUntil: r.delayedUntil ?? null,
      };
    }));
    return NextResponse.json(items);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
