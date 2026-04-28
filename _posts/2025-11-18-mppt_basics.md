---
title: MPPT开发笔记-理论基础
author: YooyoJin
date: 2025-11-18
last_modified_at: 2026-04-13
category: Jekyll
layout: post
mermaid: true
---

## 1. MPPT

MPPT(Maximum Power Point Tracking)，最大功率点跟踪。似乎看起来不算是一个很复杂的东西，在光伏发电领域应用广泛。由于光线是变化的，受到环境、天气等因素的影响，通过动态调整太阳能板的输出电压，并实时计算功率，从而追踪到能使功率最大化的那个“最佳电压点”。

了解了MPPT的定义，一个很自然的问题就会浮现出来：为什么光伏板不总是以最大功率输出，而是存在这么一个特定的“最大功率点”呢？那我们可能会想，有多少就输出多少呗，正常全部输出不就应该是最大功率吗？

**Q: 为什么有最大功率点？为什么会有这种效应？**<br>
**A:** 源于光伏板特有的半导体物理机制，这涉及到光伏发电的原理。光伏板是一种光敏PN结，首先当光照射到PN结上时，会神奇的让电子运动（伏打效应）。然后，PN结的单向导电性将正负电荷分开，形成定向的电流，只要光照强度不变，电流的大小就是恒定的。但是PN结它会泄露，泄露的程度由两端的电压决定，电压越高泄露越多，与光生电流方向相反，即光生电流全部被泄露电流抵消，全部在电池内部消耗掉了，没有电流对外输出。于是经两个电流的博弈，从而形成了I-V特性曲线。

> 最大功率点是太阳能板内部物理结构（恒流特性与二极管特性）相互制约、共同作用的结果。

``` mermaid
---
config:
    xyChart:
        width: 1000
        height: 400
---
xychart-beta
    title "太阳能电池板I-V🟣 与 P-V⚫特性曲线（归一化）"
    x-axis "电压 (V)" [0, 10, 20, 30, 35, 40, 45, 50]
    y-axis "归一化值 (0-1)" 0 --> 1
    line "电流 I (归一化)" [0.85, 0.83, 0.80, 0.72, 0.60, 0.35, 0.10, 0.00]
    line "功率 P (归一化)" [0.00, 0.35, 0.67, 0.90, 0.88, 0.58, 0.19, 0.00]

```

根据上面的“太阳能电池板I-V与P-V 特性曲线”，我们可以看出：
- 当你把电池板两端短路时，输出电压为0，此时电流最大，即短路电流；
- 当你让电池板空载时，输出电流为0，此时电压最大，即开路电压；
- 所以根据电流和电压的变化合成得到一个功率曲线，从图中可以看出，大概在电压30V时，功率输出最大，我们可以认为这个点就是最大功率点。对应的电压和电流分别称为Vmpp和Impp。
- 注意！光伏板的输出特性完全不同于电池或稳压电源，在光伏板中，负载通过改变工作电压来调节PN结的泄露程度，泄露程度决定了有多少光生电流被内部消耗，从而最终决定了对外输出的电流。

**Q: 为什么需要MPPT呢？如果最大功率点是一个固定值？**<br>
**A:** 如果最大功率点（Vmpp）是固定不变的，那我们确实只需要把电路静态地设置在那个点就行了。

但现实是：
- 因为受到天气、遮挡等因素影响，输入电压波动。目前常见的做法是通过DC-DC调压，来找到最大功率点，DC-DC转换是有损耗的，强行升压或降压到理论上的最大功率点，并不是最优解。
- 但最重要的是，Vmpp不是一个固定值！Vmpp受温度、光照辐射强度、电压等影响，导致Vmpp是一个移动的目标，I-V曲线只是固定温度下的理想曲线。因此我们无法直接调到Vmpp。

## 2. 光伏电池输出特性

为什么MPP点是变化的？因为收光伏电池的输出特性影响！

