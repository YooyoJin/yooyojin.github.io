---
title: Modbus调试工具
author: YooyoJin
date: 2025-04-27
last_modified_at: 2025-11-27
category: Jekyll
layout: post
mermaid: true
---

Modbus Poll与Modbus Slave是两款我们在调试modbus时常用的两款第三方的调试工具。

Modbus通信包含串口（RTU，ASCLL）和网络（TCP/IP）三种协议。Modbus Poll与Modbus Slave支持三种协议，更好的帮助开发者测试Modbus主从设备

## 1. Modbus Poll

### 1.1. 界面主要功能介绍

**菜单栏Connection -> Connection Setup** 包含基础连接参数配置
- 连接方式(串口、TCP/IP)
- 端口号设置、波特率、数据位、校验位、停止位、连接模式选择（RTU、ASCLL）
- IP地址、IP端口

**菜单栏Setup -> Read/Write Definition** 包含Modbus协议设置
- 从机地址、功能码
- 查询地址、数据读取时间，寄存器起始地址、寄存器连续个数

**菜单栏Display** 可以调整寄存器数据显示方式

**菜单栏Display -> Communication Traffic** 用来监视/查看分析收发数据帧内容

**主窗口** 展示状态和寄存器回读结果
- Tx = 0: Err = 0: ID = 9: F = 03: SR = 1000ms（查询次数、错误次数、从机设备ID、功能码、扫描周期）

### 1.2. Modbus功能码

