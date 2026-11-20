---
title: MCU基础-OTA升级
author: YooyoJin
date: 2026-11-18
last_modified_at: 2026-11-19
category: Jekyll
layout: post
mermaid: true
plantuml: true
---

上篇[BootLoader简易实现](./2026-08-18-mcu_basics_bootloader.html)把跳转跑通了，但BootLoader当然不能只会跳转。这篇把升级补上，常规方案：App运行时通过Modbus把新固件收到外部SPI Flash暂存，复位后BootLoader校验、搬运、跳转，两段式凑成完整OTA。

分工很简单：App负责收，Boot负责搬。App收固件时业务还在跑，随时可以反悔；Boot搬运时一口气干完然后复位。App从头到尾不碰自己的内部Flash。

收包阶段任何时刻断电，App本体毫发无损，大不了重收；搬运阶段内部App会被写坏，但Boot区永不自毁、外部Flash里的升级包只读不删，断电重启后重搬一遍就能恢复。任何时刻断电，芯片里都有一份能启动的Boot和一份完好的升级包来源，完美！

## 1. 整体方案

``` mermaid
graph TD
    Host[上位机] -->|Modbus分包发固件| App[App 运行中]
    App -->|分包校验写入| ExtFlash[(外部SPI Flash 暂存区)]
    App -->|收完置标志 0xA5 5A 软复位| Boot[BootLoader 0x0000]
    Boot -->|无升级标志| Jump[跳转App]
    Boot -->|有升级标志| Crc[CRC校验]
    Crc -->|通过| Move[8KB扇区搬运到内部Flash]
    Move --> Done[置完成标志 0x36 0x63 复位]
    Done --> Jump
```

分区布局：

``` cmd
内部Flash 512K                                   外部SPI Flash
|← 16K Boot →|←———— App 496K ————→|              |←—— 升级包暂存 ——→|← 标志区 →|
0x00000000   0x00004000           0x0007FFFF
```

## 2. App侧：固件接收

### 2.1. 升级包格式

App收到的不能是裸bin，起码得知道自己要收多少、收得对不对。固件前面加个升级头，整体结构：

| 字段 | 内容 | 说明 |
| --- | --- | --- |
| 长度 | 固件总字节数 | Boot搬运时按这个循环 |
| 起始地址 | 0x00004000 | App区起点 |
| 签名/版本 | 固件版本标识 | 防呆用 |
| 头CRC | 升级头校验 | 头先验，头对了才敢信长度 |
| 固件数据 | App完整bin | - |
| 整包CRC | CRC16 | 覆盖升级头+固件数据 |

CRC用Modbus查表法CRC16，原理在[CRC循环冗余校验](./2026-05-19-crc.html)写过，不重复。这里只约定校验范围：升级头（长度、起始地址、签名）+ 整包固件数据，App侧和Boot侧用同一份函数，结果为0判定正确。

### 2.2. 分包接收

Modbus一帧装不下几百KB，分包是必然的。思路：

1. 上位机把升级包按固定大小切片（如256字节/包），带包序号
1. App收到一包写外部Flash对应地址，回ACK；超时没ACK，上位机重发
1. 全部收完算整包CRC，对了才置升级标志，然后软复位，剩下的事交给Boot

<!-- TODO: 按实际实现补充Modbus寄存器规划、分包大小、是否做断点续传 -->

### 2.3. 触发升级

收完不等于升级，标志才是扳机：往外部Flash标志区`0x03FFF0`写入`0xA5 0x5A`，软复位。App自始至终不碰内部Flash——收一半崩了大不了重收，App本体毫发无损。

## 3. Boot侧：升级检查与搬运

Boot这边是升级流程里唯一的主角，上电后按部就班：先看上次有没有没干完的活，再看有没有新活，都没有就跳App。

