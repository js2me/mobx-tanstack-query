import type {
  DefaultError,
  InfiniteData,
  InfiniteQueryObserverResult,
} from '@tanstack/query-core';
import { callFunction } from 'yummies/common';
import type { Dict, MaybeFalsy, MaybeFn } from 'yummies/types';

import type {
  FetchQueryKeyMeta,
  FetchQueryParams,
  TransformResponseFn,
} from './fetch-query.js';
import { serializeFetchQuery } from './fetch-query.js';
import { InfiniteQuery } from './inifinite-query.js';
import type {
  InfiniteQueryConfig,
  InfiniteQueryStartParams,
} from './inifinite-query.types.js';
import type { QueryClient } from './query-client.js';
import type { AnyQueryClient } from './query-client.types.js';
import { makeFetchRequest } from './utils/make-fetch-request.js';

declare const process: Dict<any>;

export type FetchInfiniteQueryParams<
  TOutputData = any,
  TPageParam = unknown,
> = FetchQueryParams<TOutputData> & {
  pageParam?: TPageParam;
};

/**
 * Context passed to the `params` callback of {@link FetchInfiniteQuery}.
 *
 * `pageParam` is the current page parameter from TanStack Query's fetch
 * context. It is `undefined` when params are resolved outside of a fetch
 * (e.g. when building the query key), so the key never depends on
 * pagination and stays stable across pages.
 */
export interface FetchInfiniteQueryParamsContext<TPageParam = unknown> {
  pageParam: TPageParam | undefined;
}

export type FetchInfiniteQueryParamsComputed<
  TOutputData = any,
  TPageParam = unknown,
> = MaybeFn<
  MaybeFalsy<FetchInfiniteQueryParams<TOutputData, TPageParam>>,
  [FetchInfiniteQueryParamsContext<TPageParam>]
>;

export type FetchInfiniteQueryKeyMeta = FetchQueryKeyMeta;

export type FetchInfiniteQueryKey = readonly (
  | string
  | Dict<string>
  | FetchInfiniteQueryKeyMeta
  | null
)[];

export interface FetchInfiniteQueryStartParams<
  TOutputData = any,
  TPageParam = unknown,
> extends InfiniteQueryStartParams<any, any, any, any, any> {
  params: MaybeFn<
    MaybeFalsy<
      Omit<FetchInfiniteQueryParams<TOutputData, TPageParam>, 'pageParam'>
    >,
    [FetchInfiniteQueryParamsContext<TPageParam>]
  >;
}

export interface FetchInfiniteQueryConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TOutputData = any,
> extends Omit<
    Partial<InfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData, any>>,
    | 'queryClient'
    | 'queryFn'
    | 'queryKey'
    | 'options'
    | 'select'
    | 'initialPageParam'
    | 'getNextPageParam'
    | 'getPreviousPageParam'
  > {
  queryClient: AnyQueryClient;
  initialPageParam: TPageParam;
  getNextPageParam: (
    lastPage: TQueryFnData,
    allPages: TQueryFnData[],
    lastPageParam: TPageParam,
    allPageParams: TPageParam[],
  ) => TPageParam | undefined | null;
  getPreviousPageParam?: (
    firstPage: TQueryFnData,
    allPages: TQueryFnData[],
    firstPageParam: TPageParam,
    allPageParams: TPageParam[],
  ) => TPageParam | undefined | null;
  params?: FetchInfiniteQueryParamsComputed<TOutputData, TPageParam>;
  select?: (data: InfiniteData<TQueryFnData, TPageParam>) => TData;
}

export interface FetchInfiniteQueryPositionalConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TOutputData = any,
> extends Omit<
    Partial<InfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData, any>>,
    | 'queryFn'
    | 'queryKey'
    | 'options'
    | 'select'
    | 'initialPageParam'
    | 'getNextPageParam'
    | 'getPreviousPageParam'
  > {
  initialPageParam: TPageParam;
  getNextPageParam: (
    lastPage: TQueryFnData,
    allPages: TQueryFnData[],
    lastPageParam: TPageParam,
    allPageParams: TPageParam[],
  ) => TPageParam | undefined | null;
  getPreviousPageParam?: (
    firstPage: TQueryFnData,
    allPages: TQueryFnData[],
    firstPageParam: TPageParam,
    allPageParams: TPageParam[],
  ) => TPageParam | undefined | null;
  params?: FetchInfiniteQueryParamsComputed<TOutputData, TPageParam>;
  select?: (data: InfiniteData<TQueryFnData, TPageParam>) => TData;
}

export const buildFetchInfiniteQueryKey = (
  fetchParams: FetchInfiniteQueryParams | null,
): FetchInfiniteQueryKey => {
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
      throwOnError: fetchParams.throwOnError,
    } satisfies FetchInfiniteQueryKeyMeta,
  ];
};

export const parseFetchInfiniteQueryKey = (
  queryKey: FetchInfiniteQueryKey,
): FetchInfiniteQueryParams | null => {
  if (!queryKey.length || queryKey[0] === null) {
    return null;
  }

  const meta = queryKey[queryKey.length - 1] as FetchInfiniteQueryKeyMeta;
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
    throwOnError: meta.throwOnError,
  };
};

