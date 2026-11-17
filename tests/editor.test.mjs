import assert from "node:assert/strict"
import test from "node:test"
import {
	documentToHtml,
	documentToText,
	documentToWhatsApp,
	emptyDocument,
	htmlToDocument,
	parseEditorDocument,
	whatsAppToHtml,
} from "../src/editor.ts"

const formatted =
	'<h2>Plan &amp; café</h2><p><strong>Bold</strong> <em>italic</em> <s>removed</s> <code>x &lt; 3</code> <a href="https://example.test/guide">guide</a><br>Next line</p><ul><li><p>First</p></li><li><p>Second</p></li></ul><ol start="3"><li><p>Third</p></li><li><p>Fourth</p></li></ol><blockquote><p>A quote</p></blockquote><pre><code>one &lt; two\nthree &amp; four</code></pre>'

test("mail HTML imports and saves the editor's formatting and readable text", () => {
	const document = htmlToDocument(formatted)
	const saved = documentToHtml(document)
	assert.match(saved, /<h2>Plan &amp; café<\/h2>/)
	assert.match(
		saved,
		/<strong>Bold<\/strong> <em>italic<\/em> <s>removed<\/s> <code>x &lt; 3<\/code>/,
	)
	assert.match(
		saved,
		/<a [^>]*href="https:\/\/example\.test\/guide"[^>]*>guide<\/a><br\s*\/>Next line/,
	)
	assert.match(saved, /<ul><li><p>First<\/p><\/li><li><p>Second<\/p><\/li><\/ul>/)
	assert.match(
		saved,
		/<ol start="3"><li><p>Third<\/p><\/li><li><p>Fourth<\/p><\/li><\/ol>/,
	)
	assert.match(saved, /<blockquote><p>A quote<\/p><\/blockquote>/)
	assert.match(saved, /<pre><code>one &lt; two\nthree &amp; four<\/code><\/pre>/)
	assert.deepEqual(htmlToDocument(saved), document)
})

test("plain-text delivery preserves line breaks, list numbers, and link destinations without rich-text delimiters", () => {
	assert.equal(
		documentToText(htmlToDocument(formatted)),
		[
			"Plan & café",
			"",
			"Bold italic removed x < 3 guide (https://example.test/guide)",
			"Next line",
			"",
			"- First",
			"- Second",
			"",
			"3. Third",
			"4. Fourth",
			"",
			"> A quote",
			"",
			"one < two",
			"three & four",
		].join("\n"),
	)
})

test("WhatsApp delivery uses native text formatting and retains structure and destinations", () => {
	assert.equal(
		documentToWhatsApp(htmlToDocument(formatted)),
		[
			"Plan & café",
			"",
			"*Bold* _italic_ ~removed~ `x < 3` guide (https://example.test/guide)",
			"Next line",
			"",
			"- First",
			"- Second",
			"",
			"3. Third",
			"4. Fourth",
			"",
			"> A quote",
			"",
			"```",
			"one < two",
			"three & four",
			"```",
		].join("\n"),
	)
})

test("the WhatsApp reader renders native formatting instead of showing outgoing markup tokens", () => {
	assert.deepEqual(
		htmlToDocument(whatsAppToHtml("*Bold* _italic_ ~removed~ `x < 3`")),
		htmlToDocument(
			"<p><strong>Bold</strong> <em>italic</em> <s>removed</s> <code>x &lt; 3</code></p>",
		),
	)
	assert.deepEqual(
		htmlToDocument(
			whatsAppToHtml(
				"- First\n- Second\n3. Third\n4. Fourth\n> A quote\n```\none < two\nthree & four\n```",
			),
		),
		htmlToDocument(
			'<ul><li>First</li><li>Second</li></ul><ol start="3"><li>Third</li><li>Fourth</li></ol><blockquote><p>A quote</p></blockquote><pre><code>one &lt; two\nthree &amp; four\n</code></pre>',
		),
	)
})

test("WhatsApp delivery and reading preserve overlapping bold and italic spans", () => {
	const document = htmlToDocument(
		"<p><strong>one <em>two</em> three</strong> and <em>four <strong>five</strong> six</em></p>",
	)
	const sent = documentToWhatsApp(document)
	assert.equal(sent, "*one _two_ three* and _four *five* six_")
	assert.deepEqual(htmlToDocument(whatsAppToHtml(sent)), document)
})

test("text delivery preserves nested lists and their parent items", () => {
	const document = htmlToDocument(
		"<ul><li><p>Parent</p><ul><li><p>Child</p></li></ul></li><li><p>Sibling</p></li></ul>",
	)
	const text = "- Parent\n  - Child\n- Sibling"
	assert.equal(documentToText(document), text)
	assert.equal(documentToWhatsApp(document), text)
	assert.deepEqual(htmlToDocument(whatsAppToHtml(text)), document)
})

test("local draft documents retain formatting through JSON persistence before plain-text delivery", () => {
	const document = htmlToDocument(formatted)
	const reopened = parseEditorDocument(JSON.parse(JSON.stringify(document)))
	assert.deepEqual(reopened, document)
	assert.match(documentToHtml(reopened), /<strong>Bold<\/strong>/)
	assert.equal(documentToText(emptyDocument()), "")
	assert.equal(
		documentToText(htmlToDocument("<p>a_b *ordinary* &lt;tag&gt; C:\\notes</p>")),
		"a_b *ordinary* <tag> C:\\notes",
	)
})
