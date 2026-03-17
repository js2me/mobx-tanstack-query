/**
 * Type tests for BaseQuery methods when used through Query and InfiniteQuery.
 * Verifies that types are correctly inferred after refactoring to BaseQuery.
 */
import type { InfiniteData, QueryObserverResult } from '@tanstack/query-core';
import { describe, expectTypeOf, it } from 'vitest';

import { InfiniteQuery } from './inifinite-query.js';
import type { InfiniteQueryObserverResult } from './inifinite-query.types.js';
import { Query } from './query.js';
import { QueryClient as MobxQueryClient } from './query-client.js';

type User = { id: number; email: string };
type PageParam = { offset: number; limit: number };

describe('BaseQuery types via Query', () => {
  describe('setData', () => {
    it('returns typed data for Query', () => {
      const query = new Query({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }) as User,
      });
      const result = query.setData((prev) => prev ?? { id: 0, email: '' });
      expectTypeOf(result).toEqualTypeOf<User | undefined>();
    });

    it('accepts updater with correct prev type for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      query.setData((prev) => {
        expectTypeOf(prev).toEqualTypeOf<User | undefined>();
        return prev ?? { id: 0, email: '' };
      });
    });

    it('setData updater receives User | undefined for Query with select', () => {
      const query = new Query<User, Error, string, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
        select: (d) => d.email,
      });
      query.setData((prev) => {
        expectTypeOf(prev).toEqualTypeOf<User | undefined>();
        return prev ?? { id: 0, email: '' };
      });
    });
  });

  describe('refetch', () => {
    it('returns Promise<QueryObserverResult> for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      const result = await query.refetch();
      expectTypeOf(result).toEqualTypeOf<QueryObserverResult<User, Error>>();
    });

    it('refetch result.data is User | undefined for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      const result = await query.refetch();
      expectTypeOf(result.data).toEqualTypeOf<User | undefined>();
    });

    it('refetch accepts RefetchOptions for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      await query.refetch({ cancelRefetch: true });
    });
  });

  describe('update', () => {
    it('accepts partial options for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      query.update({ staleTime: 1000 });
    });

    it('update with enabled option for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      query.update({ enabled: true });
    });

    it('update returns void for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      const result = query.update({});
      expectTypeOf(result).toEqualTypeOf<void>();
    });
  });

  describe('result', () => {
    it('result.data is User | undefined for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      expectTypeOf(query.result.data).toEqualTypeOf<User | undefined>();
    });

    it('result.error is Error | null for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      expectTypeOf(query.result.error).toEqualTypeOf<Error | null>();
    });

    it('result is QueryObserverResult for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      expectTypeOf(query.result).toEqualTypeOf<
        QueryObserverResult<User, Error>
      >();
    });
  });

  describe('reset', () => {
    it('returns Promise<void> for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      const result = await query.reset();
      expectTypeOf(result).toEqualTypeOf<void>();
    });

    it('reset accepts predicate for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      await query.reset({ predicate: () => true });
    });

    it('reset accepts ResetOptions for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      await query.reset(undefined, { cancelRefetch: false });
    });
  });

  describe('remove', () => {
    it('remove accepts no params for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      query.remove();
    });

    it('remove accepts safe option for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      query.remove({ safe: true });
    });

    it('remove accepts predicate for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      query.remove({ predicate: () => true });
    });
  });

  describe('cancel', () => {
    it('returns Promise<void> for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      const result = await query.cancel();
      expectTypeOf(result).toEqualTypeOf<void>();
    });

    it('cancel accepts CancelOptions for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      await query.cancel({ revert: true });
    });

    it('cancel can be called without args for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      await query.cancel();
    });
  });

  describe('invalidate', () => {
    it('returns Promise<void> for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      const result = await query.invalidate();
      expectTypeOf(result).toEqualTypeOf<void>();
    });

    it('invalidate accepts params for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      await query.invalidate({ predicate: () => true });
    });

    it('invalidate can be called without args for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      await query.invalidate();
    });
  });

  describe('onDone', () => {
    it('onDone listener receives (data, payload) for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      query.onDone((data, payload) => {
        expectTypeOf(data).toEqualTypeOf<User>();
        expectTypeOf(payload).toEqualTypeOf<void>();
      });
    });

    it('onDone listener data matches select for Query', () => {
      const query = new Query<User, Error, string, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
        select: (d) => d.email,
      });
      query.onDone((data) => {
        expectTypeOf(data).toEqualTypeOf<string>();
      });
    });

    it('onDone returns void for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      const result = query.onDone(() => {});
      expectTypeOf(result).toEqualTypeOf<void>();
    });
  });

  describe('onError', () => {
    it('onError listener receives (error, payload) for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      query.onError((error, payload) => {
        expectTypeOf(error).toEqualTypeOf<Error>();
        expectTypeOf(payload).toEqualTypeOf<void>();
      });
    });

    it('onError returns void for Query', () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      const result = query.onError(() => {});
      expectTypeOf(result).toEqualTypeOf<void>();
    });

    it('onError listener error matches TError for Query', () => {
      type CustomError = { code: number };
      const query = new Query<User, CustomError, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      query.onError((error) => {
        expectTypeOf(error).toEqualTypeOf<CustomError>();
      });
    });
  });

  describe('start', () => {
    it('start returns Promise<QueryObserverResult> for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      const result = await query.start();
      expectTypeOf(result).toEqualTypeOf<QueryObserverResult<User, Error>>();
    });

    it('start result.data is User | undefined for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      const result = await query.start({});
      expectTypeOf(result.data).toEqualTypeOf<User | undefined>();
    });

    it('start accepts partial options for Query', async () => {
      const query = new Query<User, Error, User, User, ['user']>({
        queryClient: new MobxQueryClient({}),
        queryKey: ['user'],
        queryFn: () => ({ id: 1, email: 'a@b.com' }),
      });
      await query.start({ staleTime: 1000 });
    });
  });
});