除了环境变化等因素外，太阳能电池板本身的输出特性也是不容忽视的。辐射强度与电池温度，影响其I-V特性曲线。
- 光照强度越高，光伏板能产生的最大功率越大，功率曲线整体抬升
- 温度越高，发电效率越差，光伏板能产生的最大工程量越小，整体曲线压低。

### 2.1. 辐照度对I-V，P-V曲线的影响

太有实力了！趋势原本不打算放了，简单文字总结下就算了。问了下AI，它直接把Python的数据扒下来用浏览器JavaScript图形库，直接重新绘制。

ps: 以下数据仅供参考，看看数据趋势即可。有bug，勿点击图表，页面会卡死，如果首次进入没加载出来请刷新一次。

<div id="iv_irradiance" style="width:100%; height:400px;"></div>

<div id="pv_irradiance" style="width:100%; height:400px;"></div>

### 2.2. 温度对I-V，P-V曲线的影响

<div id="iv_temperature" style="width:100%; height:400px;"></div>

<div id="pv_temperature" style="width:100%; height:400px;"></div>

<script src="https://cdn.plot.ly/plotly-3.0.1.min.js" charset="utf-8"></script>

<style>
/* 禁用图表内文本选择，避免蓝色选择框 */
.plotly .main-svg {
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
}

/* 点击图表外部区域时清空图表选中状态 */
body.click-outside-active .plotly .main-svg {
    pointer-events: none;
}
</style>

<script>
// 全局函数：点击图表外部区域时，清除图表的任何选中/高亮状态
document.addEventListener('click', function(event) {
    // 检查点击的目标是否是图表内部
    var isPlotly = event.target.closest('.plotly') !== null;

    if (!isPlotly) {
        // 点击图表外部：重新绘制所有图表（重置状态）
        redrawAllPlots();
    }
});

// 存储所有图表的配置，用于重绘
var plotConfigs = [];

// 重置所有图表到初始状态
function redrawAllPlots() {
    for (var i = 0; i < plotConfigs.length; i++) {
        var cfg = plotConfigs[i];
        Plotly.newPlot(cfg.divId, cfg.traces, cfg.layout, cfg.config);
    }
}

// 通用布局配置：坐标轴标题居中
var commonLayout = {
    hovermode: 'closest',
    margin: { l: 70, r: 40, t: 60, b: 60 },
    dragmode: false,
    xaxis: {
        title: {
            text: '电压 (V)',
            standoff: 15,
            font: { size: 13 }
        },
        range: [0, 50],
        automargin: true,
        zeroline: false,
        fixedrange: true,
    },
    yaxis: {
        title: {
            text: '电流 (A)',
            standoff: 15,
            font: { size: 13 }
        },
        range: [0, 5.5],
        automargin: true,
        zeroline: false,
        fixedrange: true,
    },
    plot_bgcolor: '#f9f9f9',
    paper_bgcolor: '#ffffff'
};

// 功率图的布局（纵轴范围更大）
var powerLayout = {
    hovermode: 'closest',
    margin: { l: 70, r: 40, t: 60, b: 60 },
    xaxis: {
        title: {
            text: '电压 (V)',
            standoff: 15,
            font: { size: 13 }
        },
        range: [0, 50],
        automargin: true,
        zeroline: false
    },
    yaxis: {
        title: {
            text: '功率 (W)',
            standoff: 15,
            font: { size: 13 }
        },
        automargin: true,
        zeroline: false
    },
    plot_bgcolor: '#f9f9f9',
    paper_bgcolor: '#ffffff'
};

