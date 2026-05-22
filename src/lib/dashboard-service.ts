// Integration with the commercial dashboard (DRM) external API.

function baseUrl() {
    const url = process.env.EXTERNAL_API_BASE_URL;
    if (!url) throw new Error('EXTERNAL_API_BASE_URL is not configured.');
    return url.replace(/\/$/, '');
}

function apiKey() {
    const key = process.env.EXTERNAL_API_KEY;
    if (!key) throw new Error('EXTERNAL_API_KEY is not configured.');
    return key;
}

function authHeaders() {
    return {
        'Authorization': `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
    };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CXItem = {
    id?: number;
    cliente?: string;
    titulo?: string;
    problema?: string;
    solucaoProposta?: string;
    criticidade?: 'baixa' | 'media' | 'alta';
    status?: 'pendente' | 'analise' | 'resolvido';
    isVisible?: boolean;
};

export type VisitItem = {
    id?: number;
    titulo?: string;
    local?: string;
    motivo?: string;
    data?: string;        // YYYY-MM-DD
    dataFim?: string;     // YYYY-MM-DD, must be >= data
};

export type ProjectItem = {
    id?: number;
    name?: string;
    quarter?: 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado';
    value?: number;
    orgao?: string;
    temperature?: 'quente' | 'morno' | 'frio' | 'contratado' | 'historico' | 'perdido';
    description?: string;
};

export type SyncPayload = {
    managerId: string;
    cx?: { upsert?: CXItem[]; delete?: number[] };
    visits?: { upsert?: VisitItem[]; delete?: number[] };
    projects?: { upsert?: ProjectItem[]; delete?: number[] };
};

type EntitySummary = { created: number; updated: number; deleted: number };
type SyncResult = {
    success: true;
    summary: { cx: EntitySummary; visits: EntitySummary; projects: EntitySummary };
};

// ─── resolveManagerId ─────────────────────────────────────────────────────────
// Looks up the managerId from the grc_users table stored in Jarvis's own Supabase.

export async function resolveManagerId(rawPhone: string): Promise<string | null> {
    const phone = rawPhone.replace(/\D/g, '');
    try {
        const { createClient } = await import('@supabase/supabase-js');
        const db = createClient(
            `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        const { data } = await db
            .from('grc_users')
            .select('manager_id, active')
            .eq('phone', phone)
            .maybeSingle();
        if (!data || !data.active) return null;
        return data.manager_id as string;
    } catch {
        return null;
    }
}

// ─── syncManagerData ──────────────────────────────────────────────────────────

export async function syncManagerData(payload: SyncPayload): Promise<SyncResult> {
    console.log('[GRC Sync] payload:', JSON.stringify(payload, null, 2));
    const res = await fetch(`${baseUrl()}/api/external/v1/grc/sync`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[GRC Sync] error response:', res.status, errText);
        let errMsg: string;
        try { errMsg = JSON.parse(errText)?.error ?? errText; } catch { errMsg = errText; }
        throw new Error(`Sync failed (${res.status}): ${errMsg}`);
    }

    return res.json();
}

// ─── syncWithFeedback ─────────────────────────────────────────────────────────

export async function syncWithFeedback(payload: SyncPayload): Promise<string> {
    try {
        const result = await syncManagerData(payload);
        const { cx, visits, projects } = result.summary;

        const lines: string[] = [];

        if (cx.created || cx.updated || cx.deleted)
            lines.push(`CX: ${cx.created} criado(s), ${cx.updated} atualizado(s), ${cx.deleted} removido(s)`);
        if (visits.created || visits.updated || visits.deleted)
            lines.push(`Visitas: ${visits.created} criada(s), ${visits.updated} atualizada(s), ${visits.deleted} removida(s)`);
        if (projects.created || projects.updated || projects.deleted)
            lines.push(`Projetos: ${projects.created} criado(s), ${projects.updated} atualizado(s), ${projects.deleted} removido(s)`);

        return lines.length > 0
            ? `✅ Salvo no dashboard!\n${lines.join('\n')}`
            : '✅ Nenhuma alteração necessária.';
    } catch (err: any) {
        const detail = err?.message ? `\n_Detalhe: ${err.message}_` : '';
        return `⚠️ Não consegui salvar os dados agora. Nenhuma informação foi alterada.${detail}\n\nTente novamente ou verifique se o dashboard está acessível.`;
    }
}
