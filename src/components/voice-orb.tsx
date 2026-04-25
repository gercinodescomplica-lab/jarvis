"use client"

import { useEffect, useRef } from 'react'
import Lottie, { LottieRefCurrentProps } from 'lottie-react'
import animationData from '@/assets/jarvis.json'
import { cn } from "@/lib/utils"

interface VoiceOrbProps {
    isListening: boolean
    isSpeaking: boolean // If bot is speaking (future)
    audioData?: Uint8Array
    className?: string
}

export function VoiceOrb({ isListening, audioData, className }: VoiceOrbProps) {
    const lottieRef = useRef<LottieRefCurrentProps>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Reactivity Logic
    useEffect(() => {
        if (!lottieRef.current) return

        if (!isListening) {
            // Idle state: Slow breathing
            lottieRef.current.setSpeed(0.5)

            // Reset scale when not listening
            if (containerRef.current) {
                containerRef.current.style.transform = 'scale(1)'
                containerRef.current.style.transition = 'transform 0.5s ease-out'
            }
        } else {
            // Listening state: React to audio energy
            let energy = 0
            if (audioData && audioData.length > 0) {
                // Calculate average energy
                let total = 0
                for (let i = 0; i < audioData.length; i++) {
                    total += audioData[i]
                }
                // Normalized 0-1
                energy = total / audioData.length / 255.0
            }

            // Base speed 1.0, max speed ~4.0 for loud input
            const targetSpeed = 1.0 + (energy * 3.0)
            lottieRef.current.setSpeed(targetSpeed)

            // Scale effect: Base 1.0, max 2.5 (Dramatic)
            const targetScale = 1.0 + (energy * 1.5)

            // Apply scale directly to the container for smooth animation
            if (containerRef.current) {
                containerRef.current.style.transform = `scale(${targetScale})`
                // Quick transition for responsiveness
                containerRef.current.style.transition = 'transform 0.1s ease-out'
            }
        }

    }, [isListening, audioData])

    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <div
                ref={containerRef}
                className="w-full h-full max-w-[400px] max-h-[500px] flex items-center justify-center will-change-transform"
            >
                <Lottie
                    lottieRef={lottieRef}
                    animationData={animationData}
                    loop={true}
                    className="w-full h-full"
                />
            </div>
        </div>
    )
}
