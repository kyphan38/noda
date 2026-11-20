// noda - Talk: built-in topics, from work (DevOps) to everyday life. Phrases and
// situations are made by the talkTopic function on first open.

export const TALK_CATEGORIES = ['Work', 'Daily life', 'Friends', 'Family', 'Travel'] as const;
export type TalkCategory = (typeof TALK_CATEGORIES)[number];

export type TalkPreset = { id: string; category: TalkCategory; title: string; description: string };

export const TALK_PRESETS: TalkPreset[] = [
  { id: 'incident', category: 'Work', title: 'Production incident', description: 'Report an outage on a call: impact, cause, the fix and next steps.' },
  { id: 'on-call', category: 'Work', title: 'On-call handover', description: 'Hand over alerts, open issues and risks to the next on-call person.' },
  { id: 'postmortem', category: 'Work', title: 'Postmortem meeting', description: 'Walk through a timeline, root cause and action items without blame.' },
  { id: 'pipeline', category: 'Work', title: 'Broken CI/CD pipeline', description: 'Explain why builds or deploys fail and what you are doing about it.' },
  { id: 'standup', category: 'Work', title: 'Daily standup', description: 'Say what you did, what you do today and what blocks you.' },
  { id: 'change', category: 'Work', title: 'Plan a risky change', description: 'Propose an infra change, its risks, rollback plan and timing.' },
  { id: 'dev-request', category: 'Work', title: 'Requests from developers', description: 'Answer, push back on or plan requests for access, environments or tools.' },
  { id: 'one-on-one', category: 'Work', title: '1:1 with your manager', description: 'Talk about your work, blockers, growth and feedback.' },
  { id: 'interview', category: 'Work', title: 'Job interview', description: 'Introduce yourself and explain past systems, tools and choices.' },

  { id: 'doctor', category: 'Daily life', title: 'At the doctor', description: 'Describe how you feel, answer questions and ask about treatment.' },
  { id: 'return-item', category: 'Daily life', title: 'Return something you bought', description: 'Explain the problem with an item and ask for a refund or swap.' },
  { id: 'restaurant', category: 'Daily life', title: 'Eating out', description: 'Book a table, order, ask about dishes and sort out a wrong order.' },
  { id: 'landlord', category: 'Daily life', title: 'Talk to your landlord', description: 'Report a repair, ask about rent and agree on a time.' },
  { id: 'phone-plan', category: 'Daily life', title: 'Call customer service', description: 'Fix a bill, change a plan or cancel a service on the phone.' },

  { id: 'small-talk', category: 'Friends', title: 'Small talk', description: 'Weekend, weather, news and casual chat with someone you know a little.' },
  { id: 'catch-up', category: 'Friends', title: 'Catch up with a friend', description: 'Share what is new in your life and ask about theirs.' },
  { id: 'weekend-plans', category: 'Friends', title: 'Make weekend plans', description: 'Suggest plans, agree on a time and place, or say no nicely.' },
  { id: 'new-people', category: 'Friends', title: 'Meet new people', description: 'Introduce yourself at a party or event and keep the talk going.' },
  { id: 'disagree-friend', category: 'Friends', title: 'Disagree with a friend', description: 'Share a different opinion kindly and find a middle ground.' },

  { id: 'family-plans', category: 'Family', title: 'Plan with your partner', description: 'Talk about money, chores, holidays or a big decision at home.' },
  { id: 'family-dinner', category: 'Family', title: 'Family dinner', description: 'Talk about your day, share news and ask about everyone else.' },
  { id: 'kids-school', category: 'Family', title: 'Meet a teacher', description: 'Ask how your child is doing and talk about worries at school.' },

  { id: 'airport', category: 'Travel', title: 'Airport problems', description: 'Check in, handle a delay, a missed flight or lost bag.' },
  { id: 'hotel', category: 'Travel', title: 'Hotel check-in and complaints', description: 'Check in, ask for things and complain politely about your room.' },
  { id: 'directions', category: 'Travel', title: 'Ask for help in a new city', description: 'Ask for directions, tickets and local tips.' },
];

/** Firestore id of a preset topic: one copy per level. */
export function presetTopicId(presetId: string, level: string): string {
  return `${presetId}-${level.toLowerCase()}`;
}

/** "Surprise me": any topic from any category. */
export function randomPreset(random: () => number = Math.random): TalkPreset {
  return TALK_PRESETS[Math.floor(random() * TALK_PRESETS.length)];
}
