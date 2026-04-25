import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAuthorization, parseReminder } from '../src/app/api/evolution/webhook/route';
import { supabase } from '../src/db';
import * as aiProvider from '../src/lib/ai-provider';

// Mocks
vi.mock('../src/db', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
        ilike: vi.fn(() => ({
          maybeSingle: vi.fn()
        }))
      })),
    })),
  },
}));

// Mock permissions.json
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(() => JSON.stringify({
      users: { "5511999999999": {} },
      groups: { "123@g.us": true }
    })),
  };
});

// Mock generateText for parseReminder
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(async ({ prompt }: any) => {
      if (prompt.includes('amanhã')) {
        return { text: JSON.stringify({ what: 'comprar pao', when: Date.now() + 86400000 }) };
      }
      if (prompt.includes('2h30')) {
        return { text: JSON.stringify({ what: 'reuniao', when: Date.now() + 2.5 * 3600 * 1000 }) };
      }
      return { text: JSON.stringify(null) };
    })
  };
});

describe('T2: checkAuthorization', () => {
    it('deve autorizar um usuario via JSON estatico (celular)', async () => {
        const authorized = await checkAuthorization('5511999999999', false, null);
        expect(authorized).toBe(true);
    });

    it('nao deve autorizar um usuario aleatorio', async () => {
        // mock db
        const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        (supabase.from as any).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) });

        const authorized = await checkAuthorization('5511000000000', false, null);
        expect(authorized).toBe(false);
    });

    it('deve autorizar um grupo registrado no JSON', async () => {
        const authorized = await checkAuthorization('', true, '123@g.us');
        expect(authorized).toBe(true);
    });
});

describe('T1: parseReminder', () => {
    beforeEach(() => {
        vi.spyOn(aiProvider, 'getModel').mockImplementation(() => ({} as any));
    });

    it('deve fazer parser de "amanhã"', async () => {
        const result = await parseReminder('me lembre de comprar pao amanhã de manha');
        expect(result).not.toBeNull();
        expect(result?.what).toBe('comprar pao');
    });

    it('deve fazer parser de "daqui a 2h30"', async () => {
        const result = await parseReminder('lembrete reuniao daqui a 2h30');
        expect(result).not.toBeNull();
        expect(result?.what).toBe('reuniao');
    });

    it('deve ignorar textos sem data ou sem sentido', async () => {
        const result = await parseReminder('me lembra de testar isso dps');
        expect(result).toBeNull();
    });
});
