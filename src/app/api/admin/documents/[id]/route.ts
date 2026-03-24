import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';

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
  return NextResponse.json({ success: true });
}
