import { useCallback, useRef, useState } from 'react'

export type RecorderStatus = 'idle' | 'recording' | 'error'

// Primeiro tipo suportado pelo navegador vence — Chrome/Firefox/Android
// gravam bem em webm/opus, Safari/iOS não suporta webm e cai pro mp4/aac.
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']

function pickMimeType(): string {
  for (const type of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) return type
  }
  return ''
}

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async () => {
    setErrorMessage(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage('Gravação de áudio não é suportada neste navegador.')
      setStatus('error')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start()
      recorderRef.current = recorder
      setStatus('recording')
    } catch {
      setErrorMessage('Não foi possível acessar o microfone — verifique a permissão do navegador.')
      setStatus('error')
    }
  }, [])

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }
      recorder.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          : null
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setStatus('idle')
        resolve(blob)
      }
      recorder.stop()
    })
  }, [])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    setStatus('idle')
  }, [])

  return { status, errorMessage, start, stop, cancel }
}
