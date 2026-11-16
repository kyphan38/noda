import Link from 'next/link';

// noda - In-app guide. Plain English, one block per feature.
// Keep it in sync when a feature changes.

type Block = { title: string; lines: string[] };

const BLOCKS: Block[] = [
  {
    title: 'Lessons',
    lines: [
      'Tap + Audio to make a lesson. Drop an audio or video file and its .srt subtitles. Several files at once make several lessons.',
      'Or paste a YouTube link. The video needs English subtitles from the channel (auto captions do not count). Then drop the .srt for it.',
      'The start page lists recent lessons. A lesson opens where you stopped, with a Continue bar.',
    ],
  },
  {
    title: 'Sidebar',
    lines: [
      'Search finds lessons by name.',
      'Make folders and drag lessons into them.',
      'Swipe left to close it on a phone.',
      'At the top: theme, export all data (.json) and log out.',
    ],
  },
  {
    title: 'Listen',
    lines: ['Play the lesson and read along. Tap a line to play it.'],
  },
  {
    title: 'Shadowing',
    lines: [
      'Listen to a line, then say it out loud with the speaker.',
      'Enter (or the tap button) marks the line done and plays the next one.',
      'H hides the captions so you only listen.',
      'The AI button on the player shows how a line sounds: stressed syllables, linked words, pauses. Auto analyzes the next lines too.',
      'The speaking check splits the lesson into short parts. Record each one to get a score, the words that went wrong and the top fixes.',
    ],
  },
  {
    title: 'Dictation',
    lines: [
      'Listen to a line and type what you hear. A right letter appears, a wrong one shakes.',
      'Tab (or the hint button) shows the next letter.',
      'Control plays the line again.',
    ],
  },
  {
    title: 'Progress',
    lines: [
      'The bars show how much of the lesson is done in Shadowing and in Dictation.',
      'Reset clears the progress of the current tab. Undo works for a few seconds.',
      'When both are done, noda offers to move the lesson to Trash.',
    ],
  },
  {
    title: 'Trash',
    lines: ['Deleted lessons go to Trash. Restore them, or remove them for good.'],
  },
  {
    title: 'Keys',
    lines: [
      'Space play or pause · ← and → move 5 seconds · L or R changes how many times a line repeats.',
      '⌘1, ⌘2, ⌘3 switch between Listen, Shadowing and Dictation.',
    ],
  },
];

export default function GuidePage() {
  return (
    <main className="min-h-screen overflow-y-auto">
      <div className="mx-auto w-full max-w-xl space-y-8 px-4 py-10 sm:py-16">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-100">Guide</h1>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-100">
            Back to noda
          </Link>
        </div>

        {BLOCKS.map((b) => (
          <section key={b.title} className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">{b.title}</h2>
            <ul className="space-y-2">
              {b.lines.map((line) => (
                <li key={line} className="text-[15px] leading-relaxed text-gray-300">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
