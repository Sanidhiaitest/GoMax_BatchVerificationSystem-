export interface Formulation {
  id: string
  code: string
  name: string | null
}

export interface FormulationMaterial {
  id: string
  description: string
  sort_order: number
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
}

export type TestingStatus = 'not_sent' | 'pending' | 'in_progress' | 'passed' | 'failed'

export interface Batch {
  id: string
  formulation_id: string
  batch_number: string
  batch_date: string
  mason_name: string
  status: 'in_progress' | 'submitted'
  started_at: string
  submitted_at: string | null
  testing_status: TestingStatus
  sent_for_testing_at: string | null
  testing_started_at: string | null
  testing_completed_at: string | null
  test_remarks: string | null
  test_remarks_audio_path: string | null
}

export type SupervisorRole = 'supervisor' | 'tester'

export interface SupervisorSession {
  id: string
  name: string
  role: SupervisorRole
}
