/**
 * Tool Middleware — adiciona cache, observabilidade e fallback a qualquer tool do AI SDK.
 *
 * COMO FUNCIONA:
 *
 * 1. CACHE: Cada chamada de tool gera uma "cache key" baseada nos parâmetros.
 *    Se a mesma chamada foi feita dentro do TTL (ex: 5 minutos), retorna o
 *    resultado anterior sem bater na API externa. Isso economiza tempo e custo.
 *
 * 2. OBSERVABILIDADE: Toda execução loga:
 *    - Nome da tool
 *    - Parâmetros recebidos
 *    - Tempo de execução (ms)
 *    - Se foi cache HIT ou MISS
 *    - Se deu erro
 *
 * 3. FALLBACK: Se a tool falha, retorna um objeto de erro amigável em vez de
 *    crashar todo o fluxo do agente. O LLM recebe o erro e pode informar o
 *    usuário ou tentar outra abordagem.
 */

import { tool, jsonSchema } from 'ai';

// ─── Cache em memória ────────────────────────────────────────────────────────

interface CacheEntry {
    data: unknown;
    createdAt: number;
}

// Map global: "toolName:hash" → { data, createdAt }
const cache = new Map<string, CacheEntry>();

/**
 * Gera uma chave de cache a partir do nome da tool + parâmetros.
 * Usa JSON.stringify nos params pra criar uma chave determinística.
 * Ex: "getDRMData:{"query":"meta da drm"}" → sempre a mesma key pra mesma pergunta.
 */
function makeCacheKey(toolName: string, params: unknown): string {
    return `${toolName}:${JSON.stringify(params)}`;
}

/**
 * Busca no cache. Retorna o dado se existir e não tiver expirado.
 * Se expirou, deleta a entrada e retorna null.
 */
function getFromCache(key: string, ttlMs: number): unknown | null {
    const entry = cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.createdAt;
    if (age > ttlMs) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

/**
 * Salva no cache.
 */
function setCache(key: string, data: unknown): void {
    cache.set(key, { data, createdAt: Date.now() });
}

/**
 * Limpa entradas expiradas do cache (garbage collection).
 * Roda a cada 10 minutos pra não acumular lixo na memória.
 */
function cleanExpiredEntries(maxAgeMs: number = 60 * 60 * 1000) {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now - entry.createdAt > maxAgeMs) {
            cache.delete(key);
        }
    }
}

// GC automático a cada 10 minutos
setInterval(() => cleanExpiredEntries(), 10 * 60 * 1000);

// ─── Stats (observabilidade simples) ─────────────────────────────────────────

interface ToolStats {
    calls: number;
    cacheHits: number;
    errors: number;
    totalTimeMs: number;
}

const stats = new Map<string, ToolStats>();

function getStats(toolName: string): ToolStats {
    if (!stats.has(toolName)) {
        stats.set(toolName, { calls: 0, cacheHits: 0, errors: 0, totalTimeMs: 0 });
    }
    return stats.get(toolName)!;
}

/**
 * Retorna as estatísticas acumuladas de todas as tools.
 * Útil pra um endpoint /api/tools/stats ou pra debug.
 */
export function getAllStats(): Record<string, ToolStats & { avgTimeMs: number; cacheHitRate: string }> {
    const result: Record<string, ToolStats & { avgTimeMs: number; cacheHitRate: string }> = {};
    for (const [name, s] of stats.entries()) {
        result[name] = {
            ...s,
            avgTimeMs: s.calls > 0 ? Math.round(s.totalTimeMs / s.calls) : 0,
            cacheHitRate: s.calls > 0 ? `${Math.round((s.cacheHits / s.calls) * 100)}%` : '0%',
        };
    }
    return result;
}

// ─── Wrapper principal ───────────────────────────────────────────────────────

interface CachedToolOptions {
    /** Nome da tool (pra logs e cache key) */
    name: string;
    /** Descrição pro LLM saber quando usar */
    description: string;
    /** Schema de input (mesmo que você já usa no tool()) */
    inputSchema: ReturnType<typeof jsonSchema>;
    /** A função que realmente faz o trabalho */
    execute: (params: any) => Promise<any>;
    /** Tempo de vida do cache em milissegundos. 0 = sem cache (pra write operations) */
    cacheTtlMs?: number;
}

/**
 * Cria uma tool com cache + logging + fallback.
 *
 * Uso:
 *   const myTool = cachedTool({
 *     name: 'getDRMData',
 *     description: '...',
 *     inputSchema: jsonSchema<{ query: string }>({...}),
 *     execute: async ({ query }) => { ... },
 *     cacheTtlMs: 5 * 60 * 1000, // 5 minutos
 *   });
 *
 * O que muda vs tool() puro:
 *   - Se a mesma chamada foi feita dentro do TTL, retorna cache (instantâneo)
 *   - Loga tempo, hit/miss, erros
 *   - Se crashar, retorna { error: "..." } em vez de explodir
 */
export function cachedTool({
    name,
    description,
    inputSchema: schema,
    execute,
    cacheTtlMs = 0,
}: CachedToolOptions) {
    return tool({
        description,
        inputSchema: schema,
        execute: async (params: any) => {
            const s = getStats(name);
            s.calls++;

            const start = Date.now();

            // 1. Checa cache (só se TTL > 0)
            if (cacheTtlMs > 0) {
                const key = makeCacheKey(name, params);
                const cached = getFromCache(key, cacheTtlMs);
                if (cached !== null) {
                    s.cacheHits++;
                    const elapsed = Date.now() - start;
                    s.totalTimeMs += elapsed;
                    console.log(`[Tool] ${name} — CACHE HIT (${elapsed}ms)`);
                    return cached;
                }
            }

            // 2. Executa a tool de verdade
            try {
                const result = await execute(params);
                const elapsed = Date.now() - start;
                s.totalTimeMs += elapsed;

                // Salva no cache se tem TTL
                if (cacheTtlMs > 0) {
                    const key = makeCacheKey(name, params);
                    setCache(key, result);
                }

                console.log(`[Tool] ${name} — OK (${elapsed}ms)${cacheTtlMs > 0 ? ' CACHE MISS' : ''}`);
                return result;
            } catch (err: any) {
                const elapsed = Date.now() - start;
                s.totalTimeMs += elapsed;
                s.errors++;

                console.error(`[Tool] ${name} — ERROR (${elapsed}ms):`, err.message || err);

                // Retorna erro amigável pro LLM em vez de crashar
                return { error: `Falha ao executar ${name}: ${err.message || 'erro desconhecido'}` };
            }
        },
    });
}
