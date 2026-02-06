import { describe, it, expect } from 'vitest';
import { formatTotalTokensCompact, formatUsdCostCompact } from '@/utils/format';

describe('format utils', () => {
  describe('formatTotalTokensCompact', () => {
    it('应该在 0 或非法值时返回 0', () => {
      expect(formatTotalTokensCompact(0)).toBe('0');
      expect(formatTotalTokensCompact(-1)).toBe('0');
      expect(formatTotalTokensCompact(Number.NaN)).toBe('0');
    });

    it('应该在 < 1K 时显示原始数字', () => {
      expect(formatTotalTokensCompact(543)).toBe('543');
    });

    it('应该在 1K~1M 时显示 K', () => {
      expect(formatTotalTokensCompact(1500)).toBe('1.5K');
    });

    it('应该在 >= 1M 时显示 M', () => {
      expect(formatTotalTokensCompact(2_000_000)).toBe('2.00M');
    });
  });

  describe('formatUsdCostCompact', () => {
    it('应该在 0 或非法值时返回 $0.00', () => {
      expect(formatUsdCostCompact(0)).toBe('$0.00');
      expect(formatUsdCostCompact(Number.NaN)).toBe('$0.00');
    });

    it('应该在 >= $0.01 时保留 2 位小数', () => {
      expect(formatUsdCostCompact(0.1)).toBe('$0.10');
      expect(formatUsdCostCompact(12.345)).toBe('$12.35');
    });

    it('应该在 < $0.01 且非 0 时展示到 6 位并去掉尾随 0', () => {
      expect(formatUsdCostCompact(0.000185)).toBe('$0.000185');
      expect(formatUsdCostCompact(0.0099)).toBe('$0.0099');
    });

    it('应该支持负数', () => {
      expect(formatUsdCostCompact(-0.0001)).toBe('-$0.0001');
    });
  });
});

