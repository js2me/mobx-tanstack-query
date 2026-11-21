import {
  type DefaultError,
  hashKey,
  type InfiniteData,
  type InfiniteQueryObserverResult,
} from '@tanstack/query-core';
import { callFunction } from 'yummies/common';
import type { Dict, MaybeFalsy, MaybeFn } from 'yummies/types';

import type { FetchQueryKeyMeta, FetchQueryParams } from './fetch-query.js';
import { buildFetchQueryKey, parseFetchQueryKey } from './fetch-query.js';
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

export type FetchInfiniteQueryKeyMeta = FetchQueryKeyMeta & {
  initialPageParam?: unknown;
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
> extends InfiniteQueryStartParams<any, any, any, any, any> {
  params: MaybeFn<
    MaybeFalsy<
      Omit<FetchInfiniteQueryParams<TOutputData, TPageParam>, 'pageParam'>
    >,
    [FetchInfiniteQueryParamsContext<TPageParam>]
  >;
}

export interface FetchInfiniteQueryConfig<
  TPage = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TPage | null, TPageParam>,
> extends Omit<
    Partial<InfiniteQueryConfig<TPage | null, TError, TPageParam, TData, any>>,
    'queryFn' | 'queryKey' | 'options' | 'initialPageParam' | 'getNextPageParam'
  > {
  queryClient: AnyQueryClient;
  initialPageParam: TPageParam;
  getNextPageParam: NonNullable<
    InfiniteQueryConfig<
      TPage | null,
      TError,
      TPageParam,
      TData,
      any
    >['getNextPageParam']
  >;
  params?: FetchInfiniteQueryParamsComputed<TPage, TPageParam>;
  select?: (data: InfiniteData<TPage | null, TPageParam>) => TData;
}

export type FetchInfiniteQueryPositionalConfig<
  TPage = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TPage | null, TPageParam>,
> = Omit<
  FetchInfiniteQueryConfig<TPage, TError, TPageParam, TData>,
  'queryClient'
>;

export const buildFetchInfiniteQueryKey = (
  fetchParams: FetchInfiniteQueryParams | null,
  initialPageParam?: unknown,
): FetchInfiniteQueryKey => {
  return buildFetchQueryKey(fetchParams, { infinite: true, initialPageParam });
};

export const parseFetchInfiniteQueryKey = parseFetchQueryKey;

export class FetchInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData | null, TPageParam>,
> extends InfiniteQuery<TQueryFnData | null, TError, TPageParam, TData, any> {
  private _holders: {
    params?: FetchInfiniteQueryParamsComputed<TQueryFnData, TPageParam>;
  };

  constructor(
    config: MaybeFn<
      FetchInfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData>
    >,
  );
  constructor(
    queryClient: AnyQueryClient,
    config: FetchInfiniteQueryPositionalConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData
    >,
  );

  constructor(
    queryClientOrConfig:
      | AnyQueryClient
      | FetchInfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData>
      | (() => FetchInfiniteQueryConfig<
          TQueryFnData,
          TError,
          TPageParam,
          TData
        >),
    positionalConfig?: FetchInfiniteQueryPositionalConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData
    >,
  ) {
    let queryFullConfig: FetchInfiniteQueryConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData
    >;
    let getConfig:
      | (() => FetchInfiniteQueryConfig<
          TQueryFnData,
          TError,
          TPageParam,
          TData
        >)
      | undefined;

    if (typeof queryClientOrConfig === 'function') {
      getConfig = queryClientOrConfig as () => FetchInfiniteQueryConfig<
        TQueryFnData,
        TError,
        TPageParam,
        TData
      >;
      queryFullConfig = getConfig();
    } else if (
      'queryClient' in
      (queryClientOrConfig as FetchInfiniteQueryConfig<
        TQueryFnData,
        TError,
        TPageParam,
        TData
      >)
    ) {
      queryFullConfig = queryClientOrConfig as FetchInfiniteQueryConfig<
        TQueryFnData,
        TError,
        TPageParam,
        TData
      >;
    } else {
      queryFullConfig = {
        ...positionalConfig,
        queryClient: queryClientOrConfig as AnyQueryClient,
      } as FetchInfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData>;
    }

    const holders: {
      params?: FetchInfiniteQueryParamsComputed<TQueryFnData, TPageParam>;
    } = {};
    const resolveParams = (config: typeof queryFullConfig) =>
      'params' in holders ? holders.params : config.params;

    super({
      ...(queryFullConfig as any),
      options: () => {
        const currentConfig = getConfig?.() ?? queryFullConfig;
        const fetchParams =
          callFunction(resolveParams(currentConfig), {
            pageParam: undefined,
          }) || null;
        const qc = queryFullConfig.queryClient as QueryClient;

        return {
          ...(getConfig ? currentConfig : {}),
          enabled: fetchParams ? (currentConfig.enabled ?? true) : false,
          queryKey: buildFetchInfiniteQueryKey(
            fetchParams,
            currentConfig.initialPageParam,
          ),
          meta:
            fetchParams?.meta ?? currentConfig.meta ?? qc.fetchQueries?.meta,
        };
      },
      queryFn: async ({ signal, queryKey, pageParam }) => {
        const baseFetchParams = parseFetchInfiniteQueryKey(
          queryKey as FetchInfiniteQueryKey,
        );

        const currentConfig = getConfig?.() ?? queryFullConfig;
        const params = resolveParams(currentConfig);
        let resolvedParams = baseFetchParams;

        if (baseFetchParams && (getConfig || typeof params === 'function')) {
          // Reactive params may have moved to another key while the options
          // update is delayed, so fresh page params must belong to this key.
          const keyParams =
            callFunction(params, { pageParam: undefined }) || null;
          if (
            keyParams &&
            hashKey(
              buildFetchInfiniteQueryKey(
                keyParams,
                (queryKey[queryKey.length - 1] as FetchInfiniteQueryKeyMeta)
                  .initialPageParam,
              ),
            ) !== hashKey(queryKey)
          ) {
            throw new Error(
              'FetchInfiniteQuery params changed before the page request. The active query key is stale.',
            );
          }
          resolvedParams = keyParams
            ? callFunction(params, {
                pageParam: pageParam as TPageParam,
              }) || null
            : null;
        }

        if (!resolvedParams) {
          if (
            typeof process !== 'undefined' &&
            process.env.NODE_ENV !== 'production'
          ) {
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

        const fetchParams: FetchInfiniteQueryParams<TQueryFnData, TPageParam> =
          {
            ...resolvedParams,
            pageParam: pageParam as TPageParam,
          };

        return makeFetchRequest<TQueryFnData>({
          fetchParams,
          transformResponse: fetchParams.transformResponse,
          queryClient: queryFullConfig.queryClient,
          signal,
        });
      },
    });

    this._holders = holders;
  }

  start(
    startParams: FetchInfiniteQueryStartParams<TQueryFnData, TPageParam>,
  ): Promise<InfiniteQueryObserverResult<TData, TError>>;
  start(
    startParams?: InfiniteQueryStartParams<
      TQueryFnData | null,
      TError,
      TPageParam,
      TData,
      any
    >,
  ): Promise<InfiniteQueryObserverResult<TData, TError>>;
  start(startParams: any): Promise<InfiniteQueryObserverResult<TData, TError>> {
    if (startParams && 'params' in startParams) {
      const { params, ...restStartParams } = startParams;
      const fetchParams =
        callFunction(
          params as FetchInfiniteQueryParamsComputed<TQueryFnData, TPageParam>,
          { pageParam: undefined },
        ) || null;

      this._holders.params = params;

      return super.start({
        ...restStartParams,
        queryKey: buildFetchInfiniteQueryKey(
          fetchParams,
          restStartParams.initialPageParam ?? this.options.initialPageParam,
        ),
        enabled: !!fetchParams,
        meta:
          fetchParams?.meta ??
          (this.queryClient as QueryClient).fetchQueries?.meta,
      } as any);
    }

    return super.start(startParams);
  }
}
