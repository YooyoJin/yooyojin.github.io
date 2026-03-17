---
title: MCU基础
author: YooyoJin
date: 2025-03-31
last_modified_at: 2025-02-09
category: Jekyll
layout: post
mermaid: true
plantuml: true
---

MCU（Microcontroller Unit，微控制器），将CPU、内存（RAM/ROM）、外设（GPIO、UART、ADC等）集成在单一芯片上的微型计算机系统，专为嵌入式控制设计。例如：STM32（ARM Cortex-M）、ESP32（Wi-Fi/BLE）

SoC（System on Chip，片上系统），在单芯片上集成完整的系统功能，包括CPU、GPU、内存控制器、高速接口（USB/PCIe）、甚至AI加速器等，类似一台微型电脑。例如：高通骁龙、苹果A系列、华为麒麟

看似单片机系统复杂多样，但实际上现代单片机的代码如同计算机程序一样方便，厂商提供了丰富的底层驱动库，无须在底层上花费太多实践，可与专注于应用功能实现。

## 1. 芯片摘要

当我们拿到一款处理器时，或者说在芯片选型的过程中，我们需要对芯片的主要性能参数有一定的了解。这时候芯片手册是最重要的参考资料，我们可以快速的从中提取关键信息，来判断芯片是否符合我们的需求。

一般芯片厂商通常会提供以下几类文档（一般官网获取）：
- **《xx系列数据手册》**
    数据手册包含单片机的主要参数信息，如串口数量、引脚定义、电气特性等，是获取关键信息的首要资料。
- **《xx系列参考手册》**
    参考手册（有时称为硬件手册）详细描述了单片机的体系结构、寄存器、地址映射、电源管理、复位机制等，主要面向开发者。
- **《xx系列MCU开发工具用户手册》**
    该手册介绍开发工具和环境的使用方法，提供示例程序和操作说明，帮助开发者快速上手。
- **《xx系列勘误表》**
    勘误表列出了芯片已知的问题和修正建议，是开发和调试过程中不可忽视的参考资料。

通过芯片摘要，我们可以从数据手册中快速了解其主要特性和适用场景。

重点信息包括：
- **内核类型与主频**：如 ARM Cortex-M4，最高主频200MHz。
- **存储资源**：如512KB Flash，256KB SRAM。
- **外设接口**：如多路UART、SPI、I2C、CAN、USB、ADC、DAC等。
- **引脚数量与封装形式**：如LQFP100、LQFP64等，决定了可用I/O数量和布局。
- **电气特性**：工作电压范围（如2.7V~3.6V）、I/O口驱动能力等。
- **功耗参数**：如待机功耗、运行功耗，影响应用场景（低功耗/高性能）。
- **工作温度范围**：如-40℃~85℃，决定是否适用于工业环境。

以华大 HC32F460 系列为例，数据手册摘要如下：

|参数|说明|
|---|---|
|内核|ARM Cortex-M4（带FPU）|
|主频|最高200MHz|
|Flash|512KB|
|SRAM|256KB|
|外设|4×UART, 4×SPI, 3×I2C, 1×CAN, 2×ADC, 2×DAC, PWM等|
|封装|LQFP100, LQFP64等|
|工作电压|2.7V~3.6V|
|工作温度|-40℃~85℃|

通过这些关键信息，可以初步判断该芯片是否满足项目需求，并为后续详细选型和开发打下基础。

## 2. AMR单片机启动流程分析与BootLoader

启动单片机机是我们的第一步。我们常用的单片机内核基本上都采用ARM架构，对AMR架构有一定的理解，也许有助于我们后续开发过程中问题的定位与分析？不过咱也不过是拾人牙慧，浮于表面罢了。

### 2.1. ARM架构

在理解ARM架构之前，我们首先需要明确ARM在芯片产业中的定位。ARM公司本身并不生产芯片，而是提供处理器架构与核心设计。芯片厂商则基于这些ARM内核，进行集成或定制化开发，形成最终的处理器产品。

在这个过程中，ARM内核主要负责指令执行与程序运行，而芯片的实际功能则由围绕内核的各类外设实现。芯片厂商会在ARM内核之外集成多种硬件模块，例如GPIO、UART、ADC等，这些外设才是我们实现具体功能（如控制LED、串口通信、模数转换）的关键所在。

因此，在嵌入式开发中，我们通常通过寄存器直接编程或调用芯片厂商提供的软件库（如STM32的HAL库、HC32的LL库）来配置和控制这些外设。ARM内核的作用，则是确保我们编写的代码能够被正确、高效地执行。

其中ARM架构它定义了最基础、最核心的规则，像指令集，数据格式、硬件逻辑。属于标准和规范。

