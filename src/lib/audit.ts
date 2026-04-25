import { supabase } from '@/db';

export async function logAdminAction(
  action: string,
  target: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('admin_logs').insert({
      id: crypto.randomUUID(),
      action,
      target,
      details,
      created_at: Date.now(),
    });
  } catch {
    // Audit failures são silenciosas — não bloqueiam a operação principal
  }
}
