# 第 8 节：上传 GitHub

日期：2026-10-16。目标仓库：[oberon316/personal-portfolio](https://github.com/oberon316/personal-portfolio)，生产分支 main。

## 实际执行

1. 核实目标仓库为现有公开空仓库，本地项目尚未初始化 Git。
2. 在项目根目录初始化 main，设置 origin 为指定仓库。提交身份使用 oberon316 及该 GitHub 账号对应的 noreply 邮箱，未修改全局身份设置。
3. 提交完整源码、PRD.md、TECH_DESIGN.md、AGENTS.md、README、package-lock.json、测试、验证截图及 public 中的公开数据、头像和脱敏 PDF。
4. 确认 node_modules、dist、tmp、环境文件被忽略；未提交备份 ZIP、私人简历原件或 PDF 处理临时文件。检查暂存文件未发现凭据模式或私人手机号；公开 PDF 的文件哈希与此前通过检查的版本一致。
5. 首次源码提交为 [42ab30f](https://github.com/oberon316/personal-portfolio/commit/42ab30f8a8fe75ef4e01cbedefb5d392212bddb2)，包含 92 个文件。
6. 原代理连接发生 HTTP 408 / TLS 传输错误，核对远程尚无 main 后，采用直连和 TLS 证书校验成功推送。没有强制推送，也没有关闭证书校验。后续 GitHub 直连和证书校验仅设置在本仓库 .git/config，不修改全局代理或证书配置。
7. 通过 git ls-remote 和 GitHub REST API 核对首次远程提交 SHA 与本地相同，并逐项比较远程文件树与本地跟踪文件，全部匹配。随后提交本上传记录及文档状态更新。

## 上传前实际检查

| 命令或检查 | 结果 |
| --- | --- |
| npm.cmd run lint | 退出码 0 |
| npm.cmd test | 41 项通过、0 失败 |
| npm.cmd run build | 静态内容检查、TypeScript 及生产构建通过 |
| git diff --cached --check | 通过 |
| 暂存范围及公开 PDF 检查 | 通过；排除私人原件、备份、依赖、构建输出和临时目录 |

## 后续

本地 main 跟踪 origin/main。后续修改后执行 git add、git commit、git push。Cloudflare Pages 尚未部署，因此这里没有正式网站域名。下一阶段可在 Cloudflare 连接本仓库 main，构建命令 npm run build，输出目录 dist，Node 24.13.1。

FIRST_RELEASE.md、CDE.md 等历史记录中的未上传状态描述的是当时阶段，当前上传状态以本记录和 README 为准。
