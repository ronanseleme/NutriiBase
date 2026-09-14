import { useCallback, useRef, useState } from 'react'

export type RecorderStatus = 'idle' | 'recording' | 'error'

// Primeiro tipo suportado pelo navegador vence — Chrome/Firefox/Android
// gravam bem em webm/opus, Safari/iOS não suporta webm e cai pro mp4/aac.
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']

// Quantas barras o waveform mostra — cada uma é uma amostra do nível de
// áudio (0 a 1) naquele instante, atualizada a cada frame enquanto grava.
const BAR_COUNT = 24

function pickMimeType(): string {
  for (const type of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) return type
  }
  return ''
}

function silentLevels(): number[] {
  return Array(BAR_COUNT).fill(0)
}

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [levels, setLevels] = useState<number[]>(silentLevels)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(data)
    const step = Math.max(1, Math.floor(data.length / BAR_COUNT))
    const next: number[] = []
    for (let i = 0; i < BAR_COUNT; i++) next.push((data[i * step] || 0) / 255)
    setLevels(next)
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  function stopVisualizer() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    analyserRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setLevels(silentLevels())
  }

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

      // Medidor de nível é só visual — se o navegador não suportar Web Audio
      // API por algum motivo, a gravação em si continua normal, só sem barra.
      try {
        const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        const audioCtx = new AudioContextCtor()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 64
        analyser.smoothingTimeConstant = 0.6
        source.connect(analyser)
        audioCtxRef.current = audioCtx
        analyserRef.current = analyser
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        // sem visualizador — segue só com a gravação
      }
    } catch {
      setErrorMessage('Não foi possível acessar o microfone — verifique a permissão do navegador.')
      setStatus('error')
    }
  }, [tick])

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      stopVisualizer()
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
    stopVisualizer()
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

  return { status, errorMessage, levels, start, stop, cancel }
}
