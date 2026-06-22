# 样本库上传与双视角展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 上传 xlsx/xls/csv 文件到 FastAPI 后端保存,并在前端以「Excel 原样式(Univer)」与「优化表格(shadcn 虚拟表)」两种视角展示同一份数据。

**Architecture:** 薄后端(FastAPI)= 存原始文件到本地磁盘 + SQLite 元数据 + openpyxl 轻量规范化与主库 schema 校验,暴露 list/raw/data 接口。前端(Vite+React)= dropzone 上传 + viewer 双视角切换,视角 A 用 Univer 渲染原始字节,视角 B 渲染后端清理后的 JSON。

**Tech Stack:** 后端 FastAPI + uvicorn + openpyxl + SQLModel(SQLite);前端 Vite + React + TS + Tailwind + shadcn/ui + react-dropzone + Univer + @tanstack/react-virtual + react-router。

## Global Constraints

- 本期唯一测试夹具:`data/数据库下载结果.xlsx`(主库 43 列)。其余 `data/` 文件属其他需求,不处理。
- 主库 schema 为固定 43 有序列(见 spec §4.3),schema 注册表可扩展但本期只注册 `main_library`。
- schema 校验**不阻断**保存与查看;不符仅记 `issues` 并在 UI 提示。
- 文件大小上限 50MB;仅接受扩展名 `.xlsx/.xls/.csv`。
- 设计令牌取自 kolaboratory.com(spec §7):primary `#0e8ed6`,foreground `#060f1c`,border `#d4dce3`,muted `#f2f4f7`,标题 Poppins。
- 两个视角数据/功能完全相同,仅渲染风格不同。
- 提交频繁;后端 Python TDD(pytest),前端关键逻辑 Vitest。
- Git:feature 分支开发 → merge main。

---

### Task 1: 仓库骨架与后端工程初始化

**Files:**
- Create: `backend/requirements.txt`, `backend/app/__init__.py`, `backend/app/main.py`, `backend/app/config.py`, `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/pytest.ini`, `README.md`

**Interfaces:**
- Produces: FastAPI `app` (健康检查 `GET /api/health` → `{"status":"ok"}`);`config.settings`(`UPLOAD_DIR`, `DB_URL`, `MAX_FILE_BYTES=52428800`, `ALLOWED_EXT={".xlsx",".xls",".csv"}`)。

- [ ] Step 1: 写 `requirements.txt`(fastapi, uvicorn[standard], python-multipart, openpyxl, sqlmodel, pytest, httpx)。
- [ ] Step 2: 写 `config.py` 暴露 `settings`。
- [ ] Step 3: 写 `main.py` 创建 app + CORS(允许 localhost:5173)+ `/api/health`。
- [ ] Step 4: `conftest.py` 提供 `client = TestClient(app)` 与 `sample_xlsx_path` fixture 指向 `data/数据库下载结果.xlsx`。
- [ ] Step 5: 写测试 `tests/test_health.py::test_health` 断言 200 + `{"status":"ok"}`。
- [ ] Step 6: Run `cd backend && python -m pytest tests/test_health.py -v` → PASS。
- [ ] Step 7: Commit `feat(backend): scaffold FastAPI app with health check`。

---

### Task 2: Schema 注册表 + 主库校验器

**Files:**
- Create: `backend/app/schemas/__init__.py`, `backend/app/schemas/main_library.py`, `backend/app/schemas/registry.py`, `backend/tests/test_schema.py`

**Interfaces:**
- Produces:
  - `MAIN_LIBRARY_COLUMNS: list[str]`(43 列,顺序见 spec §4.3)。
  - `SchemaDef`(`name:str`, `columns:list[str]`)。
  - `registry.match(header: list[str]) -> str | None`:表头命中某 schema 返回其 name,否则 None。
  - `registry.validate(name: str, header: list[str]) -> list[dict]`:返回 issues,每条 `{"type": "missing|extra|order", "column": str}`。

