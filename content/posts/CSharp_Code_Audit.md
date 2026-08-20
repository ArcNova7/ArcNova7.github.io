---
title: "C# 代码审计"
description: "model 层是编写各种数据模型或数据库与数据实体类之间的交互处理，如下就是一个简单的数据模型"
publishDate: "2026-01-25T10:23:39+08:00"
ogImage: "https://pic2.zhimg.com/v2-ada7a981b5da4f94af145470bce124b5_720w.jpg?source=172ae18b"
categories: ["Code Audit"]
tags: ["csharp", "代码审计"]
---
## **C# ****ASP.NET****项目结构**

### MVC 结构

model 层是编写各种数据模型或数据库与数据实体类之间的交互处理，如下就是一个简单的数据模型

controll 层是做路由响应以及相应的业务逻辑处理。类的名字以 Controller 结尾。

- 响应针对 ASP.NET MVC 网站发出的请求。每个浏览器请求都映射到特定的控制器 。如访问 http://localhost/Product/Index/3 它就会去寻找 Product controller 然后在 Product Controller 里找 Index 方法

控制器可能会将特定视图返回回浏览器，或者控制器可能会将用户重定向到另一个控制器。

### 常见文件类型

1. .aspx：
   ASP.NET 网页文件。包含网页的标记和服务器端代码，用于构建动态的 Web 页面。
2. .cs：
   用途： C# 源代码文件。包含 C# 编程语言的源代码，用于实现应用程序的逻辑和功能。
3. .aspx.cs：
   ASP.NET 网页的代码文件（与 .aspx 配套）。 包含与 .aspx 文件相关联的 C# 代码，用于处理页面的服务器端逻辑。
4. .dll：
   动态链接库文件。包含已编译的代码和库，可供应用程序调用和重用。通常用于将代码分割成模块，提高可维护性和复用性。

### aspx 文件内容解析

1. 通常在我们打开 aspx 文件时，第一行会是以下这样：

```
<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="MyPage.aspx.cs" Inherits="MyWebApp.MyPage" %>
```

这是一个 ASP.NET Web 页面的指令（Directive），用于在页面中指定一些重要的属性和配置

解析如下：

- <%@ Page： 这是指令的起始标记，用于定义页面的属性和配置。
- Language="C#"： 指定服务器端代码使用的编程语言，这里是 C#。
- AutoEventWireup="true"： 一个布尔值，表示是否启用自动事件绑定。当设置为 true 时，ASP.NET 将自动绑定事件处理程序。
- CodeBehind="MyPage.aspx.cs"： 指定代码文件的相对路径。在这个例子中，代码文件名为 MyPage.aspx.cs，它通常包含页面的服务器端逻辑。
- Inherits="MyWebApp.MyPage"： 指定页面的继承关系。这里，MyPage 页面继承自 MyWebApp.MyPage 类。Inherits 属性告诉 ASP.NET 使用指定类中的代码。

通过这个指令，ASP.NET 可以正确地处理页面，编译代码文件，然后将其与页面关联起来。这使得在 .aspx 页面中可以使用与 .aspx.cs 文件关联的服务器端代码

在一般的.NET 代码中，我们需要特别注意 inherits（继承）部分。它会指向我们需要去找的 dll


```
MasterPageFile="~/Admin/Admin.Master"
```

MasterPageFile：调用之前都会先调用母版页的相关函数

过滤器：（Filter），一般来说提供了在 asp.net MVC 与 asp.net webApi 的两处过滤操作处理，主要分四类过滤器 IAuthorizationFilter（授权过滤器）、IActionFilter（Action 方法过滤器）、IResultFilter（ActionResult 方法返回结果）、IExceptionFilter（异常过滤器）

- 过滤器的单独使用：在需要使用的控制器或者操作 action 前面加上[xxfilter]
- 过滤器全局使用：在 webapi 中是在 WebApiConfig 中添加 config.Filters.Add(new xxxxx);
- 在 mvc 项目中是在 App_Start 目录下 FilterConfig 中添加 filters.Add(new xxxx());通过注册到 Global.asax 注册为全局 过滤所有 action

reference:

