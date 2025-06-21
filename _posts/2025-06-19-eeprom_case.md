---
title: EEPROM驱动案例（M24C32）
author: YooyoJin
date: 2025-06-19
category: Jekyll
layout: post
mermaid: true
---

EEPROM这里不过多介绍，以M24C32系列芯片为例，直接开始吧。

## 1. 关键信息

首先根据芯片手册，我们可以提取到一些关键信息：
- I2C写入，支持1MHz、400kHz、100kHz；
- 内存大小32Kbit(4Kbyte)，每页大小32bytes，共计128页；
- 工作电压 1.7V 到 5.5V，可以看到这里有各种不同后缀的型号，像M24C32-R M24C32-F M24C32-DF M24C32-X M24C32-W。他们之间的差异在于工作电压、功耗方面，以适应不同的应用场合，区分了汽车级、工业级、家用级；
- 可以按位或页写入，写入周期在5ms以内(典型值 3.2ms)；
- 支持随机和顺序读取模式；
- 超亿次写入周期，以及200年的存储寿命；
- Self-timed programming cycle（自定时编程周期）指EEPROM在写入（编程）或擦除操作时，内部自动生成时间控制信号，不需要依赖外部时钟或微控制器的持续干预；
    - 简化外部设计：主机（如MCU）只需触发写入操作，无需精确计时，由EEPROM内部自动完成后续流程;
    - 安全性：避免因外部时序错误导致写入失败或器件损坏；
    - 触发条件：当主机通过I2C发送完所有数据并发出停止条件（Stop Condition）后，EEPROM才会自动启动自定时编程周期；
    - 内部独立操作：EEPROM内部生成高压脉冲和时序，完成数据写入。此时I2C总线可释放（SCL可保持空闲），EEPROM不依赖外部时钟；

## 2. 存储机制

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

## 3. 引脚定义

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
- EEPROM设备选择，如果总线上有多个相同型号的EEPROM，可以通过硬件连接E0、E1、E2到VCC（高电平）或 GND（低电平）来分配不同的地址。即使只用一个EEPROM，也建议明确连接Ex引脚，避免悬空导致地址不确定。因此，最多支持八个同型号EEPROM在总线上；
- WC写保护，当WC为高时，禁止写入；

## 4. 读写操作

这里EEPROM使用I2C通信，我们先来回顾下I2C总线的特性：
- 总线空闲：数据线 High，时钟线 High；
- 起始信号：数据线 ↑，时钟线 High；
- 停止信号：数据线 ↓，时钟线 High；
- 数据有效：在触发起始条件之后，数据信号需在时钟线为低电平期间变化，在时钟高电平时保持（读取）；
- 应答信号：在第9个时钟周期（应答位），主机释放数据线（开漏输出：主机输出高电平时，实际是断开下拉MOS管，由上拉电阻控制电平）后，从机必须在时钟线高电平期间拉低数据线，否则视为无应答（NACK）；
- 数据高位在先，低位在后；

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
 - 前四位固定为1010，E2~E0由芯片引脚决定，R/W（`0`表示写操作，`1`表示读操作）；

### 4.1 写字节

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
- 写入搬运需要时间，写入一个字节之后，再写入下一个字节之前，必须延时5ms才可以；
- EEPROM进入内部写周期时，数据将会写入非易失性存储器中，在此期间所有输入都无效。直到写周期完成，EEPROM才会有应答；
- 如果多字节写入，只需发送起始地址，后续数据按页内地址顺序写入（效率高，涉及跨页写入问题，超过边界地址会绕回）；
- 多字节写入效率高，因为整页写入只触发一次内部擦写；
- 关于页写入（多字节写入），页的大小手册会有说明。像M23C32，每页32bytes；
- 多字节写入与单子节写入的区别，在于主机在EEPROM响应后，接着发下下一个数据。直到主机发送停止。**要注意的是当连续写入字节达到页的边界地址时该数据将会写入该页的页首，先前的数据会被覆盖**；

``` c
#define NUM 32

    uint8_t data[NUM];
    for (uint8_t i = 0; i < NUM; i++) {
        data[i] = i + 1;
    }
    E2WriteMulti(0x0001, data, NUM); // 连续写入，从地址0x0001写入32个字节，
    DelayXms(20);

    // 这里使用M23C32了，并回读0x0000和0x0001上的内容
    // 0x0000 32
    // 0x0001 01
    // 符合预期，这里第32个字节已经超出当前页大小，内容会写入该页的页首
```