ARM内核，是ARM公司根据ARM架构设计好的“发动机”，芯片厂商可以直接把现成的“发动机”装进自己的“汽车”（芯片）里。大部分芯片厂商应该就是直接拿来用，但是有的认为它不够好，会自研，但仍遵从ARM架构。

除了ARM架构外，RISC-V目前也是发展迅猛，凭借开源，无授权费的优势快速发展中。

// todo 关于架构内容颇多，个人理解有限。有机会的话另起一页再展开吧。

### 2.3. ARM程序

在了解启动流程之前，我们先熟悉一下我们的程序。

我们知道，如果使用Keil编译完成后，可在生成的.map文件中中查看RO、RW、ZI的数据大小；同样，如果使用GCC编译可以在Cmake中使用`size`命令，查看text、data、bss的数据大小。它们的效果是一样的，这是我们的程序在程序**编译阶段**数据存储的分布情况！

``` cmd
[build]    text	   data	    bss	    dec	    hex     filename
[build]  110252	     76	   4020	 114348	  1beac     E:/MyWorkspace/Project/EvaporativeCooling/gcc/build/output/EvaporativeCooling.elf

text -> RO : 代码 + 只读数据（Flash）
data -> RW : 已初始化的变量（Flash存储初始值，在上电启动好后拷贝到RAM，运行期间修改的是RAM副本）
bss  -> ZI : 未初始化的变量（RAM）
dec = text + data + bss : 总计

Flash空间占用 = text + data
RAM空间占用 = data + bss
注意：这里再编译阶段只是确定全局变量需要占多少地址空间，栈大概需要多大。但它并不在RAM上创建这些变量。在运行阶段变量才会被创建，断电则丢失
```

从编译到运行的整个过程:

``` mermaid
flowchart TB
    A[源代码<br>.c/.cpp 文件] --> B[编译与链接]
    subgraph B [编译阶段-在PC上]
        B1[编译器Compiler]
        B2[链接器Linker]
        B1 --> B2
    end

    B --> C[生成二进制文件<br>.bin/.hex]
    C --> D[烧录/下载]
    D --> E[拷贝到MCU Flash]
    E --> F1[MCU上电执行]

    subgraph F [运行阶段-在MCU上]

        subgraph F2_sub [运行时动态存储]
            subgraph F2_Flash[从Flash读取指令]
                F2_Flash_1[机器码指令]
                F2_Flash_2[只读常量数据]
                F2_Flash_3[初始化数据的初始值]
            end

            subgraph F2_RAM[在RAM中创建/修改数据]
                F2_RAM_1[全局/静态变量<br>当前值]
                F2_RAM_2[堆Heap<br>动态分配的数据]
                F2_RAM_3[栈Stack<br>局部变量、函数调用]
            end

        end

        F1 --> F2_sub
    end

    B --> G[符号表<br>内存布局规划]
    G -.->|为运行阶段提供蓝图| F2_sub
```

### 2.4. 存储映射表

以华大HC32F460为例，参考RM_HC32F460_F45x_A460系列参考手册_Rev1.5[^2]，第一章 存储器映射（Memory mapping）内容。

HC32F460支持4GB的线性地址空间，地址从0x0000_0000到0xFFFF_FFFF。

**Q: 为什么Flash只有512K，却有4G地址空间？**<br>
**A:** 因为地址空间 != 物理内存。ARM Cortex-M使用内存映射I/O，所有外设都映射到地址空间。这样设计统一访问方式，用相同的访问方式访问不同的设备，代码也可以在不同的芯片间移植。编译器只需要生成固定地址的代码即可。

> 4GB是CPU的"视角"，512KB是实际的"存储能力"。就像你有整个城市的地址地图（4GB地址空间），但只实际拥有几栋房子（512KB Flash + 128KB RAM）

这里的类比这里非常形象了！

**Q: 为什么要这么设计？**<br>
**A:** 首先要知道这个规则是由芯片内核架构（ARM）规定的。这样设计它能够统一编址与预留空间，给各个芯片厂商预留空间，增加内核的兼容性、扩展性和可移植性，实现了“天下大一统”。比如芯片厂商想推出更大的Flash型号的芯片，只要在同一个代码区地址范围内，换一个更大的物理Flash即可，不需要改变内核架构。而且预留了一些像外部RAM区域，如果你需要更大的容量内存，可以外接SDRAM，将物理地址映射到预留的片外RAM区域即可，当然如果你不用也是没有关系的。

