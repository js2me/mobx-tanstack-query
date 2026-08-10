/// <reference types="node" />
import { QueryClient } from '@tanstack/query-core';
import { observable, runInAction, when } from 'mobx';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import {
  buildFetchQueryKey,
  buildFetchQueryUrl,
  FetchQuery,
  parseFetchQueryKey,
  serializeFetchQuery,
} from './fetch-query.js';
import { QueryClient as MobxQueryClient } from './query-client.js';

const okJson = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

const okText = (data: string, init?: ResponseInit) =>
  new Response(data, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
    ...init,
  });

const errorResponse = (status: number) =>
  new Response(null, { status, statusText: 'error' });

describe('serializeFetchQuery', () => {
  it('returns null when query is undefined', () => {
    expect(serializeFetchQuery()).toBeUndefined();
  });

  it('returns null when query is empty object', () => {
    expect(serializeFetchQuery({})).toBeUndefined();
  });

  it('returns null when all values are null/undefined', () => {
    expect(serializeFetchQuery({ a: null, b: undefined })).toBeUndefined();
  });

  it('serializes only defined values into strings', () => {
    expect(
      serializeFetchQuery({
        page: 1,
        active: true,
        title: 'hello',
        skipNull: null,
        skipUndef: undefined,
      }),
    ).toEqual({ page: '1', active: 'true', title: 'hello' });
  });
});

describe('buildFetchQueryUrl', () => {
  it('returns path unchanged when query is undefined', () => {
    expect(buildFetchQueryUrl('/users', undefined)).toBe('/users');
  });

  it('appends a query string when path has none', () => {
    expect(buildFetchQueryUrl('/users', { a: '1', b: '2' })).toBe(
      '/users?a=1&b=2',
    );
  });

  it('joins with & when path already has a query string', () => {
    expect(buildFetchQueryUrl('/users?x=10', { a: '1' })).toBe(
      '/users?x=10&a=1',
    );
  });

  it('returns path unchanged when serialized query string is empty', () => {
    expect(buildFetchQueryUrl('/users', {})).toBe('/users');
  });
});

describe('buildFetchQueryKey / parseFetchQueryKey', () => {
  it('builds [null] for null params', () => {
    expect(buildFetchQueryKey(null)).toEqual([null]);
  });

  it('roundtrips path/query/method/headers/body/meta', () => {
    const params = {
      path: '/api/users',
      query: { page: 1 },
      method: 'POST',
      headers: { 'X-Token': 'abc' },
      body: '{"search":"hello"}',
      notFoundAsNull: true,
      responseType: 'json' as const,
      request: { cache: 'no-cache' as RequestCache },
      throwOnError: false,
    };
    const key = buildFetchQueryKey(params);
    const parsed = parseFetchQueryKey(key);

    expect(parsed).toEqual({
      path: '/api/users',
      query: { page: '1' },
      method: 'POST',
      headers: { 'X-Token': 'abc' },
      body: '{"search":"hello"}',
      notFoundAsNull: true,
      responseType: 'json',
      request: { cache: 'no-cache' },
      throwOnError: false,
    });
  });

  it('stores plain object body as-is in key', () => {
    const key = buildFetchQueryKey({
      path: '/search',
      body: { q: 'hello' },
    });
    const meta = key[key.length - 1] as { body: unknown };
    expect(meta.body).toEqual({ q: 'hello' });
  });

  it('stores string body as-is in key', () => {
    const key = buildFetchQueryKey({
      path: '/submit',
      body: 'raw-payload',
    });
    const meta = key[key.length - 1] as { body: string | null };
    expect(meta.body).toBe('raw-payload');
  });

  it('stores FormData body as-is in key', () => {
    const formData = new FormData();
    const key = buildFetchQueryKey({
      path: '/upload',
      body: formData,
    });
    const meta = key[key.length - 1] as { body: unknown };
    expect(meta.body).toBe(formData);
  });

  it('stores null headers when not provided', () => {
    const key = buildFetchQueryKey({ path: '/items' });
    const meta = key[key.length - 1] as { headers: unknown };
    expect(meta.headers).toBeUndefined();
  });

  it('parse returns null when key is null-headed', () => {
    expect(parseFetchQueryKey([null])).toBeNull();
  });

  it('parse returns null for empty key', () => {
    expect(parseFetchQueryKey([])).toBeNull();
  });
});