// ========== 1. I-V曲线 - 辐照度影响 ==========
var trace_iv_s1000 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 4.99, 4.97, 4.92, 4.82, 4.61, 4.20, 3.45, 2.15, 0.97, 0.31, 0.06, 0.01, 0.00],
    mode: 'lines',
    name: 'S = 1000 W/m²',
    line: {color: 'red', width: 2.5}
};
var trace_iv_s800 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [4.00, 4.00, 4.00, 4.00, 4.00, 4.00, 4.00, 4.00, 3.99, 3.98, 3.94, 3.86, 3.69, 3.36, 2.76, 1.72, 0.78, 0.25, 0.05, 0.01, 0.00],
    mode: 'lines',
    name: 'S = 800 W/m²',
    line: {color: 'orange', width: 2.5}
};
var trace_iv_s600 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [3.00, 3.00, 3.00, 3.00, 3.00, 3.00, 3.00, 3.00, 2.99, 2.98, 2.95, 2.89, 2.77, 2.52, 2.07, 1.29, 0.58, 0.19, 0.04, 0.01, 0.00],
    mode: 'lines',
    name: 'S = 600 W/m²',
    line: {color: 'gold', width: 2.5}
};
var ivRadTraces = [trace_iv_s1000, trace_iv_s800, trace_iv_s600];
var ivRadLayout = JSON.parse(JSON.stringify(commonLayout));
ivRadLayout.title = '辐照度 S 对 I-V 曲线的影响';
ivRadLayout.yaxis.range = [0, 5.5];
plotConfigs.push({
    divId: 'iv_irradiance',
    traces: ivRadTraces,
    layout: ivRadLayout,
    config: { displayModeBar: false, responsive: true }
});

// ========== 2. I-V曲线 - 温度影响 ==========
var trace_iv_t25 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 4.99, 4.97, 4.92, 4.82, 4.61, 4.20, 3.45, 2.15, 0.97, 0.31, 0.06, 0.01, 0.00],
    mode: 'lines',
    name: 'T = 25 °C',
    line: {color: 'blue', width: 2.5}
};
var trace_iv_t45 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [5.01, 5.01, 5.01, 5.01, 5.01, 5.01, 5.01, 5.01, 5.00, 4.99, 4.96, 4.90, 4.78, 4.54, 4.13, 3.41, 2.41, 1.28, 0.47, 0.11, 0.00],
    mode: 'lines',
    name: 'T = 45 °C',
    line: {color: 'lightblue', width: 2.5}
};
var trace_iv_t65 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [5.02, 5.02, 5.02, 5.02, 5.02, 5.02, 5.02, 5.02, 5.01, 5.01, 5.00, 4.98, 4.93, 4.84, 4.68, 4.38, 3.85, 3.06, 1.99, 0.90, 0.00],
    mode: 'lines',
    name: 'T = 65 °C',
    line: {color: 'cyan', width: 2.5}
};
var ivTempTraces = [trace_iv_t25, trace_iv_t45, trace_iv_t65];
var ivTempLayout = JSON.parse(JSON.stringify(commonLayout));
ivTempLayout.title = '温度 T 对 I-V 曲线的影响';
ivTempLayout.yaxis.range = [0, 5.5];
plotConfigs.push({
    divId: 'iv_temperature',
    traces: ivTempTraces,
    layout: ivTempLayout,
    config: { displayModeBar: false, responsive: true }
});

// ========== 3. P-V曲线 - 辐照度影响（带MPP标记）==========
var trace_pv_s1000 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [0.00, 12.50, 25.00, 37.50, 50.00, 62.50, 75.00, 87.50, 99.80, 111.83, 123.00, 132.55, 138.30, 136.50, 120.75, 80.63, 38.80, 13.18, 2.70, 0.48, 0.00],
    mode: 'lines',
    name: 'P (S=1000 W/m²)',
    line: {color: 'red', width: 2.5},
    showlegend: true
};
var mpp_s1000 = {
    x: [30],
    y: [138.30],
    mode: 'markers',
    name: 'MPP (S=1000)',
    marker: {color: 'red', size: 10, symbol: 'circle', line: {color: 'darkred', width: 2}}
};
var trace_pv_s800 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [0.00, 10.00, 20.00, 30.00, 40.00, 50.00, 60.00, 70.00, 79.80, 89.55, 98.50, 106.15, 110.70, 109.20, 96.60, 64.50, 31.20, 10.63, 2.25, 0.48, 0.00],
    mode: 'lines',
    name: 'P (S=800 W/m²)',
    line: {color: 'orange', width: 2.5},
    showlegend: true
};
var mpp_s800 = {
    x: [30],
    y: [110.70],
    mode: 'markers',
    name: 'MPP (S=800)',
    marker: {color: 'orange', size: 10, symbol: 'circle', line: {color: 'darkorange', width: 2}}
};
var trace_pv_s600 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [0.00, 7.50, 15.00, 22.50, 30.00, 37.50, 45.00, 52.50, 59.80, 67.05, 73.75, 79.48, 83.10, 81.90, 72.45, 48.38, 23.20, 8.08, 1.80, 0.48, 0.00],
    mode: 'lines',
    name: 'P (S=600 W/m²)',
    line: {color: 'gold', width: 2.5},
    showlegend: true
};
var mpp_s600 = {
    x: [30],
    y: [83.10],
    mode: 'markers',
    name: 'MPP (S=600)',
    marker: {color: 'gold', size: 10, symbol: 'circle', line: {color: 'darkgoldenrod', width: 2}}
};