``` cmd
HC32F460 4GB地址空间布局 (Cortex-M):
0x0000 0000 ┌─────────────────────────┐
            |0x0000_0000|Flash(512K)  |
            │      Code |─────────────│ ← 启动位置可选，指向Flash或RAM，通常调试时需要从RAM启动
            |0x1FFF_8000|SRAM(32K)    |
0x1FFF FFFF ├─────────────────────────┤
            │  Empty                  │ ← 无物理内存，访问会 fault
0x2000 0000 ├─────────────────────────┤
            │  SRAM                   │ ← 64K+64K+28K+4K==160K RAM在这里
0x2002_6FFF ├─────────────────────────┤
            │                         │
            │  Empty                  │
            │                         │
0x4000 0000 ├─────────────────────────┤
            │  Peripheral             │ ← GPIO, USART, SPI等
0x400F FFFF ├─────────────────────────┤
            │                         │
            │  External RAM           │ ← 外接SDRAM, NOR Flash等
0xDFFF FFFF ├─────────────────────────┤
            │  System                 │ ← 内核私有外设NVIC, SysTick, MPU等
0xFFFF FFFF └─────────────────────────┘
```

**Q: 启动位置可选？**<br>
**A:**
> 在芯片启动时，决定0x0000_0000这个地址是连接到Flash还是SRAMH。正常程序运行模式从Flash启动，调试或特殊启动模式从RAM启动，有些MCU可以通过Boot引脚设置为从RAM启动，CPU从SRAMH取指。此时，要执行的程序必须已经被预先加载到SRAMH中。常规调试过程中确实需要擦写Flash，而“从RAM启动”的调试模式正是为了规避这个问题而设计的高级功能。它通过牺牲对程序大小的包容性（程序必须能放进RAM），换来了极致的调试体验和速度，特别适合在开发关键算法或驱动时进行密集的、反复的调试。

可以看到，HC32F4xx系列单片机的Flash的地址是写在0x0000_0000，所以当选择从Flash启动后，可以直接正常进入程序。但是像码农爱学习在其文章单片机程序烧录的3种方式(ISP、ICP、IAP)是什么？[^3]中提到的STM32F4xx系列单片机，他的Flash(Main Memory)物理地址实际是从0x0800_0000开始，然而，ARM Cortex-M内核规定其必须从地址0x0000_0000开始读取栈指针和复位向量。为了解决这个矛盾，STM32芯片内部设计了一个地址重映射机制。

利用BOOT引脚（如BOOT0, BOOT1）的选择将哪一块物理存储器映射到内核要求的这个0x0000_0000起始的地址空间。
- 当选择从主Flash启动时，0x0000_0000的访问被重定向到0x0800_0000开始的主Flash。
- 当选择从系统存储器启动时，0x0000_0000的访问被重定向到内部Bootloader的ROM地址。
- 当选择从内置SRAM启动时，0x0000_0000的访问被重定向到SRAM的起始地址（如0x2000_0000）。

因此，对于绝大多数从主Flash启动的应用程序，开发者只需要将程序链接到0x0800_0000即可，芯片硬件会自动处理好从0x0000_0000的访问。

然而华大的芯片就没有这种烦恼，因为目前Flash物理起始地址就是0x0000_0000，当然也可以自己设计Bootloader进行重定向。

### 2.5. 启动流程分析

此处关于MCU启动流程的分析，主要参考了赤诚Xie与林接接等博主的相关论述[^1][^4]。

网上启动流程版本有很多，我按照个人的理解做了一些整理，咱就是丑陋的缝合怪，哈哈。因为我也不知道如何去验证这个启动流程的正确性，官方文档里也没有找到这块内容的详细介绍，所以这里只能膜拜各位大佬的理解了。

- 复位
    - CPU从0x0000_0000（实际是Flash硬件的0x0000_0000）读取MSP（主栈指针）初始值，
    - 从0x0000_0004（实际是Flash的0x0000_0004）读取复位向量（硬件自动加载到PC指针）
- 启动代码执行
    - 通过复位向量跳转到复位处理函数（Reset_Handler），执行Reset_Handler代码，此处开始执行启动文件
        - 初始化 .data 段（从Flash到RAM）
        - 清空 .bss 段
        - 其他咱就看不懂了
    - 执行SystemInit函数, 初始化系统时钟
    - 跳转到main
- main函数
    - 初始化外设
    - 使能中断
    - 主循环
- 中断处理
    - 系统相应中断
    - 中断执行完成回归main函数

