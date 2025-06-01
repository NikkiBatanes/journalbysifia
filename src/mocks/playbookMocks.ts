export const mockPlaybooks = [
  {
    id: '1',
    title: "It's Not Too Late: God's Timing is Perfect",
    userInput: 'I want to be a tech entrepreneur but I feel like I am too late. I am 35',
    truthInLove: {
      truth: "You're not too late; you're just stuck in a mindset of fear and comparison. God's purpose for your life isn't bound by age, but by your obedience and faith. At 35, you have the maturity, wisdom, and life experience that many younger entrepreneurs lack. Stop using age as an excuse to delay action. The real issue isn't your age—it's your belief in God's ability to work through you.",
      summary: "God's timing is perfect; trust Him and take bold, obedient action."
    },
    actionSteps: [
      { id: 'a1', text: 'Reflect on Biblical figures like Moses (called at 80) and Abraham (promised a son at 75).', completed: false },
      { id: 'a2', text: 'Write down three ways your age and experience are assets, not liabilities.', completed: false },
      { id: 'a3', text: 'Identify one tech problem you\'re passionate about solving and research the market.', completed: false },
      { id: 'a4', text: 'Begin with a minimum viable product (MVP) to test your concept.', completed: false },
      { id: 'a5', text: 'Reach out to mentors, peers, and industry professionals for advice and connections.', completed: false },
      { id: 'a6', text: 'Enroll in online courses or attend workshops to sharpen your skills.', completed: false },
      { id: 'a7', text: 'Create a 90-day action plan with specific, measurable goals.', completed: false }
    ],
    affirmation: "God's timing is perfect, and I am right where I need to be. I am equipped with wisdom, experience, and faith to succeed. I trust God to guide my steps and bless my efforts.",
    bibleVerse: {
      text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.",
      reference: "Jeremiah 29:11"
    },
    directChallenge: "This week, write down your tech business idea and share it with three trusted people for feedback. Commit to taking one concrete step—whether it's researching, networking, or building a prototype—by the end of the week. No excuses.",
    progress: 2,
    totalTasks: 7
  },
  {
    id: '2',
    title: "Overcoming Fear: Faith in Action, Not Hesitation",
    userInput: 'I am having doubts, procrastination and fear.',
    truthInLove: {
      truth: "Doubt, procrastination, and fear are not from God—they are tools of the enemy to keep you stagnant and ineffective. Fear thrives when you focus on your limitations instead of God's power. Procrastination is disobedience in disguise, and doubt is a lack of trust in God's promises. You're not stuck because you're incapable; you're stuck because you're letting fear dictate your actions instead of faith.",
      summary: "Fear is not from God; act in faith and trust His power, not yours."
    },
    actionSteps: [
      { id: 'b1', text: 'Write down your specific fears and doubts. Be brutally honest.', completed: false },
      { id: 'b2', text: 'For each fear, write a counter-truth grounded in God\'s Word.', completed: false },
      { id: 'b3', text: 'Set a timer for 15 minutes and work on one small task related to your goal.', completed: false },
      { id: 'b4', text: 'Meditate on Joshua 1:9 daily.', completed: false },
      { id: 'b5', text: 'Share your struggles with a trusted friend or mentor.', completed: false },
      { id: 'b6', text: 'Write a vision statement for your goals and read it daily.', completed: false }
    ],
    affirmation: "God has not given me a spirit of fear, but of power and love. I am capable because God is with me. I will take action today, trusting God to guide my steps.",
    bibleVerse: {
      text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.",
      reference: "Joshua 1:9"
    },
    directChallenge: "Today, take one bold action that scares you. Whether it's reaching out to a potential mentor, starting your business plan, or learning a new skill, do it without overthinking.",
    profileImage: 'https://randomuser.me/api/portraits/women/22.jpg',
    progress: 1,
    totalTasks: 6
  },
  {
    id: '3',
    title: "Living with Purpose: Stop Drifting, Start Driving",
    userInput: 'I dont know where to start my journey in life. I am in school but I feel like Im just going with the flow.',
    truthInLove: {
      truth: "You're not lost; you're just unaligned with God's purpose for your life. Drifting through life is a choice, not a condition. The hard truth? You're avoiding the responsibility of seeking clarity because it's easier to 'go with the flow' than to wrestle with the big questions. God didn't create you to be passive—He created you to live intentionally, with purpose and impact.",
      summary: "God calls you to live intentionally, not passively; seek His purpose with urgency."
    },
    actionSteps: [
      { id: 'c1', text: 'Spend 15 minutes daily in prayer, asking God to reveal His purpose for your life.', completed: false },
      { id: 'c2', text: 'Write down what excites you, what you\'re naturally good at, and what burdens you.', completed: false },
      { id: 'c3', text: 'Write a vision statement for your ideal life 10 years from now.', completed: false },
      { id: 'c4', text: 'Choose courses and projects that align with your vision.', completed: false },
      { id: 'c5', text: 'Seek mentors who can guide you in your field of interest.', completed: false },
      { id: 'c6', text: 'Take one small step this week toward exploring a potential path.', completed: false }
    ],
    affirmation: "God has a unique purpose for my life, and I will seek it daily. I am not a drifter; I am a driver of God's mission for me. I trust God to guide my steps as I take action.",
    bibleVerse: {
      text: "For we are God's handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do.",
      reference: "Ephesians 2:10"
    },
    directChallenge: "This week, schedule one hour to reflect on your passions, strengths, and burdens. Write down three potential paths you could explore that align with these. Then, take one concrete step toward exploring one of those paths.",
    progress: 0,
    totalTasks: 6
  }
];

export const getMockPlaybook = (id: string) => {
  return mockPlaybooks.find(playbook => playbook.id === id) || mockPlaybooks[0];
};
