# 5198 风格验真工作台发布

2026-10-07 UTC 10:03:29，产品提交 `5c17847` 静态发布至：

- 工作台：https://wutiantian.cn/agent-trust/#/workspace
- 图片包：https://wutiantian.cn/agent-trust/resources/intro-images.zip
- 演示 PDF：https://wutiantian.cn/agent-trust/resources/intro-16x9.pdf

新 release：`frontend-20261007T100259Z`；前版 `frontend-20261007T093426Z` 已保留。31 个构建文件 SHA 与本地一致，HTTPS 下载的介绍资源、源码、Excel、壁纸、影片和入口 JS/CSS 已核验。后端、业务目录、数据库位置、进程 PID、Nginx 和其他网站均未修改。

官方 CUA / 当前 Mac 浏览器检查：新总览正常加载、显示线上实际 9 条历史观测摘要，资源链接对应生产子路径，开始验收打开真实服务面板，关闭后回到总览。没有为验证新 UI 伪造线上记录。

本轮使用用户选定的正常开发与测试流程；既有 Harness 文件不变。具体测试见 TRUST-WORKSPACE-20261007.md；部署回执位于被 git 忽略的 docs/deployment/trust-workspace-20261007.json。
