/**
 * Three-state circuit breaker for external API calls.
 *
 *  CLOSED ──(N consecutive failures)──▶ OPEN
 *    ▲                                    │
 *    │ success                            │ after resetMs
 *    │                                    ▼
 *    └────────────────────────────── HALF-OPEN
 *                                   (try one probe)
 */
type State = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: State = 'closed';
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private _tripCount = 0;

  constructor(
    /** Number of consecutive failures before tripping to OPEN. */
    private readonly threshold = 3,
    /** Milliseconds to wait before transitioning from OPEN → HALF-OPEN. */
    private readonly resetMs = 30_000,
  ) {}

  /** Returns true if the circuit allows a request attempt. */
  canAttempt(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    // half-open: allow exactly one probe request
    return true;
  }

  /** Record a successful response — resets the breaker to CLOSED. */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
  }

  /** Record a failed request. Trips to OPEN after `threshold` consecutive failures. */
  recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.threshold) {
      this.state = 'open';
      this._tripCount++;
    }
  }

  /** True when the circuit is OPEN (rejecting all requests). */
  get isOpen(): boolean {
    return this.state === 'open';
  }

  /** Total number of times the breaker has tripped from CLOSED → OPEN. */
  get tripCount(): number {
    return this._tripCount;
  }

  /** Current breaker state for diagnostics. */
  get currentState(): State {
    return this.state;
  }
}

/** Shared instance for the OFF API. */
export const offCircuitBreaker = new CircuitBreaker(3, 30_000);
