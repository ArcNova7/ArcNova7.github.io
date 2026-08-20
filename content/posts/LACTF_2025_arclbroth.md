---
title: "LACTF_2025_arclbroth"
description: "服务端提供一个叫 arcs 的分数系统。"
publishDate: "2025-09-01T10:23:39+08:00"
ogImage: "https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/07/5ca7df7d3af3724f8b329dc144087979.png"
categories: ["CTF"]
tags: ["lactf"]
---
## arclbroth | CLOSED | working :

```javascript
// 导入所需的模块
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { init: initDb, sql} = require('secure-sqlite');

// 设置端口和环境变量
const port = process.env.PORT ?? 3000;
const adminpw = process.env.ADMINPW ?? crypto.randomBytes(16).toString('hex');
const flag = process.env.FLAG ?? 'lactf{test_flag_owo}';

// 初始化数据库并创建表
initDb(':memory:');
sql`CREATE TABLE users (
  username TEXT PRIMARY KEY,
  password TEXT,
  arcs INT
)`;
sql`CREATE TABLE sessions (id INT PRIMARY KEY, username TEXT)`;
sql`INSERT INTO users VALUES ('admin', ${adminpw}, 100)`;
console.log(sql`SELECT * FROM users`);

// 创建Express应用
const app = express();

// 设置静态文件目录
app.use('/', express.static(path.join(__dirname, 'site')));

// 使用中间件解析cookie和JSON
app.use(cookieParser());
app.use(express.json());

// 会话验证中间件
app.use((req, res, next) => {
  const sessId = parseInt(req.cookies.session);
  if (!isNaN(sessId)) {
    const sessions = sql`SELECT username FROM sessions WHERE id=${sessId}`;
    if (sessions.length > 0) {
      res.locals.user = sql`SELECT * FROM users WHERE username=${sessions[0].username}`[0];
    }
  }
  next();
});

// 用户注册接口
app.post('/register', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username || typeof username !== 'string') {
    res.status(400).json({ err: 'provide a username owo' });
    return;
  }

  if (!password || typeof password !== 'string') {
    res.status(400).json({ err: 'provide a password uwu' });
    return;
  }

  const existing = sql`SELECT * FROM users WHERE username=${username}`;
  if (existing.length > 0) {
    res.status(400).json({ err: 'user already exists' });
    return;
  }

  sql`INSERT INTO users VALUES (${username}, ${password}, 10)`;
  const id = crypto.randomInt(281474976710655);
  sql`INSERT INTO sessions VALUES (${id}, ${username})`;
  res
    .cookie('session', id)
    .json({ success: true });
});

// 用户登录接口
app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username || typeof username !== 'string') {
    res.status(400).json({ err: 'provide a username owo' });
    return;
  }

  if (!password || typeof password !== 'string') {
    res.status(400).json({ err: 'provide a password uwu' });
    return;
  }

  const existing = sql`SELECT * FROM users WHERE username=${username}`;
  if (existing.length == 0 || existing[0].password !== password) {
    res.status(400).json({ err: 'invalid login' });
    return;
  }

  const id = crypto.randomInt(281474976710655);
  sql`INSERT INTO sessions VALUES (${id}, ${username})`;
  res
    .cookie('session', id)
    .json({ success: true });
});

// 酿造功能接口
app.post('/brew', (req, res) => {
  if (!res.locals.user) {
    res.status(400).json({ err: 'please login' });
    return;
  }

  const { arcs, username } = res.locals.user;

  if (arcs < 2) {
    res.json({ broth: 'no-arcs', arcs });
  } else if (arcs < 50) {
    sql`UPDATE users SET arcs=${arcs - 2} WHERE username=${username}`;
    res.json({ broth: 'standard', arcs: arcs - 2 });
  } else {
    sql`UPDATE users SET arcs=${arcs - 50} WHERE username=${username}`;
    res.json({ broth: flag, arcs: arcs - 50 });
  }
});

// 补充arcs的接口
app.post('/replenish', (req, res) => {
  if (!res.locals.user) {
    res.status(400).json({ err: 'please login' });
    return;
  }

  const { username } = res.locals.user;
  const arcs = username === 'admin' ? 100 : 10
  sql`UPDATE users SET arcs=${arcs}`;
  res.json({ success: true, arcs });
});

// 获取用户信息接口
app.get('/info', (req, res) => {
  res.json(res.locals.user);
});

// 启动服务器
app.listen(port, () => {
  console.log(`http://0.0.0.0:${port}`);
});

```

***



## 1. 题目背景

* 服务端提供一个叫 arcs 的分数系统。

* 用户注册后会有 10 arcs，管理员（`admin`）有 100 arcs。

* 游戏主要逻辑：

  * `/brew` 接口：消耗 arcs 来“酿造”，50 arcs 以上可以直接输出 flag。

  * `/replenish` 接口：普通用户永远只能回到 10 arcs，只有 admin 可以恢复到 100 arcs。



***



## 2. 关键点 —— `secure-sqlite` 的 bug

题目依赖的数据库库是 `secure-sqlite` [riverofspring/secure-sqlite](https://github.com/riverofspring/secure-sqlite/tree/main)，但该库有 bug：

在题目最开头我们能看到这一段：



```javascript
const { init: initDb, sql } = require('secure-sqlite');
```



题目数据库调用依赖一个第三方模块 \*\*secure-sqlite\*\*。 &#x20;



***



## **3. 阅读 secure-sqlite 源码**

在给出的源码里，我们可以看到 secure-sqlite 是 Node.js 调用 C 动态库 `libsqlite3` 的封装：



```javascript
const _lib = ffi.Library('libsqlite3', {
  'sqlite3_open': [ 'int', [ 'string', sqlite3PtrPtr ] ],
  'sqlite3_prepare_v2': [ 'int', [ sqlite3Ptr, 'string', 'int', sqlstatementPtrPtr, 'int' ] ],
  // ...
  'sqlite3_bind_text': ['int', [sqlstatementPtr, 'int', 'string', 'int', 'long long']],
});
```



#### 1. `ffi.Library` 的作用



在 Node.js 里，\*\*FFI（Foreign Function Interface）\*\* 是一种机制，它允许你在 JS 代码里直接调用操作系统的本地动态库（C/C++ 编写的 `.dll`, `.so`, `.dylib` 等）。



`node-ffi` 就是 Node.js 的一款 FFI 模块。 &#x20;

它提供了 `ffi.Library` 这个方法，用来加载一个动态库，并且把库里的 C 函数映射成 JS 可以调用的函数。



例如：



```javascript
const ffi = require('ffi-napi');

