# 个人展示网站技术设计文档

> A-E 实现状态（2026-10-16）：内容管理、IndexedDB 文件、头像/PDF/封面、完整备份导入导出、静态发布包、响应式与操作反馈均已实现。41 项自动测试通过，并完成真实浏览器恢复与隔离静态构建验收。Node 版本为 24.13.1，代码启用 strict。源码已推送至 https://github.com/oberon316/personal-portfolio 的 main 分支；Cloudflare 正式上线尚未执行。上传验证见 docs/verification/GITHUB_UPLOAD.md。

> 首次内容准备（2026-10-16）：实际通过后台保存资料和文件、导出完整备份及发布 ZIP，并将发布内容合并到 public。公开版包含 8 项技能、2 个项目和 2 个静态文件引用；私人简历原件及备份留在项目仓库外。记录见 docs/verification/FIRST_RELEASE.md。

版本：v1.0 草稿；日期：2026-10-16。

## 1. 技术栈

| 层次 | 方案 | 说明 |
| --- | --- | --- |
| UI | React + TypeScript | 组件化和类型检查 |
| 构建 | Vite | 开发服务器，生产输出 dist |
| 样式 | 普通 CSS / CSS Modules | 不强制额外 UI 框架；需要时再配置 Tailwind |
| 路由 | React Router，BrowserRouter | 前台、预览、后台分离 |
| 数据校验 | Zod | 表单、JSON 导入、静态发布数据校验 |
| 文本草稿 | localStorage | JSON 格式，小体积结构化内容 |
| 文件草稿 | IndexedDB，可使用 idb | 保存头像、PDF Blob |
| 压缩包 | JSZip | 导入备份和导出静态发布包 |
| 服务端与数据库服务 | 无 | src/api 是浏览器存储适配层 |
| 托管 | GitHub + Cloudflare Pages | main 分支更新触发生产部署 |

Node.js 使用符合所选 Vite 版本要求的版本。本地与 Cloudflare 保持一致，并在 `.node-version` 记录已验证的具体版本。提交 package-lock.json。

## 2. 目录结构

```text
personal-portfolio/
├── PRD.md
├── TECH_DESIGN.md
├── AGENTS.md
├── README.md
├── package.json
├── package-lock.json
├── .gitignore
├── .node-version
├── index.html
├── public/
│   ├── data/site.json
│   └── uploads/                  # 已发布头像、简历、项目封面
├── src/
│   ├── api/                      # getPublished、getDraft、saveDraft、assets 等
│   ├── components/               # 导航、技能卡片、项目卡片、上传控件
│   ├── layouts/                  # PublicLayout、AdminLayout
│   ├── pages/                    # Home、ProjectDetail、Preview、admin/*
│   ├── storage/                  # localStorage 和 IndexedDB 封装
│   ├── schemas/                  # Zod schema
│   ├── types/                    # TypeScript 数据类型
│   ├── utils/                    # 文件处理、备份、发布导出
│   ├── styles/
│   ├── App.tsx
│   └── main.tsx
└── tests/                        # 关键数据链路测试
```

public 中的文件构建后位于站点根目录，例如 `public/data/site.json` 对应 `/data/site.json`，浏览器 URL 不含 `public`。

## 3. 数据模型

```ts
type AssetRef =
  | { kind: 'public'; url: string; name: string }
  | { kind: 'local'; id: string; name: string };

interface Profile {
  name: string;
  title: string;
  tagline: string;
  bio: string;
  education: string;
  email: string;
  githubUrl?: string;
  avatar?: AssetRef;
  resume?: AssetRef;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  proficiency: string;
  order: number;
}

interface Project {
  id: string;
  title: string;
  period: string;
  summary: string;
  role: string;
  highlights: string[];
  techStack: string[];
  cover?: AssetRef;
  repoUrl?: string;
  demoUrl?: string;
  visible: boolean;
  order: number;
}

interface SiteData {
  schemaVersion: 1;
  contentVersion: string;
  updatedAt: string;
  profile: Profile;
  skills: Skill[];
  projects: Project[];
}

interface StoredAsset {
  id: string;
  blob: Blob;
  name: string;
  mime: string;
  size: number;
  updatedAt: string;
}
```

`schemaVersion` 管理数据结构变化；`contentVersion` 标识发布内容版本。生成 ID 可使用 crypto.randomUUID。初始静态文件使用公开资源引用，缺失资源使用占位状态，不编造个人资料。

## 4. 存储与统一接口层

