"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { VoiceOrb } from "@/components/voice-orb"
import { VoiceInput } from "@/components/voice-input"
import { Square } from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"

export default function VoicePage() {
  const isListeningRef = useRef(false)
  const [isListening, setIsListening] = useState(false)
  const [inputText, setInputText] = useState("")
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0))
  const [isSpeaking, setIsSpeaking] = useState(false)
  const shouldSpeakNextRef = useRef(false)

  const { messages, sendMessage, status, setMessages } = useChat({
    onFinish: ({ message }) => {
      if (shouldSpeakNextRef.current) {
        const text = message.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map(p => p.text)
          .join('')
        if (text) speak(text)
        shouldSpeakNextRef.current = false
      }
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'


  // Refs for Text Persistence
  const inputTextRef = useRef("")

  // Keep inputTextRef in sync
  useEffect(() => {
    inputTextRef.current = inputText
  }, [inputText])

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const recognitionRef = useRef<any>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const shouldResumeListeningRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic()
      stopAudio()
    }
  }, [])

  // Audio Playback Ref
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  // Stop Audio Helper
  const stopAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  // Speech Synthesis (OpenAI)
  const speak = async (text: string) => {
    stopAudio()

    try {
      // Strip markdown for speech if necessary? For now raw text is usually okayish for simple MD.
      // Maybe strip * and # 
      const cleanText = text.replace(/[*#`]/g, '');

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      })

      if (!response.ok) throw new Error("Failed to fetch audio")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)

      audioPlayerRef.current = audio
      setIsSpeaking(true)

      audio.play()

      audio.onended = () => {
        URL.revokeObjectURL(url)
        audioPlayerRef.current = null
        setIsSpeaking(false)

        // Auto-restart mic if needed
        if (shouldResumeListeningRef.current) {
          console.log("[Voice] Auto-restarting microphone for continuous conversation...");
          startMic();
          shouldResumeListeningRef.current = false;
        }
      }
    } catch (error) {
      console.error("Error playing audio:", error)
      setIsSpeaking(false)
    }
  }

  // Toggle Mic
  const toggleMic = async () => {
    if (isSpeaking) {
      stopAudio()
      if (!isListening) {
        await startMic()
      }
      return
    }

    if (isListening) {
      shouldResumeListeningRef.current = false;
      await stopMic()
      handleSend(undefined, true)
    } else {
      stopAudio()
      await startMic()
    }
  }

  const startMic = async () => {
    console.log('[DEBUG] startMic called');
    if (isListeningRef.current) {
      console.log('[DEBUG] Already listening, ignoring.');
      return;
    }
    stopAudio()
    isListeningRef.current = true

    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(e => console.error("Error closing existing ctx", e));
      audioContextRef.current = null;
    }

    sourceRef.current = null;
    streamRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[DEBUG] Microphone stream acquired');

      if (!isListeningRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      streamRef.current = stream

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioContextClass()
      audioContextRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)
      sourceRef.current = source

      setIsListening(true)
      updateAudioData()

      const mediaRecorder = new MediaRecorder(stream)
      const audioChunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('[DEBUG] Recorder stopped. Processing audio...');
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })

        if (audioBlob.size > 1000) {
          // STT Logic
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');

            const res = await fetch('/api/stt', {
              method: 'POST',
              body: formData
            });

            if (res.ok) {
              const data = await res.json();
              if (data.text && data.text.trim()) {
                setInputText(data.text);
                handleSend(data.text, true);
              }
            } else {
              console.error("[Voice] STT API Error");
            }
          } catch (e) {
            console.error("[Voice] Upload Error", e);
          }
        }
      }

      mediaRecorder.start()
      recognitionRef.current = mediaRecorder

      const checkSilence = () => {
        if (!analyserRef.current || !isListeningRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average > 10) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            console.log('[DEBUG] Silence detected (Manual VAD), stopping...');
            stopMic();
          }, 2500);
        }
      };

      const vadInterval = setInterval(checkSilence, 200);
      (recognitionRef.current as any)._vadInterval = vadInterval;

    } catch (err) {
      console.error("Error accessing microphone:", err)
      setIsListening(false)
      isListeningRef.current = false
    }
  }

  const stopMic = async () => {
    isListeningRef.current = false
    setIsListening(false)

    if (recognitionRef.current) {
      try {
        if ((recognitionRef.current as any).state === 'recording') {
          (recognitionRef.current as any).stop();
        }
        const vad = (recognitionRef.current as any)._vadInterval;
        if (vad) clearInterval(vad);
      } catch (e) { console.warn(e) }
      recognitionRef.current = null
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current) {
      // ... existing close logic
      if (audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close().catch(() => { });
      }
      audioContextRef.current = null
    }

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    setAudioData(new Uint8Array(0))
  }

  const updateAudioData = () => {
    if (!analyserRef.current || !isListeningRef.current) {
      cancelAnimationFrame(rafRef.current)
      return
    }

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteFrequencyData(dataArray)
    setAudioData(new Uint8Array(dataArray))
    rafRef.current = requestAnimationFrame(updateAudioData)
  }

  const handleSend = async (textOverride?: string, isVoice: boolean = false) => {
    const textToSend = textOverride || inputText
    if (!textToSend.trim()) return

    if (isVoice) {
      shouldResumeListeningRef.current = true;
      shouldSpeakNextRef.current = true;
    }

    setInputText("")

    try {
      await sendMessage({ text: textToSend });
    } catch (e) {
      console.error("sendMessage failed:", e);
    }
  }

  return (
    <main className="flex flex-row h-screen w-screen overflow-hidden bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-200 transition-colors duration-300">

      {/* 🔴 Left Column - Voice UI (65-70%) */}
      <section className="relative w-[70%] h-full flex flex-col items-center">

        {/* Voice Orb Area - Top Centered */}
        <div className="flex-1 w-full flex flex-col items-center justify-center p-8 mt-[-10%] z-20">
          <VoiceOrb
            isListening={isListening}
            isSpeaking={isSpeaking}
            audioData={audioData}
            className="w-full h-full max-w-[500px] max-h-[500px]"
          />

          {/* STOP BUTTON (Visual) */}
          {isSpeaking && (
            <button
              onClick={stopAudio}
              className="mt-8 flex items-center gap-2 px-6 py-2 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-all font-medium animate-in fade-in zoom-in duration-300"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop Speaking
            </button>
          )}
        </div>

        {/* Input Area - Bottom */}
        <div className="w-full max-w-2xl px-8 pb-12 z-10">
          <VoiceInput
            value={inputText}
            onChange={setInputText}
            onSend={() => handleSend()}
            isListening={isListening}
            isProcessing={isLoading} // use isLoading from AI SDK
            onMicToggle={toggleMic}
            disabled={false}
            className="mb-4"
          />
          <div className="text-center text-xs text-neutral-400 dark:text-neutral-500">
            Jarvis Vercel AI SDK Integration
          </div>
        </div>
      </section>

      {/* 🟢 Right Column - Chat Panel (30-35%) */}
      <section className="w-[40%] h-full border-l border-neutral-200 dark:border-white/5 bg-neutral-50/50 dark:bg-neutral-900/30 backdrop-blur-sm">
        <ChatPanel messages={messages} />
      </section>

    </main>
  )
}
