import { LinkedAbortController } from 'linked-abort-controller';
import { action } from 'mobx';
import { applyObservable, type ObservableAnnotationsArray } from 'yummies/mobx';

const annotations: ObservableAnnotationsArray<Destroyable> = [
  [action, 'handleDestroy'],
];

export abstract class Destroyable implements Disposable {
  protected abortController: LinkedAbortController;

  constructor(abortSignal?: AbortSignal) {
    this.abortController = new LinkedAbortController(abortSignal);

    applyObservable(this, annotations);

    this.abortController.signal.addEventListener('abort', () => {
      this.handleDestroy();
    });
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
