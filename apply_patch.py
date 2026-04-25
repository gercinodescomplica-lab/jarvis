#!/usr/bin/env python3
import sys

# Read the file
with open('src/app/page.tsx', 'r') as f:
    lines = f.readlines()

# Remove line 8 (useChat import) - it's index 7
lines = lines[:7] + lines[8:]

# Now remove lines 16-43 (originally 17-44, now shifted by 1)
lines = lines[:16] + lines[43:]

# Insert the new code at line 16
new_code = '''  // Manual Chat State Management (replacing broken useChat hook)
  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Manual sendMessage implementation  
  const sendMessage = async (messageOrContent: any) => {
    const content = typeof messageOrContent === 'string' ? messageOrContent : messageOrContent.content
    
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content
    }
    
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
        })
      })

      if (!response.ok) throw new Error('API failed')
      if (!response.body) throw new Error('No stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: ''
      }

      setMessages(prev => [...prev, assistantMessage])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\\n').filter(l => l.trim())

        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const data = JSON.parse(line.slice(2))
              if (typeof data === 'string') {
                assistantMessage.content += data
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = { ...assistantMessage }
                  return newMessages
                })
              }
            } catch (e) {
              console.warn('Parse error:', e)
            }
          }
        }
      }

      // Auto-speak the response
      if (assistantMessage.content) {
        speak(assistantMessage.content)
      }

    } catch (error) {
      console.error('Send message error:', error)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '⚠️ Erro ao buscar resposta.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

'''

lines.insert(16, new_code)

# Write back
with open('src/app/page.tsx', 'w') as f:
    f.writelines(lines)

print("Patch applied successfully!")
