import type { Workout, WorkoutIntensity, WorkoutMode, WorkoutType } from '../types'

export const WORKOUT_TYPES: { key: WorkoutType; label: string }[] = [
  { key: 'musculacao', label: 'Musculação' },
  { key: 'corrida', label: 'Corrida' },
  { key: 'ciclismo', label: 'Ciclismo' },
  { key: 'funcional', label: 'Funcional' },
  { key: 'natacao', label: 'Natação' },
  { key: 'outro', label: 'Outro' },
]

const MET: Record<WorkoutType, Record<WorkoutIntensity, number>> = {
  musculacao: { leve: 3.5, moderada: 5.0, intensa: 6.0 },
  funcional: { leve: 4.0, moderada: 6.0, intensa: 8.0 },
  corrida: { leve: 7.0, moderada: 9.8, intensa: 12.8 },
  ciclismo: { leve: 6.0, moderada: 8.0, intensa: 10.0 },
  natacao: { leve: 6.0, moderada: 8.3, intensa: 10.0 },
  outro: { leve: 3.0, moderada: 4.5, intensa: 6.0 },
}

export function runningMETFromSpeed(speedKmh: number): number {
  const speedMmin = (speedKmh * 1000) / 60
  const vo2 = 0.2 * speedMmin + 3.5
  return Math.max(4, Math.min(18, vo2 / 3.5))
}

export interface WorkoutForm {
  type: WorkoutType
  mode: WorkoutMode
  durationMin: number
  intensity: WorkoutIntensity
  distanceKm: number
  paceMinKm: number
  note: string
}

export function computeWorkoutKcal(form: WorkoutForm, weightKg: number): number {
  let met: number
  let hours: number
  if (form.type === 'corrida' && form.mode === 'distancia' && form.distanceKm > 0 && form.paceMinKm > 0) {
    met = runningMETFromSpeed(60 / form.paceMinKm)
    hours = (form.paceMinKm * form.distanceKm) / 60
  } else {
    const table = MET[form.type] || MET.outro
    met = table[form.intensity] || table.moderada
    hours = (form.durationMin || 0) / 60
  }
  return Math.max(0, Math.round(met * weightKg * hours))
}

export function defaultWorkoutForm(): WorkoutForm {
  return { type: 'musculacao', mode: 'duracao', durationMin: 30, intensity: 'moderada', distanceKm: 5, paceMinKm: 6, note: '' }
}

export function workoutToForm(w: Workout): WorkoutForm {
  return {
    type: w.type,
    mode: w.mode || 'duracao',
    durationMin: w.durationMin || 30,
    intensity: w.intensity || 'moderada',
    distanceKm: w.distanceKm || 5,
    paceMinKm: w.paceMinKm || 6,
    note: w.note || '',
  }
}
