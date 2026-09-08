#!/usr/bin/env python3
"""
LLM 自动起草双周简报。

流程：
  1. 计算下一期期号（扫描根目录与 legacy/ 的 wN-N.html，取最大周数 +1/+2）
  2. 读取最新采集素材 data/raw/*.json + 上一期 legacy/w*.html 作为结构模板
  3. 调用 OpenAI 兼容接口生成新期 HTML
  4. 结构校验（必需标记缺失则失败退出，不产出文件）
  5. 写入 legacy/w{N}-{N+1}.html

环境变量：
  LLM_API_KEY   必填，API 密钥（GitHub Secrets 配置）
  LLM_BASE_URL  可选，默认 https://api.moonshot.cn/v1
  LLM_MODEL     可选，默认 kimi-k2.6（256K 上下文；moonshot-v1 系列已于 2026-08-31 下线）

选项：
  --dry-run     只生成 prompt 预览（data/raw/prompt-preview.md），不调用 API
  --issue 37-38 指定期号，默认自动计算
"""

import argparse
import glob
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
REQUIRED_MARKERS = [
    'id="tab-iq"', 'id="tab-jo"', 'id="tab-lb"',
    'ov-list', 'kpi', 'ch-card', 'ni-title', 'top-meta', 'retro-date',
]
MAX_ITEMS_IN_PROMPT = 80
MAX_TEXT_LEN = 400


def next_issue():
    weeks = []
    for pattern in ("w*-*.html", "legacy/w*-*.html"):
        for f in glob.glob(str(ROOT / pattern)):
            m = re.match(r"w(\d+)-(\d+)\.html", Path(f).name)
            if m:
                weeks.append((int(m.group(1)), int(m.group(2))))
    if not weeks:
        raise SystemExit("未找到任何 wN-N.html，无法推算下一期期号")
    latest = max(weeks, key=lambda w: w[1])
    return latest, (latest[1] + 1, latest[1] + 2)


def latest_file(pattern):
    files = sorted(glob.glob(str(ROOT / pattern)))
    return files[-1] if files else None


def load_raw_items():
    path = latest_file("data/raw/2*.json")
    if not path:
        raise SystemExit("未找到采集素材，请先运行 scripts/collect.py")
    data = json.load(open(path, encoding="utf-8"))
    items = data.get("items", [])[:MAX_ITEMS_IN_PROMPT]
    for it in items:
        if it.get("text") and len(it["text"]) > MAX_TEXT_LEN:
            it["text"] = it["text"][:MAX_TEXT_LEN] + "…"
    print(f"素材：{Path(path).name}，共 {len(data.get('items', []))} 条，取前 {len(items)} 条")
    return items


def build_prompt(issue, template_html, items):
    today = datetime.now()
    period_start = today - timedelta(days=14)
    period = f"{period_start.year}年{period_start.month}月{period_start.day}日 — {today.year}年{today.month}月{today.day}日"
    w1, w2 = issue
    system = (
        "你是伊拉克代表处 MSSD AI 团队的情报分析师，负责撰写面向伊拉克、约旦、黎巴嫩市场的 ICT 双周决策简报。"
        "你的输出是一份完整的 HTML 文件，结构与上一期简报完全一致，只更新内容。"
    )
    user = f"""请基于以下素材，撰写第 W{w1}-{w2} 期双周简报（统计周期：{period}，今日：{today.year}年{today.month}月{today.day}日）。

【硬性要求】
1. 输出且仅输出一个完整 HTML 文件，不要输出任何解释文字，不要用 Markdown 代码围栏包裹。
2. 完整保留模板中的全部 CSS、JS、页面骨架与页脚结构，仅替换内容区域。
3. 必须保留这些结构标记（构建系统依赖）：id="tab-iq" / id="tab-jo" / id="tab-lb" 三个国家面板、ov-list 决策总览列表、kpi 指标卡、ch-card 栏目卡 + ni 新闻条目（ni-title / ni-date / ni-text / ni-src / opp-box）、top-meta 头部信息、retro-date 周期标注。
4. top-meta 中的日期更新为 {today.year}年{today.month}月{today.day}日；页面标题与期号更新为 W{w1}—{w2}；retro-date 更新为统计周期。
5. 全部正文使用简体中文；引用外文素材时翻译为中文，保留原始链接到 ni-src。
6. 只采用与三国 ICT / 通信 / 数字化 / 网络安全 / 政商环境相关的素材，丢弃无关条目（如社会新闻、体育、娱乐）；素材不足时如实减少条目数，禁止编造新闻、数据或链接。
7. 商机信号放入 opp-box；无法交叉验证的条目使用 unverified 徽标。
8. KPI 数字必须与实际内容条目数一致。

【采集素材（JSON，含 platform/source/country/title/text/url/date）】
{json.dumps(items, ensure_ascii=False, indent=1)}

【上一期简报 HTML（结构模板，内容需全部替换为本期）】
{template_html}
"""
    return system, user


