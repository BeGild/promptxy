## 1. 后端数据结构修改

- [x] 1.1 修改 `backend/src/promptxy/types.ts` 中的 `RequestRecord` 接口，添加 `transformedBody?: string` 字段
- [x] 1.2 修改 `backend/src/promptxy/types.ts` 中的 `RequestRecordResponse` 接口，添加 `transformedBody?: any` 字段
- [x] 1.3 验证类型定义正确，确保字段为可选类型（`?`）

## 2. 后端数据库层修改

- [x] 2.1 修改 `backend/src/promptxy/database.ts` 中的 `insert` 方法，支持保存 `transformedBody` 字段
- [x] 2.2 修改 `backend/src/promptxy/database.ts` 中的 `getDetail` 方法，支持读取和解析 `transformedBody` 字段
- [x] 2.3 修改 `backend/src/promptxy/database.ts` 中的 `writeRequestFile` 方法，在写入 YAML 文件时包含 `transformedBody` 字段
- [x] 2.4 修改 `backend/src/promptxy/database.ts` 中的 `loadRequestFile` 方法，支持从 YAML 文件读取 `transformedBody` 字段

## 3. 后端网关层修改

- [x] 3.1 在 `backend/src/promptxy/gateway.ts` 中添加 `transformedBody` 变量声明
- [x] 3.2 在转换器处理完成后（gateway.ts:868 行附近）保存转换器处理后的请求到 `transformedBody` 变量
- [x] 3.3 修改创建 `RequestRecord` 的逻辑（gateway.ts:1003 行附近），将 `transformedBody` 包含在记录中
- [x] 3.4 验证在无转换器场景下，`transformedBody` 为 `undefined`
- [x] 3.5 验证在有转换器场景下，`transformedBody` 包含转换器处理后的完整请求体

## 4. 后端 API 层修改

- [x] 4.1 修改 `backend/src/promptxy/api-handlers.ts` 中的请求详情返回逻辑
- [x] 4.2 在返回 `RequestRecordResponse` 时，将 `transformedBody` 字符串解析为 JSON 对象
- [x] 4.3 验证 API 返回时正确处理 `transformedBody` 为 `undefined` 的情况（老数据兼容）
- [x] 4.4 确认 API 响应格式与现有 API 保持兼容

## 5. 前端类型定义修改

- [x] 5.1 修改 `frontend/src/types/request.ts` 中的 `RequestRecord` 接口，添加 `transformedBody?: any` 字段
- [x] 5.2 确保字段定义为可选类型，以兼容老数据

## 6. 前端请求详情组件修改

- [x] 6.1 修改 `frontend/src/components/requests/RequestDetail.tsx` 中传递给 `RequestDetailPanel` 的 `originalRequest` 参数
- [x] 6.2 使用 `request.transformedBody || request.originalBody` 确保向后兼容
- [x] 6.3 验证在无 `transformedBody` 时使用 `originalBody` 作为对比基准

## 7. 前端差异展示组件修改

- [x] 7.1 修改 `frontend/src/components/requests/DiffViewer.tsx` 中的左侧标题文案
- [x] 7.2 将"原始请求"改为"转换后请求"（当存在差异时）
- [x] 7.3 修改右侧标题文案，更准确反映"最终请求"的含义
- [x] 7.4 验证在无差异时正确显示"转换后请求（无改写）"

## 8. 测试和验证

- [x] 8.1 测试场景 1：无规则 + 无转换器 → 应显示原始 vs 修改后，无差异
- [x] 8.2 测试场景 2：有规则 + 无转换器 → 应显示原始 vs 修改后，有差异
- [x] 8.3 测试场景 3：无规则 + 有转换器 → 应显示转换后 vs 最终，无差异
- [x] 8.4 测试场景 4：有规则 + 有转换器 → 应显示转换后 vs 最终，有差异
- [x] 8.5 测试老数据兼容性：无 `transformedBody` 的数据应正常显示
- [x] 8.6 验证差异对比逻辑在所有场景下都正确工作
- [x] 8.7 运行现有测试套件，确保不破坏现有功能
- [x] 8.8 手动测试 UI 展示，确认文案和布局符合预期

## 9. 文档更新

- [x] 9.1 更新 README.md（如需要），说明新的差异对比逻辑
- [x] 9.2 更新项目文档，记录 `transformedBody` 字段的用途和含义
