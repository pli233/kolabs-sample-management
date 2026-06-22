# Kolabs 样本库管理

实验室生物样本库(biorepository)可视化管理。**界面为英文**(中文仅用于文档/沟通)。

左侧导航两个入口:
- **Data Feeds** —— 上传 Excel/CSV 作为系统数据源;每个上传是一个 feed,最新上传**自动成为活动源
  (active feed)**,也可在列表里 "Set active" 切换。活动源是服务端全局单例。
- **Dashboard** —— 针对**当前活动源**的功能完整数据表:全列搜索、按列高级筛选(包含/等于/大于/为空…
  运算符 + Match all/any 的 AND/OR 组合,**box/position 列做值归一化**使 `A1` 匹配 `A01`)、点列排序、
  虚拟滚动(26 万行服务端分页)、列可见性多选(默认 12 常用列)、拖拽列宽、**导出当前视图为带样式
  xlsx**、居中。搜索/筛选/排序/导出全部在后端对全量数据生效。
  表格由 TanStack Table(列模型)+ TanStack Virtual(虚拟滚动)驱动。

## 架构

```
frontend/  Vite + React + TS + Tailwind + shadcn 风格 UI
           + @tanstack/react-table(搜索/排序)+ @tanstack/react-virtual(虚拟滚动)
backend/   FastAPI + openpyxl + SQLite(SQLModel)
           - 存原始文件到磁盘 + 解析缓存(sidecar JSON)
           - 主库 43 列固定 schema 校验(可扩展注册表)
data/      数据库下载结果.xlsx —— 本需求的样本/测试夹具
docs/superpowers/  设计 spec 与实现计划
```

后端是「薄存储层」:存原始字节 + 轻量规范化与 schema 校验后的**全量** JSON 缓存。解析在上传时
完成一次并缓存(含全部行),内存 LRU 让分页请求免去重复读盘。表格通过
`GET /api/files/{id}/rows?offset&limit&q&sort&dir` **服务端分页**展示**全部行**(主库 26 万行
也能逐页浏览),**搜索和排序也在后端对全量数据生效**(不只对已载入的窗口)。前端用虚拟滚动 +
按可视窗口分段拉取(windowed pagination)。

**多工作表与主数据表**:一个 xlsx 常含多个 sheet。上传后,若有多个 sheet,前端弹出选择器让用户
指定**主数据表**(预选最符合主库 schema 的那个)。**只展示并校验选中的这一个**,文件的匹配状态、
(未来)数据库同步都以它为准。schema 校验分三态:`matched`(符合,无提示)、`partial`(接近主库
但有列差异,**列出具体缺/多/乱序的列**)、`other`(辅助/汇总表,中性提示、不算错误)。这样标准库
下载文件不会因一个 7 列的辅助 sheet 被误判为「不符」。

## 本地开发

需要 Python 3.12+ 和 Node 22+。

**后端**(终端 1):
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**前端**(终端 2):
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173,/api 自动代理到 8000
```

打开前端地址(`/` 自动跳 Dashboard)→ 进 **Data Feeds** 拖入 `data/数据库下载结果.xlsx`
→ 选定主数据表 → 它成为活动源,回 **Dashboard** 搜索/筛选/排序。

## 测试

```bash
cd backend && source .venv/bin/activate && python -m pytest -q   # 39 个单元/接口测试
cd frontend && npm run test                                      # 10 个组件测试
cd frontend && npm run e2e                                       # Playwright 端到端
```

后端测试用真实样本 `data/数据库下载结果.xlsx` 作夹具;上传用例会完整解析 26 万行,故整套约 3-4 分钟。

**端到端(Playwright)**:`npm run e2e` 会先构建 SPA,再起一个隔离数据目录的 FastAPI
服务(同源托管 SPA+API,端口 8099),用 Chromium 模拟真实用户:**拖拽**
`frontend/e2e/fixtures/sample-main-library.xlsx` 进 Data Feeds → 选定主数据表 → 自动成为活动源 → Dashboard
→ 全列搜索过滤 → 点列排序 → 返回查看最近上传列表;另含不支持类型被拒的场景。
需先 `cd backend` 建好 `.venv`(uvicorn 依赖)。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/files` | 上传(multipart)→ 存盘 + 校验 → 元数据 + 校验结果 |
| GET | `/api/files` | 已上传文件列表 |
| GET | `/api/active-feed` | 当前活动源 `{ active: FileMeta \| null }` |
| PUT | `/api/active-feed` | 设置活动源(`{"file_id": n}`),不存在 → 404 |
| GET | `/api/files/{id}` | 单文件元数据 |
| GET | `/api/files/{id}/raw` | 原始文件字节 |
| GET | `/api/files/{id}/rows` | 分页行:`?offset&limit&q&filters&match&sort&dir`(全量搜索/筛选/排序,box/pos 归一化) |
| GET | `/api/files/{id}/export` | 当前视图导出带样式 xlsx(同 rows 参数 + `columns`) |
| PATCH | `/api/files/{id}` | 设置主数据表(`{"primary_sheet": "..."}`) |
| GET | `/api/health` | 健康检查 |

## 部署(Railway,带持久磁盘)

Vercel 的 serverless 不能持久化本地磁盘,故本项目部署到有持久卷的平台。

1. `Dockerfile` 是多阶段构建:先 `npm run build` 出 SPA,再由 FastAPI 同源托管 SPA + API。
2. 在 Railway 新建服务,连本仓库,使用仓库内 `Dockerfile`(见 `railway.json`)。
3. 挂一个 **Volume 到 `/data`**,并设环境变量(见 `backend/.env.example`):
   - `UPLOAD_DIR=/data/uploads`
   - `DB_URL=sqlite:////data/app.db`
4. Railway 注入 `$PORT`,容器已据此启动。

前端用同源相对 `/api` 路径,生产环境无需配 CORS 或 API 地址。

## 已知限制 / 下一步

- 全量行存于内存 LRU + 上传时写的全量缓存;单机/单用户够用。若并发或文件极多,可改为把行落到
  SQLite/列存,搜索/排序走索引,降低内存占用。
- 目前只展示选定的单个工作表;如需在 viewer 内改选其他 sheet,可后续加「切换主表」入口
  (后端 `PATCH /api/files/{id}` 已支持)。
- 本期只实现主库 43 列 schema;其他文件类型的 schema 在注册表中逐个补充。

## Git 工作流

worktree 开发 → 合入 `main` → push 远程。
