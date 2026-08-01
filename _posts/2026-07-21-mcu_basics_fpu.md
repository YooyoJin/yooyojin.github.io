---
title: MCU基础-FPU浮点运算单元
author: YooyoJin
date: 2026-07-21
last_modified_at: 2026-07-21
category: Jekyll
layout: post
mermaid: true
plantuml: true
---

最近在开发项目时，代码中涉及部分浮点类型计算。芯片官方手册明确写着"Cortex-M4集成了浮点运算单元（FPU）和DSP"，那我就不客气了。但实际使用中，到底加速了没？

## 1. FPU

FPU（Floating Point Unit，浮点运算单元），是处理器（Cortex-M4内核自带）内部专门用于执行浮点数运算的硬件模块。与之相对的是软件浮点——即用一系列整数运算指令来模拟浮点运算。

我们知道对于两个数字之间的任意操作，浮点计算需要大量资源。AN4044应用笔记例子中，使用“float”时，硬件FPU使算法快了12.5倍。

> 在无FPU的处理器上，所有这些操作都由软件通过C编译器库来完成，程序员不可见；但是其性能非常低。<br>
> 在有FPU的处理器上，对于大多数指令，所有操作由硬件在一个周期内全部完成。C编译器不使用其自己的浮点库，而是直接生成FPU本机指令。

## 2. 怎么启动FPU呢？

总而言之，言而总之，需要满足两个条件：
1. 硬件层面：在启动代码中"解锁"FPU，让CPU允许访问协处理器
1. 软件层面：告诉编译器目标硬件支持FPU，让它生成FPU指令而非调用软件库

详细参考Cortex-M4权威指南[^1]-13.4使用浮点单元。

### 2.1. 硬件开启：配置CPACR寄存器

内核自带了就是默认启动吗？当然不是！我在芯片参考手册中没有看到FPU相关内容，可能是因为内核层面的？

在Cortex-M4权威指南[^1]第十三章-浮点运算中，找到了相关内容。

理解下来就是Cortex-M4的FPU是内置在芯片内部的，但从架构视角看，ARM通过给它分配协处理器编号、独立的译码执行单元以及统一的管理接口，使其在逻辑上完全等同于一个协处理器（通常来说是独立的物理芯片，支持某一类功能）。这既保持了架构一致性，也方便了软硬件设计。

ARM在CPACR（协处理器访问控制寄存器）中为FPU分配了固定的编号（协处理器#10和#11）。这样，操作系统就可以用统一的方法（同一套寄存器）来开启/关闭FPU权限，就像管理其他物理协处理器一样。

设置CPACR通常不需要我们自己去写，一般在SystemInit()函数内执行，SystemInit()函数复位启动文件自动跳转执行。
``` c
void SystemInit(void)
{
    /* FPU settings */
#if (__FPU_PRESENT == 1) && (__FPU_USED == 1)
    SCB->CPACR |= ((3UL << 20) | (3UL << 22)); /* set CP10 and CP11 Full Access */
#endif
    // ... 其余初始化代码
}
```

``` c
#elif defined ( __GNUC__ )
  #if defined (__VFP_FP__) && !defined(__SOFTFP__)
    #if defined (__FPU_PRESENT) && (__FPU_PRESENT == 1U)
      #define __FPU_USED       1U
    #else
      #error "Compiler generates FPU instructions for a device without an FPU"
      #define __FPU_USED       0U
    #endif
  #else
    #define __FPU_USED         0U
  #endif
```

`__FPU_PRESENT`、`__FPU_USED`这两个宏分别在hc32f460.h、core_cm4.h中有完整的编译器适配逻辑。当使用-mfloat-abi=hard -mfpu=fpv4-sp-d16时，GCC会自动定义__VFP_FP__宏，从而触发__FPU_USED自动定义为1。因此并不需要手动去定义__FPU_USED。

### 2.2. 编译器配置

所以简单来说并不需要手动配置CPACR寄存器，配置编译器就行了

目前我用的是CMake+GCC工具链：需要在CMakeLists下面配置`set(MCU_FLAGS "-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard")`
- `-mcpu=cortex-m4`，指定目标CPU；
- `-mthumb`，使用Thumb指令集；
- `-mfpu=fpv4-sp-d16`，指定FPU型号，Cortex-M4为单精度FPv4；
- `-mfloat-abi=hard`，硬浮点ABI（应用程序二进制接口，硬件设备层面的物理约定配置），浮点参数通过FPU寄存器传递，若使用软件浮点，ABI配置命令用`-mfloat-abi=soft`或`-mfloat-abi=softfp`
    - softfp：这里是具有硬件FPU的软件？？查了一下，意思是用硬指令+软传参（即“用硬件算，但用整数寄存器传数据”）。

如果使用Keil MDK编译环境，更加简单，在Options fot Target -> Target -> Floating Point Hardware -> 选择Single Precision即可。

## 3. 如何确认FPU是否在摸鱼？

方法一：最简单的就是可以看性能对比。写一段简单的浮点运算，记录运行时间，通常硬件浮点比软件模拟快十几倍，也是比较明显的。

方法二：看汇编指令。如果时用Keil的话可以进入Debug模式，运行到浮点函数，看汇编窗口。如果用GCC，可以通过`set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -save-temps=obj")`命令，生成汇编。通常vldr.32、vmov.f32、vadd.f32、vcvt.u32.f32 均为FPU硬件指令。

``` assembly
VoltageWriteCallback:
.LFB147:
	.loc 1 40 1
	.cfi_startproc
	@ args = 0, pretend = 0, frame = 8
	@ frame_needed = 1, uses_anonymous_args = 0
	@ link register save eliminated.
	push	{r7}
	.cfi_def_cfa_offset 4
	.cfi_offset 7, -4
	sub	sp, sp, #12
	.cfi_def_cfa_offset 16
	add	r7, sp, #0
	.cfi_def_cfa_register 7
	.loc 1 42 69
	ldr	r3, .L2
	ldrh	r3, [r3]
	.loc 1 42 73
	lsls	r3, r3, #16
	.loc 1 42 126
	ldr	r2, .L2
	ldrh	r2, [r2, #2]
	.loc 1 42 80
	orrs	r3, r3, r2
	.loc 1 42 22
	str	r3, [r7, #4]
	.loc 1 43 58
	vldr.32	s15, [r7, #4]       <---这里
	.loc 1 43 66
	vmov.f32	s14, #5.0e-1    <---这里
	vadd.f32	s15, s15, s14   <---这里
	.loc 1 43 40
	vcvt.u32.f32	s15, s15    <---还有这里
	vmov	r2, s15	@ int
	.loc 1 43 38
	ldr	r3, .L2+4
	str	r2, [r3]
	.loc 1 44 1
	nop
	adds	r7, r7, #12
	.cfi_def_cfa_offset 4
	mov	sp, r7
	.cfi_def_cfa_register 13
	@ sp needed
	ldr	r7, [sp], #4
	.cfi_restore 7
	.cfi_def_cfa_offset 0
	bx	lr
.L3:
	.align	2
.L2:
	.word	g_stMeterDataRaw
	.word	g_stMeterData
	.cfi_endproc
.LFE147:
	.size	VoltageWriteCallback, .-VoltageWriteCallback
	.section	.text.CurrentWriteCallback,"ax",%progbits
	.align	1
	.syntax unified
	.thumb
	.thumb_func
	.type	CurrentWriteCallback, %function
```

## 参考资料

[^1]: Joseph Yiu. (2014). _《ARM Cortex-M3与Cortex-M4权威指南（第3版，中译）》_

