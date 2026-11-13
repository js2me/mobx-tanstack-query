import { isObservable, observable } from 'mobx';
import { describe, expect, it } from 'vitest';
import { replaceEqualTree } from './replace-equal-tree.js';

describe('replaceEqualTree', () => {
  it('keeps unchanged branches of plain data', () => {
    const prev = { stable: { ids: [1, 2] }, changed: { version: 0 } };
    const next = { stable: { ids: [1, 2] }, changed: { version: 1 } };

    const result = replaceEqualTree(prev, next) as typeof next;

    expect(result).not.toBe(prev);
    expect(result.stable).toBe(prev.stable);
    expect(result.changed).toEqual({ version: 1 });
  });

  it('uses the new data as-is when it nests an observable', () => {
    const prev = { list: observable([{ id: 1 }]), version: 0 };
    const next = { list: observable([{ id: 1 }]), version: 1 };

    const result = replaceEqualTree(prev, next) as typeof next;

    expect(result).toBe(next);
    expect(isObservable(result.list)).toBe(true);
  });

  it('uses the new data as-is when a cycle sits below the root', () => {
    type Node = { id: number; parent?: { child: Node } };
    const build = () => {
      const node: Node = { id: 1 };
      node.parent = { child: node };
      return { nodes: [node] };
    };
    const next = build();

    const result = replaceEqualTree(build(), next);

    expect(result).toBe(next);
  });

  it('still shares data that repeats a reference without a cycle', () => {
    const shared = { id: 1 };
    const prev = { a: { id: 1 }, b: { id: 1 } };
    const next = { a: shared, b: shared };

    const result = replaceEqualTree(prev, next);

    expect(result).toBe(prev);
  });
});
