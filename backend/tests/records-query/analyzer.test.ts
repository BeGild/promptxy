import { describe, it, expect } from 'vitest';
import { analyzeStructure, getFieldType, getValueByPath, compareStructures } from '../../src/records-query/analyzer';

describe('analyzer', () => {
  describe('getFieldType', () => {
    it('应该正确识别基本类型', () => {
      expect(getFieldType('hello')).toBe('string');
      expect(getFieldType(123)).toBe('number');
      expect(getFieldType(true)).toBe('boolean');
      expect(getFieldType(null)).toBe('null');
      expect(getFieldType(undefined)).toBe('undefined');
      expect(getFieldType([1, 2, 3])).toBe('array');
      expect(getFieldType({ a: 1 })).toBe('object');
    });
  });

  describe('analyzeStructure', () => {
    it('应该分析简单对象结构', () => {
      const obj = {
        name: 'test',
        count: 5,
        active: true
      };

      const structure = analyzeStructure(obj);

      expect(structure.type).toBe('object');
      expect(structure.fields?.name.type).toBe('string');
      expect(structure.fields?.name.value).toBe('test');
      expect(structure.fields?.count.value).toBe(5);
      expect(structure.fields?.active.value).toBe(true);
    });

    it('应该分析数组结构', () => {
      const obj = {
        items: [1, 2, 3, 4, 5]
      };

      const structure = analyzeStructure(obj);

      expect(structure.fields?.items.type).toBe('array');
      expect(structure.fields?.items.length).toBe(5);
      expect(structure.fields?.items.hasItems).toBe(true);
    });

    it('应该截断长字符串', () => {
      const longStr = 'a'.repeat(1000);
      const obj = { content: longStr };

      const structure = analyzeStructure(obj);

      expect(structure.fields?.content.type).toBe('string');
      expect((structure.fields?.content.value as string).length).toBeLessThan(100);
    });
  });

  describe('getValueByPath', () => {
    it('应该通过路径获取值', () => {
      const obj = {
        level1: {
          level2: {
            value: 'deep'
          }
        },
        array: [
          { id: 1 },
          { id: 2 }
        ]
      };

      expect(getValueByPath(obj, 'level1.level2.value')).toBe('deep');
      expect(getValueByPath(obj, 'array[0].id')).toBe(1);
      expect(getValueByPath(obj, 'array[1].id')).toBe(2);
    });

    it('应该处理不存在的路径', () => {
      const obj = { a: 1 };
      expect(getValueByPath(obj, 'a.b.c')).toBeUndefined();
    });
  });

  describe('compareStructures', () => {
    it('应该检测结构差异', () => {
      const obj1 = { a: 1, b: [1, 2] };
      const obj2 = { a: 1, c: 'new', b: [1, 2, 3] };

      const diff = compareStructures(obj1, obj2, 'root');

      expect(diff.addedFields).toContain('c');
      expect(diff.arrayLengthChanges['b']).toEqual({ from: 2, to: 3 });
    });
  });
});
