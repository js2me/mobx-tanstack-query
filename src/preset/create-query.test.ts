import type {
  QueryMeta,
  QueryClient as TanstackQueryClient,
} from '@tanstack/query-core';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Query } from '../query.js';
import { QueryClient } from '../query-client.js';
import { getQueryClient } from '../utils/get-query-client.js';
import { createQuery } from './create-query.js';
import { queryClient as presetModuleQueryClient } from './query-client.js';

describe('createQuery', () => {
  it('preserves typings for overloads', () => {
    type User = {
      id: string;
      email: string;
    };

    const queryFnReturnsNumber: () => number = () => 1;
    const getUser = async () => ({ id: '1', email: 'alice@example.com' });

    const queryFromOptions = createQuery({
      enabled: false,
      queryKey: ['user'] as const,
      queryFn: async () => ({ id: '1', email: 'alice@example.com' }),
    });

    expectTypeOf(queryFromOptions.data).toEqualTypeOf<User | undefined>();

    const queryFromFnOnly = createQuery(async () => 1);

    expectTypeOf(queryFromFnOnly.data).toEqualTypeOf<number | undefined>();

    const queryFromFn = createQuery(
      async () => ({ id: '1', email: 'alice@example.com' }),
      {
        enabled: false,
        queryKey: ['user'] as const,
        initialData: { id: '0', email: 'init@example.com' },
      },
    );

    expectTypeOf(queryFromFn.data).toEqualTypeOf<User | undefined>();

    const queryFromFnWithSelect = createQuery(getUser, {
      enabled: false,
      queryKey: ['user'] as const,
      initialData: { id: '0', email: 'init@example.com' },
      select: ((user) => user.email) satisfies (
        user: Awaited<ReturnType<typeof getUser>>,
      ) => string,
    });

    expectTypeOf(queryFromFnWithSelect.data).toEqualTypeOf<
      string | undefined
    >();

    const queryFromOptionsWithExplicitGenerics = createQuery<
      number,
      Error,
      string
    >({
      enabled: false,
      queryKey: ['count'] as const,
      queryFn: async () => 1,
      select: ((count) => count.toString()) satisfies (count: number) => string,
    });

    expectTypeOf(queryFromOptionsWithExplicitGenerics.data).toEqualTypeOf<
      string | undefined
    >();

    const queryFromClientAndOptions = createQuery(new QueryClient(), () => ({
      enabled: false,
      queryKey: ['dynamic'] as const,
      queryFn: async () => 1,
      select: ((count) => count.toString()) satisfies (count: number) => string,
    }));

    expectTypeOf(queryFromClientAndOptions.data).toEqualTypeOf<
      string | undefined
    >();

    createQuery(queryFnReturnsNumber, {
      initialData: 2,
    });

    // @ts-expect-error initialData must match queryFn return type
    createQuery(queryFnReturnsNumber, {
      initialData: '2',
    });

    // @ts-expect-error initialData still uses queryFn data, not selected data
    createQuery<User, Error, string, User, any[]>(getUser, {
      initialData: 'alice@example.com',
      select: (user) => user.email,
    });
  });

  it('creates query from plain options overload', () => {
    const queryFn = vi.fn(async () => 1);

    const query = createQuery({
      enabled: false,
      queryKey: ['plain-options'],
      queryFn,
    });

    expect(query).toBeInstanceOf(Query);
    expect(query.options.queryKey).toEqual(['plain-options']);
    expect(query.options.queryFn).toBe(queryFn);

    query.destroy();
  });

  it('creates query from queryFn overload and keeps initialData', () => {
    const queryFn = vi.fn(async () => 1);

    const query = createQuery(queryFn, {
      enabled: false,
      queryKey: ['query-fn'],
      initialData: 2,
    });

    expect(query).toBeInstanceOf(Query);
    expect(query.options.queryKey).toEqual(['query-fn']);
    expect(query.options.queryFn).toBe(queryFn);
    expect(query.result.data).toBe(2);

    query.destroy();
  });

  it('rejects mismatched initialData for queryFn overload', () => {
    const validQuery = createQuery(() => 1, {});

    expectTypeOf(validQuery.data).toEqualTypeOf<number | undefined>();

    // @ts-expect-error initialData must match queryFn return type from issue #66
    createQuery(() => 1, {
      initialData: '2',
    });
  });

  it('keeps select behavior for queryFn overload', () => {
    const query = createQuery(async () => 1, {
      enabled: false,
      queryKey: ['select'],
      initialData: 2,
      select: ((count) => count.toString()) satisfies (count: number) => string,
    });

    expect(query.result.data).toBe('2');

    query.destroy();
  });

  it('creates query from queryClient and dynamic options overload', () => {
    const queryFn = vi.fn(async () => 1);
    const client = new QueryClient();

    const query = createQuery(client, () => ({
      enabled: false,
      queryKey: ['dynamic-options'],
      queryFn,
    }));

    expect(query).toBeInstanceOf(Query);
    expect(query.options.queryKey).toEqual(['dynamic-options']);
    expect(query.options.queryFn).toBe(queryFn);

    query.destroy();
  });

  it('creates query from queryClient and static options object (not a getter)', () => {
    const queryFn = vi.fn(async () => 1);
    const client = new QueryClient();

    const query = createQuery(client, {
      enabled: false,
      queryKey: ['static-client-options'],
      queryFn,
    });

    expect(getQueryClient(query)).toBe(client);
    expect(query.options.queryKey).toEqual(['static-client-options']);
    expect(query.options.queryFn).toBe(queryFn);

    query.destroy();
  });

  it('uses queryClient from options for queryFn overload', () => {
    const customClient = new QueryClient();
    const queryFn = vi.fn(async () => 1);

    const query = createQuery(queryFn, {
      enabled: false,
      queryKey: ['fn-with-custom-client'],
      queryClient: customClient,
    });

    expect(getQueryClient(query)).toBe(customClient);
    expect(getQueryClient(query)).not.toBe(presetModuleQueryClient);

    query.destroy();
  });

  it('uses explicit queryClient in single options overload', () => {
    const customClient = new QueryClient();
    const queryFn = vi.fn(async () => 42);

    const query = createQuery({
      queryClient: customClient,
      enabled: false,
      queryKey: ['single-options-with-client'],
      queryFn,
    });

    expect(getQueryClient(query)).toBe(customClient);
    expect(getQueryClient(query)).not.toBe(presetModuleQueryClient);
    expect(query.options.queryKey).toEqual(['single-options-with-client']);

    query.destroy();
  });

  it('input typings test', () => {
    type CtxWide = {
      client: TanstackQueryClient;
      queryKey: readonly unknown[];
      signal: AbortSignal;
      meta: QueryMeta | undefined;
      pageParam?: unknown;
      direction?: unknown;
    };

    type CtxFioBar = {
      client: TanstackQueryClient;
      queryKey: readonly ['fio', 'bar'];
      signal: AbortSignal;
      meta: QueryMeta | undefined;
      pageParam?: unknown;
      direction?: unknown;
    };

    const client = new QueryClient();

    createQuery((input) => {
      expectTypeOf(input).toEqualTypeOf<CtxWide>();
    });

    createQuery(
      (input) => {
        expectTypeOf(input).toEqualTypeOf<CtxFioBar>();
      },
      {
        queryKey: ['fio', 'bar'] as const,
        enabled: true,
      },
    );

    createQuery(
      (input) => {
        expectTypeOf(input).toEqualTypeOf<CtxFioBar>();
      },
      {
        options: () => ({
          queryKey: ['fio', 'bar'] as const,
          enabled: true,
        }),
      },
    );

    createQuery({
      queryFn: (input) => {
        expectTypeOf(input).toEqualTypeOf<CtxFioBar>();
      },
      queryKey: ['fio', 'bar'] as const,
      enabled: true,
    });

    createQuery({
      queryFn: (input) => {
        expectTypeOf(input).toEqualTypeOf<CtxFioBar>();
      },
      options: () => ({
        queryKey: ['fio', 'bar'] as const,
        enabled: true,
      }),
    });

    createQuery(client, () => ({
      queryFn: (input) => {
        expectTypeOf(input).toEqualTypeOf<CtxFioBar>();
      },
      queryKey: ['fio', 'bar'] as const,
      enabled: true,
    }));

    createQuery(client, {
      queryFn: (input) => {
        expectTypeOf(input).toEqualTypeOf<CtxFioBar>();
      },
      queryKey: ['fio', 'bar'] as const,
      enabled: true,
    });
  });
});
