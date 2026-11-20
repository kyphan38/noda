# Talk: things only you can do

Claude builds, tests, deploys and pushes everything else. These steps need you
(your Google account, your Anki, your voice). Tick them when done.

---

## 1. Test the app

- [ ] Go through [TESTING-talk.md](TESTING-talk.md) section by section, when you have time.
      Write notes at the bottom of that file and send it back.

## 2. Send phrases to Anki

Needs Anki open on your Mac, with the AnkiConnect add-on.

- [ ] On a topic, open a set, tap **Export to Anki (.txt for /anki-import)**. A `.txt` file downloads.
- [ ] In Claude Code, run `/anki-import` with that file (for example `/anki-import ~/Downloads/noda-talk-daily-standup-set1.txt`).
- [ ] Phrases that are already "Yours" are not in the file, so you only review what you still need.

## 3. Time Capsule each month

- [ ] Once a month, open Talk → Drills → **Time Capsule** and record one minute. After a few months, play the old ones.

## 4. Natural voice (Chirp 3 HD)

The code is live. Until this API is on, the AI partner falls back to your
browser's voice. The Google voice (Chirp 3 HD) needs one API turned on in your Google Cloud project. It is
free for the first 1M characters each month; Talk uses about 200-300k.

- [ ] Open https://console.cloud.google.com/apis/library/texttospeech.googleapis.com?project=kyphan38-noda-app
- [ ] Click **Enable**.
- [ ] Wait a minute, then reload Talk. The partner's voice should now sound like a real person.
      Nothing else to do: the app tries Chirp first and uses the browser voice only when Chirp is off.

---

## Notes

(write here)
