import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '../query-client.js';
import { makeFetchRequest } from './make-fetch-request.js';

const okJson = () => new Response('{"ok":true}', { status: 200 });

afterEach(() => {
  vi.useRealTimers();
});

describe('makeFetchRequest headers', () => {
  it('overrides client headers regardless of casing', async () => {
    const customFetch = vi.fn().mockResolvedValue(okJson());
    const queryClient = new QueryClient({
      fetchQueries: {
        customFetch,
        headers: { Authorization: 'client', 'X-Token': 'client' },
      },
    });

    await makeFetchRequest({
      queryClient,
      signal: new AbortController().signal,
      fetchParams: {
        path: '/data',
        headers: { authorization: 'request', 'x-token': 'request' },
      },
    });

    const headers = customFetch.mock.calls[0][1].headers;
    expect(new Headers(headers).get('authorization')).toBe('request');
    expect(new Headers(headers).get('x-token')).toBe('request');
    expect(Object.keys(headers)).toHaveLength(2);
  });

  it('keeps an explicit JSON content type regardless of casing', async () => {
    const customFetch = vi.fn().mockResolvedValue(okJson());
    const queryClient = new QueryClient({
      fetchQueries: {
        customFetch,
        headers: { 'Content-Type': 'application/json' },
      },
    });

    await makeFetchRequest({
      queryClient,
      signal: new AbortController().signal,
      fetchParams: {
        path: '/data',
        body: { id: 1 },
        headers: { 'content-type': 'application/vnd.api+json' },
      },
    });

    const headers = customFetch.mock.calls[0][1].headers;
    expect(new Headers(headers).get('content-type')).toBe(
      'application/vnd.api+json',
    );
    expect(Object.keys(headers)).toHaveLength(1);
  });
});

describe('makeFetchRequest timeout', () => {
  it('cleans up the source listener and timer after success', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const queryClient = new QueryClient({
      fetchQueries: {
        timeout: 10_000,
        customFetch: vi.fn().mockResolvedValue(okJson()),
      },
    });

    await makeFetchRequest({
      queryClient,
      signal: controller.signal,
      fetchParams: { path: '/data' },
    });

    expect(add).toHaveBeenCalledWith('abort', expect.any(Function), {
      once: true,
    });
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up on fetch rejection', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const failure = new Error('network failure');
    const queryClient = new QueryClient({
      fetchQueries: {
        timeout: 10_000,
        customFetch: vi.fn().mockRejectedValue(failure),
      },
    });

    await expect(
      makeFetchRequest({
        queryClient,
        signal: controller.signal,
        fetchParams: { path: '/data' },
      }),
    ).rejects.toBe(failure);

    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up when response parsing rejects', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const queryClient = new QueryClient({
      fetchQueries: {
        timeout: 10_000,
        customFetch: vi.fn().mockResolvedValue(new Response('not json')),
      },
    });

    await expect(
      makeFetchRequest({
        queryClient,
        signal: controller.signal,
        fetchParams: { path: '/data' },
      }),
    ).rejects.toThrow();

    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start a timer for an already-aborted signal', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort();
    const customFetch = vi
      .fn()
      .mockImplementation((_url, init: RequestInit) => {
        expect(init.signal?.aborted).toBe(true);
        return Promise.reject(new Error('aborted'));
      });
    const queryClient = new QueryClient({
      fetchQueries: { timeout: 10_000, customFetch },
    });

    await expect(
      makeFetchRequest({
        queryClient,
        signal: controller.signal,
        fetchParams: { path: '/data' },
      }),
    ).rejects.toThrow('aborted');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts on timeout and propagates source abort', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const customFetch = vi
      .fn()
      .mockImplementation((_url, init: RequestInit) => {
        signals.push(init.signal!);
        return new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        });
      });
    const queryClient = new QueryClient({
      fetchQueries: { timeout: 10, customFetch },
    });
    const source = new AbortController();
    const bySource = makeFetchRequest({
      queryClient,
      signal: source.signal,
      fetchParams: { path: '/source' },
    });
    source.abort();
    await expect(bySource).rejects.toThrow('aborted');
    expect(signals[0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    const byTimeout = makeFetchRequest({
      queryClient,
      signal: new AbortController().signal,
      fetchParams: { path: '/timeout' },
    });
    const timeoutRejection = expect(byTimeout).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(10);
    await timeoutRejection;
    expect(signals[1].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
