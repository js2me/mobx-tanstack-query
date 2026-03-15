import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Query } from '../query.js';
import { QueryClient } from '../query-client.js';
import { createQuery } from './create-query.js';

describe('createQuery', () => {
  it('preserves typings for overloads', () => {
    type User = {
      id: string;
      email: string;
    };

    const queryFnReturnsNumber: () => number = () => 1;
    const queryFnReturnsUser: () => Promise<User> = async () => ({
      id: '1',
      email: 'alice@example.com',
    });

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

    const queryFromFnWithSelect = createQuery(
      async () => ({ id: '1', email: 'alice@example.com' }),
      {
        enabled: false,
        queryKey: ['user'] as const,
        initialData: { id: '0', email: 'init@example.com' },
        select: (user) => user.email,
      },
    );

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
      select: (count) => count.toString(),
    });

    expectTypeOf(queryFromOptionsWithExplicitGenerics.data).toEqualTypeOf<
      string | undefined
    >();

    const queryFromClientAndOptions = createQuery(new QueryClient(), () => ({
      enabled: false,
      queryKey: ['dynamic'] as const,
      queryFn: async () => 1,
      select: (count) => count.toString(),
    }));

    expectTypeOf(queryFromClientAndOptions.data).toEqualTypeOf<
      string | undefined
    >();

    createQuery(queryFnReturnsNumber, {
      initialData: 2,
    });

    // @ts-expect-error initialData must match queryFn return type
    createQuery<() => number>(queryFnReturnsNumber, {
      initialData: '2',
    });

    // @ts-expect-error initialData still uses queryFn data, not selected data
    createQuery<() => Promise<User>, Error, string>(queryFnReturnsUser, {
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

    query.dispose();
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

    query.dispose();
  });

  it('keeps select behavior for queryFn overload', () => {
    const query = createQuery(async () => 1, {
      enabled: false,
      queryKey: ['select'],
      initialData: 2,
      select: (count) => count.toString(),
    });

    expect(query.result.data).toBe('2');

    query.dispose();
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

    query.dispose();
  });
});