Boot上电后的流程：
1. 初始化：时钟、外部Flash
1. 升级检查，判断是否需要固件搬运（判断升级标志）
    1. 无升级标志：直接跳转App，执行应用程序
    1. 有升级标志（App 已把完整新固件存进外部 SPI Flash）：CRC 校验 → 搬运到内部 Flash → 置完成标志 → 复位 → 跳转新 APP

### 3.1. 升级标志

反正就是一约定的东西，两个标志各管一段：

| 标志 | 地址 | 值 | 含义 |
| --- | --- | --- | --- |
| 升级请求标志 | `0x03FFF0` | `0xA5 0x5A` | 新固件已备好，待搬运 |
| 升级完成标志 | `0x03EFF0` | `0x36 0x63` | 上次升级已搬运完成 |

- `CheckIfUpdateSuccess()`：读 `0x03EFF0`，若已是 `0x36 0x63` 说明上次升级已完成，直接跳 APP
- `CheckIfNeedUpdate()`：读 `0x03FFF0`，若为 `0xA5 0x5A` 表示新固件已备好，进入升级

为什么是两个标志而不是一个？关键在掉电。只用一个标志的话，置了标志、搬完、还没来得及清，中间断电，重启后Boot分不清"要搬"还是"搬完了"——外部Flash里的包还在，重搬一遍倒也救得回来，但"上次到底成功没有"永远说不清。拆成两个之后状态就干净了：

``` cmd
App收完 ──置 0xA5 5A──→ Boot搬运 ──置 0x36 63──→ 清 0xA5 5A ──→ 跳新APP
```

- 只有 `0xA5 0x5A`：固件备好了，搬
- `0x36 0x63` 已置：搬运已完成，清请求标志直接跳
- 两个都没有：正常跳App

任何时刻断电，重新上电都能从状态里找到自己的位置，不会出现不知道自己是谁的情况。

### 3.2. CRC校验

`CheckIfCRCCorrect()`：用 __Modbus 查表法 CRC16__ 对升级头（长度、起始地址、签名）+ 整包固件数据做 CRC 校验（结果为 0 判定正确）。

校验放在搬运之前，只认外部Flash里的数据。收错了就不动内部Flash一个字节，留在Boot等App重收。几百KB读一遍外部Flash也就几秒的事，把错包搬进去才是大事。

### 3.3. 搬运

`iap_write_to_EFM()` 是整个升级的核心，以 __8KB（一个扇区）为单位__ 循环：从外部Flash读出 → 解锁EFM → 扇区擦除 → 编程写入内部Flash `0x4000` 起始的区域（App最大支持约500KB）：

``` c
#define APP_START_ADDR      (0x00004000UL)
#define FLASH_SECTOR_SIZE   (8192UL)                    /* HC32F460一个扇区8KB */

static void iap_write_to_EFM(void)
{
    uint32_t u32Addr    = APP_START_ADDR;               /* 内部Flash写地址 */
    uint32_t u32SrcAddr = EXT_FLASH_APP_ADDR;           /* 外部Flash读地址 */
    uint32_t u32Remain  = stOtaHead.u32Len;             /* 升级头里的固件长度 */
    uint8_t  au8Buf[FLASH_SECTOR_SIZE];

    while (u32Remain > 0U)
    {
        uint32_t u32Chunk = (u32Remain > FLASH_SECTOR_SIZE) ? FLASH_SECTOR_SIZE : u32Remain;

        ExtFlash_Read(u32SrcAddr, au8Buf, u32Chunk);    /* 1. 外部Flash读出一扇区 */
        EFM_Unlock();                                   /* 2. 解锁EFM */
        (void)EFM_SectorErase(u32Addr);                 /* 3. 擦内部Flash一扇区 */
        (void)EFM_Program(u32Addr, (uint32_t *)au8Buf, u32Chunk);  /* 4. 编程写入 */
        EFM_Lock();                                     /* 5. 上锁 */

        u32Addr    += u32Chunk;
        u32SrcAddr += u32Chunk;
        u32Remain  -= u32Chunk;
    }
}
```

外部Flash读函数按实际驱动替换。几个注意点：

