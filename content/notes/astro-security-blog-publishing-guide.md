---
title: "从零维护 Astro 技术博客：写作、搜索与发布"
description: "一份面向技术写作的 Astro 博客维护指南，涵盖配置、Markdown、Pagefind 搜索、GitHub Pages 发布和日常发布流程。"
publishDate: "2026-07-31T00:00:00+08:00"
---

## 适用场景

本文面向希望长期维护个人技术博客的创作者，适合发布开发实践、工程复盘、学习笔记、工具介绍和技术研究。目标不是把文章“写出来”，而是建立一套可重复执行的流程：内容结构稳定、链接不失效、搜索可用、发布可回滚。

本文以本仓库为例：Astro 负责静态生成，Expressive Code 负责代码块，Pagefind 提供构建后的全文搜索，GitHub Actions 负责 GitHub Pages 发布。

## 一、先完成站点身份配置

发布前先检查 `src/site.config.ts`。这里的值会进入页面标题、RSS、sitemap、canonical URL、OG 图片与 Web Manifest：

```ts
export const siteConfig = {
  url: "https://r007demo.github.io/Astro-Cactus/",
  title: "Astro Technical Blog",
  author: "R007demo",
  description: "A flexible technical blog built with Astro",
  lang: "zh-CN",
  ogLocale: "zh_CN",
};
```

还需要检查两个公开入口：

1. `src/components/SocialList.astro`：替换 GitHub 与邮箱。当前 `research@example.com` 只是开发期占位地址。
2. `public/icon.svg`：它同时是浏览器图标和 PWA 图标的源文件；修改后重新构建，才能生成对应 PNG 图标。

不要把令牌、真实邮箱密码、Webmention 密钥或 API Key 写进文章和仓库。环境变量放进 `.env`，而不是 frontmatter。

## 二、内容目录和 URL 规则

项目的内容结构如下：

```text
content/
├── posts/       # 正式文章，生成 /posts/<slug>/
├── notes/       # 短笔记，生成 /notes/<slug>/
└── tags/        # 可选：为某个标签页补充介绍内容
```

文件名就是 slug。建议使用稳定、可读、小写的英文文件名，例如：

```text
content/posts/spring-boot-route-audit.md
content/posts/cve-2026-example-analysis.md
```

不要根据标题频繁改文件名。标题可以修改，slug 一旦被外部引用就应尽量保持不变；如果必须迁移，应在部署层配置重定向。

## 三、文章 frontmatter 写法

一篇文章至少需要标题、描述和发布日期：

```yaml
---
title: "Spring Boot 路由审计清单"
description: "从 Controller、配置文件和运行时端点三个方向梳理 Spring Boot API 路由的审计方法。"
publishDate: 2026-08-01
tags: ["java", "spring boot", "code audit"]
categories: ["research"]
draft: true
pinned: false
---
```

字段的使用建议：

- `title`：控制在 60 个字符内，优先写清研究对象和结论。
- `description`：写成可独立阅读的一句话，它用于搜索结果、RSS 与社交分享。
- `publishDate`：使用 ISO 日期，按发布时间排序。
- `updatedDate`：修订结论、修复示例或补充影响范围时填写。
- `tags`：细粒度检索词，例如 `ssrf`、`java`、`deserialization`。
- `categories`：较稳定的大类，例如 `research`、`guides`、`writeups`。
- `draft: true`：本地可预览，生产构建会隐藏。
- `pinned: true`：仅用于真正需要长期置顶的文章，避免滥用。

标签和分类会自动小写并去重。分类无需创建单独文件，构建时会自动生成 `/categories/` 和对应归档页。

## 四、技术文章写作技巧

技术文章最容易的问题不是信息不足，而是读者无法复现你的过程。推荐按下面的顺序组织：

1. **结论与影响**：漏洞或技术要解决什么问题，影响什么版本、权限和资产。
2. **前置条件**：需要账户、网络位置、特定配置还是用户交互。
3. **证据链**：从入口、数据流到危险操作的每一步都给出代码或配置证据。
4. **复现步骤**：给出最小可复现命令、请求和预期结果；不要公布未经授权的真实攻击目标。
5. **修复建议**：说明修复位置、边界条件和如何验证修复。
6. **时间线与参考资料**：区分事实、推测和引用。

标题应表达问题而不是只写工具名。相比“Spring Boot 审计”，下面的标题更易被检索和理解：

```text
从 Service 调用点反向追踪 Spring Boot API 路由
```

### 代码块、表格与 ASCII 图

代码块使用语言标识，便于高亮：

