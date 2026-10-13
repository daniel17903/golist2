// Shared simulated wall clock for every device in a simulation.
//
// By default every read advances the clock by 1ms, so writes get unique,
// ordered timestamps like on real devices. `freeze()` stops that so a test
// can make several devices write with the *same* `updatedAt` and exercise
// the deterministic tie-breaks.
export class SimClock {
  private current: number;
  private frozen = false;

  constructor(start = Date.UTC(2025, 0, 1)) {
    this.current = start;
  }

  readonly now = (): number => {
    const value = this.current;
    if (!this.frozen) {
      this.current += 1;
    }
    return value;
  };

  peek(): number {
    return this.current;
  }

  advance(ms: number) {
    this.current += ms;
  }

  set(ms: number) {
    this.current = ms;
  }

  freeze() {
    this.frozen = true;
  }

  unfreeze() {
    this.frozen = false;
  }
}
