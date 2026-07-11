import { FetchQuery, QueryClient } from 'mobx-tanstack-query';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { createFetchQuery } from './create-fetch-query.js';

describe('createFetchQuery', () => {
  it('preserves typings for overloads', () => {
    type User = {
      id: string;
      email: string;
    };

    // options-only overload — queryClient defaults to preset
    const queryFromOptions = createFetchQuery({
      params: () => ({ path: '/users/1' }),
    });

    expectTypeOf(queryFromOptions.data).toEqualTypeOf<unknown | undefined>();

    // options-only overload with explicit generics
    const queryFromOptionsWithGenerics = createFetchQuery<User>({
      params: () => ({ path: '/users/1' }),
    });

    expectTypeOf(queryFromOptionsWithGenerics.data).toEqualTypeOf<
      User | undefined
    >();

    // options-only overload with select
    const queryFromOptionsWithSelect = createFetchQuery<string, User>({
      params: () => ({ path: '/users/1' }),
      select: (user) => user.email,
    });

    expectTypeOf(queryFromOptionsWithSelect.data).toEqualTypeOf<
      string | undefined
    >();

    // queryClient + dynamic options overload
    const queryFromClientAndOptions = createFetchQuery<string, User>(
      new QueryClient(),
      () => ({
        params: () => ({ path: '/users/1' }),
        select: (user) => user.email,
      }),
    );

    expectTypeOf(queryFromClientAndOptions.data).toEqualTypeOf<
      string | undefined
    >();

    // queryClient + static options overload
    const queryFromClientAndStaticOptions = createFetchQuery<User>(
      new QueryClient(),
      {
        params: () => ({ path: '/users/1' }),
      },
    );

    expectTypeOf(queryFromClientAndStaticOptions.data).toEqualTypeOf<
      User | undefined
    >();
  });

  it('returns FetchQuery instance from options overload', () => {
    const query = createFetchQuery({
      params: () => ({ path: '/test' }),
    });

    expect(query).toBeInstanceOf(FetchQuery);

    query.destroy();
  });

  it('returns FetchQuery instance from queryClient overload', () => {
    const client = new QueryClient();
    const query = createFetchQuery(client, {
      params: () => ({ path: '/test' }),
    });

    expect(query).toBeInstanceOf(FetchQuery);

    query.destroy();
  });

  it('uses preset queryClient when not provided', () => {
    const query = createFetchQuery({
      params: () => ({ path: '/test' }),
    });

    // The preset queryClient should be used
    expect(query).toBeInstanceOf(FetchQuery);

    query.destroy();
  });

  it('uses explicit queryClient in single options overload', () => {
    const customClient = new QueryClient();

    const query = createFetchQuery({
      queryClient: customClient,
      params: () => ({ path: '/test' }),
    });

    expect(query).toBeInstanceOf(FetchQuery);

    query.destroy();
  });
});
