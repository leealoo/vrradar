# VR Radar Lite

本地运行的 XR/VR/AR/智能眼镜行业标题收集和选题筛选工具。它保存标题、中文翻译、链接、来源、发布时间、标签、收藏状态和删除标记，不保存正文内容。

## 功能

- 添加、启用、停用 RSS 或普通网页信息源
- 手动或计划任务抓取 RSS/网页标题
- RSS 使用源内发布时间；普通网页会进入文章详情页解析发布时间，解析失败时用抓取时间并在界面标注
- 只抓取最近 3 天发布的标题，并自动跳过数据库中已存在的标题/链接
- 自动按公司和主题打标签
- 在页面中维护标签关键词和常用搜索词
- 手动对历史标题重新打标签
- 按日期、标题关键词、公司、主题筛选
- 收藏、批量收藏、批量取消收藏
- 删除标题时采用软删除：前端隐藏并标记 `deleted`，不会物理删除数据库记录
- 导出 Markdown：
  - 今日标题池
  - 本周收藏标题
  - 按公司分类的标题

## 本地启动

```bash
npm install
npm run prisma:generate
npm run template-db
npm run dev
```

打开 `http://localhost:3000`。

Windows 上也可以先运行：

```cmd
setup-env.bat
quick-test.bat
```

## 每天自动抓取

项目提供了本地刷新脚本：

```bash
npm run refresh
```

可以用 cron 或系统计划任务每天执行一次。例如每天 09:00：

```bash
0 9 * * * cd /home/originflow/VRRadar && npm run refresh
```

## Windows 安装包

Windows 桌面版使用 Electron 承载本地 Next.js 服务和前端窗口：

```bash
npm install
npm run dist:win
```

生成的安装包位于 `dist/`。安装后会创建 Windows 计划任务 `VR Radar Lite Daily Refresh`，默认每天 09:00 执行静默抓取：

Windows 用户也可以直接运行：

```powershell
.\scripts\package-windows.ps1
```

或双击/运行：

```cmd
scripts\package-windows.cmd
```

```bash
"VR Radar Lite.exe" --refresh-only
```

第一版不做代码签名，Windows 可能显示未知发布者提示。SQLite 数据库默认放在用户数据目录，也可以在应用“设置”页修改数据目录，修改后重启生效。

## Windows 本地打包脚本

项目根目录提供几个常用 `.bat`：

- `setup-env.bat`：初始化环境，安装依赖、生成 Prisma Client、推送数据库结构。
- `quick-test.bat`：启动本地开发服务并打开 `http://localhost:3000`。
- `build-unpacked.bat`：只生成 unpacked 桌面版，输出到 `dist\win-unpacked`。
- `build-exe.bat`：先生成 `dist\win-unpacked`，再尝试生成 portable 单文件 EXE。
- `build-portable.bat`：直接尝试生成 portable 单文件 EXE，失败时尝试 NSIS。

只需要 unpack 版本时运行：

```cmd
build-unpacked.bat
```

输出入口：

```text
dist\win-unpacked\VR Radar Lite.exe
```
