# 用户管理功能模块实施计划

## 需求摘要

为「安全生产隐患复核系统」新增用户管理模块，仅管理员可访问。功能包括：用户列表（支持分页和用户名搜索）、新增用户、编辑用户、删除用户（软删除）、重置密码。

## 验收标准

1. 管理员登录后，左侧菜单显示「用户管理」入口。
2. 用户列表页支持分页，支持按用户名关键字搜索。
3. 新增/编辑用户表单包含：用户名、角色（admin/inspector）、密码（新增必填，编辑可选）。
4. 支持重置密码功能（独立操作，避免误改）。
5. 删除用户为软删除，被删除用户无法登录。
6. 后端接口通过 `require_admin` 权限校验。
7. 新增和修改的接口均有 pytest 测试覆盖。

## 实现步骤

### 后端

1. **扩展用户 Schema** (`backend/app/schemas/user.py`)
   - 新增 `UserUpdate`：支持更新 `role`，`password` 为可选。
   - 新增 `UserResetPassword`：包含 `new_password`。
   - 新增 `UserSearchParams` 或直接在路由参数中处理 `keyword`。

2. **扩展用户路由** (`backend/app/routers/users.py`)
   - `GET /api/v1/users`：已有分页，增加 `keyword` 查询参数，用 `User.username.ilike(f"%{keyword}%")` 过滤。
   - `PUT /api/v1/users/{user_id}`：更新用户角色和密码（密码提供时才更新）。
   - `POST /api/v1/users/{user_id}/reset-password`：重置密码。
   - 已有 `POST /api/v1/users` 和 `DELETE /api/v1/users/{user_id}` 基本可用，视情况微调返回格式。

3. **补充测试** (`backend/tests/`)
   - 新建 `test_users.py`：覆盖列表搜索、更新用户、重置密码、删除用户。
   - 使用 `conftest.py` 中的 `client` fixture，创建测试用户进行验证。

### 前端

4. **新增 API 封装** (`frontend/src/api/user.ts`)
   - `getUsers(params)`、`createUser(data)`、`updateUser(id, data)`、`deleteUser(id)`、`resetPassword(id, data)`。

5. **新增用户管理页面** (`frontend/src/pages/User/UserList.tsx`)
   - 使用 Ant Design 的 `Table`、`Form`、`Modal`、`Input`、`Select`、`Pagination`。
   - 表格列：用户名、角色、创建时间、操作（编辑、删除、重置密码）。
   - 顶部有「新增用户」按钮和搜索框。
   - 新增/编辑共用同一个 Modal 表单。
   - 重置密码使用独立的确认 Modal。
   - 角色用 `Select`，选项为 `admin`（管理员）和 `inspector`（检查员）。

6. **注册路由和菜单**
   - `frontend/src/App.tsx`：添加 `/users` 路由。
   - `frontend/src/components/Layout/index.tsx`：在 `menuItems` 中增加 `{ key: '/users', label: '用户管理' }`。

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 误删管理员自身导致无法登录 | 前端删除/编辑自己时给出强提示；后端允许删除自己但保留至少一个管理员（可选后续增强）。 |
| 密码明文传输 | 使用 HTTPS（生产环境）；本阶段保持现有 OAuth2 密码登录的传输方式不变。 |
| 搜索性能差 | 用户表数据量小，默认分页 20 条；如数据量大后续可在 `users.username` 上加索引。 |

## 验证步骤

1. 启动后端：`uvicorn app.main:app --reload --port 8000`
2. 启动前端：`cd frontend && npm run dev`
3. 用 `admin/admin123` 登录，点击「用户管理」菜单。
4. 测试新增用户、搜索、编辑、重置密码、删除的完整流程。
5. 运行 `cd backend && pytest tests/test_users.py` 确认测试通过。
