import { LinkedAbortController } from 'linked-abort-controller';
import { action, makeObservable } from 'mobx';

export abstract class Destroyable {
  protected abortController: LinkedAbortController;

  constructor(abortSignal?: AbortSignal) {
    this.abortController = new LinkedAbortController(abortSignal);

    action(this, 'handleDestroy');
    makeObservable(this);

    this.abortController.signal.addEventListener('abort', () => {
      this.handleDestroy();
    });
  }

  destroy() {
    this.abortController?.abort();
  }

  protected abstract handleDestroy(): void;

  /**
   * @deprecated use `destroy`. This method will be removed in next major release
   */
  dispose() {
    this.destroy();
  }

  [Symbol.dispose](): void {
    this.destroy();
  }

  // Firefox fix (Symbol.dispose is undefined in FF)
  [Symbol.for('Symbol.dispose')](): void {
    this.destroy();
  }
}
