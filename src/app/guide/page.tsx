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
      'Leave Learn halfway (in Match or Recall) and it goes on where you stopped next time, even on another device. Start over begins the set again.',
      'Speaking uses your browser (Chrome or Edge). If the mic does not work, type the answer.',
      'Talk: each talk is one situation with a few facts to use, so you never have to make up a story. 8 answers. Tap the mic (or Space) to answer, tap again to send.',
      'On a phone the talk is one column and the buttons stay at the bottom; on a computer it is two columns (the talk left, your review right) with keys: Space answer, Enter next, R try again, 1-3 versions, Esc cancel.',
      'You know when it ends: the last turn says "Last answer" so you can close the talk (thanks, next step, goodbye). Reach the goal early and you can keep going or End now.',
      'Each talk has a goal: use 2 (B1), 3 (B2) or 4 (C1) set phrases. At the end: Accuracy, Fluency and Phrases, each Strong, Good or Keep practicing, with the real numbers. No 0-100 score: it would come from AI judgment that changes from run to run.',
      'If the connection drops, the answer is sent again once by itself; if it still fails, Send again uses the same recording.',
      'The review opens on Natural; Correct and Level up are one tap away, and the fixes fold under "n fixes".',
      'On iPhone, Recall and saying again use Gemini to hear you (the browser cannot there). You always see what was heard, or why nothing was.',
      'Stuck? opens all hints in one place: Ideas (what to talk about), Phrases (from the set), Buy time (ways to pause) and Help (type your idea, get word groups). Never a full answer.',
      'The partner talks like a real person: a mood that fits the situation, feelings, short spoken replies, and the time of day. If you say something wrong, they say it back the right way, like people do, without stopping the talk. Short or hesitant answers get a kind push or a "No rush".',
      'They remember you: after each talk, a few facts you shared (plans, team, dates) are kept for that topic, and come up next time. The topic page shows them; Forget clears them.',
      'It is a conversation, not an interview: sometimes the other person shares something and waits for you to react, and once they ask you to ask them something. Ask them anything; they answer first.',
      'After each answer: your words with the mistakes marked. Fix them in your head, then Show answer for three versions (Correct, Natural, Level up), the top fixes and Say it again.',
      'I said it right hides a fix when the speech-to-text heard you wrong.',
      'Flow mode keeps talking and shows every review at the end. Once per talk the other person may push back or misunderstand you (marked curveball).',
      'At the end: phrases used, words per answer, words per minute, top fixes and all your answers.',
      'Cancel (or Esc) drops the answer you are recording or that is being checked. Try again throws away the last answer and asks the same line. End talk jumps to the summary.',
      'Leave a talk halfway and it goes on where you stopped next time, with no new AI call. New talk starts a fresh situation.',
      'Notes at the end (made once per talk): one thing to work on, missed chances to use a set phrase, better words, and a closing drill: say your weakest answers the natural way from a short idea.',
      'Your fixes go into a mistake bank by type (verb tense, a/an/the...). A new talk starts with a short warm-up on your top types. 5 right in a row and a type is done.',
      'A phrase you use in another talk without seeing it on the list counts as yours (Active).',
      'Got stuck in a real talk? Type what you wanted to say in the box at the top of Talk, in any language. Practice these makes a topic where you have to say those things.',
      'Voices: Google Chirp 3 HD when it is on in the project, otherwise your browser voice. Each line is made once and kept.',
      'Drills: 60 · 45 · 30 asks one question 3 times with less time each round; compare words, speed, uh/um, and how many points of your first answer you kept.',
      'Read and retell: paste a Slack thread, a PR or an article, read it, hide it, then tell it. You see which key points you covered and a natural retell.',
      'Time Capsule: the same one-minute talk once a month, kept as audio. Play old months to hear your progress.',
      'Help: type your idea in simple words and get 2-3 word groups to build the answer with. Never a full answer.',
      'Work topics like incidents and standups expect the main point first (BLUF); the interview expects Situation, Task, Action, Result (STAR). Long answers get a short note on order.',
      'Export to Anki (in an open set) downloads the phrases you do not own yet, ready for /anki-import.',
      'Stuck for a second? Buy time shows natural ways to pause instead of uh or um. The summary counts your uh/um per answer.',
      'Star (on a set) the phrases that fit you. Starred phrases at the top of Talk shows how far each one is: Learning, Known, Used with help, Yours.',
      'Busy day? Turn on Quick before the first answer: 3 answers instead of 8.',
      'Talk this again (at the end) does the same situation again, then shows last time and now side by side.',
      'This week (top of Talk): your streak, talks, minutes and words per minute. Up to 2 missed days in 7 do not break the streak.',
      'Meeting prep: when you make your own topic, Add your notes (an agenda, a ticket, what happened). The talk is built from your facts, and the notes stay on screen while you talk.',
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
