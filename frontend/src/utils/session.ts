/**
 * Session management utility for anonymous user sessions
 */

const SESSION_ID_KEY = 'subway_seat_selection_session_id';

/**
 * Get or create a session ID for the current user
 * Session ID is stored in localStorage and persists across page reloads
 */
export function getSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  
  if (!sessionId) {
    // Generate a new session ID (UUID v4 style)
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Generate a new session ID
 * Uses a simple UUID v4-like format for uniqueness
 */
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Clear the current session ID (useful for testing or reset)
 */
export function clearSessionId(): void {
  localStorage.removeItem(SESSION_ID_KEY);
}

