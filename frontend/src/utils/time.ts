/**
 * Format a timestamp as a relative time string (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const now = new Date()
  const then = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const diffMs = now.getTime() - then.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return diffSeconds <= 1 ? 'just now' : `${diffSeconds} seconds ago`
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  } else if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
  } else {
    // For longer periods, show the date
    return then.toLocaleDateString()
  }
}