var pvRadTraces = [trace_pv_s1000, mpp_s1000, trace_pv_s800, mpp_s800, trace_pv_s600, mpp_s600];
var pvRadLayout = JSON.parse(JSON.stringify(powerLayout));
pvRadLayout.title = '辐照度 S 对 P-V 曲线的影响 (● 标记最大功率点 MPP)';
pvRadLayout.yaxis.range = [0, 160];
plotConfigs.push({
    divId: 'pv_irradiance',
    traces: pvRadTraces,
    layout: pvRadLayout,
    config: { displayModeBar: false, responsive: true }
});

// ========== 4. P-V曲线 - 温度影响（带MPP标记）==========
var trace_pv_t25 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [0.00, 12.50, 25.00, 37.50, 50.00, 62.50, 75.00, 87.50, 99.80, 111.83, 123.00, 132.55, 138.30, 136.50, 120.75, 80.63, 38.80, 13.18, 2.70, 0.48, 0.00],
    mode: 'lines',
    name: 'P (25°C)',
    line: {color: 'blue', width: 2.5},
    showlegend: true
};
var mpp_t25 = {
    x: [30],
    y: [138.30],
    mode: 'markers',
    name: 'MPP (25°C)',
    marker: {color: 'blue', size: 10, symbol: 'circle', line: {color: 'darkblue', width: 2}}
};
var trace_pv_t45 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [0.00, 12.53, 25.05, 37.58, 50.10, 62.63, 75.15, 87.68, 100.00, 112.28, 124.00, 134.75, 143.40, 147.55, 144.55, 127.88, 96.40, 54.40, 21.15, 5.23, 0.00],
    mode: 'lines',
    name: 'P (45°C)',
    line: {color: 'lightblue', width: 2.5},
    showlegend: true
};
var mpp_t45 = {
    x: [32.5],
    y: [147.55],
    mode: 'markers',
    name: 'MPP (45°C)',
    marker: {color: 'lightblue', size: 10, symbol: 'circle', line: {color: 'darkblue', width: 2}}
};
var trace_pv_t65 = {
    x: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50],
    y: [0.00, 12.55, 25.10, 37.65, 50.20, 62.75, 75.30, 87.85, 100.20, 112.73, 125.00, 136.95, 147.90, 157.30, 163.80, 164.25, 154.00, 130.05, 89.55, 42.75, 0.00],
    mode: 'lines',
    name: 'P (65°C)',
    line: {color: 'cyan', width: 2.5},
    showlegend: true
};
var mpp_t65 = {
    x: [35],
    y: [163.80],
    mode: 'markers',
    name: 'MPP (65°C)',
    marker: {color: 'cyan', size: 10, symbol: 'circle', line: {color: 'darkblue', width: 2}}
};

