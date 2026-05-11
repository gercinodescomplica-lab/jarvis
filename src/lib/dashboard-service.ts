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

export async function resolveManagerId(rawPhone: string): Promise<string | null> {
    const phone = rawPhone.replace(/\D/g, '');
    try {
        const res = await fetch(
            `${baseUrl()}/api/external/v1/users/phone/${phone}`,
            { headers: { 'Authorization': `Bearer ${apiKey()}` } }
        );
        if (!res.ok) return null;
        const { data } = await res.json();
        if (!data?.active) return null;
        return data.managerId as string | null;
    } catch {
        return null;
    }
}

// ─── syncManagerData ──────────────────────────────────────────────────────────

export async function syncManagerData(payload: SyncPayload): Promise<SyncResult> {
    const res = await fetch(`${baseUrl()}/api/external/v1/grc/sync`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Sync failed (${res.status}): ${err.error ?? res.statusText}`);
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
    } catch {
        return '⚠️ Não consegui salvar os dados agora. Nenhuma informação foi alterada. Tente novamente mais tarde.';
    }
}
