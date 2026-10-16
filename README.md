# 个人作品集与本机内容管理

React + TypeScript + Vite 纯前端个人展示网站。A-E 开发已完成：个人信息、教育、技能、项目详情、联系方式、后台管理、头像与 PDF 简历、项目封面、完整备份、静态发布包及响应式布局。使用普通 CSS，没有服务器、数据库服务或新增运行时依赖。

已根据网站所有者提供的简历完成首次静态内容准备：姓名、学生身份、175 字介绍、教育、公开邮箱、8 项技能、2 个项目、原证件照及隐去四项信息的公开版 PDF 已合并到 public。项目未提供的指标和链接留空。详见 [首次静态内容验证](docs/verification/FIRST_RELEASE.md)。源码已上传至 [oberon316/personal-portfolio](https://github.com/oberon316/personal-portfolio) 的 main 分支，见 [上传验证记录](docs/verification/GITHUB_UPLOAD.md)。Cloudflare Pages 尚未部署，暂无正式网站地址。

## 启动

已验证 Node.js **24.13.1**，记录在 `.node-version`。

```powershell
npm.cmd ci
npm.cmd run dev
```

打开终端打印的 Local 地址。已有依赖时直接 `npm.cmd run dev`。浏览期间保持终端运行，按 Ctrl+C 停止。

## 页面入口

| 地址 | 功能与数据来源 |
| --- | --- |
| `/` | 公开首页，只读取静态发布内容 |
| `/projects/:id` | 公开项目详情；隐藏或未发布的项目不可见 |
| `/preview` | 本机草稿预览，含当前头像、简历、技能与项目 |
| `/preview/projects/:id` | 草稿详情，后台可预览隐藏项目 |
| `/admin` | 内容数量、编辑与预览入口 |
| `/admin/profile` | 个人信息、教育、联系方式、头像和 PDF 简历 |
| `/admin/skills` | 技能增删改、删除确认、上移/下移排序 |
| `/admin/projects` | 项目增删改、排序、展示开关与封面管理 |
| `/admin/settings` | 完整备份、导入恢复、静态发布包、重置及旧文件清理 |

未知地址显示站内 404。管理入口是本机编辑界面，没有模拟安全登录或服务端认证。

## 编辑与文件管理

1. 在个人信息页修改文字，点击“保存到本机”。姓名和身份为必填，邮箱与链接填写时会校验。
2. 技能名称、分类为必填；上移、下移立即保存顺序。
3. 项目名称、时间、简介、个人职责及技术栈为必填。技术栈支持逗号/换行，亮点每行一项。
4. 在个人信息页选择头像或 PDF，文件选择后自动保存，不必再点文字保存。
5. 在项目列表展开“管理项目封面”，上传、替换或移除封面。
6. 打开 `/preview` 检查结果。公开首页不会被本机保存直接改动。

| 文件 | 输入限制 | 处理 |
| --- | --- | --- |
| 头像 | JPEG/PNG/WebP，最多 2 MiB | 解码验证，最长边压缩至 512px |
| 项目封面 | JPEG/PNG/WebP，最多 5 MiB | 解码验证，最长边压缩至 1600px |
| 简历 | 真实 PDF，最多 10 MiB | 检查扩展名、可用的 MIME 与文件头，保留原文件字节 |

错误类型、超限、空文件、解码失败或存储失败会显示错误并保留旧引用。移除文件前需确认，移除后草稿立即保存。下载简历会先确认文件可读，避免把错误 HTML 当成 PDF 下载。

## 本机存储边界

- 小体积文字保存在 localStorage，key 为 `portfolio:draft:v1`。
- 头像、PDF、封面 Blob 保存在 IndexedDB 数据库 `portfolio-assets` 的 `assets` store。
- JSON 中只保存稳定资源引用，不持久化 blob URL 或大文件 Base64。
- localhost、127.0.0.1、不同端口、正式域名分别保存自己的草稿，不自动同步。
- 清除浏览器数据可能丢失内容，请及时导出完整备份。
- 同页写入排队，按最新草稿合并；过期编辑会提示重新载入。多个标签页不是原子事务，也不提供多人协作。

## 完整备份和恢复

在“管理设置 → 备份与发布”点击 **导出完整备份 ZIP**。备份包含全部文字和被引用的头像、PDF、封面，也会将当前引用的公开静态文件打包，不依赖原域名。

```text
portfolio-backup-....zip
├── backup.json
└── assets/
    ├── <id>.webp
    └── <id>.pdf
```

恢复时选择这个 ZIP，点击“导入此备份”，核对文件名，再点击“确认导入”。当前草稿和文件引用将被替换，公开版本不会改变。导入前建议先备份当前内容。

导入校验版本、结构、ZIP 路径与大小、CRC32、引用完整性、文件类型和图片可解码性。最大压缩包 55 MiB，解压总量 50 MiB，清单 1 MiB，最多 130 个 ZIP 条目。失败不会先删除原草稿；有效备份也可恢复损坏的文字存储。静态发布 ZIP 不能用作完整备份导入。

文件替换/移除及导入后，旧文件暂留于 IndexedDB。确认当前草稿和备份可用后，可使用“清理旧文件”回收未引用文件；操作需再次确认，不删除当前草稿正在引用的文件。

## 发布静态内容

1. 填写真实资料、上传文件，在 `/preview` 核对。
2. 在设置页点击 **导出静态发布 ZIP**。
3. 解压后，将 `data` 和 `uploads` 合并到本项目 `public` 目录，覆盖 `public/data/site.json`。
4. 不要创建 `public/public`，不要只复制 JSON 而遗漏文件。
5. 构建并预览，再提交 GitHub，让 Cloudflare Pages 重新部署。

```text
public/
├── data/site.json
└── uploads/
    ├── <id>.webp
    └── <id>.pdf
```

```powershell
npm.cmd run build
npm.cmd run preview
```

生产构建会先检查静态 JSON 以及每个引用文件是否存在、大小和类型是否有效。使用未访问过后台的新浏览器/无痕窗口检查首页、头像、封面、简历下载和项目详情刷新。确认无误后：

```powershell
git add public
git commit -m "Update portfolio content and files"
git push
```

发布包是静态内容更新包，不是完整网站源码，也不会自动修改仓库或发布站点。请保留源码、设计文档与完整备份。

## GitHub 与 Cloudflare Pages

本项目使用仓库 `https://github.com/oberon316/personal-portfolio.git`，生产分支为 `main`。本地已初始化 Git 并设置 origin，后续更新在项目根目录执行：

```powershell
git add .
git commit -m "Update personal portfolio"
git push origin main
```

使用 Git 凭据管理器完成登录，不把 Token 放到源码或远程 URL。提交源码、三个文档、锁文件与公开静态资源；node_modules、dist、tmp、日志和环境密钥已忽略。私人备份放在仓库外。

Cloudflare 中进入 Workers & Pages → Pages → 连接 Git，选择目标仓库：

| 配置 | 值 |
| --- | --- |
| 生产分支 | main |
| 框架 | React (Vite) / 对应 Vite 预设 |
| 构建命令 | npm run build |
| 输出目录 | dist |
| 根目录 | package.json 所在目录，位于仓库根则留空 |
| Node | 24.13.1，与 .node-version 一致 |

不要添加顶层 `public/404.html`，让 Pages 的默认 SPA 行为支持 React 深层路由；上线后直接访问并刷新 `/admin/profile` 与项目详情检查。部署后把真实仓库和正式网址补充到这里，并准备作业截图。

## 检查和测试

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

`build` 执行静态内容校验、strict TypeScript 和 Vite；`test` 使用 Node 自带测试运行器。目前 41 项测试通过。

独立检查一个已解压的发布目录（目录内应有 data 与 uploads）：

```powershell
npm.cmd run check:content -- "你的解压目录"
```

完整 CDE 实测见 [验证记录](docs/verification/CDE.md)。使用测试图片/PDF验证了实际上传、刷新/重开、完整备份跨来源恢复、发布包隔离构建、干净来源显示与下载；未将测试履历写入主 public 目录。

## 代码结构

```text
src/api/                 统一文字、文件、备份与发布接口
src/storage/             localStorage、IndexedDB 适配
src/schemas/             Zod 校验与发布约束
src/types/               数据类型
src/data/                数据上下文与刷新订阅
src/hooks/               操作反馈、临时文件 URL 生命周期
src/components/          表单、文件管理、图片、下载与通用组件
src/pages/               前台、详情、后台页面
src/layouts/             独立前后台布局
src/utils/               文件验证、压缩、ZIP 安全、备份转换与下载
src/styles/              普通 CSS、响应式与减少动态效果支持
scripts/check-content.ts 构建前验证静态文件
tests/                   内容、文件、恢复、导出及故障测试
public/                  当前公开数据和资源
```

产品约定见 PRD.md、TECH_DESIGN.md、AGENTS.md。可选博客与星空未加入本期必做范围。
