export function memoize<T>(
	cache: Map<string, Promise<T>>,
	key: string,
	read: () => Promise<T>,
): Promise<T> {
	const existing = cache.get(key)
	if (existing) return existing
	const result = read().catch((error) => {
		cache.delete(key)
		throw error
	})
	cache.set(key, result)
	return result
}