describe('BaseQuery types via InfiniteQuery', () => {
  const queryClient = new MobxQueryClient({});
  const initialPageParam: PageParam = { offset: 0, limit: 10 };

  describe('setData', () => {
    it('setData updater receives InfiniteData for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.setData((prev) => {
        expectTypeOf(prev).toEqualTypeOf<
          InfiniteData<User[], PageParam> | undefined
        >();
        return prev ?? { pages: [], pageParams: [] };
      });
    });

    it('setData returns InfiniteData | undefined for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = query.setData(
        (prev) => prev ?? { pages: [], pageParams: [] },
      );
      expectTypeOf(result).toEqualTypeOf<
        InfiniteData<User[], PageParam> | undefined
      >();
    });

    it('setData accepts options for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.setData((prev) => prev ?? { pages: [], pageParams: [] });
    });
  });

  describe('refetch', () => {
    it('refetch returns Promise<InfiniteQueryObserverResult> for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = await query.refetch();
      expectTypeOf(result).toEqualTypeOf<
        InfiniteQueryObserverResult<InfiniteData<User[], PageParam>, Error>
      >();
    });

    it('refetch result has hasNextPage for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = await query.refetch();
      expectTypeOf(result.hasNextPage).toMatchTypeOf<boolean>();
    });

    it('refetch accepts RefetchOptions for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      await query.refetch({ cancelRefetch: true });
    });
  });

  describe('update', () => {
    it('update accepts InfiniteQueryUpdateOptions for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.update({ staleTime: 1000 });
    });

    it('update with getNextPageParam for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.update({ getNextPageParam: () => ({ offset: 10, limit: 10 }) });
    });

    it('update returns void for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = query.update({});
      expectTypeOf(result).toEqualTypeOf<void>();
    });
  });

  describe('result', () => {
    it('result.data is InfiniteData for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      expectTypeOf(query.result.data).toEqualTypeOf<
        InfiniteData<User[], PageParam> | undefined
      >();
    });

    it('result has hasNextPage for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      expectTypeOf(query.result.hasNextPage).toMatchTypeOf<boolean>();
    });

    it('result is InfiniteQueryObserverResult for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      expectTypeOf(query.result).toEqualTypeOf<
        InfiniteQueryObserverResult<InfiniteData<User[], PageParam>, Error>
      >();
    });
  });

  describe('reset', () => {
    it('reset returns Promise<void> for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = await query.reset();
      expectTypeOf(result).toEqualTypeOf<void>();
    });

    it('reset accepts params for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      await query.reset({ predicate: () => true });
    });

    it('reset can be called without args for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      await query.reset();
    });
  });

  describe('remove', () => {
    it('remove accepts safe for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.remove({ safe: true });
    });

    it('remove can be called without args for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.remove();
    });

    it('remove accepts predicate for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.remove({ predicate: () => true });
    });
  });

  describe('cancel', () => {
    it('cancel returns Promise<void> for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = await query.cancel();
      expectTypeOf(result).toEqualTypeOf<void>();
    });

    it('cancel accepts options for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      await query.cancel({ revert: true });
    });

    it('cancel can be called without args for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      await query.cancel();
    });
  });

  describe('invalidate', () => {
    it('invalidate returns Promise<void> for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = await query.invalidate();
      expectTypeOf(result).toEqualTypeOf<void>();
    });

    it('invalidate accepts params for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      await query.invalidate({ predicate: () => true });
    });

    it('invalidate can be called without args for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      await query.invalidate();
    });
  });

  describe('onDone', () => {
    it('onDone listener receives InfiniteData for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.onDone((data) => {
        expectTypeOf(data).toEqualTypeOf<InfiniteData<User[], PageParam>>();
      });
    });

    it('onDone returns void for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = query.onDone(() => {});
      expectTypeOf(result).toEqualTypeOf<void>();
    });

    it('onDone listener payload is void for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.onDone((_data, payload) => {
        expectTypeOf(payload).toEqualTypeOf<void>();
      });
    });
  });

  describe('onError', () => {
    it('onError listener receives TError for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.onError((error) => {
        expectTypeOf(error).toEqualTypeOf<Error>();
      });
    });

    it('onError returns void for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = query.onError(() => {});
      expectTypeOf(result).toEqualTypeOf<void>();
    });

    it('onError listener payload is void for InfiniteQuery', () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      query.onError((_error, payload) => {
        expectTypeOf(payload).toEqualTypeOf<void>();
      });
    });
  });

  describe('start', () => {
    it('start returns Promise<InfiniteQueryObserverResult> for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = await query.start();
      expectTypeOf(result).toEqualTypeOf<
        InfiniteQueryObserverResult<InfiniteData<User[], PageParam>, Error>
      >();
    });

    it('start result has hasNextPage for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      const result = await query.start({});
      expectTypeOf(result.hasNextPage).toMatchTypeOf<boolean>();
    });

    it('start accepts InfiniteQueryStartParams for InfiniteQuery', async () => {
      const query = new InfiniteQuery<
        User[],
        Error,
        PageParam,
        InfiniteData<User[], PageParam>,
        ['users']
      >({
        queryClient,
        queryKey: ['users'],
        initialPageParam,
        queryFn: () => [],
        getNextPageParam: () => null,
      });
      await query.start({ cancelRefetch: true });
    });
  });
});
