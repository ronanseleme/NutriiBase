import { useEffect, useRef, useState } from 'react'
import { createPixOrder, getPixOrderStatus, PixPaymentError, type PixOrder, type PixPlanCode } from '../lib/pixPayment'

const POLL_INTERVAL_MS = 4000

function formatCountdown(msLeft: number): string {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

interface Props {
  plan: PixPlanCode
  planLabel: string
  priceLabel: string
  onClose: () => void
  onProfileRefresh: () => void
}

type ViewState = 'loading' | 'qr' | 'success' | 'expired' | 'error'

export function PixPaymentModal({ plan, planLabel, priceLabel, onClose, onProfileRefresh }: Props) {
  const [state, setState] = useState<ViewState>('loading')
  const [order, setOrder] = useState<PixOrder | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [msLeft, setMsLeft] = useState(0)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopTimers() {
    if (pollRef.current) clearInterval(pollRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    pollRef.current = null
    countdownRef.current = null
  }

  async function startOrder() {
    stopTimers()
    setState('loading')
    setErrorMessage(null)
    setCopied(false)
    try {
      const newOrder = await createPixOrder(plan)
      setOrder(newOrder)
      setState('qr')
    } catch (err) {
      setErrorMessage(err instanceof PixPaymentError ? err.message : 'Não foi possível gerar o Pix agora.')
      setState('error')
    }
  }

  useEffect(() => {
    startOrder()
    return () => stopTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state !== 'qr' || !order) return

    const expiresAtMs = new Date(order.expiresAt).getTime()
    setMsLeft(expiresAtMs - Date.now())

    countdownRef.current = setInterval(() => {
      const left = expiresAtMs - Date.now()
      setMsLeft(left)
      if (left <= 0) {
        stopTimers()
        setState('expired')
      }
    }, 1000)

    pollRef.current = setInterval(async () => {
      try {
        const status = await getPixOrderStatus(order.orderId)
        if (status === 'paid') {
          stopTimers()
          setState('success')
          onProfileRefresh()
        } else if (status === 'expired' || status === 'failed') {
          stopTimers()
          setState('expired')
        }
      } catch {
        // Falha pontual de rede não derruba o polling — tenta de novo no
        // próximo intervalo.
      }
    }, POLL_INTERVAL_MS)

    return () => stopTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, order])

  async function handleCopy() {
    if (!order) return
    try {
      await navigator.clipboard.writeText(order.qrCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard indisponível (ex: contexto não-seguro) — sem feedback,
      // a pessoa ainda pode selecionar o texto manualmente.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="nb-modal w-full max-w-md">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[1.2rem] font-bold">Pagar com Pix</h2>
          <button type="button" onClick={onClose} className="text-[1.3rem] leading-none text-[var(--text-soft)]" aria-label="Fechar">
            ×
          </button>
        </div>
        <p className="mb-4 text-[0.84rem] text-[var(--text-soft)]">
          Plano {planLabel} · {priceLabel}
        </p>

        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--purple)]" />
            <p className="text-[0.84rem] text-[var(--text-soft)]">Gerando seu código Pix…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-[0.86rem] text-[var(--coral)]">{errorMessage}</p>
            <button type="button" onClick={startOrder} className="nb-btn nb-btn-primary px-4 py-2">
              Tentar de novo
            </button>
          </div>
        )}

        {state === 'qr' && order && (
          <div className="flex flex-col items-center gap-3">
            <img
              src={`data:image/png;base64,${order.qrCodeBase64}`}
              alt="QR Code do Pix"
              className="h-52 w-52 rounded-[12px] border border-[var(--line-strong)] bg-white p-2"
            />
            <p className="text-[0.82rem] text-[var(--text-soft)]">
              Escaneie com o app do seu banco ou copie o código abaixo
            </p>

            <div className="w-full">
              <div className="flex items-center gap-2 rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[0.75rem] text-[var(--text-soft)]">{order.qrCode}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="nb-btn nb-btn-secondary shrink-0 px-2.5 py-1 text-[0.75rem]"
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="mt-1 text-center">
              <p className="text-[0.78rem] text-[var(--text-soft)]">Expira em</p>
              <p className="text-[1.3rem] font-bold tabular-nums" style={{ color: 'var(--purple)' }}>
                {formatCountdown(msLeft)}
              </p>
            </div>
          </div>
        )}

        {state === 'success' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-[1.6rem] text-white"
              style={{ background: 'var(--teal)' }}
            >
              ✓
            </div>
            <p className="text-[0.95rem] font-bold">Pagamento confirmado!</p>
            <p className="text-[0.84rem] text-[var(--text-soft)]">Seu Pro já está ativo. Aproveite o NutriiBase.</p>
            <button type="button" onClick={onClose} className="nb-btn nb-btn-primary mt-1 w-full py-2.5">
              Continuar
            </button>
          </div>
        )}

        {state === 'expired' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-[0.86rem] text-[var(--text-soft)]">Esse código Pix expirou sem confirmação de pagamento.</p>
            <button type="button" onClick={startOrder} className="nb-btn nb-btn-primary px-4 py-2">
              Gerar novo código
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
