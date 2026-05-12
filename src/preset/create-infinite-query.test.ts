import type {
  InfiniteData,
  QueryFunction,
  QueryMeta,
  QueryClient as TanstackQueryClient,
} from '@tanstack/query-core';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { InfiniteQuery } from '../inifinite-query.js';
import { QueryClient } from '../query-client.js';
import { getQueryClient } from '../utils/get-query-client.js';
import { createInfiniteQuery } from './create-infinite-query.js';
import { queryClient as presetModuleQueryClient } from './query-client.js';

describe('createInfiniteQuery', () => {
  it('preserves typings for overloads', () => {
    type User = {
      id: string;
      email: string;
    };

    const queryFnReturnsNumber = async () => 1;
    const getUser = async () => ({ id: '1', email: 'alice@example.com' });

    const queryFromOptions = createInfiniteQuery({
      enabled: false,
      queryKey: ['user'] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      queryFn: async () => ({ id: '1', email: 'alice@example.com' }),
    });

    expectTypeOf(queryFromOptions.data).toMatchTypeOf<
      InfiniteData<User, number> | undefined
    >();

    const queryFromFnOnly = createInfiniteQuery(
      (async (ctx) => ctx.pageParam as number) satisfies QueryFunction<
        number,
        readonly ['only']
      >,
      {
        queryKey: ['only'] as const,
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      },
    );

    expect(queryFromFnOnly.options.queryKey).toEqual(['only']);
    const queryFromFn = createInfiniteQuery(
      async () => ({ id: '1', email: 'alice@example.com' }),
      {
        enabled: false,
        queryKey: ['user'] as const,
        initialPageParam: 0,
        getNextPageParam: () => undefined,
        initialData: {
          pages: [{ id: '0', email: 'init@example.com' }],
          pageParams: [0],
        },
      },
    );

    expectTypeOf(queryFromFn.data).toMatchTypeOf<
      InfiniteData<User, number> | undefined
    >();

    const queryFromFnWithSelect = createInfiniteQuery(getUser, {
      enabled: false,
      queryKey: ['user'] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      initialData: {
        pages: [{ id: '0', email: 'init@example.com' }],
        pageParams: [0],
      },
      select: ((data) => data.pages.map((u) => u.email).join(',')) satisfies (
        data: InfiniteData<Awaited<ReturnType<typeof getUser>>, number>,
      ) => string,
    });

    expectTypeOf(queryFromFnWithSelect.data).toEqualTypeOf<
      string | undefined
    >();

    const queryFromOptionsWithExplicitGenerics = createInfiniteQuery<
      number,
      Error,
      number,
      string,
      readonly ['count']
    >({
      enabled: false,
      queryKey: ['count'] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      queryFn: async (ctx) => ctx.pageParam as number,
      select: ((data) =>
        data.pages.map((n) => n.toString()).join(',')) satisfies (
        data: InfiniteData<number, number>,
      ) => string,
    });

    expectTypeOf(queryFromOptionsWithExplicitGenerics.data).toEqualTypeOf<
      string | undefined
    >();

    const queryFromClientAndOptions = createInfiniteQuery(
      new QueryClient(),
      () => ({
        enabled: false,
        queryKey: ['dynamic'] as const,
        initialPageParam: 0,
        getNextPageParam: () => undefined,
        queryFn: async (ctx) => ctx.pageParam as number,
        select: ((data) =>
          data.pages.map((n) => n.toString()).join(',')) satisfies (
          data: InfiniteData<number, number>,
        ) => string,
      }),
    );

    expectTypeOf(queryFromClientAndOptions.data).toEqualTypeOf<
      string | undefined
    >();

    createInfiniteQuery(queryFnReturnsNumber, {
      queryKey: ['n'] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      initialData: { pages: [2], pageParams: [0] },
    });

    // @ts-expect-error initialData must match infinite queryFn page type
    createInfiniteQuery(queryFnReturnsNumber, {
      queryKey: ['n'] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      initialData: { pages: ['2'], pageParams: [0] },
    });

    // @ts-expect-error initialData still uses queryFn page data, not selected data
    createInfiniteQuery<User, Error, number, string, any[]>(getUser, {
      queryKey: ['u'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      initialData: { pages: ['alice@example.com'], pageParams: [0] },
      select: (data) => data.pages.map((u) => u.email).join(','),
    });
  });

  it('creates infinite query from plain options overload', () => {
    const queryFn = vi.fn(async (ctx) => ctx.pageParam as number);

    const query = createInfiniteQuery({
      enabled: false,
      queryKey: ['plain-options'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      queryFn,
    });

    expect(query).toBeInstanceOf(InfiniteQuery);
    expect(query.options.queryKey).toEqual(['plain-options']);
    expect(query.options.queryFn).toBe(queryFn);

    query.destroy();
  });

  it('creates infinite query from queryFn overload and keeps initialData', () => {
    const queryFn = vi.fn(async (ctx) => ctx.pageParam as number);

    const query = createInfiniteQuery(queryFn, {
      enabled: false,
      queryKey: ['query-fn'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      initialData: { pages: [2], pageParams: [0] },
    });

    expect(query).toBeInstanceOf(InfiniteQuery);
    expect(query.options.queryKey).toEqual(['query-fn']);
    expect(query.options.queryFn).toBe(queryFn);
    expect(query.result.data).toEqual({ pages: [2], pageParams: [0] });

    query.destroy();
  });

  it('rejects mismatched initialData for queryFn overload', () => {
    const validQuery = createInfiniteQuery(
      (async (ctx) => ctx.pageParam as number) satisfies QueryFunction<
        number,
        readonly ['v']
      >,
      {
        queryKey: ['v'],
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      },
    );

    expect(validQuery.options.queryKey).toEqual(['v']);
    // @ts-expect-error initialData must match queryFn return type from issue #66
    createInfiniteQuery(async () => 1, {
      queryKey: ['v'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      initialData: { pages: ['2'], pageParams: [0] },
    });
  });

  it('keeps select behavior for queryFn overload', () => {
    const query = createInfiniteQuery<
      number,
      Error,
      number,
      string,
      readonly ['select']
    >(async (ctx) => ctx.pageParam as number, {
      enabled: false,
      queryKey: ['select'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      initialData: { pages: [2], pageParams: [0] },
      select: ((data) =>
        data.pages.map((n) => n.toString()).join('|')) satisfies (
        data: InfiniteData<number, number>,
      ) => string,
    });

    expect(query.result.data).toBe('2');

    query.destroy();
  });

  it('creates infinite query from queryClient and dynamic options overload', () => {
    const queryFn = vi.fn(async (ctx) => ctx.pageParam as number);
    const client = new QueryClient();

    const query = createInfiniteQuery(client, () => ({
      enabled: false,
      queryKey: ['dynamic-options'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      queryFn,
    }));

    expect(query).toBeInstanceOf(InfiniteQuery);
    expect(query.options.queryKey).toEqual(['dynamic-options']);
    expect(query.options.queryFn).toBe(queryFn);

    query.destroy();
  });

  it('creates infinite query from queryClient and static options object (not a getter)', () => {
    const queryFn = vi.fn(async (ctx) => ctx.pageParam as number);
    const client = new QueryClient();

    const query = createInfiniteQuery(client, {
      enabled: false,
      queryKey: ['static-client-options'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      queryFn,
    });

    expect(getQueryClient(query)).toBe(client);
    expect(query.options.queryKey).toEqual(['static-client-options']);
    expect(query.options.queryFn).toBe(queryFn);

    query.destroy();
  });

  it('uses queryClient from options for queryFn overload', () => {
    const customClient = new QueryClient();
    const queryFn = vi.fn(async (ctx) => ctx.pageParam as number);

    const query = createInfiniteQuery(queryFn, {
      enabled: false,
      queryKey: ['fn-with-custom-client'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      queryClient: customClient,
    });

    expect(getQueryClient(query)).toBe(customClient);
    expect(getQueryClient(query)).not.toBe(presetModuleQueryClient);

    query.destroy();
  });

  it('queryFn overload: uses preset queryClient when options omit queryClient (PartialKeys)', () => {
    const queryFn = vi.fn(async (ctx) => ctx.pageParam as number);

    const query = createInfiniteQuery(queryFn, {
      enabled: false,
      queryKey: ['omit-query-client-field'] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    expect(getQueryClient(query)).toBe(presetModuleQueryClient);

    query.destroy();
  });

  it('uses explicit queryClient in single options overload', () => {
    const customClient = new QueryClient();
    const queryFn = vi.fn(async (ctx) => Number(ctx.pageParam) + 40);

    const query = createInfiniteQuery({
      queryClient: customClient,
      enabled: false,
      queryKey: ['single-options-with-client'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
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

    createInfiniteQuery(
      async (ctx) => {
        expectTypeOf(ctx).toMatchTypeOf<CtxWide>();
        return ctx.pageParam;
      },
      {
        queryKey: ['wide'] as const,
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      },
    );

    createInfiniteQuery(
      async (ctx) => {
        expectTypeOf(ctx).toMatchTypeOf<CtxFioBar>();
        return ctx.pageParam;
      },
      {
        queryKey: ['fio', 'bar'] as const,
        initialPageParam: 0,
        getNextPageParam: () => undefined,
        enabled: true,
      },
    );

    createInfiniteQuery(
      async (ctx) => {
        expectTypeOf(ctx).toMatchTypeOf<CtxFioBar>();
        return ctx.pageParam;
      },
      {
        initialPageParam: 0,
        getNextPageParam: () => undefined,
        options: () => ({
          queryKey: ['fio', 'bar'] as const,
          enabled: true,
        }),
      },
    );

    createInfiniteQuery({
      queryFn: async (ctx) => {
        expectTypeOf(ctx).toMatchTypeOf<CtxFioBar>();
        return ctx.pageParam;
      },
      queryKey: ['fio', 'bar'] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      enabled: true,
    });

    createInfiniteQuery({
      queryFn: async (ctx) => {
        expectTypeOf(ctx).toMatchTypeOf<CtxFioBar>();
        return ctx.pageParam;
      },
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      options: () => ({
        queryKey: ['fio', 'bar'] as const,
        enabled: true,
      }),
    });

    createInfiniteQuery(client, () => ({
      queryFn: async (ctx) => {
        expectTypeOf(ctx).toMatchTypeOf<CtxFioBar>();
        return ctx.pageParam;
      },
      queryKey: ['fio', 'bar'] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      enabled: true,
    }));

    createInfiniteQuery(client, {
      queryFn: async (ctx) => {
        expectTypeOf(ctx).toMatchTypeOf<CtxFioBar>();
        return ctx.pageParam;
      },
      queryKey: ['fio', 'bar'] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      enabled: true,
    });
  });
});
