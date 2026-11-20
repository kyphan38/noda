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
      'Listen again: up to 3 lessons you did half or more of, then left for a week.',
    ],
  },
  {
    title: 'Sidebar',
    lines: [
      'Search finds lessons by name.',
      'Make folders and drag lessons into them.',
      'Swipe left to close it on a phone.',
      'At the top: theme, export all data (.json) and log out.',
      'At the bottom: Mistakes (Talk and Dictation), Speaking, Talk and this Guide.',
    ],
  },
  {
    title: 'Listen',
    lines: [
      'Play the lesson and read along. Tap a line to play it.',
      'Double click a word (or tap it twice) to see its IPA and a simple meaning in that sentence. One click still plays the line.',
      'It is off at first: tap "Words off" above the lines to turn it on.',
      'Tap "Pauses off" to turn pauses on (uploaded files only): after each sentence, a silence as long as the sentence, so you can say it.',
    ],
  },
  {
    title: 'Shadowing',
    lines: [
      'Listen to a line, then say it out loud with the speaker.',
      'Enter (or the tap button) marks the line done and plays the next one.',
      'H hides the captions so you only listen.',
      'Double click a word (or tap it twice) to see its IPA and meaning.',
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
      'After 2 misses on a line (wrong letters or hints), it plays again at 0.8x. The next line is back to your speed.',
      'paragraph: play a part of about 5 sentences, write it all in one box, then Check to see the missed words and your %. Control plays the part again. Practice only, not saved.',
    ],
  },
  {
    title: 'Talk',
    lines: [
      'Learn useful phrases for a topic, then speak them with an AI partner. Everything is in English.',
      'Topics cover work, daily life, friends, family and travel. Pick your level (B1, B2, C1) and a topic, tap Surprise me, or make your own. A new topic takes up to a minute to make, then it is saved.',
      'Each topic has 4 sets of 10 phrases. Open a set to see its phrases. Hide one that sounds odd.',
      'Learn a set: read the cards (tap to hear), match phrases to meanings, then fill the blanks and say each phrase from its meaning. Everything is in English.',
      'A wrong answer comes back a few items later. The set is done when nothing is wrong.',
      'Speaking uses your browser (Chrome or Edge). If the mic does not work, type the answer.',
      'Talk: each talk is one situation with a few facts to use, so you never have to make up a story. 8 answers. Tap the mic (or Space) to answer, tap again to send.',
      'Stuck? Ideas shows short notes of what to say, Phrases shows phrases of the set. Never a full answer.',
      'After each answer: your words with the mistakes marked. Fix them in your head, then Show answer for three versions (Correct, Natural, Level up), the top fixes and Say it again.',
      'I said it right hides a fix when the speech-to-text heard you wrong.',
      'Flow mode keeps talking and shows every review at the end. Once per talk the other person may push back or misunderstand you (marked curveball).',
      'At the end: phrases used, words per answer, words per minute, top fixes and all your answers.',
      'Cancel (or Esc) drops the answer you are recording or that is being checked. Try again throws away the last answer and asks the same line. End talk jumps to the summary.',
      'Leave a talk halfway and it goes on where you stopped next time, with no new AI call. New talk starts a fresh situation.',
      'Notes at the end (made once per talk): one thing to work on, missed chances to use a set phrase, better words, and a closing drill: say your weakest answers the natural way from a short idea.',
      'Your fixes go into a mistake bank by type (verb tense, a/an/the...). A new talk starts with a short warm-up on your top types. 5 right in a row and a type is done.',
      'A phrase you use in another talk without seeing it on the list counts as yours (Active).',
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
    title: 'Mistakes',
    lines: [
      'The lines you wrote wrong most often, in every lesson.',
      'Tap one to hear it and write it again. Control plays it again. Right, and it leaves the list. YouTube lines open in their lesson.',
    ],
  },
  {
    title: 'Speaking',
    lines: [
      'Your speaking-check score by day, the sound habits that keep going wrong (for example elision · /t/), and the words said wrong most.',
      'Inside a speaking check, a chart shows the scores of that lesson.',
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
    <main className="h-dvh overflow-y-auto">
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