HC32F460 GCC版本启动代码（Reset handler部分）：
```
/*
;<h> Reset handler start.
*/
                .section    .text.Reset_Handler
                .align      2
                .weak       Reset_Handler
                .type       Reset_Handler, %function
                .globl      Reset_Handler
Reset_Handler:
/* Single section scheme.
 *
 * The ranges of copy from/to are specified by following symbols
 *   __etext: LMA of start of the section to copy from. Usually end of text
 *   __data_start__: VMA of start of the section to copy to
 *   __data_end__: VMA of end of the section to copy to
 *
 * All addresses must be aligned to 4 bytes boundary.
 */
ClrSramSR:
                ldr         r0, =0x40050810
                ldr         r1, =0x1F
                str         r1, [r0]

                /* Copy data from read only memory to RAM. */
CopyData:
                ldr         r1, =__etext
                ldr         r2, =__data_start__
                ldr         r3, =__data_end__
CopyLoop:
                cmp         r2, r3
                ittt        lt
                ldrlt       r0, [r1], #4
                strlt       r0, [r2], #4
                blt         CopyLoop

CopyData1:
                ldr         r1, =__etext_ret_ram
                ldr         r2, =__data_start_ret_ram__
                ldr         r3, =__data_end_ret_ram__
CopyLoop1:
                cmp         r2, r3
                ittt        lt
                ldrlt       r0, [r1], #4
                strlt       r0, [r2], #4
                blt         CopyLoop1

/* This part of work usually is done in C library startup code.
 * Otherwise, define this macro to enable it in this startup.
 *
 * There are two schemes too.
 * One can clear multiple BSS sections. Another can only clear one section.
 * The former is more size expensive than the latter.
 *
 * Define macro __STARTUP_CLEAR_BSS_MULTIPLE to choose the former.
 * Otherwise define macro __STARTUP_CLEAR_BSS to choose the later.
 */
/* Single BSS section scheme.
 *
 * The BSS section is specified by following symbols
 *   __bss_start__: start of the BSS section.
 *   __bss_end__: end of the BSS section.
 *
 * Both addresses must be aligned to 4 bytes boundary.
 */
                /* Clear BSS section. */
ClearBss:
                ldr         r1, =__bss_start__
                ldr         r2, =__bss_end__

                movs        r0, 0
ClearLoop:
                cmp         r1, r2
                itt         lt
                strlt       r0, [r1], #4
                blt         ClearLoop

ClearBss1:
                ldr         r1, =__bss_start_ret_ram__
                ldr         r2, =__bss_end_ret_ram__

                movs        r0, 0
ClearLoop1:
                cmp         r1, r2
                itt         lt
                strlt       r0, [r1], #4
                blt         ClearLoop1

SetSRAM3Wait:
                ldr         r0, =0x40050804
                mov         r1, #0x77
                str         r1, [r0]

                ldr         r0, =0x4005080C
                mov         r1, #0x77
                str         r1, [r0]

                ldr         r0, =0x40050800
                mov         r1, #0x1100
                str         r1, [r0]

                ldr         r0, =0x40050804
                mov         r1, #0x76
                str         r1, [r0]

                ldr         r0, =0x4005080C
                mov         r1, #0x76
                str         r1, [r0]

                /* Call static constructors */
                bl          __libc_init_array
                /* Call the clock system initialization function. */
                bl          SystemInit
                /* Call the application's entry point. */
                bl          main
                bx          lr
                .size       Reset_Handler, . - Reset_Handler
/*
;<h> Reset handler end.
*/
```

### 2.6. BootLoader

此处内容大部分参考了无际单片机编程相关论述[^5]，他写的简单易懂，膜拜🙇‍♂️。

**Q: 单片机Bootloader能解决什么问题？** <br>
**A:** Bootloader就像是给单片机安装了一个“智能操作系统”，解决了传统单片机开发中的几个痛点：
- 更新程序太麻烦。Bootloader使得单片机可以通过各种通信接口（4G模块、串口等方式）来接收新的程序文件（固件），并自己将自己“重新编程”。这个过程被称为IAP(In-Application Programming)。
- 升级失败，“变砖”问题。支持程序备份和回滚。它会先把旧程序好好保存起来，等确认新程序完全没问题之后，再正式启用。
- 自定义启动逻辑，增加开发效率。

**Q: Bootloader, IAP, OTA？** <br>
**A:** 这三个词经常一起出现，关系紧密但含义不同:
- Bootloader：指那段程序本身，它提供了加载应用程序和执行固件更新的基础能力；
- IAP: 自己将自己“重新编程”，这个过程被称为IAP。算是一种方法或技术手段；
- OTA：(Over-The-Air) 是一种固件交付方式，特指通过无线通信（Wi-Fi, Bluetooth, 蜂窝网络等）将新的固件包发送到设备。设备接收到OTA包后，通常会利用其IAP能力来完成实际的烧录更新。

> 所以，可以说：OTA是实现远程固件更新的一种高级方式，它依赖于设备的IAP能力，而IAP能力的实现往往离不开一个健壮的Bootloader。

#### 2.6.1. BootLoader工作原理

