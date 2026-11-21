import { LinkedAbortController } from 'linked-abort-controller';
import { action } from 'mobx';
import { applyObservable, type ObservableAnnotationsArray } from 'yummies/mobx';

const annotations: ObservableAnnotationsArray<Destroyable> = [
  [action, 'handleDestroy'],
];

export abstract class Destroyable implements Disposable {
  protected declare abortController: LinkedAbortController;

  // Keep the writable field contract for subclasses, including class field overrides.
  static {
    Object.defineProperty(Destroyable.prototype, 'abortController', {
      configurable: true,
      get(this: Destroyable) {
        return Destroyable.#createAbortController(this);
      },
      set(this: Destroyable, value: LinkedAbortController) {
        Object.defineProperty(this, 'abortController', {
          configurable: true,
          enumerable: true,
          writable: true,
          value,
        });
      },
    });
  }

  constructor(abortSignal?: AbortSignal) {
    if (abortSignal) Destroyable.#createAbortController(this, abortSignal);
    applyObservable(this, annotations);
  }

  static #createAbortController(owner: Destroyable, abortSignal?: AbortSignal) {
    const controller = new LinkedAbortController(abortSignal);
    owner.abortController = controller;
    controller.signal.addEventListener('abort', () => owner.handleDestroy());
    return controller;
  }

  protected get lifecycleAborted() {
    return (
      Object.hasOwn(this, 'abortController') &&
      this.abortController.signal.aborted
    );
  }

  destroy() {
    this.abortController?.abort();
  }

  protected abstract handleDestroy(): void;

  [Symbol.dispose](): void {
    this.destroy();
  }

  // Firefox fix (Symbol.dispose is undefined in FF)
  [Symbol.for('Symbol.dispose')](): void {
    this.destroy();
  }
}
