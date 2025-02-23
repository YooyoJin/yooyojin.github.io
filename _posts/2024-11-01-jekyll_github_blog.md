---
title: Github博客搭建
author: FrothyJin
date: 2024-11-01
category: Jekyll
layout: post
---

就像当前你所看到的这个博客一样，目前使用的就是利用Jekeyll和Github Page配合创建的一个博客页面。
一方面像这种静态网站就非常的简洁，比较符合我的期望，另外操作起来也十分方面，可以白嫖 :)

## 一、博客搭建详细步骤

### 1.1 准备本地Jekyll环境

1. 安装Ruby

    Ruby，一种简单快捷的面向对象（面向对象程序设计）脚本语言，它应该是Jekyll的依赖，Jekyll是一个用Ruby编写的静态网站生成器。

    本地安装的版本是 ruby 3.0.4p208 (2022-04-12 revision 3fa771dded) [x64-mingw32]

    可以通过CMD查看Ruby版本信息 ruby -v

1. 安装RubyGems

    [RubyGems](https://rubygems.org/pages/download)是Ruby的一个包管理器，它使得开发者能够方便地共享和安装Ruby库（称为 gems）。

    解压下载的安装包

    ```html
    cd D:\rubygems-3.0.6                #切换文件目录
    ruby setup.rb                       #安装
    gem -v                              #查看rubygems版本号
    gem list                            #查看已安装的 gems
    gem update                          #更新
    gem uninstall                       #卸载
    ```

1. 安装Jekyll

    Jekyll的核心是一个文本转换引擎。它的方便之处在于支持多种文本标记语言：Markdown、Textile、HTML，然后Jekyll就会帮你加入你选择主题的样式的布局中。最终生成你自己的静态博客网站。

    ```html
    gem install jekyll                  #安装jekyll  
    jekyll -v                           #查看jekyll版本号
    ```

1. 创建本地项目

    本地项目的话，只能通过本地打开

    ```html
    jekyll new restlessManBlog          #新建博客 
    cd restlessManBlog                  #切换目录 
    jekyll server                       #启动服务器
    ```

1. 启动服务器

    打开浏览器访问：[http://localhost:4000/](http://localhost:4000/)

1. 添加MarkDown相关内容文档

    在项目根目录下的_posts目录创建markdown文档。这里注意.md文档命名要添加 “yyyy-mm-dd”的前缀。

    例如：2024-11-01-jekyll_github_blog.md

### 1.2 部署代码到 Github

1. 创建GitHub账号

1. 创建代码仓库

    仓库名称：账号名称.github.io

1. 提交代码到仓库

    Github Page设置好的话，就可以自动部署啦

### 1.3 关于主题

比较便的办法是fork大佬的仓库即可，我这里用的是这个[Gitbook](http://jekyllthemes.org/themes/gitbook/)的主题，在原来的基础上进行了简单的修改

官方主题网站：[http://jekyllthemes.org/](http://jekyllthemes.org/)

Github 上的博客模板：[https://github.com/jekyll/jekyll/wiki/Sites](https://github.com/jekyll/jekyll/wiki/Sites)

## 二、常见问题&解决办法

### 2.1 博客图标和博客样式消失问题

原作者的_config.yml文件如下，

```
url:              'https://sighingnow.github.io'
baseurl:          '/jekyll-gitbook'
rss:              RSS

# customize the link favicon in header, will be {{site.baseurl}}/{{site.favicon_path}}
favicon_path:     /assets/gitbook/images/favicon.ico
```

我参照原作者的配置修改，发现我的网页不存在我的图标，而且我网页的样式消失，所有页面无法点击。

经过排查发现，我与作者目录层级存在差异，原作者在https://sighingnow.github.io/jekyll-gitbook层级下为博客主页

而我在创立博客时，直接以第一层级目录为主页https://frothyjin.github.io，故我删除了baseurl路径，网页样式恢复正常

删除时，仍发现我没有图标，通过F12查看网页代码，发现favicon.ico没有正确识别，删除favicon_path 第一级"/"后恢复(我也没搞清楚为啥)

修改后，我的_config.yml 文件如下

```
url:              'https://frothyjin.github.io'
baseurl:          ''
rss:              RSS

# customize the link favicon in header, will be {{site.baseurl}}/{{site.favicon_path}}
favicon_path:     assets/gitbook/images/favicon.ico
```

## 三、参考资料

[关于 GitHub Pages (这是Github官方一样的入门文档)](https://docs.github.com/zh/pages/getting-started-with-github-pages/about-github-pages)

[Jekyll + Github Pages 搭建个人免费博客](https://zhuanlan.zhihu.com/p/87225594)