BootLoader（引导加载程序），顾名思义就是引导程序从正确的地方开始。就是在原本流程中启动主程序运行之前，增加了一段引导加载程序的处理。引导加载程序需要做的就是最低限度的硬件初始化（时钟、GPIO、通信），然后决定是否启动主程序，或者是进入特殊模式（接收新固件、启动新程序）。其通常烧录在单片机Flash的起始地址。

**1. Bootloader启动**：启动和正常的单片机启动一样，只不过这里需要先经过引导加载程序，再进行后续的流程。

`CPU上电执行 --> 从向量表中取出Flash起始地址 --> 执行复位处理程序 --> 跳转Bootloader代码`。

**2. 硬件初始化**：Bootloader不需要像主应用程序那样初始化所有的外设。它只需要初始化最基本的硬件，满足它的核心功能需求即可。
- 时钟系统：让CPU和外设跑起来。
- GPIO：可能需要用来检测某个引脚状态，判断是否进入升级模式，或者控制LED指示状态。
- 通信接口：用于接收新固件的接口，比如UART, SPI, I2C, CAN, USB等。

**3. BootLoader处理逻辑**：硬件初始化完成后，需要决定接下来要做什么？
- 升级？
- 跳转主应用程序？

这里通常通过检测GPIO引脚、检查Flash标志位、监听通信、检测应用程序有效性等方式来进行模式选择。

#### 2.6.2. BootLoader程序设计

详细见下一章3. Flash编程

## 3. Flash编程

本节主要以BootLoader为核心，总结一下嵌入式Flash的应用。这里的嵌入式Flash也叫内部Flash，集成在MCU内部，区别于外部NOR Flash、NAND Flash。Flash特性在[RAM、ROM存储基础](/jekyll/2025-03-01-ram_rom.html)章节有简单介绍，此处不再赘述。

内部Flash的驱动方式由芯片厂商在设计时固化好的内存控制器和访问接口访问，CPU可以直接通过内部总线高速访问它，不需要像外部Flash一样初始化和协议驱动读写，在存储映射表中一块固定的区域内。就像上一章提到的启动流程，在芯片启动的过程中，芯片会从内部Flash的起始地址获取第一条指令。

### 3.1 HC32内部Flash分区

以HC32为例，详细参考RM_HC32F460_F45x_A460系列参考手册_Rev1.5[^2] 第7章 嵌入式FLASH（EFM）相关内容

- 容量高达512KBytes(其中有32Bytes为功能保留位，扇区63)分为64个扇区，每个扇区为8KBytes。
- Flash所有扇区硬件上都是可操作的，但代码所在的扇区在运行时不能动，否则程序立刻崩溃。需要避开正在执行的扇区。
- 128 位宽数据读取，意味着Flash控制器一次可以并行读出连续的16字节（128bit）的数据。
- 编程单位为4Bytes，擦除单位为 8KBytes，意味着强制写就必须一次写满4字节，要擦就要擦一个扇区。

合理分区:

```cmd
0x0000_0000  ┌─────────────────┐
             │   Bootloader    │ 32KB  (固定不变)
0x0000_8000  ├─────────────────┤
             │   App 当前运行   │ 224KB (可OTA更新)
0x0003_FFFF  ├─────────────────┤
             │   OTA 临时存储   │ 224KB (存新固件)
0x0007_7FFF  ├─────────────────┤
             │   参数/日志区    │ 32KB  (动态数据)
0x0007_FFFF  └─────────────────┘
```




## 4. 时钟系统

不同的的单片机时钟树的结构存在一些差异，以HC32F460来说，时钟控制单元包含六个时钟源和分频器电路：
- 一个外部高速振荡器（XTAL）；
- 一个外部低速振荡器（XTAL32）；
- 两个PLL时钟（分频、倍频）；
    - PLL锁相环，通过锁定相位来控制频率的闭环系统，目的使两个信号相位同步。通过插入一个分频器，改变输出值，实现了分频和倍频效果。
- 一个内部高速振荡器（HRC）；
- 一个内部中速振荡器（MRC）；
- 一个内部低速振荡器（LRC）；
- 一个SWDT专用内部低速振荡器；
- 时钟预分频器、时钟多路复用和时钟门控电路。

**Q: 为什么需要这么多时钟？**<br>
**A:** 一方面要知道时钟频率越高，单位时间内执行的指令越多，针对性能强大的CPU，就需要提供更高的时钟信号。另一方面像高速外设SPI、USB这类信号要求高速时钟频率才能正常的工作，所以需要高频时钟。但是像I2C、UART这种低速外设，高速又有些浪费。因此像电源树设计一样，针对不同的模块设计了不同的时钟频率。
对此，通过分频器从主时钟派生不同频率，避免为每个外设单独设计时钟源。

