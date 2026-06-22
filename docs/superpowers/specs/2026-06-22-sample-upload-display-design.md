# 样本库文件上传与双视角展示 — 设计文档

- **日期**:2026-06-22
- **状态**:已确认,待写实现计划
- **范围**:Kolabs 实验室样本可视化管理的**第一个需求** —— 上传 Excel/CSV 文件并以两种渲染视角展示。
- **方法论**:Behavior-Driven Development(BDD)。

---

## 1. 背景与目标

这是一个生物样本库(biorepository)管理系统。lab manager 习惯用 Excel、无技术基础,需要一个 Web 工具:把库存文件上传保存,并用两种「渲染风格」查看同一份数据。

**本期目标**:跑通最小展示闭环 —— 上传 → 保存到后端 → 双视角展示。

**非目标(YAGNI,留给后续需求)**:登录鉴权、在线编辑、recharts 图表/可视化、值映射与业务转换、主库以外的 schema、服务端查询/筛选/排序。

---

## 2. 关键决策(已与用户确认)

| 决策点 | 结论 |
|---|---|
| 两个视角的含义 | 数据与功能**完全相同**,仅渲染风格不同。视角 A = 还原 Excel 原样式;视角 B = 优化后的干净表格。 |
| 文件是否保存 | **保存到后端**。 |
| 原始文件存储 | **本地磁盘**(`uploads/`),部署到有持久磁盘的平台。 |
| 后端语言 | **FastAPI (Python)**,解析用 openpyxl。 |
| 架构方案 | **方案 1**:薄后端(存储 + 校验),前端渲染两个视角。 |
| 视角 A 渲染 | 前端 **Univer**(浏览器版电子表格,Excel 质感:网格线、列标、sheet 标签、合并单元格、颜色)。 |
| 视角 B 数据 | **后端**用 openpyxl 解析 + **轻量规范化 + 按固定列 schema 校验**,返回 JSON,前端渲染。 |
| schema | **多套预定义 schema 架构**,但本期**只实现主库(43 列)那一套**,其余以后逐个补。 |
| 元数据存储 | SQLite(文件型,配持久磁盘)。 |
| 文件大小上限 | 50MB。 |
| 部署平台 | Railway(持久卷)。worktree → merge main → push GitHub。 |
| 设计令牌 | 跟随 kolaboratory.com 品牌(见 §7)。 |

---

## 3. 技术栈与目录结构

**前端**:Vite + React + TypeScript + Tailwind + shadcn/ui + react-dropzone + Univer + @tanstack/react-virtual。(recharts 留给后续需求,本期不引入。)

**后端**:FastAPI + uvicorn + openpyxl + SQLite(SQLModel/SQLAlchemy)。

```
backend/
  app/
    main.py            # FastAPI app + 路由
    storage.py         # 文件存盘 / 读取 / 列表(存储层抽象)
    parsing.py         # openpyxl 解析 + 轻量规范化
    schemas/
      registry.py      # schema 注册表(可扩展)
      main_library.py  # 本期唯一:主库 43 列 schema
    models.py          # SQLite 元数据模型
  uploads/             # 原始文件(gitignore)
  app.db               # SQLite(gitignore)
  tests/               # pytest,用 data/数据库下载结果.xlsx 作夹具
frontend/
  src/
    pages/UploadPage.tsx
    pages/ViewerPage.tsx
    components/Dropzone.tsx
    components/ExcelView.tsx     # 视角 A:Univer
    components/CleanTableView.tsx# 视角 B:shadcn + 虚拟滚动
    components/SheetTabs.tsx
    lib/api.ts
    styles/tokens.css            # Kolaboratory 设计令牌
docs/superpowers/specs/
data/
  数据库下载结果.xlsx           # 本需求唯一相关样本(测试夹具)
```

> `data/` 下的 `单次扫描结果.xls`、`保存新tube的location.xlsx` 属于**其他需求**,本期不处理。

---

## 4. 后端设计

### 4.1 接口

