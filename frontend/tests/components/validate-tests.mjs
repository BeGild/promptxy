/**
 * 验证组件测试文件的简单脚本
 * 检查文件是否存在和基本语法
 */

import fs from 'fs';
import path from 'path';

const testFiles = [
  'common.test.tsx',
  'layout.test.tsx',
  'rules.test.tsx',
  'requests.test.tsx',
  'preview.test.tsx',
  'settings.test.tsx',
];

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const componentsDir = path.join(__dirname);

console.log('🔍 验证组件测试文件...\n');

let allValid = true;

testFiles.forEach(file => {
  const filePath = path.join(componentsDir, file);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ 缺失: ${file}`);
    allValid = false;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const size = (content.length / 1024).toFixed(1);

  // 基本语法检查
  const hasImport = content.includes('import');
  const hasDescribe = content.includes('describe(');
  const hasIt = content.includes('it(');
  const hasExpect = content.includes('expect(');

  if (hasImport && hasDescribe && hasIt && hasExpect) {
    console.log(`✅ ${file} (${size} KB) - 结构完整`);
  } else {
    console.log(`⚠️  ${file} - 可能缺少测试结构`);
    allValid = false;
  }
});

console.log('\n📊 统计信息:');
console.log(`- 测试文件数量: ${testFiles.length}`);
console.log(
  `- 验证通过: ${
    testFiles.filter(f => {
      const filePath = path.join(componentsDir, f);
      if (!fs.existsSync(filePath)) return false;
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.includes('describe(') && content.includes('it(');
    }).length
  }`,
);

if (allValid) {
  console.log('\n🎉 所有测试文件验证通过！');
  process.exit(0);
} else {
  console.log('\n⚠️  发现一些问题，请检查上面的输出。');
  process.exit(1);
}
