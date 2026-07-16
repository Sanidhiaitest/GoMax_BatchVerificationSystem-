import { useNavigate } from 'react-router-dom'

export default function Submitted() {
  const navigate = useNavigate()

  return (
    <div className="screen center">
      <div className="success-icon">✓</div>
      <h1 className="title">Batch submitted</h1>
      <p className="subtitle">This record is locked and cannot be edited.</p>
      <button className="btn btn-primary" onClick={() => navigate('/formulation')}>
        Start another batch
      </button>
    </div>
  )
}
