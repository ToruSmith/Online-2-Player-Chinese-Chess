/** 權杖桶：平時以固定速度回補，允許短暫的尖峰。 */
export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.updatedAt = now();
  }

  take(): boolean {
    const current = this.now();
    const refill = ((current - this.updatedAt) / 1000) * this.refillPerSecond;
    this.tokens = Math.min(this.capacity, this.tokens + refill);
    this.updatedAt = current;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  get isFull(): boolean {
    return this.tokens >= this.capacity;
  }
}
