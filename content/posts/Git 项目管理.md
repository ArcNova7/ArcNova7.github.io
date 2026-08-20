---
title: "Git 项目管理"
description: "Git 管理文件时，文件在三个区域之间流动："
publishDate: "2026-08-16T00:00:00+08:00"
categories: ["Tools"]
tags: ["git"]
---
# Git 项目管理：从核心架构到日常命令详解

---

## 一、Git 管理

Git 不是在备份文件，它在管理**文件的变化历史**。每次 `commit` 都是一张"快照"，记录那一刻所有文件的状态。你可以随时回到任意一张快照。

为了实现这个目标，Git 设计了四个区域，文件必须经过这些区域才能被 Git 管理：

```text
工作区  ──git add──▶  暂存区  ──git commit──▶  本地仓库  ──git push──▶  远程仓库
```

---

学习过程看到一篇技术文章，这张图很直观展示git工作逻辑。@[CoderLeixiaoshuai](https://github.com/CoderLeixiaoshuai) 【 [git 教程](https://github.com/CoderLeixiaoshuai/java-eight-part/blob/master/docs/tools/git/%E4%BF%9D%E5%A7%86%E7%BA%A7Git%E6%95%99%E7%A8%8B%EF%BC%8C10000%E5%AD%97%E8%AF%A6%E8%A7%A3.md)】

![image\.png](https://pub-0e9b5be439a54fec9fbbd5bd26cbd38c.r2.dev/2026/08/589d155624cb675859936a5436d868f6.png)
There is a passage that makes the Git workflow clear\. 

- 👍 https://www\.cnblogs\.com/anding/p/16987769\.html 



## 二、本地核心操作

### 2\.1 初始化仓库

```bash
git init          # 在当前目录创建一个新仓库，会生成 .git 文件夹
git clone <url>   # 把远程仓库完整复制到本地，包含所有历史记录
```

`clone` 做了三件事：创建文件夹、下载所有历史、自动把远程地址命名为 `origin`。

### 2\.2 查看当前状态

```bash
git status                       # 查看哪些文件被修改、哪些已暂存
git diff                         # 查看工作区和暂存区的具体差异（改了哪几行）
git diff --staged                # 查看暂存区和上次提交的差异（即将提交什么）
git log --oneline --graph --all  # 图形化查看所有分支的提交历史
```

`git status` 是用得最频繁的命令，在 `add`、`commit`、`merge` 之前都应该先看一眼，确认状态符合预期。

### 2\.3 暂存与提交

```bash
git add .              # 暂存当前目录下所有修改
git add <file>         # 只暂存某个文件
git commit -m "描述"   # 把暂存区的内容打包成一次提交
```

常用类型前缀：`feat`（新功能）、`fix`（修 Bug）、`docs`（文档）、`refactor`（重构）、`chore`（依赖/工具）。

团队协作时，分支命名要有规律：

- `feature/功能名` \- 新功能开发

- `bugfix/问题描述` \- bug 修复

- `hotfix/紧急修复` \- 线上紧急修复

- `refactor/重构内容` \- 代码重构

### 2\.4 同步远程仓库

```bash
git pull --rebase origin main   # 把远程 main 的最新内容拉到本地
git push origin main            # 把本地提交推送到远程
```

**`pull`**** 加 ****`--rebase`**

不加的话，`git pull` 默认会做一次 `merge`，每次同步都会多出一个"Merge branch 'main'"的提交，历史记录会变成一张网。加了 `--rebase` 之后，Git 会把本地提交接在远程最新提交的后面，历史保持一条直线，清晰很多。

**`push`**** 被拒绝**

提示 `rejected (non-fast-forward)` 说明远程有别人推送的新提交，本地还没有。先 `git pull --rebase` 同步下来，解决完冲突再 `push`。

### 2\.5 分支管理

分支的本质是一个指向某次提交的指针。创建分支几乎没有成本，它鼓励把每个功能、每个 Bug 修复都在独立分支上完成，互不干扰。

```bash
git branch                      # 查看本地所有分支，* 标识当前所在分支
git switch -c feature/login     # 创建 feature/login 分支并切换过去
git switch main                 # 切换回 main 分支
```

**开发完成后合并到 main：**

```bash
git switch main
git merge --no-ff feature/login -m "merge: 合并登录功能"
git branch -d feature/login               # 删除本地分支（已合并才能删）
git push origin --delete feature/login    # 删除远程分支
```

`--no-ff` 的意思是"禁止快进合并"，强制生成一个合并提交。这样在历史记录里能看出"这个功能在哪个节点合并进来的"，回溯问题时很有用。

### 2\.6 撤销操作

核心原则：**提交有没有 push 到远程，决定了用哪种方式撤销。**

**还没 push，只在本地：**

```bash
git restore <file>           # 丢弃工作区的修改，回到上次提交的状态（不可恢复）
git restore --staged <file>  # 把文件从暂存区退回工作区（add 错了用这个）
git reset --soft HEAD~1      # 撤销最近一次 commit，但修改保留在暂存区（commit 早了用这个）
git reset --hard HEAD~1      # 撤销 commit 并丢弃所有修改，彻底回到上一个提交（谨慎）
```

`HEAD~1` 表示"上一个提交"，`HEAD~2` 表示"上两个提交"，以此类推。

**已经 push，别人可能已经拉取：**

```bash
git revert <commit-hash>     # 创建一个新提交来"反向操作"指定提交，历史不变
```

`reset` 会抹掉历史，如果别人已经基于那次提交做了工作，你强行修改历史会让他们的仓库出问题。`revert` 是追加一次撤销操作，安全得多。

### 2\.7 临时保存工作现场

场景：你正在 `feature/login` 上开发到一半，突然要去修一个紧急 Bug，但现在的代码还没到能 commit 的程度。

```bash
git stash           # 把当前工作区和暂存区的修改临时存起来，工作区变干净
# 切换到其他分支处理紧急问题...
git stash pop       # 回来后恢复之前存的内容，继续开发
git stash list      # 如果存了多次，用这个查看列表
```

### 2\.8 冲突解决

冲突发生在：你和别人修改了同一个文件的同一行，Git 不知道该保留哪个。

```bash
# 执行 git pull 或 git merge 后出现冲突
git status          # 查看哪些文件有冲突，显示 "both modified"
```

打开冲突文件，你会看到这样的标记：

```text
<<<<<<< HEAD
console.log("我的修改");    ← 你本地的内容
=======
console.log("对方的修改");  ← 合并进来的内容
>>>>>>> feature/login
```

**处理方式：** 手动编辑，删除所有 `<<<<<<<`、`=======`、`>>>>>>>` 标记，留下最终正确的内容。可以选其中一个，也可以两个都保留，取决于业务逻辑。

```bash
git add <冲突文件>   # 告诉 Git 这个文件的冲突已经解决
git commit           # 完成合并提交
```

如果处理到一半发现搞不定，想从头来过：

```bash
git merge --abort    # 取消合并，回到合并前的状态
```

---

## 三、GitHub 操作

### 3\.1 把本地项目推到 GitHub

先在 GitHub 网站上创建一个空仓库（不要勾选初始化 README），然后：

```bash
git init
git add .
git commit -m "init: 项目初始化"
git remote add origin git@github.com:你的用户名/仓库名.git
git push -u origin main
```

`git remote add origin <url>` 是给远程仓库地址起一个别名叫 `origin`，以后就不用每次都写那么长的 URL 了。

`-u` 参数（`--set-upstream`）是建立本地 `main` 和远程 `origin/main` 的跟踪关系，建立之后以后直接 `git push` 就够了，不用再写 `origin main`。

### 3\.2 SSH 免密配置

用 HTTPS 地址每次 push 都要输账号密码。改用 SSH 之后，用密钥对认证，不用再输密码。

```bash
# 第一步：生成密钥对（一台电脑只需做一次）
ssh-keygen -t ed25519 -C "your_email@example.com"
# 一路回车，密钥默认保存在 ~/.ssh/id_ed25519（私钥）和 ~/.ssh/id_ed25519.pub（公钥）

# 第二步：复制公钥内容
cat ~/.ssh/id_ed25519.pub

# 第三步：把公钥添加到 GitHub
# GitHub → 头像 → Settings → SSH and GPG keys → New SSH key → 粘贴进去

# 验证是否配置成功
ssh -T git@github.com
# 看到 "Hi 用户名! You've successfully authenticated" 就说明成功了
```

私钥留在本地，公钥交给 GitHub。每次连接时 GitHub 用公钥验证你的私钥，验证通过就免密放行。以后克隆仓库统一用 SSH 地址（`git@github.com:...`）而不是 HTTPS 地址（`https://github.com/...`）。

### 3\.3 日常团队协作流程

团队协作的核心规则：**不要直接在 ****`main`**** 上开发**。每个功能开独立分支，通过 Pull Request 合并。

```bash
# 1. 开始新功能前，先同步 main 最新代码
git switch main
git pull --rebase origin main

# 2. 从最新的 main 创建功能分支
git switch -c feature/用户头像

# 3. 开发、提交
git add .
git commit -m "feat: 新增头像上传接口"

# 4. 推送分支到远程
git push -u origin feature/用户头像

# 5. 在 GitHub 上创建 Pull Request，填写说明，指定 Reviewer
# 6. 等 Review 通过后，在 GitHub 上点 Merge
# 7. 本地清理
git switch main
git pull --rebase origin main    # 同步合并结果
git branch -d feature/用户头像   # 删除本地分支
```

### 3\.4 参与开源项目（Fork 工作流）

你没有权限直接 push 到别人的仓库，所以需要先 Fork（复制一份到自己账号下），改完再发 Pull Request 给原作者。

```bash
# 在 GitHub 网页上点 Fork，把仓库复制到自己账号下
# 克隆自己 Fork 的仓库
git clone git@github.com:你的用户名/仓库名.git

# 添加原仓库为上游（用于同步原仓库的更新）
git remote add upstream git@github.com:原作者/仓库名.git

# 同步原仓库的最新代码（定期执行）
git fetch upstream
git rebase upstream/main
git push origin main    # 把同步结果推到自己的 Fork

# 正常开发分支、提交、push 到自己的 Fork
# 然后在 GitHub 上从你的 Fork 向原仓库发起 Pull Request
```

### 3\.5 Tag 与 GitHub Release

**Tag 是什么？** Tag 和分支一样，也是指向某个 commit 的指针，区别在于它**不会移动**。分支随着提交不断往前走，Tag 永远钉在打标签那一刻的 commit 上。它的用途是给重要节点起一个有意义的名字，最典型的场景就是标记版本号。

```text
main:  A──B──C──D──E
            ↑        ↑
          v1.0.0   v1.1.0
```

**Tag 的两种类型：**

- **轻量 Tag**：只是一个指针，没有额外信息，适合本地临时标记。

- **附注 Tag（annotated）**：包含打标签人、时间、说明信息，是正式发版时的标准做法。

```bash
# 查看已有 tag
git tag

# 打一个附注 Tag（发版用这个）
git tag -a v1.2.0 -m "Release v1.2.0: 新增支付模块"

# 给某个历史提交补打 Tag（漏打了用这个）
git tag -a v1.1.0 <commit-hash> -m "Release v1.1.0"

# 推送单个 Tag 到远程
git push origin v1.2.0

# 一次推送所有本地 Tag 到远程
git push origin --tags

# 删除本地 Tag
git tag -d v1.2.0

# 删除远程 Tag
git push origin --delete v1.2.0

# 查看某个 Tag 的详细信息
git show v1.2.0
```

**版本号怎么定？** 推荐遵循语义化版本（Semantic Versioning）：`主版本号.次版本号.修订号`

- `v1.0.0 → v2.0.0`：有不兼容的破坏性变更（Breaking Change）

- `v1.0.0 → v1.1.0`：新增了功能，但向下兼容

- `v1.0.0 → v1.0.1`：只修了 Bug，没有新功能

---

**GitHub Release 是什么？** Tag 只是 Git 层面的一个标记，GitHub Release 是在 Tag 基础上做的一层包装，可以附带：

- 这个版本的更新说明（changelog）

- 可下载的编译产物（二进制文件、压缩包等）

- 预发布标记（Pre\-release，标识这是测试版不建议生产使用）

**创建 Release 的流程：**

第一步，在本地打好 Tag 并推送到远程：

```bash
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

第二步，在 GitHub 上创建 Release

**更新内容**：

```markdown
## v1.2.0 - 2026-06-26

### 新功能
- 新增支付宝支付渠道
- 支持订单导出为 Excel

### Bug 修复
- 修复在 Safari 下图片上传失败的问题
- 修复金额超过 10000 时显示异常

### 破坏性变更
- `/api/user` 接口返回结构调整，`username` 字段改名为 `name`
```

**什么情况下该发 Release？**

- 对外提供 API 或 SDK 的项目：每次接口有变更就发，让调用方知道升级到哪个版本

- 需要分发安装包的项目：把编译好的文件作为附件上传到 Release，用户直接下载

- 开源项目：让关注者订阅 Release 通知，知道有新版本可用

内部自用的项目可以只打 Tag 不发 Release，能从提交历史里区分版本就够了。



