import { replaceEqualDeep } from '@tanstack/query-core';
import { isObservable } from 'mobx';

const isPlainTree = (value: unknown, ancestors: Set<object>): boolean => {
  if (value === null || typeof value !== 'object') return true;
  if (isObservable(value) || ancestors.has(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  const descends =
    Array.isArray(value) ||
    prototype === Object.prototype ||
    prototype === null;
  if (!descends) return true;

  ancestors.add(value);
  const isTree = Object.values(value).every((child) =>
    isPlainTree(child, ancestors),
  );
  ancestors.delete(value);
  return isTree;
};

// `replaceEqualDeep` copies MobX observables into plain objects and breaks self-references, so
// data holding either skips sharing.
export const replaceEqualTree = (prevData: unknown, data: unknown) =>
  isPlainTree(data, new Set()) ? replaceEqualDeep(prevData, data) : data;
