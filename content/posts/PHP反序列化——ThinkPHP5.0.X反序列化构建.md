---
title: "PHP反序列化——ThinkPHP5.0.X反序列化构建"
description: "ThinkPHP 5.0.X 反序列化利用链构建分析。"
publishDate: "2025-09-29T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "反序列化", "thinkphp"]
---
Reference：[ThinkPHP5反序列化利用链总结与分析](https://www.freebuf.com/vuls/317886.html)

## POP链构造

入口部参考thinkphp5.1的分析方式:

[**PHP反序列化——ThinkPHP5.1.37反序列化链路构造**](https://ArcNova7.github.io/)

```php
Windows->__destruct        
    -->Windows->removeFiles                              
think/Model.php->__toString
    -->Windows->toJson
    -->Windows->toArray
  
```

这里\_\_toString魔术方法重新找利用链路`thinkphp/library/think/Model.php`

`abstract class Model implements \JsonSerializable, \ArrayAccess`



```php
public function toArray()
{

    ……
    
    // 追加属性（必须定义获取器）
    if (!empty($this->append)) {
        foreach ($this->append as $key => $name) {
            if (is_array($name)) {
                // 追加关联对象属性
                $relation   = $this->getAttr($key);
                $item[$key] = $relation->append($name)->toArray();
            } elseif (strpos($name, '.')) {
                list($key, $attr) = explode('.', $name);
                // 追加关联对象属性
                $relation   = $this->getAttr($key);
                $item[$key] = $relation->append([$attr])->toArray();
            } else {
                $relation = Loader::parseName($name, 1, false);
                if (method_exists($this, $relation)) {
                    $modelRelation = $this->$relation();
                    $value = $this->getRelationData($modelRelation);
        
                ……

}
```

$this->append可控，因此可以控制函数执行流，在继续找可利用点，深入

```php
$value = $this->getRelationData($modelRelation);
```





```php

protected function getRelationData(Relation $modelRelation)
{
    if ($this->parent && !$modelRelation->isSelfRelation() && get_class($modelRelation->getModel()) == get_class($this->parent)) {
        $value = $this->parent;
    } else {
        // 首先获取关联数据
        if (method_exists($modelRelation, 'getRelation')) {
            $value = $modelRelation->getRelation();
        } else {
            throw new BadMethodCallException('method not exists:' . get_class($modelRelation) . '-> getRelation');
        }
    }
    return $value;
}
```

继续深入分析getRelation()函数

```php
//thinkphp/library/think/model/relation/BelongsTo.php

public function getRelation($subRelation = '', $closure = null)
{
    $foreignKey = $this->foreignKey;
    if ($closure) {
        call_user_func_array($closure, [ & $this->query]);
    }
    $relationModel = $this->query
        ->removeWhereField($this->localKey)
        ->where($this->localKey, $this->parent->$foreignKey)
        ->relation($subRelation)
        ->find();

    if ($relationModel) {
        $relationModel->setParent(clone $this->parent);
    }

    return $relationModel;
}
```

`$this->query`这个值可控，设置为output类，然后通过removeWhereField触发\_\_call()



```php
//thinkphp/library/think/console/Output.php
public function __call($method, $args)//$args=$this->localKey
{
    if (in_array($method, $this->styles)) {
        array_unshift($args, $method);
        return call_user_func_array([$this, 'block'], $args);
    }

    if ($this->handle && method_exists($this->handle, $method)) {
        return call_user_func_array([$this->handle, $method], $args);
    } else {
        throw new Exception('method not exists:' . __CLASS__ . '->' . $method);
    }
}
```

`return call_user_func_array([$this, 'block'], $args);`函数进一步调用了`[$this, 'block']`，继续分析`block`方法。

```php

protected function block($style, $message) //args= $this->localKey
{
    $this->writeln("<{$style}>{$message}</$style>");
}

public function writeln($messages, $type = self::OUTPUT_NORMAL)
{
    $this->write($messages, true, $type);
}

public function write($messages, $newline = false, $type = self::OUTPUT_NORMAL)

{
    $this->handle->write($messages, $newline, $type);
}
```

最后调用的是`$this->handle->write()`，恰巧可以在**think\session\driver\Memcache**类找到可用的write()方法，然后又找到一个`$this->handler->set()`

```php
//thinkphp/library/think/session/driver/Memcached.php
public function write($sessID, $sessData)
{
    return $this->handler->set($this->config['session_name'] . $sessID, $sessData, $this->config['expire']);
}
```

在**think\cache\driver\File**类找到可利用的set()方法，这里的file\_put\_contents()可以实现写入文件。这里要注意传入set()的参数$value固定为true，$expire固定为0，可以回溯看一看。所以这里写入文件的内容$data并不可控。

```php
//thinkphp/library/think/cache/driver/File.php

public function set($name, $value, $expire = null)
{
    if (is_null($expire)) {
        $expire = $this->options['expire'];
    }
    if ($expire instanceof \DateTime) {
        $expire = $expire->getTimestamp() - time();
    }
    $filename = $this->getCacheKey($name, true);
    if ($this->tag && !is_file($filename)) {
        $first = true;
    }
    $data = serialize($value);
    if ($this->options['data_compress'] && function_exists('gzcompress')) {
        //数据压缩
        $data = gzcompress($data, 3);
    }
    $data   = "<?php\n//" . sprintf('%012d', $expire) . "\n exit();?>\n" . $data;
    $result = file_put_contents($filename, $data);
    if ($result) {
        isset($first) && $this->setTagItem($filename);
        clearstatcache();
        return true;
    } else {
        return false;
    }
}
```

继续往下看，setTagItem()会再次调动set()方法，且传入set()的参数$value将等于$filename，而$filename与options\['path']和第一次传入set()的参数$name相关，这是可控的。

```php
protected function setTagItem($name)
{
    if ($this->tag) {
        $key       = 'tag_' . md5($this->tag);
        $this->tag = null;
        if ($this->has($key)) {
            $value   = explode(',', $this->get($key));
            $value[] = $name;
            $value   = implode(',', array_unique($value));
        } else {
            $value = $name;
        }
        $this->set($key, $value, 0);
    }
}
```







## 利用链路

```php
thinkphp/library/think/process/pipes/Windows.php    --->    __destruct
thinkphp/library/think/process/pipes/Windows.php    --->    $this->removeFiles()
thinkphp/library/think/process/pipes/Windows.php    --->    file_exists($filename)
thinkphp/library/think/Model.php                    --->    __toString()
thinkphp/library/think/Model.php                    --->    toJson()
thinkphp/library/think/Model.php                    --->    toArray()
thinkphp/library/think/Model.php                    --->    $value  = $this->getRelationData($modelRelation);      
thinkphp/library/think/Model.php                    --->    $value = $modelRelation->getRelation();
thinkphp/library/think/model/relation/BelongsTo.php --->    $relationModel = $this->query
->removeWhereField($this->localKey) ……
thinkphp/library/think/console/Output.php           --->     __call($method, $args)
thinkphp/library/think/console/Output.php           --->     block($style, $message)
thinkphp/library/think/console/Output.php           --->     writeln($messages, $type = self::OUTPUT_NORMAL)
thinkphp/library/think/console/Output.php           --->     write($messages, $newline = false, $type = self::OUTPUT_NORMAL)
thinkphp/library/think/console/Output.php           --->     $this->handle->write($messages, $newline, $type)
thinkphp/library/think/session/driver/Memcache.php  --->     write($sessID, $sessData)
thinkphp/library/think/cache/driver/File.php        --->     set($name, $value, $expire = null)$result=file_put_contents($filename, $data);->isset($first)&&$this->setTagItem($filename);
thinkphp/library/think/cache/Driver.php             --->      isset($first) && $this->setTagItem($filename);
                             $this->set($key, $value, 0);//参数可控
```



## \_call()函数触发分析



```php
# 法1
$relation   = $this->getAttr($key);
$item[$key] = $relation->append($name)->toArray();
function getAttr(){$value = new $type($value);return $value;} //new Output类
# 法2
$modelRelation = $this->$relation();
$bindAttr = $modelRelation->getBindAttr();
```

参考链接：https://www.freebuf.com/vuls/317886.html



* 模板编译缓存落盘：think\template\driver\File::write($cacheFile, $content) 直接 file\_put\_contents 原样写入 content

```php
public function write($cacheFile, $content)
{
    // 检测模板目录
    $dir = dirname($cacheFile);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    // 生成模板缓存文件
    if (false === file_put_contents($cacheFile, $content)) {
        throw new Exception('cache write error:' . $cacheFile, 11602);
    }
}
```

* 文件型缓存驱动落盘：think\cache\driver\File::set($name, $value, $expire) 会写入“带 PHP 头+exit”的缓存文件（不是原样写）

```php
public function set($name, $value, $expire = null)
{
    ...
    $data = serialize($value);
    if ($this->options['data_compress'] && function_exists('gzcompress')) {
        $data = gzcompress($data, 3);
    }
    $data   = "<?php\n//" . sprintf('%012d', $expire) . "\n exit();?>\n" . $data;
    $result = file_put_contents($filename, $data);
    ...
}
```

为什么文章说 convert.base64-decode 有坑，最后选 string.rot13？

* 目标：把一段你控制的 PHP 代码写进磁盘成为可执行的 .php 文件。最常见技巧是把目标路径设置为 php://filter/write=.../resource=...，借助“写入过滤器”把“写入前的内容”变换成“写入后的实际文件内容”。

如果落点是 “模板驱动落盘”（上面第一个 sink），它会把 $content 原样写入文件。但模板编译时，Think 模板引擎会在最终写入的内容最开头强行加一段 PHP 头，包含 exit();（防止模板被直接执行）：

```php
// 添加安全代码及模板引用记录
$content = '<?php if (!defined(\'THINK_PATH\')) exit(); /*' . serialize($this->includeFile) . '*/ ?>' . "\n" . $content;
// 编译存储
$this->storage->write($cacheFile, $content);
```

如果直接把 payload（比如 \<?php eval($\_POST\['ccc']);?>）作为 $content，落盘文件开头的那段 \<?php ... exit();?> 先执行就直接退出了，后面的 webshell 不会被执行。这就是需要“写入过滤器”的原因：让这段“头部护栏”在最终文件里“失效”。

convert.base64-decode 的坑：

写入路径如 php://filter/write=convert.base64-decode/resource=public/a.php，意味着“向该流写入的数据会先被 Base64 解码，再真正落盘”。

但模板引擎实际写入的“整块内容”包括很多不是 Base64 字符集的字符（如 <、?、换行、空格、括号、引号等），Base64 解码器遇到这些会解码失败/错位/截断，导致文件开头“解码成乱码的二进制垃圾”，更糟糕的是会破坏你后面真正的 payload 的边界和完整性。所以 convert.base64-decode 在这个场景非常不稳，文章里把它列为坑。

string.rot13 的优势与逻辑：

选 php://filter/write=string.rot13/resource=public/a.php，表示“写入的数据会被应用 ROT13 位移后再落盘”。ROT13 是可逆映射，对 A-Za-z 转换，其它字符原样保留，不会像 Base64 那样对输入字符集挑剔。

由于模板引擎开头强加的 \<?php if (!defined('THINK\_PATH')) exit();?> 是你不可控的“原始明文”，经过 rot13 后会变成无意义的“纯文本”（如 \<?cuc ... rkvg();?>），因为开头的 \<?php 被翻成了 \<?cuc，PHP 就不会把它当 PHP 代码执行（这一段被“废掉”）。注意：其中的 ?> 在 rot13 中仍会保留（因为 ?、> 不变），不过开头的 \<?cuc 不是 PHP 开标签，所以这块整体按纯文本处理了。

payload 则提前做一次 ROT13，比如把 \<?php eval($\_POST\['ccc']);?> 先转成 \<?cuc riny($\_CBFG\['ppp']);?>，把它放到 $content 里。这一块经过写入过滤再被 rot13 一次，就恢复成合法的 \<?php eval($\_POST\['ccc']);?>，并且因为前面的模板头部已被 rot13 弄成纯文本，不会抢先 exit()。



POP利用链分析

构造一个对象图，ThinkPHP 的析构点触发 file\_exists(object) → 对象被当作字符串用 → 进入 Model 的字符串化链 → 借助 append/关联/bindAttr 把执行流引到 Console Output → 通过 Output 的 call 把“消息”转发给一个“Session 驱动” → 该驱动内部再把写入转发到“缓存驱动” → 最终走到“文件缓存驱动”的 file\_put\_contents 落地；同时把路径指向 php://filter，使写入前先做 transform（base64-decode 或 rot13）



```php
File.php:160, think\cache\driver\File->set()
Memcache.php:94, think\session\driver\Memcache->write()
Output.php:154, think\console\Output->write()
Output.php:143, think\console\Output->writeln()
Output.php:124, think\console\Output->block()
Output.php:212, call_user_func_array()
Output.php:212, think\console\Output->__call()
Model.php:912, think\console\Output->getAttr()
Model.php:912, think\Model->toArray()
Model.php:936, think\Model->toJson()
Model.php:2267, think\Model->__toString()
Windows.php:163, file_exists()
Windows.php:163, think\process\pipes\Windows->removeFiles()
Windows.php:59, think\process\pipes\Windows->__destruct()
Index.php:14, app\index\controller\Index->hello()
```

exp@[ThinkPHP5.0文件写入pop链](https://www.freebuf.com/vuls/317886.html)



## Reference：

https://www.freebuf.com/vuls/317886.html

https://www.cnblogs.com/seizer/p/17035791.html#(师傅写地很详细)

