import { describe, expect, it } from 'vitest';
import { Mutation } from '../mutation.js';
import { createMutation } from './create-mutation.js';

describe('createMutation', () => {
  it('throwOnError: false', async () => {
    type CreateTaskVariables = {
      completed: boolean;
      title: string;
      userId: number;
    };

    const title = 'Buy milk';

    const mutation = createMutation<void, CreateTaskVariables>(
      async () => {
        throw new Error('network');
      },
      {
        throwOnError: false,
      },
    );

    expect(mutation).toBeInstanceOf(Mutation);

    let result: 'mutate-resolved' | 'catched-error' | undefined;

    try {
      await mutation.mutate({
        completed: false,
        title,
        userId: 1,
      });

      result = 'mutate-resolved';
    } catch {
      result = 'catched-error';
    }

    expect(result).toBe('mutate-resolved');
    expect(mutation.result.status).toBe('error');
    mutation.destroy();
  });

  it('throwOnError: true', async () => {
    type CreateTaskVariables = {
      completed: boolean;
      title: string;
      userId: number;
    };

    const title = 'Buy milk';

    const mutation = createMutation<void, CreateTaskVariables>(
      async () => {
        throw new Error('network');
      },
      {
        mutationKey: ['create-task'],
        throwOnError: true,
      },
    );

    expect(mutation).toBeInstanceOf(Mutation);

    let result: 'mutate-resolved' | 'catched-error' | undefined;

    try {
      await mutation.mutate({
        completed: false,
        title,
        userId: 1,
      });

      result = 'mutate-resolved';
    } catch {
      result = 'catched-error';
    }

    expect(result).toBe('catched-error');
    expect(mutation.result.status).toBe('error');
    mutation.destroy();
  });
});
