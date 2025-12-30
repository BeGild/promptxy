import { describe, it, expect } from 'vitest';
import {
  diffLines,
  buildHunks,
  type TextDiffRow,
} from '@/components/request-viewer/utils/textDiff';

describe('textDiff', () => {
  describe('diffLines', () => {
    it('应当空白敏感：尾随空格不同算修改', () => {
      const rows = diffLines('a ', 'a');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: 'modified', left: 'a ', right: 'a' });
    });

    it('应当保留真实空行，并能区分“空行删除”与“占位空行”', () => {
      const rows = diffLines('a\n\nb', 'a\nb');
      expect(rows.map(r => r.type)).toEqual(['same', 'removed', 'same']);
      expect(rows[1]).toMatchObject({ left: '', right: null });
    });

    it('应当能表达“插入空行”（added）', () => {
      const rows = diffLines('a\nb', 'a\n\nb');
      expect(rows.map(r => r.type)).toEqual(['same', 'added', 'same']);
      expect(rows[1]).toMatchObject({ left: null, right: '' });
    });

    it('替换应当优先表现为对齐的 modified 行', () => {
      const rows = diffLines('a\nb\nc', 'a\nx\nc');
      expect(rows.map(r => r.type)).toEqual(['same', 'modified', 'same']);
      expect(rows[1]).toMatchObject({ left: 'b', right: 'x' });
    });
  });

  describe('buildHunks', () => {
    it('应当把连续差异行聚合为 hunks', () => {
      const rows: TextDiffRow[] = [
        { type: 'same', left: 'a', right: 'a' },
        { type: 'modified', left: 'b', right: 'x' },
        { type: 'removed', left: 'c', right: null },
        { type: 'same', left: 'd', right: 'd' },
        { type: 'added', left: null, right: 'e' },
      ];

      expect(buildHunks(rows)).toEqual([
        { startRow: 1, endRow: 2 },
        { startRow: 4, endRow: 4 },
      ]);
    });
  });
});
