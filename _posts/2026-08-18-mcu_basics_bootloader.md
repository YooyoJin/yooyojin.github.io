---
title: MCU基础-BootLoader简易实现
author: YooyoJin
date: 2026-08-18
last_modified_at: 2026-08-18
category: Jekyll
layout: post
mermaid: true
plantuml: true
---

BootLoader原理在[MCU基础](./2025-03-31-mcu_basics.html#26-bootloader)章节有相关理解与总结。

最近在HC32F460上搞OTA升级，自然绕不开BootLoader。整体思路很朴素：Boot放在Flash开头，负责升级和跳转；APP挪到后面干活。芯片是HC32F460PETB，512K Flash，规划Boot占前16K，APP从0x4000开始：

``` cmd
|← 16K BootLoader →|←——————— APP ———————→|
0x00000000         0x00004000            0x0007FFFF
```

``` mermaid
graph TD
    Reset[上电复位] --> Boot[BootLoader @ 0x0000]
    Boot -->|有升级标志| OTA[搬运固件到APP区]
    OTA --> Jump[跳转]
    Boot -->|无升级| Jump
    Jump --> APP[APP @ 0x4000]
```

经过理论的熏陶后，这似乎看起来很简单，但实际动手还是踩了一些坑：地址不知道改哪、LENGTH算错、链接报错看不懂、Keil和GCC行为还不一样、跳转代码里埋雷……这些问题统一整理在文末，正文先把实现跑通。

## 1. 实现思路

设计两个独立工程：`My-Bootloader`（Boot）、`My-OTA`（APP），同源码库结构，各自维护一份`.ld`和`hc32f4xx_conf.h`。

要做的事情就三件：

1. **APP搬家**：告诉链接器"程序从0x4000开始放"，并且中断向量表要跟着搬；
1. **Boot跳转**：从APP区取出SP和复位向量，关干净中断，切栈跳过去；
1. **两边配套**：Boot关掉的中断，APP要负责打开。

对应到具体修改点：

| 位置 | 工程侧 | 作用 | 本例取值 |
| --- | --- | --- | --- |
| `.ld`链接脚本的`MEMORY ORIGIN` | APP | 代码真正的链接地址（核心） | 0x00004000 |
| `.ld`的`LENGTH` | APP | APP可用区域大小 | 496K |
| `VTOR`（向量表偏移） | APP | 中断向量表重定位 | 0x4000 |
| `LL_ICG_ENABLE` | APP | 关闭ICG段（不归APP管） | DDL_OFF |
| `__enable_irq()` | APP | 恢复被Boot关掉的总中断 | - |
| 跳转地址 | Boot | 跳转入口 | 0x4000 |
| `LL_ICG_ENABLE` | Boot | 保持打开（ICG烧在0x400） | DDL_ON |

注意：其中**三处地址必须严格一致**，`.ld`的ORIGIN == APP的VTOR == Boot跳转地址。向量表偏移还有个硬件约定：必须128字节（0x400）对齐！0x4000满足要求。

## 2. APP工程改动

### 2.1. 链接脚本（.ld）

`MEMORY`区块里把FLASH的起点挪到0x4000，长度记得减掉Boot占的16K：

``` ld
/* My-OTA: HC32F460xE.ld */
MEMORY
{
    FLASH       (rx): ORIGIN = 0x00004000, LENGTH = 496K    /* 512K - 16K */
    RAM        (rwx): ORIGIN = 0x1FFF8000, LENGTH = 188K
    RET_RAM    (rwx): ORIGIN = 0x200F0000, LENGTH = 4K
}
```

**RAM不用动**：Boot跳转APP后，RAM会被APP的启动代码重新初始化，不用给Boot让位。

### 2.2. 向量表重定位（VTOR）

`system_hc32f460.c`里把`VECT_TAB_OFFSET`改成APP起始地址，`SystemInit()`里已经写好了设置代码，改宏就行：

``` c
/* Vector Table base offset field */
#ifndef VECT_TAB_OFFSET
#define VECT_TAB_OFFSET                 (0x4000UL)     /*!< This value must be a multiple of 0x400. */
#endif

void SystemInit(void)
{
    // ...
    /* Configure the Vector Table relocation */
    SCB->VTOR = VECT_TAB_OFFSET;    /* Vector Table Relocation */
}
```
注意：This value must be a multiple of 0x400. 硬性约定向量表偏移，如果不满足会怎样呢？中断会无法进入吗？

### 2.3. 关闭ICG段

APP不占0地址，ICG段（详见常见问题）留着只会报链接错误，直接关掉：`hc32f4xx_conf.h`里

``` c
#define LL_ICG_ENABLE                               (DDL_OFF)
```

同时把`.ld`里钉死ICG地址的这段删掉（或注释），避免以后误开开关再报错：

``` ld
/* 删除：
.icg_sec 0x00000400 :
{
    KEEP(*(.icg_sec))
} >FLASH
*/
```

### 2.4. 恢复总中断

Boot跳转前会`__disable_irq()`，这个状态会带进APP，而启动代码和`SystemInit()`都不会自动打开。所以APP的main早期（任何外设中断使能之前）补一句：

``` c
void main(void)
{
    __enable_irq();     /* Boot关的，APP来开 */
    // ...外设初始化
}
```

## 3. BootLoader工程改动

Boot的`.ld`保持从0地址开始，`LL_ICG_ENABLE`保持`DDL_ON`，基本不用动。核心就是跳转函数。

### 3.1. 跳转函数

先看最初能跑的版本：

``` c
static void JumpToApp(uint32_t u32AppAddr)
{
    uint32_t u32AppSp = *(volatile uint32_t *)u32AppAddr;        // 1. 拿APP的堆栈指针
    uint32_t u32AppPc = *(volatile uint32_t *)(u32AppAddr + 4);  // 2. 拿APP的复位向量
    __set_MSP(u32AppSp);                                         // 3. 设主堆栈
    void (*pAppReset)(void) = (void (*)(void))u32AppPc;
    pAppReset();                                                 // 4. 跳！
}
```

原理：APP向量表的前两个字就是初始SP和Reset_Handler地址（和正常上电复位CPU做的事情一样），取出来设好MSP直接跳。烧进去实测能跳，happy path是通的。

但这是"裸跳"，坑不少（详见常见问题），加固版：

``` c
static void JumpToApp(uint32_t u32AppAddr)
{
    uint32_t u32AppSp = *(volatile uint32_t *)u32AppAddr;
    uint32_t u32AppPc = *(volatile uint32_t *)(u32AppAddr + 4U);

    /* 防空：APP未烧写/被擦除（擦除态为0xFFFFFFFF） */
    if ((u32AppSp | u32AppPc) == 0xFFFFFFFFUL) {
        return;   /* 留在Boot，调用方while(1)或等待升级 */
    }

    __disable_irq();
    SysTick->CTRL = 0U;                       /* 关Boot用过的中断源 */

    for (int i = 0; i < 5; i++) {             /* 清144个IRQ：失能+清pending */
        NVIC->ICER[i] = 0xFFFFFFFFUL;
        NVIC->ICPR[i] = 0xFFFFFFFFUL;
    }
    __DSB();  __ISB();

    __set_MSP(u32AppSp);
    __ISB();
    ((void (*)(void))u32AppPc)();
    while (1);
}
```

几个要点：

1. **防空检查**：空片时`0x4000`处是`0xFFFFFFFF`，不做检查直接`__set_MSP(0xFFFFFFFF)`就HardFault了，两行代码防生产事故；
1. **关中断源+清NVIC**：Boot用过的SysTick、定时器、串口中断都还在跑，只关全局中断不够干净，把NVIC的使能位和pending位也清了（HC32F460是Cortex-M4，144个IRQ，5组32位寄存器）；
1. **`__DSB()/__ISB()`**：保证前面的寄存器操作真正生效后再切栈；
1. **切栈后不回头**：`__set_MSP()`之后当前函数就没有栈了，所以所有取值都提前做完，切完直接跳。

### 3.2. main流程

``` c
void main(void)
{
    System_Init();
    LOG_ERROR("Boot V0.1");

    // todo 读外部Flash、校验固件、搬运到APP区（OTA主体，后续补充）

    JumpToApp(APP_START_ADDR);

    while (1);     /* 正常不会到这，防空跳失败 */
}
```

建议裸数字`0x4000`统一用宏`APP_START_ADDR`，`.ld`、VTOR、跳转三处共用一个定义，避免改一处漏两处。

## 4. 实测效果

1. 先不要修改APP工程偏移地址，保证APP程序内容能正常运行，这里工程仅设计了指示灯与日志心跳打印功能。
1. 修改偏移地址，并重新编译。此时单独烧录APP工程无法正常工作。
1. 编译BootLoader工程。
1. 将APP工程改动和BootLoader工程编译出来的`.hex`文件merge一下，重新烧录。观察指示灯与日志心跳，日志正常打印，证明程序跳转成功。

运行日志如下，可以看到已经成功跳转。
``` cmd
00> [INFO ]  cmn_log.c:50 _SEGGER_RTT: 0x1FFF8904
00> [INFO ]  main.c:41 SystemCoreClock: 200000000Hz
00> [INFO ]  main.c:42 ->APP
00> [DEBUG]  bsp_led.c:57 Heart beats, 0
00> [DEBUG]  bsp_led.c:57 Heart beats, 1
00> [DEBUG]  bsp_led.c:57 Heart beats, 2
00> [DEBUG]  bsp_led.c:57 Heart beats, 3
00> [DEBUG]  bsp_led.c:57 Heart beats, 4
00> [DEBUG]  bsp_led.c:57 Heart beats, 5
00> [DEBUG]  bsp_led.c:57 Heart beats, 6
00> [DEBUG]  bsp_led.c:57 Heart beats, 7
...
```

## 5. 要点总结

1. 改程序地址是改`.ld`的`ORIGIN`，配套改APP的`VTOR`和Boot的跳转地址，三处一致；
1. `LENGTH`是从ORIGIN开始的大小，APP偏移后记得减：`LENGTH = 总容量 - 偏移量`；
1. RAM不用给Boot让位，APP启动代码会重新初始化；
1. HC32的ICG段钉死在0x400，只属于占0地址的BootLoader；APP关掉`LL_ICG_ENABLE`，Boot保持打开；
1. 跳转前：防空检查、关中断、清NVIC、切MSP；跳转后：APP记得`__enable_irq()`。

## 常见问题

### 改程序地址是改CMake的objcopy吗？

不是。工程是CMake+GCC工具链，CMakeLists里生成hex/bin的后处理命令里有个`--change-addresses`参数：

``` cmake
add_custom_command(TARGET ${PROJECT_NAME}.elf POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O ihex --change-addresses 0x0000 $<TARGET_FILE:${PROJECT_NAME}.elf> ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/${PROJECT_NAME}.hex
    COMMAND ${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:${PROJECT_NAME}.elf> ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/${PROJECT_NAME}.bin
    COMMENT "Generating hex and binary files"
    COMMAND size $<TARGET_FILE:${PROJECT_NAME}.elf>
)
```

`--change-addresses`只是给生成的hex文件里的地址记录整体加一个偏移量，属于"输出文件层面的地址平移"，不会改变代码真正被链接到的地址。而且这里写的是`0x0000`，等于完全没作用（顺手删掉更干净）。如果改成比如`0x10000`，只会得到一个"看起来"在新地址的hex，固件内部所有绝对地址（向量表、函数跳转、常量访问）仍是旧地址，烧进去程序必跑飞！这里要注意

### LENGTH需要改吗？程序过大怎么办？

需要。`LENGTH`是**从ORIGIN开始算的这段区域的大小**，不是芯片总容量。写成512K的话，0x00004000 + 512K = 0x00084000，超出芯片实际Flash结尾0x0007FFFF整整16K。

**Q: 程序过大，会写到芯片别的地方吗？**<br>
**A:** LENGTH写对时不会。链接器只会把代码放进`.ld`定义的FLASH区域，放不下时**链接直接报错**，根本不会生成hex/bin：

```
region `FLASH' overflowed by 1234 bytes
section `.text' will not fit in region `FLASH'
```

链接器没有任何"自动找别的地方放"的行为——每个section只会进显式指定的MEMORY区域，放不下就报错。这就是LENGTH要写准的意义：编译期保险。LENGTH写错时才是慢性毒药：程序涨到496K~512K之间，链接器误以为空间够，链接"成功"，hex里包含芯片上根本不存在的地址，烧写时报错或静默截断，程序跑飞。

真正会"写到别处"的唯一途径：在`.ld`里显式定义了多个区域（比如末尾的Data Flash、OTA备份区），并把section分配过去。不定义、不分配就不会去。监控程序大小看POST_BUILD里`size`的输出，`text + data`就是占用的Flash大小，和496K（507904字节）比较即可。

### 烧写会写到Flash以外的地方吗？

不会，烧写只进Flash。hex/bin文件里只包含可装载段（LOAD sections）：`.text`（代码）、`.rodata`（const）、`.data`的**初始值**（也存在Flash）。RAM相关的段（`.bss`、栈、堆）根本不在烧写镜像里。

RAM是**运行时**程序自己初始化的：启动代码把`.data`初值从Flash拷贝到RAM、把`.bss`清零，之后栈、堆、变量都在RAM里跑。Data Flash（EEPROM备份区）、OTP这些区域，链接器完全不碰，只有代码调用Flash编程接口才会写。

### 链接报错：.icg_sec is not within region FLASH

APP地址改好后编译，报错：

```
ld.exe: address 0x420 of output/MyOTA.elf section `.icg_sec' is not within region `FLASH'
```

顺着`.icg_sec`这个段名一路翻库代码，因果链如下：

1. `hc32f4xx_conf.h`里`LL_ICG_ENABLE`配置为`DDL_ON`；
1. 于是`hc32_ll_icg.c`编译了`u32ICGValue[]`数组，GCC下放进`.icg_sec`段：

``` c
#if defined (__ARMCC_VERSION) && (__ARMCC_VERSION >= 6010050)
const uint32_t u32ICGValue[] __attribute__((section(".ARM.__at_0x400"))) =
#elif defined (__GNUC__) && !defined (__CC_ARM)
const uint32_t u32ICGValue[] __attribute__((section(".icg_sec"))) =
// ...
```

3. `.ld`里这个段被**强制固定地址**：

``` ld
.icg_sec 0x00000400 :
{
    KEEP(*(.icg_sec))
} >FLASH
```

4. APP的FLASH已经从0x4000开始了，0x400落在BootLoader区域里、不在FLASH区域内 → 链接器发现0x400~0x420（8个字，32字节）越界 → 报错。

这里要先搞清楚ICG是什么：ICG（Initial Configuration Group，初始配置组）是HC32F460的硬件特性，**芯片复位时只会从Flash 0x400处读取ICG配置**（紧跟着0x0~0x3FF的向量表区域），包括看门狗、Flash读保护、HRC频率选择等上电默认行为。它只对"占着0地址的那份程序"有意义——也就是**BootLoader**。APP根本不该带ICG段，就算强行塞进去也没用，硬件不会读它。

**Q: 为什么Keil编译同样代码"没事"？**<br>
**A:** 因为链接器对"绝对地址段"的处理机制不同。Keil（armlink，默认`--autoat`）遇到`.ARM.__at_0x400`这类段，会自动另开一个小region把它放在0x400，**不要求**这个地址落在你定义的IROM1（0x4000起）里，所以链接照样过。GCC（ld）没有autoat机制，先钉死地址0x400、又要它属于FLASH区域，两个条件矛盾就直接报错。GCC是"把矛盾喊出来"，Keil是"默默兼容"。

但Keil"没事"其实是**假象**：armlink生成的hex里仍然包含0x400处的这32字节ICG数据。用J-Flash直接烧APP的hex → 会把这32字节写进**BootLoader的地盘**（覆盖Boot的ICG），碰巧两边ICG值相同时看不出来，一旦配置不同就埋雷；走OTA升级（Boot只写APP区）→ 这32字节被忽略，无害但纯属冗余。所以正确做法与编译器无关：APP工程就该关掉`LL_ICG_ENABLE`，Keil只是没提醒你，GCC提醒了。

### JumpToApp为什么不能直接裸跳？

**Q: 为什么必须关中断？**<br>
**A:** Boot已经使能的SysTick/定时器/USART还在跑。跳转后分两个阶段出问题：APP设好VTOR**之前**触发中断 → 仍走Boot的向量表，但此时MSP已经是APP的栈，现场错乱；APP设好VTOR**之后**触发 → 走APP的处理函数，但APP从没使能过这个外设，逻辑错乱。所以既要关全局中断，也要把NVIC的使能位和pending位清干净。

**Q: PRIMASK怎么会"遗传"给APP？**<br>
**A:** `__disable_irq()`设置的`PRIMASK=1`会一直带进APP。而APP的startup和`SystemInit()`里都**没有**`__enable_irq()`——若APP的main里也没有，中断永远不工作。两边必须配套：**Boot关，APP开**。

**Q: 为什么要做防空检查？**<br>
**A:** 空片或APP被擦除时，`*(uint32_t*)0x4000 == 0xFFFFFFFF`（Flash擦除态），`__set_MSP(0xFFFFFFFF)`直接HardFault。SP/PC任一为0xFFFFFFFF就应留在Boot等待升级，两行代码防生产事故。

**Q: `__set_MSP()`之后有什么讲究？**<br>
**A:** 切完MSP后当前函数就"没有栈"了。裸跳版先取值再切栈、`-O2`下值都在寄存器里，实际能跑；严谨做法是切完加`__ISB()`（清空流水线，保证后续取指用新状态），并保证之后不碰栈上局部变量。

## 参考资料

[^1]: Joseph Yiu. (2014). _《ARM Cortex-M3与Cortex-M4权威指南（第3版，中译）》_
[^2]: Xiaohua Semiconductor. (2022). _HC32F460系列用户手册_