- [ ] Step 1: 写 `test_schema.py`:`test_match_main_library`(43 列表头 → `"main_library"`)、`test_match_unrecognized`(乱列 → None)、`test_validate_missing_column`(缺一列 → 含 `missing` issue)、`test_validate_extra_column`、`test_validate_clean`(完全一致 → `[]`)。
- [ ] Step 2: Run pytest → FAIL(模块不存在)。
- [ ] Step 3: 写 `main_library.py`(列常量)、`registry.py`(match 用集合相等判定主库;validate 比较缺/多/顺序)。
- [ ] Step 4: Run `python -m pytest tests/test_schema.py -v` → PASS。
- [ ] Step 5: Commit `feat(backend): schema registry + main library validator`。

---

### Task 3: 解析与轻量规范化(openpyxl)

**Files:**
- Create: `backend/app/parsing.py`, `backend/tests/test_parsing.py`

**Interfaces:**
- Produces:
  - `parse_workbook(path: str) -> list[SheetData]`,`SheetData = {"name":str, "columns":list[str], "rows":list[list], "schemaValid":bool, "issues":list[dict]}`。
  - 规范化:trim 字符串首尾空格;空单元格 → `None`;datetime → ISO 字符串;丢弃全空行;每 sheet 用 `registry` 判 `schemaValid`/`issues`。
  - csv:`parse_csv(path) -> list[SheetData]`(单 sheet 名 `"CSV"`)。
  - 统一入口 `parse_file(path, ext) -> list[SheetData]`。

- [ ] Step 1: 写 `test_parsing.py`:用 `sample_xlsx_path` 断言:返回多 sheet;主 sheet `columns == MAIN_LIBRARY_COLUMNS`、`schemaValid is True`;首行某已知值正确;辅助 sheet(7 列 `Sheet1`)`schemaValid is False`;无全空行;datetime 单元格为 `str`。
- [ ] Step 2: Run → FAIL。
- [ ] Step 3: 实现 `parsing.py`(openpyxl `read_only`,`csv` 模块)。
- [ ] Step 4: Run `python -m pytest tests/test_parsing.py -v` → PASS。
- [ ] Step 5: Commit `feat(backend): xlsx/csv parsing with normalization`。

---

### Task 4: 存储层 + SQLite 元数据模型

**Files:**
- Create: `backend/app/models.py`, `backend/app/storage.py`, `backend/tests/test_storage.py`

**Interfaces:**
- Produces:
  - `FileRecord`(SQLModel):`id:int pk`, `original_filename:str`, `stored_path:str`, `size:int`, `content_type:str`, `sheet_count:int`, `schema_type:str`, `validation_status:str`, `uploaded_at:datetime`。
  - `init_db()`;`get_session()`。
  - `storage.save_upload(filename, data: bytes) -> str`(写入 `UPLOAD_DIR`,返回 stored_path,文件名加 uuid 前缀防冲突)。
  - `storage.read_raw(stored_path) -> bytes`。

- [ ] Step 1: 写 `test_storage.py`:`save_upload` 后文件存在且 `read_raw` 内容一致;`init_db` 后能插入并查询 `FileRecord`。用 tmp_path 覆写 `UPLOAD_DIR`/`DB_URL`。
- [ ] Step 2: Run → FAIL。
- [ ] Step 3: 实现 `models.py` + `storage.py`。
- [ ] Step 4: Run `python -m pytest tests/test_storage.py -v` → PASS。
- [ ] Step 5: Commit `feat(backend): disk storage + sqlite metadata model`。

---

### Task 5: API 路由(upload/list/get/raw/data)

**Files:**
- Create: `backend/app/routes.py`; Modify: `backend/app/main.py`(include_router, startup init_db)
- Create: `backend/tests/test_api.py`

**Interfaces:**
- Produces 路由(见 spec §4.1):
  - `POST /api/files`(UploadFile)→ 校验扩展名(415)、大小(413)、解析(422)→ save + 记录 → `{id, original_filename, sheet_count, schema_type, validation:{status, sheets:[{name,schemaValid,issues}]}}`。
  - `GET /api/files` → 元数据列表。
  - `GET /api/files/{id}` → 单条;不存在 404。
  - `GET /api/files/{id}/raw` → `FileResponse`/`StreamingResponse` 原始字节。
  - `GET /api/files/{id}/data` → `{sheets:[SheetData]}`(重新 `parse_file`)。

