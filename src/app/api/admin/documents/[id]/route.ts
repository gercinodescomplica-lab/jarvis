import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';
import { saveDocument } from '@/lib/memory-service';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;
  const { id } = await params;
  const [{ data: doc }, { data: chunks }] = await Promise.all([
    supabase.from('documents').select('*').eq('id', id).single(),
    supabase.from('document_chunks').select('id, chunk_index, content, document_title').eq('document_id', id).order('chunk_index'),
  ]);
  return NextResponse.json({ doc, chunks });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;
  const { id } = await params;
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction('delete_document', id, {});
  return NextResponse.json({ success: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;
  const { id } = await params;

  const url = new URL(req.url);
  if (url.pathname.split('/').pop() !== 'reprocess') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Busca documento original
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .select('filename, uploader_phone')
    .eq('id', id)
    .single();
  if (docErr || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  // Deleta chunks antigos
  await supabase.from('document_chunks').delete().eq('document_id', id);

  // Nota: para reprocessar precisamos do buffer original. Sem object storage, esta
  // operação requer que o usuário reenvie o arquivo. Retornamos instrução clara.
  return NextResponse.json({
    error: 'Reprocessing requires the original file. Please re-upload the PDF to regenerate chunks.',
    document: { id, filename: doc.filename }
  }, { status: 422 });
}
