import { computeTargets } from './calculations'
import type { Profile } from '../types'

export function newProfile(userId: string | null): Profile {
  const base: Omit<Profile, 'targets'> = {
    id: userId,
    name: '',
    age: 30,
    sex: 'F',
    heightCm: 165,
    weightKg: 70,
    bodyFatPct: null,
    activity: 'moderado',
    goal: 'manutencao',
    pace: 'moderado',
    targetWeightKg: null,
    bodyFatTargetPct: null,
    targetDate: null,
    weeklyWorkoutGoal: null,
    restrictions: { tags: [], note: '' },
    macroOverride: null,
  }
  return { ...base, targets: computeTargets(base) }
}
