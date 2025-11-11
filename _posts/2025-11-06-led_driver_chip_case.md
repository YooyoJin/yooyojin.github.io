---
title: LED驱动控制芯片开发笔记（TM1637）
author: YooyoJin
date: 2025-11-06
last_modified_at: 2025-11-06
category: Jekyll
layout: post
mermaid: true
---

TM1637，天微电子的一款LED驱动控制芯片（也就是数码管驱动芯片，数码管这里就不过多废话）。其应用也比较常见，多应用于小家电产品的显示面板、简单测量仪器的显示面板等。

由于如果使用MCU直接驱动大量数码管，需要大量的GPIO，例如4位数码管其有40个多个像素点，意味着需要40个GPIO资源。对于成本至上的老板是不可能答应的。故TM1637的核心任务是使用MCU有限的GPIO引脚资源，驱动大量段码LED像素点。

这里TM1637采用了多路复用技术，将屏幕在时间上分成四个公共端，这样4COM+10SEG即可驱动40个像素点，再用2个GPIO与MCU通信。这就实现了2个端口控制40个显示单元，节省MCU资源！

更重要的是一块TM1637仅需一块四，批量采购仅需六毛！如果能直接联系到厂商说不定更便宜呢。

## 1. 关键信息

首先根据芯片手册，我们可以提取到一些关键信息：
- **通信接口**：两线串行接口（CLK、DIO，自定义两线串行协议），注意这里与I2C通信类似，但不完全相同;
- **驱动能力**：采用CMOS工艺，内置功率管，可以直接输出较大电流驱动LED数码管；
- **显示能力**：显示模式（8段×6位，能同时驱动6位数码管），支持共阳数码管；
- **集成按键**：键扫描（8×2bit，SEG线复用为按键扫描线，可以检测最多8×2=16个按键），增强型抗干扰按键识别电路（集成硬件消抖，滤波）；
- 内置上电复位电路，上电复位，通电即可工作；
- 键扫和现实功能可以同时使用，合理地设计交替调用显示更新函数和按键读取函数即可。

## 2. 引脚定义

<div style="overflow-x: auto;">
    <style>
    table {
        width: 100%;
        border-collapse: collapse;
    }
    th, td {
        border: 1px solid #000;
        padding: 8px;
        white-space: nowrap;
        text-align: left;
    }
    th {
        background-color: #f2f2f2;
    }
    </style>
    <table>
    <tr>
        <th>符号</th>
        <th>管脚名称</th>
        <th>管脚号</th>
        <th>说明</th>
    </tr>
    <tr>
        <td>DIO</td>
        <td>数据输入/输出</td>
        <td>17</td>
        <td>串行数据输入/输出，输入数据在 SLCK 的低电平变化，在 SCLK 的高电平被传输，每传输一个字节芯片内部都将在第八个时钟下降沿产生一个 ACK</td>
    </tr>
    <tr>
        <td>CLK</td>
        <td>时钟输入</td>
        <td>18</td>
        <td>在上升沿输入/输出数据</td>
    </tr>
    <tr>
        <td>K1~K2</td>
        <td>键扫数据输入</td>
        <td>19-20</td>
        <td>输入该脚的数据在显示周期结束后被锁存</td>
    </tr>
    <tr>
        <td>SG1~SG8</td>
        <td>输出（段）</td>
        <td>2-9</td>
        <td>段输出（也用作键扫描），N 管开漏输出</td>
    </tr>
    <tr>
        <td>GRID6~GRID1</td>
        <td>输出（位）</td>
        <td>10-15</td>
        <td>位输出，P 管开漏输出</td>
    </tr>
    <tr>
        <td>VDD</td>
        <td>逻辑电源</td>
        <td>16</td>
        <td>5V±10%</td>
    </tr>
    <tr>
        <td>GND</td>
        <td>逻辑地</td>
        <td>1</td>
        <td>接系统地</td>
    </tr>
    </table>
</div>

## 3. 工作原理

### 3.1. TM1637键扫数据读取原理

键扫矩阵详细查看TM1637数据手册-读扫键章节[^1]，

其工作流程大致如下以S1按下为例：
``` mermaid
sequenceDiagram
    participant MCU
    participant TM1637
    participant SEG1
    participant K1

    Note over TM1637: 1. 扫描周期开始
    TM1637->>SEG1: 激活SG1(输出低电平)
    Note over K1: 2. 由于S1按下，K1被SG1拉低
    TM1637->>K1: 检测到K1为低电平
    TM1637->>TM1637: 内部编码器工作
    Note over TM1637: 3. 根据"SG1激活 + K1低电平"<br>硬编码: 1110_1111
    MCU->>TM1637: 读取键值
    TM1637->>MCU: 返回 1110_1111
```

_**其中**_
- 在无按键按下时，读键数据为：1111_1111，低位在前，高位在后。
- 由于干扰较强，为改善这个问题，TM1637采用负沿触发方式解决误触发现象，即所谓“跳键”现象。
- 编码中，低4位表示当前有效的SEG线（不过跟它手册里的按键顺序毫无对应关系）。高四位表示SEG线下的K1（1111）、K2（0111）状态。不知道为什么乱序编码，不过至少表中的编码是唯一的。

