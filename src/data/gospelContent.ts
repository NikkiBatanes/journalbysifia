export const GOSPEL_CONTENT_VERSION = '2026-09-24.44';

export type GospelPage = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  references?: string[];
  scriptures?: Array<{ ref: string; text: string }>;
  truths?: Array<{ title: string; text: string; ref: string }>;
  points?: Array<{ title: string; body: string; reference?: string; subtitle?: string }>;
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
    note: 'The Gospel speaks to a decision with eternal significance.',
    cta: 'Begin',
  },
  {
    id: 'love',
    eyebrow: 'TRUTH 1',
    title: 'God loves you and desires that you…',
    body: 'His desire for you includes both:',
    truths: [
      {
        title: 'Have eternal life with Him',
        text: 'For God loved the world so much that he gave his only Son, so that everyone who believes in him may not perish but have eternal life.',
        ref: 'John 3:16',
      },
      {
        title: 'Have an abundant and meaningful life with Him',
        text: 'Jesus said He came that we might have life in all its fullness.',
        ref: 'John 10:10',
      },
    ],
    cta: 'But there is a problem →',
  },
  {
    id: 'sin',
    eyebrow: 'TRUTH 2',
    title: 'We have a sin problem that separates us from God.',
    body: '',
    points: [
      { title: 'Everyone has sinned.', body: 'everyone has sinned and is far away from God’s saving presence.', reference: 'Romans 3:23' },
    ],
    cta: 'Continue',
  },
  {
    id: 'death',
    eyebrow: 'OUR PROBLEM',
    title: 'The penalty of sin is death.',
    body: '',
    points: [
      { title: 'For sin pays its wage—death;', body: '', reference: 'Romans 6:23a' },
    ],
    cta: 'Kinds of death →',
  },
  {
    id: 'death-kinds',
    eyebrow: 'THE CONSEQUENCE',
    title: 'The Bible talks about different kinds of death.',
    body: '',
    points: [
      { title: 'Physical death', body: 'Everyone must die once, and after that be judged by God.', reference: 'Hebrews 9:27' },
      { title: 'Spiritual death', subtitle: '— eternal separation from God', body: 'But cowards, traitors, perverts, murderers, the immoral, those who practice magic, those who worship idols, and all liars—the place for them is the lake burning with fire and sulfur, which is the second death.', reference: 'Revelation 21:8' },
    ],
    cta: 'Is there a solution? →',
  },
  {
    id: 'effort',
    eyebrow: '',
    title: 'Can we make ourselves right with God?',
    body: 'We often think that…',
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
    eyebrow: 'TRUTH 3',
    title: "Jesus Christ is God's only way to eternal life.",
    body: 'He completely paid the penalty of our sins.',
    scriptures: [
      { ref: '1 Peter 3:18', text: 'For Christ died for sins once and for all, a good man on behalf of sinners, in order to lead you to God.' },
    ],
    cta: 'Why?',
  },
  {
    id: 'only-way',
    eyebrow: '',
    title: 'He is the only way.',
    body: '',
    centered: true,
    scriptures: [
      { ref: 'John 14:6', text: 'Jesus answered him, “I am the way, the truth, and the life; no one goes to the Father except by me.”' },
    ],
  },
  {
    id: 'risen',
    eyebrow: '',
    title: 'Jesus rose from the dead.',
    body: 'His resurrection proves that He is the Son of God, the Messiah, the only Savior.',
    centered: true,
    scriptures: [
      { ref: 'Romans 1:3–4', text: 'It is about his Son, our Lord Jesus Christ: as to his humanity, he was born a descendant of David; as to his divine holiness, he was shown with great power to be the Son of God by being raised from death.' },
    ],
    cta: 'What does this mean for me? →',
  },
  {
    id: 'faith',
    eyebrow: 'TRUTH 4',
    headerTitle: 'The Gospel',
    title: 'We must place our faith in Jesus Christ to save us.',
    body: 'Merely knowing what Christ has done is not enough.',
    scriptures: [
      { ref: 'Ephesians 2:8-9', text: 'For it is by God’s grace that you have been saved through faith. It is not the result of your own efforts, but God’s gift, so that no one can boast about it.' },
    ],
  },
  {
    id: 'faith-followup',
    eyebrow: '',
    title: 'We are saved by God’s grace through faith in Jesus Christ alone.',
    body: '',
  },
  {
    id: 'understanding',
    eyebrow: 'THINK ABOUT IT',
    headerTitle: 'Grace & faith',
    title: 'Which one is true?',
    body: '',
    eyebrowCentered: true,
    centered: true,
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
    scriptures: [
      { ref: 'Romans 6:23', text: 'For sin pays its wage—death; but God’s free gift is eternal life in union with Christ Jesus our Lord.' },
      { ref: 'Colossians 1:13–14', text: 'He rescued us from the power of darkness and brought us safe into the kingdom of his dear Son, by whom we are set free, that is, our sins are forgiven.' },
    ],
  },
];

export const GOSPEL_PRAYER =
  'Lord Jesus, thank You so much for loving me. I confess that I have sinned against you. Thank You for dying on the cross for my sins. Today, I put my trust in You as my Lord and Savior. I accept Your free gift of eternal life and I surrender my life to You. Thank You for forgiving my sins. From this day on, I choose to follow You. Amen.';

export const GOSPEL_RESPONSE_ASSURANCE = {
  promise: 'God promised that you can know today that you have eternal life when you trust in Jesus.',
  scripture: {
    ref: '1 John 5:11–12',
    text: 'The testimony is this: God has given us eternal life, and this life has its source in his Son. Whoever has the Son has this life; whoever does not have the Son of God does not have life.',
  },
  consequence: 'This will determine your eternal destiny.',
  question: 'Are you willing to make the decision to trust and follow Jesus as your Lord and Savior?',
} as const;

export const LISTEN_FIRST_QUESTIONS = [
  'When you think about God, what comes to mind?',
  'What do you believe about Jesus?',
  'If God asked, “Why should I let you into heaven?” what would you say?',
] as const;
