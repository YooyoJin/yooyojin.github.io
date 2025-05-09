---
title: C++设计模式
author: YooyoJin
date: 2025-03-18
category: Jekyll
layout: post
mermaid: true
---

**Q： 为什么需要设计模式？**<br>
**A：** 设计模式是解决软件设计问题的经典解决方案，感觉简单来说，就是前辈们经过长时间摸索出来的解决常见问题的一套参考答案。

C++中常用的设计模式可以分为三大类：创建型模式、结构型模式和行为型模式（复杂的分类方式，咱也不懂）

## 1. 单例模式

**Q： 什么是单例模式？**<br>
**A：** 简单来说，确保一个类只有一个实例，并提供一个全局访问点。复杂来说，就是越说越复杂。

**Q： 可以解决什么问题？**<br>
**A：** 多线程环境中，单例模式可以确保在多线程环境中只有一个实例被创建，避免竞争条件。

单例又分为懒汉式和饿汉式：
- 懒汉式：解决了饿汉式内存浪费问题，即在**需要时才创建单例对象**，而不是在程序启动时就创建，但是线程不安全的，可以通过互斥锁mutex.lock()和mutex.unlock()来解决
- 饿汉式：还没有使用该单例对象，该单例对象就已经被加载到内存了，在对象过多时会造成内存浪费


懒汉实现四步走：
1. 私有化构造函数，防止外部直接创建对象。
1. 定义静态成员变量保存唯一实例。
1. 提供静态成员函数获取实例。
1. 禁止拷贝和赋值。


## 2. 工厂模式

**Q： 什么是工厂模式？**<br>
**A：** 它通过定义一个接口或抽象类来创建对象，而由子类决定实例化哪个类。工厂模式的核心思想是将对象的创建与使用分离。

**Q： 可以解决什么问题？**<br>
**A：** 在代码中直接使用new创建对象会导致创建逻辑与业务逻辑紧密耦合，出现大量重复代码。工厂模式可以灵活创建对象，集中管理对象的创建逻辑。

简单工厂模式：
1. 定义抽象产品类，所有具体产品类都需要实现这个方法。
1. 定义具体产品类（Product_A、Product_B），继承自AbstractProduct抽象产品类
1. 创建工厂类（Factory）
1. 在main函数中，通过调Factory::CreateProduct()方法来创建产品对象，并调用其AnOperation()方法。

``` mermaid
classDiagram
direction LR
    class Factory {
        +CreateProduct() AbstractProduct
    }
    class AbstractProduct {
        +AnOperation()
    }
    class Product_A {
        +AnOperation()
    }
    class Product_B {
        +AnOperation()
    }
    class Product_C {
        +AnOperation()
    }
    Factory --> AbstractProduct : creates
    AbstractProduct <|-- Product_A
    AbstractProduct <|-- Product_B
    AbstractProduct <|-- Product_C
```

简单工厂模式可以简化客户端的代码，并提高了代码的可维护性。然而，它也存在一些缺点，比如新增产品类型时需要修改工厂类、产品类型过多，工厂类的代码也会变得复杂等。