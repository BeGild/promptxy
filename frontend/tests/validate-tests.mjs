#!/usr/bin/env node

/**
 * 简单的测试验证脚本
 * 检查测试文件是否存在且包含基本的测试结构
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  'tests/unit/utils.test.ts',
  'tests/unit/api.test.ts',
  'tests/unit/hooks.test.ts',
  'tests/unit/store.test.ts',
];

console.log('🔍 验证测试文件结构...\n');

let allValid = true;

testFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);

  console.log(`📄 检查 ${file}`);

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ 文件不存在`);
    allValid = false;
    return;
  }

  // 读取文件内容
  const content = fs.readFileSync(filePath, 'utf8');

  // 检查基本导入
  const hasDescribe = content.includes('describe(');
  const hasIt = content.includes('it(');
  const hasExpect = content.includes('expect(');
  const hasVitest = content.includes("from 'vitest'");

  if (hasDescribe && hasIt && hasExpect && hasVitest) {
    console.log(`   ✅ 结构完整`);
  } else {
    console.log(`   ❌ 缺少基本测试结构`);
    allValid = false;
  }

  // 统计测试用例数量
  const describeMatches = content.match(/describe\(/g) || [];
  const itMatches = content.match(/it\(/g) || [];

  console.log(`   📊 测试套件: ${describeMatches.length}, 测试用例: ${itMatches.length}`);
  console.log('');
});

// 检查配置文件
const configFiles = ['vitest.config.ts', 'tests/setup.ts', 'tsconfig.test.json'];

console.log('⚙️  检查配置文件...\n');

configFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);

  console.log(`📄 检查 ${file}`);

  if (fs.existsSync(filePath)) {
    console.log(`   ✅ 存在`);
  } else {
    console.log(`   ❌ 文件不存在`);
    allValid = false;
  }
  console.log('');
});

// 检查 package.json 脚本
console.log('📦 检查 package.json 脚本...\n');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};

  const requiredScripts = ['test', 'test:run', 'test:watch', 'test:coverage'];

  requiredScripts.forEach(script => {
    if (scripts[script]) {
      console.log(`   ✅ "${script}" 脚本存在`);
    } else {
      console.log(`   ❌ "${script}" 脚本缺失`);
      allValid = false;
    }
  });
} else {
  console.log('   ❌ package.json 不存在');
  allValid = false;
}

console.log('\n' + '='.repeat(50));

if (allValid) {
  console.log('✅ 所有测试文件和配置都已正确设置！');
  console.log('');
  console.log('🎯 下一步：');
  console.log('   1. 运行 npm install 安装测试依赖');
  console.log('   2. 运行 npm run test:run 执行测试');
  console.log('   3. 检查测试覆盖率 npm run test:coverage');
  process.exit(0);
} else {
  console.log('❌ 发现一些问题，请检查上面的错误信息');
  process.exit(1);
}
