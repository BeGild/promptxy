# Tasks: add-path-autocomplete

## Phase 1: 后端 API

- [x] 在 `backend/src/promptxy/types.ts` 新增 `PathsResponse` 类型
- [x] 在 `backend/src/promptxy/database.ts` 新增 `getUniquePaths()` 函数
- [x] 在 `backend/src/promptxy/database.ts` 修改 `getRequestList()` 实现智能搜索逻辑
- [x] 在 `backend/src/promptxy/database.ts` 添加 `path` 字段索引
- [x] 在 `backend/src/promptxy/api-server.ts` 新增 `handleGetPaths()` 处理函数
- [x] 在 `backend/src/promptxy/api-server.ts` 注册 `GET /_promptxy/paths` 路由

## Phase 2: 前端 API

- [x] 在 `frontend/src/types/api.ts` 新增 `PathsResponse` 类型
- [x] 在 `frontend/src/api/requests.ts` 新增 `getPaths()` 函数

## Phase 3: 前端组件

- [x] 创建 `frontend/src/components/requests/PathAutocomplete.tsx` 组件
- [x] 在 `RequestList.tsx` 中使用 PathAutocomplete 替换 Input
- [x] 在 `RequestListVirtual.tsx` 中使用 PathAutocomplete 替换 Input

## Phase 4: 验证

- [x] 构建后端和前端，确保无 TypeScript 错误
- [x] 测试 Autocomplete 加载路径列表
- [x] 测试本地过滤功能
- [x] 测试路径前缀匹配（输入 `/api/users` 匹配 `/api/users/123`）
- [x] 测试 ID 模糊匹配（输入非 `/` 开头的内容）
- [x] 测试清除搜索功能
- [x] 测试虚拟滚动和普通列表的兼容性
