export type TextDiffRowType = 'same' | 'added' | 'removed' | 'modified';

export interface TextDiffRow {
  type: TextDiffRowType;
  /**
   * 左侧文本行；为 null 表示该行在左侧不存在（占位）
   * 注意：空字符串 '' 代表“真实空行”，与占位必须区分，否则无法做到空白敏感。
   */
  left: string | null;
  /**
   * 右侧文本行；为 null 表示该行在右侧不存在（占位）
   * 注意：空字符串 '' 代表“真实空行”，与占位必须区分，否则无法做到空白敏感。
   */
  right: string | null;
}

export interface TextDiffHunk {
  startRow: number;
  endRow: number;
}

type MyersOp =
  | { type: 'equal'; value: string }
  | { type: 'insert'; value: string }
  | { type: 'delete'; value: string };

function splitLines(text: string): string[] {
  // 空白敏感：不 trim、不规范化换行符，严格按 "\n" 分割并保留空行。
  return String(text).split('\n');
}

function myersDiffLines(a: string[], b: string[]): MyersOp[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max;

  // v[k] = x (k = x - y)
  let v = new Array<number>(2 * max + 1).fill(0);
  const trace: Array<number[]> = [];

  for (let d = 0; d <= max; d += 1) {
    trace.push(v.slice());

    for (let k = -d; k <= d; k += 2) {
      const kIndex = k + offset;

      let x: number;
      if (k === -d || (k !== d && v[kIndex - 1] < v[kIndex + 1])) {
        // 向下：插入（来自 b）
        x = v[kIndex + 1];
      } else {
        // 向右：删除（来自 a）
        x = v[kIndex - 1] + 1;
      }

      let y = x - k;

      // 沿对角线前进（匹配相同元素）
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }

      v[kIndex] = x;

      if (x >= n && y >= m) {
        // 到达终点，回溯生成 edit script
        const ops: MyersOp[] = [];
        let curX = n;
        let curY = m;

        for (let backD = trace.length - 1; backD >= 0; backD -= 1) {
          const backV = trace[backD];
          const curK = curX - curY;
          const curKIndex = curK + offset;

          let prevK: number;
          if (curK === -backD || (curK !== backD && backV[curKIndex - 1] < backV[curKIndex + 1])) {
            prevK = curK + 1;
          } else {
            prevK = curK - 1;
          }

          const prevX = backV[prevK + offset];
          const prevY = prevX - prevK;

          // 先补齐对角线（equal）
          while (curX > prevX && curY > prevY) {
            ops.push({ type: 'equal', value: a[curX - 1] });
            curX -= 1;
            curY -= 1;
          }

          if (backD === 0) break;

          if (curX === prevX) {
            // 插入
            ops.push({ type: 'insert', value: b[prevY] });
            curY -= 1;
          } else {
            // 删除
            ops.push({ type: 'delete', value: a[prevX] });
            curX -= 1;
          }
        }

        ops.reverse();
        return ops;
      }
    }
  }

  // 理论上不会走到这里
  return [];
}

function flushReplaceGroup(deletes: string[], inserts: string[], rows: TextDiffRow[]) {
  const maxLen = Math.max(deletes.length, inserts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const left = deletes[i] ?? null;
    const right = inserts[i] ?? null;

    let type: TextDiffRowType = 'same';
    if (left === null && right !== null) type = 'added';
    else if (left !== null && right === null) type = 'removed';
    else if (left !== right) type = 'modified';

    rows.push({ type, left, right });
  }
}

/**
 * 行级文本 Diff（空白敏感）
 * - 以 "\n" 切分为行
 * - 产出对齐行（两列对齐，插入/删除用空行占位）
 * - 全量行输出，不做过滤
 */
export function diffLines(leftText: string, rightText: string): TextDiffRow[] {
  const leftLines = splitLines(leftText);
  const rightLines = splitLines(rightText);

  const ops = myersDiffLines(leftLines, rightLines);
  const rows: TextDiffRow[] = [];

  const pendingDeletes: string[] = [];
  const pendingInserts: string[] = [];

  const flushPending = () => {
    if (pendingDeletes.length === 0 && pendingInserts.length === 0) return;
    flushReplaceGroup(pendingDeletes, pendingInserts, rows);
    pendingDeletes.length = 0;
    pendingInserts.length = 0;
  };

  for (const op of ops) {
    if (op.type === 'equal') {
      flushPending();
      rows.push({ type: 'same', left: op.value, right: op.value });
      continue;
    }
    if (op.type === 'delete') {
      pendingDeletes.push(op.value);
      continue;
    }
    pendingInserts.push(op.value);
  }

  flushPending();
  return rows;
}

export function buildHunks(rows: TextDiffRow[]): TextDiffHunk[] {
  const hunks: TextDiffHunk[] = [];

  let start: number | null = null;
  for (let i = 0; i < rows.length; i += 1) {
    const isChanged = rows[i].type !== 'same';
    if (isChanged && start === null) start = i;
    if (!isChanged && start !== null) {
      hunks.push({ startRow: start, endRow: i - 1 });
      start = null;
    }
  }

  if (start !== null) {
    hunks.push({ startRow: start, endRow: rows.length - 1 });
  }

  return hunks;
}
