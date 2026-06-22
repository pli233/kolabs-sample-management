# Data Feeds 导航 + 全英文 UI 设计文档

- **日期**:2026-06-22
- **状态**:已确认,待实现
- **范围**:在现有「上传 + 数据表查看器」之上引入左侧导航(Dashboard / Data Feeds)+「活动数据源(active feed)」概念,并把整个 UI 改为英文。

---

## 1. 背景与目标

当前 app 是一个带搜索/筛选/排序/分页/schema 校验的 Excel 查看器,路由为 `/`(上传 + 历史)和 `/files/:id`(按文件查看)。

**本期目标**:
1. 把顶部 header 改成**左侧固定侧边栏**,两个导航:**Dashboard** 与 **Data Feeds**。
2. 引入「**data feed**」概念:每个上传的 xlsx 是一个 data feed;其中一个是**活动源(active feed)**,作为系统当前数据库;Dashboard 与所有表格操作都基于活动源。
3. 上传新 feed 后**自动设为活动源**。
4. 整个界面文案改为**英文**(中文仅用于沟通)。

**非目标(YAGNI)**:老脚本的业务能力(盒号汇总、QC 抽样、aliquot 推荐、扫描对账)、跨文件查询、删除 feed。

---

## 2. 关键决策(已确认)

| 决策 | 结论 |
|---|---|
| Dashboard 展示哪个数据 | 当前**活动源(active feed)** |
| 活动源存储 | **服务端全局单例**(SQLite),所有会话共享 |
| 上传新文件 | 自动设为活动源,然后跳 Dashboard |
| 切换活动源 | 在 Data Feeds 页点 "Set active" |
| `/files/:id` 路由 | 收起,统一走活动源模型 |
| 语言 | 全英文 UI |
| 导航命名 | **Dashboard** / **Data Feeds** |

---

## 3. 后端设计

### 3.1 活动源存储
新增极简键值表(SQLModel):

```
class AppSetting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str
```

`active_file_id` 作为 key 存储。helper:`get_active_file_id() -> int | None`、`set_active_file_id(id)`。

