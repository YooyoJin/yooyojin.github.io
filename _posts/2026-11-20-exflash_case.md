---
title: 外部Flash驱动开发笔记（GD25Q16E）
author: YooyoJin
date: 2026-11-20
last_modified_at: 2026-11-20
category: Jekyll
layout: post
mermaid: true
---

NOR Flash这里不再过多介绍，以GD25Q16E为例。这次的应用场景是bootloader：升级镜像先暂存到外部Flash，校验通过后再搬运到内部Flash的APP区，所以先得把外部Flash的驱动跑通。上一颗[EEPROM驱动开发笔记（M24C32）](./2025-06-19-eeprom_case.html)走的是I2C，这次换成SPI，本次开发用的是GPIO模拟的SPI。

## 1. 关键信息

首先根据芯片手册，我们可以提取到一些关键信息[^1]：

- 标准SPI + Dual SPI + Quad SPI三种模式，标准SPI只用到4根线（SCLK、CS#、SI、SO）；高速读时钟最高133MHz，Dual I/O等效266Mbit/s，Quad I/O等效532Mbit/s（本驱动用GPIO模拟SPI，跑不了这么快，只用标准SPI）；
- 内存大小16Mbit(2048KByte)，每页大小256bytes，共计8K页；每扇区4KB（512个扇区），每块32KB/64KB（64/32个块），扇区架构统一（Uniform Sector）；
- 工作电压2.7V到3.6V，单电源供电；
- 页编程时间典型0.4ms，扇区擦除典型45ms，块擦除典型0.15s(32KB)/0.25s(64KB)，整片擦除典型6s；
- 最少10万次擦写周期，20年数据保持；
- 待机电流典型11μA，深度掉电（Deep Power-Down）电流典型1μA；
- 支持128bit唯一ID；
- SPI模式0（CPOL=0, CPHA=0）和模式3都支持：输入数据在SCLK上升沿锁存，输出数据在SCLK下降沿移出；

注意：GD25Q16E的命令集可以与Winbond的W25Qxx系列兼容，直接套用前还是要对手册核对命令码和时序参数，不同厂商之间总有细节差异。

## 2. 存储机制

NOR Flash和EEPROM最大的区别在于：Flash只能把1写成0，不能把0写成1。所以写入前必须先擦除，擦除的操作就是把整个区域全部恢复成0xFF。而且擦除不是按字节来的，最小擦除单位是扇区（4KB），而写入最小单位是页（256B）。

这就引出了使用外部Flash的两条铁律：
- 先擦后写：向一个"脏"区域（不是全FF）直接编程，结果是数据错乱，不是写入失败；
- 写不能跨页：一次页编程最多写256字节，且如果起始地址不是页对齐的，写到页边界时地址会在页内回卷，覆盖掉本页开头的数据，而不是自动流到下一页。

Flash写入数据和EEPROM类似，也分为两个阶段，一个阶段是数据从MCU发给Flash的页缓冲（256-Byte Page Buffer），另外一个阶段是从buffer里面写入到存储阵列（这个阶段不需要MCU参与）：

``` mermaid
graph TD
    Master[主机（MCU）]
    FController[命令与控制逻辑]
    FBuffer[256字节页缓冲]
    FStorageUnit[Flash存储阵列]
    HVGen[高压发生器]

    Master -->|SPI| FController;
    FController --> FBuffer;
    FBuffer -->|固化| FStorageUnit;
    HVGen -->|擦除/编程高压| FStorageUnit;
```

手册的Block Diagram里除了页缓冲，还有高压发生器（High Voltage Generators）——Flash的擦写依赖芯片内部产生的高压脉冲，这也是擦写比读取慢得多、且擦写次数有限的根本原因。和EEPROM一样，这个固化过程是自定时的：CS#拉高后Flash内部自动完成，MCU只需要轮询状态寄存器等它忙完。

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
    </style>