```ts
const isInternalHost = (host: string) => {
  return host === "localhost" || host.endsWith(".internal");
};
```

长命令、宽表格和 ASCII 图应优先考虑手机阅读：

- 一段代码只说明一个要点；过长脚本拆成“关键片段”和“完整版本”。
- 表格列数过多时，将细节移到列表或附录。
- ASCII 图放进围栏代码块或带横向滚动的容器，避免在窄屏上被换行破坏。
- 命令中的域名、令牌和用户标识用占位符代替，例如 `https://target.example`。

引用外部资料时，直接链接到原始公告、提交记录或官方文档。不要将未经验证的推测写成确定结论。

## 五、草稿到发布的工作流

推荐采用“先草稿，后验证，再发布”的节奏：

```text
创建文章 → draft: true → 本地检查 → 审阅内容 → 删除 draft → 构建预览 → 提交发布
```

每次发布前执行：

```bash
npm run check
npm run build
npm run preview
```

`npm run check` 用于类型与格式检查。`npm run build` 不仅生成 Astro 页面，还会执行 `postbuild` 生成 Pagefind 索引。`npm run preview` 才是接近线上产物的验证环境。

发布前检查清单：

- 标题、描述、日期、标签和分类是否正确。
- 是否仍保留 `draft: true`。
- 代码、截图、请求包与日志中是否泄露 Token、Cookie、内网地址或真实用户数据。
- 文章中的链接、锚点、图片和下载文件是否有效。
- 移动端是否能阅读表格、代码块和目录。

## 六、Pagefind 搜索为什么本地看不到

本项目的搜索框是生产构建功能。`npm run dev` 不加载 Pagefind UI，也不会生成索引，因此开发服务器中看不到搜索按钮是预期行为。

正确的本地搜索验证方式是：

```bash
npm run build
npm run preview
```

构建后应存在：

```text
dist/
└── pagefind/
    ├── pagefind.js
    ├── pagefind-ui.js
    └── pagefind-entry.json
```

搜索只索引带有 `data-pagefind-body` 的文章和笔记正文。首页、文章列表和草稿不在索引范围内。文章标签会作为 Pagefind filter 写入索引，因此标签命名应保持一致。

如果线上没有搜索框或搜索结果为空，按顺序检查：

1. 部署命令是否是 `npm run build` 或 `pnpm build`，而不是单独的 `astro build`。
2. 是否部署了整个 `dist/`，包括 `dist/pagefind/`。
3. 浏览器网络面板中 `/pagefind/` 资源是否返回 200。

## 七、GitHub Pages 发布

本仓库通过 `.github/workflows/deploy-pages.yml` 构建和部署。推送 `main` 后，工作流会：

1. 安装 pnpm 与依赖。
2. 执行 `pnpm build`。
3. 生成静态页面、OG 图片、PWA 图标和 Pagefind 索引。
4. 上传完整 `dist/` 并部署到 GitHub Pages。

本站固定使用根路径：`/posts/`、`/notes/`、`/categories/` 等，构建过程不会加入仓库名作为前缀。部署 GitHub Pages 时应使用 `R007demo.github.io` 用户根站点仓库，或绑定自定义域名；部署前同步更新 `src/site.config.ts` 的 `url`，再验证 RSS、sitemap、canonical URL 和 Pagefind 路径。

## 八、常见故障排查

### 部署后 CSS、图片或链接 404

确认部署目标是根站点或已绑定的自定义域名，并检查部署产物是否完整包含 CSS、图片和 `pagefind/` 目录。项目内部链接统一使用根路径，例如 `/posts/`。

### Pages 工作流没有发布

在仓库 Settings → Pages 中将 Source 设为 **GitHub Actions**。随后查看 Actions 中的 `Deploy GitHub Pages` 工作流；构建失败时先看 `pnpm build` 日志。

### 页面有文章但搜索不到

确认文章不是草稿，并检查详情页是否包含 `data-pagefind-body`。重新构建后确认 `dist/pagefind/` 已生成。

### 提交历史出现错误身份

不要修改全局 Git 配置来临时修复。使用 GitHub no-reply 邮箱作为提交身份，并在推送前检查：

```bash
git log -5 --format="%h %an <%ae> %s"
```

## 九、长期维护建议

- 每月处理依赖更新，但不要在没有构建验证时合并自动更新。
- 写作与代码修改分开提交，方便回滚和审阅。
- 为重要文章保留源材料、截图生成脚本和复现环境说明，但不要把敏感测试数据公开。
- 每个季度检查失效链接、旧版本结论和 RSS/搜索是否正常。
- 保留上游许可证与致谢；独立维护并不等于抹去原项目贡献。
