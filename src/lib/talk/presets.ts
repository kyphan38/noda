// noda - Talk: built-in topics. Phrases are made by the talkTopic function on first open.

export type TalkPreset = { id: string; title: string; description: string };

export const TALK_PRESETS: TalkPreset[] = [
  { id: 'one-on-one', title: '1:1 with your manager', description: 'Talk about your recent work, blockers, career goals and feedback.' },
  { id: 'standup', title: 'Daily standup', description: 'Say what you did yesterday, what you do today and what blocks you.' },
  { id: 'incident', title: 'Production incident', description: 'Report an outage: impact, cause, the fix and next steps.' },
  { id: 'code-review', title: 'Code review', description: 'Give and answer review comments on a pull request, politely and clearly.' },
  { id: 'interview', title: 'Backend job interview', description: 'Introduce yourself, explain past projects and system design choices.' },
  { id: 'small-talk', title: 'Small talk before a call', description: 'Weekend, weather, travel and casual chat while people join.' },
  { id: 'push-back', title: 'Say no politely', description: 'Disagree with an idea or refuse a request without sounding rude.' },
  { id: 'explain-pm', title: 'Explain tech to a PM', description: 'Explain a technical problem and its trade-offs in simple words.' },
  { id: 'estimate', title: 'Estimate a task', description: 'Give an estimate, explain risks and what could make it slip.' },
  { id: 'late-leave', title: 'Running late or taking leave', description: 'Tell the team you are late, sick or taking days off.' },
];

/** Firestore id of a preset topic: one copy per level. */
export function presetTopicId(presetId: string, level: string): string {
  return `${presetId}-${level.toLowerCase()}`;
}
