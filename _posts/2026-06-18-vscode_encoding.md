---
title: VSCode应用-软件编码
author: YooyoJin
date: 2026-06-18
last_modified_at: 2026-06-18
category: Jekyll
layout: post
---

团队编码老不好，总是烫烫烫烫锟斤拷锟斤拷锟斤拷锟，那多半是废了。

每次克隆下来总是乱码，原因很简单，每个同事编码方式不一样，我用的VSCode默认编码是UTF-8，而同事的VSCode因为之前接手过老项目，全局默认改成了GBK。

每次通过设置，改了全局的编码方式，换了项目又要改。这个问题其实可以通过一个`.vscode/settings.json`文件彻底解决，既然解决不了大家的配置习惯，那就统一规则。

### 1. 编码

编码简单来说就是翻译规则，把汉字或字母翻译成计算机存储的二进制数。

常见编码 UTF-8(全球标准)、GBK/GB2312（中国标准，据说对于中文存储比较省空间）、ASCII（远古系统，不支持中文）。

所以出现乱码就是翻译的方式不同，就像用中文翻译一段日文，规则不一样，所以无法理解，形成乱码。

### 2. VSCode配置优先级

VSCode有三个层级，优先级从低到高，高优先级会覆盖低优先级配置！
- 默认设置，VSCode内置设置，针对本地所有项目；
- 用户设置，全局`settings.json`，本机所有项目;
- 工作区设置，项目`.vscode/settings.json`，仅当前项目；

### 2. VSCode配置项目UTF-8

既然如此，我们就可以利用这个优先级，覆盖所有人的全局配置。
1. `Ctrl+Shift+P`，输入`Preferences: Open Workspace Settings (JSON)`，这里即自动创建一个空的`settings.json`;
1. 在json中增加如下内容
``` json
{
  "files.encoding": "utf8",
}
```
1. 把这个文件提交到git
1. 打开项目后自动使用UTF-8编码，无需再手动配置


此外，还可以统一换行，统一缩进等等

``` json
{
  // ---------- 编码相关 ----------
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,

  // ---------- 换行符统一 ----------
  "files.eol": "\n",

  // ---------- 缩进统一 ----------
  "editor.tabSize": 4,
  "editor.detectIndentation": false,
}
```