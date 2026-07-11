---
title: 制冷理论基础-R454C的蒸发饱和温度计算
author: YooyoJin
date: 2026-07-10
last_modified_at: 2026-07-10
category: Jekyll
layout: post
mermaid: true
---

客户要上R454C冷媒（非共沸的制冷剂），我们软件里原来处理饱和温度的逻辑都是按R32这类冷媒写的——一个压力丢进去，查表出来一个温度，完事。但R454C不能这么搞。

## 1. R454C冷媒

[制冷理论基础中](./2025-07-01-refrigeration_basics.html)，我们也提到了露点、泡点的概念。对于单一制冷剂来说`露点温度 = 泡点温度 = 饱和温度`。
- 泡点温度，液体刚开始沸腾的那一刻的温度;
- 露点温度， 最后一滴液体刚好蒸发完的那一刻的温度。

所以，像我们常见R32、R134A、R410A，都属于近共沸冷媒，我们一个压力，对应一个饱和温度。但是像R454C这类R4开头的，基本都是混合制冷剂，这类制冷剂大多都是非共沸的（R410A除外，属于近共沸混合制冷剂），意味着一个压力对应两个饱和温度（泡点、露点），差好几度。

**Q：为什么会产生两个饱和温度？**<br>
**A**：因为配方不一样的，R454C是由21.5%的R32 + 78.5%的R1234yf混合出来的，不是纯制冷剂。主要问题在于：R32和R1234yf的沸点不一样，R32沸点-51.7℃，R1234yf沸点：-29.5℃。所以R32更容易沸腾（沸点低），R1234yf更难沸腾（沸点高）。加热时R32先跑，剩下液体里R1234yf占比越来越高，沸点也跟着往上走，等全部蒸发完，温度已经升了四五度了。

## 2. 软件计算

现在我们需要计算高、低压饱和温度，手上有两张表（露点表、泡点表），怎么用？

简单来说针对R454C冷媒，低压（吸气测）用露点，高压测（排气测）用泡点。
- 因为低压饱和温度（蒸发温度），咱们是用来控制电子膨胀阀的，要保证冷媒全都变成气体，防止压缩机液机。这样的话我们就应该用露点表！如果用泡点表，换算出来的蒸发饱和温度偏低，导致过热度大，电子膨胀阀开阀，导致，液体进压机！！所以低压理论上走露点表。
- 高压饱和温度（冷凝温度）主要用于过冷度计算，高压液管里已经是液态冷媒，液态饱和温度对应泡点。用露点算过冷度会偏小好几度，虽然不影响控制安全，但会误导系统工程师判断系统状态。

```cmd
上层调用 GetDewTemp(Ad) → 拿到℃
        ↓
内部：压力→查表→温度（℃）
```

最后，制冷剂的物理特性表也不用我们自己去算，不是简单的线性公式能搞定的，网上找一下[^1]，Ctrl C/V下。

## 参考资料

[^1]: Honeywell Advanced Materials. (2023). _Honeywell Solstice 454C Technical Data Sheet_. [https://prod-edam.honeywell.com/content/dam/honeywell-edam/pmt/oneam/en-us/refrigerants/documents/pmt-am-solstice-454c-technical-data-sheet.pdf](https://prod-edam.honeywell.com/content/dam/honeywell-edam/pmt/oneam/en-us/refrigerants/documents/pmt-am-solstice-454c-technical-data-sheet.pdf)