describe('FetchQuery', () => {
  let queryClient: QueryClient;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and exposes JSON data', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ id: 1, name: 'js2me' }));

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/users/1' }),
    });

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenCalledWith('/users/1', {
      signal: expect.any(AbortSignal),
    });
    expect(query.data).toEqual({ id: 1, name: 'js2me' });
    expect(query.isSuccess).toBe(true);

    query.destroy();
  });

  it('builds URL with serialized query params', async () => {
    fetchSpy.mockResolvedValueOnce(okJson([{ id: 1 }]));

    const query = new FetchQuery(queryClient, {
      params: () => ({
        path: '/users',
        query: { page: 1, active: true, skip: null },
      }),
    });

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/users?page=1&active=true',
      expect.any(Object),
    );

    query.destroy();
  });

  it('is disabled when params returns falsy', async () => {
    const query = new FetchQuery(queryClient, {
      params: () => false,
    });

    expect(query.options.enabled).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    query.destroy();
  });

  it('returns text when responseType is "text"', async () => {
    fetchSpy.mockResolvedValueOnce(okText('plain body'));

    const query = new FetchQuery<string>(queryClient, {
      params: () => ({ path: '/readme', responseType: 'text' }),
    });

    await when(() => !query.isLoading);

    expect(query.data).toBe('plain body');

    query.destroy();
  });

  it('throws on non-ok response', async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(500));

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/oops' }),
      throwOnError: false,
      retry: false,
    });

    await when(() => query.isError);

    expect(query.error).toBeInstanceOf(Response);
    expect((query.error as unknown as Response).status).toBe(500);

    query.destroy();
  });

  it('returns null on 404 when notFoundAsNull is true', async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(404));

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/missing', notFoundAsNull: true }),
      retry: false,
    });

    await when(() => !query.isLoading);

    expect(query.isSuccess).toBe(true);
    expect(query.data).toBeNull();

    query.destroy();
  });

  it('still throws on 404 when notFoundAsNull is false', async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(404));

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/missing' }),
      throwOnError: false,
      retry: false,
    });

    await when(() => query.isError);
    expect(query.error).toBeInstanceOf(Response);
    expect((query.error as unknown as Response).status).toBe(404);

    query.destroy();
  });

  it('honors throwOnError: false from params (query key round-trip)', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'oops' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/oops', throwOnError: false }),
      retry: false,
    });

    await when(() => !query.isLoading);

    expect(query.isSuccess).toBe(true);
    expect(query.data).toEqual({ message: 'oops' });

    query.destroy();
  });

  it('applies select() to transform response', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ id: 1, name: 'js2me' }));

    const query = new FetchQuery<string>(queryClient, {
      params: () => ({ path: '/users/1' }),
      select: (data) => (data as { name: string }).name.toUpperCase(),
    });

    await when(() => !query.isLoading);

    expect(query.data).toBe('JS2ME');

    query.destroy();
  });

  it('sends JSON body with auto POST method and Content-Type', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/search', body: { q: 'hello' } }),
    });

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenCalledWith('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"q":"hello"}',
      signal: expect.any(AbortSignal),
    });

    query.destroy();
  });

  it('allows overriding auto method and Content-Type', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

    const query = new FetchQuery(queryClient, {
      params: () => ({
        path: '/search',
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain', 'X-Custom': 'yes' },
        body: { q: 'hello' },
      }),
    });

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenCalledWith('/search', {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain', 'X-Custom': 'yes' },
      body: '{"q":"hello"}',
      signal: expect.any(AbortSignal),
    });

    query.destroy();
  });

  it('sends string body as-is without Content-Type auto-set', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/submit', body: 'raw-payload' }),
    });

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenCalledWith('/submit', {
      method: 'POST',
      headers: undefined,
      body: 'raw-payload',
      signal: expect.any(AbortSignal),
    });

    query.destroy();
  });

  it('sends FormData body without JSON auto-handling', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));
    const formData = new FormData();
    formData.append('file', 'content');

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/upload', body: formData }),
    });

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenCalledWith('/upload', {
      method: 'POST',
      headers: undefined,
      body: formData,
      signal: expect.any(AbortSignal),
    });

    query.destroy();
  });

  it('sends custom headers alongside JSON body', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

    const query = new FetchQuery(queryClient, {
      params: () => ({
        path: '/data',
        headers: { Authorization: 'Bearer __SECRET_TOKEN__' },
        body: { page: 1 },
      }),
    });

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenCalledWith('/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer __SECRET_TOKEN__',
      },
      body: '{"page":1}',
      signal: expect.any(AbortSignal),
    });

    query.destroy();
  });

  it('forwards remaining request options (credentials, cache, etc.)', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

    const query = new FetchQuery(queryClient, {
      params: () => ({
        path: '/data',
        request: { credentials: 'include', cache: 'no-cache' },
      }),
    });

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenCalledWith('/data', {
      credentials: 'include',
      cache: 'no-cache',
      method: undefined,
      headers: undefined,
      body: undefined,
      signal: expect.any(AbortSignal),
    });

    query.destroy();
  });

  it('does not default to POST when there is no body', async () => {
    fetchSpy.mockResolvedValueOnce(okJson([]));

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/items' }),
    });

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenCalledWith('/items', {
      method: undefined,
      headers: undefined,
      body: undefined,
      signal: expect.any(AbortSignal),
    });

    query.destroy();
  });

  it('different body values produce different query keys', async () => {
    const key1 = buildFetchQueryKey({ path: '/search', body: { q: 'a' } });
    const key2 = buildFetchQueryKey({ path: '/search', body: { q: 'b' } });

    expect(key1).not.toEqual(key2);
  });

  it('same body values produce same query key', async () => {
    const key1 = buildFetchQueryKey({ path: '/search', body: { q: 'a' } });
    const key2 = buildFetchQueryKey({ path: '/search', body: { q: 'a' } });

    expect(key1).toEqual(key2);
  });

  it('refetches when observable params change (different query key)', async () => {
    fetchSpy
      .mockResolvedValueOnce(okJson({ id: 1 }))
      .mockResolvedValueOnce(okJson({ id: 2 }));

    const state = observable({ id: 1 });
    const query = new FetchQuery(queryClient, {
      params: () => ({ path: `/users/${state.id}` }),
    });

    await when(() => !query.isLoading);
    expect(query.data).toEqual({ id: 1 });

    runInAction(() => {
      state.id = 2;
    });

    await when(() => (query.data as any)?.id === 2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    query.destroy();
  });

  it('aborts fetch when destroy is called', async () => {
    let capturedSignal: AbortSignal | undefined;
    fetchSpy.mockImplementation((_url, init) => {
      capturedSignal = init.signal;
      return new Promise(() => {});
    });

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/slow' }),
    });

    await vi.waitFor(() => expect(capturedSignal).toBeDefined());

    query.destroy();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('requires queryClient as the first argument', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

    const query = new FetchQuery(queryClient, {
      params: () => ({ path: '/users/1' }),
    });

    await when(() => !query.isLoading);

    expect(queryClient.getQueryData(query.options.queryKey)).toEqual({
      id: 1,
    });

    query.destroy();
  });

  it('accepts queryClient inside config object', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

    const query = new FetchQuery({
      queryClient,
      params: () => ({ path: '/users/1' }),
    });

    await when(() => !query.isLoading);

    expect(query.data).toEqual({ id: 1 });

    query.destroy();
  });

  it('accepts a function returning the full config', async () => {
    fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

    const query = new FetchQuery(() => ({
      queryClient,
      params: { path: '/users/1' },
    }));

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenCalledWith('/users/1', {
      signal: expect.any(AbortSignal),
    });
    expect(query.data).toEqual({ id: 1 });

    query.destroy();
  });

  it('preserves typings for the function config overload', () => {
    type User = { id: number; name: string };

    // params returns falsy so the query stays disabled (no fetch) during this type check
    const query = new FetchQuery<User>(() => ({
      queryClient,
      params: () => null,
    }));

    expectTypeOf(query.data).toEqualTypeOf<User | undefined>();

    const queryWithSelect = new FetchQuery<string, User>(() => ({
      queryClient,
      params: () => null,
      select: (user) => user.name,
    }));

    expectTypeOf(queryWithSelect.data).toEqualTypeOf<string | undefined>();

    query.destroy();
    queryWithSelect.destroy();
  });

  it('refetches when observable values inside the config function change', async () => {
    fetchSpy
      .mockResolvedValueOnce(okJson({ id: 1 }))
      .mockResolvedValueOnce(okJson({ id: 2 }));

    const state = observable({ id: 1 });
    const query = new FetchQuery(() => ({
      queryClient,
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

  it('supports a nested params function inside the config function', async () => {
    fetchSpy
      .mockResolvedValueOnce(okJson({ id: 1 }))
      .mockResolvedValueOnce(okJson({ id: 2 }));

    const state = observable({ id: 1 });
    const query = new FetchQuery(() => ({
      queryClient,
      params: () => ({ path: `/users/${state.id}` }),
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

  describe('client-level headers from fetchQueries', () => {
    let clientWithHeaders: MobxQueryClient;

    beforeEach(() => {
      clientWithHeaders = new MobxQueryClient({
        fetchQueries: {
          headers: { Authorization: 'Bearer token', 'X-App': 'test' },
        },
      });
    });

    it('merges client-level headers with request headers', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

      const query = new FetchQuery(clientWithHeaders, {
        params: () => ({
          path: '/data',
          headers: { 'X-Custom': 'yes' },
        }),
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/data', {
        method: undefined,
        headers: {
          Authorization: 'Bearer token',
          'X-App': 'test',
          'X-Custom': 'yes',
        },
        body: undefined,
        signal: expect.any(AbortSignal),
      });

      query.destroy();
    });

    it('request headers override client-level headers', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

      const query = new FetchQuery(clientWithHeaders, {
        params: () => ({
          path: '/data',
          headers: { Authorization: 'Override' },
        }),
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/data', {
        method: undefined,
        headers: {
          Authorization: 'Override',
          'X-App': 'test',
        },
        body: undefined,
        signal: expect.any(AbortSignal),
      });

      query.destroy();
    });

    it('applies client-level headers before Content-Type for JSON body', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

      const query = new FetchQuery(clientWithHeaders, {
        params: () => ({
          path: '/data',
          body: { q: 'hello' },
        }),
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
          'X-App': 'test',
        },
        body: '{"q":"hello"}',
        signal: expect.any(AbortSignal),
      });

      query.destroy();
    });

    it('uses only request headers when client has no fetchQueries', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

      const query = new FetchQuery(queryClient, {
        params: () => ({
          path: '/data',
          headers: { Authorization: '__SECRET_3__' },
        }),
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/data', {
        method: undefined,
        headers: { Authorization: '__SECRET_3__' },
        body: undefined,
        signal: expect.any(AbortSignal),
      });

      query.destroy();
    });
  });

  describe('customFetch from fetchQueries', () => {
    it('uses customFetch when provided', async () => {
      const customFetch = vi
        .fn()
        .mockResolvedValueOnce(okJson({ custom: true }));
      const clientWithCustomFetch = new MobxQueryClient({
        fetchQueries: { customFetch },
      });

      const query = new FetchQuery(clientWithCustomFetch, {
        params: () => ({ path: '/custom' }),
      });

      await when(() => !query.isLoading);

      expect(customFetch).toHaveBeenCalledWith('/custom', {
        method: undefined,
        headers: undefined,
        body: undefined,
        signal: expect.any(AbortSignal),
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(query.data).toEqual({ custom: true });

      query.destroy();
    });

    it('falls back to globalThis.fetch when customFetch is not provided', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ default: true }));

      const query = new FetchQuery(queryClient, {
        params: () => ({ path: '/default' }),
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/default', expect.any(Object));
      expect(query.data).toEqual({ default: true });

      query.destroy();
    });

    it('customFetch works with client-level headers and baseUrl', async () => {
      const customFetch = vi.fn().mockResolvedValueOnce(okJson({ ok: true }));
      const clientWithCustomFetch = new MobxQueryClient({
        fetchQueries: {
          customFetch,
          baseUrl: 'https://api.example.com',
          headers: { Authorization: 'Bearer token' },
        },
      });

      const query = new FetchQuery(clientWithCustomFetch, {
        params: () => ({ path: '/data' }),
      });

      await when(() => !query.isLoading);

      expect(customFetch).toHaveBeenCalledWith('https://api.example.com/data', {
        method: undefined,
        headers: { Authorization: 'Bearer token' },
        body: undefined,
        signal: expect.any(AbortSignal),
      });

      query.destroy();
    });
  });

  describe('transformResponse from fetchQueries', () => {
    it('uses client-level transformResponse', async () => {
      fetchSpy.mockResolvedValueOnce(
        okJson({ data: { id: 1 }, meta: { page: 1 } }),
      );

      const clientWithTransform = new MobxQueryClient({
        fetchQueries: {
          transformResponse: async (response) => {
            const json = (await response.json()) as {
              data: unknown;
              meta: unknown;
            };
            return json.data;
          },
        },
      });

      const query = new FetchQuery(clientWithTransform, {
        params: () => ({ path: '/wrapped' }),
      });

      await when(() => !query.isLoading);

      expect(query.data).toEqual({ id: 1 });

      query.destroy();
    });

    it('per-query transformResponse overrides client-level transformResponse', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ data: { id: 1 } }));

      const clientWithTransform = new MobxQueryClient({
        fetchQueries: {
          transformResponse: async () => 'client-transform',
        },
      });

      const query = new FetchQuery<string>(clientWithTransform, {
        params: () => ({
          path: '/wrapped',
          transformResponse: async (response) => {
            const json = (await response.json()) as { data: unknown };
            return json.data as string;
          },
        }),
      });

      await when(() => !query.isLoading);

      expect(query.data).toEqual({ id: 1 });

      query.destroy();
    });

    it('does not use client-level transformResponse when not configured', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const query = new FetchQuery(queryClient, {
        params: () => ({ path: '/plain' }),
      });

      await when(() => !query.isLoading);

      expect(query.data).toEqual({ id: 1 });

      query.destroy();
    });
  });

  describe('timeout from fetchQueries', () => {
    it('aborts the request after the timeout elapses', async () => {
      fetchSpy.mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              );
            });
          }),
      );

      const clientWithTimeout = new MobxQueryClient({
        fetchQueries: { timeout: 10 },
      });

      const query = new FetchQuery(clientWithTimeout, {
        params: () => ({ path: '/slow' }),
        throwOnError: false,
        retry: false,
      });

      await when(() => query.isError);

      expect(query.error).toBeInstanceOf(DOMException);

      query.destroy();
    });

    it('does not set a timeout signal when timeout is not configured', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

      const query = new FetchQuery(queryClient, {
        params: () => ({ path: '/data' }),
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/data', {
        credentials: undefined,
        mode: undefined,
        method: undefined,
        headers: undefined,
        body: undefined,
        signal: expect.any(AbortSignal),
      });
      expect(query.isSuccess).toBe(true);

      query.destroy();
    });
  });

  describe('credentials from fetchQueries', () => {
    it('sends credentials from client-level config', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

      const clientWithCredentials = new MobxQueryClient({
        fetchQueries: { credentials: 'include' },
      });

      const query = new FetchQuery(clientWithCredentials, {
        params: () => ({ path: '/data' }),
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/data', {
        credentials: 'include',
        mode: undefined,
        method: undefined,
        headers: undefined,
        body: undefined,
        signal: expect.any(AbortSignal),
      });

      query.destroy();
    });

    it('per-request credentials overrides client-level credentials', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

      const clientWithCredentials = new MobxQueryClient({
        fetchQueries: { credentials: 'include' },
      });

      const query = new FetchQuery(clientWithCredentials, {
        params: () => ({
          path: '/data',
          request: { credentials: 'same-origin' },
        }),
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/data', {
        credentials: 'same-origin',
        mode: undefined,
        method: undefined,
        headers: undefined,
        body: undefined,
        signal: expect.any(AbortSignal),
      });

      query.destroy();
    });
  });

  describe('mode from fetchQueries', () => {
    it('sends mode from client-level config', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

      const clientWithMode = new MobxQueryClient({
        fetchQueries: { mode: 'cors' },
      });

      const query = new FetchQuery(clientWithMode, {
        params: () => ({ path: '/data' }),
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/data', {
        credentials: undefined,
        mode: 'cors',
        method: undefined,
        headers: undefined,
        body: undefined,
        signal: expect.any(AbortSignal),
      });

      query.destroy();
    });

    it('per-request mode overrides client-level mode', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ ok: true }));

      const clientWithMode = new MobxQueryClient({
        fetchQueries: { mode: 'cors' },
      });

      const query = new FetchQuery(clientWithMode, {
        params: () => ({
          path: '/data',
          request: { mode: 'no-cors' },
        }),
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/data', {
        credentials: undefined,
        mode: 'no-cors',
        method: undefined,
        headers: undefined,
        body: undefined,
        signal: expect.any(AbortSignal),
      });

      query.destroy();
    });
  });

  describe('meta', () => {
    it('sets meta on query options from params', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const query = new FetchQuery(queryClient, {
        params: () => ({ path: '/users/1', meta: { source: 'test' } }),
      });

      expect(query.options.meta).toEqual({ source: 'test' });

      await when(() => !query.isLoading);
      expect(query.data).toEqual({ id: 1 });

      query.destroy();
    });

    it('uses client-level meta as default', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const clientWithMeta = new MobxQueryClient({
        fetchQueries: { meta: { source: 'client' } },
      });

      const query = new FetchQuery(clientWithMeta, {
        params: () => ({ path: '/users/1' }),
      });

      expect(query.options.meta).toEqual({ source: 'client' });

      await when(() => !query.isLoading);
      expect(query.data).toEqual({ id: 1 });

      query.destroy();
    });

    it('per-request meta overrides client-level meta', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const clientWithMeta = new MobxQueryClient({
        fetchQueries: { meta: { source: 'client' } },
      });

      const query = new FetchQuery(clientWithMeta, {
        params: () => ({ path: '/users/1', meta: { source: 'request' } }),
      });

      expect(query.options.meta).toEqual({ source: 'request' });

      query.destroy();
    });

    it('updates meta reactively without refetching', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const state = observable({ source: 'a' });
      const query = new FetchQuery(queryClient, {
        params: () => ({ path: '/data', meta: { source: state.source } }),
      });

      await when(() => !query.isLoading);
      expect(query.options.meta).toEqual({ source: 'a' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      runInAction(() => {
        state.source = 'b';
      });

      expect(query.options.meta).toEqual({ source: 'b' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      query.destroy();
    });
  });

  describe('start()', () => {
    it('fetches using the params passed to start', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const query = new FetchQuery({ queryClient });

      expect(fetchSpy).not.toHaveBeenCalled();

      await query.start({
        params: { path: '/users/1' },
      });

      expect(fetchSpy).toHaveBeenCalledWith('/users/1', expect.any(Object));
      expect(query.data).toEqual({ id: 1 });

      query.destroy();
    });

    it('applies meta from start params', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const query = new FetchQuery({ queryClient });

      await query.start({
        params: { path: '/users/1', meta: { source: 'start' } },
      });

      expect(query.options.meta).toEqual({ source: 'start' });

      query.destroy();
    });

    it('preserves additional start options', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const query = new FetchQuery({ queryClient });

      await query.start({
        params: { path: '/users/1' },
        staleTime: 5000,
      });

      expect(query.options.staleTime).toBe(5000);

      query.destroy();
    });

    it('falls back to client-level meta when start params have no meta', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const clientWithMeta = new MobxQueryClient({
        fetchQueries: { meta: { source: 'client' } },
      });

      const query = new FetchQuery({ queryClient: clientWithMeta });

      await query.start({
        params: { path: '/users/1' },
      });

      expect(query.options.meta).toEqual({ source: 'client' });

      query.destroy();
    });
  });
});
