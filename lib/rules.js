'use strict';
class Rule {
  constructor(config) {
    this.config = config;
    this.state = false;
    this.latches = config.conditions.map(() => false);
    this.pending = null;
  }
  evaluate(values, now) {
    this.latches = this.config.conditions.map((r, i) => {
      const v = Array.isArray(values)?values[i]:values[r.metric];
      if (!Number.isFinite(v)) throw new Error(`Wetterwert fehlt: ${r.metric}`);
      // Entry includes the threshold; hysteresis keeps the latch until the release boundary.
      if (r.operator === 'above') return this.latches[i] ? v >= r.threshold - r.hysteresis : v >= r.threshold;
      return this.latches[i] ? v <= r.threshold + r.hysteresis : v <= r.threshold;
    });
    const match = this.config.mode === 'all' ? this.latches.every(Boolean) : this.latches.some(Boolean);
    const target = match ? this.config.matchedState : !this.config.matchedState;
    if (target === this.state) this.pending = null;
    else {
      if (this.pending?.target !== target) this.pending = {target, since: now};
      if (now - this.pending.since >= this.config.stableForSeconds * 1000) {
        this.state = target; this.pending = null;
      }
    }
    return this.state;
  }
  unavailable() {
    this.pending = null;
    this.latches.fill(false);
    if (this.config.failureState !== 'hold') this.state = this.config.failureState === 'on';
    return this.state;
  }
}
module.exports = { Rule };
