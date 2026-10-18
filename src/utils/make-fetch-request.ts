import type { FetchQueryParams, TransformResponseFn } from '../fetch-query.js';
import {
  buildFetchQueryUrl,
  isNativeBodyInit,
  serializeFetchQuery,
} from '../fetch-query.js';
import type { QueryClient } from '../query-client.js';
import type { AnyQueryClient } from '../query-client.types.js';

export interface MakeFetchRequestOptions<TOutputData = any> {
  fetchParams: Omit<FetchQueryParams<TOutputData>, 'transformResponse'>;
  transformResponse?: TransformResponseFn;
  queryClient: AnyQueryClient;
  signal: AbortSignal;
}

function mergeHeaders(
  clientHeaders?: Record<string, string>,
  requestHeaders?: Record<string, string>,
  jsonBody?: boolean,
): Record<string, string> | undefined {
  if (!clientHeaders && !requestHeaders && !jsonBody) {
    return undefined;
  }

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries({
    ...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...clientHeaders,
    ...requestHeaders,
  })) {
    const existing = Object.keys(headers).find(
      (key) => key.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      delete headers[existing];
    }
    headers[name] = value;
  }
  return headers;
}

export async function makeFetchRequest<TOutputData = any>(
  options: MakeFetchRequestOptions<TOutputData>,
): Promise<TOutputData | null> {
  const { fetchParams, queryClient, signal } = options;
  const clientFetchQueries = (queryClient as QueryClient).fetchQueries ?? {};
  const throwOnError =
    fetchParams.throwOnError ?? clientFetchQueries.throwOnError ?? true;

  const transformResponse =
    options.transformResponse ?? clientFetchQueries.transformResponse;

  const baseUrl = fetchParams.baseUrl ?? clientFetchQueries.baseUrl;

  const serializedQuery = serializeFetchQuery(fetchParams.query);
  const url = buildFetchQueryUrl(
    baseUrl ? `${baseUrl}${fetchParams.path}` : fetchParams.path,
    serializedQuery,
  );

  let fetchBody: BodyInit | undefined;

  if (fetchParams.body != null) {
    if (isNativeBodyInit(fetchParams.body)) {
      fetchBody = fetchParams.body;
    } else {
      fetchBody = JSON.stringify(fetchParams.body);
    }
  }
  const fetchHeaders = mergeHeaders(
    clientFetchQueries.headers,
    fetchParams.headers,
    fetchParams.body != null && !isNativeBodyInit(fetchParams.body),
  );

  const customFetch = clientFetchQueries.customFetch;
  const fetch = customFetch ?? globalThis.fetch;

  let abortSignal = signal;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  if (clientFetchQueries.timeout) {
    const abortControllerWithTimeout = new AbortController();
    abortHandler = () => {
      clearTimeout(timeoutId);
      abortControllerWithTimeout.abort();
    };

    if (signal.aborted) {
      abortHandler();
    } else {
      signal.addEventListener('abort', abortHandler, { once: true });
      timeoutId = setTimeout(abortHandler, clientFetchQueries.timeout);
    }

    abortSignal = abortControllerWithTimeout.signal;
  }

  const requestInit: RequestInit = {
    credentials: clientFetchQueries.credentials,
    mode: clientFetchQueries.mode,
    ...fetchParams.request,
    method:
      fetchParams.method ?? (fetchParams.body != null ? 'POST' : undefined),
    headers: fetchHeaders,
    body: fetchBody,
    signal: abortSignal,
  };

  try {
    const response = await fetch(url, requestInit);

    if (!response.ok) {
      if (fetchParams.notFoundAsNull && response.status === 404) {
        return null;
      }

      if (throwOnError) {
        throw response;
      }
    }

    return transformResponse
      ? await transformResponse(response, fetchParams)
      : await response[fetchParams.responseType ?? 'json']();
  } finally {
    clearTimeout(timeoutId);
    if (abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}
