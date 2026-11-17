import path from "node:path"

export function claudeEnvironment(directory: string) {
	return {
		...process.env,
		CLAUDE_CODE_DISABLE_AGENT_VIEW: "1",
		CLAUDE_CODE_PROJECT_DIR_NAME: "argo",
		CLAUDE_CONFIG_DIR: path.join(directory, "data/claude"),
		COLORTERM: "truecolor",
		TERM: "xterm-256color",
	}
}
