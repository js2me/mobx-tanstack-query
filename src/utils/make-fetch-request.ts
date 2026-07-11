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
  const clientHeaders = clientFetchQueries.headers;
  let fetchHeaders: Record<string, string> | undefined =
    clientHeaders || fetchParams.headers
      ? { ...clientHeaders, ...fetchParams.headers }
      : undefined;

  if (fetchParams.body != null) {
    if (isNativeBodyInit(fetchParams.body)) {
      fetchBody = fetchParams.body;
    } else {
      fetchBody = JSON.stringify(fetchParams.body);
      fetchHeaders = {
        'Content-Type': 'application/json',
        ...fetchHeaders,
      };
    }
  }

  const customFetch = clientFetchQueries.customFetch;
  const fetch = customFetch ?? globalThis.fetch;

  let abortSignal = options.signal;

  if (clientFetchQueries.timeout) {
    const abortControllerWithTimeout = new AbortController();
    const abortHandler = () => abortControllerWithTimeout.abort();

    signal.addEventListener('abort', abortHandler, { once: true });

    const timeoutSignal = AbortSignal.timeout(clientFetchQueries.timeout);
    timeoutSignal.addEventListener('abort', abortHandler, { once: true });
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
}
