import { useState } from 'react'
import { Logo } from '../Logo'
import { StepBasics } from './StepBasics'
import { StepGoals } from './StepGoals'
import { StepPlan } from './StepPlan'
import type { Profile } from '../../types'

type Step = 1 | 2 | 3

interface Props {
  profile: Profile
  onSaveProfile: (updates: Partial<Omit<Profile, 'id' | 'targets'>>) => Promise<{ error: Error | null }>
  onFinish: () => void
  onProfileRefresh: () => void
}

export function OnboardingWizard({ profile, onSaveProfile, onFinish, onProfileRefresh }: Props) {
  const [step, setStep] = useState<Step>(1)

  return (
    <div className="flex min-h-svh flex-col items-center bg-[var(--bg)] px-4 py-8">
      <div className="mb-6">
        <Logo size={32} />
      </div>
      <div className="mb-6 flex w-full max-w-md items-center gap-2">
        {([1, 2, 3] as Step[]).map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              n <= step ? 'bg-[image:var(--brand-gradient)]' : 'bg-[var(--line-strong)]'
            }`}
          />
        ))}
      </div>
      <div className="w-full max-w-md">
        {step === 1 && <StepBasics profile={profile} onSaveProfile={onSaveProfile} onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepGoals profile={profile} onSaveProfile={onSaveProfile} onBack={() => setStep(1)} onNext={() => setStep(3)} />
        )}
        {step === 3 && <StepPlan onBack={() => setStep(2)} onFinish={onFinish} onProfileRefresh={onProfileRefresh} />}
      </div>
    </div>
  )
}
