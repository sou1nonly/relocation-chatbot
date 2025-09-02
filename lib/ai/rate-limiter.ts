/**
 * Rate limiting and quota management for API calls
 */

interface RateLimitState {
  dailyCount: number;
  lastReset: string;
  hourlyCount: number;
  lastHourReset: string;
}

const rateLimitState = new Map<string, RateLimitState>();

export function checkRateLimit(userId: string): {
  allowed: boolean;
  reason?: string;
} {
  const now = new Date();
  const today = now.toDateString();
  const currentHour = now.getHours();

  const state = rateLimitState.get(userId) || {
    dailyCount: 0,
    lastReset: today,
    hourlyCount: 0,
    lastHourReset: currentHour.toString(),
  };

  // Reset daily count if it's a new day
  if (state.lastReset !== today) {
    state.dailyCount = 0;
    state.lastReset = today;
  }

  // Reset hourly count if it's a new hour
  if (state.lastHourReset !== currentHour.toString()) {
    state.hourlyCount = 0;
    state.lastHourReset = currentHour.toString();
  }

  // Check limits (conservative limits to prevent hitting API quotas)
  const DAILY_LIMIT = 50; // Conservative daily limit
  const HOURLY_LIMIT = 10; // Conservative hourly limit

  if (state.dailyCount >= DAILY_LIMIT) {
    return {
      allowed: false,
      reason: `Daily limit of ${DAILY_LIMIT} messages reached. Please try again tomorrow.`,
    };
  }

  if (state.hourlyCount >= HOURLY_LIMIT) {
    return {
      allowed: false,
      reason: `Hourly limit of ${HOURLY_LIMIT} messages reached. Please wait an hour.`,
    };
  }

  // Increment counters
  state.dailyCount++;
  state.hourlyCount++;
  rateLimitState.set(userId, state);

  return { allowed: true };
}

export function getRateLimitStatus(userId: string): RateLimitState | null {
  return rateLimitState.get(userId) || null;
}
