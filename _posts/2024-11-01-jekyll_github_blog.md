---
title: Github博客搭建
author: YooyoJin
date: 2024-11-01
category: Jekyll
layout: post
---

就像当前你所看到的这个博客一样，目前使用的就是利用Jekeyll和Github Page配合创建的一个博客页面。
一方面像这种静态网站就非常的简洁，比较符合我预期，另外操作起来也十分方便，可以白嫖 :)

## 1. 博客搭建详细步骤

### 1.1. 准备本地Jekyll环境

1. 安装Ruby

    [Ruby](https://rubyinstaller.org/downloads/)，一种简单快捷的面向对象（面向对象程序设计）脚本语言，它应该是Jekyll的依赖，Jekyll是一个用Ruby编写的静态网站生成器。

    本地安装的版本是`ruby 3.0.4p208 (2022-04-12 revision 3fa771dded) [x64-mingw32]`

    可以通过cmd查看已安装好的Ruby版本信息`ruby -v`

1. 安装RubyGems

    [RubyGems](https://rubygems.org/pages/download)是Ruby的一个包管理器，它使得开发者能够方便地共享和安装Ruby库（称为 gems）。

    需要先从官网下载并解压安装包

    ``` cmd
    cd D:\rubygems-3.0.6            #切换文件目录
    ruby setup.rb                   #安装
    gem -v                          #查看rubygems版本号
    gem list                        #查看已安装的 gems
    gem update                      #更新
    gem uninstall                   #卸载
    ```

1. 安装Jekyll

    Jekyll的核心是一个文本转换引擎。它的方便之处在于支持多种文本标记语言：Markdown、Textile、HTML，然后Jekyll就会帮你加入你选择主题的样式的布局中。最终生成你自己的静态博客网站。

    当然Jekyll可以通过非gem方式安装，但RubyGems是官方推荐且最便捷的途径，能完美兼容插件和版本管理需求。

    ``` cmd
    gem install jekyll              #安装jekyll
    jekyll -v                       #查看jekyll版本号
    ```

1. 创建本地项目

    本地项目的话，只能通过本地打开

    ``` cmd
    jekyll new restlessManBlog      #新建博客
    cd restlessManBlog              #切换目录
    jekyll server                   #启动服务器
    ```

1. 启动服务器

    打开浏览器访问：[http://localhost:4000/](http://localhost:4000/)

1. 添加MarkDown相关内容文档

    在项目根目录下的_posts目录创建markdown文档。这里注意.md文档命名要添加 “yyyy-mm-dd”的前缀。

    例如：2024-11-01-jekyll_github_blog.md

### 1.2. 部署代码到Github

1. 创建GitHub账号

1. 创建代码仓库

    注意：仓库名称：账号名称.github.io

1. 提交代码到仓库

    Github Page设置好的话，就可以自动部署啦

### 1.3. 关于主题

比较方便的做法是fork大佬的仓库即可，这里使用的是这个[Gitbook](http://jekyllthemes.org/themes/gitbook/)的主题，在原来的基础上进行了简单的修改

官方主题网站：[http://jekyllthemes.org/](http://jekyllthemes.org/)

Github上的博客模板：[https://github.com/jekyll/jekyll/wiki/Sites](https://github.com/jekyll/jekyll/wiki/Sites)

## 常见问题&解决办法

### 博客图标和博客样式消失问题

原作者的_config.yml文件如下，

``` yaml
url:              'https://sighingnow.github.io'
baseurl:          '/jekyll-gitbook'
rss:              RSS

# customize the link favicon in header, will be {{site.baseurl}}/{{site.favicon_path}}
favicon_path:     /assets/gitbook/images/favicon.ico
```

我参照原作者的配置修改，发现我的网页不存在我的图标，而且我网页的样式消失，所有页面无法点击。

经过排查发现，我与作者目录层级存在差异，原作者在https://sighingnow.github.io/jekyll-gitbook层级下为博客主页

而我在创立博客时，直接以第一层级目录为主页https://yooyojin.github.io，故我删除了baseurl路径，网页样式恢复正常

删除时，仍发现我没有图标，通过F12查看网页代码，发现favicon.ico没有正确识别，删除favicon_path第一级"/"后恢复(我也没搞清楚为啥)

修改后，我的_config.yml 文件如下

``` yaml
url:              'https://yooyojin.github.io'
baseurl:          ''
rss:              RSS

# customize the link favicon in header, will be {{site.baseurl}}/{{site.favicon_path}}
favicon_path:     assets/gitbook/images/favicon.ico
```

### 博客Mermaid样式失效

最新的mermaid地址可以从这里获取：https://www.jsdelivr.com/package/npm/mermaid

通常只需要修改`mermaid.html`文件中`mermaid_script.src`即可

> 不需要预备的js代码，只需要单独地调用一个mermaid-js库即可,调用完成后，mermaid-js将会默认将HTML页面中class为mermaid的标签渲染为mermaid流程图<br>
> [HTML - 在网页上显示mermaid流程图（使用纯js在网页上显示mermaid流程图）](https://blog.csdn.net/Tisfy/article/details/131464925#:~:text=%E6%9C%80%E6%96%B0%E7%89%88%E7%9A%84mermaidjs%E5%9C%B0%E5%9D%80%E5%8F%AF%E4%BB%A5%E5%9C%A8%20https%3A%2F%2Fwww.jsdelivr.com%2Fpackage%2Fnpm%2Fmermaid%20%E8%8E%B7%E5%8F%96%E3%80%82,%E4%BD%BF%E7%94%A8%E6%95%88%E6%9E%9C%EF%BC%9A%20%E7%94%B1%E4%BA%8E%E6%9F%90%E4%BA%9B%E6%BB%A5%E7%94%A8%E7%9A%84%E5%8E%9F%E5%9B%A0%EF%BC%8Cjsdelivr%E5%9C%A8%E5%A4%A7%E9%99%86%E6%97%A0%E6%B3%95%E8%AE%BF%E9%97%AE%E3%80%82%20%E5%9B%A0%E6%AD%A4%E5%BF%85%E9%A1%BB%E5%80%9F%E5%8A%A9%E5%85%B6%E4%BB%96js%E6%BA%90%EF%BC%8C%E6%88%96%E8%80%85%E5%B0%86mermaid%E6%89%80%E9%9C%80%E4%BB%A3%E7%A0%81%E7%AD%89%E4%B8%8B%E8%BD%BD%E8%87%B3%E6%9C%AC%E5%9C%B0%E3%80%82)

``` yaml
mermaid_script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';
```

### 本地启动jekyll server错误，提示'Bundler::Resolver#raise_not_found!': Could not find gem 'jekyll-feed' in locally installed gems. (Bundler::GemNotFound)
``` cmd
E:\MyWorkspace\Project\yooyojin.github.io>jekyll -v\
D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/resolver.rb:358:in 'Bundler::Resolver#raise_not_found!': Could not find gem 'jekyll-feed' in locally installed gems. (Bundler::GemNotFound)
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/resolver.rb:452:in 'block in Bundler::Resolver#prepare_dependencies'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/resolver.rb:427:in 'Hash#each'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/resolver.rb:427:in 'Enumerable#filter_map'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/resolver.rb:427:in 'Bundler::Resolver#prepare_dependencies'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/resolver.rb:65:in 'Bundler::Resolver#setup_solver'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/resolver.rb:30:in 'Bundler::Resolver#start'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/definition.rb:745:in 'Bundler::Definition#start_resolution'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/definition.rb:342:in 'Bundler::Definition#resolve'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/definition.rb:653:in 'Bundler::Definition#materialize'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/definition.rb:237:in 'Bundler::Definition#specs'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/definition.rb:304:in 'Bundler::Definition#specs_for'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler/runtime.rb:18:in 'Bundler::Runtime#setup'
        from D:/Ruby34-x64/lib/ruby/site_ruby/3.4.0/bundler.rb:167:in 'Bundler.setup'
        from D:/Ruby34-x64/lib/ruby/gems/3.4.0/gems/jekyll-4.4.1/lib/jekyll/plugin_manager.rb:52:in 'Jekyll::PluginManager.require_from_bundler'
        from D:/Ruby34-x64/lib/ruby/gems/3.4.0/gems/jekyll-4.4.1/exe/jekyll:11:in '<top (required)>'
        from D:/Ruby34-x64/bin/jekyll:36:in 'Kernel#load'
        from D:/Ruby34-x64/bin/jekyll:36:in '<main>'
```

解决办法：这里我们直接在本执行`bundle install`解决

**Q: 什么是`bundle install`？**<br>
**A:** 他的作用是根据项目目录下的Gemfile文件，自动安装所有列出的Ruby gems（包括Jekyll及其插件），并确保版本兼容性。

所以如果是新项目可以直接`bundle init`一下

如果项目已经存在，需要在新的环境中运行，记得需要先`bundle install`，把依赖的文件先装载

## 参考资料

[关于 GitHub Pages (这是Github官方一样的入门文档)](https://docs.github.com/zh/pages/getting-started-with-github-pages/about-github-pages)

[Jekyll + Github Pages 搭建个人免费博客](https://zhuanlan.zhihu.com/p/87225594)