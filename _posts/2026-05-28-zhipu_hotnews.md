---
title: 智谱AI简易热点抓取脚本
author: YooyoJin
date: 2026-05-28
last_modified_at: 2026-05-28
category: Jekyll
layout: post
---

拥有了智谱AI的套餐，我也开始摩拳擦掌，跃跃欲试了😏。看着网上有一些claw、agent抓热点，打算用python简易脚本抓抓看。热点抓取思路网上也有很多参考，也问了下AI，看起来是具备可行性的。

我的需求很明确：每天自动抓取嵌入式领域的热点新闻，调用AI进行总结，并发送到我的邮箱。搜索的过程中也看到也有不少扒下来热点自动生成AI垃圾小作文的，有思路的。随着AI普及，看来免不了大家文章或多或少都有AI淡淡的清香。

但是我Python开发经验较少，不过AI还是太！全！面！了！！代码基本是AI写的，遇到问AI同样大力支持，AI思路很清晰，跟我搜索到的也差不多，算是非常顺利，我按它的方法实现了它，我这边记录下过程和踩坑点。

## 1. 完整代码

``` python
#!/usr/bin/env python3
"""
嵌入式热点自动摘取 + 智谱AI总结 + 发送邮件
每天定时运行一次
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.header import Header
from datetime import datetime
import feedparser
import markdown

# 智谱AI配置
from zhipuai import ZhipuAI

# ========== 配置区域（请修改成你自己的）==========
# 智谱API Key - 去 https://open.bigmodel.cn/ 获取
client = ZhipuAI(
    api_key="你的智谱API_Key",  # 就用你现在Cline里配的那个Key
    base_url="https://open.bigmodel.cn/api/coding/paas/v4/"  # 关键：加上这一行！
)

# 邮件配置（使用你的邮箱）
SMTP_SERVER = "smtp.qq.com"         # QQ邮箱用这个，163用 smtp.163.com
SMTP_PORT = 465                     # SSL端口
SENDER_EMAIL = "你的QQ号@qq.com"     # 发件邮箱
SENDER_PASSWORD = "你的16位授权码"    # 邮箱授权码（不是登录密码）
RECEIVER_EMAIL = "你想收邮件的邮箱"    # 收件邮箱

# RSS源列表（嵌入式相关）
RSS_SOURCES = [
    "https://eetimes.com/feed",                    # EE Times
    "https://9to5linux.com/category/news/feed",    # 9to5Linux
    "https://www.cnx-software.com/feed",           # CNX Software
    "https://hackaday.com/blog/feed",              # Hackaday
]

# ========== 1. 抓取RSS热点 ==========
def fetch_embedded_news(limit_per_source=5):
    """从各RSS源抓取最新文章，返回标题列表"""
    all_articles = []

    for url in RSS_SOURCES:
        try:
            feed = feedparser.parse(url)
            source_name = feed.feed.get('title', url.split('/')[2])

            for entry in feed.entries[:limit_per_source]:
                all_articles.append({
                    'title': entry.get('title', '无标题'),
                    'link': entry.get('link', ''),
                    'source': source_name,
                    'published': entry.get('published', '')
                })
        except Exception as e:
            print(f"抓取 {url} 失败: {e}")

    return all_articles

# ========== 2. 调用智谱AI总结 ==========
def summarize_with_zhipu(articles):
    """使用智谱AI对热点进行总结"""

    if not articles:
        return "今日无嵌入式热点更新。"

    # 构造热点文本
    hot_list = []
    for i, art in enumerate(articles[:15], 1):  # 最多15条
        hot_list.append(f"{i}. [{art['source']}] {art['title']}\n   {art['link']}")

    hot_text = "\n".join(hot_list)

    # Prompt设计
    prompt = f"""你是嵌入式领域的专业编辑。下面是今天嵌入式/Linux/电子工程相关的热点新闻标题列表。

请帮我：
1. 从中选出最重要的5-8条
2. 按重要性排序
3. 每条用1-2句话概括核心内容（如果从标题能看出的话）
4. 最后写一段100字左右的总体趋势总结

热点列表：
{hot_text}

请用以下格式输出：
## 📰 今日嵌入式热点（{datetime.now().strftime('%Y-%m-%d')}）

### 重点摘要
（每条：标题 - 核心内容）

### 💡 趋势简评
（总体总结，100字左右）
"""

    try:
        response = client.chat.completions.create(
            model="glm-5.1",  # 免费模型，够用了
            messages=[
                {"role": "system", "content": "你是嵌入式技术领域的专业编辑，擅长提炼科技新闻要点。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )
        summary = response.choices[0].message.content
        return summary

    except Exception as e:
        print(f"智谱API调用失败: {e}")
        # 失败时返回原始热点列表
        return f"AI总结失败，以下是原始热点：\n\n{hot_text}"

# ========== 3. 发送邮件 ==========
# html格式发送
def send_email(markdown_content):
    today = datetime.now().strftime("%Y-%m-%d")
    subject = f"【嵌入式热点日报】{today}"

    html_body = markdown.markdown(
        markdown_content,
        extensions=['extra', 'sane_lists']
    )

    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>嵌入式热点日报</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; line-height: 1.6;">
        {html_body}
        <hr>
        <p style="font-size: 12px; color: #999;">📧 本邮件由嵌入式热点机器人自动生成 | {today}</p>
    </body>
    </html>
    """

    msg = MIMEText(full_html, 'html', 'utf-8')
    msg['Subject'] = Header(subject, 'utf-8')
    msg['From'] = SENDER_EMAIL
    msg['To'] = RECEIVER_EMAIL

    with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, [RECEIVER_EMAIL], msg.as_string())
    print("邮件发送成功！")

# ========== 4. 主函数 ==========
def main():
    print(f"=== 嵌入式热点日报 开始执行 ({datetime.now()}) ===")

    # Step 1: 抓取热点
    print("正在抓取RSS热点...")
    articles = fetch_embedded_news()
    print(f"共抓取到 {len(articles)} 条新闻")

    if len(articles) == 0:
        print("警告：未抓取到任何新闻，请检查RSS源")
        return

    # Step 2: AI总结
    print("正在调用智谱AI进行总结...")
    summary = summarize_with_zhipu(articles)

    # Step 3: 发送邮件
    print("正在发送邮件...")
    send_email(summary)

    print("=== 执行完成 ===")

if __name__ == "__main__":
    main()
```

