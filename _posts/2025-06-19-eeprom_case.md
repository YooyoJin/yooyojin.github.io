---
title: EEPROM驱动开发笔记（M24C32）
author: YooyoJin
date: 2025-06-19
last_modified_at: 2025-02-04
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
- 起始信号：数据线 ↓，时钟线 High；
- 停止信号：数据线 ↑，时钟线 High；
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
 - 前四位固定为1010，E2~E0由芯片引脚决定，R/W（`0`表示写操作，`1`表示读操作），意味值允许在同一总线上挂载最多8个（2^3）M24C32芯片；
 - M24C32容量为32Kbit(4Kbyte)，所以需要12位地址表示。因此，其完整的存储地址无法全部塞进单字节的“字节地址”部分。I²C协议在发送时，会连续发送两个字节来表示存储地址。

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
- 关于页写入（多字节写入），页的大小手册会有说明。像M24C32，每页32bytes；
- 多字节写入与单子节写入的区别，在于主机在EEPROM响应后，接着发下下一个数据。直到主机发送停止。**要注意的是当连续写入字节达到页的边界地址时该数据将会写入该页的页首，先前的数据会被覆盖**；

``` c
#define NUM 32

    {
        uint8_t data[NUM];
        for (uint8_t i = 0; i < NUM; i++) {
            data[i] = i + 1;
        }
        E2WriteMulti(0x0001, data, NUM);  // 连续写入，从地址0x0001写入32个字节，
        DelayXms(20);
    }

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
static void WriteMultiDataToI2C(uint16_t u16Addr, const uint8_t *u8Dat, uint16_t u16Len)
{
    const uint16_t u16PageSize = 32; // 以M24C32为例，页大小为32字节
    uint16_t u16Remain = u16Len;     // 剩余待写字节数
    uint16_t u16CurAddr = u16Addr;   // 当前写入地址
    const uint8_t *pu8Cur = u8Dat;   // 当前写入数据指针

    while (u16Remain > 0)
    {
        // 等待写入间隔，防止EEPROM写入过快
        while (g_uE2Interval < E2_INTERVAL_CONST)
        {
            WDT_Restart();
        }

        // 计算本次写入不跨页的最大字节数
        uint16_t u16PageOffset = u16CurAddr % u16PageSize;
        uint16_t u16BytesThisPage = u16PageSize - u16PageOffset;
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
        for (uint16_t i = 0; i < u16BytesThisPage; i++)
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
    MCU->>EEPROM: START REPEATED (SR)
    MCU->>EEPROM: Device Address (0xA0) + Chip enable address(e2,e1,e0)+ Write (0)
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
- 注意，这里在写入地址之后，需要重新发送启动信号，再发送设备地址，目的是为了解决I2C 协议在一次通信中（从 START 到 STOP）不能自动改变数据方向。

## 5. 要点总结

1. 注意SDA\SCL配置开漏输出；
1. 注意I2C时序；
1. 注意EEPROM写保护处理；
1. 注意写入E2时需要延时处理；

## 常见问题

### 软件I2C应答信号与起始信号差异，不能先进入第9时钟再拉低SDA

在我写软件I2C功能的时候发现，I2C应答信号和起始信号有所差异，它们不能混为一谈

首先我们来看下起始信号和应答信号的逻辑。
- 起始信号：数据线检测下降沿，时钟线为高；
- 应答信号：在第9个时钟周期（应答位），从机必须在时钟线高电平期间拉低数据线；

仅从上面的描述来看，是不是两个是一模一样的？在时钟线为高时，拉低数据线？

但是实际写代码的时候我发现了一些差异

``` c
static void BspM24c32I2cStart(void)
{
    BSP_I2C_SCL_HIGH;
    BSP_I2C_SDA_HIGH;
    BSP_I2C_WAIT;

    BSP_I2C_SDA_LOW;
    BSP_I2C_WAIT;

    BSP_I2C_SCL_LOW;
    BSP_I2C_WAIT;
}

