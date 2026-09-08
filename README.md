# 黎凡特 ICT 情报中心

面向伊拉克、约旦、黎巴嫩市场的双周 ICT 决策情报站。站点使用 Next.js 静态导出，并通过 GitHub Pages 公开部署。

## 功能

- 决策总览：新闻、商机、国家分布、趋势和采集健康度
- 双周简报：三国环境评分、新闻、商业机会及重要官方社媒快讯
- 合规与营商：六维加权评分、国家风险、证据链、监控事项和行动建议
- 政府人员：78 个关键岗位，可搜索、按国家筛选、排序和分页
- 多平台信源：19 个已核验的政府官员、通信部、监管机构及政府账号，覆盖 X、Telegram、Facebook
- 历史归档：保留旧版报告入口

## 技术栈

- Next.js 15（静态导出）
- React 19
- Shadcn 风格组件体系
- Tremor 图表
- TanStack Table
- GitHub Actions + GitHub Pages

## 本地运行

```bash
npm install --legacy-peer-deps
npm run dev
```

数据由 `scripts/sync-data.mjs` 自动识别 `legacy/` 中的最新简报，并将报告、归档、人员清单、`config/sources.json` 多平台信源、`config/social-signals.json` 重要社媒动态以及 `config/compliance-analysis.json` 合规营商分析同步到 `data/`。该脚本在每次构建前自动执行。

## 发布

推送到 `main` 后，`.github/workflows/pages.yml` 会安装依赖、生成静态站点并部署到 GitHub Pages。

## 半自动出刊流水线

`.github/workflows/draft-briefing.yml` 每周一 UTC 06:00 检查是否到出刊时间，到期则自动执行（也可在 Actions 页面手动触发，手动触发会跳过到期检查强制执行）：

1. **采集**：`scripts/collect.py` 抓取 Google News RSS（三国 × ICT 关键词，查询配置见 `config/collection.json`）和 `config/sources.json` 中的 Telegram 公开频道，素材存入 `data/raw/`，单个信源失败不阻断流程，健康度写入 `data/raw/health-*.json`
2. **起草**：`scripts/draft_briefing.py` 调用 LLM（OpenAI 兼容接口），以上一期 `legacy/` 简报为结构模板生成新期 HTML，并通过结构校验（必需标记缺失或输出过短则失败中止）
3. **审阅**：自动推送 `auto/briefing-wN-N` 分支并创建 PR，人工核对内容真实性、链接、KPI 数字后合并
4. **部署**：合并到 `main` 触发 `pages.yml` 自动上线

### 所需配置

| 位置 | 名称 | 说明 |
|---|---|---|
| Secrets | `LLM_API_KEY` | **必填**，LLM API 密钥（如 Moonshot/Kimi API Key） |
| Variables | `LLM_BASE_URL` | 可选，API 地址，默认 `https://api.moonshot.cn/v1` |
| Variables | `LLM_MODEL` | 可选，模型名，默认 `kimi-k2.6`（256K 上下文；注意 `moonshot-v1` 系列已于 2026-08-31 下线，可选用 `kimi-k3` 等当前在售模型） |

### 本地调试

```bash
pip install feedparser beautifulsoup4 lxml requests
python scripts/collect.py                  # 采集素材到 data/raw/
python scripts/draft_briefing.py --dry-run # 预览 prompt，不调用 API
LLM_API_KEY=sk-xxx python scripts/draft_briefing.py  # 实际生成 legacy/wN-N.html
```

### 已知边界

- X（Twitter）信源需付费 API，暂未自动采集；Facebook 公开主页抓取受限，保留人工
- LLM 生成内容必须经人工审阅后合并，请勿直接信任数字与引述
- GitHub Actions 定时任务可能有数十分钟延迟，对双周频率无影响

© 2026 伊拉克代表处 · 李辉 00621351 · MSSD AI 团队
