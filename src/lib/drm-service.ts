/**
 * DRM Service — fetches commercial dashboard data from the external API.
 * Results are cached in-memory for 24 hours to avoid repeated calls.
 */

const DRM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let cache: { data: DRMApiResponse; fetchedAt: number } | null = null;

export interface DRMProject {
    name: string;
    value: number;
    temperature: 'quente' | 'morno' | 'frio';
}

export interface DRMQuarter {
    total: number;
    projects: DRMProject[];
}

export interface DRMManager {
    name: string;
    role: string;
    meta: number;
    contratado: number;
    forecastFinal: number;
    servedClients: string[];
    pipeline: {
        q1?: DRMQuarter;
        q2?: DRMQuarter;
        q3?: DRMQuarter;
        q4?: DRMQuarter;
        nao_mapeado?: DRMQuarter;
    };
    cx: Array<{
        status: 'pendente' | 'analise' | 'resolvido';
        criticidade: 'baixa' | 'media' | 'alta';
        descricao?: string;
    }>;
    visits: Array<{
        titulo: string;
        local?: string;
        motivo?: string;
        data: string;
        dataFim?: string;
    }>;
}

export interface DRMSummary {
    totalManagers: number;
    totalMeta: number;
    totalContratado: number;
    totalForecast: number;
    totalVisits: number;
    totalCXItems: number;
}

export interface DRMApiResponse {
    success: boolean;
    timestamp: string;
    summary: DRMSummary;
    data: DRMManager[];
}

// ─── Contracts ───────────────────────────────────────────────────────────────

export interface Contract {
    id: string;
    numeroContrato: string;
    protheus?: string;
    cliente: string;
    vlContratado: number;
    vlFaturado?: number;
    vlSaldo: number;
    tipo?: string;
    situacao?: string;
    vigente: boolean;
    gerencia: string;
    nomeGerente?: string;
    objeto?: string;
    dtFimVigencia?: string;
}

export interface ContractsSummary {
    total: number;
    vigentes: number;
    vencidos: number;
    totalVlContratado: number;
    totalVlFaturado: number;
    totalVlSaldo: number;
}

export interface ContractsApiResponse {
    success: boolean;
    timestamp: string;
    summary: ContractsSummary;
    data: Contract[];
}

export interface FetchContractsParams {
    search?: string;
    gerencia?: string;
    vigente?: boolean;
    tipo?: string;
}

export async function fetchContracts(params: FetchContractsParams = {}): Promise<ContractsApiResponse> {
    const baseUrl = process.env.EXTERNAL_API_BASE_URL;
    const apiKey = process.env.EXTERNAL_API_KEY;

    if (!baseUrl || !apiKey) {
        throw new Error('EXTERNAL_API_BASE_URL or EXTERNAL_API_KEY is not configured.');
    }

    const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/external/v1/contracts`);
    if (params.search) url.searchParams.set('search', params.search);
    if (params.gerencia) url.searchParams.set('gerencia', params.gerencia);
    if (params.vigente !== undefined) url.searchParams.set('vigente', String(params.vigente));
    if (params.tipo) url.searchParams.set('tipo', params.tipo);

    console.log(`[DRM Service] Fetching contracts from: ${url}`);

    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Contracts API responded with ${res.status}: ${res.statusText}`);
    }

    const json: ContractsApiResponse = await res.json();

    if (!json.success) {
        throw new Error('Contracts API returned success=false');
    }

    return json;
}

/**
 * Fetches DRM data from the external API.
 * Uses a 5-minute in-memory cache.
 */