- [ ] Step 1: 写 `test_api.py`:上传 sample → 200 + `schema_type=="main_library"`;`GET /api/files` 含该条;`/raw` 字节与原文件一致;`/data` 主 sheet 43 列;上传 `.txt` → 415;不存在 id → 404。
- [ ] Step 2: Run → FAIL。
- [ ] Step 3: 实现 `routes.py` 串联 storage/parsing/schema/models;`main.py` include。
- [ ] Step 4: Run `python -m pytest tests/ -v` → 全 PASS。
- [ ] Step 5: Commit `feat(backend): file upload/list/raw/data routes`。

---

### Task 6: 前端工程初始化 + 设计令牌 + shadcn 基座

**Files:**
- Create: `frontend/` Vite React-TS 工程;`frontend/src/styles/tokens.css`;`frontend/tailwind.config.js`;`frontend/src/lib/utils.ts`;基础 shadcn 组件(button, table, toggle-group, alert, tabs)。
- Modify: `frontend/src/index.css`, `frontend/index.html`(Poppins+Inter Google Fonts)。

**Interfaces:**
- Produces:Tailwind 主题映射 Kolaboratory 令牌;`cn()` util;shadcn 组件可导入。

- [ ] Step 1: `npm create vite@latest frontend -- --template react-ts`;装 tailwind、`@tanstack/react-virtual`、`react-dropzone`、`react-router-dom`、`@univerjs/*`、`clsx tailwind-merge class-variance-authority lucide-react`。
- [ ] Step 2: 配 Tailwind v3 + `tokens.css`(`:root` 写 spec §7 的 HSL/hex 变量),`index.html` 引 Poppins/Inter。
- [ ] Step 3: 加 shadcn 组件源码(button/table/toggle-group/alert/tabs)+ `lib/utils.ts`。
- [ ] Step 4: `npm run build` 通过。
- [ ] Step 5: Commit `feat(frontend): vite+tailwind+shadcn scaffold with kolab tokens`。

---

### Task 7: API 客户端 + 路由骨架

**Files:**
- Create: `frontend/src/lib/api.ts`, `frontend/src/App.tsx`(routes), `frontend/src/main.tsx`(BrowserRouter)

**Interfaces:**
- Produces:
  - `api.uploadFile(file): Promise<UploadResult>`、`api.listFiles(): Promise<FileMeta[]>`、`api.getData(id): Promise<{sheets:SheetData[]}>`、`api.rawUrl(id): string`。
  - 类型 `SheetData`/`FileMeta`/`UploadResult` 与后端字段一致。
  - 路由:`/` → UploadPage,`/files/:id` → ViewerPage。
  - `VITE_API_BASE` 环境变量(默认 `http://localhost:8000`)。

- [ ] Step 1: 写 `api.ts` + 类型。
- [ ] Step 2: 写 `App.tsx`/`main.tsx` 路由骨架(页面先占位)。
- [ ] Step 3: `npm run build` 通过。
- [ ] Step 4: Commit `feat(frontend): api client + router skeleton`。

---

### Task 8: 上传页(drive-box dropzone + 最近上传)

**Files:**
- Create: `frontend/src/components/Dropzone.tsx`, `frontend/src/pages/UploadPage.tsx`, `frontend/src/components/RecentFiles.tsx`
- Test: `frontend/src/components/__tests__/Dropzone.test.tsx`(Vitest + Testing Library)

**Interfaces:**
- Consumes: `api.uploadFile`, `api.listFiles`。
- Produces: 拖拽区接受 xlsx/xls/csv、显示进度、类型错误提示;成功后 `navigate(/files/:id)`;最近上传列表点击进 viewer。

- [ ] Step 1: 写 Dropzone 测试(拒绝 `.txt`、接受 `.xlsx` 调 onFile)。
- [ ] Step 2: Run vitest → FAIL。
- [ ] Step 3: 实现 Dropzone(react-dropzone,品牌色虚线框)、UploadPage、RecentFiles。
- [ ] Step 4: Run vitest → PASS;`npm run build` 通过。
- [ ] Step 5: Commit `feat(frontend): upload page with dropzone and recent files`。

---

### Task 9: Viewer — 视角切换 + sheet 选择 + 视角 B(优化表格)

