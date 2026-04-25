import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
    const { id } = params; // In Next.js 15+ params is async, but 14 and earlier it is sync. 16.1 params is async prop wait.
    // Wait, "next": "16.1.1" -> params is async.
    // Need to await params.

    // Correction: Next 15+ params awaited.
    const resolvedParams = await params;
    const project = await db.getProject(resolvedParams.id);

    // Ideally db.getProjectById(id)

    if (!project) return <div>Project not found</div>;

    const tasks = await db.getTasksByProject(project.id);
    // Messages? DB adapter doesn't expose getMessagesByProject yet properly in interface, 
    // but we can add it or just ignore for MVP list.

    return (
        <div className="container mx-auto py-10">
            <Link href="/projects" className="text-blue-500 hover:underline mb-4 block">&larr; Back to Projects</Link>

            <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
            <div className="flex gap-4 mb-8">
                <span className="bg-slate-100 px-3 py-1 rounded">{project.status}</span>
                {project.notionId && <span className="text-gray-500">Notion ID: {project.notionId}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-semibold mb-4">Tasks</h2>
                    <div className="space-y-2">
                        {tasks.map(t => (
                            <div key={t.id} className="p-3 border rounded flex justify-between items-center">
                                <span>{t.title}</span>
                                <span className="text-xs px-2 py-1 bg-gray-100 rounded">{t.status}</span>
                            </div>
                        ))}
                        {tasks.length === 0 && <p className="text-gray-400">No tasks.</p>}
                    </div>
                </div>

                {/* Messages placeholder */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
                    <p className="text-gray-500 italic">Not implemented in MVP view.</p>
                </div>
            </div>
        </div>
    );
}