阶段 B 写入接口为 updateProfile、saveSkill、saveProject、deleteSkill、deleteProject、moveSkill、moveProject。组件经数据上下文调用这些接口，不直接访问 localStorage。修改从最新草稿合并，排序按全局 order 上移/下移并归一化为连续整数，删除与排序立即保存。前台技能按分类展示，分类出现顺序取该类第一条技能的 order，类内也按 order 排序。

同一适配器的写入按队列执行，失败不阻塞后续操作；编辑与删除可携带原始条目以拒绝过期覆盖。此设计不是跨标签页原子事务，不支持多人实时协作。读取 schema 兼容既有未完善条目，保存项目表单时额外要求项目时间、简介、职责与至少一项技术栈。编辑文字保留已有头像、简历和封面引用。

- localStorage key：`portfolio:draft:v1`。仅保存 SiteData 草稿，不保存 Blob、登录密码或部署凭据。
- IndexedDB 数据库：`portfolio-assets`；object store：`assets`，keyPath 为 id。
- 可选演示登录态放 sessionStorage，只是界面状态，不代表服务端授权。
- 所有页面通过 src/api 读写，不在组件中散落存储调用。

已实现的文件与备份接口（内容 CRUD 接口另见上文）：

```ts
getPublished(): Promise<SiteData>
getDraft(): Promise<SiteData>
saveDraft(data: unknown): Promise<SiteData>
resetDraft(): Promise<SiteData>
readAsset(ref: AssetRef, role: AssetRole): Promise<StoredAsset>
saveProfileAsset(role: 'avatar' | 'resume', file: Blob, name: string, expected?: AssetRef | null): Promise<SiteData>
removeProfileAsset(role: 'avatar' | 'resume', expected?: AssetRef | null): Promise<SiteData>
saveProjectCover(id: string, file: Blob, name: string, expected?: AssetRef | null): Promise<SiteData>
removeProjectCover(id: string, expected?: AssetRef | null): Promise<SiteData>
removeUnusedAssets(): Promise<number>
exportBackup(): Promise<Blob>
importBackup(file: Blob): Promise<SiteData>
exportPublishBundle(): Promise<Blob>
```

首次 getDraft 无缓存时从发布版深拷贝。读取发布版使用 `fetch('/data/site.json')` 并检查状态、内容类型和 Zod 解析结果；失败显示错误，不能把错误页面当作有效数据。保存异常必须向 UI 返回错误。

## 5. 前台与草稿隔离

- `/` 和项目详情读取发布版，保证所有访客看到一致的静态内容。
- `/admin/*` 和 `/preview` 读取本机草稿。
- 保存后更新共享状态，预览打开后重新读取草稿。跨标签同步文字可监听 storage 事件；文件变更使用广播或在页面重新聚焦时重读。
- 预览明显标注本机草稿及“发布后对所有访客生效”。不得把保存成功显示为发布成功。
- localhost、正式域名、部署预览域名属于不同 origin，需要导出、导入迁移草稿。

## 6. 头像与简历处理

1. input[type=file] 获取 File；检查扩展名、MIME 与体积。
2. 头像通过解码验证并压缩，再写 IndexedDB；PDF 检查 `%PDF-` 文件头后保存原始二进制。
3. 文件写入成功后更新草稿的 AssetRef；草稿写入失败时旧引用保持可恢复。
4. 本机预览时从 IndexedDB 读取 Blob，临时创建 object URL。
5. 组件卸载或替换文件时 revokeObjectURL；URL 本身不写入数据库或 JSON。
6. 发布资源直接使用 `/uploads/文件名`。删除引用时延迟清理不再使用的本机 Blob，不能误删其他项目的资源。
7. 下载简历使用当前有效 Blob 或同源静态 URL，设置正确文件名，验证下载文件能打开。

实际模块：src/storage/assets.ts 使用 idb，文件批量写入为 IndexedDB readwrite 事务；src/utils/media.ts 负责体积、扩展名、MIME、魔数、图片解码和压缩。浏览器未声明 MIME 时按文件头规范化，头像最长边 512px，封面 1600px，不放大小图。页面经 src/api 写入，先暂存全新 ID 的文件，再提交文字引用；文字提交失败会尽力删除本次暂存文件，保留旧草稿和旧文件。两类浏览器存储之间不是原子事务，意外中断可能留下未引用文件，但不会主动先删旧资源。移除只解除引用，用户可在设置中确认清理旧文件。

## 7. 备份与静态发布导出

备份包与发布包用途不同，但都要包含恢复内容需要的全部文件。

