# Agent instructions (noda)

## Git commits

Follow `.cursor/rules/git-commits.mdc` - loaded automatically in this workspace.

Format: `<type>(<scope>): <summary>`

Commit only. Do not push unless explicitly asked.

## Code layout: keep files small

- A file over about 500 lines is split before a feature is added to it: move a part of
  the UI to its own component, a pure function to its own module (with a test), or a block
  of state and actions to its own hook.
- Pure logic (no React, no Firebase) lives in its own module and has unit tests.
- Data access goes through `@/lib/db` (`src/lib/db/`); page state goes in hooks in
  `src/hooks/`; pure rules in `src/lib/` (tests in `src/**/*.test.ts`).

## Git: no co-author

Never add `Co-Authored-By:` (or any other author line) to a commit message
or a PR description. Git already records the author.

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