// 起始信号时序：
// SCL:  ‾‾‾‾‾‾‾‾‾\_____
// SDA:  ‾‾‾‾‾‾‾‾\______
//               ↑ 在SCL高时SDA下降沿

static void BspM24c32I2cSendAck(void)
{
    BSP_I2C_SDA_LOW;
    BSP_I2C_WAIT;
    BSP_I2C_SCL_HIGH;
    BSP_I2C_WAIT;

    BSP_I2C_SCL_LOW;
    BSP_I2C_WAIT;
}

// ACK信号时序：
// SCL:  _____/‾‾‾‾\_____
// SDA:  _____↓__________
//            第9时钟（先设置低电平）

```

可以发现，起始信号，确实是符合描述，在SCL在高电平时，拉低了SDA。但是发送应答信号时，是要先拉低SDA，再完成第9个时钟周期。

**Q: 为什么会出现这样的差异？能不能先进入低9个时钟周期再拉低SDA？**<br>
**A:** 很简单，假设在第9个时钟高电平时拉低SDA，这样的话就会产生一个起始信号，这里从机看到新的起始信号，会认为通信要重新开始，破坏了当前的数据传输。再者当你在第9个时钟周期内先拉高SDA然后再变低，可能认为是先产生了一个NACK信号，再产生了一个起始信号，这样从机会进入混乱。

**Q: 为什么起始/停止条件不同？**<br>
**A:** 起始/停止条件是协议级别的控制信号，不是数据传输的一部分，它们用于通信框架控制。而数据/ACK，属于常规时序，用于数据传输。

> 起始信号："大家好，我要开始说话了！"（需要引人注意）<br>
> ACK信号："收到，请继续"（正常对话中的回应）

所以，对于起始条件：必须先SCL高，然后SDA下降沿。对于ACK信号：在SCL低时设置SDA，然后当SCL高时展示。

I2C协议规则：
1. 除起始(START)和停止(STOP)条件外，**SDA只能在SCL为低电平时改变**
2. 起始条件：SCL高时，SDA从高到低的下降沿
3. 停止条件：SCL高时，SDA从低到高的上升沿
4. ACK信号：第9个时钟周期内，SDA保持低电平

**Q: 从机如何发送应答？**<br>
**A:** 发送应答本身就是主机释放SDA，从机将SDA拉低。但是为什么在主机上面失效了？关键区别在于，谁控制SDA。主机发送ACK时，控制权在主机，主机始终控制SDA，流程：`主机读数据 → 主机拉低SDA → 主机产生时钟`。从机发送ACK时，控制权在特定时刻控制SDA，流程：`主机写数据 → 从机拉低SDA → 主机产生时钟`。

综上，就是我没有搞清楚数据流程，把他们混为一谈了。哈哈😅

### 注意写入时，要失能写保护

> After the device select code and the address bytes, the bus master sends one data byte. If the addressed location is Write-protected, by Write Control (WC) being driven high, the device replies with NoAck, and the location is not modified. If, instead, the addressed location is not Write-protected, the device replies with Ack. The bus master terminates the transfer by generating a Stop condition, as shown in Figure 9[^1].

注意写保护功能，当WC引脚被拉高时（写保护），写数据，会无NACK并且该地址位不会被修改。当没有写保护时，主机通过生成停止条件来终止数据传输。

### E2写入需等待！

问题背景：项目使用软件I2C来读写E2数据，在配置好I2C和E2后尝试读写数据，发现问题，回读数据成功，但是数据好像没有写进去。仔细核对时序后，发现I2C停止时序错误（先拉高SCL再拉低SDA保持，再拉高SDA，这可能导致从机认为这是重复起始条件，进而写入失败）。但是修复停止时序后，经过测试发现数据确实写进去了，但是无法正常读取。写入数据后，主机立即读取，从机没有应答。此时陷入无休止的对停止时序排查，怀疑停止时序问题，笑死。

尝试用示波器抓I2C波形，但是我手头上示波器只有一个探头，抓到的波形很难看。再无数次检查停止时序后，确定时序没有任何问题，开始怀疑是否是写保护导致，但是写保护应该不会影响我读取E2吧？还是尝试取消写保护，经过测试跟写保护没关系。

在不断的比对参考代码和检查时序之后，查阅手册发现写E2需要等待。在写入之后加上固定延时，问题解决。还是经验不足😅

E2有一个tw(Write time)，是E2的写入时间。这里主机通过I2C将数据给到E2后，芯片会将数据先锁存到缓冲页或缓冲区，此时I2C传输已经结束，但是真正的写入才开始，通过“隧穿”改变储存单元电压，从而实现数据固化。

> During the internal Write cycle, the device disconnects itself from the bus, and writes a copy of the data from its internal latches to the memory cells. The maximum Write time (tw) is shown in Table 17 and Table 18, but the typical time is shorter. To make use of this, a polling sequence can be used by the bus master.[^1]

> if the device is busy with the internal Write cycle, no Ack will be returned and
the bus master goes back to Step 1.

他需要tw（典型值，5ms）的时间来将数据写入储存单元。可以通过轮询来查是否写入完成，来最小化系统的延时时间。因为在写入阶段，设备处于繁忙，E2与总线断开连接，它不会返回ACK！！！

所以，这就是导致我写入之后，立即回读取导致失败的根因。总而言之，不是什么技术难题，就是一些细节问题导致时间浪费，所以在写代码的时候还是要注意细节，好在不是硬件问题，不然更头痛。

### M24C16与M24C32差异

最近换了一款容量稍小的E2，但是不能直接完全照抄M24C32的底层驱动。

通过手册可以看到M24C16的封装和M24C32一样，但是原本的123脚（E2~E0）为NA，这意味着M24C16这个型号的芯片无法通过硬件引脚来设置器件地址，因此不支持硬件级联，只能挂载一个M24C16芯片。M24C16需要占用器件地址位中的3位（A10, A9, A8）来存放内部存储地址的最高3位！

M24C16容量位16Kbit（2048字节），需要11位来寻址。
- 设备地址：1010 + 内存地址高三位（A10, A9, A8） + 读写操作位
- 地址位低8位（A7 ~ A0）：作为数据字地址在设备地址后发送

假设要访问地址0x123（二进制：0001 0010 0011）：高3位：001 → 放到设备地址的A2 A1 A0，低8位：0x23 → 作为数据地址发送

这里没有注意，习惯性的沿用了M24C32的的方式，将内存地址位分成了两个字节放在设备地址后面，导致数据异常，这里花了些时间来定位问题。

### 硬件I2C

之前多用软件I2C，因为时间充足，就尝试使用硬件I2C去读写E2，顺便熟悉新的芯片。

但是经过实际的开发体验下来，这款芯片的硬件I2C没有软件I2C灵活，虽然硬件I2C不占用CPU资源是一大优势，但是初次配置底层确实有些麻烦。得完全按照芯片的I2C例程去编写，不然很容易产生一些空的字段，有的时候还会莫名奇妙多一包数据，就很头疼。硬件I2C必须要在正确的时机检查正确的状态位，然后执行正确的操作，需要通过反复判断状态码来判断I2C状态，一单发错就收不到应答，又得定位检查。

不过相比软件I2C，用示波器去看波形，硬件I2C波形加规整，时序也更加清晰，时钟间隔也很准确。不像软件I2C用延时来翻转电平，导致时钟间隔各异。

这里主要参考了芯片的例程，做了一定修改，经过实测目前比较稳定。

``` c
#define BSP_WP_ENABLE                    Gpio_SetIO(BSP_AT24C16C_EEPROM_WP_PORT, BSP_AT24C16C_EEPROM_WP_PIN)  // 写保护使能，WP高电平
#define BSP_WP_DISABLE                   Gpio_ClrIO(BSP_AT24C16C_EEPROM_WP_PORT, BSP_AT24C16C_EEPROM_WP_PIN)  // 取消写保护，WP低电平

