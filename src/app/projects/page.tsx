import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
    const projects = await db.getProjects();

    return (
        <div className="container mx-auto py-10">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Projects</h1>
                <Link href="/admin/settings" className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-700">
                    Settings
                </Link>
            </div>
            <div className="grid gap-4">
                {projects.map((p) => (
                    <Link key={p.id} href={`/projects/${p.id}`}>
                        <div className="p-6 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-slate-950">
                            <h2 className="text-xl font-semibold">{p.name}</h2>
                            <div className="flex gap-2 mt-2 text-sm text-gray-500">
                                <span className={`px-2 py-1 rounded-full bg-gray-100 ${p.status === 'Done' ? 'text-green-600' : 'text-blue-600'}`}>
                                    {p.status}
                                </span>
                                <span>Created {new Date(p.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </Link>
                ))}
                {projects.length === 0 && (
                    <p className="text-gray-500">No projects found. Send a message to the bot!</p>
                )}
            </div>
        </div>
    );
}
