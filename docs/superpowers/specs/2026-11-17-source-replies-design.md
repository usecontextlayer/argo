# Source replies and drafts

## Purpose

Make Argo's existing source components interactive. A user can reply to an email or chat, or respond to a calendar invitation, from either its account screen or its expanded source inside Doables. Both locations use the same source component, action logic, draft, and writing experience.

The source determines the available actions and the durable draft mechanism. A conversation owns its draft independently of the view currently displaying it. One shared rich text editor supplies the writing experience, with Markdown shortcuts and source-specific conversion at the persistence and send boundaries.

## Scope and decisions

- Include Gmail and Outlook replies, WhatsApp/iMessage/Teams chat messages, and Google/Outlook Calendar invitation responses.
- Keep Granola and Workflowy unchanged.
- Reply within existing conversations. New mail composition, new chat creation, forwarding, attachments, and other source mutations are outside this change.
- Use one Tiptap editor configuration. Markdown shortcuts become formatted text while typing; this is not a raw Markdown textarea with a separate preview.
- Use source-native drafts where the integration exposes a draft lifecycle. Otherwise persist the conversation's draft locally.
- Keep sending account and conversation identity attached to the source item. The currently selected sidebar account does not determine where an embedded reply is sent.
- Keep the agreed account-first navigation and existing source provenance.

## User interaction

### Mail

Each email in a thread provides Reply and Reply all. Choosing one opens the shared editor beneath that email, with the source account and resolved recipients visible. The selected message determines the reply target; replying to an older email must not silently target the newest message instead. Reply all includes the source's reply recipients and excludes the sending identity according to that source's semantics.

The composer resumes an existing reply draft for the conversation. Changing between Reply and Reply all changes the recipient context without discarding the user's text. Source-provided draft content is loaded into the same editor, whether the draft originated in Argo or the original mail application. Signatures or quoted content that will be sent must be represented in the draft the user reviews, rather than appended invisibly at send time.

Sending saves the current edits to that draft and sends the native draft. The sent email returns through the existing thread reader. Draft messages are composer content, not entries rendered as already-sent emails.

### Chats

The conversation has the shared editor beneath its messages. WhatsApp and Teams also expose Reply on a specific message using native quoted-reply semantics. The selected original message appears above the editor and can be removed without deleting the text being written. A quoted reply is source metadata separate from a Markdown blockquote.

The current iMessage integration sends into an existing chat but exposes no quoted-reply operation. It gets the same editor and ordinary conversation sending, without a control that pretends to create a native quoted reply.

Conversation-level sending works for direct and group chats. The source component already knows the destination; composing does not ask the user to enter it again. After a successful send, the draft and selected quote are cleared and the conversation is refreshed.

### Calendar

An event invitation exposes Accept, Maybe, and Decline alongside the user's current response. The controls belong to the event component, so they appear in both the calendar and Doables. A response targets the selected event occurrence on its owning account and calendar. Events for which the account is not an invited attendee do not expose invitation-response controls.

The action sends the response to the organizer and refreshes the event. This change does not add response comments, proposed alternative times, event editing, or an editor to the calendar view.

## Shared editor

Use Tiptap and its existing Markdown support. Tiptap owns the editing document and history; the app does not maintain a second Markdown string that it continually synchronizes with the editor. Support ordinary paragraphs, bold, italic, strikethrough, links, headings, bullet and numbered lists, blockquotes, inline code, and code blocks. Use the same supported editing vocabulary in every composer. Do not add images, file controls, tables, or source-specific editor implementations.

The shared editor owns keyboard handling. It exposes a single `sendOnEnter` boolean, controlled by the source component and overridable by its hosting view. It does not infer this setting from the URL or duplicate handlers in mail and chat views.

| Key | `sendOnEnter: true` | `sendOnEnter: false` |
| --- | --- | --- |
| Enter | Send | Insert newline |
| Shift+Enter | Insert newline | Insert newline |
| Command+Enter | Send | Send |

Chat sources default to `true`; mail sources default to `false`. The same default applies when the source is embedded in Doables. Send-button and keyboard submission use the same action. Normal editor input, including composition and list editing, continues to use Tiptap's editing behavior except for the explicit submission bindings.

