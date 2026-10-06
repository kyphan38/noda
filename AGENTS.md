# Agent instructions (noda)

## Git commits

Follow `.cursor/rules/git-commits.mdc` - loaded automatically in this workspace.

Format: `<type>(<scope>): <summary>`

Commit only. Do not push unless explicitly asked.

## Writing: no em dash

Never write the em dash `—` (U+2014), and never its escapes `&mdash;`,
`&#8212;` or `\u2014`. This covers everything: code, comments, UI text,
docs, commit messages and AI prompts.

Use a plain hyphen with spaces (` - `), a comma, a colon, or two short
sentences instead.

## Language: English in code

Write code comments, test names, assert messages, script logs and AI prompts
in plain English. Keep comments short: say why, not the history.

Vietnamese is fine only in: PLAN-*.md, roadmap/ and docs/ files; test data
or parsers that handle real Vietnamese text; proper names.

## UI copy: as little as possible

- If the title already says it, add no description.
- Otherwise one short line, about 10 words or less.
- No reasons or history in the UI. Put those in a code comment.
- Exception: in-app guide pages (none in noda yet).
