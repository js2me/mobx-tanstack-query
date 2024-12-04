import { describe, expect, it } from 'vitest';
import { MobxQuery } from './mobx-query';
import { QueryClient } from '@tanstack/query-core';


describe('MobxQuery', () => {
  it('to be defined', () => {
    const mobxQuery = new MobxQuery({
      queryClient: new QueryClient(),
      queryKey: ['test'],
      queryFn: () => {}
    })
    expect(mobxQuery).toBeDefined();
  })
}); 
