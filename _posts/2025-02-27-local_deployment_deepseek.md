---
title: 本地部署DeepSeek
author: YooyoJin
date: 2025-03-01
category: Jekyll
layout: post
---

## 1. Ollama

Ollama是一个开源工具，专注于在本地运行、管理和部署大型语言模型（LLMs）。它简化了在本地机器上运行这些模型的过程，适合开发者、研究人员或任何希望在没有云服务依赖的情况下使用LLMs的用户。

本次部署直接使用Ollama，一种简单直接的解决方案。

## 2. 具体部署流程

1. 安装Ollama，[Ollama官网](https://ollama.com/)
1. 配置用户环境变量
    ``` cmd
    OLLAMA_HOS          0.0.0.0:11434
    OLLAMA_MODELS       D:\ollamaModels
    ```
1. 下载DeepSeek模型，根据本地环境，量力而行
    ``` cmd
    ollama run deepseek-r1:1.5b
    ollama run deepseek-r1:32b
    ```
1. 下载完成后即可与模型交互