---
title: "PHP info 分析思路"
description: "代码审计中 phpinfo() 页面的信息收集思路与可利用的敏感配置项。"
publishDate: "2026-01-25T10:23:39+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/0df31c475c0bdfdc371dbfa6f0fbe139.jpeg"
categories: ["PHP Security"]
tags: ["php", "代码审计"]
---
## 🎯 **phpinfo 安全分析检查清单**

### 📍 **第一优先级：危险配置和后门**

#### 1. **disable_functions 分析**

```
位置：Core 模块 -> disable_functions
重点检查是否禁用：
✓ 命令执行：system, exec, shell_exec, passthru, popen, proc_open
✓ 代码执行：eval, assert, call_user_func, create_function
✓ 文件操作：readfile, file_get_contents(带wrapper), symlink
✓ 进程控制：pcntl_*, posix_*
✓ 其他危险：putenv, ini_set, dl, mail

【绕过技巧】未禁用的可利用函数：
- imap_open (可命令执行)
- error_log (可写文件)
- mail (可命令注入)
- mb_send_mail
- LD_PRELOAD + mail/error_log
```

#### 2. **disable_classes 检查**

```
位置：Core 模块 -> disable_classes
应禁用的危险类：
- ReflectionFunction
- COM (Windows)
- SplFileObject
- DirectoryIterator
- FilesystemIterator
```

---

### 📂 **第二优先级：文件系统限制**

#### 4. **open_basedir 限制**

```
位置：Core 模块 -> open_basedir
分析点：
✓ 是否设置了限制
✓ 限制范围是否过大（如：/var/www:/tmp:/usr）
✓ 是否包含敏感目录（/tmp, /var/tmp, /dev/shm）
✓ 绕过方法：
  - chdir() + ini_set() 组合
  - symlink 绕过
  - realpath() 绕过
  - glob:// 协议绕过
```

#### 5. **文件上传配置**

```
位置：Core 模块
关键配置：
- file_uploads：是否允许上传
- upload_max_filesize：最大上传大小
- upload_tmp_dir：临时目录（是否可访问）
- max_file_uploads：最大上传数量
```

---

### 🌐 **第三优先级：远程访问和协议**

#### 6. **URL Wrapper 检查**

```
位置：Core 模块
关键配置：
- allow_url_fopen = On  【危险】可能SSRF
- allow_url_include = On 【极危险】远程代码执行

注册的Stream协议（Registered PHP Streams）：
- php:// (php://input, php://filter)
- data:// (data协议RCE)
- phar:// (反序列化)
- zip:// (文件包含)
- expect:// (命令执行，需扩展)
```

#### 7. **cURL 配置**

```
位置：curl 模块
关注点：
- 是否启用（可能SSRF）
- 支持的协议（Protocols）
  危险协议：file://, dict://, gopher://, ldap://
```

---

### 🔐 **第四优先级：信息泄露**

#### 8. **错误显示配置**

```
位置：Core 模块
生产环境应关闭：
- display_errors = Off
- display_startup_errors = Off
- expose_php = Off
- log_errors = On (应记录到文件)
- error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
```

#### 9. **环境变量分析**

```
位置：Environment / PHP Variables 部分
敏感信息：
- $_SERVER['DOCUMENT_ROOT'] - Web根目录
- $_SERVER['SERVER_SOFTWARE'] - 服务器版本
- $_SERVER['SCRIPT_FILENAME'] - 脚本路径
- $_ENV - 环境变量（可能含密钥）
- PATH - 可执行文件路径
- 数据库连接信息
```

---

### 🗂️ **第五优先级：模块和扩展**

#### 10. **已加载扩展分析**

```
位置：各个模块部分
重点关注：

【高危扩展】
- FFI：可直接调用C函数（PHP 7.4+）
- COM：Windows下命令执行
- PCNTL：进程控制
- Swoole/Workerman：异步扩展

【可利用扩展】
- ImageMagick：历史漏洞多
- GD：可能信息泄露
- XML/XXE：XML外部实体注入
- YAML：反序列化
- Phar：反序列化

【数据库扩展】
- mysqli, pdo_mysql：是否支持
- postgres, oracle：其他数据库
```

#### 11. **Opcache/JIT 配置**

```
位置：Zend OPcache 模块
关注点：
- opcache.enable：是否启用
- opcache.validate_timestamps：时间戳验证
- opcache.revalidate_freq：重新验证频率
- JIT配置（PHP 8.0+）
```

---

### 🔒 **第六优先级：会话和认证**

#### 12. **Session 安全**

```
位置：session 模块
关键配置：
- session.save_path：会话存储路径（是否可读）
- session.cookie_httponly = On 【必须】
- session.cookie_secure = On 【HTTPS必须】
- session.use_strict_mode = On 【建议】
- session.cookie_samesite：CSRF防护
- session.gc_maxlifetime：会话过期时间
```

#### 13. **Cookie 信息**

```
位置：HTTP Headers / PHP Variables
检查：
- $_COOKIE 中的敏感信息
- 认证token的格式（JWT, 自定义）
- 是否base64编码（易解码）
```

---

### ⚙️ **第七优先级：系统环境**

#### 14. **系统信息**

```
位置：顶部 System 行
关键信息：
- 操作系统版本（已知漏洞）
- 内核版本（提权漏洞）
- 是否Docker容器（逃逸可能）
- PHP版本（CVE查询）
```

#### 15. **服务器信息**

```
位置：Apache/Nginx 模块
关注点：
- 服务器版本（Apache/Nginx/IIS）
- 已加载模块
- 运行用户（www-data, apache, nobody）
- ServerRoot 路径
```

---

