---
title: EEPROM驱动案例（M24C32）
author: YooyoJin
date: 2025-06-19
category: Jekyll
layout: post
mermaid: true
---

EEPROM这里不过多介绍，直接开始吧。

## 1. EEPROM硬件

M24C32系列芯片为例

### 1.1. 关键信息

首先根据芯片手册，我们可以提取到一些关键信息：
- I2C写入，支持1MHz、400kHz、100kHz
- 内存大小32Kbit(4Kbyte)，每页大小32bytes，即128页。
- 工作电压 1.7V 到 5.5V，可以看到这里有各种不同后缀的型号，像M24C32-R M24C32-F M24C32-DF M24C32-X M24C32-W。他们之间的差异在于工作电压、功耗方面，以适应不同的应用场合，区分了汽车级、工业级、家用级。
- 可以按位或页写入，写入周期在5ms以内(典型值 3.2ms)
- 支持随机和顺序读取模式
- 超亿次写入周期，以及200年的存储寿命
- Self-timed programming cycle（自定时编程周期）指EEPROM在写入（编程）或擦除操作时，内部自动生成时间控制信号，不需要依赖外部时钟或微控制器的持续干预。
    - 简化外部设计：主机（如MCU）只需触发写入操作，无需精确计时，由EEPROM内部自动完成后续流程。
    - 安全性：避免因外部时序错误导致写入失败或器件损坏。
    - 触发条件：当主机通过I2C发送完所有数据并发出停止条件（Stop Condition）后，EEPROM才会自动启动自定时编程周期。
    - 内部独立操作：EEPROM内部生成高压脉冲和时序，完成数据写入。此时I2C总线可释放（SCL可保持空闲），EEPROM不依赖外部时钟。

### 1.2. 存储机制

EEPROM写入数据分为两个阶段，一个阶段是数据从MCU发给EEPROM buffer，另外一个阶段是从buffer里面写入到EEPROM中（这个阶段不需要MCU参与）

``` mermaid
graph TD
    Master[主机（MCU）]
    E2Controller[EEPROM 控制器]
    E2Buffer[EEPROM 缓冲页（是否有缓冲页跟存储机制有关）]
    E2StorageUnit[EEPROM存储单元]

    Master -->|I2C| E2Controller;
    E2Controller --> E2Buffer;
    E2Buffer -->|固化| E2StorageUnit;
```

### 1.3. 引脚定义

<!DOCTYPE html>
<html>
<head>
    <style>
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
            font-family: Arial, sans-serif;
        }
        th, td {
            border: 1px solid #dddddd;
            text-align: left;
            padding: 8px;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .math {
            font-style: italic;
        }
    </style>
</head>
<body>
    <table>
        <thead>
            <tr>
                <th>Signal name</th>
                <th>Function</th>
                <th>Direction</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>E0, E1, E2</td>
                <td>Chip Enable</td>
                <td>Input</td>
            </tr>
            <tr>
                <td>SDA</td>
                <td>Serial Data</td>
                <td>I/O</td>
            </tr>
            <tr>
                <td>SCL</td>
                <td>Serial Clock</td>
                <td>Input</td>
            </tr>
            <tr>
                <td>WC</td>
                <td>Write Control</td>
                <td>Input</td>
            </tr>
            <tr>
                <td class="math">V<sub>CC</sub></td>
                <td>Supply voltage</td>
                <td></td>
            </tr>
            <tr>
                <td class="math">V<sub>SS</sub></td>
                <td>Ground</td>
                <td></td>
            </tr>
        </tbody>
    </table>
</body>
</html>

_**说明**_
- EEPROM设备选择，如果总线上有多个相同型号的EEPROM，可以通过硬件连接E0、E1、E2到VCC（高电平）或 GND（低电平）来分配不同的地址。即使只用一个EEPROM，也建议明确连接Ex引脚，避免悬空导致地址不确定。因此，最多支持八个同型号EEPROM在总线上。
- WC写保护，当WC为高时，禁止写入。

### 1.4. 读写操作

这里EEPROM使用I2C通信，我们先来回顾下I2C总线的特性：
- 总线空闲：数据线 High，时钟线 High
- 起始信号：数据线 ↑，时钟线 High
- 停止信号：数据线 ↓，时钟线 High
- 数据有效：在触发起始条件之后，数据信号需在时钟线为低电平期间变化，在时钟高电平时保持（读取）。
- 应答信号：在第9个时钟周期（应答位），主机释放数据线（开漏输出：主机输出高电平时，实际是断开下拉MOS管，由上拉电阻控制电平）后，从机必须在时钟线高电平期间拉低数据线，否则视为无应答（NACK）。
- 数据高位在先，低位在后

芯片寻址：
<table>
    <thead>
        <tr>
            <th>Features</th>
            <th>Bit 7</th>
            <th>Bit 6</th>
            <th>Bit 5</th>
            <th>Bit 4</th>
            <th>Bit 3</th>
            <th>Bit 2</th>
            <th>Bit 1</th>
            <th>Bit 0</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Memory</td>
            <td>1</td>
            <td>0</td>
            <td>1</td>
            <td>0</td>
            <td>E2</td>
            <td>E1</td>
            <td>E0</td>
            <td>R/W</td>
        </tr>
    </tbody>
</table>

_**说明**_
 - 前四位固定为1010，E2~E0由芯片引脚决定，R/W（`0`表示写操作，`1`表示读操作）

### 1.4.1 写字节

``` mermaid
sequenceDiagram
    participant MCU
    participant EEPROM as 24C32 EEPROM

    Note over MCU,EEPROM: Write Operation Sequence
    MCU->>EEPROM: START Condition (S)
    MCU->>EEPROM: Device Address (0xA0) + Chip enable address(e2,e1,e0)+ Write (0)
    EEPROM-->>MCU: ACK (0)
    MCU->>EEPROM: Memory Address (0x00-0xFF)
    EEPROM-->>MCU: ACK (0)

    loop Data Bytes
        MCU->>EEPROM: Data Byte (n)
        EEPROM-->>MCU: ACK (0)
    end

    MCU->>EEPROM: STOP Condition (P)

```
_**说明**_
- 写入搬运需要时间，写入一个字节之后，再写入下一个字节之前，必须延时5ms才可以
- 如果多字节写入，只需发送起始地址，后续数据按页内地址顺序写入（效率高，涉及跨页写入问题，超过边界地址会绕回）
- 多字节写入效率高，因为整页写入仍触发一次内部擦写

### 1.4.2 读字节

``` mermaid
sequenceDiagram
    participant MCU
    participant EEPROM as 24C32 EEPROM

    Note over MCU,EEPROM: Read Operation Sequence
    MCU->>EEPROM: START (S)
    MCU->>EEPROM: Device Address (0xA0) + Chip enable address(e2,e1,e0)+ Write (1)
    EEPROM-->>MCU: ACK (0)
    MCU->>EEPROM: WORD ADDRESS(内存地址)
    EEPROM-->>MCU: ACK (0)
    loop Data Bytes
        EEPROM->>MCU: Data Bytes
        MCU-->>EEPROM: ACK (0)
    end
    MCU-->>EEPROM: NACK (1)
    MCU->>EEPROM: STOP Condition (P)
```