export async function fetchDRMData(): Promise<DRMApiResponse> {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < DRM_CACHE_TTL_MS) {
        console.log('[DRM Service] Returning cached data.');
        return cache.data;
    }

    const baseUrl = process.env.EXTERNAL_API_BASE_URL;
    const apiKey = process.env.EXTERNAL_API_KEY;

    if (!baseUrl || !apiKey) {
        throw new Error('EXTERNAL_API_BASE_URL or EXTERNAL_API_KEY is not configured.');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/external/v1/data`;
    console.log(`[DRM Service] Fetching from: ${url}`);

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        // Do not cache at the HTTP level; we handle caching ourselves
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`DRM API responded with ${res.status}: ${res.statusText}`);
    }

    const json: DRMApiResponse = await res.json();

    if (!json.success) {
        throw new Error('DRM API returned success=false');
    }

    cache = { data: json, fetchedAt: now };
    return json;
}

/**
 * Formats DRM data as a context string to inject into the system prompt.
 * Automatically scopes the data to avoid sending the entire payload when
 * only a subset is needed — but always includes the summary for macro questions.
 */
export function formatDRMContext(drmData: DRMApiResponse, userQuery: string): string {
    const lower = userQuery.toLowerCase();
    const { summary, data } = drmData;

    const fmt = (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // ── Summary block (always injected) ──────────────────────────────────────
    const summaryBlock = `
## RESUMO GERAL DRM (fonte: API externa — use estes valores para respostas macro)
- Total de Gerentes: ${summary.totalManagers}
- Meta Total da DRM: ${fmt(summary.totalMeta)}
- Total Contratado: ${fmt(summary.totalContratado)}
- Forecast Total: ${fmt(summary.totalForecast)}
- Atingimento Geral: ${((summary.totalForecast / summary.totalMeta) * 100).toFixed(1)}%
- GAP a Contratar: ${fmt(summary.totalMeta - summary.totalContratado)}
- Total de Visitas: ${summary.totalVisits}
- Total de Chamados CX: ${summary.totalCXItems}
Timestamp da API: ${drmData.timestamp}
`.trim();

    // ── Decide which managers to include ─────────────────────────────────────
    let managersToInclude: DRMManager[] = [];

    // Try to find a specific manager mentioned in the query
    const mentionedManager = data.find(m =>
        lower.includes(m.name.toLowerCase()) ||
        m.name.toLowerCase().split(' ').some(part => part.length > 3 && lower.includes(part))
    );

    if (mentionedManager) {
        managersToInclude = [mentionedManager];
    } else {
        // If no specific manager → include all (for ranking, totals, comparisons)
        managersToInclude = data;
    }

    const managersBlock = managersToInclude.map(m => {
        const atingimento = m.meta > 0
            ? ((m.forecastFinal / m.meta) * 100).toFixed(1)
            : '0.0';
        const gap = m.meta - m.contratado;

        const pipelineQuarters = ['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const;
        const pipelineSummary = pipelineQuarters
            .filter(q => m.pipeline[q] && m.pipeline[q]!.total > 0)
            .map(q => {
                const quarter = m.pipeline[q]!;
                const hotProjects = quarter.projects
                    .filter(p => p.temperature === 'quente')
                    .map(p => `      - ${p.name}: ${fmt(p.value)} [QUENTE]`).join('\n');
                const warmProjects = quarter.projects
                    .filter(p => p.temperature === 'morno')
                    .map(p => `      - ${p.name}: ${fmt(p.value)} [MORNO]`).join('\n');
                const coldProjects = quarter.projects
                    .filter(p => p.temperature === 'frio')
                    .map(p => `      - ${p.name}: ${fmt(p.value)} [FRIO]`).join('\n');
                const allProjectLines = [hotProjects, warmProjects, coldProjects]
                    .filter(Boolean).join('\n');
                return `    ${q.toUpperCase()} — Total: ${fmt(quarter.total)}\n${allProjectLines}`;
            }).join('\n');

        const clientsList = m.servedClients.length > 0
            ? m.servedClients.map(c => `    - ${c}`).join('\n')
            : '    (nenhum cliente cadastrado)';

        const pendingCX = m.cx.filter(c => c.status === 'pendente').length;
        const highCX = m.cx.filter(c => c.criticidade === 'alta').length;

        const visitsList = m.visits.length > 0
            ? m.visits.map(v => `    - ${v.data}${v.dataFim ? ` até ${v.dataFim}` : ''}: ${v.titulo}${v.local ? ` (${v.local})` : ''}`).join('\n')
            : '    (nenhuma visita registrada)';

        return `
### Gerente: ${m.name} (${m.role})
- Meta: ${fmt(m.meta)}
- Contratado: ${fmt(m.contratado)}
- Forecast Final: ${fmt(m.forecastFinal)}
- Atingimento: ${atingimento}%
- GAP: ${fmt(gap)}
- Clientes Atendidos (carteira):
${clientsList}
- Pipeline:
${pipelineSummary || '    (sem pipeline cadastrado)'}
- CX: ${m.cx.length} chamados (${pendingCX} pendentes, ${highCX} de criticidade alta)
- Visitas: ${m.visits.length} registradas
${visitsList}
`.trim();
    }).join('\n\n');

    return `
\n\n--- DADOS COMERCIAIS DRM (USE ESTRITAMENTE ESTES DADOS — NÃO INVENTE VALORES) ---

${summaryBlock}

## DETALHES POR GERENTE
${managersBlock}

--- FIM DOS DADOS DRM ---\n\n
`.trim();
}