/**
 * @brief 发送EEPROM地址
 * @param u16Addr 要访问的地址
 * @return 发送结果
 */
static int32_t EepromSendAddress(uint16_t u16Addr)
{
    int32_t s32Ret;

    // 检查地址范围
    if (u16Addr >= AT24C16C_EEPROM_TOTAL_SIZE) {
        return CMN_ERROR_EEPROM_ADDR_ERR;
    }

    // AT24C16C地址格式：11位地址，高3位作为页选择
    uint8_t u8AddrHigh = (u16Addr >> 8) & 0x07;  // 高3位
    uint8_t u8AddrLow = u16Addr & 0xFF;          // 低8位

    // 设备地址（写模式）包含页选择位
    uint8_t u8DevAddr = AT24C16C_EEPROM_DEVICE_ADDR | (u8AddrHigh << 1);

    // 发送起始信号
    I2C_SetFunc(BSP_EEPROM_I2C, I2cStart_En);

    s32Ret = EepromCheckWriteAck();  // 检查起始条件状态
    if (s32Ret != CMN_SUCCESS) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        return s32Ret;
    }

    // 发送设备地址
    s32Ret = I2C_WriteByte(BSP_EEPROM_I2C, u8DevAddr);
    I2C_ClearIrq(BSP_EEPROM_I2C);
    if (s32Ret != CMN_SUCCESS) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        return CMN_ERROR_EEPROM_WRITE_ERR;
    }

    s32Ret = EepromCheckWriteAck();  // 检查设备地址ACK状态
    if (s32Ret != CMN_SUCCESS) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        return s32Ret;
    }

    // 发送地址低字节
    s32Ret = I2C_WriteByte(BSP_EEPROM_I2C, u8AddrLow);
    I2C_ClearIrq(BSP_EEPROM_I2C);
    if (s32Ret != CMN_SUCCESS) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        return CMN_ERROR_EEPROM_WRITE_ERR;
    }

    s32Ret = EepromCheckWriteAck();  // 检查地址低字节ACK状态
    if (s32Ret != CMN_SUCCESS) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        return s32Ret;
    }

    return CMN_SUCCESS;
}