</head>
<body>
    <table>
        <thead>
            <tr>
                <th>Pin No.</th>
                <th>Pin Name</th>
                <th>I/O</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>1</td>
                <td>CS#</td>
                <td>I</td>
                <td>Chip Select Input（片选，低有效）</td>
            </tr>
            <tr>
                <td>2</td>
                <td>SO (IO1)</td>
                <td>I/O</td>
                <td>Data Output（数据输出）</td>
            </tr>
            <tr>
                <td>3</td>
                <td>WP# (IO2)</td>
                <td>I/O</td>
                <td>Write Protect Input（写保护）</td>
            </tr>
            <tr>
                <td>4</td>
                <td>V<sub>SS</sub></td>
                <td></td>
                <td>Ground</td>
            </tr>
            <tr>
                <td>5</td>
                <td>SI (IO0)</td>
                <td>I/O</td>
                <td>Data Input（数据输入）</td>
            </tr>
            <tr>
                <td>6</td>
                <td>SCLK</td>
                <td>I</td>
                <td>Serial Clock Input</td>
            </tr>
            <tr>
                <td>7</td>
                <td>HOLD# (IO3)</td>
                <td>I/O</td>
                <td>Hold Input（暂停通信）</td>
            </tr>
            <tr>
                <td>8</td>
                <td>V<sub>CC</sub></td>
                <td></td>
                <td>Power Supply</td>
            </tr>
        </tbody>
    </table>
</body>
</html>

_**说明**_
- CS#在芯片未选中时必须拉高，上电后任何时刻都不能悬空；
- WP#拉低时进入硬件保护模式，状态寄存器的保护位被锁死，禁止修改（配合软件保护位BP4-BP0可实现整片或局部区域写保护）；
- HOLD#拉低可以暂停串行通信（要求CS#保持低、SCLK为低），用于主机被更高优先级任务打断的场景，恢复后继续未完成的传输，不会丢失数据；
- WP#和HOLD#只在Quad模式关闭（QE=0，默认）时有效；QE=1时这两根线变成IO2/IO3数据线。手册建议WP#/HOLD#直连电源或地时保持QE=0，避免短路风险。本驱动只用标准SPI，QE保持默认0即可；

本工程的实际引脚映射（HC32F460，GPIO模拟SPI，定义在`bsppinmap.h`）：

``` c
// 外部SPI Flash (GPIO模拟SPI, W25Qxx)
#define BSP_EXFLASH_CS_PORT               GPIO_PORT_H
#define BSP_EXFLASH_CS_PIN                GPIO_PIN_02
#define BSP_EXFLASH_SCK_PORT              GPIO_PORT_E
#define BSP_EXFLASH_SCK_PIN               GPIO_PIN_06
#define BSP_EXFLASH_MOSI_PORT             GPIO_PORT_E
#define BSP_EXFLASH_MOSI_PIN              GPIO_PIN_05
#define BSP_EXFLASH_MISO_PORT             GPIO_PORT_E
#define BSP_EXFLASH_MISO_PIN              GPIO_PIN_04
```

```
     主机(MCU)                          从机(GD25Q16E)
   ┌──────────┐                      ┌──────────┐
   │ MOSI     ├──────────────────────→ SI       │
   │ MISO     ←──────────────────────┤ SO       │
   │ SCK      ├──────────────────────→ SCK      │
   │ CS       ├──────────────────────→ CS#      │
   └──────────┘                      └──────────┘
```

## 4. 命令集与状态寄存器

GD25Q16E的命令集很多很长（含Dual/Quad读、安全寄存器、SFDP等），本驱动只用到最基础的6条：

| 指令 | 命令码 | 说明 |
|---|---|---|
| WREN | 06H | 写使能（编程/擦除/写状态寄存器前必须先发） |
| RDSR | 05H | 读状态寄存器（可连续读，重复输出状态字节） |
| READ | 03H | 读数据（24位地址，地址自增，可一直读下去） |
| PP | 02H | 页编程（单次最多256字节，不能跨页） |
| SE | 20H | 扇区擦除（4KB） |
| RDI | ABH | 释放深度掉电（兼读Device ID） |

_**说明**_
- 深度掉电模式（DP, B9H）下所有命令都被忽略，仅响应释放命令ABH和软件复位（66H+99H），电流降到1μA——bootloader长时间待机的场景很有用，代价是使用前必须先唤醒；
- 写使能（WREN）执行后状态寄存器的WEL位置1，它是易失且只读的：每次编程/擦除完成后硬件自动清零。也就是说每次页编程、每次扇区擦除之前都要重新发一次WREN，这点很容易漏。

