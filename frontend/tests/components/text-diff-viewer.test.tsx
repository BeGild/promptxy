import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ListImperativeAPI } from 'react-window';
import TextDiffViewer from '@/components/request-viewer/components/diff/TextDiffViewer';

describe('TextDiffViewer', () => {
  it('应当全量渲染行，并用红色高亮差异行（不显示行号）', () => {
    const listRef = { current: null } as React.MutableRefObject<ListImperativeAPI | null>;

    render(
      <div style={{ height: 200, width: 400 }}>
        <TextDiffViewer
          rows={[
            { type: 'same', left: 'same', right: 'same' },
            { type: 'modified', left: 'old', right: 'new' },
          ]}
          listRef={listRef}
          rowHeightPx={24}
          maxLineColumns={10}
        />
      </div>,
    );

    // 左侧修改行应高亮（红色背景类）
    const leftText = screen.getByText('old');
    expect(leftText.parentElement?.className).toContain('bg-status-error/10');

    // 无变化行不应高亮
    const sameCells = screen.getAllByText('same').map(el => el.parentElement?.className ?? '');
    expect(sameCells.some(c => c.includes('bg-status-error/10'))).toBe(false);
  });
});