| 方法 | 路径 | 作用 | 返回 |
|---|---|---|---|
| POST | `/api/files` | multipart 上传 → 存盘 → 识别 schema → 规范化+校验 → 记元数据 | `{ id, original_filename, sheet_count, schema_type, validation }` |
| GET | `/api/files` | 列出已上传文件元数据(首页「最近上传」) | `[{ id, original_filename, size, sheet_count, uploaded_at, validation_status }]` |
| GET | `/api/files/{id}` | 单文件元数据详情 | 同上单条 |
| GET | `/api/files/{id}/raw` | 原始文件字节流(视角 A / Univer) | `application/octet-stream` |
| GET | `/api/files/{id}/data` | 解析+清理后的 JSON(视角 B) | `{ sheets: [{ name, columns, rows, schemaValid, issues }] }` |

### 4.2 元数据模型(SQLite)

`FileRecord`:`id`、`original_filename`、`stored_path`、`size`、`content_type`、`sheet_count`、`schema_type`(如 `main_library` / `unrecognized`)、`validation_status`(`valid` / `issues` / `unrecognized`)、`uploaded_at`。

### 4.3 Schema 层(可扩展,本期单 schema)

- `registry.py`:维护 `{schema_name: SchemaDef}`。本期只注册 `main_library`。
- `main_library.py`:主库 43 个有序列名(来自 `数据库下载结果.xlsx`):
  `record_id, project, project_id, sample, type, track_id, aliquot, volume_ul, temp, freezer, shelf, rack, drawer, box_pos, box_type, box, sample_pos, thawed, date_thawed, date_shipped, source, date_frozen, obs, cryobank, not_in_box, empty_shipped, zika_project, at_yale, sent_collaborator, date_shipped_collab, date_returned, thawed_aliq, volume_alert, soroteca_yale_complete, shipment_date, shipment_box, shipment_position, volume_sent, current_volume, institution_name, researcher_name, shipping_notes, shipment_data_complete`
- **匹配**:上传时逐 schema 比对文件中 sheet 的表头。命中 → `schema_type = main_library`;都不命中 → `unrecognized`。
- **校验**:对每个 sheet,比对表头与 schema → 产出 `issues`(缺列 / 多列 / 顺序不符)。校验**不阻断**保存与查看。

### 4.4 轻量规范化(per sheet)

- 去单元格首尾空格;空单元格统一为 `null`;日期/数字类型归一(ISO 日期字符串 / number);丢弃全空行。
- 多 sheet:`/data` **按 sheet 分别返回**;每个 sheet 带 `schemaValid` 与 `issues`。主库文件中与主 schema 不符的辅助 sheet(如仅 7 列的 `Sheet1`)照常返回数据,但标 `schemaValid=false`。

---

## 5. 前端设计

### 5.1 首页 `/`

- react-dropzone 的 **drive-box 拖拽区**:接受 `.xlsx / .xls / .csv`,显示上传进度,类型不符即时报错。
- 下方「最近上传」列表(`GET /api/files`),点一项进 viewer。
- 上传成功 → 跳转 `/files/:id`。

### 5.2 Viewer `/files/:id`

- 顶部:文件名 + **ToggleGroup**:`[Excel 原样式 | 优化表格]`。
- 视角下方共享一个 **sheet 选择器(SheetTabs)**(文件多 sheet)。
- **视角 A(ExcelView)**:Univer 挂载 `/raw` 原始文件 → Excel 质感网格、sheet 标签、样式。
- **视角 B(CleanTableView)**:取 `/data` → shadcn `Table` + `@tanstack/react-virtual` 虚拟滚动(上万行不卡);当前 sheet `schemaValid=false` 时顶部挂黄色提示条,列出 `issues`。
- `.csv`:视为单 sheet;视角 A 无原生样式,退化为展示规范化网格。

### 5.3 数据流

上传 → 后端存盘+校验 → 返回 `id` → 跳 viewer → 视角 A 拉 `/raw`、视角 B 拉 `/data`。两视角同数据、无功能差异。

---

## 6. 错误处理

