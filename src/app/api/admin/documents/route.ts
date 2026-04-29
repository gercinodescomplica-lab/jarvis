import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';
import { saveDocument } from '@/lib/memory-service';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;
  const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Apenas arquivos PDF são suportados.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const docId = await saveDocument(buffer, file.name, 'admin', true);
  await logAdminAction('upload_global_document', docId, { filename: file.name });
  return NextResponse.json({ id: docId });
}
