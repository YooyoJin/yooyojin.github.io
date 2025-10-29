---
title: 草稿页
author: YooyoJin
date: 2022-02-06
category: Jekyll
layout: post
mermaid: true
---

## 博客BUG

1. 标题H1重复，导致bing无法成功收录
1. google 搜索图标异常
1. 博客搜索界面跳转存在异常，如果在本页面搜索本页面的内容将无法跳转，仍会跳转到搜索页面
1. 目前文章通过侧边栏展示内容目录，但是所有内容没有分类，完全的机载一起，后续是否可以增加一个档案页面，将内容分类并以目录的形式可以跳转到指定博客内容页
1. 如何配置初始字体大小
1. ai能不能帮我改blog？很难
1. 站点地图更新，设计站点地图自动更新
1. 博客页面跳转，跳转到目标点位错误
    - 在页面间跳转，必错
    - 在同页面锚点跳转第一次（从其他页面进入到目标页面）必错，后续正常跳转
    - 屏蔽mermaid的功能锚点跳转正确
    - 考虑锚点在mermaid渲染之后。

## 博客内容企划

1. 总结关于flash坏块问题
1. c++设计模式补充
1. c++进程
1. Linux基础
1. 空调热泵能源解决方案行业调研
1. Modbus Holding Register定义与应用解析补充
1. 补充ARM架构

验证网站地图： 访问 https://你的域名.com/sitemap.xml 查看生成的网站地图。

## Test

``` mermaid
---
config:
    xyChart:
        width: 485.4
        height: 300
        showDataLabel: true
    themeVariables:
        xyChart:
            titleColor: "#ff0000"
---
xychart-beta
    title "电压时间关系"
    x-axis "时间 (ms)" [0, 30, 60, 90, 120, 150]
    y-axis "电压  (V)" 0 --> 4
    bar [3.3, 2.44, 1.81, 1.34, 1.0, 0.74]
    line [3.3, 2.44, 1.81, 1.34, 1.0, 0.74]
```

《book》[^1]

> 此处参考赤诚Xie《MCU的启动到bootloader原理详解》[^1]

> 正如作者B所述：
>   > "这里是引用的原文内容……"
>   > ——《文章标题》[^1]

[^1]: [《book》](https://xxxxxxxxxx)，【xxxxxxxxxxxxx】

Joseph Yiu. (2014). _《ARM Cortex-M3与Cortex-M4权威指南（第3版，中译）》_

[^1]: 赤诚Xie. (2024). _MCU的启动到bootloader原理详解_. [https://www.cnblogs.com/chicheng/p/18267699](https://www.cnblogs.com/chicheng/p/18267699)

[^2]: XHSC. (2024). _RM_HC32F460_F45x_A460系列参考手册_Rev1.5_.

[^3]: 码农爱学习. (2021). _单片机程序烧录的3种方式(ISP、ICP、IAP)是什么？_. [https://zhuanlan.zhihu.com/p/367821312](https://zhuanlan.zhihu.com/p/367821312)

[^4]:林接接. (2025). _典型arm32位单片机启动流程（从上电到main.c）_. [https://www.cnblogs.com/jiejielin-blogs/p/19008377](https://www.cnblogs.com/jiejielin-blogs/p/19008377)

``` cmd
+3.3V
  │
  │
 [R1(10K/1%)]
  │
  │
  ├─── [RT_INT(10K)] ───┬─> to MCU ADC Pin
  │                     │
  │                     │
 [R1(10K/1%)]          [C1(104)]
  │                     │
  │                     │
  ├─────────────────────┘
 GND
```