/**
 * @brief 写入单个字节
 * @param u16Addr 写入地址
 * @param u8Data 写入数据
 * @return 写入结果
 */
int32_t BspAt24c16cEepromWriteByte(uint16_t u16Addr, uint8_t u8Data)
{
    int32_t i32Ret;

    if (!s_bEepromInitialized) {
        return CMN_ERROR_EEPROM_INIT_ERR;
    }

    // 检查地址范围
    if (u16Addr >= AT24C16C_EEPROM_TOTAL_SIZE) {
        return CMN_ERROR_EEPROM_ADDR_ERR;
    }

    BSP_WP_DISABLE;

    // 发送地址
    i32Ret = EepromSendAddress(u16Addr);
    if (i32Ret != CMN_SUCCESS) {
        BSP_WP_ENABLE;
        return i32Ret;
    }

    // 写入数据
    i32Ret = I2C_WriteByte(BSP_EEPROM_I2C, u8Data);
    I2C_ClearIrq(BSP_EEPROM_I2C);
    if (i32Ret != Ok) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        BSP_WP_ENABLE;
        return CMN_ERROR_EEPROM_WRITE_ERR;
    }

    i32Ret = EepromCheckWriteAck();
    if (i32Ret != CMN_SUCCESS) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        BSP_WP_ENABLE;
        return i32Ret;
    }

    // 发送停止信号
    I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
    I2C_ClearIrq(BSP_EEPROM_I2C);

    BSP_WP_ENABLE;

    return CMN_SUCCESS;
}

