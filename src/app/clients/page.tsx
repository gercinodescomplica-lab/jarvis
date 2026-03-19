'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button'; // Assuming this exists based on file list
import { Input } from '@/components/ui/input';   // Assuming this exists

type User = {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    usage: number;
};

export default function ClientsPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/users')
            .then((res) => res.json())
            .then((data) => {
                setUsers(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch users', err);
                setLoading(false);
            });
    }, []);

    const filteredUsers = users.filter((user) =>
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-2 text-foreground">
                            Clientes & Usuários
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            Gerencie o acesso e monitore o uso da plataforma.
                        </p>
                    </div>
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transition-all hover:scale-105">
                        + Novo Usuário
                    </Button>
                </div>

                <div className="bg-card/50 border border-border rounded-xl backdrop-blur-sm overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-border flex items-center gap-4">
                        <Input
                            placeholder="Buscar por nome ou email..."
                            className="max-w-sm bg-background/50 border-input focus:ring-2 focus:ring-ring transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground font-semibold tracking-wider">
                                <tr>
                                    <th scope="col" className="px-6 py-4">Nome Org/Usuário</th>
                                    <th scope="col" className="px-6 py-4">Email</th>
                                    <th scope="col" className="px-6 py-4">Role</th>
                                    <th scope="col" className="px-6 py-4">Status</th>
                                    <th scope="col" className="px-6 py-4 text-right">Uso (reqs)</th>
                                    <th scope="col" className="px-6 py-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground animate-pulse">
                                            Carregando dados...
                                        </td>
                                    </tr>
                                ) : filteredUsers.length > 0 ? (
                                    filteredUsers.map((user) => (
                                        <tr key={user.id} className="bg-card hover:bg-muted/50 transition-colors duration-200">
                                            <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                                                {user.name}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {user.email}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.status === 'Active'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                    }`}>
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-muted-foreground font-mono">
                                                {user.usage}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button className="text-primary hover:text-primary/80 font-medium text-sm transition-colors">
                                                    Editar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                                            Nenhum usuário encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