备份包：`backup.json` 保存草稿及资源映射，`assets/` 保存二进制。若草稿仍引用静态文件，也需把这些同源文件读出并打包，导入时统一恢复为本地资源。导入前校验版本、路径、JSON 结构、引用完整性、文件类型与解压体积，失败不得损坏现有草稿。

发布包内容：

```text
publish-bundle.zip
├── data/site.json
└── uploads/
    ├── avatar-<唯一标识>.webp
    ├── resume-<唯一标识>.pdf
    └── project-<唯一标识>.webp
```

导出时：

1. 校验必填字段与每个资源引用。
2. 读取本地 Blob 和保留的同源静态资源，使用安全且唯一的文件名，完整放入 uploads。
3. 将所有 local 引用转换为 public 引用，URL 为 `/uploads/...`。
4. 更新 contentVersion 和 updatedAt，验证发布 JSON 不含 local 引用、blob URL 或本机绝对路径。
5. 打包生成 ZIP；任何资源缺失均中止导出并指出字段，不输出残缺发布包。

备份实际清单为 `{ format: 'portfolio-backup', version: 1, exportedAt, data, assets }`。assets 中声明 id/path/name/mime/size；导出时将所有公开和本地资源都打包为 assets 下的文件，并统一为本地引用，导入时再次生成新 ID。恢复无需访问原域名，也能用于恢复损坏的文字草稿。

导入限制：压缩包最多 55 MiB、解压总量 50 MiB、最多 130 个 ZIP 条目、backup.json 最多 1 MiB。src/utils/zipSafety.ts 在解压前检查中央目录与本地文件头，拒绝路径穿越、重复路径、加密、ZIP64、异常大小及重叠范围；随后 JSZip 校验 CRC32，Zod 校验版本/结构，检查所有引用、文件大小和类型，并解码图片。全部通过后才写入。文件存储事务或文字提交失败时保留原内容；生成失败不会下载残缺包。

JSZip 所在模块动态导入，普通页面无需先加载压缩功能。发布前对项目时间、简介、职责、技术栈进行完整性校验，并禁止 local/blob/本机路径。scripts/check-content.ts 在每次生产构建前校验 public/data/site.json 及所有资源真实存在、类型正确；也可以传入解压目录独立检查。

用户将 ZIP 内容合并到项目 public 目录，不创建 `public/public`。随后构建、提交、推送。浏览器下载 ZIP 本身不会修改仓库，也不会自动发布。

## 8. 路由与 Cloudflare Pages

BrowserRouter 管理 `/admin` 等路径。Cloudflare Pages 在没有顶层 404.html 时提供默认 SPA 回退；不生成 `public/404.html`，未知页面由 React 显示。上线后必须直接访问并刷新 `/admin/profile` 和项目详情进行验证。

部署配置：生产分支 main；构建命令 `npm run build`；输出目录 `dist`；根目录为 package.json 所在目录。框架预设选择 React (Vite) 或相应 Vite 预设，仍以实际构建命令和输出目录为准。Node 版本与本地一致。不需要服务端环境变量、数据库连接、Cloudflare Functions 或 Worker。

## 9. 错误与安全边界

- 表单与导入 JSON 使用 Zod 校验；链接限制允许协议；不直接渲染不可信 HTML。
- 头像不允许任意 SVG，避免引入主动内容；PDF 只作文件下载/受浏览器控制的预览，不执行其内容。
- 处理 storage quota、浏览器存储禁用、损坏 JSON、IndexedDB 失败、缺失文件、网络失败。
- 恢复草稿、删除项目、导入覆盖均需确认；若本机写入中途失败，应保留旧数据或提供回滚。
- 演示登录无法提供真正的权限保护，修改前端状态可绕过。公开版本只能通过有权限的仓库提交改变。

## 10. 验证计划

必要命令：`npm run lint`、`npm test`、`npm run build`、`npm run preview`。build 依次执行 check:content、TypeScript 和 Vite。完整实测见 docs/verification/CDE.md，测试用发布内容仅存在于 tmp 隔离副本，主 public 目录保留明确占位内容。

自动化优先覆盖数据校验、存储错误、资源引用转换、导出导入往返。人工端到端覆盖资料修改、技能项目 CRUD、头像刷新持久化、PDF 下载、清空后恢复、发布后干净浏览器读取、路由刷新及手机布局。不要以本机已有草稿能显示作为发布成功证据。

## 11. 官方参考

- https://vite.dev/guide/
- https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/configuration/build-image/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
