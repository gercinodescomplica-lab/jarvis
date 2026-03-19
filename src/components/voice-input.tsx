"use client"

import { Button } from "@/components/ui/button"
import { Mic, MicOff, Send } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceInputProps {
    value: string
    onChange: (value: string) => void
    onSend: () => void
    isListening: boolean
    isProcessing?: boolean // New prop
    onMicToggle: () => void
    disabled?: boolean
    className?: string
}

export function VoiceInput({
    value,
    onChange,
    onSend,
    isListening,
    isProcessing = false, // Default to false
    onMicToggle,
    disabled,
    className
}: VoiceInputProps) {
    return (
        <div className={cn(
            "relative flex items-center w-full min-h-[100px] rounded-[32px] transition-all duration-300",
            // Light Mode Styling
            "bg-white border border-neutral-200 shadow-sm",
            // Dark Mode Styling
            "dark:bg-neutral-900 dark:border-white/10 dark:shadow-none",
            className
        )}>

            {/* Mic Button (Inside Left) */}
            <Button
                size="icon"
                variant="ghost"
                onClick={onMicToggle}
                className={cn(
                    "absolute left-2 w-10 h-10 rounded-full transition-colors z-10",
                    isListening
                        ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                        : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-white/5"
                )}
            >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {/* Input Field */}
            <textarea
                className={cn(
                    "flex-1 w-full bg-transparent py-5 pl-14 pr-14 text-base md:text-lg resize-none focus:outline-none scrollbar-custom overflow-y-auto max-h-[150px]",
                    // Text Colors
                    "text-neutral-900 placeholder:text-neutral-500",
                    "dark:text-neutral-100 dark:placeholder:text-neutral-400"
                )}
                placeholder={isListening ? "Listening..." : "Message Jarvis..."}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        onSend()
                    }
                }}
                disabled={disabled}
                rows={1}
            />

            {/* Send Button (Inside Right) */}
            <Button
                size="icon"
                variant="ghost"
                onClick={onSend}
                disabled={!value.trim() || disabled || isProcessing || isListening}
                className={cn(
                    "absolute right-2 w-10 h-10 rounded-full transition-all z-10",
                    value.trim() && !isProcessing && !isListening
                        ? "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                        : "bg-transparent text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                )}
            >
                <Send className="h-4 w-4" />
            </Button>
        </div>
    )
}