状态寄存器低位两个bit是驱动的核心判据：

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
    </style>
</head>
<body>
    <table>
        <thead>
            <tr>
                <th>Bit</th>
                <th>Name</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>S1</td>
                <td>WEL</td>
                <td>Write Enable Latch，写使能锁存。写使能后置1，编程/擦除完成后自动清零</td>
            </tr>
            <tr>
                <td>S0</td>
                <td>WIP</td>
                <td>Write In Progress，擦/写进行中。1=忙，0=空闲</td>
            </tr>
        </tbody>
    </table>
</body>
</html>

标准判忙做法是只看WIP（bit0），WIP清零即空闲。而RDSR有个特性：CS#保持低时可以连续读，SO会重复输出状态字节。本驱动的判忙策略把WIP和WEL一起检查（`&0x03`），两个状态字节的低两位同时为0才判空闲，作为保险。

## 5. 驱动实现

参考[https://github.com/YooyoJin/my-bootloader](https://github.com/YooyoJin/my-bootloader)

### 5.1. GPIO模拟SPI

为什么不直接用MCU的SPI硬件外设？各种原因吧，主要还是相信前人的智慧。bootloader阶段，寄存器配置越少、外设开得越少，出问题的概率也越小嘛。而且这段代码好复用。

发送字节（MSB先出，模式0）：

``` c
/** @brief 发送单字节(MSB先出) */
static void SpiSendByte(uint8_t u8Data)
{
    uint8_t u8i;

    for (u8i = 0u; u8i < 8u; u8i++)
    {
        if (u8Data & 0x80u)
        {
            EXFLASH_MOSI_HIGH();
        }
        else
        {
            EXFLASH_MOSI_LOW();
        }
        u8Data <<= 1;
        SpiDelayShort();
        EXFLASH_SCK_LOW();
        __NOP();
        SpiDelayMid();
        EXFLASH_SCK_HIGH();
        SpiDelayLong();
    }
}
```

接收字节：

``` c
/** @brief 接收单字节(MSB先入) */
static uint8_t SpiRecvByte(void)
{
    uint8_t u8i;
    uint8_t u8Data = 0u;

    for (u8i = 0u; u8i < 8u; u8i++)
    {
        u8Data <<= 1;
        EXFLASH_SCK_LOW();
        SpiDelayMid();
        if (EXFLASH_MISO_READ())
        {
            u8Data |= 1u;
        }
        EXFLASH_SCK_HIGH();
        SpiDelayMid();
    }
    EXFLASH_SCK_LOW();

    return u8Data;
}
```

时序要点：
- SPI相关参考[SPI工作原理](./2025-03-10-wired_communication_protocol_basics.html#32-spi的基本通信过程)
- CS 被拉低选中从机后，SCLK 才会开始翻转
- 输出数据在SCLK低电平期间建立，SCLK上升沿Flash锁存输入——对应手册"输入数据在上升沿锁存"；
- 读数据时在SCLK低电平期间采样MISO（Flash在下降沿移出下一位，低电平中间正是数据稳定窗口），上升沿打回去准备下一位；
- 延时函数（`SpiDelayShort/Mid/Long`）里NOP的次数是按主频整定的经验值，换板换主频需要复核，别当成精确时序用——GPIO模拟SPI本来就是"慢而稳"的打法，实际时钟远低于手册上限，裕量很大。

模式0：CPOL=0（SCLK 空闲时为低电平）, CPHA=0（第一个时钟边沿采样（需保持稳定），第二个时钟边沿移除（允许改变数据））[^2]
``` cmd
CS    ────┐                                                               ┌────
          └───────────────────────────────────────────────────────────────┘
          ▲选中设备                                                    ▲结束
SCLK        ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐
      ──────┘   └───┘   └───┘   └───┘   └───┘   └───┘   └───┘   └───┘   └──────
            ▲   ▼   ▲   ▼   ▲   ▼   ▲   ▼   ▲   ▼   ▲   ▼   ▲   ▼   ▲   ▼
          采样  移出
MOSI  ─── b7 ──┐        ┌─ b5 ──┐       ┌─ b3 ──┐       ┌─ b1 ──┐       ┌───
               └── b6 ──┘       └─ b4 ──┘       └─ b2 ──┘       └─ b0 ──┘
▲主机→从机
MISO  ─── r7 ──┐        ┌─ r5 ──┐       ┌─ r3 ──┐       ┌─ r1 ──┐       ┌───
               └── r6 ──┘       └─ r4 ──┘       └─ r2 ──┘       └─ r0 ──┘
▲从机→主机

选中阶段：CS拉低。此刻，SI (MOSI) 和 SO (MISO) 的第1个bit已经准备好并在线上了。
第1个上升沿：采样（读取SI上的第1个bit）。
第1个下降沿：移出（主机把第2个bit推到SI上，从机把第2个bit推到SO上）。
第2个上升沿：采样（读取第2个bit）。
第2个下降沿：移出（准备第3个bit）。
循环往复... 直到第8个上升沿读完最后一个bit。
结束阶段：CS拉高，SCLK停止，通信结束。
```

### 5.2. 读数据

READ(03H)是顺序读：发命令+24位地址后，只要CS#保持低，Flash就持续输出，地址自动递增，可以一口气读完整个芯片。所以读操作一次CS包络搞定，不需要分页：

``` c
/** @brief 从外部Flash连续读数据(单次CS包络, 0x03命令+24位地址+数据) */
void BspExFlashRead(uint32_t u32Addr, uint8_t *pu8Buf, uint32_t u32Len)
{
    SpiCsActive();
    SpiSendByte(EXFLASH_CMD_READ_DATA);
    SpiSendByte((uint8_t)(u32Addr >> 16));  // 地址高字节在前
    SpiSendByte((uint8_t)(u32Addr >> 8));
    SpiSendByte((uint8_t)u32Addr);
    while (u32Len != 0u)
    {
        *pu8Buf++ = SpiRecvByte();
        u32Len--;
    }
    SpiCsIdle();
}
```

地址是24位大端序（高字节在前），2MB容量A23-A0正好够用。

### 5.3. 页编程

写操作是"写使能→页编程→等空闲"的循环。关键在页边界处理：起始地址不页对齐时，在256B页边界处主动断开，重新走一遍"写使能+页编程"。判断到达页边界的方法很取巧——地址低8位回卷成0，说明刚好跨过一页：

``` c
void BspExFlashWrite(uint32_t u32Addr, const uint8_t *pu8Buf, uint32_t u32Len)
{
    while (u32Len != 0u)
    {
        SpiSendCommand(EXFLASH_CMD_WRITE_ENABLE);

        SpiCsActive();
        SpiSendByte(EXFLASH_CMD_PAGE_PROGRAM);
        SpiSendByte((uint8_t)(u32Addr >> 16));
        SpiSendByte((uint8_t)(u32Addr >> 8));
        SpiSendByte((uint8_t)u32Addr);
        while (u32Len != 0u)
        {
            SpiSendByte(*pu8Buf++);
            u32Len--;
            u32Addr++;
            if (0u == (uint8_t)u32Addr)  // 低8位回卷说明到达页边界
            {
                break;
            }
        }
        SpiCsIdle();

        (void)BspExFlashWaitIdle(1000u);  // 等待本页编程完成
    }
}
```

注意外层`while (u32Len != 0u)`：内层循环退出有两种可能——数据发完了，或者到了页边界。只有数据发完时u32Len为0，外层循环才会结束；页边界断开的情况会重新发WREN开始下一页。

这里如果偷懒不拆页，超过页边界的部分会回卷覆盖页首数据，而且这个错误很阴险：页内写入的小数据全对，一旦写大镜像就坏，问题现象和根因隔得很远。

### 5.4. 扇区擦除

擦除和编程同构，只是命令换成20H、之后等待的时间长得多（典型45ms，恶劣条件上限放宽到500ms以上，驱动按10000轮询超时兜底）：

``` c
/** @brief 擦除外部Flash一个扇区: 写使能→扇区擦除→等空闲 */
void BspExFlashSectorErase(uint32_t u32Addr)
{
    SpiSendCommand(EXFLASH_CMD_WRITE_ENABLE);

    SpiCsActive();
    SpiSendByte(EXFLASH_CMD_SECTOR_ERASE);
    SpiSendByte((uint8_t)(u32Addr >> 16));
    SpiSendByte((uint8_t)(u32Addr >> 8));
    SpiSendByte((uint8_t)u32Addr);
    SpiCsIdle();

    (void)BspExFlashWaitIdle(10000u);  // 扇区擦除典型45ms, 上限放宽
}
```

### 5.5. 判忙轮询与踩坑复盘

标准的判忙实现：轮询RDSR直到WIP=0。本驱动是这么写的：

``` c
bool BspExFlashWaitIdle(uint16_t u16TimeoutMs)
{
    uint8_t  au8Status[2];
    uint16_t u16Inner;

    do
    {
        u16Inner = 5u;  // 每轮内层轮询次数, 约等效1ms(按SPI速度整定)
        do
        {
            SpiCsActive();
            SpiSendByte(EXFLASH_CMD_READ_STATUS);
            au8Status[0] = SpiRecvByte();
            au8Status[1] = SpiRecvByte();
            SpiCsIdle();

            if (((au8Status[0] & 0x03u) == 0u) && ((au8Status[1] & 0x03u) == 0u))
            {
                return true;  // WIP/WEL均清零, 空闲
            }
        } while (--u16Inner);
    } while (--u16TimeoutMs);

    return false;  // 超时仍忙
}
```

注意：
- 一次CS包络里连续读了两个状态字节。前面说过RDSR可以连续读，两个字节都是有效的状态快照，两个都检查等于免费加了一次确认；
- 判空闲条件是WIP和WEL同时清零，而不是只看WIP。这个驱动是从一个老工程移植过来的，原工程只有检查WIP，改为检查bit0/bit1（WIP+WEL）同时为0。语义上：WIP=1说明还在擦写，WEL=1说明写使能还挂着（即将开始或正在进行），两个都清零才是干净的空闲态。严格来说只查WIP就足够正确，WEL参与判定属于偏保守的实现——代价是如果WEL因为某种异常残留为1，会一直等到超时并返回false。把`WaitIdle`的返回值设计成`bool`并在调用处用超时兜底。

### 5.6. 深度掉电唤醒

如果系统用完Flash后发了B9H进入深度掉电省电，下次使用前必须先唤醒。释放命令就是ABH：

``` c
/** @brief 唤醒外部Flash: 释放深度掉电 + 等待起振 */
void BspExFlashWakeUp(void)
{
    uint16_t u16i;

    SpiSendCommand(EXFLASH_CMD_RELEASE_DPD);

    u16i = 37u;  // 约1.5us*25, 原工程唤醒等待整定值
    do
    {
        __NOP();
        __NOP();
        __NOP();
        __NOP();
    } while (--u16i);
}
```

手册规定释放后CS#必须保持高电平等待tRES1（典型20μs）才恢复接收命令。这里的等待循环次数是原工程按实际主频整定的值，移植到不同主频的MCU上时需要重新估算。

## 6. 在bootloader中的应用

驱动只是手段，最终服务于IAP升级流程：外部Flash作为升级镜像的暂存区，App侧收到新固件写入外部Flash，置请求标志，复位进bootloader校验搬运。升级协议在Flash里的布局约定如下：

| 地址 | 内容 |
|---|---|
| 0x000000 | 16B升级头(镜像长度3B+起始地址3B+签名码3B+预留7B, 大端) |
| 0x000010 | 固件镜像(长度=升级头镜像长度字段) |
| 镜像尾部 | 2B CRC16(Modbus) |
| 0x03EFF0 | 升级完成标志扇区(2B: 0x36 0x63) |
| 0x03FFF0 | 升级请求标志扇区(2B: 0xA5 0x5A) |

两个标志位各占一个独立扇区，就是因为Flash的擦除粒度是扇区：标志扇区必须能单独擦写，不能和别的数据混在同一个4KB里——因为"先擦后写"约束，还是独立出来避免影响程序内容。升级流程的细节另外开一篇，见[MCU基础-OTA升级](./2026-11-18-mcu_basics_bootloader_upgrade.html)。

## 参考资料

[^1]: GigaDevice. _GD25Q16E Datasheet (Uniform Sector Dual and Quad Serial Flash)_.

[^2]: wjjj. (2022). _一文搞懂spi协议4种模式时序_. [https://zhuanlan.zhihu.com/p/386787861](https://zhuanlan.zhihu.com/p/386787861)