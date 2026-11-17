import type { ReactNode } from "react"
import { Metadata } from "./primitives"

export function Document({
	title,
	identity,
	meta,
	children,
	actions,
}: {
	title?: string
	identity?: ReactNode
	meta?: ReactNode
	children: ReactNode
	actions?: ReactNode
}) {
	return (
		<article
			data-slot="document"
			className="mx-auto w-full min-w-0 max-w-4xl text-sm leading-relaxed text-foreground"
		>
			{(title || identity || meta || actions) && (
				<header className="flex flex-col gap-4 pb-6">
					{identity}
					{(title || actions) && (
						<div className="flex flex-wrap items-start justify-between gap-4">
							{title && (
								<h2 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
									{title}
								</h2>
							)}
							{actions && <div className="flex shrink-0 gap-2">{actions}</div>}
						</div>
					)}
					{meta && <Metadata>{meta}</Metadata>}
				</header>
			)}
			<div className="space-y-4">{children}</div>
		</article>
	)
}

export function DocumentSection({
	title,
	children,
}: {
	title?: string
	children: ReactNode
}) {
	return (
		<section className="mt-6 first:mt-0">
			{title && <h3 className="mb-3 text-base font-semibold">{title}</h3>}
			{children}
		</section>
	)
}