The editor supplies the writing surface and its common controls. The source component owns recipients, the reply target, native draft identity, save/send feedback, and the actual action. Do not add a universal action registry or make the generic `Document` and `Chat` presentation primitives understand provider APIs.

## Content conversion

Keep the Tiptap document while editing. Use its parsing and serialization facilities and source-specific adapters at the boundary, rather than manipulating formatting with string replacements in event handlers.

| Source | Native draft storage | Sent body |
| --- | --- | --- |
| Gmail | Native Gmail draft, HTML body | Email HTML with native threading metadata |
| Outlook | Native reply draft, HTML body | Send the existing reply draft |
| Teams | Local editor document with reply context | Supported Teams HTML and native quoted-reply metadata when selected |
| WhatsApp | Local editor document with reply context | WhatsApp text formatting and native quoted-reply metadata when selected |
| iMessage | Local editor document | Plain text |

Conversion occurs on native draft saves as well as sends, so a mail draft opened outside Argo is readable. Loading a native draft imports its body into the shared editor. Local drafts retain the editor document, allowing formatting to survive leaving and reopening a chat even when its eventual delivery format is plain text.

Use each destination's available formatting. For unsupported constructs, preserve readable text and structure. For example, iMessage receives plain text with line breaks, list markers, and link destinations rather than HTML or unexplained Markdown delimiters. WhatsApp uses its own bold/italic/strikethrough delimiters. Quoted-message identity, email threading headers, and calendar response status are not encoded into the editor body.

The existing source readers remain the way sent content is displayed. Their source adapters must interpret the supported native formatting so sending and subsequently reloading do not turn a formatted message into visible markup tokens. This is the same read/write format boundary, not a separate outgoing-message renderer.

## Conversation-owned drafts

Identify a draft by its source, source account, and conversation. Native draft IDs remain provider-owned identifiers associated with that conversation. Do not use a route URL, list-page token, selected sidebar item, mounted component identity, or displayed title as draft identity.

Gmail and Outlook expose native create/read/update/send draft operations. Resume the source draft, update that draft during editing, and send it. Reopening the conversation from another screen must not create another native draft. Native drafts remain the durable source of truth; a failed native save is not a reason to switch silently to a local-only draft.

The current Teams, WhatsApp, and iMessage interfaces do not expose a usable draft lifecycle. Persist their editor document and reply context in Argo's local application state, independently of route/component lifetime. Leaving the conversation, switching between Doables and the account screen, or restarting Argo must not discard a saved local draft.

There is one active editing state for a conversation within Argo. In-memory edits and save progress remain attached to it while views mount and unmount; opening another view resumes that state. This editing buffer is not a second durable authority for native drafts.

Autosave during editing, with visible saving/saved/error feedback. Update the existing draft rather than creating a new draft on every save. Before sending, complete saving the current content and send that version. Failed saves and sends leave the editable content available. Discard explicitly removes the corresponding native or local draft.

## Composition and ownership

The current code already shares the readers: account views render `MailThread`, `WhatsAppDocument`, `IMessageDocument`, `TeamsDocument`, and `EventDetails`; `SourceContentView` renders those same components inside Doables. Extend that boundary instead of implementing actions separately in the account views and Doables.

| Existing layer | Responsibility after this change |
| --- | --- |
| Source services and Electron APIs | Read, persist drafts, send/respond, normalize source data, and invalidate relevant cached reads after completed actions |
| Source data models | Preserve account, native item identity, reply context, draft identity, recipients, content, and response state |
| Source components | Render content and supported actions; bind the shared editor to the conversation's draft and source service |
| Shared editor | Rich text editing, Markdown shortcuts, common controls, and configurable keyboard submission |
| Account views | Lists, selected items, pagination, navigation, and placement of the source component |
| Doables and `SourceItem` | Arrange and load referenced source items, then embed the same interactive source components |
| Generic presentation primitives | Document layout, message bubbles, metadata, and reusable visual elements |

Both entry points must supply the same action-capable source model. In particular, carry the Teams chat ID through `SourceContent` and into `TeamsDocument`; do not discard it after loading the chat title. Pass conversation identity into the other chat documents as well.

