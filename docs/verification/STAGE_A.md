# 阶段 A 验证记录

日期：2026-10-16。项目目录：`C:\AITraining\personal-sites\personal-portfolio`。

## 自动检查

- `npm.cmd run lint`：通过，退出码 0。
- `npm.cmd run build`：通过，退出码 0；包含 strict TypeScript 检查与 Vite 生产构建。
- `npm.cmd test`：12 项通过、0 失败。

数据测试包括：静态发布数据校验；首次草稿初始化；重建适配器后的持久化；发布版与草稿隔离；损坏/不兼容数据不覆盖；非法邮箱和链接拒绝；重复 ID 和非法文件路径拒绝；发布版禁止本机资源；容量不足与访问拒绝；HTML 回退和 HTTP 错误；重置失败保留旧值；初始化期间另一标签页的草稿不被覆盖。

## 浏览器实测

使用生产产物 `npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort`，首页 HTTP 200。

1. 在 `/admin/profile` 修改一句话介绍并保存，出现成功反馈。
2. 刷新当前页面，修改内容仍保留。
3. `/preview` 显示该修改与“本机草稿”标识。
4. 返回 `/`，仍显示原始静态内容，确认发布版隔离。
5. `/admin/settings` 重置操作先出现页面内二次确认；取消可退出，确认后恢复发布版。
6. 已恢复测试前的占位草稿，不留下测试履历。
7. 手机后台菜单展开、点击技能管理、跳转后收起正常。
8. 未知路径显示站内 404 与返回入口。
9. 浏览器捕获的 error/warn 日志为空。

七个路由 `/`、`/preview`、`/admin`、`/admin/profile`、`/admin/skills`、`/admin/projects`、`/admin/settings` 均分别在 375、768、1440px 视口下检查了标题与文档宽度，共 21 组，无横向溢出。直接导航及个人信息页刷新成功。

## 实际运行截图

- [桌面管理概览](admin-desktop.jpg)
- [手机技能管理框架](admin-mobile.jpg)
- [桌面公开首页](home-desktop.jpg)

截图均来自本机生产预览，不代表线上部署。QA 临时服务器在检查结束后停止。

## 本阶段限制

技能/项目管理目前为列表与空状态框架，未接入增删改排序；IndexedDB、头像/PDF 上传、备份与静态发布导出尚未实现。尚未初始化 Git，也未上传 GitHub 或部署 Cloudflare。后续阶段完成对应功能后，再验证文件持久化、完整备份恢复和线上发布闭环。