/**
 * @brief 读取单个字节
 * @param u16Addr 读取地址
 * @param pu8Data 读取数据指针
 * @return 读取结果
 */
int32_t BspAt24c16cEepromReadByte(uint16_t u16Addr, uint8_t *pu8Data)
{
    int32_t i32Ret;

    if (!s_bEepromInitialized) {
        return CMN_ERROR_EEPROM_INIT_ERR;
    }

    if (pu8Data == NULL) {
        return CMN_ERROR_EEPROM_READ_ERR;
    }

    // 检查地址范围
    if (u16Addr >= AT24C16C_EEPROM_TOTAL_SIZE) {
        return CMN_ERROR_EEPROM_ADDR_ERR;
    }

    BSP_WP_DISABLE;

    // 发送地址（写模式）
    i32Ret = EepromSendAddress(u16Addr);
    if (i32Ret != CMN_SUCCESS) {
        BSP_WP_ENABLE;
        return i32Ret;
    }

    // 重新开始信号，切换到读模式
    I2C_SetFunc(BSP_EEPROM_I2C, I2cStart_En);
    I2C_ClearIrq(BSP_EEPROM_I2C);

    i32Ret = EepromCheckReadAck();  // 检查重新开始的起始条件状态
    if (i32Ret != CMN_SUCCESS) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        BSP_WP_ENABLE;
        return i32Ret;
    }

    // 发送地址（读模式）
    i32Ret = I2C_WriteByte(BSP_EEPROM_I2C, AT24C16C_EEPROM_DEVICE_ADDR | 0x01);
    I2C_ClearIrq(BSP_EEPROM_I2C);
    if (i32Ret != CMN_SUCCESS) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        BSP_WP_ENABLE;
        return CMN_ERROR_EEPROM_READ_ERR;
    }

    i32Ret = EepromCheckReadAck();  // 检查设备地址ACK状态
    if (i32Ret != CMN_SUCCESS) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        BSP_WP_ENABLE;
        return i32Ret;
    }

    I2C_ClearFunc(BSP_EEPROM_I2C, I2cAck_En);
    I2C_ClearIrq(BSP_EEPROM_I2C);

    i32Ret = EepromCheckReadAck();  // 0x58 已接收到最后一个数据，NACK已返回
    if (i32Ret != CMN_SUCCESS) {
        I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
        I2C_ClearIrq(BSP_EEPROM_I2C);
        BSP_WP_ENABLE;
        return i32Ret;
    }

    // 准备读取最后一个字节（发送NACK）
    *pu8Data = I2C_ReadByte(BSP_EEPROM_I2C);
    LOG_DEBUG("pu8Data %d", *pu8Data);

    // 发送停止信号
    I2C_SetFunc(BSP_EEPROM_I2C, I2cStop_En);
    I2C_ClearIrq(BSP_EEPROM_I2C);

    // 恢复ACK使能
    I2C_SetFunc(BSP_EEPROM_I2C, I2cAck_En);

    BSP_WP_ENABLE;

    return CMN_SUCCESS;
}