### 3.2. TM1637显示寄存器地址和显示模式

这里之前说过，不是同时点亮的。是利用了人眼的“视觉暂留”机制，所以同一时间只有一个数码管被点亮。

TM1637设计了一个显示寄存器(一块内存)，通过串口，接收从MCU发来的数据。显示寄存器地址00H-05H共六个显示寄存器，对应六个数码管；每个寄存器又分了高低4位，对应数码管的每一个发光二极管。简单来说，往这个寄存器里写什么数据，GRID控制的数码管就怎么亮。

以GRID1为例，显示流程如下：
``` mermaid
sequenceDiagram
    participant MCU
    participant TM1637
    participant DisplayRAM
    participant GRID1

    Note over MCU: 1. 准备显示数据
    MCU->>MCU: 确定GRID1显示数字"5", 查表得段码: 0x6D (0110_1101)

    Note over MCU, TM1637: 2. 设置显示地址，发送显示数据
    MCU->>TM1637: 发送命令: 0xC0 (GRID1地址)
    MCU->>TM1637: 发送数据: 0x6D (数字5段码)

    Note over TM1637, DisplayRAM: 3. 存储到显示寄存器
    TM1637->>DisplayRAM: 将0x6D存入地址0xC0

    Note over TM1637: 4. 动态扫描循环
    loop 每帧扫描
        TM1637->>GRID1: 激活GRID1(输出低电平)
        TM1637->>DisplayRAM: 读取地址0xC0的数据0x6D
        TM1637->>SEG: 根据0x6D输出段信号
        Note over GRID1: GRID1显示数字"5"
        TM1637->>GRID1: 关闭GRID1
        TM1637->>GRID2: 激活GRID2...
    end
```

_**注意**_
- 扫描一个GRID位的周期:Tdisp=500ms，每一位显示时间：1/16 Tdisp；
- 键盘扫描在每一轮显示周期结束后进行一次，参考TM1637数据手册-显示和键扫周期章节[^1]；

### 3.3. TM1637两线总线接口

CLK：时钟线；DIO：数据线。

**TM1637特性：**
- **总线空闲**：数据线 High，时钟线 High；
- **起始信号**：数据线 ↓，时钟线 High；
- **终止信号**：数据线 ↑，时钟线 High；
- **数据有效**：在触发起始条件之后，数据信号需在时钟线为低电平期间变化，在时钟高电平时保持（读取）；
- **应答信号**：当数据传输正确时，在第八个时钟的下降沿，芯片内部会产生一个应答信号ACK将DIO管脚拉低，在第九个时钟结束之后释放DIO；
- 数据低位在先，高位在后；
- 跟I2C特性很像，差别在于传输的位顺序不一样。而且他没有设备地址的概念，直接命令+数据。

**数据写入模式:**
- 指令数据传输模式（读按键数据）
  - `start --> command --> ack --> end`
  - command：读按键指令；S0、S1、S2、K1、K2 组成按键信息编码，S0、S1、S2 为SGn的编码，K1、K2为K1和K2键的编码，其他位可能是0。
- 普通模式数据传输模式：
  - `start --> command --> ack --> data --> ack --> end`
    - Command: 设置地址
    - data：设置数据
- 写SRAM数据地址自动加1模式:
  - `start --> +1modeCommand --> command --> ack --> data --> ack --> data1 --> ack --> end`
    - 1modeCommand：设置数据
    - command：设置地址
    - data：显示数据
  - 在+1模式下地址自动+1，方便批量写入。
- 写SRAM数据固定地址模式:
  - `start --> fixModeCommand --> command --> ack --> data --> ack --> command --> ack --> data1 --> ack --> end`
    - fixModeCommand：设置数据
    - command：设置地址
    - data：显示数据
  - 没搞清楚跟普通模式有什么区别，// todo 待测试

**命令字（8位）**: 用于设置地址、模式等。
- [ B7 B6 B5 B4 B3 B2 B1 B0 ] (MSB -> LSB)
  - B7，B6: 功能选择位。
    - 数据命令(00) → 数据写入模式（写LED/读按键、自增或固定）
    - 显示控制(10) → 总体显示状态（开/关、亮度）
    - 地址命令(01) → 写入的具体位置
  - B5，B4: 无关项，填0。
  - 详细控制命令，参考TM1637数据手册-命令控制章节[^1]。

## 4. TM1637应用

### 4.1. 初始化流程

### 4.2. 参考代码

## 常见问题

### TM1637在处理多键同时按下时的行为

经过测试，仅返回最后一个按下的编码结果。

## 参考资料

[^1]: Titan Micro Electronics. (2012). _TM1637_. [https://item.szlcsc.com/20710.html?lcsc_vid=FQNYV1ZfFFNbBlZVQlcPBVBeEgIMA1ECTgVcU1JUQVgxVlNQRVVeX1FVT1hfVDsOAxUeFF5JWBYZEEoEHg8JSQcJGk4%3D](https://item.szlcsc.com/20710.html?lcsc_vid=FQNYV1ZfFFNbBlZVQlcPBVBeEgIMA1ECTgVcU1JUQVgxVlNQRVVeX1FVT1hfVDsOAxUeFF5JWBYZEEoEHg8JSQcJGk4%3D)
