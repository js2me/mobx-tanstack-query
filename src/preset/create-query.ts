import { DefaultError, QueryKey } from '@tanstack/query-core';

import { MobxQuery } from '../mobx-query';
import { MobxQueryConfig } from '../mobx-query.types';

import { queryClient } from './query-client';

export const createQuery = <
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
>(
  fn: MobxQueryConfig<TData, TError, TQueryKey>['queryFn'],
  params?: Omit<
    MobxQueryConfig<TData, TError, TQueryKey>,
    'queryClient' | 'queryFn'
  >,
) => {
  return new MobxQuery({
    queryClient,
    ...params,
    queryFn: fn,
    onInit: (query) => {
      queryClient.mount();
      params?.onInit?.(query);
    },
  });
};