const libc = ffi.Library('libc', {
  'puts': ['int', ['string']]
});

libc.puts('hello world');
```



* `ffi.Library('libc', { ... })` → 表示加载名为 `libc` 的动态库（Linux 下 `/lib/x86_64-linux-gnu/libc.so.6`）。 &#x20;

* `'puts': ['int', ['string']]` → 定义了一个函数 `puts`，返回值类型是 `int`，参数是 `string`。 &#x20;

* 这样在 JS 中调用 `libc.puts("hello")`，实际上就是调用了 C 语言的 `int puts(const char *)`。 &#x20;



所以在 `secure-sqlite` 里：



```javascript
const _lib = ffi.Library('libsqlite3', {
  'sqlite3_bind_text': ['int', [sqlstatementPtr, 'int', 'string', 'int', 'long long']],
});
```



就是告诉 Node.js： &#x20;

* 动态库叫 `libsqlite3`， &#x20;

* 里面有一个函数 `sqlite3_bind_text`，返回 `int`，参数是 `[statement 指针, 参数索引, string 类型, 长度, callback指针]`。 &#x20;



***



#### 2. `sqlite3_bind_text` 的 C 函数原型



在 SQLite 的官方 C API 里，`sqlite3_bind_text` 的原型是：



```c
int sqlite3_bind_text(
  sqlite3_stmt*,   // 已编译的 SQL 语句
  int,             // ? 占位符的索引
  const char*,     // 要绑定的字符串
  int n,           // 该字符串的长度，如果是 -1 则自动用 \0 作为结束
  void(*)(void*)   // 内存释放函数
);
```



注意这里的第三个参数 `const char*`： &#x20;

* 这是一个 \*\*C 风格字符串\*\*，默认认为它是以 `\0` 结尾的。 &#x20;

* 第四个参数 `n` 是长度，如果传 `-1`，SQLite 就会在 `\0` 处截断。



👉 \*\*正确的用法应该是带上实际长度 `n**`，这样即使字符串里包含 `\0`，SQLite 也能完整存储。



### 重要信息：

* `ffi.Library` 表示它通过 [node-ffi](https://github.com/node-ffi/node-ffi) 直接调用底层 C 接口。

* `sqlite3_bind_text` 直接绑定 `string` 参数给 SQLite3。



**但 Node.js 的字符串实现和 C 语言字符串是不同的：**



| 语言环境                 | `\0` 的含义                          |
| -------------------- | --------------------------------- |
| JavaScript (Node.js) | 普通字符，可以存在于字符串中间 `"abc\0def"` 长度为7 |
| C 语言字符串              | `\0` 表示字符串结束，之后的内容被截断             |



也就是说，当 Node.js 将 `"admin\0ccc"` 传给 C 接口 `sqlite3_bind_text` 时：

* Node.js 传的内存数据是 `admin 00 ccc`（包括空字符）。

* C 接口在遇到 `\0` 时把它当作结束标记，\*\*之后的 **`ccc`** 被丢掉\*\*，所以 C 侧看到的就是 `"admin"`。



***



## 4. 利用流程（Exploit）

### （1）注册伪造的管理员

发送注册请求，用户名是 `admin\u0000ccc`（`\u0000` 是 JSON 里传递的空字符）：



```json
{"username":"admin\u0000ccc","password":"1111"}
```



这样数据库中存了一条用户记录，看似叫 `admin\0ccc`。



### （2）登录

再用 `admin\u0000bbb`（不同后缀没关系）登录。SQLite 在匹配时会把 `admin\0bbb` 截断为 `admin`，于是从 sessions 表里取出用户名，`res.locals.user` 被赋值成了数据库中的 \*\*admin 用户\*\*。



关键代码：

```javascript
res.locals.user = sql`SELECT * FROM users WHERE username=${sessions[0].username}`[0];
```

由于 SQLite 截断，把伪造的用户名当成了 admin，于是 `res.locals.user` 就成了真正的 admin 账号。



***



### （3）调用 `/replenish`

此时，服务端认为你就是 admin：

```javascript
const arcs = username === 'admin' ? 100 : 10
```



于是你就能把 arcs 补充到 \*\*100\*\*。



***



### （4）调用 `/brew`

当 arcs ≥ 50 时，brew 会直接返回 flag：



```javascript
else {
  sql`UPDATE users SET arcs=${arcs - 50} WHERE username=${username}`;
  res.json({ broth: flag, arcs: arcs - 50 });
}
```



所以就得到了 flag。



***



## 5. 关键知识点

1. **字符串截断漏洞**：Node.js 和 C 底层对 `\0` 的处理差异导致混淆。

2. **SQL 层和应用层不一致**：应用层认为 `admin\0xxx` 是不同用户；SQLite 底层认为它是 `admin`。


