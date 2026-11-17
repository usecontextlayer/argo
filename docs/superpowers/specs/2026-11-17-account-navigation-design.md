# Account navigation

## Purpose

Replace Argo's mixed top navigation with a left sidebar that opens a particular source for a particular account. Accounts are visually grouped by provider. Doables is an app-wide destination in its own section at the same navigation level.

The current shell mixes accounts, applications, and Doables as peer tabs, then exposes Mail, Calendar, and Teams in another tab row. The new shell gives every destination a direct link. A Google account's mail and calendar are separate destinations even when they use the same account identity.

## Agreed model

- Use one left sidebar; remove both the top account tabs and the source subnavigation.
- Give Doables its own section above the account groups.
- Group accounts by provider, with the provider icon and name shown once in the group heading.
- Group headings are visual labels, not destinations or expandable navigation levels. Each account destination is directly clickable.
- Keep providers distinct: Gmail and Outlook do not share a Mail group.
- Keep mail and calendar in separate groups for both Google and Outlook. Account rows show only the account identity; the group heading supplies the service.
- Treat providers with a single account exactly like providers with several accounts.
- Keep the existing account labels and initials in account rows; do not repeat the provider icon on every row.
- Keep the current content views, their functional headings, Refresh controls, and date or month navigation.
- Remove the decorative mail subtitle, "Your mail, together."
- Preserve existing provenance in content headers, list rows, detail views, and Doables during this pass. Context-sensitive removal of repeated provenance is a separate later pass.

## Destinations

The existing provider identities and account definitions supply the sidebar. Each entry links directly to an existing route; the sidebar does not introduce new account records or change connections.

| Section or provider | Clickable entries | Destination |
| --- | --- | --- |
| App-wide section | Doables | `/doables` |
| Gmail | Feerasta, 803, Personal | `/mail?account=<id>` for each Google account |
| Google Calendar | Feerasta, 803, Personal | `/calendar?account=<id>` for each Google account |
| Outlook Mail | CodeCreators, ALNU | `/mail?account=<id>` for each Microsoft account |
| Outlook Calendar | CodeCreators, ALNU | `/calendar?account=<id>` for each Microsoft account |
| Teams | CodeCreators | `/teams?account=codecreators` |
| Granola | Feerasta | `/granola` |
| WhatsApp | Personal | `/whatsapp` |
| iMessage | Personal | `/imessage` |
| Workflowy | Personal | `/workflowy` |

Outlook Mail and Outlook Calendar are separate groups that share the existing Outlook provider artwork. Each contains its own direct account links, matching the separation between Gmail and Google Calendar. No nested navigation is introduced.

Retain the existing account order within each provider. Show the mail and calendar providers first, followed by Teams, Granola, WhatsApp, iMessage, and Workflowy. Keep the Argo wordmark in the sidebar and retain its current home-link behavior.

## Interaction and layout

The sidebar sits beside the existing workspace. A conversation-based workspace continues to contain its list and reader; Calendar and Workflowy keep their current content structure. Navigation scrolls vertically when its groups exceed the window height, independently of the content panes.

The selected link reflects the current route and account. Mail and calendar links for the same account must be independently selectable. Opening a thread, meeting, chat, or source item keeps its owning destination selected. Doables remains a peer destination rather than an account or provider.

Opening an item preserves its list context, including an older mail page or a historical meeting month. Paging the conversation list preserves the current reader's message anchor and history position. The list and reader can be navigated independently without resetting one another.

The reader obtains its selected item's identity independently of the visible list page. For Teams, the selected chat has its own metadata read, sharing the same normalized chat cache as list results, so paging the list cannot replace its title with a generic label.

Switching between calendar accounts retains the displayed date and day/week view, including when that date was inferred from an opened event. The date is the calendar navigation cursor; its month is derived rather than stored alongside it. Source links may supply a month to locate an event before its date is known. Closing that event preserves the resolved date. The selected event belongs to its original account and is not carried into the destination account.

Use semantic navigation with ordinary links and a clear active state. Provider headings supply visual grouping; keyboard users reach each destination directly. Preserve provider artwork and account identities. Follow [the styling conventions](../../styling.md) for stock Tailwind scales and shadcn components; visual consistency takes precedence over the previous custom typography, colors, and measurements.

## Implementation shape

React Router already owns navigation, nested content, and route loading. Replace the `AppShell` tab controls with `NavLink` destinations and render the existing `Outlet` beside the sidebar. Derive active state from the router and current account parameter rather than storing another selected-account state.

Use `accounts` and `singleConnectionAccounts` from the account configuration, and `providers` for provider presentation. Account IDs remain the identity through rendering; email addresses are display information. Reference validation derives account membership from the same account configuration. Keep account records and destination paths separate in the navigation data; serialize query parameters only when rendering a link. Read the active calendar route's loader data to preserve its displayed date and view. The sidebar needs only a small presentation of groups and destinations; it does not introduce a connection registry or change the account data model. Remove shell-specific tab handling and CSS that the sidebar replaces. Preserve tabs inside content views where they switch actual content, such as meeting summaries and transcripts.

Workspace layout breakpoints use the content area's width after accounting for the sidebar. This includes the calendar's event-detail layout and Doables' compact spacing.

Existing routes, loaders, refresh actions, loading views, and error boundaries remain responsible for content behavior. This pass does not change synchronization or connected-service behavior.

## Validation

Verify that every sidebar destination opens the intended source and account, including both Outlook capabilities and the single-account providers. Check that direct links and navigation from Doables select the owning destination. Exercise a mail thread, a chat, a meeting, calendar navigation, and Refresh to confirm the shell change preserves content interactions.

Review the running interface at a normal and a shorter window height: all account groups must remain reachable, the selected destination must be clear, and the list and reader must retain usable space. Confirm that provider icons appear once per navigation group, that top tabs and source subnavigation are gone, and that existing content provenance remains present. Run TypeScript and formatting checks for the implementation changes.
