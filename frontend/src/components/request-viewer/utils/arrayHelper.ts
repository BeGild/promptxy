/**
 * 数组类型判断工具函数
 * 用于决定数组节点在文件树中的展示方式
 */

/**
 * 判断数组是否为纯数值数组
 * 纯数值数组应作为叶子节点，避免撑爆目录树
 *
 * @param arr - 待判断的数组
 * @returns 如果数组只包含数值类型则返回 true
 *
 * @example
 * isNumericArray([1, 2, 3])        // true
 * isNumericArray([1.5, 2.5, 3.5])   // true
 * isNumericArray(['a', 'b'])        // false
 * isNumericArray([])                // true (空数组视为数值数组)
 */
export function isNumericArray(arr: any[]): boolean {
  if (arr.length === 0) return true;
  return arr.every(item => typeof item === 'number');
}

/**
 * 判断数组是否为纯原始类型数组（数字、字符串、布尔等）
 * 纯原始数组作为叶子节点，对象数组展开为文件夹
 *
 * @param arr - 待判断的数组
 * @returns 如果数组只包含原始类型则返回 true
 *
 * @example
 * isPrimitiveArray([1, 2, 3])           // true
 * isPrimitiveArray(['a', 'b'])          // true
 * isPrimitiveArray([true, false])       // true
 * isPrimitiveArray([{a: 1}, {b: 2}])   // false
 * isPrimitiveArray([])                  // true
 */
export function isPrimitiveArray(arr: any[]): boolean {
  if (arr.length === 0) return true;
  return arr.every(item =>
    item === null ||
    item === undefined ||
    typeof item !== 'object'
  );
}
