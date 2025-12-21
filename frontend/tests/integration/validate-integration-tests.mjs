#!/usr/bin/env node

/**
 * 集成测试验证脚本
 * 验证测试文件结构和基本语法
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = ['pages.test.tsx', 'user-flows.test.tsx', 'data-flow.test.tsx'];

const requiredImports = [
  'describe',
  'it',
  'expect',
  'vi',
  'beforeEach',
  'render',
  'screen',
  'waitFor',
];

const requiredMocks = ['@/api/client', '@/api/sse', '@heroui/react'];

function validateFile(filePath) {
  console.log(`\n验证文件: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`  ❌ 文件不存在`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // 检查导入
  let hasImports = true;
  for (const imp of requiredImports) {
    if (!content.includes(imp)) {
      console.error(`  ❌ 缺少导入: ${imp}`);
      hasImports = false;
    }
  }

  // 检查 Mock
  let hasMocks = true;
  for (const mock of requiredMocks) {
    if (!content.includes(mock)) {
      console.error(`  ❌ 缺少 Mock: ${mock}`);
      hasMocks = false;
    }
  }

  // 检查 describe 块
  const describeMatches = content.match(/describe\(/g);
  if (!describeMatches || describeMatches.length === 0) {
    console.error(`  ❌ 缺少 describe 块`);
    return false;
  }

  // 检查 it 测试用例
  const itMatches = content.match(/it\(/g);
  if (!itMatches || itMatches.length < 3) {
    console.error(`  ⚠️  测试用例数量较少 (${itMatches ? itMatches.length : 0})`);
  }

  // 检查文件大小（不应过大）
  const stats = fs.statSync(filePath);
  if (stats.size > 500000) {
    console.error(`  ⚠️  文件过大 (${(stats.size / 1024).toFixed(2)} KB)`);
  }

  console.log(`  ✅ 文件结构正确`);
  console.log(`  📊 测试用例: ${itMatches ? itMatches.length : 0} 个`);
  console.log(`  📦 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);

  return hasImports && hasMocks;
}

function main() {
  console.log('🧪 集成测试验证工具');
  console.log('='.repeat(50));

  let allValid = true;
  const basePath = path.join(__dirname, '../../tests/integration');

  for (const file of testFiles) {
    const filePath = path.join(basePath, file);
    const valid = validateFile(filePath);
    if (!valid) {
      allValid = false;
    }
  }

  console.log('\n' + '='.repeat(50));

  if (allValid) {
    console.log('✅ 所有测试文件验证通过');
    console.log('\n运行测试:');
    console.log('  npm test -- tests/integration/');
    console.log('  npm run test:watch -- tests/integration/');
    process.exit(0);
  } else {
    console.log('❌ 部分测试文件验证失败');
    process.exit(1);
  }
}

main();