此处修改一下软件，就可以实现自动的页边界处理：
``` c
/**
 * @brief   把多个字节数据连续写入EEPROM，遇页边界自动分多次写入
 * @param   u16Addr 待写入数据存储起始地址
 * @param   u8Dat   待写入数据指针
 * @param   u16Len  写入数据长度
 * @retval  自动处理页边界，避免跨页写入导致数据覆盖
 */
static void WriteMultiDataToI2C(uint16 u16Addr, const uint8 *u8Dat, uint16 u16Len)
{
	const uint16 u16PageSize = 32; // 以M24C32为例，页大小为32字节
	uint16 u16Remain = u16Len;     // 剩余待写字节数
	uint16 u16CurAddr = u16Addr;   // 当前写入地址
	const uint8 *pu8Cur = u8Dat;   // 当前写入数据指针

	while (u16Remain > 0)
	{
		// 等待写入间隔，防止EEPROM写入过快
		while (g_uE2Interval < E2_INTERVAL_CONST)
		{
			WDT_Restart();
		}

		// 计算本次写入不跨页的最大字节数
		uint16 u16PageOffset = u16CurAddr % u16PageSize;
		uint16 u16BytesThisPage = u16PageSize - u16PageOffset;
		if (u16BytesThisPage > u16Remain)
			u16BytesThisPage = u16Remain;

		// 开始页写操作
		EEPROM_WP_DISABLE;
		I2CStart();
		I2CSendByte(0xa0); // 设备地址
		WaitAck();
		I2CSendByte(u16CurAddr >> 8); // 高8位地址
		WaitAck();
		I2CSendByte(u16CurAddr & 0xff); // 低8位地址
		WaitAck();
		for (uint16 i = 0; i < u16BytesThisPage; i++)
		{
			I2CSendByte(pu8Cur[i]); // 发送数据
			WaitAck();
		}
		I2CStop();
		EEPROM_WP_ENABLE;
		g_uE2Interval = 0; // 重置写入间隔计数

		// 更新指针和计数，准备下次写入
		u16CurAddr += u16BytesThisPage;
		pu8Cur += u16BytesThisPage;
		u16Remain -= u16BytesThisPage;
	}
}
```

### 4.2 读字节

读字节流程与写字节流程差不多：

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
_**说明**_
- 有三种不同的读数据方式：
    - 当前地址读，指读取EEPROM内部地址指针指向的位置。通常读取/写入操作后，指针会自动递增。触发启动信号后，直接读取当前设备地址，读取数据；
    - 随机地址读，在触发启动信号后，先写入当前设备地址，再写入要读取的内存地址，重新发送启动信号，发送设备地址，EEPORM会自动向主机发送数据，主机收到后回应停止或NACK；
    - 连续地址读，在触发启动信号后，先写入当前设备地址，再写入要读取的内存地址，重新发送启动信号，发送设备地址，EEPORM会自动向主机发送数据，主机需要不断应答。直到主机回应停止或NACK；
- 随机地址读和连续地址读方式差不多，取决与主机想不想再继续收。
- EEPROM连续读字节通常没有写字节的“跨页烦恼”，除非是古早的一些EEPROM

## 参考资料

[I2C协议详解](https://www.cnblogs.com/bujidao1128/p/18289812#:~:text=%E9%A1%BE%E5%90%8D%E6%80%9D%E4%B9%89%EF%BC%8C%20I2C%E9%80%9A%E8%AE%AF%E5%8F%AA%E9%9C%80%E8%A6%81%E4%B8%A4%E6%A0%B9%E7%BA%BF%EF%BC%8C%E4%B8%80%E6%A0%B9%E6%98%AF%20%E6%95%B0%E6%8D%AE%E7%BA%BFSDA%20%EF%BC%88Serial%20Data,Line%EF%BC%89%EF%BC%8C%E4%B8%80%E6%A0%B9%E6%98%AF%20%E6%97%B6%E9%92%9F%E7%BA%BFSCL%20%EF%BC%88Serial%20Clock%20Line%EF%BC%89%E3%80%82%20%E4%B8%BB%E8%AE%BE%E5%A4%87%E6%8E%A7%E5%88%B6%E6%97%B6%E9%92%9F%E7%BA%BF%E5%86%B3%E5%AE%9AI2C%E7%9A%84%E6%B3%A2%E7%89%B9%E7%8E%87%EF%BC%8C%E9%85%8D%E5%90%88%E6%95%B0%E6%8D%AE%E7%BA%BF%E8%BF%9B%E8%A1%8C%E6%95%B0%E6%8D%AE%E7%9A%84%E4%BC%A0%E8%BE%93%EF%BC%8C%E8%BF%99%E4%B8%A4%E6%A0%B9%E7%BA%BF%E5%88%86%E5%88%AB%E9%80%9A%E8%BF%87%E4%B8%8A%E6%8B%89%E7%94%B5%E9%98%BB%E8%BF%9E%E6%8E%A5%E5%88%B0%E7%94%B5%E6%BA%90%E3%80%82)