Preserve structured mail recipients and the provider's reply/threading identifiers at the source-data boundary. Keep email display strings as presentation output rather than attempting to recover addresses from them during send. Calendar events must carry their native event/calendar identifiers separately from the composed IDs already used for routing and rendering; actions do not recover native identifiers by splitting display IDs.

Source components use the same typed Electron service API from either host. The privileged operation stays in the main process and uses the existing Composio, WhatsApp MCP, or `imsg` integration. Source-specific conversion and transport remain at this boundary, rather than in view click handlers.

Draft persistence does not revalidate every mounted reader on each autosave. After sending a message or responding to an invitation, invalidate the relevant source cache and use the existing router revalidation mechanism to refresh active content, including expanded source items. An editor that is already active is not reset merely because a loader revalidated. This extends the app's current service-call-and-refresh pattern; it does not require parallel action implementations for each route.

## Provider behavior and verified API paths

Gmail has a stable draft ID while its enclosed message ID changes on updates. Preserve the native draft ID. A reply must retain the correct thread ID, matching subject, and `In-Reply-To`/`References` headers. The discovered high-level draft tool exposes a thread target, not a selected-message target; use the native Gmail draft API through the existing authenticated Composio proxy when needed to preserve the selected-message semantics. Do not silently reply to a different message because a convenience tool has fewer parameters.

Outlook supplies native `createReply` and `createReplyAll`, followed by updating and sending that draft. Use the provider's reply recipient semantics, including `replyTo`. Send the created draft rather than making a second independent reply call.

Teams exposes a native `replyWithQuote` API for chat messages. Use that operation for a selected-message reply; the ordinary post-chat-message operation remains appropriate when no message is quoted. A reply to a chat message is distinct from a channel-thread reply.

WhatsApp's existing `send_message` tool accepts the chat destination and optional quoted message ID, sender JID, and quoted content. Its existing bridge persists outbound messages into the same local history read by Argo. The `imsg send` command accepts the existing chat identity and plain text; its current interface exposes no quoted-reply argument.

Google Calendar's available event patch operation accepts an RSVP response for the authenticated attendee. Outlook exposes accept/tentative and decline operations. Use those native response operations and the selected native event identity, with response notification enabled.

## Validation

Exercise the same interactive source component through the account route and an expanded Doables item. Verify that the same account/conversation resumes the same draft, while another account or conversation has its own content. Cover native mail draft create/update/resume/send and local chat draft save/reopen/restart through the production service paths with provider calls substituted at the external boundary.

Verify the shared keyboard matrix with both values of `sendOnEnter`, including that Shift+Enter remains a newline in each mode and keyboard submission reaches the same action as the Send button. Verify formatted editing, save/reload conversion, mail recipient display and threading, native quoted replies where supported, and calendar response state after refresh.

Use controlled fixtures for write requests. Actual messages or calendar responses require a user-designated test conversation or event; implementation verification does not send unsolicited content to real contacts. Run the existing TypeScript, formatting, and relevant test checks. Review both the account and embedded layouts using the styling conventions in `docs/styling.md`.

## Research references

- [Tiptap Markdown support](https://tiptap.dev/docs/editor/markdown): Markdown input/output uses Tiptap's document model.
- [Gmail draft lifecycle](https://developers.google.com/workspace/gmail/api/guides/drafts) and [threading requirements](https://developers.google.com/workspace/gmail/api/guides/threads).
- [Outlook createReply](https://learn.microsoft.com/en-us/graph/api/message-createreply?view=graph-rest-1.0), [createReplyAll](https://learn.microsoft.com/en-us/graph/api/message-createreplyall?view=graph-rest-1.0), and [send draft](https://learn.microsoft.com/en-us/graph/api/message-send?view=graph-rest-1.0).
- [Teams native quoted replies](https://learn.microsoft.com/en-us/graph/api/chatmessage-replywithquote?view=graph-rest-1.0).
- [WhatsApp text formatting](https://faq.whatsapp.com/539178204879377/).
- Installed Composio tool schemas, the local WhatsApp bridge's `send_message` implementation, and `imsg send --help` were inspected on 2026-11-17. Capability discovery did not send messages or respond to invitations.
