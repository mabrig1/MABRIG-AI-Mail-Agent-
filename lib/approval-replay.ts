const inFlight = new Set<string>()
const executed = new Map<string, number>()

function cleanup() {
  const now = Math.floor(Date.now() / 1000)
  for (const [id, expiresAt] of executed.entries()) {
    if (expiresAt <= now) executed.delete(id)
  }
}

export function beginApprovalExecution(id: string) {
  cleanup()
  if (inFlight.has(id) || executed.has(id)) return false
  inFlight.add(id)
  return true
}

export function completeApprovalExecution(id: string, expiresAt: number) {
  inFlight.delete(id)
  executed.set(id, expiresAt)
}

export function failApprovalExecution(id: string) {
  inFlight.delete(id)
}
