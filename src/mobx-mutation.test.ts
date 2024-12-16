import { DefaultError, QueryClient } from '@tanstack/query-core';
import { describe, expect, it, vi } from 'vitest';

import { MobxMutation } from './mobx-mutation';
import { MobxMutationConfig } from './mobx-mutation.types';

class MobxMutationMock<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> extends MobxMutation<TData, TVariables, TError, TContext> {
  spies = {
    mutationFn: null as unknown as ReturnType<typeof vi.fn>,
    dispose: vi.fn(),
    reset: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };

  constructor(
    options: Omit<
      MobxMutationConfig<TData, TVariables, TError, TContext>,
      'queryClient'
    >,
  ) {
    const mutationFn = vi.fn((...args: any[]) => {
      // @ts-ignore
      const result = options.mutationFn?.(...args);
      return result;
    });
    super({
      ...options,
      queryClient: new QueryClient({}),
      // @ts-ignore
      mutationFn,
    });

    this.spies.mutationFn = mutationFn as any;

    this.onDone(this.spies.onDone);
    this.onError(this.spies.onError);
  }

  reset(): void {
    const result = super.reset();
    this.spies.reset.mockReturnValue(result)();
    return result;
  }

  dispose(): void {
    const result = super.dispose();
    this.spies.dispose.mockReturnValue(result)();
    return result;
  }
}

describe('MobxMutation', () => {
  it('should call mutationFn', async () => {
    const mobxMutation = new MobxMutationMock({
      mutationKey: ['test'],
      mutationFn: async () => {},
    });

    await mobxMutation.mutate();

    expect(mobxMutation.spies.mutationFn).toHaveBeenCalled();
  });

  it('should have result with finished data', async () => {
    const mobxMutation = new MobxMutationMock({
      mutationKey: ['test'],
      mutationFn: async () => {
        return 'OK';
      },
    });

    await mobxMutation.mutate();

    expect(mobxMutation.result).toStrictEqual({
      ...mobxMutation.result,
      context: undefined,
      data: 'OK',
      error: null,
      failureCount: 0,
      failureReason: null,
      isError: false,
      isIdle: false,
      isPaused: false,
      isPending: false,
      isSuccess: true,
      status: 'success',
      variables: undefined,
    });
  });
});
