export const accounts = [
	{
		calendar: "googlecalendar_phenin-marrot",
		email: "alizain@feerasta.net",
		id: "feerasta",
		mail: "gmail_yurt-giber",
		provider: "google",
	},
	{
		calendar: "googlecalendar_ler-fetal",
		email: "alizain@eightzerothree.co",
		id: "eightzerothree",
		mail: "gmail_noria-navvy",
		provider: "google",
	},
	{
		calendar: "googlecalendar_oryx-super",
		email: "alizain.feerasta@gmail.com",
		id: "gmail",
		mail: "gmail_quegh-arkose",
		provider: "google",
	},
	{
		calendar: "outlook_vina-calf",
		email: "azain.c@codecreators.ca",
		id: "codecreators",
		mail: "outlook_vina-calf",
		provider: "microsoft",
	},
	{
		calendar: "outlook_nation-thug",
		email: "alizain@alnujefferson.com",
		id: "alnu",
		mail: "outlook_nation-thug",
		provider: "microsoft",
	},
] as const

export function getAccount(id: string) {
	const account = accounts.find((account) => account.id === id)
	if (!account) throw new Error(`Unknown account: ${id}`)
	return account
}
