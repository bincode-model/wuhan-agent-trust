# 江城验真

本仓库是江城验真原项目提交 `f4327b2` 的可移植源码快照，包含完整前后端源码、依赖锁文件、测试、媒体和演示材料。仓库地址：<https://github.com/bincode-model/wuhan-agent-trust>。

该快照不含完整 Git 历史、本机交付工具、编辑器钩子、Harness 门禁配置和生产部署凭据；原项目的本机配置及历史未被修改。业务目录中名为 Harness 的运行规则仍保留。演示 PDF 仅去除 ASCII85 外层编码，页面尺寸、8 页原图像素与绘制内容均保持一致。 `docs/` 中旧发布记录的文件 SHA 与核验结论对应当时的线上发布版本，不代表本次可移植副本；原记录作为历史来源保留。

面向汉客松赛题一「Agent 公共信誉与服务验收」的独立项目。先探测服务是否可用，再按明确约定检查交付，保留可下载、可重放的本实例履约观测，帮助使用者理解选择理由。

部署目标：<https://wutiantian.cn/agent-trust/>。线上状态见发布核验记录。 本项目有独立源码、后端进程和 SQLite 数据目录；不依赖另一参赛项目运行，也不修改原西安网站。

## 解决的问题

- 注册或自我介绍不能证明服务能工作：向固定公开 RPC 发出真实只读请求，记录响应和失败。
- 返回 JSON 不代表交付合格：逐项检查链身份、finalized 时效、回执覆盖、区块关联和采集耗时。
- 只有成功率难以判断可靠性：同时展示去重样本总数、通过、拒绝、提供商和可复核证据。
- 重复点击可能刷大分母：同一提供商、快照、规则版本、验收判定及失败项只保留首次同结果观测；无交付错误按错误类型与五分钟时间桶去重。通过变过期、缺项或超时的判定变化仍会留档。

## 当前可以运行

PublicNode 已启用。每次读取 Ethereum Mainnet 一个 finalized 区块，最多采样前 3 笔交易及回执。所有检查通过才选中服务；实时失败返回拒绝并保存失败观测，不替换成模拟成功。LlamaRPC 因来源站证书异常暂时禁用，`auto` 当前只遍历 PublicNode，因此不宣称已经验证多提供商切换。

页面可导出 JSON 证据并离线重放。健康、过期和缺回执三种合成示例单独运行，不进入真实账本。目录包括 **12 项 Skills、4 个工具岗位、8 条 Harness 规则**；岗位是确定性 Python 职责，没有接入大模型。

验收窗口为区块年龄 −30 至 1800 秒、采集耗时不超过 16000 ms。这些是本项目公开的技术演示约定，不是对提供商整体可用率或商业 SLA 的承诺。重复读取有 30 秒缓存，显示原始采集时点。

## 工作台与项目介绍（2026-10-07）

首页点击“进入验真工作台”进入 `#/workspace`。二级界面沿用本机 5198 参考页的钛金壁纸、真实玻璃组件、黑色灵动岛与控制中心布局，业务仍使用本项目现有接口。点击六个入口分别进入真实探测、观测记录、合成规则实验、回执复核、Skills 清单和实现边界；关闭按钮或 Esc 返回总览。场景影片保留在 `#/scene`。

- [8 张项目介绍原图](public/resources/intro-images.zip)：全部由 Codex 内置 image_gen 生成，说明痛点、验收流程、规则与当前实现范围。
- [精确 16:9 演示 PDF](public/resources/intro-16x9.pdf)：8 页，原图完整放入 1920×1080 页面。
- 原图为工具自然输出 1672×941（近似 16:9）；不宣称工具未披露的模型子版本。没有将合成示例包装成真实部署成效。
- [本轮测试及参考记录](docs/TRUST-WORKSPACE-20261007.md)。本轮按用户明确选择进行正常开发与测试；原项目的既有 Harness 配置保持原样；本快照未打包这些本机交付工具，不宣称完整 Harness 认证。

## 本地启动

需要 Python 3.9+、Node.js 22.12+。后端使用 Python 标准库。

```bash
npm install
python3 -m server.main --port 8774 --data-dir ./data
```

另开终端运行 `npm run dev`，访问 <http://127.0.0.1:5201/>。开发模式仅允许指定本地来源；本地运行不要设置生产 `PUBLIC_ORIGIN`。

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

生产后端启动方式：

```bash
PUBLIC_ORIGIN=https://wutiantian.cn python3 -m server.main --port 8774 --data-dir /独立数据目录
```

由反向代理将 `/agent-trust/api/` 映射到 `127.0.0.1:8774/api/`，静态站点使用构建出的 `dist/`。运行时须包含 `public/resources/catalog.json`。数据库 `observations.sqlite3` 必须放在本项目独立、可写的数据目录中。服务只监听回环地址。

## 验证与材料

