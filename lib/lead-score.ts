export type LeadSignals = {
  openedRecentEmail?: boolean
  clickedRecentEmail?: boolean
  replied?: boolean
  requestedQuote?: boolean
  visitedPricing?: boolean
  existingCustomer?: boolean
  lapsedCustomer?: boolean
  daysSinceLastEngagement?: number
}

export type LeadAssessment = {
  score: number
  band: 'cold' | 'warm' | 'high-intent'
  reasons: string[]
  nextBestAction: string
}

export function scoreLead(signals: LeadSignals): LeadAssessment {
  let score = 0
  const reasons: string[] = []

  if (signals.openedRecentEmail) {
    score += 8
    reasons.push('Recent email open: +8')
  }

  if (signals.clickedRecentEmail) {
    score += 14
    reasons.push('Recent email click: +14')
  }

  if (signals.replied) {
    score += 22
    reasons.push('Direct reply: +22')
  }

  if (signals.visitedPricing) {
    score += 18
    reasons.push('Pricing-page interest: +18')
  }

  if (signals.requestedQuote) {
    score += 30
    reasons.push('Quote/request-for-offer signal: +30')
  }

  if (signals.existingCustomer) {
    score += 10
    reasons.push('Existing customer relationship: +10')
  }

  if (signals.lapsedCustomer) {
    score += 6
    reasons.push('Known lapsed customer: +6')
  }

  const days = Math.max(Number(signals.daysSinceLastEngagement ?? 0), 0)
  if (days > 90) {
    score -= 15
    reasons.push('No engagement for more than 90 days: -15')
  } else if (days > 30) {
    score -= 7
    reasons.push('No engagement for more than 30 days: -7')
  } else if (days > 0 && days <= 7) {
    score += 8
    reasons.push('Engaged within 7 days: +8')
  }

  score = Math.max(0, Math.min(score, 100))

  if (score >= 55) {
    return {
      score,
      band: 'high-intent',
      reasons,
      nextBestAction: 'Prioritise a personalised human follow-up focused on the expressed need or offer.',
    }
  }

  if (score >= 25) {
    return {
      score,
      band: 'warm',
      reasons,
      nextBestAction: 'Send a useful, relevant follow-up with one clear next step and monitor for stronger intent signals.',
    }
  }

  return {
    score,
    band: 'cold',
    reasons,
    nextBestAction: 'Keep the contact in a low-frequency value/nurture path rather than applying sales pressure.',
  }
}
