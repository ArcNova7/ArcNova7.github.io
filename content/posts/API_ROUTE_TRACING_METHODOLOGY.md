---
title: " Spring Boot API 路由追踪方法论"
description: "本文档提供一套完整的 Spring Boot 应用程序 API 路由发现与追踪方法论，适用于安全评估、渗透测试和代码审计场景。"
publishDate: "2026-03-23T00:00:00+08:00"
ogImage: "https://i.cetsteam.com/imgs/2026/03/23/4048dad01fb25568.jpg"
categories: ["Java Security"]
tags: ["java", "代码审计"]
---
## Security Assessment Methodology - Route Discovery & Tracing

---

## 文档说明

本文档提供一套完整的 Spring Boot 应用程序 API 路由发现与追踪方法论，适用于安全评估、渗透测试和代码审计场景。

**适用场景**：

- 从 Service 层代码追溯到对应的 API 端点
- 全面枚举应用程序的所有 API 接口
- 快速定位潜在的高危端点（文件上传、文件下载等）
- 理解 Spring Boot 路由映射机制

**技术栈**：Spring Boot / Spring MVC

---

## 目录

1. [路由构造原理](#一路由构造原理)
2. [方法一：从 Service 向上追溯](#二方法一从-service-向上追溯)
3. [方法二：全局端点扫描](#三方法二全局端点扫描)
4. [方法三：配置文件分析](#四方法三配置文件分析)
5. [方法四：运行时端点发现](#五方法四运行时端点发现)
6. [高危端点识别](#六高危端点识别)
7. [自动化工具集](#七自动化工具集)
8. [实战案例模板](#八实战案例模板)

---

## 一、路由构造原理

### 1.1 Spring Boot 完整 URL 构成

<div style="overflow-x:auto;margin:0.75em 0;padding:0.65em 0.85em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;">
<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Cascadia Mono,Consolas,monospace;font-size:12px;line-height:1.22;white-space:pre;overflow-wrap:normal;word-break:normal;">┌─────────────────────────────────────────────────────────────────────────────┐
│                          完整 URL 构成公式                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Full URL = protocol://host:port + context-path + class-path + method-path  │
│                                                                             │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌─────────────┐  │
│  │ http:// │ │host:port │ │ /contextPath │ │/api/xxx    │ │ /endpoint   │  │
│  └─────────┘ └──────────┘ └──────────────┘ └────────────┘ └─────────────┘  │
│      │            │              │                │              │          │
│      │            │              │                │              └── @PostMapping/GetMapping/@RequestMapping
│      │            │              │                └──────── @RequestMapping (class level)
│      │            │              └────────────────────────── server.servlet.context-path
│      │            └───────────────────────────────────────── server.port
│      └────────────────────────────────────────────────────── protocol
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘</pre></div>

### 1.2 注解层级关系

<div style="overflow-x:auto;margin:0.75em 0;padding:0.65em 0.85em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;">
<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Cascadia Mono,Consolas,monospace;font-size:12px;line-height:1.22;white-space:pre;overflow-wrap:normal;word-break:normal;">Application Layer (应用层)
├── Configuration Layer (配置层)
│   ├── server.port                    # 服务端口
│   ├── server.servlet.context-path    # 应用上下文路径
│   └── server.address                 # 监听地址
│
├── Controller Layer (控制器层)
│   ├── @RestController                # 标记 REST 控制器
│   ├── @RequestMapping("/api/base")   # 类级路由（可选）
│   └── @GetMapping("/endpoint")       # 方法级路由
│
└── Service Layer (服务层)
    └── business logic methods         # 业务逻辑方法</pre></div>

### 1.3 路径拼接规则

| 组合方式 | 示例 | 说明 |
|---------|------|------|
| `class + method` | `/api/users` + `/list` → `/api/users/list` | 标准拼接 |
| `class only` | `/api/users` + `""` → `/api/users` | 方法路径为空 |
| `method only` | `""` + `/health` → `/health` | 无类级路由 |
| `with context` | `/myapp` + `/api/users` + `/list` → `/myapp/api/users/list` | 含上下文 |

### 1.4 特殊情况处理

<div style="overflow-x:auto;margin:0.75em 0;padding:0.65em 0.85em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;">
<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Cascadia Mono,Consolas,monospace;font-size:12px;line-height:1.22;white-space:pre;overflow-wrap:normal;word-break:normal;">┌─────────────────────────────────────────────────────────────────────────────┐
│                         路径拼接注意事项                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 前导斜杠处理                                                            │
│     @RequestMapping("/api")  +  @GetMapping("/users")   →  /api/users      │
│     @RequestMapping("/api")  +  @GetMapping("users")    →  /api/users      │
│     @RequestMapping("/api/") +  @GetMapping("/users")   →  /api/users      │
│                                                                             │
│  2. 路径变量（Path Variables）                                               │
│     @GetMapping("/users/{id}")  →  /users/123                               │
│     @GetMapping("/files/**")    →  /files/a/b/c                             │
│                                                                             │
│  3. 矩阵变量（Matrix Variables）                                             │
│     @GetMapping("/users{owner}")  →  /users;owner=admin                     │
│                                                                             │
│  4. 请求参数与路径无关                                                      │
│     @GetMapping("/search")  →  /search?q=keyword&amp;page=1                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘</pre></div>

---

## 二、方法一：从 Service 向上追溯

**适用场景**：已知 Service 方法，需要找到对应的 API 端点。

### 2.1 追溯流程图

<div style="overflow-x:auto;margin:0.75em 0;padding:0.65em 0.85em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;">
<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Cascadia Mono,Consolas,monospace;font-size:12px;line-height:1.22;white-space:pre;overflow-wrap:normal;word-break:normal;">┌─────────────────────────────────────────────────────────────────────────────┐
│                         Service 向上追溯流程                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1: 定位 Service 方法                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ 文件: src/main/java/.../service/SomeService.java                   │     │
│  │ 方法: public void processSomething(Input input) { ... }            │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    ↓                                         │
│  Step 2: 搜索调用者（Controller）                                            │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ 命令: grep -rn "processSomething" ./web/ --include="*.java"        │     │
│  │ 结果: SomeResource.java:45 调用                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    ↓                                         │
│  Step 3: 查看 Controller 类注解                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ @RestController                                                    │     │
│  │ @RequestMapping("/api/some")  ← 类级路由                           │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    ↓                                         │
│  Step 4: 查看方法注解                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ @PostMapping(value = "/process", consumes = MediaType.JSON)       │     │
│  │ public ResponseEntity&lt;Void&gt; process(@RequestBody Input input)      │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    ↓                                         │
│  Step 5: 获取配置信息（context-path, port）                                  │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ 配置文件: application.yml                                          │     │
│  │ server.servlet.context-path: /myapp                               │     │
│  │ server.port: 8080                                                 │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    ↓                                         │
│  Step 6: 组装完整 URL                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ http://host:port + /myapp + /api/some + /process                  │     │
│  │ = http://localhost:8080/myapp/api/some/process                    │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘</pre></div>

### 2.2 实用命令集

```bash
# 1. 从 Service 方法名查找调用点
grep -rn "methodName" --include="*.java" path/to/project/src/main/java

# 2. 限定在 web/rest/controller 目录搜索
grep -rn "methodName" path/to/project/src/main/java/*/{web,rest,controller}/ --include="*.java"

# 3. 查看特定文件的所有路由注解
grep -n "@\(RestController\|RequestMapping\|PostMapping\|GetMapping\)" file.java

# 4. 提取 Controller 的类级路由
grep -A1 "@RestController" path/to/project -r --include="*.java" | \
  grep "@RequestMapping" | \
  sed 's/.*@RequestMapping("\(.*\)").*/\1/'

# 5. 查看特定 Controller 的所有端点
grep -n "@\(PostMapping\|GetMapping\|PutMapping\|DeleteMapping\|PatchMapping\)" \
  SomeResource.java
```

### 2.3 代码模式识别

#### 常见的 Controller 命名模式

<div style="overflow-x:auto;margin:0.75em 0;padding:0.65em 0.85em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;">
<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Cascadia Mono,Consolas,monospace;font-size:12px;line-height:1.22;white-space:pre;overflow-wrap:normal;word-break:normal;">*Resource.java       ← JHipster 风格
*Controller.java     ← Spring 传统风格
*Api.java            ← API 风格
*Endpoint.java       ← 微服务风格</pre></div>

#### 常见的 Service 调用模式

```java
// 模式 1: 直接调用
@Autowired
private SomeService someService;

@PostMapping("/endpoint")
public Response handle(Request req) {
    return someService.doSomething(req);  // ← 追踪点
}

// 模式 2: 通过接口调用
private final SomeServiceInterface service;

@PostMapping("/endpoint")
public Response handle(Request req) {
    return service.process(req);  // ← 追踪接口实现
}

// 模式 3: 委托模式
@PostMapping("/endpoint")
public Response handle(Request req) {
    return delegate.toService(req);  // ← 继续追踪
}
```

---

## 三、方法二：全局端点扫描

### 3.1 扫描脚本模板

```bash
#!/bin/bash
# api_scanner.sh - 通用 API 端点扫描脚本

PROJECT_PATH="${1:-./src/main/java}"

echo "=== Spring Boot API Endpoint Scanner ==="
echo ""

# 扫描所有 Controller 类
echo "[1] 扫描所有 Controller 类..."
grep -rn "@RestController\|@Controller" "$PROJECT_PATH" --include="*.java" | \
  awk -F: '{print $1}' | sort -u

echo ""
echo "[2] 扫描所有 @RequestMapping (类级别)..."
grep -rn "@RequestMapping" "$PROJECT_PATH" --include="*.java" | \
  grep -v "function\|method"

echo ""
echo "[3] 扫描所有 HTTP 方法映射..."
grep -rn "@\(PostMapping\|GetMapping\|PutMapping\|DeleteMapping\|PatchMapping\)" \
  "$PROJECT_PATH" --include="*.java"

echo ""
echo "[4] 生成端点映射表..."
grep -B1 "@\(PostMapping\|GetMapping\|PutMapping\|DeleteMapping\|PatchMapping\)" \
  "$PROJECT_PATH" --include="*.java" | \
  grep -E "@RequestMapping|@.*Mapping" | \
  paste - - | \
  awk '{
    class_path = $0; getline; method_path = $0;
    gsub(/.*@RequestMapping("\(.*\)").*/, "\\1", class_path);
    gsub(/.*@.*Mapping("\(.*\)").*/, "\\1", method_path);
    print class_path method_path;
  }'
```

---

## 四、方法三：配置文件分析

**适用场景**：需要获取应用基础配置信息。

### 4.1 配置文件位置

<div style="overflow-x:auto;margin:0.75em 0;padding:0.65em 0.85em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;">
<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Cascadia Mono,Consolas,monospace;font-size:12px;line-height:1.22;white-space:pre;overflow-wrap:normal;word-break:normal;">标准项目结构:
├── src/main/resources/
│   ├── application.yml              # 主配置文件
│   ├── application-dev.yml          # 开发环境配置
│   ├── application-prod.yml       # 生产环境配置
│   ├── application-test.yml       # 测试环境配置
│   └── config/
│       └── application-*.yml      # 模块配置

Boot 化配置:
├── application.properties           # Properties 格式
├── application-{profile}.properties
└── META-INF/spring.factories        # 自动配置</pre></div>

### 4.2 关键配置项

| 配置项 | 默认值 | 说明 | 示例值 |
|--------|--------|------|--------|
| `server.port` | 8080 | 服务监听端口 | 8081, 8443 |
| `server.address` | 0.0.0.0 | 监听地址 | localhost, 192.168.x.x |
| `server.servlet.context-path` | / | 应用上下文路径 | /api, /myapp |
| `server.servlet.path` | / | Servlet 路径 | / |
| `spring.mvc.servlet.path` | / | MVC Servlet 路径 | /api |

### 4.3 多环境配置处理

```yaml
# application.yml
server:
  port: 8080

---
# application-dev.yml
server:
  port: 8081
  servlet:
    context-path: /dev-api

---
# application-prod.yml
server:
  port: 80
  servlet:
    context-path: /api

# 激活配置: spring.profiles.active=dev
```

---

## 五、方法四：运行时端点发现

**适用场景**：只有运行中的应用，无法访问源代码。

### 5.1 Actuator 端点

<div style="overflow-x:auto;margin:0.75em 0;padding:0.65em 0.85em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;">
<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Cascadia Mono,Consolas,monospace;font-size:12px;line-height:1.22;white-space:pre;overflow-wrap:normal;word-break:normal;">┌─────────────────────────────────────────────────────────────────────────────┐
│                      Spring Boot Actuator 端点                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  /actuator                 ← Actuator 首页                                  │
│  /actuator/health          ← 健康检查                                       │
│  /actuator/info            ← 应用信息                                       │
│  /actuator/mappings        ← ⭐ 所有请求映射（推荐）                        │
│  /actuator/beans           ← 所有 Bean                                      │
│  /actuator/caches          ← 缓存信息                                       │
│  /actuator/env             ← 环境变量                                       │
│  /actuator/loggers         ← 日志配置                                       │
│  /actuator/threaddump      ← 线程转储                                       │
│  /actuator/heapdump        ← 堆转储                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘</pre></div>

### 5.2 Mappings 端点详解

**请求**

`GET /actuator/mappings`

**响应结构示例（节选）**

```json
{
  "contexts": {
    "application": {
      "mappings": {
        "dispatcherServlets": {
          "dispatcherServlet": [
            {
              "handler": "com.example.UserResource#getAllUsers()",
              "predicate": "{GET /api/users}"
            },
            {
              "handler": "com.example.UserResource#getUserById(Long)",
              "predicate": "{GET /api/users/{id}}"
            }
          ]
        }
      }
    }
  }
}
```

### 5.3 Actuator 配置

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,mappings  # 暴露的端点
        exclude: shutdown,heapdump      # 排除的端点
  endpoint:
    health:
      show-details: always             # 显示健康详情
```

### 5.4 其他运行时发现方法

<div style="overflow-x:auto;margin:0.75em 0;padding:0.65em 0.85em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;">
<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Cascadia Mono,Consolas,monospace;font-size:12px;line-height:1.22;white-space:pre;overflow-wrap:normal;word-break:normal;">方法 1: Swagger/OpenAPI 文档
├── /swagger-ui.html          ← Swagger UI
├── /api-docs                 ← OpenAPI JSON
├── /v3/api-docs              ← OpenAPI 3.0
└── /swagger-resources        ← Swagger 资源列表

方法 2: 路径模糊测试
├── 常见路径字典攻击
├── 目录扫描工具 (dirsearch, gobuster)
└── API 爬虫工具 (api-scan)

方法 3: 代理拦截
├── Burp Suite 代理拦截
├── OWASP ZAP 流量分析
└── mitmproxy 中间人攻击</pre></div>

---

## 六、高危端点识别

结合路由追踪结果，可优先排查以下类型（需在具体项目中用代码与配置印证）。

| 类型 | 常见特征 | 路由 / 代码线索 |
|------|----------|-----------------|
| 文件上传 | `MultipartFile`、`multipart/form-data` | `@PostMapping` + `consumes = MULTIPART_*` |
| 文件下载 / 读文件 | 用户可控路径、拼接磁盘路径 | `download`、`export`、`getFile`、路径参数 |
| 反序列化 / 模板 | 接受复杂 DTO、模板名 | `@RequestBody` 非白名单类型、模板引擎调用 |
| 管理 / Actuator | 未鉴权暴露 | `/actuator/*`、自定义管理 URL |

**静态搜索示例**

```bash
grep -rn "MultipartFile\|multipart" src/main/java --include="*.java"
grep -rn "transferTo\|FileOutputStream\|Files\.copy" src/main/java --include="*.java"
```

---

## 七、自动化工具集

### 7.1 Python 端点扫描器

```python
#!/usr/bin/env python3
"""
api_scanner.py - Spring Boot API 端点扫描器
"""

import os
import re
from pathlib import Path
from dataclasses import dataclass
from typing import List

@dataclass
class Endpoint:
    controller: str
    method: str
    path: str
    line_number: int
    flags: List[str]

class APIScanner:
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.endpoints: List[Endpoint] = []

    def scan(self) -> List[Endpoint]:
        """扫描项目中的所有 API 端点"""
        for java_file in self.project_path.rglob("*Resource.java"):
            self._scan_file(java_file)
        return self.endpoints

    def _scan_file(self, file_path: Path):
        """扫描单个 Java 文件"""
        content = file_path.read_text()
        lines = content.split('\n')

        # 获取类级 @RequestMapping
        class_route = self._extract_class_route(content)

        # 扫描所有方法级映射
        for i, line in enumerate(lines):
            mapping_match = re.search(r'@(Get|Post|Put|Delete|Patch)\w*Mapping', line)
            if mapping_match:
                method = mapping_match.group(1)
                path = self._extract_path(line)
                flags = self._detect_flags(lines, i)

                self.endpoints.append(Endpoint(
                    controller=file_path.name,
                    method=method,
                    path=path,
                    line_number=i + 1,
                    flags=flags
                ))

    def _extract_class_route(self, content: str) -> str:
        """提取类级路由"""
        match = re.search(r'@RequestMapping\s*\(\s*value\s*=\s*"([^"]+)"', content)
        return match.group(1) if match else ""

    def _extract_path(self, line: str) -> str:
        """提取方法级路径"""
        match = re.search(r'value\s*=\s*"([^"]+)"', line)
        return match.group(1) if match else ""

    def _detect_flags(self, lines: List[str], line_num: int) -> List[str]:
        """检测端点特征"""
        flags = []
        # 检查后续 15 行
        for line in lines[line_num:min(line_num + 15, len(lines))]:
            if 'MultipartFile' in line:
                flags.append('📎 Upload')
                break
        return flags

    def print_report(self):
        """打印扫描报告"""
        print("\n" + "=" * 70)
        print(" " * 20 + "API Endpoints Report")
        print("=" * 70 + "\n")

        for ep in self.endpoints:
            flags = " ".join(ep.flags)
            print(f"[{ep.method}] {ep.path} {flags}")
            print(f"        → {ep.controller}:{ep.line_number}\n")

if __name__ == "__main__":
    import sys
    project_path = sys.argv[1] if len(sys.argv) > 1 else "./src/main/java"
    scanner = APIScanner(project_path)
    scanner.scan()
    scanner.print_report()
```

---

## 八、实战案例模板

### 8.1 案例：从 Service 方法到 API 端点

**场景**：代码审计中发现一个可疑的文件处理方法。

<div style="overflow-x:auto;margin:0.75em 0;padding:0.65em 0.85em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;">
<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Cascadia Mono,Consolas,monospace;font-size:12px;line-height:1.22;white-space:pre;overflow-wrap:normal;word-break:normal;">═══════════════════════════════════════════════════════════════════════════════
                              追踪案例模板
═══════════════════════════════════════════════════════════════════════════════

Step 1: 发现可疑代码
───────────────────────────────────────────────────────────────────────────────
文件位置: src/main/java/com/example/service/FileService.java:45

代码片段:
┌──────────────────────────────────────────────────────────────────────────┐
│ public String processUploadedFile(MultipartFile file, String filename) { │
│     String ext = filename.substring(filename.lastIndexOf("."));          │
│     String path = BASE_DIR + filename;                                   │
│     file.transferTo(new File(path));  // ← 潜在漏洞                      │
│     return "File uploaded to: " + path;                                  │
│ }                                                                        │
└──────────────────────────────────────────────────────────────────────────┘

问题分析:
  ✓ 使用用户输入作为文件名 (filename)
  ✓ 直接拼接文件路径
  ✓ 无扩展名白名单验证
  ✓ 可能存在路径穿越漏洞

═══════════════════════════════════════════════════════════════════════════════

Step 2: 追溯到 Controller
───────────────────────────────────────────────────────────────────────────────
执行命令:
  grep -rn "processUploadedFile" src/main/java --include="*.java"

结果:
  src/main/java/com/example/web/FileResource.java:67

Controller 代码:
┌──────────────────────────────────────────────────────────────────────────┐
│ @RestController                                                          │
│ @RequestMapping("/api/files")                                            │
│ public class FileResource {                                              │
│                                                                          │
│     @Autowired                                                           │
│     private FileService fileService;                                     │
│                                                                          │
│     @PostMapping(value = "/upload",                                      │
│                 consumes = MediaType.MULTIPART_FORM_DATA_VALUE)          │
│     public ResponseEntity&lt;String&gt; uploadFile(                             │
│             @RequestParam("file") MultipartFile file,                     │
│             @RequestParam("filename") String filename) {                 │
│         return ResponseEntity.ok(                                         │
│             fileService.processUploadedFile(file, filename)              │
│         );                                                                │
│     }                                                                    │
│ }                                                                        │
└──────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════

Step 3: 获取应用配置
───────────────────────────────────────────────────────────────────────────────
配置文件: src/main/resources/application.yml

server:
  port: 8080
  servlet:
    context-path: /demo-app

═══════════════════════════════════════════════════════════════════════════════

Step 4: 组装完整 URL
───────────────────────────────────────────────────────────────────────────────
┌─────────────────┬────────────────────────────────────────────────────┐
│ 协议:主机:端口  │ http://target-server.com:8080                     │
├─────────────────┼────────────────────────────────────────────────────┤
│ Context Path    │ /demo-app                                          │
├─────────────────┼────────────────────────────────────────────────────┤
│ @RequestMapping │ /api/files                                         │
├─────────────────┼────────────────────────────────────────────────────┤
│ @PostMapping    │ /upload                                            │
├─────────────────┼────────────────────────────────────────────────────┤
│ 完整 URL        │ http://target-server.com:8080/demo-app/api/files/upload │
└─────────────────┴────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════

Step 5: 验证漏洞
───────────────────────────────────────────────────────────────────────────────
测试请求:
  POST http://target-server.com:8080/demo-app/api/files/upload
  Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

  ------WebKitFormBoundary
  Content-Disposition: form-data; name="file"; filename="test.txt"
  Content-Type: text/plain

  poc content
  ------WebKitFormBoundary
  Content-Disposition: form-data; name="filename"

  shell.../../../../../tmp/poc.txt
  ------WebKitFormBoundary--

预期结果: 文件被写入 /tmp/poc.txt

═══════════════════════════════════════════════════════════════════════════════</pre></div>

---

### A. 常见目录结构模式

<div style="overflow-x:auto;margin:0.75em 0;padding:0.65em 0.85em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;">
<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Cascadia Mono,Consolas,monospace;font-size:12px;line-height:1.22;white-space:pre;overflow-wrap:normal;word-break:normal;">标准 Spring Boot 结构:
├── src/main/java/
│   └── com/example/
│       ├── controller/      ← 控制器层
│       ├── service/         ← 服务层
│       ├── repository/      ← 数据访问层
│       ├── model/           ← 数据模型
│       └── config/          ← 配置类
│
└── src/main/resources/
    ├── application.yml
    └── static/             ← 静态资源

JHipster 结构:
├── src/main/java/
│   └── com/example/
│       ├── web/rest/        ← REST 控制器 (*Resource)
│       ├── service/         ← 服务层
│       ├── repository/      ← 数据访问
│       └── domain/          ← 领域模型
│
└── src/main/resources/
    └── config/
        └── application.yml

微服务结构:
├── src/main/java/
│   └── com/example/
│       ├── api/             ← API 定义 (*Api)
│       ├── endpoint/        ← 端点实现 (*Endpoint)
│       ├── service/         ← 业务逻辑
│       └── model/
│           ├── dto/         ← DTO
│           └── entity/      ← 实体</pre></div>

---

