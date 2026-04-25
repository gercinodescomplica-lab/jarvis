'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    setLoading(false);

    if (res.ok) {
      router.push('/admin');
    } else {
      setError('Token inválido. Tente novamente.');
      setToken('');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <div className="text-4xl mb-3">⚡</div>
          <h1 className="text-2xl font-extrabold text-foreground">Jarvis Admin</h1>
          <p className="text-sm text-muted-foreground">Insira o token de acesso</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="adm_..."
            autoFocus
            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all font-mono"
          />

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
