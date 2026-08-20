---
title: "PHP 内核调试"
description: "PHP 7.4 内核源码编译与调试环境搭建。"
publishDate: "2026-01-25T10:23:39+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "内核", "调试"]
---

# **php-src 源码调试**

## **linux 环境**

编译 php 7.4 版本

### **安装依赖（7.4 需要 oniguruma）**

```bash
sudo apt update
sudo apt install -y git build-essential autoconf bison re2c pkg-config \
  libxml2-dev libsqlite3-dev libssl-dev libcurl4-openssl-dev libonig-dev gdb
```

### **获取并切换到 7.4 源码**

```bash
git clone https://github.com/php/php-src.git
cd php-src
git fetch --tags
git checkout php-7.4.33     # 或者：git checkout PHP-7.4 分支
```

### **重新生成构建文件并配置 Debug 构建（禁优化 + 带符号）**

注意切换 root，否则 buidconf 不成功。

```bash
./buildconf --force
CFLAGS="-O0 -g3" CXXFLAGS="-O0 -g3" \
./configure --enable-debug --disable-all --enable-cli
```

编译安装

```php
make -j"$(nproc)"
make install
```

独立配置与调试环境变量

```bash
mkdir -p $HOME/php-7.4.33-debug/etc
cat > $HOME/php-7.4.33-debug/etc/php.ini <<'INI'
opcache.enable=0
opcache.enable_cli=0
opcache.jit=0
display_errors=1
zend.assertions=1
INI
```

```bash
_# 可选：仅本 shell 使用调试版 PHP_
export PATH="$HOME/php-7.4.33-debug/bin:$PATH"
export PHPRC="$HOME/php-7.4.33-debug/etc"
export USE_ZEND_ALLOC=0
export ZEND_DONT_UNLOAD_MODULES=1

which -a php
php -v
```

**验证**

```bash
sapi/cli/php -v
# 版本行中应包含 "PHP 7.4.x" 且有 "DEBUG" 标记
```

### **VS Code 调试**

将 launch.json 的 program 指向构建出的二进制：

```bash
WSL/Linux: ${workspaceFolder}/sapi/cli/php
Windows: ${workspaceFolder}\\x64\\Debug\\php.exe（或 Debug_TS）
```

vscode 添加 launch.json 文件。

```bash
{
  _"version"_: "0.2.0",
  _"configurations"_: [
    {
      _"name"_: "php-src CLI (gdb, WSL/Linux)",
      _"type"_: "cppdbg",
      _"request"_: "launch",
      _"program"_: "${workspaceFolder}/php-src/sapi/cli/php",
      _"args"_: ["-n", "${workspaceFolder}/index.php"],
      _"cwd"_: "${workspaceFolder}",
      _"stopAtEntry"_: false,
      _"MIMode"_: "gdb",
      _"miDebuggerPath"_: "gdb",
      _"externalConsole"_: false,
      _"environment"_: [
        { _"name"_: "USE_ZEND_ALLOC", _"value"_: "0" },
        { _"name"_: "ZEND_DONT_UNLOAD_MODULES", _"value"_: "1" }
      ],
      _"setupCommands"_: [
        { _"description"_: "Enable pretty printing", _"text"_: "-enable-pretty-printing", _"ignoreFailures"_: true },
        { _"description"_: "Ignore SIGPIPE", _"text"_: "handle SIGPIPE nostop noprint pass", _"ignoreFailures"_: true }
      ]
    },
    {
      _"name"_: "php-src CLI (MSVC, Windows NTS)",
      _"type"_: "cppvsdbg",
      _"request"_: "launch",
      _"program"_: "${workspaceFolder}\\php-src\\x64\\Debug\\php.exe",
      _"args"_: ["-n", "${workspaceFolder}\\test.php"],
      _"cwd"_: "${workspaceFolder}",
      _"environment"_: [
        { _"name"_: "USE_ZEND_ALLOC", _"value"_: "0" },
        { _"name"_: "ZEND_DONT_UNLOAD_MODULES", _"value"_: "1" }
      ],
      _"stopAtEntry"_: false
    },
    {
      _"name"_: "php-src CLI (MSVC, Windows TS)",
      _"type"_: "cppvsdbg",
      _"request"_: "launch",
      _"program"_: "${workspaceFolder}\\php-src\\x64\\Debug_TS\\php.exe",
      _"args"_: ["-n", "${workspaceFolder}\\test.php"],
      _"cwd"_: "${workspaceFolder}",
      _"environment"_: [
        { _"name"_: "USE_ZEND_ALLOC", _"value"_: "0" },
        { _"name"_: "ZEND_DONT_UNLOAD_MODULES", _"value"_: "1" }
      ],
      _"stopAtEntry"_: false
    },
  ]
}
```

#### 内核调试配置文件

