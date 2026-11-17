import { StdioServerTransport } from "@modelcontextprotocol/server/stdio"
import { createNoveltyChannel } from "./channel.mjs"

await createNoveltyChannel().connect(new StdioServerTransport())