### 3.2 接口
| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/active-feed` | 返回 `{ active: FileMeta \| null }`(活动源元数据;若指向已不存在的文件则返回 null) |
| PUT | `/api/active-feed` | body `{ file_id }`;校验文件存在 → 设为活动源 → 返回 `FileMeta`;不存在 → 404 |

### 3.3 上传时自动激活
`POST /api/files` 在成功创建 `FileRecord` 后,调用 `set_active_file_id(record.id)`,使新上传的 feed 立即成为活动源。

---

## 4. 前端设计

### 4.1 布局:SidebarLayout
左侧固定侧边栏(深色,沿用 `--midnight`),顶部 logo「Kolabs」,下面两个导航项:
- **Dashboard**(表格图标)→ `/dashboard`
- **Data Feeds**(上传/数据库图标)→ `/feeds`

当前路由高亮(primary 色)。右侧内容区。窄屏不做复杂折叠(YAGNI),侧边栏保持可见。

### 4.2 路由
| 路径 | 页面 |
|---|---|
| `/` | 重定向 `/dashboard` |
| `/dashboard` | **DashboardPage** |
| `/feeds` | **DataFeedsPage** |

`/files/:id` 与 `ViewerPage` 移除,逻辑并入 `DashboardPage`。

### 4.3 DashboardPage
- `GET /api/active-feed` → 若 `active` 为 null → 空状态:"No active data feed yet — upload or select one in Data Feeds" + 跳 `/feeds` 的按钮。
- 否则:页头显示活动 feed 文件名 + 状态徽章 + 主表名,下面渲染现有 `DataTableView fileId={active.id}`(搜索/筛选/排序/分页/列控制全部保留)。

### 4.4 DataFeedsPage(原 UploadPage)
- 顶部:`Dropzone`(英文文案)上传 xlsx/xls/csv。
- 下方:feeds 列表(`GET /api/files` + `GET /api/active-feed`):
  - 每行:文件名、sheet 数/主表/大小/时间、状态徽章。
  - 活动的那条显示 **Active** 徽章;其余显示 **Set active** 按钮 → `PUT /api/active-feed` → 刷新列表(或跳 Dashboard)。
- 上传流程:上传 → 多 sheet 则 `SheetPicker` 选主表 → `PUT /api/active-feed`(后端上传已自动设,这里前端确认后直接)→ 跳 `/dashboard`。

### 4.5 全英文文案(关键映射)
| 现有中文 | 英文 |
|---|---|
| 上传样本库文件 | Upload a data feed |
| 拖拽文件到这里,或点击选择 | Drag a file here, or click to choose |
| 支持 .xlsx / .xls / .csv,单文件最大 50MB | .xlsx / .xls / .csv · up to 50 MB |
| 仅支持 .xlsx / .xls / .csv 文件 | Only .xlsx / .xls / .csv files are supported |
| 最近上传 | Recent feeds |
| 个工作表 / 主表「X」 | sheets · primary "X" |
| 选择要查看的工作表 | Choose the primary sheet |
| 确认并查看 / 处理中… | Confirm / Working… |
| 搜索所有列(全表)… | Search all columns… |
| 清除搜索 | Clear search |
| 匹配 X / 共 Y 行 · Z 列 | X of Y rows · Z cols |
| 仅载入… / 载入中… | Loading… |
| 列 (n/总) / 显示的列 / 重置 | Columns (n/total) / Visible columns / Reset |
| 筛选 / 按列筛选 | Filter |
| 全部条件 / 任一条件 | Match all / Match any |
| 添加条件 / 清除全部 / 完成 | Add condition / Clear all / Done |
| 运算符:包含/不包含/等于/…/为空/非空 | contains / does not contain / equals / … / is empty / is not empty |
| 没有匹配「X」的行 | No rows match "X" |
| 主表符合 / 主表列不符 / 主表未识别 | Schema OK / Column mismatch / Unrecognized |
| 符合主库 / 接近·列有差异 / 其他·辅助表 | Matches schema / Close · column diffs / Other sheet |
| 该工作表不是主库结构…… | This sheet doesn't match the schema (auxiliary/summary); shown as-is, not validated. |
| 该工作表接近主库结构,但有以下列不符…… | Close to the schema but these columns differ: |
| 缺少列/多出列/列顺序不符 | missing / extra / wrong order |
| 返回上传 | (移除,改为侧边栏导航) |
| 正在查看工作表 / 正在载入数据… | Viewing sheet / Loading data… |
| 设为活动源 / Active | Set active / Active |

页面 `<html lang>` 改 `en`,标题改 "Kolabs Sample Management"。

### 4.6 API 客户端
- `api.getActiveFeed(): Promise<{ active: FileMeta | null }>`
- `api.setActiveFeed(id): Promise<FileMeta>`

---

## 5. 数据流

- Dashboard:`GET /active-feed` → id → `DataTableView` 拉 `/rows`。
- Data Feeds:`GET /files` + `GET /active-feed` → 列表带 Active 徽章/Set active。
- 上传:`POST /files`(后端自动设活动)→ SheetPicker(多 sheet)→ 跳 Dashboard。

---

## 6. 错误/空状态
- 无 feed:Data Feeds 突出 dropzone;Dashboard 空状态 + 去 Data Feeds 链接。
- 活动源指向不存在文件:`GET /active-feed` 返回 null,Dashboard 进空状态。
- 设置不存在的 file_id:`PUT` 返回 404。

---

## 7. BDD 验收场景

```gherkin
Feature: Data Feeds navigation and active feed

  Scenario: Sidebar navigation
    Given I open the app
    Then I see a left sidebar with "Dashboard" and "Data Feeds"
    And "/" redirects to the Dashboard

  Scenario: Uploading a feed makes it active
    Given I am on Data Feeds
    When I upload a data feed (and pick its primary sheet if multi-sheet)
    Then it becomes the active feed
    And the Dashboard shows that feed's table

  Scenario: Switching the active feed
    Given two feeds exist
    When I click "Set active" on the non-active feed in Data Feeds
    Then it is marked "Active"
    And the Dashboard now shows that feed

  Scenario: Dashboard with no feed
    Given no feed has been uploaded
    When I open the Dashboard
    Then I see an empty state linking to Data Feeds

  Scenario: All UI text is English
    Then every label, button, and message in the app is in English
```

---

## 8. 测试策略
- **后端 pytest**:`GET/PUT /active-feed`、上传自动激活、`PUT` 不存在文件 → 404、活动源指向不存在文件 → null。
- **前端 Vitest**:SidebarLayout 两个导航 + 高亮;DashboardPage 空状态;DataFeedsPage 显示 Active / Set active;现有组件英文断言更新。
- **Playwright E2E**:上传 → 自动活动 → Dashboard 展示 → Data Feeds 切换活动 → Dashboard 跟随;全英文断言。

---

## 9. 受影响文件(概览)
- 后端:`models.py`(AppSetting + helpers)、`routes.py`(active-feed 接口 + 上传自动激活)、`tests/test_api.py`。
- 前端:`App.tsx`→SidebarLayout、`main.tsx`(路由)、`pages/UploadPage`→`DataFeedsPage`、`pages/ViewerPage`→`DashboardPage`、`components/{Dropzone,RecentFiles→FeedList,SheetPicker,DataTableView,FilterPanel,SchemaBanner}`、`lib/{api,match}`、`index.html`、测试与 e2e。