**Files:**
- Create: `frontend/src/pages/ViewerPage.tsx`, `frontend/src/components/SheetTabs.tsx`, `frontend/src/components/CleanTableView.tsx`, `frontend/src/components/SchemaBanner.tsx`
- Test: `frontend/src/components/__tests__/CleanTableView.test.tsx`

**Interfaces:**
- Consumes: `api.getData`, `SheetData`。
- Produces: ToggleGroup `[Excel 原样式 | 优化表格]`;SheetTabs 选当前 sheet;CleanTableView 用 `@tanstack/react-virtual` 虚拟滚动渲染当前 sheet;`schemaValid=false` 时 SchemaBanner 列出 issues。

- [ ] Step 1: 写 CleanTableView 测试(给定 sheet 渲染表头与首行;invalid 时显示 banner)。
- [ ] Step 2: Run → FAIL。
- [ ] Step 3: 实现 ViewerPage(fetch data + 视角状态)、SheetTabs、CleanTableView(虚拟滚动)、SchemaBanner。
- [ ] Step 4: Run vitest → PASS;`npm run build` 通过。
- [ ] Step 5: Commit `feat(frontend): viewer with clean table view + sheet tabs`。

---

### Task 10: 视角 A — Univer 渲染原始 Excel

**Files:**
- Create: `frontend/src/components/ExcelView.tsx`; Modify: `ViewerPage.tsx`(挂载 ExcelView)

**Interfaces:**
- Consumes: `api.rawUrl(id)`(fetch ArrayBuffer)。
- Produces: ExcelView 用 Univer + `@univerjs-pro`/社区 xlsx 导入(若 import 受限,退化为用后端 `/data` 喂 Univer 表格数据)挂载到容器,展示 Excel 质感网格、sheet 标签、样式;csv 退化为普通网格。

- [ ] Step 1: 实现 ExcelView:初始化 Univer 实例,加载工作簿;选用可用的 xlsx 加载方式(优先 `@univerjs/preset-sheets-core` + import 插件;不可用则把 `/data` 的 sheets 转成 Univer workbook data)。
- [ ] Step 2: 在 ViewerPage 接线,默认视角 = Excel 原样式。
- [ ] Step 3: `npm run build` 通过;手动 `npm run dev` 验证渲染。
- [ ] Step 4: Commit `feat(frontend): excel-faithful view via Univer`。

---

### Task 11: 端到端联调 + 部署配置 + 文档

**Files:**
- Create: `backend/Dockerfile` 或 `Procfile`, `railway.json`/`railway.toml`, 根 `README.md`(运行说明), `backend/.env.example`, `frontend/.env.example`
- Modify: README 写本地启动与 Railway 部署步骤。

- [ ] Step 1: 本地起后端(`uvicorn app.main:app --reload`)+ 前端(`npm run dev`),手动跑通 BDD 场景:上传 `数据库下载结果.xlsx` → 双视角 → 多 sheet 切换 → 上传 `.txt` 被拒。
- [ ] Step 2: 写 Dockerfile(后端)+ Railway 配置 + 持久卷挂载说明;前端 build 由后端 StaticFiles 托管或单独说明。
- [ ] Step 3: 写 README(架构、启动、部署、测试命令)。
- [ ] Step 4: Run 后端全量 `python -m pytest -v` 与前端 `npm run test` + `npm run build`,确认全绿。
- [ ] Step 5: Commit `chore: deployment config + docs`;merge feature 分支到 main。

---

## Self-Review

- **Spec 覆盖**:上传(T5/T8)、保存到磁盘+元数据(T4)、list/raw/data(T5)、schema 校验(T2,T3,T9 banner)、规范化(T3)、双视角(T9 视角B / T10 视角A)、多 sheet(T3/T9)、错误处理 415/413/422/404(T5/T8)、设计令牌(T6)、BDD 验收(T11)、测试(各任务)、部署(T11)。全部有任务对应。
- **占位符**:无 TBD/TODO;各任务含具体接口签名与命令。
- **类型一致**:`SheetData` 字段(name/columns/rows/schemaValid/issues)在 T3 定义,T5/T7/T9/T10 一致引用;`FileRecord` 字段在 T4 定义,T5 一致。
- **风险点**:T10 Univer 的 xlsx 导入路径不确定 → 已写明退化方案(用 `/data` 转 Univer workbook data),保证视角 A 始终可渲染。
