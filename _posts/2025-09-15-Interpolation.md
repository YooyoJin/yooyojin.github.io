---
title: 插值方法
author: YooyoJin
date: 2025-09-15
category: Jekyll
layout: post
mermaid: true
---

**Q: 为什么需要插值**<br>
**A:** 在常见的嵌入式系统中，我们经常遇到这样的场景：传感器采集的ADC数值需要转换为实际的物理量。在这个过程中，很难用一个公式来表达AD值与物理量之间的关系，而且受限于内存，我们也无法为每一个ADC值都存储对应的物理量值。所以我们常常用查表法，来快速找到AD值所对应的物理量范围。为了提高精度，我们会进行数据的插值处理。而线性插值是我们最常用的方式之一。

## 1. 单线性插值

单线性插值是一种在两个已知数据点之间进行估值的数学方法，在AD采集过程中，我们通过查表已经确定AD对应的物理量的大致范围，大部分传感器对应关系主要还是呈线性状态。那么我们就可以通过简单线性插值的方式来处理，以提高精度。

``` cmd
       y ↑
         |
   y1 ---+-----------●---- (x1,y1)
         |          /
         |         /
    y ---+--------●------- (x,y)
         |      /
         |     /
   y0 ---+----●----------- (x0,y0)
         |
         +--------------------→ x
         0    x0   x   x1
```

我也挺抽象的。。反正线性插值的图网上很多，忘了就从别人哪里搜一下。

线性插值公式如下：

$$ y = y_0 + \frac{y_1 - y_0}{x_1 - x_0}(x - x_0) $$

_**其中**_
- ($ x_0 $, $ y_0 $) 和 ($ x_1 $, $ y_1 $) 是两个已知点
- $ x $ 是已知的输入值
- $ y $ 是要计算的输出值

## 1.1. 单线性插值应用

``` c
uint16_t Lookup_Current(uint16_t adValue)
{
    uint16_t cTempTable_Ct[] ={
        0,   21,   43,   64,   85,  124,  217,  309,  412,  543,    //0-9A
        674,  806,  937, 1068, 1199, 1330, 1461, 1592, 1723, 1854,  //10-19A
    };
    uint16_t currentValue;
    const uint16_t *pTablePtr;
    const uint16_t *pCurrentEntry; // 当前查表指针位置

    // 指向电流-AD值转换表的起始位置
    pTablePtr = &cTempTable_Ct[0];

    // 查表分区间
    if (adValue > 4000) { // 悬空时采样电平异常（40A约等于AD值4000）
        return 0;
    } else if (adValue <= *pTablePtr) { // AD值低于表的最小值
        return 0;
    } else if (adValue <= *(pTablePtr + 9)) { // 电流 < 10A
        pCurrentEntry = pTablePtr;
        currentValue = 0;
    } else if (adValue <= *(pTablePtr + 19)) { // 电流 < 20A
        pCurrentEntry = pTablePtr + 10;
        currentValue = 100; // 10.0A
    } else { // 超过量程
        return 1910; // 191.0A（最大值）
    }

    // 在当前的电流区间内查找具体位置
    while (adValue > *pCurrentEntry) {
        currentValue += 10; // 电流值增加1.0A（10×0.1A）
        pCurrentEntry++;    // 移动到下一个表项
    }

    // 线性插值计算精确电流值
	// y = y0 + ((x - x0) * (y1 - y0)) / (x1 - x0)
	// 其中 (y1 - y0) = 10 AD-电流表格涉及以10（1A）作为间隔
	// 其中 (u16Delta >> 1) 四舍五入，因为整除会截断小数，在整除除前加50%
    uint16_t u16Delta = *pCurrentEntry - *(pCurrentEntry - 1); // (x1 - x0)
	currentValue -= ((*pCurrentEntry - adValue) * 10 + (u16Delta >> 1)) / u16Delta;

    return currentValue;
}
```

## 1.2. 优化方向

1. 精度放大
1. 整数运算替代浮点运算
1. 四舍五入

## 参考资料