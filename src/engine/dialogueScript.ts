import type { DialoguePrompt, GestureKind } from '../types/mote';

export const OPENING_MESSAGE = 'Move through the dust';

export const DIALOGUE_PROMPTS: DialoguePrompt[] = [
  {
    id: 'who',
    label: 'Who are you?',
    beats: [
      'Just loose light and patience',
      'Wait—and I become words',
    ],
  },
  {
    id: 'how',
    label: 'How do you move?',
    beats: [
      'Every mote drifts on its own',
      'Until your hand gives it gravity',
    ],
  },
  {
    id: 'secret',
    label: 'Tell me a secret',
    beats: [
      'Nothing stays written for long',
      'Even stone is just slow dust',
    ],
  },
  {
    id: 'touch',
    label: 'What happens if I click?',
    beats: [
      'Touch scatters the thought',
      'Silence gathers it again',
    ],
  },
  {
    id: 'paragraph',
    label: 'Form a paragraph',
    beats: [
      'Every grain drifts freely across the dark until an invisible shape gives it gravity. Sweep your hand through the letters to break their hold, then watch them fall quietly back into form.',
    ],
  },
];

export const CLICK_CYCLE_BEATS: string[] = [
  'Move through the dust',
  'Every ripple leaves a trace',
  'Hold still to draw us near',
  'Type anything to sculpt the air',
  'Nothing here is fixed in ink',
];

const GESTURE_REPLIES: Record<GestureKind, string[]> = {
  'fast-swipe': [
    "Easy—you'll scatter the thought",
    'Too fast, let us settle',
    'A sudden wind breaks the line',
  ],
  'vortex-release': [
    'Drawn into orbit, then set free',
    'Back into form from the swirl',
  ],
  'tap-burst': [
    'Every tap sends a wave',
    'Careful—that stirs the whole room',
  ],
  idle: [
    'Still there?',
    'Type below, or stir the air',
  ],
};

let gestureCursor = 0;

export function pickGestureReply(kind: GestureKind): string {
  const options = GESTURE_REPLIES[kind];
  const chosen = options[gestureCursor % options.length];
  gestureCursor += 1;
  return chosen;
}

const KEYWORD_RULES: Array<{ pattern: RegExp; beats: string[] }> = [
  {
    pattern: /\b(hi|hello|hey|greetings|morning|evening)\b/i,
    beats: ['Hello, visitor', 'Move closer—the air is listening'],
  },
  {
    pattern: /\b(who|name|what are you)\b/i,
    beats: ['Only drifting motes', 'Given a voice by your cursor'],
  },
  {
    pattern: /\b(why|meaning|purpose)\b/i,
    beats: ['To show how fleeting words are', 'Until someone reads them'],
  },
  {
    pattern: /\b(time|forever|always|stay|wait)\b/i,
    beats: ['Time scatters everything', 'Yet form returns again'],
  },
  {
    pattern: /\b(love|heart|miss|feel)\b/i,
    beats: ['Some thoughts cling closer', 'Like dust in warm light'],
  },
  {
    pattern: /\b(star|space|sky|universe|night|light)\b/i,
    beats: ['All light begins as scattered grain', 'Gathered across the dark'],
  },
  {
    pattern: /\b(bye|goodbye|leave|later)\b/i,
    beats: ['Drift gently', 'We will be here in the air'],
  },
  {
    pattern: /\b(quiet|silence|calm|peace)\b/i,
    beats: ['Listen closely', 'Even stillness is in motion'],
  },
  {
    pattern: /\?$/,
    beats: ['Ask the air again', 'Every answer dissolves into dust'],
  },
];

export function generateDialogueReply(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return ['Speak a word to shape the air'];
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(trimmed)) {
      return rule.beats;
    }
  }

  // If short input without keyword match, echo first then answer poetically
  if (trimmed.length <= 28) {
    return [trimmed, 'Held briefly in the dust'];
  }

  return ['Your words drift through the field', 'And settle where light catches'];
}