- 搬运从低往高逐扇区推进，任何时刻断电，还没擦到的扇区仍是旧App的一部分。这也是"为什么不边收边写内部Flash"的答案：那等于边擦自己，收一半断电App直接没了
- EFM写前必须解锁、写完上锁，Boot里忘了锁死不了人，习惯要养好
- 剩余不足8KB的最后一包按实际长度收尾，别越界擦

刷写成功后：擦除两个标志扇区，回写 `0x36 0x63` 完成标记，等待外部 Flash 写完成，然后 `NVIC_SystemReset()` 复位，重启后走正常跳 APP 流程。

为什么搬完要复位而不是直接跳新App？跳转函数是现成的，调一下就过去了。但复位更干净：时钟、外设、中断状态全部归零，新App从完全确定的上电环境启动，和正常开机一模一样。直接跳的话，Boot里动过的外部Flash、时钟配置，新App未必料得到。省一次复位埋一个雷，不划算。

### 3.4. ID Code

另外在 `0x2000` 处放置了一个 ID Code（`This_ID_Code = 0x00000002`），兼容 HC32F460 的 Flash 加密/ISP 特性要求。和上篇ICG段是同一个思路：这些"开机就要读"的配置只对占着0地址的那份程序有意义，归Boot管。

<!-- TODO: ID Code当时为什么加、不加会怎样，按实际情况补充 -->

## 4. 实现

参考https://github.com/YooyoJin/my-bootloader

仓库还是上篇的结构，Boot/OTA两工程同源码库，各自维护`.ld`。关键函数：

| 函数 | 工程 | 作用 |
| --- | --- | --- |
| `CheckIfUpdateSuccess()` | Boot | 读`0x03EFF0`，`0x36 0x63`→上次已完成，直接跳APP |
| `CheckIfNeedUpdate()` | Boot | 读`0x03FFF0`，`0xA5 0x5A`→进入升级 |
| `CheckIfCRCCorrect()` | Boot | 升级头+整包CRC16校验 |
| `iap_write_to_EFM()` | Boot | 8KB扇区循环搬运 |
| App侧收包 | App | Modbus分包接收，写外部Flash |

## 常见问题&解决办法

### 升级中途断电怎么办？

靠双标志+搬运顺序扛，任意时刻断电分三种情况：

- 收包阶段断：App本体没动过，重新收即可
- 搬运阶段断：标志还是 `0xA5 0x5A`，重启后重新校验、重新搬一遍，外部Flash里的包还在
- 搬完没跳断：`0x36 0x63` 已置，重启直接跳新App

三种都不砖，最差的代价是重新收一遍包。

### 为什么用外部Flash中转，不直接写内部App区？

别问为什么不用内部Flash双分区？问就是有钱，爱用。

一是App运行时自己擦自己，收包中途任何异常都等于自杀，外部Flash方案里App本体始终完好；二是内部Flash只在最后由Boot一口气写完，写入窗口最短；三是失败重收都只发生在外部Flash，Boot的搬运逻辑保持极简。

### CRC校验失败怎么处理？

不处理就是最好的处理：内部Flash一个字节不动，留在Boot。上位机看得到升级没成，重新收包覆盖外部Flash里的旧包即可。错误数据宁可扔，不能搬。

### App最大500KB怎么算的？

512K芯片，Boot占前16K，剩496K，"约500KB"是约数。这个数和上篇`.ld`里LENGTH是一个道理，得写准，写错是慢性毒药。

### 收包时业务还在跑，冲突怎么办？

升级期间让设备进"升级模式"：业务降级或暂停，通信口专职收包。

<!-- TODO: 按实际补充：升级期间风机/压缩机等外设怎么处理、超时多久退出升级模式 -->



## 参考资料

[^1]: Joseph Yiu. (2014). _《ARM Cortex-M3与Cortex-M4权威指南（第3版，中译）》_
[^2]: Xiaohua Semiconductor. (2022). _HC32F460系列用户手册_