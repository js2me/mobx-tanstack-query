export abstract class Destroyable implements Disposable {
  protected _abortSignal?: AbortSignal;
  protected _destroyed: boolean;

  constructor(abortSignal?: AbortSignal) {
    this._abortSignal = abortSignal;
    this._destroyed = false;

    this._abortSignal?.addEventListener(
      'abort',
      () => {
        this.destroy();
      },
      { once: true },
    );
  }

  destroy() {
    this._destroyed = true;
  }

  [Symbol.dispose](): void {
    this.destroy();
  }

  // Firefox fix (Symbol.dispose is undefined in FF)
  [Symbol.for('Symbol.dispose')](): void {
    this.destroy();
  }
}
