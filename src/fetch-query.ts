import type {
  DefaultError,
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
) => TOutputData;

export type FetchQueryParams<TOutputData = any> = {
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
  throwOnError?: boolean;
  meta?: QueryMeta;
};

export type FetchQueryKeyMeta = Pick<
  FetchQueryParams,
  | 'baseUrl'
  | 'method'
  | 'headers'
  | 'body'
  | 'notFoundAsNull'
  | 'responseType'
  | 'request'
>;

export type FetchQueryKey = readonly (
  | string
  | Dict<string>
  | FetchQueryKeyMeta
  | null
)[];
export interface FetchQueryStartParams<TOutputData = any> {
  params: FetchQueryParams<TOutputData>;
}

export interface FetchQueryConfig<TData = unknown, TOutputData = any>
  extends Omit<
    Partial<QueryConfig<unknown, DefaultError, TData>>,
    'queryClient' | 'queryFn' | 'queryKey' | 'options' | 'select'
  > {
  queryClient: AnyQueryClient;
  params?: MaybeFn<MaybeFalsy<FetchQueryParams<TOutputData>>>;
  select?: (data: TOutputData) => TData;
}

export interface FetchQueryPositionalConfig<TData = unknown, TOutputData = any>
  extends Omit<
    Partial<QueryConfig<unknown, DefaultError, TData>>,
    'queryClient' | 'queryFn' | 'queryKey' | 'options' | 'select'
  > {
  params?: MaybeFn<MaybeFalsy<FetchQueryParams<TOutputData>>>;
  select?: (data: TOutputData) => TData;
}

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

export const buildFetchQueryKey = (
  fetchParams: FetchQueryParams | null,
): FetchQueryKey => {
  if (!fetchParams) {
    return [null];
  }

  return [
    ...fetchParams.path.split('/'),
    serializeFetchQuery(fetchParams.query) as any,
    {
      baseUrl: fetchParams.baseUrl,
      method: fetchParams.method,
      headers: fetchParams.headers,
      body: fetchParams.body as any,
      notFoundAsNull: fetchParams.notFoundAsNull,
      responseType: fetchParams.responseType,
      request: fetchParams.request,
    } satisfies FetchQueryKeyMeta,
  ];
};

export const parseFetchQueryKey = (
  queryKey: FetchQueryKey,
): FetchQueryParams | null => {
  if (!queryKey.length || queryKey[0] === null) {
    return null;
  }

  const meta = queryKey[queryKey.length - 1] as FetchQueryKeyMeta;
  const serializedQuery = queryKey[queryKey.length - 2] as
    | Dict<string>
    | undefined;
  const path = (queryKey.slice(0, -2) as string[]).join('/');

  return {
    path,
    query: serializedQuery,
    baseUrl: meta.baseUrl,
    method: meta.method,
    headers: meta.headers,
    body: meta.body,
    notFoundAsNull: meta.notFoundAsNull,
    responseType: meta.responseType,
    request: meta.request,
  };
};

export class FetchQuery<TData = unknown, TOutputData = any> extends Query<
  unknown,
  DefaultError,
  TData
> {
  private _holders!: {
    params: MaybeFn<MaybeFalsy<FetchQueryParams<TOutputData>>>;
    transformResponse: undefined | TransformResponseFn<TOutputData>;
  };

  constructor(config: MaybeFn<FetchQueryConfig<TData, TOutputData>>);
  constructor(
    queryClient: AnyQueryClient,
    config: FetchQueryPositionalConfig<TData, TOutputData>,
  );

  constructor(
    queryClientOrConfig:
      | AnyQueryClient
      | FetchQueryConfig<TData, TOutputData>
      | (() => FetchQueryConfig<TData, TOutputData>),
    positionalConfig?: FetchQueryPositionalConfig<TData, TOutputData>,
  ) {
    let queryFullConfig: FetchQueryConfig<TData, TOutputData>;
    let getConfig: (() => FetchQueryConfig<TData, TOutputData>) | undefined;

    if (typeof queryClientOrConfig === 'function') {
      getConfig = queryClientOrConfig as () => FetchQueryConfig<
        TData,
        TOutputData
      >;
      queryFullConfig = getConfig();
    } else if (
      'queryClient' in
      (queryClientOrConfig as FetchQueryConfig<TData, TOutputData>)
    ) {
      queryFullConfig = queryClientOrConfig as FetchQueryConfig<
        TData,
        TOutputData
      >;
    } else {
      queryFullConfig = {
        ...positionalConfig,
        queryClient: queryClientOrConfig as AnyQueryClient,
      } as FetchQueryConfig<TData, TOutputData>;
    }

    const holders: {
      params: MaybeFn<MaybeFalsy<FetchQueryParams<TOutputData>>>;
      transformResponse: undefined | TransformResponseFn<TOutputData>;
    } = {
      params: getConfig
        ? () => callFunction(getConfig!().params)
        : queryFullConfig.params,
      transformResponse: undefined,
    };

    super({
      ...(queryFullConfig as any),
      options: () => {
        const fetchParams = callFunction(holders.params) || null;
        const qc = queryFullConfig.queryClient as QueryClient;

        holders.transformResponse = fetchParams?.transformResponse;

        return {
          enabled: !!fetchParams,
          queryKey: buildFetchQueryKey(fetchParams),
          meta: fetchParams?.meta ?? qc.fetchQueries?.meta,
        };
      },
      queryFn: async ({ signal, queryKey }) => {
        const fetchParams = parseFetchQueryKey(queryKey as FetchQueryKey);

        if (!fetchParams) {
          if (process.env.NODE_ENV !== 'production') {
            throw new Error(
              'Error #1: Fetch query is not configured.\n' +
                'This happened because the "params" option for FetchQuery returned a falsy value and the query key could not be parsed.\n' +
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
          transformResponse: holders.transformResponse,
          queryClient: queryFullConfig.queryClient,
          signal,
        });
      },
    });

    this._holders = holders;
  }

  start(
    startParams: FetchQueryStartParams<TOutputData>,
  ): Promise<QueryObserverResult<TData, DefaultError>>;
  start(
    startParams?: QueryStartParams<unknown, DefaultError, TData>,
  ): Promise<QueryObserverResult<TData, DefaultError>>;
  start(startParams: any): Promise<QueryObserverResult<TData, DefaultError>> {
    if (startParams?.params) {
      const fetchParams: FetchQueryParams<TOutputData> = startParams.params;
      this._holders.params = fetchParams;
      this._holders.transformResponse = fetchParams.transformResponse;

      return super.start({
        queryKey: buildFetchQueryKey(fetchParams),
        enabled: true,
      } as any);
    }

    return super.start(startParams);
  }
}
