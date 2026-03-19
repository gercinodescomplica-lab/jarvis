"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ProjectCard } from "./project-card"
import { CalendarCard } from "./calendar-card"
import { DynamicChart } from "./gen-ui/dynamic-chart"
import { RiskMatrix } from "./gen-ui/risk-matrix"
import { NotionProject } from '@/lib/notion-service'

// Local interface to avoid version conflicts
interface Message {
    id: string
    role: string
    content: string
    toolInvocations?: any[]
}

interface ChatPanelProps {
    messages: Message[]
}

export function ChatPanel({ messages }: ChatPanelProps) {
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    return (
        <div className="flex-1 h-full overflow-y-auto w-full p-4 space-y-6">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                    <p>No messages yet. Start speaking...</p>
                </div>
            )}

            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={cn(
                        "flex w-full flex-col space-y-2",
                        // Align user right, assistant left
                        msg.role === 'user' ? "items-end" : "items-start"
                    )}
                >
                    {/* Text Buffer with Bubble */}
                    {(msg.content || !msg.toolInvocations) && (
                        <div
                            className={cn(
                                "max-w-[80%] p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300",
                                msg.role === 'user'
                                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-tr-none px-4 py-2"
                                    : "bg-white border border-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100 rounded-tl-none"
                            )}
                        >
                            {formatMessage(msg.content)}
                        </div>
                    )}

                    {/* Tool Invocations (Cards) */}
                    {msg.toolInvocations?.map((toolInvocation) => {
                        const { toolName, toolCallId, state } = toolInvocation;

                        // Only render if result is available
                        if (state === 'result') {
                            const { result } = toolInvocation;

                            if (toolName === 'searchProjects' || toolName === 'getOverdueProjects') { // getOverdueProjects might not be its own tool but just in case
                                const projects = Array.isArray(result) ? result : [];
                                return (
                                    <div key={toolCallId} className="w-full max-w-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2">
                                        {projects.map((p: NotionProject) => (
                                            <ProjectCard key={p.id} project={p} />
                                        ))}
                                        {projects.length === 0 && <p className="text-sm text-neutral-500 italic">Nenhum projeto encontrado.</p>}
                                    </div>
                                );
                            }

                            if (toolName === 'getCalendarEvents') {
                                const events = Array.isArray(result) ? result : [];
                                return (
                                    <div key={toolCallId} className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2">
                                        <CalendarCard events={events} />
                                    </div>
                                );
                            }

                            if (toolName === 'createProject') {
                                // Maybe render a success card? For now just rely on text confirmation.
                                return null;
                            }

                            if (toolName === 'analyzeProjects') {
                                const { type, data, title } = result;
                                if (type === 'scatter') {
                                    return (
                                        <div key={toolCallId} className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-2">
                                            <RiskMatrix data={data} title={title} />
                                        </div>
                                    )
                                }
                                return (
                                    <div key={toolCallId} className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-2">
                                        <DynamicChart type={type} data={data} title={title} />
                                    </div>
                                )
                            }
                        }

                        return null; // Don't show anything for 'call' state (loading) unless we want a spinner
                    })}
                </div>
            ))}
            <div ref={bottomRef} className="h-4" />
        </div>
    )
}

function formatMessage(content: string) {
    if (!content) return null;
    return content.split('\n').map((line, i) => (
        <p key={i} className="mb-1 last:mb-0 min-h-[1.2em]">{line}</p>
    ))
}
