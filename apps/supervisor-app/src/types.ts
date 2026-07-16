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

export interface Batch {
  id: string
  formulation_id: string
  batch_number: string
  mason_name: string
  status: 'in_progress' | 'submitted'
  started_at: string
  submitted_at: string | null
}

export interface SupervisorSession {
  id: string
  name: string
}