因为博客不计划贴图，所以简单用mermaid简单示意一下，详细可以参考，《xx参考手册》[^2]-时钟控制器章节-时钟系统框图。

``` mermaid
graph LR
    PLLSRC[PLLSRC<br>选择时钟源]
    XTAL[XTAL<br>外部高速时钟]
    HRC[HRC<br>内部高速时钟]
    CKSW[CKSW<br>选择器、分频器]
    JTCK_SWCLK[JTCK_SWCLK<br>计数器用时钟]
    SYSCK[SYSCK<br>系统时钟]

    subgraph 时钟源倍频处理
    %% 时钟源
    XTAL --> PLLSRC
    HRC --> PLLSRC
    end

    %% PLL
    PLLSRC --> CKSW

    subgraph 分频到工作时钟
    %% 分频到总线
    CKSW --> SYSCK
    end

    subgraph 外设时钟
    %% 总线到外设
    CKSW --> HCLK
    CKSW --> EXCLK
    CKSW --> PCLK0
    end

    subgraph 特殊时钟
    %% 特殊时钟
    JTCK_SWCLK
    end
```
_**说明**_
- 我们通常不使用芯片内部时钟源，因为高速内部时钟信号根据温度和环境的情况频率会飘移，不稳定；
- 时钟的配置原则应该是从后向前配置，即从外设向晶振方向配置；
- 各时钟之间需遵守频率倍数规则；

**Q:那么时钟应该怎么配置，配置多少？** <br>
**A:** 时钟的配置不是随便配的，它受到时钟树的硬件约束。像我们常见的168MHz，需要满足PLL输入限值、满足系统时钟限值和PLL的输出限值。

以HC32F460为例
> ARMv7-M 架构 32bit Cortex-M4 CPU，集成FPU、MPU，支持SIMD指令的DSP，及CoreSight标准调试单元。**最高工作主频 200MHz**，Flash加速单元实现0-wait程序执行，达到250DMIPS或680Coremarks的运算性能。

这里就明确指出了最高主频200Mhz（绝对理论最大值），如果超出200MHz，受到功耗和发热等因素，系统会进入不稳定的状态，甚至是可能损坏。其次核心的200MHz是由一个低频的外部晶振（如8MHz）通过PLL倍频得到的，如果外部晶振本身的精度很差（例如±1%），那么倍频后的系统时钟误差也会被等比例放大。

**Q:什么时候用外部时钟？什么时候用内部时钟？** <br>
**A:** 简单来说用内部时钟的核心优势是省钱、省空间、启动快。外部时钟的核心优势是精准、稳定。根据实际的应用场合确定。

**Q:为什么配置频率的时候要分频系数-1？涉及到分频的时候都会这样操作** <br>
**A:** 根本原因在于：硬件设计的计数值是从0开始的，而我们的习惯的表示是从1开始的。如果2分频，我们一般自然输入2，于是产生了矛盾。所以可能厂商为了解决这个问题在分配时设计了`所需写入寄存器的值 = 期望的分频系数 - 1`

### 4.1. 波特率配置计算

波特率（Baud Rate，每秒传输的符号数）的配置与时钟源是密切相关的，我们以串口的波特率配置为例，来实际梳理一下时钟的配置。

同样以HC32F460为例：

现在假设我们的主频SYSCK 168MHz，想用USART1。通过查芯片参考手册可知，USARTn（n=1~4）采用的是PCLK1时钟。PCLK1由主频通过2分频得到，即PCLK1 82MHz。

根据UART模式下波特率计算公式（无小数部分）：

$$
B = \frac{C}{8 \times (2 - \text{OVER8}) \times (\text{DIVInteger} + 1)}
$$

_**关键参数：**_
- B：波特率
- C：时钟源
- OVER8：过采样模式，即一位数据传输期间的基本时钟数。不像是人话；
    > 过采样技术，就是在一位数据间进行多次信号采集，之后得出得结果就可以判断当前位是否正确，可以有效的辨别数据是否被干扰造成的数据丢失。采样时钟可以是波特率时钟的16倍或8倍
- DIVInteger：整数分频寄存器，是我们的设置波特率大小的主要参数。

``` cmd
所以假设我们需要2400波特率，16分频：
84000000/16/(8*(2-0)*(DIVInteger+1)) = 2400
                          DIVInteger = 136.72 √

但是当我们设置4分频时，这里时配不出来2400Hz的：
84000000/4/(8*(2-0)*(DIVInteger+1)) = 2400
                         DIVInteger = 546.875 ×
注意：寄存器DIVInteger只有8位，若计算值超出，需调整分频或降低波特率。
```