[https://mp.weixin.qq.com/s/6c7ZnwAW1IOaau3Jb-Sapg](https://mp.weixin.qq.com/s/6c7ZnwAW1IOaau3Jb-Sapg)

这里添加了一个名为 QsFilter 的 Action 过滤器

```
services.AddControllers(option => { option.Filters.Add<QsFilter>(); })
```

### DLL 文件&系统框架

参考自：[https://mp.weixin.qq.com/s?search_click_id=17710134741822833135-1757577180010-2926091602&__biz=MzkzMzI3OTczNA==&mid=2247488083&idx=1&sn=ff3cfe0fda9788754fb3cd0e9b53d247&chksm=c38c09baa2509295bfdb717d0bcf9795fdcff4ca621221fc1dd335d9599f5f70bd896572332a&scene=7#rd](https://mp.weixin.qq.com/s?search_click_id=17710134741822833135-1757577180010-2926091602&__biz=MzkzMzI3OTczNA==&mid=2247488083&idx=1&sn=ff3cfe0fda9788754fb3cd0e9b53d247&chksm=c38c09baa2509295bfdb717d0bcf9795fdcff4ca621221fc1dd335d9599f5f70bd896572332a&scene=7#rd)

System.Web.Mvc.dll（MVC 框架）

System.Web.Http.dll（Web API 相关）

System.Web.WebPages.dll（Web 页面框架）

**EntityFramework.SqlServer.dll&EntityFramework.dll（**数据库操作，常见于 ASP.NET 网站项目。）

**Microsoft.AspNet.Identity.*.dll 系列（处理 ****ASP.NET**** 身份验证，通常用于 Web 登录系统。）**

然后网站源码 dll 一般全命名为大写字母，或者文件名带 WebApp 或 Web 等字样，或者带一些网站系统的名称特征等等，如：

### **分层架构模式**

典型的 .NET 企业应用分层：

```
表现层 (Presentation Layer)
├── Controllers/          ← 审计入口点
│   ├── APPController.cs       # API 控制器
│   ├── NewsManageController.cs # 业务控制器
│   └── BaseController.cs      # 基类控制器
├── Filters/             ← 权限控制关键
│   ├── AuthorizeAttribute.cs
│   └── IgnoreRightFilter.cs   # ⚠️ 重点关注
└── Views/

业务逻辑层 (Business Logic Layer)
├── Services/            ← 漏洞实现位置
│   ├── EventService.cs
│   └── FileService.cs
└── DTOs/

数据访问层 (Data Access Layer)
├── Repositories/
└── DbContext/

基础设施层 (Infrastructure Layer)
├── Utils/
└── Extensions/
```

### _路由解析示例_

```typescript
_// 控制器定义_
public class APPController : ApiController
{
    public IHttpActionResult uploadAttachment(...) { }
}

_// URL 映射规则_
控制器类名：APPController
  ↓ （去掉 "Controller" 后缀）
路由中的 {controller}：APP

方法名：uploadAttachment
  ↓
路由中的 {action}：uploadAttachment

_// 最终 URL_
/api/APP/uploadAttachment
```

参考链接中的**自动推断路由 URI：**

[https://mp.weixin.qq.com/s?search_click_id=17710134741822833135-1757577180010-2926091602&__biz=MzkzMzI3OTczNA==&mid=2247488083&idx=1&sn=ff3cfe0fda9788754fb3cd0e9b53d247&chksm=c38c09baa2509295bfdb717d0bcf9795fdcff4ca621221fc1dd335d9599f5f70bd896572332a&scene=7#rd](https://mp.weixin.qq.com/s?search_click_id=17710134741822833135-1757577180010-2926091602&__biz=MzkzMzI3OTczNA==&mid=2247488083&idx=1&sn=ff3cfe0fda9788754fb3cd0e9b53d247&chksm=c38c09baa2509295bfdb717d0bcf9795fdcff4ca621221fc1dd335d9599f5f70bd896572332a&scene=7#rd)

## **审计策略：**

- **自顶向下：** Controllers → Services → Data Access
- **关注边界：** 权限检查点、数据验证点、外部调用点

### 1. **过滤器继承层次结构**

在 ASP.NET Web API 中，过滤器的应用遵循以下优先级（从高到低）：

```
方法级别过滤器 > 控制器级别过滤器 > 全局过滤器 > 父类控制器过滤器
```

### 2. **具体场景分析**

#### **场景 A：基类有 [Authorize]，子类方法有不同过滤器**

```csharp
// 基类
[Authorize]
public class BaseController : ApiController
{
    public IHttpActionResult BaseMethod() { }
}

// 子类
public class APPController : BaseController
{
    // 情况1：没有方法级过滤器 → 继承基类的 [Authorize]
    public IHttpActionResult Method1() { }
    // 访问需要鉴权 ✅
    
    // 情况2：有 [AllowAnonymous] → 覆盖基类的 [Authorize]
    [AllowAnonymous]
    public IHttpActionResult Method2() { }
    // 允许匿名访问 ✅
    
    // 情况3：有新的 [Authorize(Roles="Admin")] → 覆盖基类通用 [Authorize]
    [Authorize(Roles = "Admin")]
    public IHttpActionResult Method3() { }
    // 需要Admin角色，覆盖了基类的通用鉴权 ✅
}
```

#### **场景 B：基类没有 [Authorize]，子类自己添加**

```csharp
// 基类没有过滤器
public class BaseController : ApiController
{
}

// 子类
[Authorize]  // 必须显式添加
public class APPController : BaseController
{
    public IHttpActionResult Method1() { }
    // 需要鉴权，因为子类显式添加了 [Authorize]
}
```

### 3. **陷阱的详细解释**

**陷阱场景：**

```csharp
// 场景1：基类没有 [Authorize]
public class BaseApiController : ApiController
{
}

// 开发者错误认为子类会继承鉴权（实际上不会！）
public class UserController : BaseApiController
{
    public IHttpActionResult GetUsers()
    {
        // ❌ 漏洞！这个方法没有鉴权！
        // 因为基类没有 [Authorize]，必须显式添加
    }
}

// 正确做法：
[Authorize]  // 必须显式添加
public class UserController : BaseApiController
{
    public IHttpActionResult GetUsers()
    {
        // ✅ 现在安全了
    }
}
```

### 4. **过滤器的叠加行为**

某些过滤器可以叠加，但 `[Authorize]` 和 `[AllowAnonymous]` 是互斥的：

```csharp
[Authorize]
public class APPController : ApiController
{
    [Authorize(Roles = "Admin")]  // 这会覆盖类级别的 [Authorize]
    public IHttpActionResult Method1() { }
    // 需要 Admin 角色，不是只要登录就行
    
    [AllowAnonymous]  // 完全禁用鉴权
    [CustomFilter]    // 其他非鉴权过滤器可以共存
    public IHttpActionResult Method2() { }
    // 允许匿名，同时应用 CustomFilter
}
```

**继承链中的多层 [Authorize]：**

### 过滤器全局使用：

在 webapi 中是在 WebApiConfig 中添加 config.Filters.Add(new xxxxx);

```
   在mvc项目中是在App_Start目录下FilterConfig中添加 filters.Add(new xxxx());通过注册到Global.asax注册为全局 过滤所有action
```

## **审计方法：**

_#找出所有没有鉴权特性的 public 方法_

```
_# 在反编译代码中搜索_
grep -n "public.*IHttpActionResult\|public.*ActionResult" APPController.cs \
  | grep -v "Authorize" \
  | grep -v "AllowAnonymous"
```

在 APPController.cs 文件中，找出所有返回类型为 IHttpActionResult 或 ActionResult 的 public 方法，

但是排除那些带有"Authorize"或"AllowAnonymous"特性的方法。

- 定位文件上传关键词

```
streamWriter.Write 和 SaveAs
```

- 文件下载关键词

```
1. File对象的 OpenText和OpenRead方法
2. FileStream对象的FileMode.Open和FileMode.Read
3. **Response.WriteFile 常用于文件下载**
```

- **XSS 注入**

在 asp.net 中我们插入 XSS 代码经常会遇到一个错误 `A potentially dangerous Request.Form` 这是因为在 `aspx` 文件头一般会定义一句 `<%@ Page validateRequest="true" %>` 。

- **SQL 注入漏洞深度剖析**

**# 步骤 1：搜索 SQL 拼接关键字**

```sql
**grep -rn "string.Format.*SELECT" .   ** 
查找使用 string.Format 拼接 SELECT 语句的代码

**grep -rn "\" + .*+ \".*WHERE" .**
查找使用字符串拼接（+ 连接符）构建 WHERE 子句的代码

grep -rn "ExecuteSqlCommand" .
查找直接执行 SQL 命令的方法（常见于 Entity Framework）

grep -rn "SqlCommand" .
查找使用 [ADO.NET](https://ado.net/) SqlCommand 的代码
```

## 文件上传审计参考文章

[https://mp.weixin.qq.com/s/EmcxJUEGJGwpcDbrvFu7jQ](https://mp.weixin.qq.com/s/EmcxJUEGJGwpcDbrvFu7jQ) #精研

[https://xz.aliyun.com/news/18825](https://xz.aliyun.com/news/18825) #精研

- **文件上传 payload 参考**

```sql
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="evil.aspx"
Content-Type: application/octet-stream

<%@ Page Language="C#" %><%Response.Write("Hello World");%>
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

```sql
------WebKitFormBoundaryVBf7Cs8QWsfwC82M
Content-Disposition: form-data, name= "file";filename="/../../../AVA.ResourcesPlatform.WebUI/test.aspx"
Content-Type: image/jpeg

<%@Page Language="C#"%>
<%
Response.Write("test");
%>
------WebKitFormBoundaryVBf7Cs8QWsfwC82M--
```

IIS6.0 文件解析存在缺陷(asa,cer,cdx)，默认情况下，IIS 对其后缀名映射到了 asp.dll，asp.dll 又是 ASP 脚本的解析文件，所以能够正常解析

## 登陆验证漏洞参考

[https://mp.weixin.qq.com/s/KQ2QD7fhFv6bwMOt4dVuNQ](https://mp.weixin.qq.com/s/KQ2QD7fhFv6bwMOt4dVuNQ)

## TODO:

QShop CodeAudit

[https://github.com/qiushuangju/QShop](https://github.com/qiushuangju/QShop)

参考：[https://mp.weixin.qq.com/s/s9XXeo7y0K1awBEV1Cisgw](https://mp.weixin.qq.com/s/s9XXeo7y0K1awBEV1Cisgw)

## Reference :

[https://mp.weixin.qq.com/s/6c7ZnwAW1IOaau3Jb-Sapg](https://mp.weixin.qq.com/s/6c7ZnwAW1IOaau3Jb-Sapg)

[https://mp.weixin.qq.com/s/spt04Pr0CBPc6ciuMHjfAg](https://mp.weixin.qq.com/s/spt04Pr0CBPc6ciuMHjfAg)

[https://mp.weixin.qq.com/s/qdo4SHhV3MmMgSr3TgIWTQ](https://mp.weixin.qq.com/s/qdo4SHhV3MmMgSr3TgIWTQ)

[https://mp.weixin.qq.com/s/yjHdsxHDmh4GGylXETc20g](https://mp.weixin.qq.com/s/yjHdsxHDmh4GGylXETc20g)

[https://mp.weixin.qq.com/s/s9XXeo7y0K1awBEV1Cisgw](https://mp.weixin.qq.com/s/s9XXeo7y0K1awBEV1Cisgw)

[https://mp.weixin.qq.com/s/ei_q1CTo6yT9wYgI4mPPfQ](https://mp.weixin.qq.com/s/ei_q1CTo6yT9wYgI4mPPfQ)

[https://mp.weixin.qq.com/s/0ADxnM21a6S92oJfdBJLAg](https://mp.weixin.qq.com/s/0ADxnM21a6S92oJfdBJLAg)

[https://mp.weixin.qq.com/s/KQ2QD7fhFv6bwMOt4dVuNQ](https://mp.weixin.qq.com/s/KQ2QD7fhFv6bwMOt4dVuNQ)

