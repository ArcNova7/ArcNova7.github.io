import type { AstroExpressiveCodeOptions } from "astro-expressive-code";
import type { SiteConfig } from "@/types";

export const siteConfig: SiteConfig = {
	url: "https://ArcNova7.github.io/",
	/*
		- Used to construct the meta title property found in src/components/BaseHead.astro L:11
		- The webmanifest name found in astro.config.ts L:42
		- The link value found in src/components/layout/Header.astro L:35
		- In the footer found in src/components/layout/Footer.astro L:12
	*/
	title: "ArcNova",
	// Used as both a meta property (src/components/BaseHead.astro L:31 + L:49) & the generated satori png (src/pages/og-image/[slug].png.ts)
	author: "ArcNova7",
	// Used as the default description meta property and webmanifest description
	description: "Navigating Knowledge, Unveiling the World",
	// HTML lang property, found in src/layouts/Base.astro L:18 & astro.config.ts L:48
	lang: "zh-CN",
	// Meta property, found in src/components/BaseHead.astro L:42
	ogLocale: "zh_CN",
	// Determines whether to show the logo in the templates header
	showLogo: true,
	// Date.prototype.toLocaleDateString() parameters, found in src/utils/date.ts.
	date: {
		options: {
			day: "numeric",
			month: "short",
			year: "numeric",
		},
	},
};

// Used to generate links in both the Header & Footer.
export const menuLinks: { path: string; title: string }[] = [
	{
		path: "/",
		title: "Home",
	},
	{
		path: "/about/",
		title: "About",
	},
	{
		path: "/posts/",
		title: "Blog",
	},
	{
		path: "/categories/",
		title: "Categories",
	},
	{
		path: "/notes/",
		title: "Notes",
	},
];

// https://expressive-code.com/reference/configuration/
export const expressiveCodeOptions: AstroExpressiveCodeOptions = {
	styleOverrides: {
		borderRadius: "6px",
		codeFontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
		codeFontSize: "0.85rem",
		codeLineHeight: "1.6rem",
		codePaddingInline: "1.25rem",
		frames: {
			frameBoxShadowCssValue: "none",
		},
		uiLineHeight: "1.5",
	},
	themeCssSelector() {
		return ":root";
	},
	themes: ["github-light"],
	useThemedScrollbars: false,
};
