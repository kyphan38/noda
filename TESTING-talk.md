# Talk: manual test checklist

Test on the live site (or `localhost:3000/talk`). On localhost, press Cmd+Shift+R
once first, so an old service worker does not serve old code.

Tick each box. If something is wrong, write a note under it (a screenshot helps),
then send the file back.

---

## 1. Topics

- [ ] Open **Talk** from the bottom of the sidebar. The page scrolls with the mouse wheel.
- [ ] Topics are in groups: Work, Daily life, Friends, Family, Travel.
- [ ] Pick level B1, B2 or C1. Reload: the level is remembered.
- [ ] Open a topic you never opened ("New" on the right). It shows "Making…", then opens within about a minute.
- [ ] Go back and open it again: it opens at once (no "Making…").
- [ ] The **shuffle** button (next to **+ New**) opens a random topic.
- [ ] Make your own topic (for example "Ask my neighbor to turn the music down"). It opens.
- [ ] On a topic: open Set 1, check the phrases sound natural and the meanings are simple English.
- [ ] **Hide** a phrase that sounds odd. It goes gray. **Bring back** works.
- [ ] Delete a custom topic (button at the bottom). It is gone from the list.

## 2. Learn

- [ ] Tap **Learn** on a set. Cards show the phrase, IPA, meaning and example. The speaker icon reads it.
- [ ] **Start** → Match: tap a phrase, then its meaning. A wrong pick flashes red.
- [ ] Recall: fill the blank in the example. **Hint** shows first letters.
- [ ] Recall: "Say the phrase that means…": the mic works, or type it.
- [ ] Answer one wrong on purpose: it comes back a few items later.
- [ ] The end shows "Set learned" and the hardest phrases. The set now shows "x/10 learned".
- [ ] Leave in the middle of Recall (go back to the topic). Open **Learn** on that set again: "Picked up where you left off: Recall n/N", no cards and no Match. **Start over** goes back to the cards.

## 3. Talk (one answer)

- [ ] Tap **Talk** on a set. A situation card shows a few facts. The other person's line is read out loud.
- [ ] **Ideas** shows short notes (not full sentences). **Phrases** shows phrases of the set.
- [ ] Tap the mic (or Space), answer, tap again (or Space) to send. "Checking your answer…" takes about 5 seconds or less.
- [ ] **Most important:** say a sentence with mistakes on purpose ("Yesterday I go to work and I meet my boss").
      **You said** must keep "go" and "meet" (not fixed). The mistakes are marked.
- [ ] **Show answer** shows Correct / Natural / Level up. Each fix matches the Correct version.
- [ ] Correct English is not marked as a mistake.
- [ ] **I said it right** removes a fix (use it when the speech-to-text heard you wrong).
- [ ] **Say it again** gives a % and gray boxes on missed words.
- [ ] A phrase you used gets a ✓ in the list under the talk.

## 4. Talk (controls)

- [ ] While recording, **Cancel (Esc)** drops the answer. Nothing is checked.
- [ ] While "Checking…", **Cancel (Esc)** goes back to answering.
- [ ] On a review, **Try again** asks the same line again.
- [ ] Leave the talk halfway (go back to the topic). Open **Talk** again: "Picked up where you left off." and the same line. No waiting.
- [ ] **New talk** starts a different situation.
- [ ] **End talk** goes to the summary.
- [ ] Turn on **Flow** before the first answer: no review between answers, all reviews at the end.
- [ ] Turn off **Fix it yourself first**: the answer shows at once.
- [ ] At B2 or C1, one line in the talk is marked **curveball** (a push back or a misunderstanding).

## 5. End of a talk

- [ ] The summary shows phrases used, words per answer, words per minute and top fixes.
- [ ] "Making your notes…" turns into **Next time**, **Missed chances**, **Better words** and **Closing drill**.
- [ ] Better words only uses words you really said.
- [ ] Closing drill: the idea does not give the answer away. Say it, get a %.
- [ ] Open the same talk again (or reload): the notes show at once, no "Making your notes…".
- [ ] **Your answers**: tap one to see its full review.

## 6. Mistake bank and warm-up

- [ ] After one finished talk, open **Review > Mistakes**: a **Talk** section lists mistake types (Verb tense...). Tap one to see examples.
- [ ] Start a **new** talk: it begins with a **Warm-up** on your own old mistakes. **Skip** works.
- [ ] Fix one right: Mistakes shows its streak "1/5 right".

## 7. Stuck box

- [ ] In Talk, tap **+ New**, then in "Got stuck? Note it here": type a sentence you could not say (any language), **Save**.
- [ ] **Saved (n)** opens the list. The X deletes one.

## 8. Meeting prep and stuck lines

- [ ] Make your own topic, tap **+ Add your notes**, paste real notes (an agenda or a ticket). The situations use your facts (names, numbers).
- [ ] In a talk on that topic, **Your notes** shows above the talk.
- [ ] Save 2-3 stuck lines, tap **Practice these (n)**. A topic "Things I got stuck on" opens; its situations make you say those things.
- [ ] Back on Talk, those lines are gray in the list and the button is gone until you save new ones.

