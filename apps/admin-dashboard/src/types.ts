export interface Formulation {
  id: string
  code: string
  name: string | null
  active: boolean
  category: string | null
  base_name: string | null
  variant: string | null
}

export interface FormulationMaterial {
  id: string
  formulation_id: string
  description: string
  sort_order: number
  active: boolean
  requires_photo: boolean
}

export type SupervisorRole = 'supervisor' | 'tester'

export interface SupervisorPublic {
  id: string
  name: string
  active: boolean
  role: SupervisorRole
}

export type BatchMaterialStatus = 'pending' | 'added' | 'skipped'

export interface BatchMaterial {
  id: string
  description: string
  sort_order: number
  status: BatchMaterialStatus
  quantity: number | null
  ticked_at: string | null
  suspicious: boolean
  gap_seconds: number | null
  requires_photo: boolean
  photo_path: string | null
}

export type FlagSeverity = 'info' | 'warning' | 'critical'

export interface BatchFlag {
  id: string
  batch_id: string
  source: 'rule' | 'ai'
  severity: FlagSeverity
  code: string | null
  message: string
  created_at: string
}

export type TestingStatus = 'not_sent' | 'pending' | 'in_progress' | 'passed' | 'failed'

export interface BatchListRow {
  id: string
  batch_number: string
  batch_date: string
  mason_name: string
  status: 'in_progress' | 'submitted'
  started_at: string
  submitted_at: string | null
  testing_status: TestingStatus
  formulations: { code: string; name: string | null } | null
  supervisors: { name: string } | null
  batch_flags: { id: string; severity: FlagSeverity }[]
}
