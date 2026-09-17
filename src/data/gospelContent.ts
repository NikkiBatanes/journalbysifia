export const GOSPEL_CONTENT_VERSION = '2026-09-18.1';

export type GospelPage = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  references?: string[];
  points?: Array<{ title: string; body: string }>;
};

/**
 * Canonical, versioned copy shared by every in-app Gospel entry point.
 * Keep theological copy changes intentional and bump GOSPEL_CONTENT_VERSION.
 */
export const GOSPEL_PAGES: GospelPage[] = [
  {
    id: 'intro',
    eyebrow: 'BEGIN HERE',
    title: "What is the best decision you've made in your life?",
    body: 'Some decisions are simple. Some are significant. Some change the direction of our lives. The Gospel speaks to a decision with eternal significance.',
  },
  {
    id: 'love',
    eyebrow: 'TRUTH 1',
    title: 'God loves you and desires that you have eternal life with Him.',
    body: 'The good news begins with God and His love. Jesus also came that we might have life in all its fullness.',
    references: ['John 3:16', 'John 10:10'],
  },
  {
    id: 'sin',
    eyebrow: 'TRUTH 2',
    title: 'We have a sin problem that separates us from God.',
    body: "Everyone has sinned. All of us fall short of God's standard.",
    references: ['Romans 3:23'],
  },
  {
    id: 'death',
    eyebrow: 'THE CONSEQUENCE',
    title: 'The penalty of sin is death.',
    body: 'Scripture speaks of physical death and spiritual death, eternal separation from God.',
    references: ['Romans 6:23', 'Hebrews 9:27'],
  },
  {
    id: 'effort',
    eyebrow: 'WHAT DO WE TRY?',
    title: 'Can we make ourselves right with God?',
    body: 'There is one solution from God.',
    points: [
      { title: 'Religion', body: 'Religious activity cannot pay the penalty for sin.' },
      { title: 'Good works', body: 'Our good deeds cannot erase our guilt.' },
      { title: 'Good morals', body: 'Trying to be moral cannot become our salvation.' },
    ],
  },
  {
    id: 'jesus',
    eyebrow: 'TRUTH 3',
    title: "Jesus Christ is God's only way to eternal life.",
    body: 'He completely paid the penalty of our sins. Jesus is the way to the Father.',
    references: ['1 Peter 3:18', 'John 14:6'],
  },
  {
    id: 'risen',
    eyebrow: 'HE IS RISEN',
    title: 'Jesus rose from the dead.',
    body: 'His resurrection declares Him to be the Son of God with power.',
    references: ['Romans 1:3–4'],
  },
  {
    id: 'faith',
    eyebrow: 'TRUTH 4',
    title: 'We must place our faith in Jesus Christ to save us.',
    body: "Merely knowing what Christ has done is not enough. Salvation is God's gift, received by grace through faith in Jesus Christ, not the result of our efforts.",
    references: ['Ephesians 2:8–9'],
  },
  {
    id: 'understanding',
    eyebrow: 'THINK ABOUT IT',
    title: 'Which one is true?',
    body: 'Faith in Jesus + nothing from us = salvation, leading to good works. Good works are not the means of salvation. They are evidence of a life changed by faith.',
  },
  {
    id: 'trust',
    eyebrow: 'FAITH IN JESUS',
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

