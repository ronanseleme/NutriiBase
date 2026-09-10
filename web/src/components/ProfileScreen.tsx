import { ACTIVITY, GOALS, PACES } from '../lib/constants'
import { parseISODate } from '../lib/dateUtils'
import { getInitials } from '../lib/initials'
import { RoleBadge } from './RoleBadge'
import type { Profile } from '../types'

interface Props {
  profile: Profile
  onEditProfile: () => void
}

export function ProfileScreen({ profile, onEditProfile }: Props) {
  const targets = profile.targets
  const activityLabel = ACTIVITY.find((a) => a.key === profile.activity)?.label || profile.activity
  const goalLabel = GOALS.find((g) => g.key === profile.goal)?.label || profile.goal
  const paceLabel = PACES.find((p) => p.key === profile.pace)?.label || profile.pace
  const restrictionsNote = profile.restrictions?.note?.trim()

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] font-bold text-white">
              {getInitials(profile.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-[Space_Grotesk] font-bold">{profile.name || 'Sem nome'}</div>
              <div className="mt-1">
                <RoleBadge role={profile.role} />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onEditProfile}
            className="shrink-0 rounded-full border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold"
          >
            Editar
          </button>
        </div>
        {restrictionsNote && (
          <p className="mt-3 text-[0.76rem] text-[var(--text-soft)]">
            <b className="text-[var(--text)]">Restrições:</b> {restrictionsNote}
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Dados pessoais</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          <Chip>{profile.age} anos</Chip>
          <Chip>{profile.sex === 'M' ? 'Masculino' : 'Feminino'}</Chip>
          <Chip>
            peso <b>{profile.weightKg} kg</b>
          </Chip>
          <Chip>{profile.heightCm} cm</Chip>
          {profile.bodyFatPct != null && (
            <Chip>
              gordura <b>{profile.bodyFatPct}%</b>
            </Chip>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Metabolismo</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          <Chip title="Taxa metabólica basal — o que seu corpo gasta parado, em repouso">
            TMB <b>{targets.tmb} kcal</b> parado
          </Chip>
          <Chip title="Gasto Energético Total — TMB ajustada pelo seu nível de atividade">
            GET <b>{targets.get} kcal</b> ativo
          </Chip>
          <Chip>{activityLabel}</Chip>
        </div>
      </Card>

      <Card>
        <CardTitle>Objetivo</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          <Chip>{goalLabel}</Chip>
          <Chip>ritmo {paceLabel.toLowerCase()}</Chip>
          {profile.targetWeightKg != null && (
            <Chip>
              meta <b>{profile.targetWeightKg} kg</b>
              {profile.targetDate ? ` até ${new Intl.DateTimeFormat('pt-BR').format(parseISODate(profile.targetDate))}` : ''}
            </Chip>
          )}
        </div>
      </Card>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="nb-card">{children}</div>
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <div className="nb-card-title">{children}</div>
}
function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[0.72rem] text-[var(--text-soft)]">
      {children}
    </span>
  )
}
