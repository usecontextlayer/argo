import type { ReactNode } from "react"
import "./presentation.css"

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
		<article className="presentation-document">
			{(title || identity || meta || actions) && (
				<header className="presentation-document-header">
					{identity}
					{(title || actions) && (
						<div className="presentation-document-title">
							{title && <h2>{title}</h2>}
							{actions && <div className="presentation-document-actions">{actions}</div>}
						</div>
					)}
					{meta && <div className="presentation-metadata">{meta}</div>}
				</header>
			)}
			<div className="presentation-document-content">{children}</div>
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
		<section className="presentation-document-section">
			{title && <h3>{title}</h3>}
			{children}
		</section>
	)
}
