import { useRevalidator, useRouteError } from "react-router"
import { Button } from "@/components/ui/button"

export function SourceError({ title, fallback }: { title: string; fallback: string }) {
	const error = useRouteError()
	const revalidator = useRevalidator()
	return (
		<main
			className="flex min-h-full w-full flex-1 flex-col items-center justify-center gap-4 p-10 text-center"
			role="alert"
		>
			<h2 className="text-xl font-semibold">{title}</h2>
			<p className="max-w-prose text-sm text-muted-foreground">
				{error instanceof Error ? error.message : fallback}
			</p>
			<Button onClick={() => revalidator.revalidate()}>Try again</Button>
		</main>
	)
}
