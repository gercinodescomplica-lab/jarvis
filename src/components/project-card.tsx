import Link from 'next/link';
import { ExternalLink, Calendar, Users, AlertTriangle, TrendingUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectData } from '@/lib/n8n';
import { NotionProject } from '@/lib/notion-service';

interface ProjectCardProps {
    project: ProjectData | NotionProject;
}

export function ProjectCard({ project }: ProjectCardProps) {
    // Normalization Layer
    const p = {
        name: 'title' in project ? project.title : (project as any).name,
        status: project.status,
        urgency: 'urgency' in project ? project.urgency : (project as any).urgencia,
        risk: 'risk' in project ? project.risk : (project as any).risco,
        importance: 'importance' in project ? project.importance : (project as any).importancia,
        roi: 'roi' in project ? project.roi : (project as any).roi,
        // @ts-ignore - Handle missing type in NotionProject gracefully
        type: 'tipo' in project ? (project as any).tipo : (project as any).type || 'Projeto',
        description: 'description' in project ? (project as any).description : '',
        deadline: project.deadline,
        responsavel: project.responsavel || [],
        details: 'details' in project ? (project as any).details : '', // NotionProject might not have details unless fetched
        url: project.url
    };

    return (
        <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden my-4">
            {/* Header */}
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100 flex items-center justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className={cn(
                        "text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap shrink-0",
                        getDataStatusColor(p.status)
                    )}>
                        {p.status}
                    </span>
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {p.type}
                </p>
                {p.description && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-3 leading-relaxed border-t border-dotted border-neutral-200 dark:border-neutral-700 pt-2">
                        {p.description}
                    </p>
                )}
            </div>

            {/* Body Statistics */}
            <div className="p-4 grid grid-cols-2 gap-4">
                <StatBadge label="Urgência" value={p.urgency} icon={<AlertTriangle className="w-3 h-3" />} />
                <StatBadge label="Risco" value={p.risk} icon={<AlertTriangle className="w-3 h-3" />} />
                <StatBadge label="ROI" value={p.roi} icon={<TrendingUp className="w-3 h-3" />} />
                <StatBadge label="Importância" value={p.importance} icon={<Target className="w-3 h-3" />} />
            </div>

            {/* Footer Details */}
            <div className="p-4 pt-0 space-y-3">
                {/* Deadline */}
                <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-400">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="font-medium mr-1">Deadline:</span>
                    <span>{p.deadline || "—"}</span>
                </div>

                {/* Responsibles */}
                <div className="flex items-start">
                    <Users className="w-4 h-4 mr-2 mt-0.5 text-neutral-600 dark:text-neutral-400" />
                    <div className="flex flex-wrap gap-1">
                        {p.responsavel.map((person, idx) => (
                            <span key={idx} className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs px-2 py-0.5 rounded-md">
                                {person}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Extended Details / Body Content */}
                {p.details && (
                    <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                        <h4 className="text-xs font-semibold uppercase text-neutral-500 mb-2 tracking-wider">Detalhes & Tarefas</h4>
                        <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed font-mono text-xs bg-neutral-50 dark:bg-neutral-900/50 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                            {p.details}
                        </div>
                    </div>
                )}
            </div>

            {/* Action */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-800">
                <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                    Abrir no Notion
                    <ExternalLink className="w-4 h-4 ml-2" />
                </a>
            </div>
        </div>
    );
}

function StatBadge({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    if (!value) return null; // Hide empty stats
    return (
        <div className="flex flex-col">
            <span className="text-xs text-neutral-500 dark:text-neutral-500 mb-0.5 flex items-center gap-1">
                {icon} {label}
            </span>
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                {value}
            </span>
        </div>
    )
}

function getDataStatusColor(status: string) {
    if (!status) return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700";
    const s = status.toLowerCase();
    if (s.includes('concluído') || s.includes('entregue') || s.includes('resolvido')) return "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20";
    if (s.includes('andamento') || s.includes('progress')) return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20";
    if (s.includes('atrasado') || s.includes('crítico') || s.includes('risco')) return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20";
    if (s.includes('não iniciado')) return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
    return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700";
}
