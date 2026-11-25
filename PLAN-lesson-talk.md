# PLAN: Lesson -> Talk

Goal: after a lesson, speak about it in one tap. The talk makes you reuse the
lines you missed in dictation and the words you looked up.

Today the two sides do not touch:
- Lesson side: transcript (`transcriptText`), dictation misses
  (`users/{uid}/misses/{lessonId}`, `src/lib/dictation-misses.ts`), word cards
  (`users/{uid}/words/{key}`, no lessonId saved).
- Talk side: custom topics built from notes (`notesKind: 'context' | 'stuck'`,
  `functions/src/lib/talkTopic.ts`), and the Retell drill
  (`DrillRetell.tsx`, you paste text, max 4000 chars in `talkSpeech`).

Both pieces we need already exist. This plan only links them.

## The flow

1. In a lesson, a **Talk about it** button (lesson header, and also in the
   "lesson complete" modal).
2. It opens a small modal with two choices:
   - **Retell** (90 s): tell what you heard. AI checks the key points.
   - **Talk**: a Talk topic built from this lesson. Its first phrase set holds
     the chunks from the lines you missed and the words you looked up.
3. Talk already tracks which phrases you used (`usedPhraseIds`) and moves them
   through stages. So "reuse 3-5 phrases" needs no new logic: it is set 1.

## Phase 1: Retell from a lesson (no new Cloud Function) - done

- New pure module `src/lib/lesson-talk.ts` (+ `lesson-talk.test.ts`):
  - `retellParts(sentences, max = 4000)`: cut the transcript into parts at
    sentence ends, each under `MAX_SOURCE`. A short lesson is one part.
- `DrillRetell` takes an optional `source` prop. With it, skip the paste step
  and start at "read" (text hidden by default: you just listened, so the
  honest test is from memory; a "Show text" toggle helps).
- New `LessonTalkModal.tsx`: part picker (only when more than one part) +
  `DrillRetell`. Keep `LessonView.tsx` (649 lines) untouched apart from
  mounting the button: it is over the 500-line limit.
- Cost: one `talkSpeech` call per retell, same as today.

## Phase 2: Talk topic from a lesson - done

Server (`functions/src/lib/talkTopic.ts`, pure, tested):
- `NOTES_KINDS` gets `'lesson'`. For it, notes may be up to 4000 chars.
- New request fields: `lessonId`, `targets: string[]` (max 12 items, each
  max 200 chars: missed sentences and looked-up words).
- Prompt branch for `'lesson'`:
  - Scenarios talk *about the clip*: give your opinion, link it to your life
    or work, explain one part to a friend, disagree with the speaker.
  - The first `SET_SIZE` phrases are chunks taken from `targets`, written
    exactly as in the clip. The rest come from the transcript, then the topic.
- Bump `TOPIC_VERSION` only if old topics need it (they do not: keep 3).

Client:
- `buildLessonNotes(sentences, missRows, words, max)` in `lesson-talk.ts`:
  pick the excerpt. Sentences with misses and their neighbours first, then
  fill in order, cut at `max`. Pure, tested.
- Topic id is fixed per lesson: `lesson-<lessonId>` (lowercased, safe chars).
  Opening it again is free (the function returns the saved copy).
  A **New talk** action deletes and rebuilds it, for after more practice.
- `TalkTopic` gets `lessonId?` and shows "From: <lesson name>" on the topic.
  The topic keeps its own copy of the text, so moving the lesson to the trash
  breaks nothing.
- After the topic is made, go to `/talk/` with that topic open.
  To check: TalkView has no `?topic=` param today. Add one, or reuse the
  saved section/topic state.
- Cost: one `talkTopic` call per lesson (cached), then normal turns.

## Phase 3: Looked-up words per lesson

- `defineWord` takes an optional `lessonId` and saves it on the word doc.
- `listWordsForLesson(lessonId)` in `src/lib/db/`.
- Feed them into `targets` (after the missed lines).
- Old word cards have no lessonId. Skip them: not worth a migration.

## Out of scope

- Auto-making a topic when a lesson ends (costs a call you may not use).
- Mixing several lessons into one topic.
- Changes to `talkTurn` or `talkWrap`.

## Done when

- From a finished lesson: Retell works in 2 taps, Talk in 2 taps.
- The Talk topic's set 1 shows phrases from your missed lines.
- Unit tests for `retellParts`, `buildLessonNotes`, and the `'lesson'`
  branch of `checkTopicRequest` / `buildTopicPrompt`.
- `src/app/guide/page.tsx` explains the button.
- `TESTING-talk.md` checklist has the new steps.

## Order

P1 first (small, no server change, useful alone). Then P2. P3 last, only if
set 1 often feels thin without looked-up words.