```bash
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "php-src CLI (gdb, WSL/Linux)",
      "type": "cppdbg",
      "request": "launch",
      "program": "/opt/php-src/sapi/cli/php",
      "args": ["-n", "${workspaceFolder}/QWD2025/2.php"],
      "cwd": "/opt/php-src/QWD2025",
      "stopAtEntry": false,
      "MIMode": "gdb",
      "miDebuggerPath": "gdb",
      "externalConsole": false,
      "environment": [
        { "name": "USE_ZEND_ALLOC", "value": "0" },
        { "name": "ZEND_DONT_UNLOAD_MODULES", "value": "1" }
      ],
      "setupCommands": [
        { "description": "Enable pretty printing", "text": "-enable-pretty-printing", "ignoreFailures": true },
        { "description": "Ignore SIGPIPE", "text": "handle SIGPIPE nostop noprint pass", "ignoreFailures": true }
      ]
    },
  ]
}
```

##### 配置整体作用

在 VSCode 的 `launch.json` 中定义一个使用 C/C++ 调试器（gdb）启动并调试 PHP CLI 可执行文件的配置，用于源码级调试（如调 PHP/Zend 引擎或扩展时）。

##### 字段逐项说明

- **version**: 配置文件的架构版本。VSCode 标准为 `"0.2.0"`。
- **configurations**: 调试配置数组，可放多个不同的启动/附加方案。

配置对象内各字段：

- **name**: 在“运行和调试”面板显示的名称。
- **type**: 调试器类型。`cppdbg` 表示使用 MS C/C++ 扩展（GDB/LLDB MI 接口）。
- **request**: 调试请求类型。

  - `"launch"` 启动并调试新进程；
  - `"attach"` 则是附加到已存在进程。
- **program**: 要启动的可执行文件路径。这里是 PHP CLI 可执行文件（从源码编译的 `php`）。
- **args**: 传给可执行文件的参数数组。

  - `-n`: 运行时不加载任何 `php.ini`；
  - `${workspaceFolder}/QWD2025/2.php`: 要执行的脚本路径（支持变量替换）。
- **cwd**: 被调试进程的工作目录（当前目录）。
- **stopAtEntry**: 是否在入口点（如 `main`）自动停下。`false` 表示直接运行到断点处。
- **MIMode**: 使用哪种 MI 调试器后端，`"gdb"` 或 `"lldb"`。这里选 `gdb`。
- **miDebuggerPath**: 调试器可执行文件路径，这里是 `gdb`。
- **externalConsole**: 是否使用外部控制台窗口。`false` 表示使用 VSCode 内置终端/控制台。
- **environment**: 以数组形式设置目标进程的环境变量。

  - `USE_ZEND_ALLOC=0`: 关闭 Zend 自己的内存分配器，使用系统 `malloc`，便于 gdb 跟踪内存/回溯；
  - `ZEND_DONT_UNLOAD_MODULES=1`: 进程退出或模块生命周期结束时不卸载扩展模块，便于调试期间栈回溯和符号依旧可见。
- **setupCommands**: 启动调试会话前发送给调试器（gdb）的命令列表。

  - `-enable-pretty-printing`: 启用 pretty printers（更友好的复杂类型展示）；
  - `handle SIGPIPE nostop noprint pass`: 收到 SIGPIPE 时不暂停、不打印，并继续交给程序处理，避免调试被非关键信号打断。
  - `ignoreFailures: true`: 如果命令不被支持，忽略错误继续执行。

### GDB 调试

参考:[https://www.yisu.com/jc/686871.html](https://www.yisu.com/jc/686871.html)

```php
db --args $HOME/php-7.4.33-debug/bin/php -n -r 'chdir("/path/to/eazyphp"); include "1.php"; new test;'
(gdb) set pagination off
(gdb) set environment USE_ZEND_ALLOC 0
(gdb) set breakpoint pending on
```

- set pagination off
- 关闭 GDB 的分页器，打印长输出时不再提示“Type <return> to continue”。
- set environment USE_ZEND_ALLOC 0
- 给将要运行的被调程序设置环境变量，仅对 GDB 内启动的进程生效，不影响系统环境。
- 对 PHP 来说，设置 USE_ZEND_ALLOC=0 会关闭 Zend 自带内存管理器，改用系统 malloc/free，便于 GDB/Valgrind 观察真实内存与地址。
- set breakpoint pending on
- 允许设置“待解析断点”，即使当前还找不到符号（例如程序尚未加载相应模块/函数名），断点也会保留，等符号可用时自动生效。
- 用来提前对如 zend_declare_function、zend_hash__add_ 等符号设置断点很方便。

```markdown
# 看长度
p result->len

# 取数据起始地址（val 紧跟在结构体后）
set $s = (char *)&result->val

# 方式一：跳过前导 '\0'，按 C 字符串打印
x/s $s+1

# 方式二：长度安全打印（包含所有可见字符）
printf "key=%.*s\n", (int)result->len - 1, $s+1

# 如需看原始字节（含前导 '\0'）
set $len = (int)result->len
x/$len bx $s
```

## 编译 PHP，启用 FPM（现在你只启用了 CLI）

```bash
cd /opt/php-src
 make clean
 ./buildconf --force
 CFLAGS="-O0 -g3" CXXFLAGS="-O0 -g3" \
 ./configure --enable-debug --enable-cli --enable-fpm \
   --with-fpm-user=www-data --with-fpm-group=www-data
 make -j"$(nproc)"
 sudo make install
```

临时

```
php -S 0.0.0.0:8080 -t /var/www/html
```

---

