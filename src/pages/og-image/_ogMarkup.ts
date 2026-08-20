import { html } from "satori-html";
import { siteConfig } from "@/site.config";

// OG image markup, use https://og-playground.vercel.app/ to design your own.
export const ogMarkup = (title: string, pubDate: string) =>
	html`<div tw="flex flex-col w-full h-full bg-[#fbfbfc] text-[#243b8f]">
		<div tw="flex flex-col flex-1 w-full p-10 justify-center">
			<p tw="text-2xl mb-6 text-[#9a6100]">${pubDate}</p>
			<h1 tw="text-6xl font-bold leading-snug text-[#1f2b55]">${title}</h1>
		</div>
		<div tw="flex items-center justify-between w-full p-10 border-t-2 border-[#c47a00] text-[#243b8f]">
			<p tw="text-2xl ml-3 font-semibold">${siteConfig.title}</p>
			<p>by ${siteConfig.author}</p>
		</div>
	</div>`;
