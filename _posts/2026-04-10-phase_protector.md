---
title: 简易无中线三相保护器开发笔记
author: YooyoJin
date: 2026-04-10
last_modified_at: 2026-04-13
category: Jekyll
layout: post
mermaid: true
---

## 1. 项目背景

为什么需要三相保护器？

三相电机应用广泛应该，常见于压缩机等系统中。一般电机都有特定的驱动器，驱动器一定程度起到保护作用。但是在定频压缩机系统中，电机常直接接入三相电源，缺乏智能保护。

常见故障：
- 缺相：电机虽能继续运转，但电流骤升，绕组迅速烧毁；
- 错相：电机反转，压缩机等设备反转会导致无法回油，最终压缩机缺油磨损；
- 过压、欠压：电机发热，启动困难等；

因此，低成本、可靠的三相保护器就有了需求。现在如果买一个三项保护器，国产的话目前也要几十上百的，算下来成本就太高啦。

本项目中采用的是无中线方案，传统的三项检测一般都带中线作为参考。无中线意味着：
- 无法检测对地电压，自然没有欠压之类的保护功能。
- 缺相时，缺失相会与另一项波形完全吻合同步（踩了坑）。检测需要特殊设计。
- 便宜。

## 2. 核心原理

电路可以参考[^1]，电路部分不是我画的，不好窃取他人成果，就不贴图了。

硬件拓扑如下：

``` mermaid
graph LR
    subgraph 强电侧 [强电侧 无中线系统]
        U(U相) --> R1[限流电阻] --> U1[光耦 U1]
        V(V相) --> R2[限流电阻] --> U2[光耦 U2]
        W(W相) --> R3[限流电阻] --> U3[光耦 U3]
    end

    U1 -. 回路 .-> V
    U2 -. 回路 .-> W
    U3 -. 回路 .-> U

    subgraph 弱电侧 [弱电侧]
        U1 --- P1[GPIO1] --- MCU((MCU))
        U2 --- P2[GPIO2] --- MCU
        U3 --- P3[GPIO3] --- MCU
    end

    style 强电侧 fill:#fce4d6,stroke:#ed7d31,stroke-width:2px
    style 弱电侧 fill:#dae3f3,stroke:#4472c4,stroke-width:2px

    style U fill:#f8cbad,stroke:#ed7d31,stroke-width:2px
    style V fill:#f8cbad,stroke:#ed7d31,stroke-width:2px
    style W fill:#f8cbad,stroke:#ed7d31,stroke-width:2px

    style U1 fill:#ffe699,stroke:#bf8f00,stroke-width:2px
    style U2 fill:#ffe699,stroke:#bf8f00,stroke-width:2px
    style U3 fill:#ffe699,stroke:#bf8f00,stroke-width:2px

    style P1 fill:#bdd7ee,stroke:#4472c4,stroke-width:2px
    style P2 fill:#bdd7ee,stroke:#4472c4,stroke-width:2px
    style P3 fill:#bdd7ee,stroke:#4472c4,stroke-width:2px

    style MCU fill:#c5e0b4,stroke:#70ad47,stroke-width:3px
```

工作原理很简单，三相电通过限流电阻分别接入三个光耦的输入端。当某相电压处于正半周且超过光耦导通阈值（约1.2V）时，该相光耦导通；负半周时光耦截止。

光耦输出端采用上拉电阻接VCC，并连接到MCU的GPIO引脚。光耦导通时，输出端被拉低至GND，GPIO检测到低电平；光耦截止时，输出端被上拉至VCC，GPIO检测到高电平。

由于三相电相位互差120°，三个GPIO会输出相位差120°的方波信号。通过检测这些方波的边沿和时序关系，即可判断是否缺相或错相。

在无中线电路中，缺相时，该相的输入会被其他相通过负载回路耦合，即会有两相的边沿始终同时出现。简单来说就是缺W相时，W相输入端悬空，但因为光耦输入端直接跨接于两相线之间，V相的电压会"串"到W相上，导致W相的光耦被V相"带着"一起导通。（开发时想当然认为三相电悬空会使光耦不导通，测试后才发现错误，只好改版）

``` cmd
正常情况（每相互差120°）：
    U: ────┐    ┌────┐    ┌────
           └────┘    └────┘
    V:  ┌────┐    ┌────┐    ┌──
       ─┘    └────┘    └────┘
    W:     ┌────┐    ┌────┐
       ────┘    └────┘    └────

缺W相（W与V同步）：
    U: ────┐    ┌────┐    ┌────
           └────┘    └────┘
    V:  ┌────┐    ┌────┐    ┌──
       ─┘    └────┘    └────┘
    W:  ┌────┐    ┌────┐    ┌──
       ─┘    └────┘    └────┘
```

