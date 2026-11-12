---
title: VSCode应用-clangd极速配置
author: YooyoJin
date: 2026-11-12
last_modified_at: 2026-11-12
category: Jekyll
layout: post
---

同事安利：CMake工程配clangd，补全跳转很丝滑。捣鼓了一下午，结论：确实丝滑，但每个工程都得先喂一份编译说明书，通用性不如微软C/C++插件省心。

项目原本是Keil单片机工程，后来引入了CMake，正好具备配置条件。

## 1. 配置流程

需要准备：VSCode装clangd插件，CMake和MinGW可用

1. 获取clangd语言服务器[^1]
    - VSCode插件里直接点Download language server，自动下载自动配，最省事
    - 不想用插件自带的，去[LLVM官方 releases](https://github.com/llvm/llvm-project/releases)下载`LLVM-x.x.x-win64.exe`，安装时勾选Add LLVM to the system PATH，装完命令行`clangd --version`能出版本号即可，VSCode会自动识别
1. 生成compile_commands.json[^2]，工程目录下执行，删旧build再生成，防止残留的CMakeCache干扰
    - 执行下面命令
    ``` cmd
        Remove-Item -Recurse -Force build  # 删除旧缓存
        cmake -S . -B build -G "MinGW Makefiles" -DCMAKE_EXPORT_COMPILE_COMMANDS=ON  # 重新生成（注意使用 MinGW 生成器）
    ```
    - 成功后build目录下出现compile_commands.json
1. settings.json指路，文件生成在`main-board/build/`下，VSCode默认在根目录找，需要手动指定
    - 路径按VSCode实际打开的工作区层级调整
    ``` json
    {
        "clangd.arguments": [
        "--compile-commands-dir=${workspaceFolder}/main-board/build"
        ]
    }
    ```
1. 关掉微软C/C++插件的补全，设置里搜`C_Cpp.intelliSenseEngine`设为`disabled`，不然两个语言服务器打架
1. 重启生效，`Ctrl+Shift+P`执行`clangd: Restart language server`
    - 红线消失，`F12`/`Ctrl+Click`跳转，补全和悬停提示精准

``` cmd
    # 删除旧缓存
    Remove-Item -Recurse -Force build

    # 重新生成（注意使用 MinGW 生成器）
    cmake -S . -B build -G "MinGW Makefiles" -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
```

## 2. 使用体验

丝滑是真丝滑，兄弟诚不欺我。跳转快、补全准，悬停提示比微软插件详细，CMake工程开箱即用。

但毛病也明显：每换一个工程都要重新生成一份compile_commands.json。临时接手的老Keil工程、别人的杂活项目，没有现成的编译数据库，还得现配一套，麻烦。微软C/C++插件虽然笨点，胜在啥工程都能凑合补全。

## 常见问题&解决办法

### 1. cmake执行成功，但没有生成compile_commands.json

Windows下不指定生成器，CMake默认用MSVC生成器，而MSVC不支持导出compile_commands.json。命令跑完不报错，文件就是没有，属于悄悄摆烂。换MinGW Makefiles生成器即可，见配置步骤。

### 2. 提示CMake was unable to find a build program corresponding to "Ninja"

系统没装Ninja。`-G Ninja`也可以，但要先装Ninja并配环境变量，嫌麻烦直接用MinGW Makefiles。

### 3. 无法跳转，头文件红波浪线，只能补全标准库

输出面板看clangd日志：

```text
ASTWorker building file ... with command clangd fallback
E[...] IncludeCleaner: Failed to get an entry for resolved path '' from include "xxx.h"
```

关键在`clangd fallback`：clangd没读到编译参数，不知道头文件路径（`-I`）和宏定义（`-D`），本地头文件全部解析失败。解决方法就是生成compile_commands.json，见配置步骤。

### 4. 生成了json，clangd还是找不到头文件

json不在VSCode打开的根目录下时，clangd默认找不到。settings.json里用`--compile-commands-dir`指路，见配置流程第3步。改完记得Restart language server。

### 5. 补全行为怪异

微软C/C++插件的IntelliSense没关，见配置流程第4步。

### 6. 插件的"Download language server"下载到哪了？

不会下载到系统PATH，只下载到VSCode扩展目录，Windows下在：

```text
C:\Users\你的用户名\AppData\Roaming\Code\User\globalStorage\llvm-vs-code-extensions.vscode-clangd\install\版本号\
```

它也不会动系统环境变量，只改VSCode内部的`clangd.path`。设置里搜`clangd.path`，路径指向AppData就是插件自动填的。

已经手动装好clangd的没必要点自动下载，保持现有环境即可，避免版本不一致。

### 7. clangd必须用CMake吗？

不是。clangd只认编译数据库，CMake只是生成手段之一：
- 纯Keil/IAR：手写`compile_flags.txt`，或用`k2c`转换`.uvprojx`
- Makefile工程：`bear -- make`拦截编译自动生成
- 简单单文件：直接手写`compile_flags.txt`

## 参考资料

[^1]: qq_42764906. (2024). _关于在Vscode安装clangd的教程（分别在linux和windows）_. [https://blog.csdn.net/qq_42764906/article/details/135541847](https://blog.csdn.net/qq_42764906/article/details/135541847)

[^2]: gccbuaa. (2026). _Win下的基于LLVM/Clangd+Clangd插件+MINGW+CMake的VSCode配置C/C++开发环境的详细教程_. [https://www.cnblogs.com/gccbuaa/p/19535609](https://www.cnblogs.com/gccbuaa/p/19535609)


