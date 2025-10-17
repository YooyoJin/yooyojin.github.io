---
title: Clang-Format代码格式刷
author: YooyoJin
date: 2025-10-16
category: Jekyll
layout: post
mermaid: true
---

Clang-Format针对C/C++代码格式化的利器。

## 1. Clang-Format是什么？

我也是初次接触Clang，顺便了解下他的是什么成分。

从功能上来看，他是一个根据可配置的规则，自动格式化代码的工具。

从来源上看，是属于LLVM（Low Level Virtual Machine，底层虚拟机？但是实际上他的功能好像不是一个虚拟机，而是代码编译器和优化器）项目的一个的一个功能，通常随LLVM一起安装。而LLVM、Clang（Clang是LLVM生态中的编译前端，将高级语言代码翻译成LLVM能理解的）和我们常用的GCC一样，属于程序编译器。

从网络上了解到的信息来看，它似乎比GCC更优秀，更快的编译速度、更少的内存占用，更容易被集成。

> 普通格式化工具：可能基于正则表达式进行文本替换。它们不理解代码结构，很容易在复杂的宏、注释或字符串中出错。<br>
> Clang-Format：它首先使用和Clang编译器完全相同的词法分析器和语法分析器。这意味着它看到的不是一串文本，而是一棵抽象语法树（AST）。<br>
> 这意味着Clang-Format能准确无误地知道：哪部分是变量名，哪部分是类型名。哪段代码是一个函数声明，哪段是一个if语句块。注释和代码字符串的具体位置和上下文。

这种优势使得它在处理C/C++等语言的复杂语法结构时具备了其他工具难以比拟的智能。

## 2. Clang-Format安装

操作步骤：
1. 去[LLVM官网](https://llvm.org/builds/)下载相应的版本。我是Windows，直接download最新的版本，这里会跳转到github，找到他的发布版本下载即可；
1. 一路next，不过要勾选添加环境变量！没注意的话需要手动添加；
1. 本地cmd窗口，输入`clang-format --version`命令，弹出版本即安装成功。

## 3. 使用VSCode刷格式

操作步骤：
1. 准备VSCode环境一份，此处省略一万字；
1. 安装C/C++（Microsoft）插件，下载的人很多的这个；
1. 进入C/C++插件设置，搜索clang，进行以下配置：
    - C_Cpp: Clang_format_path：D:\Program Files\LLVM\bin\clang-format.exe；这个是clang-format的应用程序路径；
    - C_Cpp: Clang_format_style：file:D:\Program Files\LLVM\format\file.clang-format；这个是设置的规则路径，可以先从网上抄一份，后续再做修改；
    - C_Cpp: Formatting: clangFormat；这个是配置格式化设置的默认引擎；

这样准备工作就完成了，这里网上教程很多不再赘述。

## 4. .clang-format文件规则

在配置VScode的代码格式化工具时，参考了博主[Ruby1019]提供的clang format配置[^1]。这里根据自己的需要做了一些调整。

``` yaml
---
Language: Cpp

# 基础样式：基于Google风格，针对C语言调整
BasedOnStyle: Google

# 圆括号之后，多行内容进行对齐
AlignAfterOpenBracket: Align

# 连续赋值时，对齐所有等号
AlignConsecutiveAssignments: true
# 连续声明时，对齐所有声明的变量名
AlignConsecutiveDeclarations: true

# 连续宏定义时，对齐所有定义值
AlignConsecutiveMacros: AcrossEmptyLinesAndComments
# 将对齐分割到多行上的单个表达式的操作数
AlignOperands: Align
# 对齐连续的尾随注释
AlignTrailingComments: true

# 允许将一个函数声明的所有参数移到下一行
AllowAllParametersOfDeclarationOnNextLine: false
# 将简单的语句块放到一个单行
AllowShortBlocksOnASingleLine: false
# if语句放单行规则：Never-从不放单行
AllowShortIfStatementsOnASingleLine: Never

# 如果为false，函数调用的参数要么全部在同一行，要么各有一行
BinPackArguments: false
# 如果为false，函数声明或函数定义的参数将全部在同一行或各有一行
BinPackParameters: false

BreakBeforeBraces: Custom
# 控制单独的大括号换行事件
BraceWrapping:
  # 使控制语句(if/for/while/switch/..)换行
  AfterControlStatement: MultiLine
  # 使枚举定义换行
  AfterEnum: true
  # 使函数定义换行
  AfterFunction: true
  # 使结构定义换行
  AfterStruct: true
  # 使共同体定义换行
  AfterUnion: true
  # 在else之前换行
  BeforeElse: false
  # 换行大括号缩进
  IndentBraces: false
  # 空函数是否可以放在单行：true不允许
  SplitEmptyFunction: true
  # 空类，结构或联合主体是否可以放在单行：true不允许
  SplitEmptyRecord: true
  # 空namespace是否可以放在单行：true不允许
  SplitEmptyNamespace: true

SpaceBeforeParens: Custom
# 控制圆括号前的单独空格
SpaceBeforeParensOptions:
  # 在控制语句关键字(for/if/while…)和开括号之间放置空格
  AfterControlStatements: true
  # 在函数声明名称和开括号之间不允许使用空格
  AfterFunctionDeclarationName: false

# 指针对齐：右
PointerAlignment: Right
# 三元运算符将被放置在换行后
BreakBeforeTernaryOperators: true
# 每行字符的限制，0表示没有限制
ColumnLimit: 160
# 缩进空格宽度：4
IndentWidth: 4
# 保留在赋值操作符之前的空格
SpaceBeforeAssignmentOperators: true
# 不要排序include的头文件
SortIncludes: Never
# 允许重新排版注释
ReflowComments: true
# 尾行注释前的空格数
SpacesBeforeTrailingComments: 2
# 连续空行的最大数量
MaxEmptyLinesToKeep: 1
# 使用tab字符：Never从不使用
UseTab: Never
# 在圆括号内插入空格
SpacesInParentheses: false
# 在方括号内插入空格
SpacesInSquareBrackets: false
```

## 常见问题

### Clang-Format格式化失败请查看输出窗口

查看输出窗口，结果输出窗口里什么内容都没有，这是因为我默认筛选了cmake的日志。这里需要选择C/C++，这样就可以看到格式化失败的信息了。

``` cmd
格式化失败:
"D:\Program Files\LLVM\bin\clang-format.exe" "--style=file:D:\Program Files\LLVM\formats\file.clang-format" --fallback-style=LLVM --Wno-error=unknown --offset=1350 --length=204 --assume-filename=E:\MyWorkspace\Project\20250703EvaporativeCooling\evaporative-cooling\EvaporativeCooling\source\app\Vars.h E:\MyWorkspace\Project\20250703EvaporativeCooling\evaporative-cooling\EvaporativeCooling\source\app\Vars.h
Error reading D:\Program Files\LLVM\formats\file.clang-format: no such file or directory
```
这里很明确提示了它找不到我们写的.clang-format文件。检查我们的路径，确实跟实际的.clang-format路径并不匹配。

重新匹配路径后可以正确执行格式刷新，也是非常的安逸！

## 参考资料

[^1]: Ruby1019. [VScode使用clang format文档自动代码格式化（C语言）](https://blog.csdn.net/weixin_42217191/article/details/129516325)