| 情况 | 行为 |
|---|---|
| 不支持的文件类型 | 后端 415;dropzone 提示「仅支持 xlsx/xls/csv」。 |
| 文件损坏 / 解析失败 | 后端 422 + 可读消息;前端提示。 |
| schema 不符 | **仍保存、仍可查看**;viewer 视角 B 挂提示条列出问题,不阻断。 |
| 超过 50MB | 后端拒绝并提示;流式接收避免内存峰值。 |
| 空文件 / 无 sheet | 422 提示。 |

---

## 7. 设计令牌(源自 kolaboratory.com)

写入 `frontend/src/styles/tokens.css` 的 `:root`,并映射到 shadcn 主题变量。

**字体**
- 标题:**Poppins**(品牌主字体)。
- 正文 / 数据表:Inter 或系统 sans(数据密集表格更易读)。

**品牌色**

| 角色 | 值 | 用途 |
|---|---|---|
| Sky Blue | `#0e8ed6` | `--primary`:主按钮、激活态、链接 |
| Cobalt Blue | `#0112b8` | hover / 强调深一档 |
| Midnight Blue | `#010b24` | 深色表面、页头 |
| Text Primary | `#060f1c` | 正文文字 |

**中性阶**

`100 #fff` · `200 #f9fafb` · `300 #f2f4f7` · `400 #d4dce3` · `500 #999fb2` · `600 #4e5561` · `700 #303643` · `900 #060f1c`

**shadcn 映射**:`background #fff` · `card #fff` · `muted #f2f4f7` · `border #d4dce3` · `muted-foreground #4e5561` · `foreground #060f1c` · `primary #0e8ed6` · `primary-foreground #fff`。Univer 视角 A 的外壳尽量套同色系,保持两视角观感统一。

---

## 8. BDD 验收场景

```gherkin
Feature: 上传并以双视角展示样本库文件

  Scenario: 上传合法主库文件
    Given 我在首页
    When 我把 数据库下载结果.xlsx 拖入上传区
    Then 上传成功并跳转到 viewer
    And 默认显示「Excel 原样式」视角,呈现 Excel 质感的网格与 sheet 标签
    And 我能切换到「优化表格」视角,看到规范化后的 43 列数据
    And 我能在多个 sheet 之间切换

  Scenario: 视角间数据一致
    Given 我打开了一个已上传文件的 viewer
    When 我在「Excel 原样式」与「优化表格」之间切换
    Then 两个视角呈现同一份数据,仅渲染风格不同

  Scenario: 列不符的文件
    Given 我上传一个缺列或多列的 xlsx
    Then 文件仍被保存且可查看
    And 「优化表格」视角顶部出现 schema 校验提示,列出问题列
    And 校验提示不阻断我浏览数据

  Scenario: 不支持的文件类型
    When 我拖入一个 .txt 文件
    Then 上传被拒绝
    And 我看到「仅支持 xlsx/xls/csv」的提示

  Scenario: 超大文件
    When 我上传一个超过 50MB 的文件
    Then 上传被拒绝并提示大小超限

  Scenario: 最近上传列表
    Given 我已上传过若干文件
    When 我回到首页
    Then 我看到「最近上传」列表
    And 点击任一项进入其 viewer
```

---

## 9. 测试策略

- **后端 pytest**:以 `data/数据库下载结果.xlsx` 为真实夹具,覆盖上传、openpyxl 解析、规范化、主库 schema 校验、各错误分支(类型/损坏/超限/空文件);schema 校验对缺列/多列文件产出正确 `issues`。
- **前端 Vitest + Testing Library**:Dropzone(接受/拒绝类型)、视角 ToggleGroup 切换、SheetTabs、schema 提示条渲染。
- 端到端(Playwright)留到后续需求再补。

---

## 10. 部署

- **Railway**:持久卷挂载 `uploads/` 与 `app.db`;FastAPI(uvicorn)单服务,可由 `StaticFiles` 直接托管前端构建产物,或前后端分离部署。
- **Git 流程**:worktree 开发 → merge main → push GitHub。
- Vercel 因与「本地磁盘持久化」冲突,本项目不采用。