当然还有波特率误差计算公式，只要误差在1%以内是可以接受的，若误差超出需求（如>1%），需调整时钟源（C）或分频模式（PSC/OVER8）。

如果是带小数分频寄存器，可以先计算理论分频系数后，得出整数部分，再去计算小数部分，最后验证误差是否合理。

$$
DIVInteger = \frac{C}{B \times 16}
$$

### 4.2. 定时器
BT（Base Timer）基础定时器，PCA（Programmable Counter Array） 是可编程计数阵列。离谱缩写让我好找🤬。

单片机常用定时器有通用定时器、高级定时器、系专用定时器。

#### 4.2.1. 系统专用定时器 SysTick

Cortex-M内核内置的24位倒计时定时器，功能固定，通常仅提供周期性中断。纯内部使用！不与芯片引脚关联。

#### 4.2.2. 通用定时器 Timer

以华大为例，有两个通用定时器Timer0、TimerA，Timer4，各自具备的能力并不相同。

- Timer0：可以实现同步计数、异步计数两种基本定时器，仅计时用。定时器有包含A、B两个通道（比较器、计数器），可以在计数期间产生比较事件，触发中断。
- TimerA：有6个TimerA单元，具有16位计数宽度（即最大计数值为2^16）、8路PWM输出的定时器。可以输出三角波锯齿波两种波形模式，可生成各种PWM波形（如中心对齐PWM、边沿对齐PWM、甚至是正弦波）。
- Timer4：更强大，一个用于三相电机控制的定时器模块？！

#### 4.2.3. 高级定时器 Timer

同样有高级定时器Timer6

- Timer6：是一个16位计数宽度的高性能定时器，可用于计数产生不同形式的时钟波形，输出以供外部使用。该定时器支持三角波和锯齿波两种波形模式，可生成各种 PWM 波形；有3个Timer6单元

todo，区别差异对比


## 4. 复位电路



## 4. 中断系统



## 5. GPIO复用

## 6. DMA控制器

## 低功耗模式

## 电源控制

## ESD和锁存保护

## 7. 其他常见基本外设

### 2. I/O口

I/O口既可用作输入，也可用作输出。

本质上单片机就是对I/O口的控制，无论单片机对外界进行何种控制，都是通过I/O口进行的。接受外部的控制，通过I/O来感受外部的电压。

#### 1.1. I/O口结构

推完输出：可以直接输出高电平或低电平，无需外部上拉电阻。本质上由两个MOS管（PMOS和NMOS）组成，一个负责拉高，一个负责拉低。

开漏输出：依赖上拉电阻输出高电平，如果不接上拉电阻，就是高阻态。只有下拉NMOS管，无上拉PMOS管。高电平需依赖外部上拉电阻。

浮空输出：电平状态不确定，易受噪声干扰。输入引脚既不接上拉也不接下拉，处于高阻态（无驱动能力）。

PS:上拉电阻就是将不确定的信号通过一个电阻拉到高电平，同时此电阻起到一个限流的作用，下拉就是下拉到低电平。

## 常见问题&解决办法

### 单片机程序烧录过程中“串电压”问题

像JLink、STLink这类仿真器一般有提供供电引脚给单片机供电。但是仿真器和目标设备（如MCU开发板）分别独立供电时，两者之间的电源系统因电势差或共地问题导致的电压异常，轻则通信失败、重则器件烧毁。

解决办法：所以在程序烧录过程中需要注意电源供电问题，确保统一供电（优先使用目标板为仿真器供电，或关闭目标板电源，仅通过仿真器供电）、共地。

以JLink为例，首先JLink下载接口支持SWD和JTAG接口，他们是两种调试协议标准
- SWD，ARM推出的两线调试接口，两个引脚SWDIO（串行数据输入/输出）、SWCLK（串行时钟），仅支持ARM架构
- JTAG是一种标准的调试接口，四个引脚TMS（测试模式选择）、TCK（测试时钟）、TDI（测试数据输入）、TDO（测试数据输出）

像我们常用的JLink（盗版），VCC是可以作为输出的，通过内部跳线帽短接可以直接让Pin1（VTref 目标板参考电压） 、pin2（自身3.3V电源）直接输出3.3V高电平。如果不是用跳线帽短接的话可以通过`JLink Commander`的`power on/off`命令来控制电压（5V）的输出与否。不短接意味着引脚悬空，VTref自己识别目标板电平，是否输出还是根据power命令来执行，输出并没有根据参考电平调整（可能因为我这个是盗版），可以通过`usb`命令查看VTref。如果芯片本身没有供电，JLink是无法与芯片连接的，所以通常直接用用跳线帽输出3.3V，此处针对3.3V的系统来说是没有问题的。

