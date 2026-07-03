# VR Radar Lite

本地运行的 XR/VR/AR/智能眼镜行业标题收集和选题筛选工具。它只保存 RSS 条目的标题、链接、来源、发布时间、标签、收藏状态和备注，不抓取正文。

## 功能

- 添加、启用、停用 RSS 或普通网页信息源
- 手动或计划任务抓取 RSS/网页标题
- 自动按公司和主题打标签
- 在页面中维护标签关键词和常用搜索词
- 手动对历史标题重新打标签
- 按日期、标题关键词、公司、主题筛选
- 收藏标题并添加人工备注
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