export class FetchInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TOutputData = any,
> extends InfiniteQuery<TQueryFnData, TError, TPageParam, TData, any> {
  private _holders!: {
    params: FetchInfiniteQueryParamsComputed<TOutputData, TPageParam>;
    transformResponse: undefined | TransformResponseFn<TOutputData>;
  };

  constructor(
    config: MaybeFn<
      FetchInfiniteQueryConfig<
        TQueryFnData,
        TError,
        TPageParam,
        TData,
        TOutputData
      >
    >,
  );
  constructor(
    queryClient: AnyQueryClient,
    config: FetchInfiniteQueryPositionalConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TOutputData
    >,
  );

  constructor(
    queryClientOrConfig:
      | AnyQueryClient
      | FetchInfiniteQueryConfig<
          TQueryFnData,
          TError,
          TPageParam,
          TData,
          TOutputData
        >
      | (() => FetchInfiniteQueryConfig<
          TQueryFnData,
          TError,
          TPageParam,
          TData,
          TOutputData
        >),
    positionalConfig?: FetchInfiniteQueryPositionalConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TOutputData
    >,
  ) {
    let queryFullConfig: FetchInfiniteQueryConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TOutputData
    >;
    let getConfig:
      | (() => FetchInfiniteQueryConfig<
          TQueryFnData,
          TError,
          TPageParam,
          TData,
          TOutputData
        >)
      | undefined;

    if (typeof queryClientOrConfig === 'function') {
      getConfig = queryClientOrConfig as () => FetchInfiniteQueryConfig<
        TQueryFnData,
        TError,
        TPageParam,
        TData,
        TOutputData
      >;
      queryFullConfig = getConfig();
    } else if (
      'queryClient' in
      (queryClientOrConfig as FetchInfiniteQueryConfig<
        TQueryFnData,
        TError,
        TPageParam,
        TData,
        TOutputData
      >)
    ) {
      queryFullConfig = queryClientOrConfig as FetchInfiniteQueryConfig<
        TQueryFnData,
        TError,
        TPageParam,
        TData,
        TOutputData
      >;
    } else {
      queryFullConfig = {
        ...positionalConfig,
        queryClient: queryClientOrConfig as AnyQueryClient,
      } as FetchInfiniteQueryConfig<
        TQueryFnData,
        TError,
        TPageParam,
        TData,
        TOutputData
      >;
    }

    const holders: {
      params: FetchInfiniteQueryParamsComputed<TOutputData, TPageParam>;
      transformResponse: undefined | TransformResponseFn<TOutputData>;
    } = {
      params: getConfig
        ? (context) => callFunction(getConfig!().params, context as any)
        : queryFullConfig.params,
      transformResponse: undefined,
    };

    super({
      ...(queryFullConfig as any),
      options: () => {
        const fetchParams =
          callFunction(holders.params, { pageParam: undefined }) || null;
        const qc = queryFullConfig.queryClient as QueryClient;

        holders.transformResponse = fetchParams?.transformResponse;

        return {
          enabled: !!fetchParams,
          queryKey: buildFetchInfiniteQueryKey(fetchParams),
          meta: fetchParams?.meta ?? qc.fetchQueries?.meta,
        };
      },
      queryFn: async ({ signal, queryKey, pageParam }) => {
        const baseFetchParams = parseFetchInfiniteQueryKey(
          queryKey as FetchInfiniteQueryKey,
        );

        const isParamsCallback = typeof holders.params === 'function';
        const freshParams = isParamsCallback
          ? callFunction(holders.params, {
              pageParam: pageParam as TPageParam,
            })
          : undefined;

        const resolvedParams =
          isParamsCallback && baseFetchParams
            ? freshParams || null
            : baseFetchParams;

        if (!resolvedParams) {
          if (process.env.NODE_ENV !== 'production') {
            throw new Error(
              'Error #2: Fetch infinite query is not configured.\n' +
                'This happened because the "params" option for FetchInfiniteQuery returned a falsy value or the query key could not be parsed.\n' +
                'Please ensure that "params" returns a valid FetchInfiniteQueryParams object with at least a "path" property.\n' +
                'More info: https://js2me.github.io/mobx-tanstack-query/errors/2',
            );
          }
          throw new Error(
            'Error #2: https://js2me.github.io/mobx-tanstack-query/errors/2',
          );
        }

        const fetchParams: FetchInfiniteQueryParams<TOutputData, TPageParam> = {
          ...resolvedParams,
          pageParam: pageParam as TPageParam,
        };

        return makeFetchRequest<TOutputData>({
          fetchParams,
          transformResponse:
            fetchParams.transformResponse ?? holders.transformResponse,
          queryClient: queryFullConfig.queryClient,
          signal,
        });
      },
    });

    this._holders = holders;
  }

  start(
    startParams: FetchInfiniteQueryStartParams<TOutputData, TPageParam>,
  ): Promise<InfiniteQueryObserverResult<TData, TError>>;
  start(
    startParams?: InfiniteQueryStartParams<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      any
    >,
  ): Promise<InfiniteQueryObserverResult<TData, TError>>;
  start(startParams: any): Promise<InfiniteQueryObserverResult<TData, TError>> {
    if (startParams?.params) {
      const { params, ...restStartParams } = startParams;
      const fetchParams =
        callFunction(
          params as FetchInfiniteQueryParamsComputed<TOutputData, TPageParam>,
          { pageParam: undefined },
        ) || null;

      this._holders.params = params;
      this._holders.transformResponse =
        fetchParams?.transformResponse ?? undefined;

      return super.start({
        ...restStartParams,
        queryKey: buildFetchInfiniteQueryKey(fetchParams),
        enabled: !!fetchParams,
        meta:
          fetchParams?.meta ??
          (this.queryClient as QueryClient).fetchQueries?.meta,
      } as any);
    }

    return super.start(startParams);
  }
}
