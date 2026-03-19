"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return null
    }

    const isDark = theme === 'dark'

    return (
        <div className="flex items-center gap-2 fixed top-6 right-6 z-50 p-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 shadow-sm">
            <Sun className="h-5 w-5 text-amber-500" />
            <Switch
                className="data-[state=unchecked]:bg-neutral-300 data-[state=checked]:bg-neutral-600 border border-neutral-200 dark:border-white/10"
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
            <Moon className="h-5 w-5 text-sky-500 dark:text-indigo-400" />
        </div>
    )
}
