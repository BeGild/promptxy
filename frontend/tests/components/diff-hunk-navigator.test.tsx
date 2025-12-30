import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DiffHunkNavigator from '@/components/request-viewer/components/diff/DiffHunkNavigator';

describe('DiffHunkNavigator', () => {
  it('点击差异块应回调对应 index', () => {
    const onSelect = vi.fn();
    render(
      <div style={{ height: 200 }}>
        <DiffHunkNavigator
          hunks={[
            { startRow: 1, endRow: 2 },
            { startRow: 10, endRow: 10 },
          ]}
          totalRows={20}
          activeIndex={0}
          onSelect={onSelect}
        />
      </div>,
    );

    fireEvent.click(screen.getByLabelText('第 2 / 2 个差异块'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
