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

export type FetchInfiniteQueryKeyMeta = FetchQueryKeyMeta & {
  pageParam?: unknown;
};

export type FetchInfiniteQueryKey = readonly (
  | string
  | Dict<string>
  | FetchInfiniteQueryKeyMeta
  | null
)[];

export interface FetchInfiniteQueryStartParams<
  TOutputData = any,
  TPageParam = unknown,
> {
  params: Omit<FetchInfiniteQueryParams<TOutputData, TPageParam>, 'pageParam'>;
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
  params?: MaybeFn<
    MaybeFalsy<FetchInfiniteQueryParams<TOutputData, TPageParam>>
  >;
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
  params?: MaybeFn<
    MaybeFalsy<FetchInfiniteQueryParams<TOutputData, TPageParam>>
  >;
  select?: (data: InfiniteData<TQueryFnData, TPageParam>) => TData;
}

export const buildFetchInfiniteQueryKey = (
  fetchParams: FetchInfiniteQueryParams | null,
): FetchInfiniteQueryKey => {
  if (!fetchParams) {
    return [null];
  }

  const { pageParam, ...restParams } = fetchParams;

  return [
    ...restParams.path.split('/'),
    serializeFetchQuery(restParams.query) as any,
    {
      baseUrl: restParams.baseUrl,
      method: restParams.method,
      headers: restParams.headers,
      body: restParams.body as any,
      notFoundAsNull: restParams.notFoundAsNull,
      responseType: restParams.responseType,
      request: restParams.request,
      pageParam: pageParam ?? null,
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
    pageParam: meta.pageParam ?? undefined,
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
    params: MaybeFn<
      MaybeFalsy<FetchInfiniteQueryParams<TOutputData, TPageParam>>
    >;
    transformResponse: undefined | TransformResponseFn<TOutputData>;
  };

  constructor(
    config: FetchInfiniteQueryConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TOutputData
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
        >,
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

    if (
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
      params: MaybeFn<
        MaybeFalsy<FetchInfiniteQueryParams<TOutputData, TPageParam>>
      >;
      transformResponse: undefined | TransformResponseFn<TOutputData>;
    } = {
      params: queryFullConfig.params,
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
          queryKey: buildFetchInfiniteQueryKey(fetchParams),
          meta: fetchParams?.meta ?? qc.fetchQueries?.meta,
        };
      },
      queryFn: async ({ signal, queryKey, pageParam }) => {
        const baseFetchParams = parseFetchInfiniteQueryKey(
          queryKey as FetchInfiniteQueryKey,
        );

        if (!baseFetchParams) {
          if (process.env.NODE_ENV !== 'production') {
            throw new Error(
              'Error #2: Fetch infinite query is not configured.\n' +
                'This happened because the "params" option for FetchInfiniteQuery returned a falsy value and the query key could not be parsed.\n' +
                'Please ensure that "params" returns a valid FetchInfiniteQueryParams object with at least a "path" property.\n' +
                'More info: https://js2me.github.io/mobx-tanstack-query/errors/2',
            );
          }
          throw new Error(
            'Error #2: https://js2me.github.io/mobx-tanstack-query/errors/2',
          );
        }

        const fetchParams: FetchInfiniteQueryParams<TOutputData, TPageParam> = {
          ...baseFetchParams,
          pageParam: pageParam as TPageParam,
        };

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
      const fetchParams: FetchInfiniteQueryParams<TOutputData, TPageParam> =
        startParams.params;
      this._holders.params = fetchParams;
      this._holders.transformResponse = fetchParams.transformResponse;

      return super.start({
        queryKey: buildFetchInfiniteQueryKey(fetchParams),
        enabled: true,
      } as any);
    }

    return super.start(startParams);
  }
}
