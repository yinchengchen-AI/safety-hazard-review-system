# Alembic 数据库迁移说明

## 环境配置

已配置完成，`alembic.ini` 和 `env.py` 已指向项目的数据库 `safety_hazard`。

## 常用命令

### 生成迁移脚本
```bash
cd backend
alembic revision --autogenerate -m "描述变更内容"
```

### 应用迁移
```bash
cd backend
alembic upgrade head
```

### 回退一级
```bash
cd backend
alembic downgrade -1
```

### 查看当前版本
```bash
cd backend
alembic current
```

## 注意事项

- `env.py` 中已导入所有模型，确保 `autogenerate` 能正确检测变更。
- 使用异步引擎（`asyncpg`）执行迁移。
- 生成迁移脚本后，**务必检查生成的脚本内容**，确认 `upgrade()` 和 `downgrade()` 中的操作是否符合预期。