## 3. 检测逻辑(软件实现)

我这里设计的是实时检测模式，上层再对故障进行锁定，设计了一点容错机制。
- 缺相检测：40ms窗口（两个工频周期）内，两相同步边沿出现≥3次 → 缺相故障；窗口超时无同步 → 自动恢复。
- 错相检测：边沿顺序状态机，正确顺序 U→V→W 累计计数，相序错误立即报故障；连续正确≥3次 → 自动恢复。现在看起来错项好像有点太严格了~

怕硬件GPIO回读有毛刺，还加了滤波，当连续2次采样一致算，电平变化。

系统框图：
``` mermaid
flowchart LR
    INIT[系统初始化<br/>GPIO/定时器/变量] --> TICK

    subgraph TICK [每1ms中断]
        direction LR
        PULSE[脉冲超时检测<br/>三相独立计数]
        SYNC[缺相同步检测<br/>40ms窗口同步计数]
        SEQ[相序检测<br/>U→V→W状态机]
    end

    TICK --> JUDGE{故障判定}
    JUDGE --> RELAY[继电器输出控制]
    RELAY --> TICK
```

核心代码部分如下：
``` c
/**
 * @brief 轮询扫描相位状态
 * @note 必须在1ms定时器中断中调用，市电一般50Hz，20ms相位变化
 */
void PhaseScanProcess(void)
{
    uint8_t u8SeqError = 0;  // 相序检测标记位（1=相序错误）
    uint8_t u8LossError = 0;  // 缺相检测标记位（1=缺相错误）
    uint8_t u8NowU = 0, u8NowV = 0, u8NowW = 0;  // 当前读到的电平结果
    uint8_t u8SumU = 0, u8SumV = 0, u8SumW = 0;  // 前3次扫描的和
    uint8_t u8StableU = 0, u8StableV = 0, u8StableW = 0;  // 稳定的电平结果
    uint8_t u8EdgeU = 0, u8EdgeV = 0, u8EdgeW = 0;  // 边沿检测结果（1=有跳变）
    uint8_t i = 0;

    // 1. 如果之前已经锁定故障或未初始化，直接返回，不再检测，防止闪断
    if (s_u8ErrorSure != 0 ||
        s_u8InitializedFlag != 1) {
        return;
    }

    // 2. 扩展板在位判断

    // 3. 读取当前IO电平 + 检测边沿 (方波脉冲) + 滤波
    u8NowU = PIN_PHASE_U;
    u8NowV = PIN_PHASE_V;
    u8NowW = PIN_PHASE_W;

    // 更新滤波器缓冲区
    s_u8FilterU[s_u8FilterIndex] = u8NowU;
    s_u8FilterV[s_u8FilterIndex] = u8NowV;
    s_u8FilterW[s_u8FilterIndex] = u8NowW;
    s_u8FilterIndex = (s_u8FilterIndex + 1) % FILTER_DEPTH;

    // 取多数值作为稳定电平
    for (i = 0; i < FILTER_DEPTH; i++) {
        u8SumU += s_u8FilterU[i];
        u8SumV += s_u8FilterV[i];
        u8SumW += s_u8FilterW[i];
    }

    u8StableU = (u8SumU > FILTER_DEPTH/2) ? 1 : 0;
    u8StableV = (u8SumV > FILTER_DEPTH/2) ? 1 : 0;
    u8StableW = (u8SumW > FILTER_DEPTH/2) ? 1 : 0;

    // 下降沿边沿检测
    u8EdgeU = (u8StableU != s_u8LastU && s_u8LastU == 1);
    u8EdgeV = (u8StableV != s_u8LastV && s_u8LastV == 1);
    u8EdgeW = (u8StableW != s_u8LastW && s_u8LastW == 1);

    s_u8LastU = u8StableU;
    s_u8LastV = u8StableV;
    s_u8LastW = u8StableW;

    // 4. 缺相检测，检测到边沿 (有脉冲)，清空计时器；否则计时器+1
    s_u32TimerU = u8EdgeU ? 0 : (s_u32TimerU < 10000 ? s_u32TimerU + 1 : s_u32TimerU);
    s_u32TimerV = u8EdgeV ? 0 : (s_u32TimerV < 10000 ? s_u32TimerV + 1 : s_u32TimerV);
    s_u32TimerW = u8EdgeW ? 0 : (s_u32TimerW < 10000 ? s_u32TimerW + 1 : s_u32TimerW);
    if (s_u8TimingFlag) { s_u32SyncTimer < 10000 ? s_u32SyncTimer++: s_u32SyncTimer; }

    // 判断是否超时 (缺相)，由于硬件方安为无中线方案，缺一相时，该相会与另一相完全同步
    // 持续检测是否有两相的边沿始终同步出现。
    if ((u8EdgeU && u8EdgeV) || (u8EdgeV && u8EdgeW) || (u8EdgeW && u8EdgeU)) {
        if (!s_u8TimingFlag) {
            // 首次检测到同步，启动缺相同步计时
            s_u8TimingFlag = 1;
            s_u8SyncCnt = 0;
        }
        s_u32SyncTimer = 0;
        if (s_u8SyncCnt < 255) {
            // 连续缺相同步+1;
            s_u8SyncCnt++;
        }
    }

    // 两个工频周期内连续出现超过2次同步边沿
    if (s_u8TimingFlag && s_u32SyncTimer < PULSE_LOST_TIME_MS && s_u8SyncCnt >= PHASE_SYNC_CNT) {
        u8LossError = 1;
    } else if (s_u8TimingFlag && s_u32SyncTimer >= PULSE_LOST_TIME_MS){
        // 两个工频周期内未出现同步情况
        s_u8TimingFlag = 0;
        s_u32SyncTimer = 0;
        s_u8SyncCnt = 0;
        u8LossError = 0;
    }

    if (s_u32TimerU > PULSE_LOST_TIME_MS || s_u32TimerV > PULSE_LOST_TIME_MS || s_u32TimerW > PULSE_LOST_TIME_MS ||
        u8LossError) {
        s_eFinalStatus = E_PHASE_STATUS_FAULT_PHASE_LOSS;  // 设为故障状态
        // s_u8ErrorSure = 1;
        s_ePhaseStep = E_PHASE_STEP_WAIT_U;                // 复位相序检测状态机
        s_u8SeqOk = 0;                                     // 复位相序检测计数器
        return;
    }

    // 5. 错相检测, U -> V -> W (循环)
    if (s_ePhaseStep == E_PHASE_STEP_WAIT_U) {
        //  Step 0: 等待U相的脉冲边沿
        if (u8EdgeU) {
            s_ePhaseStep = E_PHASE_STEP_WAIT_V;
        } else if (u8EdgeV || u8EdgeW) {
            u8SeqError = 1;
        }
    } else if (s_ePhaseStep == E_PHASE_STEP_WAIT_V) {
        //  Step 1: 等待V相的脉冲边沿
        if (u8EdgeV) {
            s_ePhaseStep = E_PHASE_STEP_WAIT_W;
        } else if (u8EdgeU || u8EdgeW) {
            u8SeqError = 1;
        }
    } else if (s_ePhaseStep == E_PHASE_STEP_WAIT_W) {
        //  Step 2: 等待W相的脉冲边沿
        if (u8EdgeW) {
            s_ePhaseStep = E_PHASE_STEP_WAIT_U;
            if (s_u8SeqOk < 255) {
                // 连续正确次数+1;
                s_u8SeqOk++;
            }
        } else if (u8EdgeU || u8EdgeV) {
            u8SeqError = 1;
        }
    }

    if (u8SeqError) {
        s_eFinalStatus = E_PHASE_STATUS_FAULT_WRONG_SEQUENCE;
        // s_u8ErrorSure = 1;
        s_ePhaseStep = E_PHASE_STEP_WAIT_U;
        s_u8SeqOk = 0;
    } else {
        // 最终判定: 相序是否稳定正常?
        if (s_u8SeqOk >= PHASE_SEQ_OK_CNT) {
            s_eFinalStatus = E_PHASE_STATUS_NORMAL; // 连续多次正确，判定正常
        }
    }

    return; // 正常结束
}
```

## 4. 实测

实测结果与预期完全一致。 使用三相调压器进行验证，并在不同工频下分别测试，各项功能正常，可以实时检测并反馈当前故障状态，无明显异常。

## 5. 优化与改进

后来客户给发了一款他们目前在用的三相保护器，除了相序和错项外，还集成了三相不平衡保护功能。

原理是实时计算任意一相电压与其余两相电压的不平衡度，当该值达到设定阈值时，控制继电器动作。

$$\frac{U_{\text{max}} - U_{\text{min}}}{U_s} \times 100\% \geq \varepsilon$$

_**其中**_
- $U_{\text{max}}$ 为三相中电压最大值；
- $U_{\text{min}}$ 为三相中电压最小值；
- $U_s$ 为额定控制电源电电压，比如380V或220V，取决于系统；
- $\varepsilon$ 为设定动作阈值，可在 $8\%$ 至 $13\%$ 范围内整定。

当前硬件缺少电压检测电路，暂无法实现，可能列入下版改进计划。

## 参考资料

[^1]: 哄娃睡觉. (2025). _380v三相电的相序检测，缺相检测，相序保护_. [https://blog.csdn.net/ddidi111/article/details/145815324](https://blog.csdn.net/ddidi111/article/details/145815324)