var pvTempTraces = [trace_pv_t25, mpp_t25, trace_pv_t45, mpp_t45, trace_pv_t65, mpp_t65];
var pvTempLayout = JSON.parse(JSON.stringify(powerLayout));
pvTempLayout.title = '温度 T 对 P-V 曲线的影响 (● 标记最大功率点 MPP)';
pvTempLayout.yaxis.range = [0, 200];
plotConfigs.push({
    divId: 'pv_temperature',
    traces: pvTempTraces,
    layout: pvTempLayout,
    config: { displayModeBar: false, responsive: true }
});

// 初始化所有图表
function initPlots() {
    for (var i = 0; i < plotConfigs.length; i++) {
        var cfg = plotConfigs[i];
        Plotly.newPlot(cfg.divId, cfg.traces, cfg.layout, cfg.config);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPlots);
</script>

## 3. MPPT硬件拓扑

前级boost MPPT拓扑：

``` mermaid
graph LR
    subgraph PV["☀️ 光伏输入"]
        A[光伏阵列<br/>Vpv: 150V~350V]
    end

    subgraph Boost["⚡ Boost 升压电路"]
        direction LR
        B[输入电容<br/>Cin]
        C[功率电感<br/>L]
        D{开关节点}
        E[开关管<br/>MOSFET或IGBT]
        F[整流二极管<br/>SiC（肖特基）]
        G[母线电容<br/>Cout]
        GND[GND]
    end

    subgraph Out["🔋 高压母线"]
        H[负载 / 后级电路]
    end

    subgraph Ctrl["🧠 MPPT 控制"]
        I[MCU / DSP]
        J[电压采样]
        K[电流采样]
        L[驱动电路]
    end

    A --> B --> C --> D
    D --> F --> G --> H
    D --> E --> GND
    B --> GND
    G --> GND

    A -.-> J -.-> I
    A -.-> K -.-> I
    I --> L --> E

    style A fill:#fff3e0,stroke:#f39c12,stroke-width:2px
    style H fill:#e8f8f5,stroke:#1abc9c,stroke-width:2px
    style I fill:#f4ecf7,stroke:#8e44ad,stroke-width:2px
    style C fill:#d6eaf8,stroke:#2980b9,stroke-width:2px
    style G fill:#fadbd8,stroke:#c0392b,stroke-width:2px
```
_**注意**_：
- 电感注意选型，当心磁饱和或炸管，当电流超过电感饱和电流，电感量瞬间跌落至接近空心线圈，电流斜率急剧增大。软件ADC电流采样时会出现尖峰。
- 母线电容，多用电解电容。需要设计软起动，占空比从0%缓慢爬升，给电解电容充电时间。
- 输入电容，多用薄膜电容，吸收纹波，减少输入端的毛刺噪声。

除了Boost型MPPT，常见的Buck、Boost以及Buck-Boost电路都有合适的应用场合
- 用Boost：光伏阵列电压低于后端母线或电池电压。例如在并网逆变器中，单路光伏电压可能只有几十伏，需要升压到360V-500V左右的高压直流母线，才能让后级逆变电路正常工作。
- 用Buck：光伏阵列电压高于电池电压。例如给12V/24V/48V的低压蓄电池充电，且光伏板是高压串联时。

> 中大功率的MPPT一般都是Boost电路及其衍生电路，除了Boost电路本身拓扑简单以外，逆变侧对高压直流母线的需求也使得升压电路更受欢迎[^1]。

## 4. MPPT性能指标

- 追踪速度: 任意初态下系统开始运行时，或系统发生扰动时，光伏输入首次超过99.0%静态追踪效率的时间应不超过25秒。
- 跟踪精度：设备实际工作点与理论最大功率点之间的偏差
- 静态追踪效率: 不小于99.0%。
- 动态追踪效率: 不小于99.0%，测试标准符合NB/T 32004-2013。

## 常见问题

## 参考资料

[^1]: 英飞凌工业半导体. (2024). _MPPT常用拓扑原理与英飞凌实现方法_. [https://www.eet-china.com/mp/a301989.html](https://www.eet-china.com/mp/a301989.html)

