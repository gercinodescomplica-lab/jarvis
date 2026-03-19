"use client"

import { cn } from "@/lib/utils"
import { CalendarEvent } from "@/lib/calendar-db"
import { CalendarDays, Clock, Link as LinkIcon, MapPin, Users } from "lucide-react"

interface CalendarCardProps {
    events: CalendarEvent[]
}

export function CalendarCard({ events }: CalendarCardProps) {
    if (!events || events.length === 0) {
        return (
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                <p className="text-sm text-neutral-500">Nenhum evento encontrado.</p>
            </div>
        )
    }

    // Sort events by date
    const sortedEvents = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return (
        <div className="w-full max-w-md space-y-3 mt-2">
            {sortedEvents.map((evt, idx) => {
                const startDate = new Date(evt.start)
                const endDate = new Date(evt.end)

                // Format: "Segunda, 20 de Janeiro"
                const dateStr = startDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
                // Format: "14:00 - 15:00"
                const timeStr = `${startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

                const isNow = new Date() >= startDate && new Date() <= endDate

                return (
                    <div
                        key={`${evt.id}-${idx}`}
                        className={cn(
                            "group relative overflow-hidden rounded-xl border p-4 transition-all hover:scale-[1.02] active:scale-[0.98]",
                            isNow
                                ? "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
                                : "bg-white border-neutral-200 dark:bg-neutral-900/40 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                        )}
                    >
                        {/* Decorative Gradient Blob */}
                        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-2xl transition-all group-hover:from-blue-500/20 group-hover:to-purple-500/20" />

                        <div className="relative z-10 flex flex-col gap-2">
                            {/* Header: Date Badge & Title */}
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                                    {evt.subject}
                                </h3>
                                <div className={cn(
                                    "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium border",
                                    isNow
                                        ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800"
                                        : "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                                )}>
                                    <CalendarDays className="h-3 w-3" />
                                    <span className="capitalize">{dateStr}</span>
                                </div>
                            </div>

                            {/* Time & Attendees */}
                            <div className="flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                                <div className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>{timeStr}</span>
                                </div>

                                {evt.attendees && (
                                    <div className="flex items-start gap-1.5 mt-1">
                                        <Users className="h-3.5 w-3.5 mt-0.5" />
                                        <span className="line-clamp-2">
                                            {Array.isArray(evt.attendees) ? evt.attendees.join(", ") : evt.attendees}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Link Button */}
                            {evt.link && (
                                <a
                                    href={evt.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                                >
                                    <LinkIcon className="h-3 w-3" />
                                    Entrar na Reunião
                                </a>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
