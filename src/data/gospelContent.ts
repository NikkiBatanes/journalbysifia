export const GOSPEL_CONTENT_VERSION = '2026-09-18.11';

export type GospelPage = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  references?: string[];
  scriptures?: Array<{ ref: string; text: string }>;
  points?: Array<{ title: string; body: string; reference?: string }>;
  choices?: Array<{ text: string; detail?: string; correct?: boolean; feedback?: string }>;
  note?: string;
  noteCentered?: boolean;
  cta?: string;
  centered?: boolean;
  eyebrowCentered?: boolean;
  serifTitle?: boolean;
  headerTitle?: string;
};

/**
 * Canonical, versioned copy shared by every in-app Gospel entry point.
 * Keep theological copy changes intentional and bump GOSPEL_CONTENT_VERSION.
 */
export const GOSPEL_PAGES: GospelPage[] = [
  {
    id: 'intro',
    eyebrow: 'BEGIN HERE',
    headerTitle: 'For me',
    title: "What is the best decision you've made in your life?",
    body: 'Some decisions are simple. Some are significant. Some change the direction of our lives.',
    centered: true,
    serifTitle: true,
    note: 'The Gospel speaks to a decision with eternal significance.',
    cta: 'Begin →',
  },
  {
    id: 'love',
    eyebrow: 'TRUTH 1',
    title: 'God loves you and desires that you have eternal life with Him.',
    body: 'The good news begins with God and His love.',
    scriptures: [
      { ref: 'John 3:16', text: 'For God loved the world so much that he gave his only Son, so that everyone who believes in him may not perish but have eternal life.' },
    ],
    points: [
      { title: 'An abundant and meaningful life with Him', body: 'Jesus said He came that we might have life in all its fullness.', reference: 'John 10:10' },
    ],
    cta: 'But there is a problem →',
  },
  {
    id: 'sin',
    eyebrow: 'TRUTH 2',
    title: 'We have a sin problem that separates us from God.',
    body: '',
    points: [
      { title: 'Everyone has sinned.', body: "All of us fall short of God's standard.", reference: 'Romans 3:23' },
    ],
  },
  {
    id: 'death',
    eyebrow: 'OUR PROBLEM',
    title: 'The penalty of sin is death.',
    body: '',
    points: [
      { title: 'Sin has a real consequence.', body: 'We cannot treat our separation from God as something we can simply ignore.', reference: 'Romans 6:23 · Hebrews 9:27' },
    ],
    cta: 'Is there a solution? →',
  },
  {
    id: 'effort',
    eyebrow: 'OUR PROBLEM',
    title: 'Can we make ourselves right with God?',
    body: '',
    points: [
      { title: 'Religion', body: 'Religious activity cannot pay the penalty for sin.' },
      { title: 'Good works', body: 'Our good deeds cannot erase our guilt.' },
      { title: 'Good morals', body: 'Trying to be moral cannot become our salvation.' },
    ],
    note: 'There is only one solution from God.',
    cta: "See God's solution →",
  },
  {
    id: 'jesus',
    eyebrow: 'THE GOSPEL',
    title: "Jesus Christ is God's only way to eternal life.",
    body: 'He completely paid the penalty of our sins.',
    scriptures: [
      { ref: '1 Peter 3:18', text: 'Christ died for sins once for all, the righteous for the unrighteous, to bring us to God.' },
    ],
    points: [
      { title: 'Jesus is the way.', body: 'No one comes to the Father except through Him.', reference: 'John 14:6' },
    ],
  },
  {
    id: 'risen',
    eyebrow: 'HE IS RISEN',
    headerTitle: 'Jesus',
    title: 'Jesus rose from the dead.',
    body: 'His resurrection declares Him to be the Son of God with power.',
    centered: true,
    serifTitle: true,
    scriptures: [
      { ref: 'Romans 1:3-4', text: 'He was shown with great power to be the Son of God by being raised from death.' },
    ],
    cta: 'What does this mean for me? →',
  },
  {
    id: 'faith',
    eyebrow: 'TRUTH 4',
    headerTitle: 'The Gospel',
    title: 'We must place our faith in Jesus Christ to save us.',
    body: 'Merely knowing what Christ has done is not enough.',
    serifTitle: true,
    scriptures: [
      { ref: 'Ephesians 2:8-9', text: "For it is by God's grace that you have been saved through faith — and this is not from yourselves, it is the gift of God — not by works, so that no one can boast." },
    ],
    note: "We are saved by God's grace through faith in Jesus Christ alone.",
    noteCentered: false,
  },
  {
    id: 'understanding',
    eyebrow: 'THINK ABOUT IT',
    headerTitle: 'Grace & faith',
    title: 'Which one is true?',
    body: '',
    eyebrowCentered: true,
    serifTitle: true,
    choices: [
      { text: 'Faith in Jesus + good works = salvation', feedback: "Not quite — good works follow salvation; they don't earn it. The other answer is the Gospel." },
      { text: 'Faith in Jesus + nothing from us = salvation', detail: 'leading to good works', correct: true, feedback: "Yes — that's the Gospel. Salvation is God's gift, received by faith alone." },
    ],
    note: 'Good works are not the means to salvation. They are evidence of a life changed by faith.',
    noteCentered: false,
  },
  {
    id: 'trust',
    eyebrow: 'RESPONDING',
    title: 'What does trusting Jesus look like?',
    body: '',
    points: [
      { title: 'Turn from sin', body: 'Be willing to turn away from sin.' },
      { title: 'Trust Jesus', body: 'Trust Him for your forgiveness.' },
      { title: 'Receive His gift', body: "Receive God's free gift of eternal life in Christ." },
    ],
  },
];

export const GOSPEL_PRAYER =
  'Lord Jesus, thank You for loving me. I confess that I have sinned against You. Thank You for dying for my sins. Today I put my trust in You as my Lord and Savior. I receive Your gift of eternal life and surrender my life to You. Thank You for forgiving me. From this day on, I choose to follow You. Amen.';

export const LISTEN_FIRST_QUESTIONS = [
  'When you think about God, what comes to mind?',
  'What do you believe about Jesus?',
  'If God asked, “Why should I let you into heaven?” what would you say?',
] as const;

