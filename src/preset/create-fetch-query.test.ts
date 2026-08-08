import { observable, runInAction, when } from 'mobx';
import { FetchQuery, QueryClient } from 'mobx-tanstack-query';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
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

    // 1-arg function overload — queryClient defaults to preset
    const queryFromFunction = createFetchQuery<User>(() => ({
      params: () => ({ path: '/users/1' }),
    }));

    expectTypeOf(queryFromFunction.data).toEqualTypeOf<User | undefined>();

    // 1-arg function overload with select
    const queryFromFunctionWithSelect = createFetchQuery<string, User>(() => ({
      params: () => ({ path: '/users/1' }),
      select: (user) => user.email,
    }));

    expectTypeOf(queryFromFunctionWithSelect.data).toEqualTypeOf<
      string | undefined
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

  it('accepts params as a plain object in options-only overload', () => {
    const query = createFetchQuery({
      params: { path: '/users/1' },
    });

    expect(query).toBeInstanceOf(FetchQuery);

    query.destroy();
  });

  it('accepts params as a plain object with explicit queryClient', () => {
    const customClient = new QueryClient();

    const query = createFetchQuery({
      queryClient: customClient,
      params: { path: '/users/1' },
    });

    expect(query).toBeInstanceOf(FetchQuery);

    query.destroy();
  });

  it('accepts params as a plain object in queryClient + options overload', () => {
    const client = new QueryClient();
    const query = createFetchQuery(client, {
      params: { path: '/users/1' },
    });

    expect(query).toBeInstanceOf(FetchQuery);

    query.destroy();
  });

  it('accepts params as a plain object with select in options-only overload', () => {
    type User = { id: string; email: string };

    const query = createFetchQuery<string, User>({
      params: { path: '/users/1' },
      select: (user) => user.email,
    });

    expect(query).toBeInstanceOf(FetchQuery);

    query.destroy();
  });

  it('preserves typings when params is a plain object', () => {
    type User = {
      id: string;
      email: string;
    };

    // options-only overload with plain params object
    const queryFromOptions = createFetchQuery<User>({
      params: { path: '/users/1' },
    });

    expectTypeOf(queryFromOptions.data).toEqualTypeOf<User | undefined>();

    // options-only overload with plain params object and select
    const queryFromOptionsWithSelect = createFetchQuery<string, User>({
      params: { path: '/users/1' },
      select: (user) => {
        expectTypeOf(user).toEqualTypeOf<User>();
        expectTypeOf(user.email).toEqualTypeOf<string>();
        return user.email;
      },
    });

    expectTypeOf(queryFromOptionsWithSelect.data).toEqualTypeOf<
      string | undefined
    >();

    // queryClient + static options overload with plain params object
    const queryFromClientAndStaticOptions = createFetchQuery<User>(
      new QueryClient(),
      {
        params: { path: '/users/1' },
      },
    );

    expectTypeOf(queryFromClientAndStaticOptions.data).toEqualTypeOf<
      User | undefined
    >();
  });

  describe('fetching', () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const okJson = (data: unknown) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    it('fetches from the queryClient + object options overload', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const query = createFetchQuery(new QueryClient(), {
        params: { path: '/users/1' },
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/users/1', expect.any(Object));
      expect(query.data).toEqual({ id: 1 });

      query.destroy();
    });

    it('fetches from the queryClient + function options overload', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 2 }));

      const query = createFetchQuery(new QueryClient(), () => ({
        params: { path: '/users/2' },
      }));

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/users/2', expect.any(Object));
      expect(query.data).toEqual({ id: 2 });

      query.destroy();
    });

    it('fetches from the function config overload with explicit queryClient', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 3 }));

      const query = createFetchQuery(() => ({
        queryClient: new QueryClient(),
        params: { path: '/users/3' },
      }));

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/users/3', expect.any(Object));
      expect(query.data).toEqual({ id: 3 });

      query.destroy();
    });

    it('uses the preset queryClient in the function config overload', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 4 }));

      const query = createFetchQuery(() => ({ params: { path: '/users/4' } }));

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/users/4', expect.any(Object));
      expect(query.data).toEqual({ id: 4 });

      query.destroy();
    });

    it('refetches when observables inside the function config change', async () => {
      fetchSpy
        .mockResolvedValueOnce(okJson({ id: 1 }))
        .mockResolvedValueOnce(okJson({ id: 2 }));

      const state = observable({ id: 1 });
      const query = createFetchQuery(() => ({
        queryClient: new QueryClient(),
        params: { path: `/users/${state.id}` },
      }));

      await when(() => !query.isLoading);
      expect(query.data).toEqual({ id: 1 });

      runInAction(() => {
        state.id = 2;
      });

      await when(() => (query.data as any)?.id === 2);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      query.destroy();
    });
  });
});
