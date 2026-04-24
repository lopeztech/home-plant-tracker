import { useSubscription } from '../context/SubscriptionContext.jsx'
import { useNavigate } from 'react-router'

export default function TrialBanner() {
  const { isTrial, trialDaysRemaining } = useSubscription()
  const navigate = useNavigate()

  if (!isTrial || trialDaysRemaining === null || trialDaysRemaining <= 0) return null

  return (
    <div
      className="alert alert-info border-0 rounded-0 py-2 mb-0 text-center fs-sm d-flex align-items-center justify-content-center gap-3"
      role="status"
    >
      <span>
        <strong>Free Home Pro trial</strong> — {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining
      </span>
      <button
        type="button"
        className="btn btn-primary btn-sm py-0"
        onClick={() => navigate('/pricing')}
      >
        Upgrade now
      </button>
    </div>
  )
}