## 2. 使用步骤
1. 安装依赖
    - pip install feedparser zhipuai  # RSS/Atom信息流的解析器
    - pip install markdown  # Markdown到HTML转换器
1. 获取智谱API Key
    - 智谱有提供GLM-4-Flash免费模型
    - 如果有其他支持模型可以在model变更
1. 配置邮箱授权码
    1. 登录QQ邮箱 → 设置 → 帐户
    1. 找到「POP3/IMAP/SMTP服务」→ 开启
    1. 生成授权码（16位字母），复制保存
1. 修改脚本中的配置
    - api_key = "你的智谱API_Key"
    - SENDER_EMAIL = "你的QQ号@qq.com"
    - SENDER_PASSWORD = "你的16位授权码"
    - RECEIVER_EMAIL = "你想收邮件的邮箱"
1. 测试运行
    py hotnews.py
1. 设置每天自动运行
    schtasks /create /tn "嵌入式热点日报" /tr "python D:\你的python路径\hotnews.py" /sc daily /st 09:00

## 3. 效果展示

设置我收到的markdown版本的邮件，我没有图床不方便展示HTML版本

``` txt
## 📰 今日嵌入式热点（2026-05-28）

### 重点摘要

1. **Necessity is the Mother of Invention: Huawei Replaces Moore’s Law With Her’s Law**
- **核心内容**：面对技术限制，华为提出用“Her定律（系统级架构创新）”取代“摩尔定律”。这标志着半导体行业正从单纯依赖工艺制程微缩，转向通过系统架构与封装协同优化来提升整体算力。

2. **Vicinity Unveils “TRAVE” — AI-Native SDR Platform at 5G-ACIA Frankfurt**
- **核心内容**：Vicinity发布名为“TRAVE”的AI原生软件无线电(SDR)平台。该平台专为5G工业网络设计，将AI能力原生集成于无线基带底层，大幅提升了边缘侧无线通信的智能化与灵活性。

3. **Intelligent, Configurable I/O: Edge Autonomy, Thermal Efficiency, and Higher Uptime in Industrial Control Systems**
- **核心内容**：探讨工业控制系统中智能可配置I/O的最新技术进展。新一代I/O模块不仅优化了热管理效率，还能在边缘侧实现更高的自主决策能力，从而显著提升工业设备的运行时间和可靠性。

4. **MuseLab nanoCH32H417 – A $17 WCH CH32H417 RISC-V MCU development board with USB 3.0, Fast Ethernet**
- **核心内容**：MuseLab推出基于沁恒(WCH) CH32H417 RISC-V芯片的开发板，售价仅17美元。该板卡配备了USB 3.0和快速以太网接口，为高性能、低成本的RISC-V工业级应用提供了极具性价比的开发平台。

5. **ODROID-H5 SBC Review – Part 1: Unboxing, Type1 case assembly, and first boot**
- **核心内容**：社区对备受期待的ODROID-H5单板机进行了详细评测。内容涵盖了新板卡的开箱、定制外壳组装以及首次启动体验，为嵌入式开发者评估新一代SBC性能提供了重要参考。

6. **PolyCast5 – An ESP32-C5 multi-tool remote with dual-band WiFi 6, BLE, ESP-NOW, LoRa, and Infrared Tx/Rx**
- **核心内容**：一款基于乐鑫ESP32-C5芯片的多功能开源遥控器亮相。它集成了双频WiFi 6、蓝牙、LoRa及红外收发等多种无线协议，充分展示了新一代物联网SoC在复杂无线融合应用中的强大潜力。

### 💡 趋势简评
今日的技术热点呈现出**“软硬协同与边缘智能深化”**的显著趋势。宏观上，业界正通过系统级架构创新突破摩尔定律的瓶颈；而在微观应用端，AI正加速向SDR（无线电）和底层工业I/O渗透，赋予边缘设备更强的自主性。同时，RISC-V高性价MCU的普及以及ESP32-C5在多协议无线融合上的突破，正持续降低物联网与智能硬件的开发门槛，推动嵌入式生态向多协议、高算力、低成本方向加速演进。
```