def call_llm(system, user):
    api_key = os.environ.get("LLM_API_KEY")
    if not api_key:
        raise SystemExit("缺少 LLM_API_KEY 环境变量（请在 GitHub Secrets 配置）")
    base = (os.environ.get("LLM_BASE_URL") or "https://api.moonshot.cn/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL") or "kimi-k2.6"
    print(f"调用 LLM：{base} / {model}")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        # 流式输出：长 HTML 生成耗时数分钟，非流式请求长时间无数据会被断开。
        "stream": True,
        # 不显式设置 max_tokens：让模型用剩余上下文生成长 HTML，
        # 输出被截断时结构校验会失败并阻断流程。
    }
    # 部分模型（如 kimi-k3）只允许 temperature=1，默认不传该参数；
    # 需要覆盖时通过 LLM_TEMPERATURE 环境变量指定。
    if os.environ.get("LLM_TEMPERATURE"):
        payload["temperature"] = float(os.environ["LLM_TEMPERATURE"])

    attempts = 3
    for attempt in range(1, attempts + 1):
        try:
            return _stream_chat(base, api_key, payload)
        except requests.HTTPError as e:
            resp = e.response
            # 模型不接受自定义 temperature：移除后重试
            if resp is not None and resp.status_code == 400 and "temperature" in resp.text and "temperature" in payload:
                print("模型不接受自定义 temperature，移除该参数后重试")
                payload.pop("temperature")
                continue
            # 模型不存在/无权限时，列出账号当前可用模型，方便直接修正 LLM_MODEL
            if resp is not None and resp.status_code in (400, 404):
                try:
                    models = requests.get(
                        f"{base}/models",
                        headers={"Authorization": f"Bearer {api_key}"},
                        timeout=30,
                    ).json()
                    ids = [m.get("id") for m in models.get("data", [])]
                    print(f"账号当前可用模型：{ids}", file=sys.stderr)
                except Exception:  # noqa: BLE001
                    pass
            body = resp.text[:500] if resp is not None else str(e)
            raise SystemExit(f"LLM 调用失败 {resp.status_code if resp is not None else ''}: {body}")
        except (requests.ConnectionError, requests.Timeout, requests.ChunkedEncodingError) as e:
            print(f"第 {attempt}/{attempts} 次请求连接中断：{e}", file=sys.stderr)
            if attempt == attempts:
                raise SystemExit("LLM 连接多次中断，请稍后重跑；若持续失败可尝试将 LLM_BASE_URL 改为 https://api.moonshot.ai/v1（国际站）")
            time.sleep(10 * attempt)


def _stream_chat(base, api_key, payload):
    """流式调用 chat/completions，持续接收数据保持连接存活，返回完整文本。"""
    resp = requests.post(
        f"{base}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        stream=True,
        timeout=(30, 120),  # 连接 30s；每个数据块间隔不超过 120s
    )
    if resp.status_code != 200:
        raise requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
    chunks, received = [], 0
    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            break
        try:
            delta = json.loads(data)["choices"][0].get("delta", {}).get("content")
        except (json.JSONDecodeError, KeyError, IndexError):
            continue
        if delta:
            chunks.append(delta)
            received += len(delta)
            if received % 20000 < len(delta):
                print(f"  已接收 {received} 字符…")
    text = "".join(chunks)
    print(f"流式接收完成，共 {len(text)} 字符")
    if not text:
        raise SystemExit("LLM 返回为空")
    return text


def extract_html(text):
    text = text.strip()
    m = re.search(r"```(?:html)?\s*(<!DOCTYPE.*?)```", text, re.S | re.I)
    if m:
        text = m.group(1)
    start = text.lower().find("<!doctype")
    if start == -1:
        start = text.lower().find("<html")
    if start == -1:
        raise SystemExit("LLM 输出中未找到 HTML 内容")
    return text[start:].strip()


def validate(html):
    missing = [m for m in REQUIRED_MARKERS if m not in html]
    if missing:
        raise SystemExit(f"结构校验失败，缺少标记：{missing}")
    if len(html) < 20000:
        raise SystemExit(f"结构校验失败：HTML 过短（{len(html)} 字符），疑似截断")
    print(f"结构校验通过（{len(html)} 字符）")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--issue", help="指定期号，如 37-38")
    args = parser.parse_args()

    latest, nxt = next_issue()
    w1, w2 = map(int, args.issue.split("-")) if args.issue else nxt
    print(f"上一期：W{latest[0]}-{latest[1]} → 本期起草：W{w1}-{w2}")

    template_path = latest_file("legacy/w*-*.html")
    template_html = open(template_path, encoding="utf-8").read()
    print(f"结构模板：{Path(template_path).name}")

    items = load_raw_items()
    system, user = build_prompt((w1, w2), template_html, items)

    if args.dry_run:
        out = ROOT / "data" / "raw" / "prompt-preview.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            f.write(f"# SYSTEM\n\n{system}\n\n# USER\n\n{user}")
        print(f"[dry-run] prompt 已写入 {out.relative_to(ROOT)}（{len(user)} 字符），未调用 API")
        return

    html = extract_html(call_llm(system, user))
    validate(html)

    out_path = ROOT / "legacy" / f"w{w1}-{w2}.html"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"已生成 {out_path.relative_to(ROOT)}")

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a") as f:
            f.write(f"issue=w{w1}-{w2}\n")


if __name__ == "__main__":
    main()
