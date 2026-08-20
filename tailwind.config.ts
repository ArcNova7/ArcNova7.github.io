import type { Config } from "tailwindcss";

export default {
	plugins: [require("@tailwindcss/typography")],
	theme: {
		extend: {
			typography: () => ({
				DEFAULT: {
					css: {
						a: {
							textUnderlineOffset: "2px",
							"&:hover": {
								"@media (hover: hover)": {
									textDecorationColor: "var(--color-link)",
									textDecorationThickness: "2px",
								},
							},
						},
						blockquote: {
							background: "var(--color-amber-surface)",
							borderInlineStart: "3px solid var(--color-amber)",
							borderRadius: "0 0.375rem 0.375rem 0",
							color: "var(--color-global-text)",
							fontStyle: "normal",
							padding: "0.75rem 1rem",
						},
						code: {
							background: "#f3f5fa",
							border: "1px solid var(--color-border)",
							borderRadius: "0.25rem",
							fontWeight: "500",
							padding: "0.1rem 0.3rem",
						},
						kbd: {
							background: "#f3f5fa",
						},
						hr: {
							borderColor: "var(--color-border)",
							borderTopStyle: "solid",
						},
						strong: {
							fontWeight: "700",
						},
						sup: {
							marginInlineStart: "calc(var(--spacing) * 0.5)",
							a: {
								"&:after": {
									content: "']'",
								},
								"&:before": {
									content: "'['",
								},
								"&:hover": {
									"@media (hover: hover)": {
										color: "var(--color-link)",
									},
								},
							},
						},
						/* Table */
						"tbody tr": {
							borderBottom: "1px solid var(--color-border)",
						},
						tfoot: {
							borderTop: "1px solid var(--color-border)",
						},
						thead: {
							borderBottom: "1px solid var(--color-border)",
						},
						"thead th": {
							background: "#f3f5fa",
							borderBottom: "0",
							fontWeight: "700",
						},
						'th[align="center"], td[align="center"]': {
							"text-align": "center",
						},
						'th[align="right"], td[align="right"]': {
							"text-align": "right",
						},
						'th[align="left"], td[align="left"]': {
							"text-align": "left",
						},
						".expressive-code, .admonition, .github-card": {
							marginTop: "calc(var(--spacing)*4)",
							marginBottom: "calc(var(--spacing)*4)",
						},
						".expressive-code": {
							border: "1px solid var(--color-border)",
							borderRadius: "0.375rem",
							overflow: "hidden",
						},
					},
				},
				sm: {
					css: {
						code: {
							fontSize: "var(--text-sm)",
							fontWeight: "400",
						},
					},
				},
			}),
		},
	},
} satisfies Config;
