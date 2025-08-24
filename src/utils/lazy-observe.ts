import { onBecomeObserved, onBecomeUnobserved } from 'mobx';

export const lazyObserve = <TMetaData = void>({
  context,
  property,
  onStart,
  onEnd,
  endDelay = 50,
}: {
  context: any;
  property: any;
  onStart: () => TMetaData;
  onEnd: (metaData: TMetaData, cleanupFn: VoidFunction) => void;
  endDelay?: number;
}) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let metaData: TMetaData | undefined;

  onBecomeObserved(context, property, () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    metaData = onStart();
  });

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    timeoutId = setTimeout(() => {
      onEnd(metaData!, cleanup);
      timeoutId = undefined;
      metaData = undefined;
    }, endDelay);
  };

  onBecomeUnobserved(context, property, cleanup);

  return cleanup;
};