针对5V的系统来说，输出电平可以调整，但是输入电平不匹配的问题，可能导致无法仿真。因为SWDIO是双向的，目标板会给JLink 5V高电平信号，意味着JLink的输入耐压将受到考验。

### JLink检测芯片时钟频率异常

在程序烧录过程中，使用JLink调试器连接目标芯片时，出现"检测芯片时钟频率异常"的报错信息，偶尔可以连接成功，但通信不稳定，容易中断。问题发生在产品原型板的首次烧录尝试阶段，目标芯片为HC32系列MCU，硬件电路为新设计的PCB板。个人初步怀疑是电平不配导致，其实在PCB设计评审的时候已经指出电压不匹配问题，担心JLink通信有问题，因为MCU用的是5V供电，而JLink内部3.3V供电，明显电平不匹配。不知道什么原因，最后打板硬件没有修改，完全不管软件调试死活。

参考网上的解决办法，尝试降低SWD通信速率，减少信号建立时间要求。从默认4000kHz，逐步递减调整到1000kHz连接稳定。

**Q: 为什么降低频率会有效？**<br>
**A:** 由于JLINK的3.3V输出驱动5V系统时驱动能力不足，信号上升时间延长。在高速通信下，信号未能在采样点前达到5V TTL的2.0V高电平阈值，导致逻辑误判。降低SWD频率后，延长了信号建立时间，使电压能够稳定超过阈值，从而保证可靠通信。降低频率相当于有足够时间'爬'过2.0V的门槛，在采样时稳定在有效电平范围内。为什么3.3V信号上升更慢？驱动电压决定电容充电电流，从而影响了对电容的充电速度，进一步影响了电压的建立时间。

根因：电平不匹配导致的信号完整性问题和通信可靠性下降。

### “ARM仿真器”问题

公司用的ARM仿真器，本来正常使用结果今天这个烧录器一直闪绿灯，我也识别不到JLink，看了下网上的说法，以为是驱动出问题了？尝试重新装了驱动，没有效果。最后换了一个仿真器，能够正常识别。

但是问题来了，重装驱动后，发现程序Keil烧录按钮灰掉了，并且设置JLink会弹出，不能加载JL2CM3.dll驱动！

尝试改了环境变量，无果。

参考 [https://zhuanlan.zhihu.com/p/656208641](https://zhuanlan.zhihu.com/p/656208641) 这篇文章解决。

解决方法：是由于装Jlink驱动的时候，勾选了JLinkARM.dll装进Keil MDK里面去了导致。可以下载老版的Keil，把“Keil安装目录\ARM\Segger”里的库都替换。但是我发现网上下载下来的JLink库太老了，找不到我现在用的芯片，于是直接从新版JLink，找到对应的库替换进去，解决。

不过JLink提示更新的弹窗，更新了就不弹了。

### RAM空间不足，用ROM换RAM，解决内存瓶颈

受芯片资源限制，遇到了这个RAM空间用超的情况。但是ROM空间还有剩余。RAM不足，就很容出现程序崩溃的情况！

分析发现协议部分设计的寄存器表，这些只读数据占用大量RAM空间。全都放在RAM中导致空间占用过多，可用通过const修饰结构体数组，将变量从RAM转移至ROM。但是通过const修饰的结构体内部成员也为const，无法修改。

核心思想：把不变的配置放ROM，把可变的状态放RAM。

因此通过使用指针来指向变量，重新构建一个结构体仅存放变量，设计分离的数据结构，这样大部分占用参数从RAM转移至ROM。

计算下来我的项目节省50-60%左右的RAM使用量，对于访问性能，基本无影响！

## 参考资料

Joseph Yiu. (2014). _《ARM Cortex-M3与Cortex-M4权威指南（第3版，中译）》_

[^1]: 赤诚Xie. (2024). _MCU的启动到bootloader原理详解_. [https://www.cnblogs.com/chicheng/p/18267699](https://www.cnblogs.com/chicheng/p/18267699)

[^2]: XHSC. (2024). _RM_HC32F460_F45x_A460系列参考手册_Rev1.5_.

[^3]: 码农爱学习. (2021). _单片机程序烧录的3种方式(ISP、ICP、IAP)是什么？_. [https://zhuanlan.zhihu.com/p/367821312](https://zhuanlan.zhihu.com/p/367821312)

[^4]:林接接. (2025). _典型arm32位单片机启动流程（从上电到main.c）_. [https://www.cnblogs.com/jiejielin-blogs/p/19008377](https://www.cnblogs.com/jiejielin-blogs/p/19008377)

[^5]:无际单片机编程. (2025) _一文读懂Bootloader：从原理到OTA应用_. [https://www.eet-china.com/mp/a397421.html](https://www.eet-china.com/mp/a397421.html)
