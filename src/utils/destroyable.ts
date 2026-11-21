export abstract class Destroyable implements Disposable {
  protected _abortSignal?: AbortSignal;
  protected _destroyed = false;

  private readonly onAbort = () => {
    if (!this._destroyed) this.destroy();
  };

  constructor(abortSignal?: AbortSignal) {
    this._abortSignal = abortSignal;
    if (abortSignal?.aborted) {
      // Subclasses initialize their observers after super() returns.
      queueMicrotask(this.onAbort);
    } else {
      abortSignal?.addEventListener('abort', this.onAbort, { once: true });
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._abortSignal?.removeEventListener('abort', this.onAbort);
  }

  [Symbol.dispose](): void {
    this.destroy();
  }

  // Firefox fix (Symbol.dispose is undefined in FF)
  [Symbol.for('Symbol.dispose')](): void {
    this.destroy();
  }
}