## 9. Quick mode, redo, this week

- [ ] Before the first answer, turn on **Quick: 3 answers**. The talk shows "Turn 1/3" and ends after 3 answers.
- [ ] At the end, **Talk this again** starts the same situation. After it, **Last time → now** compares the two (✓ where you did better).
- [ ] The top of Talk shows **This week**: streak, talks, minutes, words per minute, and your most common mistakes.
- [ ] Practice on two days in a row: the streak shows 2 days.

## 10. Buy time and starred phrases

- [ ] In a talk, **Buy time** shows phrases like "Let me think for a second."
- [ ] Say "uh" or "um" in an answer: the summary shows **uh/um per answer** above 0.
- [ ] On a topic, open a set and tap the **star** on a phrase. It fills in.
- [ ] In **Review > Starred**, it is listed with its level (Learning, Known, Used with help, Yours).

## 11. Help, answer order, Anki

- [ ] In a talk, **Help**: type your idea in simple words, **Get words**. You get 2-3 short word groups, not a full sentence.
- [ ] On a work topic (incident, standup), give a long answer with the main point at the end: the review shows an **order** note.
- [ ] In an open set, **Export to Anki** downloads a .txt file. Open it: each card has the phrase in **bold** in the example.

## 12. Drills

- [ ] **60 · 45 · 30**: answer the same question 3 times. Each round stops by itself at its time. A table shows words, words per minute and uh/um.
- [ ] **Read and retell**: paste a real Slack thread or PR, **Read it**, **Hide it and tell me**. You get key points (✓/✗), what you said, a natural retell and fixes.
- [ ] **Retell from a lesson**: open a lesson, ⋮ menu, **Retell**. The text is hidden, **Show text** shows it. **Tell it**, record, get key points. A long lesson shows time chips (e.g. 0:00-3:10); each chip is its own part. No **New text** button.
- [ ] **Retell from Lesson complete**: finish a lesson, the modal shows **Retell it**. It opens Retell; closing it keeps the lesson.
- [ ] **Time Capsule**: record once. It says "This month is saved". The month shows with an audio player you can play.

## 13. Voice

- [ ] Before turning on the Text-to-Speech API: lines are read by the browser voice, no errors.
- [ ] After turning it on (MANUAL-talk.md step 5): reload, the partner sounds like a real person. Starting to record stops the voice.

## 14. Conversation and layout

- [ ] In an 8-answer talk: line 2 shares something and shows "Your turn: react or add your view"; line 4 shows "Your turn: ask them something".
- [ ] Ask the partner a question in an answer: the next line answers it first.
- [ ] **Stuck?** opens one panel with Ideas, Phrases, Buy time and Help.
- [ ] The Talk page is short: level and buttons on one line, "This week" on one line, topics in tabs. The tab you pick is remembered.

## 15. Feels like a real person

- [ ] Say something wrong on purpose ("Yesterday I go to the office"): the next line repeats it the right way ("Oh, you went in yesterday?") without calling it a mistake.
- [ ] Answer in 2-3 words: the partner asks for a bit more.
- [ ] Answer with many "uh/um": the partner starts with "No rush" or "Take your time".
- [ ] Share something personal in a talk (a trip, a plan). After the talk, the topic page shows "[name] remembers: ...". Start a new talk on that topic: they bring it up. **Forget** clears it.
- [ ] The replies sound spoken (short, "Oh", "Hmm") and fit the time of day.

## 16. Phone and Mac layout (new)

- [ ] iPhone: Recall's mic works; after you speak you see "Heard: ..." or a reason (blocked, nothing heard). Same for the mic next to Next in a review.
- [ ] iPhone: in a talk the mic, and in a review Try again / mic / Next, stay at the bottom without scrolling.
- [ ] The review fits one screen: your words, Correct · Natural · Level up (Natural first), "n fixes ▸".
- [ ] A turn with no mistakes shows "No mistakes ✓" and no Correct tab.
- [ ] Mac: the talk is two columns; keys Space, Enter, R, 1-3 and Esc work; iPhone shows no key hints.
- [ ] The speaker icon plays right away every time, with the same voice. On iPhone it plays at all.
- [ ] iPhone home-screen app: nothing hides under the status bar at the top.

## 17. Goal, ratings, connection

- [ ] During a talk, the bottom line shows "Goal: use 3 phrases · n/3" and a ✓ when reached.
- [ ] Before the final answer you see "Last answer" (top right and under the line). Reaching the goal early shows "Goal reached. Keep going or End now."
- [ ] The summary starts with Accuracy, Fluency and Phrases (●●● Strong / ●●○ Good / ●○○ Keep practicing) and the numbers.
- [ ] Turn off Wi-Fi, answer, turn it back on: you see "Connection problem" and Send again works without saying it again.
- [ ] No long dashes in what the partner says; earlier lines are easy to read; the talk page does not scroll when it fits.

## 18. Theme and phone

- [ ] Light and dark theme: all text is easy to read, buttons are black/white like the rest of noda.
- [ ] On a phone: the page fits, the mic works, nothing is cut off.

---

## Notes

(write here)
