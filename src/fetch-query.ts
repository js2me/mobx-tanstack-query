import type {
  DefaultError,
  QueryFunctionContext,
  QueryMeta,
  QueryObserverResult,
} from '@tanstack/query-core';
import { callFunction } from 'yummies/common';
import type { Dict, MaybeFalsy, MaybeFn, PickByValue } from 'yummies/types';
import { Query } from './query.js';
import type { QueryConfig, QueryStartParams } from './query.types.js';
import type { QueryClient } from './query-client.js';
import type { AnyQueryClient } from './query-client.types.js';
import { makeFetchRequest } from './utils/make-fetch-request.js';

declare const process: Dict<any>;

export type ResponseType = keyof PickByValue<Body, Function>;

export type TransformResponseMeta = Omit<FetchQueryParams, 'transformResponse'>;

export type TransformResponseFn<TOutputData = any> = (
  response: Response,
  meta: TransformResponseMeta,
) => TOutputData | Promise<TOutputData>;

export type FetchCacheScope =
  | string
  | number
  | boolean
  | null
  | readonly FetchCacheScope[]
  | { readonly [key: string]: FetchCacheScope };

export type FetchQueryParams<TOutputData = any> = {
  cacheScope?: FetchCacheScope;
  bodyKey?: string;
  baseUrl?: string;
  path: string;
  query?: Dict<string | number | boolean | null | undefined>;
  method?: string;
  headers?: Dict<string> | undefined;
  body?: BodyInit | Dict<unknown>;
  request?: Partial<
    Omit<RequestInit, 'signal' | 'method' | 'headers' | 'body'>
  >;
  notFoundAsNull?: boolean;
  responseType?: ResponseType;
  transformResponse?: TransformResponseFn<TOutputData>;
  transformKey?: string;
  throwOnError?: boolean;
  meta?: QueryMeta;
};

export type FetchQueryKeyMeta = Pick<
  FetchQueryParams,
  | 'baseUrl'
  | 'method'
  | 'cacheScope'
  | 'notFoundAsNull'
  | 'responseType'
  | 'request'
  | 'throwOnError'
> & {
  body?: unknown;
  bodyKind?: string;
  transformResponseId?: string;
};

// Process-local identities must not alias persisted keys from another session.
const identityPrefix = Math.random().toString(36).slice(2);
const objectIds = new WeakMap<object, string>();
let nextId = 0;
function objectId(value: object) {
  let id = objectIds.get(value);
  if (!id) {
    id = `${identityPrefix}:${++nextId}`;
    objectIds.set(value, id);
  }
  return id;
}

function bodyIdentity({ body, bodyKey }: FetchQueryParams) {
  if (body == null) return {};
  if (bodyKey !== undefined) return { bodyKind: 'key', body: bodyKey };
  if (typeof body === 'string') return { bodyKind: 'text', body };
  if (body instanceof URLSearchParams)
    return { bodyKind: 'urlencoded', body: body.toString() };
  if (body instanceof FormData)
    return {
      bodyKind: 'form',
      body: Array.from(body, ([name, value]) => [
        name,
        typeof value === 'string' ? value : { file: objectId(value) },
      ]),
    };
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    const bytes =
      body instanceof ArrayBuffer
        ? new Uint8Array(body)
        : new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    return { bodyKind: 'bytes', body: Array.from(bytes) };
  }
  if (body instanceof Blob || body instanceof ReadableStream)
    return { bodyKind: 'opaque', body: objectId(body) };
  return { bodyKind: 'json', body: JSON.parse(JSON.stringify(body)) };
}

export type FetchQueryKey = readonly (
  | string
  | Dict<string>
  | FetchQueryKeyMeta
  | null
)[];
export interface FetchQueryStartParams<
  TOutputData = unknown,
  TData = TOutputData | null,
> extends QueryStartParams<TOutputData | null, DefaultError, TData> {
  params: FetchQueryParams<TOutputData>;
}

type FetchSelection<TRaw, TData> = [TRaw | null] extends [TData]
  ? { select?: (data: TRaw | null) => TData }
  : { select: (data: TRaw | null) => TData };

export type FetchQueryPositionalConfig<
  TRaw = unknown,
  TData = TRaw | null,
> = Omit<
  Partial<QueryConfig<TRaw | null, DefaultError, TData>>,
  'queryClient' | 'queryFn' | 'queryKey' | 'options' | 'select'