```

## 参考资料

bujidao1128. (2025). _I2C协议详解_. [https://www.cnblogs.com/bujidao1128/p/18289812#:~:text=%E9%A1%BE%E5%90%8D%E6%80%9D%E4%B9%89%EF%BC%8C%20I2C%E9%80%9A%E8%AE%AF%E5%8F%AA%E9%9C%80%E8%A6%81%E4%B8%A4%E6%A0%B9%E7%BA%BF%EF%BC%8C%E4%B8%80%E6%A0%B9%E6%98%AF%20%E6%95%B0%E6%8D%AE%E7%BA%BFSDA%20%EF%BC%88Serial%20Data,Line%EF%BC%89%EF%BC%8C%E4%B8%80%E6%A0%B9%E6%98%AF%20%E6%97%B6%E9%92%9F%E7%BA%BFSCL%20%EF%BC%88Serial%20Clock%20Line%EF%BC%89%E3%80%82%20%E4%B8%BB%E8%AE%BE%E5%A4%87%E6%8E%A7%E5%88%B6%E6%97%B6%E9%92%9F%E7%BA%BF%E5%86%B3%E5%AE%9AI2C%E7%9A%84%E6%B3%A2%E7%89%B9%E7%8E%87%EF%BC%8C%E9%85%8D%E5%90%88%E6%95%B0%E6%8D%AE%E7%BA%BF%E8%BF%9B%E8%A1%8C%E6%95%B0%E6%8D%AE%E7%9A%84%E4%BC%A0%E8%BE%93%EF%BC%8C%E8%BF%99%E4%B8%A4%E6%A0%B9%E7%BA%BF%E5%88%86%E5%88%AB%E9%80%9A%E8%BF%87%E4%B8%8A%E6%8B%89%E7%94%B5%E9%98%BB%E8%BF%9E%E6%8E%A5%E5%88%B0%E7%94%B5%E6%BA%90%E3%80%82](https://www.cnblogs.com/bujidao1128/p/18289812#:~:text=%E9%A1%BE%E5%90%8D%E6%80%9D%E4%B9%89%EF%BC%8C%20I2C%E9%80%9A%E8%AE%AF%E5%8F%AA%E9%9C%80%E8%A6%81%E4%B8%A4%E6%A0%B9%E7%BA%BF%EF%BC%8C%E4%B8%80%E6%A0%B9%E6%98%AF%20%E6%95%B0%E6%8D%AE%E7%BA%BFSDA%20%EF%BC%88Serial%20Data,Line%EF%BC%89%EF%BC%8C%E4%B8%80%E6%A0%B9%E6%98%AF%20%E6%97%B6%E9%92%9F%E7%BA%BFSCL%20%EF%BC%88Serial%20Clock%20Line%EF%BC%89%E3%80%82%20%E4%B8%BB%E8%AE%BE%E5%A4%87%E6%8E%A7%E5%88%B6%E6%97%B6%E9%92%9F%E7%BA%BF%E5%86%B3%E5%AE%9AI2C%E7%9A%84%E6%B3%A2%E7%89%B9%E7%8E%87%EF%BC%8C%E9%85%8D%E5%90%88%E6%95%B0%E6%8D%AE%E7%BA%BF%E8%BF%9B%E8%A1%8C%E6%95%B0%E6%8D%AE%E7%9A%84%E4%BC%A0%E8%BE%93%EF%BC%8C%E8%BF%99%E4%B8%A4%E6%A0%B9%E7%BA%BF%E5%88%86%E5%88%AB%E9%80%9A%E8%BF%87%E4%B8%8A%E6%8B%89%E7%94%B5%E9%98%BB%E8%BF%9E%E6%8E%A5%E5%88%B0%E7%94%B5%E6%BA%90%E3%80%82)

[^1]: STMicroelectronics. (2008). _M24C32-WMN6TP 数据手册_. [https://item.szlcsc.com/datasheet/M24C32-WMN6TP/8475.html?spm=sc.it.pdf.fd&lcsc_vid=RgJYV10FT1hbUFFTQAVdUQBRQgIPV1BfT1ILVFwDQlUxVlNQQVVWUF1VQlJZXzsOAxUeFF5JWBYZEEoEHg8JSQcJGk4%3D](https://item.szlcsc.com/datasheet/M24C32-WMN6TP/8475.html?spm=sc.it.pdf.fd&lcsc_vid=RgJYV10FT1hbUFFTQAVdUQBRQgIPV1BfT1ILVFwDQlUxVlNQQVVWUF1VQlJZXzsOAxUeFF5JWBYZEEoEHg8JSQcJGk4%3D)