## 常见问题

### 邮件发送失败 `[Errno 11001]`

`SMTP_SERVER = "smtp.qq.com"`，我当时没理解把他改成我邮箱了，他这个是邮箱的服务器地址，根据选择的邮箱修改。可以ping以下是否通，通的话就是正常的。

### 买了套餐却说余额不足

实际上是买了Coding Plan套餐，`base_url`必须用`https://open.bigmodel.cn/api/coding/paas/v4/`，否则报余额不足。

了解了一下，智谱AI有两个主要的平台入口：bigmodel.cn和z.ai（也叫Z.ai）。

bigmodel.cn是面向开发者的，z.ai是面向海外普通用户的聊天的。这到没什么，本来还以为API模型用错了。

实际上他是两套计费系统，我买的Coding Plan套餐，走Coding工具专用通道，走的套餐额度，所以没问题。你的脚本用的是下面的"普通API通道"，走的资源包/余额，而它们已经用完了，所以报"余额不足"。

这样就需要修改Python脚本，把base_url改成Coding Plan专用地址，就可以用套餐额度了。

### 邮件里Markdown不渲染

AI返回的是Markdown，直接发邮件会显示源码，这里解决方案是用markdown库转一下，这里需要安装下`pip install markdown`

### WINDOWS定时任务

`schtasks /create /tn "嵌入式热点日报" /tr "python D:\your_path\hotnews.py" /sc daily /st 09:00`，这条命令可以直接加

加完了直接在开始菜单搜索「任务计划程序」，找到任务计划程序库，里面可以找到增加的嵌入式热点日报程序，也可以直接在这里手动添加。

## 参考资料