<div style="overflow-x: auto;">
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <style>
            td {
                border: 1px solid #000;
                padding: 8px;
                white-space: nowrap; /* 所有文字不换行 */
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
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
                    <th>功能码（十进制）</th>
                    <th>功能码（十六进制）</th>
                    <th>功能名称</th>
                    <th>功能概述</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>01</td>
                    <td>0x01</td>
                    <td>Read Coils</td>
                    <td>读取线圈（可读写布尔量，如继电器状态）</td>
                </tr>
                <tr>
                    <td>02</td>
                    <td>0x02</td>
                    <td>Read Discrete Inputs</td>
                    <td>读取离散输入（只读布尔量，如传感器信号）</td>
                </tr>
                <tr>
                    <td>03</td>
                    <td>0x03</td>
                    <td>Read Holding Registers</td>
                    <td>读取保持寄存器（可读写16位数据，如设备参数）</td>
                </tr>
                <tr>
                    <td>04</td>
                    <td>0x04</td>
                    <td>Read Input Registers</td>
                    <td>读取输入寄存器（只读16位数据，如传感器模拟量）</td>
                </tr>
                <tr>
                    <td>05</td>
                    <td>0x05</td>
                    <td>Write Single Coil</td>
                    <td>写入单个线圈（设置单个继电器开/关）</td>
                </tr>
                <tr>
                    <td>06</td>
                    <td>0x06</td>
                    <td>Write Single Register</td>
                    <td>写入单个保持寄存器</td>
                </tr>
                <tr>
                    <td>15</td>
                    <td>0x0F</td>
                    <td>Write Multiple Coils</td>
                    <td>写入多个线圈（批量设置继电器状态）</td>
                </tr>
                <tr>
                    <td>16</td>
                    <td>0x10</td>
                    <td>Write Multiple Registers</td>
                    <td>写入多个保持寄存器（批量写入）</td>
                </tr>
                <tr>
                    <td>22</td>
                    <td>0x16</td>
                    <td>Mask Write Register</td>
                    <td>对保持寄存器进行位掩码写入（按位与/或操作）</td>
                </tr>
                <tr>
                    <td>23</td>
                    <td>0x17</td>
                    <td>Read/Write Multiple Registers</td>
                    <td>同时执行读取和写入多个寄存器的复合操作</td>
                </tr>
                <tr>
                    <td>24</td>
                    <td>0x18</td>
                    <td>Read FIFO Queue</td>
                    <td>读取FIFO（先进先出）队列中的数据（特殊设备使用）</td>
                </tr>
            </tbody>
        </table>
    </body>
    </html>
</div>

_**说明**_
- Modbus TCP 和 RTU 的功能码相同，仅传输格式不同。


## 2. Modbus Slave

### 2.1. 界面主要功能介绍

**菜单栏Setup -> Slave Definition** 包含从机参数设置

其他的化界面基本功能和Modbus Poll差不多

## 3. Modbus Poll/Slave模拟通信

想要模拟通信的化，首先需要通过vpsd虚拟串口工具，建立两个模拟端口连接

配置好Modbus Poll与Modbus slave，端口、波特率、数据位等基本信息就可以实现数据收发。(需要注意，这里两个工具的Slave ID需要保持一致)

下面是我通过Modbus poll工具Communication Traffic捞回的日志，这里我将地址0的数据从原来的0x01修改位0x00。如果从从从机接收日志，收发关系会对调一下。

``` cmd
# 请求设备地址(0x08)读保持寄存器(0x03)，起始地址(0x0000)，读10个寄存器(0x000a)，CRC校验(c5 54)
Tx:000032-08 03 00 00 00 0A C5 54

# 响应设备地址(0x08)读保持寄存器(0x03)，字节数(0x14，20字节，对应10个16位寄存器，就是每个寄存器用两个八位字节存表示)，数据(第一个寄存器为0x0001，其他为0x0000)，CRC校验(34 a1)
Rx:000033-08 03 14 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 34 A1

# 请求设备地址(0x08)写单个寄存器(0x06)，起始入地址(0x0000)，写入值(0x0000)，CRC校验(89 53)
Tx:000034-08 06 00 00 00 00 89 53

# 响应与请求完全相同，表示写入成功确认
Rx:000035-08 06 00 00 00 00 89 53

# 内容同Tx:000032，完成两次定时请求与响应动作
Tx:000036-08 03 00 00 00 0A C5 54
Rx:000037-08 03 14 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 09 5D
Tx:000038-08 03 00 00 00 0A C5 54
Rx:000039-08 03 14 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 09 5D
```

## 4. 常见的功能码与响应帧格式

详细请参考Modbus协议“圣经”[^1]

``` cmd
# 03功能码(读取保持寄存器) 请求帧结构
从机地址(1byte)+功能码(1byte)+起始地址(2byte)+要读取的存器数量(2byte)+校验(2byte)
# 03功能码响应帧结构
从机地址(1byte)+功能码(1byte)+字节数(1byte)+寄存器数据(n*2byte)+校验(2byte)

# 06功能码(写入单个保持寄存器) 请求帧结构
从机地址(1byte)+功能码(1byte)+起始地址(2byte)+写入的寄存器值(2byte)+校验(2byte)
# 06功能码响应帧结构
从机地址(1byte)+功能码(1byte)+起始地址(2byte)+写入的寄存器值(2byte)+校验(2byte)

# 16功能码(多寄存器预设) 请求帧结构
从机地址(1byte)+功能码(1byte)+起始地址(2byte)+写入寄存器数量(2byte)+字节数(1byte)+写入值(n*2byte)+校验(2byte)
# 16功能码 响应帧结构
从机地址(1byte)+功能码(1byte)+起始地址(2byte)+成功写入寄存器数量(2byte)+校验(2byte)
```
_**注意**_
- Modbus所有多字节端使用大端序，CRC也同样（高位在前）
- 为什么字节数一字节？而寄存器数量两字节？既然规定了Modbus整个数据帧的最大长度不能超过256字节，为什么寄存器数量不也用1字节表示？

## 常见问题&解决办法

### Pc使用Modbus Slaver模拟从机时，主句发送03功能码从机返回83错误响应

``` cmd
Rx:001616-01 03 00 00 00 1E C5 C2
Tx:001617-01 83 02 C0 F1
```

错误代码02表示非法数据地址，具体原因是寄存器范围超出限制，主机请求读取从地址0开始的30个保持寄存器(00 00 00 1E)，Modbus Slave软件中可能没有定义足够多的保持寄存器。

解决办法：增加从机软件设置的寄存数量

### Modbus协议中，-1传输，用int16接收变成65535

问题1：为什么-1接受变成65535？

问题2：为什么int16类型可以接收65535而不溢出？

在modbus中一个寄存器的数值范围在0~65535，-1是一个有符号整数，它超出了单个寄存器所能表示的范围。因此，无法用一个单独的03功能码寄存器来直接表示-1。

``` cmd
请求帧：01 10 00 00 00 01 02 FF FF A7 E0
从设备地址: 01
功能码：10
起始地址：00 00
寄存器数量：01
字节计数：02
写入数据：FF FF (无符号16位整数:65535，有符号位整数：-1。负数用补码（反码+1）表示，所以-1 的补码：11111111 FF，65535的表达上跟-1是一样的)
CRC校验码：A7 E0
```
在处理过程中，针对双字节先把它当作一个uint16值65535存储到了一个中间变量，然后再转换给int16。

为什么没有溢出呢？是因为我配置了`typedef signed int int16`，对于八位单片机signed int是16位，但是对于32位单片机signed int是32位，所以明明用16位int去接仍能接到65535，而不是-1。

根因是由于从八位机移植到三十二位机时而没有注意类型导致的。

解决办法：标准整数类型重新定义，使用C标准库中的int16_t类型，确保在不同平台上都有正确的16位有符号整数表示。

### 主机发送数据，Modbus slave接收，slave不报错不响应

主机发送数据，Slave接收但不响应。通过监控看到RX数据与发送匹配。数据帧格式正确符合03功能码结构。

怀疑CRC校验错误，检查RCR功能代码，未发现异常

尝试更换CRC高低位顺序，解决。

根因：Modbus协议中CRC大端序（高字节在前，低字节在后），而我的CRC校验值未明确规定字节序，导致不匹配。


## 参考资料
[^1]: MODICON, Inc. (1996). _Modbus Protocol PI-MBUS-300.pdf_. [https://modbus.org/docs/PI_MBUS_300.pdf](https://modbus.org/docs/PI_MBUS_300.pdf)