> & {
  params?: MaybeFn<MaybeFalsy<FetchQueryParams<TRaw>>>;
  transformResponse?: TransformResponseFn<TRaw>;
  transformKey?: string;
  cacheScope?: FetchCacheScope;
} & FetchSelection<TRaw, TData>;

export type FetchQueryConfig<
  TRaw = unknown,
  TData = TRaw | null,
> = FetchQueryPositionalConfig<TRaw, TData> & { queryClient: AnyQueryClient };

export const serializeFetchQuery = (
  query?: FetchQueryParams['query'],
): Dict<string> | undefined => {
  if (!query) {
    return undefined;
  }

  const entries = Object.entries(query)
    .filter(([, value]) => value != null)
    .map(([key, value]) => [key, String(value)] as const);

  return entries.length ? Object.fromEntries(entries) : undefined;
};

export const buildFetchQueryUrl = (
  path: string,
  query: Dict<string> | undefined,
): string => {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams(query);
  const queryString = params.toString();

  if (!queryString) {
    return path;
  }

  return path.includes('?')
    ? `${path}&${queryString}`
    : `${path}?${queryString}`;
};

export const isNativeBodyInit = (body: unknown): body is BodyInit => {
  return (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ReadableStream ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
};

function snapshotBody(
  body: FetchQueryParams['body'],
): FetchQueryParams['body'] {
  if (body == null || typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return new URLSearchParams(body);
  if (body instanceof FormData) {
    const copy = new FormData();
    for (const [name, value] of body) copy.append(name, value);
    return copy;
  }
  if (body instanceof ArrayBuffer) return body.slice(0);
  if (ArrayBuffer.isView(body))
    return new Uint8Array(
      body.buffer,
      body.byteOffset,
      body.byteLength,
    ).slice();
  if (body instanceof Blob || body instanceof ReadableStream) return body;
  return JSON.parse(JSON.stringify(body));
}

export const buildFetchQueryKey = (
  fetchParams: FetchQueryParams | null,
  pagination?: { infinite: true; initialPageParam: unknown },
  transformIdentity?: object,
): FetchQueryKey => {
  if (!fetchParams) {
    return [null];
  }

  const parserIdentity = transformIdentity ?? fetchParams.transformResponse;
  return [
    ...fetchParams.path.split('/'),
    serializeFetchQuery(fetchParams.query) as any,
    {
      ...pagination,
      baseUrl: fetchParams.baseUrl,
      method: fetchParams.method,
      cacheScope:
        typeof fetchParams.cacheScope === 'object' &&
        fetchParams.cacheScope !== null
          ? JSON.parse(JSON.stringify(fetchParams.cacheScope))
          : fetchParams.cacheScope,
      ...bodyIdentity(fetchParams),
      notFoundAsNull: fetchParams.notFoundAsNull,
      responseType: fetchParams.responseType,
      request:
        fetchParams.request &&
        Object.fromEntries(
          Object.entries(fetchParams.request).filter(
            ([key]) => !['headers', 'body', 'signal', 'method'].includes(key),
          ),
        ),
      throwOnError: fetchParams.throwOnError,
      transformResponseId:
        fetchParams.transformKey !== undefined
          ? `key:${fetchParams.transformKey}`
          : parserIdentity
            ? objectId(parserIdentity)
            : undefined,
    } satisfies FetchQueryKeyMeta,
  ];
};

/** Reads the serializable cache identity. HTTP headers and parser functions live on the request. */
export const parseFetchQueryKey = (queryKey: FetchQueryKey) => {
  if (queryKey.length < 3 || queryKey[0] === null) return null;
  const meta = queryKey[queryKey.length - 1] as FetchQueryKeyMeta;
  return {
    ...meta,
    path: queryKey.slice(0, -2).join('/'),
    query: (queryKey[queryKey.length - 2] ?? undefined) as
      | Dict<string>
      | undefined,
  };
};

export class FetchQuery<
  TOutputData = unknown,
  TData = TOutputData | null,
> extends Query<TOutputData | null, DefaultError, TData> {
  private _startOptions: (params: FetchQueryParams<TOutputData>) => {
    queryKey: FetchQueryKey;
    queryFn: (ctx: QueryFunctionContext) => Promise<TOutputData | null>;
  };
  private _holders: { params?: FetchQueryParams<TOutputData> };

  constructor(config: MaybeFn<FetchQueryConfig<TOutputData, TData>>);
  constructor(
    queryClient: AnyQueryClient,
    config: FetchQueryPositionalConfig<TOutputData, TData>,
  );

  constructor(
    queryClientOrConfig:
      | AnyQueryClient
      | FetchQueryConfig<TOutputData, TData>
      | (() => FetchQueryConfig<TOutputData, TData>),
    positionalConfig?: FetchQueryPositionalConfig<TOutputData, TData>,
  ) {
    let queryFullConfig: FetchQueryConfig<TOutputData, TData>;
    let getConfig: (() => FetchQueryConfig<TOutputData, TData>) | undefined;

    if (typeof queryClientOrConfig === 'function') {
      getConfig = queryClientOrConfig as () => FetchQueryConfig<
        TOutputData,
        TData
      >;
      queryFullConfig = getConfig();
    } else if (
      'queryClient' in
      (queryClientOrConfig as FetchQueryConfig<TOutputData, TData>)
    ) {
      queryFullConfig = queryClientOrConfig as FetchQueryConfig<
        TOutputData,
        TData
      >;
    } else {
      queryFullConfig = {
        ...positionalConfig,
        queryClient: queryClientOrConfig as AnyQueryClient,
      } as FetchQueryConfig<TOutputData, TData>;
    }

    const holders: { params?: FetchQueryParams<TOutputData> } = {};

    const requestOptions = (
      params: FetchQueryParams<TOutputData> | null,
      config: typeof queryFullConfig,
    ) => {
      const fetchParams = params && {
        ...params,
        query: params.query && { ...params.query },
        headers: params.headers && { ...params.headers },
        request: params.request && { ...params.request },
        body: snapshotBody(params.body),
        cacheScope:
          params.cacheScope === undefined
            ? config.cacheScope
            : params.cacheScope,
        transformResponse: params.transformResponse ?? config.transformResponse,
        transformKey: params.transformKey ?? config.transformKey,
      };
      const dynamic =
        getConfig ||
        (params?.transformResponse && typeof config.params === 'function');
      return {
        queryKey: buildFetchQueryKey(
          fetchParams,
          undefined,
          dynamic && fetchParams?.transformResponse ? holders : undefined,
        ),
        queryFn: async ({ signal }: QueryFunctionContext) => {
          if (!fetchParams) {
            if (
              typeof process !== 'undefined' &&
              process.env.NODE_ENV !== 'production'
            ) {
              throw new Error(
                'Error #1: Fetch query is not configured.\n' +
                  'The "params" option for FetchQuery returned a falsy value.\n' +
                  'Please ensure that "params" returns a valid FetchQueryParams object with at least a "path" property.\n' +
                  'More info: https://js2me.github.io/mobx-tanstack-query/errors/1',
              );
            }
            throw new Error(
              'Error #1: https://js2me.github.io/mobx-tanstack-query/errors/1',
            );
          }

          return makeFetchRequest<TOutputData>({
            fetchParams,
            transformResponse: fetchParams.transformResponse,
            queryClient: queryFullConfig.queryClient,
            signal,
          });
        },
      };
    };
    super({
      ...(queryFullConfig as any),
      options: () => {
        const config = getConfig?.() ?? queryFullConfig;
        const params = (holders.params ?? callFunction(config.params)) || null;
        return {
          ...(getConfig ? config : {}),
          ...requestOptions(params, config),
          enabled: params ? (config.enabled ?? true) : false,
          meta:
            params?.meta ??
            config.meta ??
            (queryFullConfig.queryClient as QueryClient).fetchQueries?.meta,
        };
      },
    });
    this._startOptions = (params) =>
      requestOptions(params, getConfig?.() ?? queryFullConfig);

    this._holders = holders;
  }

  start(
    startParams: FetchQueryStartParams<TOutputData, TData>,
  ): Promise<QueryObserverResult<TData, DefaultError>>;
  start(
    startParams?: QueryStartParams<TOutputData | null, DefaultError, TData>,
  ): Promise<QueryObserverResult<TData, DefaultError>>;
  start(startParams: any): Promise<QueryObserverResult<TData, DefaultError>> {
    if (startParams?.params) {
      const { params, ...restStartParams } = startParams;
      const fetchParams: FetchQueryParams<TOutputData> = params;
      this._holders.params = fetchParams;

      return super.start({
        ...restStartParams,
        ...this._startOptions(fetchParams),
        enabled: true,
        meta:
          fetchParams.meta ??
          (this.queryClient as QueryClient).fetchQueries?.meta,
      } as any);
    }

    return super.start(startParams);
  }
}
