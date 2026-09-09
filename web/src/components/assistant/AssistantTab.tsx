import { useMemo, useState } from 'react'
import { useMonthLogs } from '../../hooks/useMonthLogs'
import { useRecentLogs } from '../../hooks/useRecentLogs'
import { buildChatContext } from '../../lib/chatContext'
import { ChatPanel } from './ChatPanel'
import { InsightsPanel } from './InsightsPanel'
import type { Profile } from '../../types'

type SubView = 'chat' | 'insights'

interface Props {
  userId: string | null
  profile: Profile
}

export function AssistantTab({ userId, profile }: Props) {
  const [subView, setSubView] = useState<SubView>('chat')
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })

  const { recentMap } = useRecentLogs(userId)
  const { monthMap } = useMonthLogs(userId, ym.y, ym.m)

  const context = useMemo(() => buildChatContext(profile, recentMap), [profile, recentMap])

  function prevMonth() {
    setYm((cur) => (cur.m === 1 ? { y: cur.y - 1, m: 12 } : { y: cur.y, m: cur.m - 1 }))
  }
  function nextMonth() {
    setYm((cur) => (cur.m === 12 ? { y: cur.y + 1, m: 1 } : { y: cur.y, m: cur.m + 1 }))
  }

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-full bg-[var(--surface)] p-1">
        <button
          type="button"
          onClick={() => setSubView('chat')}
          className={`flex-1 rounded-full py-2 text-[0.84rem] font-bold transition-colors ${
            subView === 'chat' ? 'bg-[var(--blue)] text-white' : 'text-[var(--text-soft)]'
          }`}
        >
          Chat IA
        </button>
        <button
          type="button"
          onClick={() => setSubView('insights')}
          className={`flex-1 rounded-full py-2 text-[0.84rem] font-bold transition-colors ${
            subView === 'insights' ? 'bg-[var(--blue)] text-white' : 'text-[var(--text-soft)]'
          }`}
        >
          Insights
        </button>
      </div>

      {subView === 'chat' ? (
        <ChatPanel context={context} />
      ) : (
        <InsightsPanel
          profile={profile}
          monthMap={monthMap}
          recentMap={recentMap}
          y={ym.y}
          m={ym.m}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          context={context}
        />
      )}
    </div>
  )
}