- `tests/test_backend.py`：HTTP 来源和体积限制、真实与模拟隔离、SQLite 持久化与去重、错误快照拒绝、摘要与规则重放；本次 24 项测试通过。
- `tests/live-probe-result.json`：2026-10-06 本地实际 PublicNode 探测，区块 26132778，3/3 回执，3229 ms，验收及重放通过。它是带时间的历史样本，不是当前服务表现。
- [Skills Excel](public/resources/skills.xlsx) · [CSV](public/resources/skills.csv) · [JSON 目录](public/resources/catalog.json)
- [API 约定](docs/api-contract.json) · [官方赛题映射](docs/requirements-map.md)

## 实现边界与来源

本项目只提供单实例观测，不提供跨主体验证、全球公共信誉、抗女巫、签名身份、ERC-8004 互操作或链上登记。SHA-256 和规则重放检查内部一致性，无法单独证明 RPC 事实、组织身份或独立验收。服务表现也不能由一次注册或少量样本外推。

赛题依据：[汉客松 S1 & ETH Wuhan 2026 选手手册](https://tokenark.feishu.cn/docx/Vn3hdD7s6okrftx9583cYgganMg)。本项目选择其中服务探测、交付验收和履约历史方向，具体阈值由项目定义。数据接口依据：[Ethereum JSON-RPC](https://ethereum.org/en/developers/docs/apis/json-rpc/)。RPC 校验与回执重放思路在此前武汉原型基础上独立实现；没有保留八行业展陈与1066项规划清单作为本项目能力。


## 独立交付

网页页脚提供本项目的可编辑 PPT、PDF、使用说明和独立源码下载。源码包排除运行数据库、部署凭据和其他项目内容；在干净目录执行 `npm ci` 后可单独构建。`source.zip` 是按需生成文件，未包含在 GitHub 快照中。需要完整的源码下载入口时，在本地运行 `python3 scripts/package-source.py` 后再执行 `npm run build`；仅运行构建命令不会自动生成源码下载包。


## 2026-10-07 前端迭代与来源披露

本轮范围由作者确认：先做前端与无需凭据的整改。新版候选聚焦可读字号、主操作、结果与证据层级、立体流程卡片、移动端与低动效适配。发布状态以本轮门禁和部署回执为准。

| 分类 | 内容 | 来源与边界 |
| --- | --- | --- |
| 本轮之前已有 | 固定 Ethereum RPC 工具、规则校验、证据下载及重放、Skills 清单 | 延续 2026-10-06 独立项目；不把旧功能计作本轮新增 |
| 本轮新增 | 前端信息架构、字号体系、可控制的 3D 流程卡片、资料入口、整改披露 | 本仓库实现；动画是流程示意，不是模型运行或真实交易直播 |
| 视觉参考 | Verdikt 的单一主任务；Scam Shield 的证据账本；FinancialFocus 提示词中的卡片空间运动 | 参考站仅借鉴设计思路；本次原视频来自用户提示词2，不复制银行卡信息、支付记录或业务结论 |
| 已有第三方组件 | React、Vite、Lucide、Motion；玻璃着色器改编自 liquid-glass-js | 保留依赖锁文件、原始许可证及 public/licenses/liquid-glass-js-MIT.txt |

参考链接：[Verdikt](https://verdikt.shadrakbessanh.me/) · [Scam Shield](https://scam-shield-rouge.vercel.app/ledger) · [Three.js CSS 3D 官方示例](https://threejs.org/examples/css3d_periodictable.html)。本轮卡片使用 CSS 3D，不声称引入了 Three.js。

## 后续接入与待验证事项

大模型角色、跨主体签名与链上信誉登记尚未接入。未部署 BOT Chain 合约，未产生主网交易，也不能据此宣称覆盖 BOT Chain 分赛道或获得晋级资格。钱包地址代表可控制的链上账户，本身不保证真实身份、可信服务或抵御女巫攻击。质押和罚没需要明确的争议裁决与退出规则，不作为已实现能力宣传。

多来源交叉校验、真实服务切换、内部调用与地址标签仍以代码和真实执行证据为准，未做的保持待办。测试通过数只反映已执行范围。

本轮前端完善不等同于完成整份参赛整改清单。组队口径、官方截止时间、奖励与合约网络要求应以主办方当前确认结果为准；诊断文件中的建议不能替代官方通知。

完整交付 Harness 与页面里的业务运行规则为两套不同记录。开发、验证、验收和上线分别记录，不能互相替代。

### 本次追加：提示词 2 / 提示词 3

首页采用提示词2的三幕全屏视频，滚轮下翻到下一幕、上翻回到上一幕，连续惯性不会重复跳页。提示词3的双图鼠标光圈、1800px滚动影片及末端行业场景位于 `#/scene` 场景页。文案分别对应两项武汉比赛赛题。原工作台、记录、Skills/Agent/Harness、证据与下载统一放在 `#/workspace` 工作台；换页保留业务状态。三段原视频经官方浏览器下载并本地压缩，滚动影片用无信用卡品牌的科技场景；双层行业图保留桌面和移动WebP。来源和具体适配见 docs/SCENE-DESIGN-20261007.md，素材哈希见 docs/SCENE-ASSETS-20261007.json。概念视觉不代表运行成果，大模型与链上接入状态不变。
