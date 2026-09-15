export interface BibleStudyTopicPassage {
  reference: string;
  context: string;
}

export interface BibleStudyTopic {
  id: string;
  title: string;
  description: string;
  passages: BibleStudyTopicPassage[];
}

// Curated passages, not an exhaustive concordance. Context labels describe the
// passage's emphasis so a verse is not presented as a promise without context.
export const BIBLE_STUDY_TOPICS: BibleStudyTopic[] = [
  {
    id: 'anxiety',
    title: 'Anxiety',
    description: 'Bring fear and anxious thoughts honestly before God.',
    passages: [
      { reference: 'Matthew 6:25-34', context: 'Jesus teaches about worry and the Father’s care' },
      { reference: 'Philippians 4:4-9', context: 'Prayer, thanksgiving, and a mind shaped by what is true' },
      { reference: '1 Peter 5:6-11', context: 'Cast your anxieties on God and remain watchful' },
      { reference: 'Psalm 56:1-13', context: 'Trusting God in the middle of fear' },
      { reference: 'Psalm 94:16-23', context: 'God’s consolation when anxious thoughts multiply' },
      { reference: 'Luke 12:22-32', context: 'Jesus calls his disciples away from fear' },
    ],
  },
  {
    id: 'peace',
    title: 'Peace',
    description: 'Study the peace God gives and the life it produces.',
    passages: [
      { reference: 'John 14:25-31', context: 'Jesus promises peace to his disciples' },
      { reference: 'Isaiah 26:1-9', context: 'Steadfast trust and perfect peace' },
      { reference: 'Colossians 3:12-17', context: 'Letting Christ’s peace rule in community' },
      { reference: 'Romans 5:1-5', context: 'Peace with God through Jesus Christ' },
      { reference: 'Psalm 4:1-8', context: 'Resting safely in God amid distress' },
      { reference: 'Mark 4:35-41', context: 'Jesus brings calm in the storm' },
    ],
  },
  {
    id: 'grief',
    title: 'Grief',
    description: 'Make room for sorrow, comfort, lament, and hope.',
    passages: [
      { reference: 'Psalm 13', context: 'A lament that moves from pain toward trust' },
      { reference: 'John 11:17-44', context: 'Jesus meets Martha and Mary in their grief' },
      { reference: '2 Corinthians 1:3-7', context: 'God’s comfort in affliction' },
      { reference: '1 Thessalonians 4:13-18', context: 'Grief held together with resurrection hope' },
      { reference: 'Lamentations 3:19-33', context: 'Hope in God’s mercy within deep sorrow' },
      { reference: 'Revelation 21:1-5', context: 'The promised end of death, mourning, and pain' },
    ],
  },
  {
    id: 'guidance',
    title: 'Guidance',
    description: 'Seek wisdom for decisions, direction, and faithful next steps.',
    passages: [
      { reference: 'Proverbs 3:1-12', context: 'Trusting God rather than leaning on our own insight' },
      { reference: 'James 1:2-8', context: 'Asking God for wisdom in trials' },
      { reference: 'Psalm 25:1-14', context: 'A prayer for God to teach and lead' },
      { reference: 'Romans 12:1-8', context: 'A renewed mind and discerning God’s will' },
      { reference: 'Acts 16:6-15', context: 'Paul’s plans redirected as the mission unfolds' },
      { reference: 'Isaiah 30:15-21', context: 'Returning, listening, and walking in God’s way' },
    ],
  },
  {
    id: 'waiting',
    title: 'Waiting',
    description: 'Explore patient hope when answers have not yet come.',
    passages: [
      { reference: 'Psalm 27', context: 'Courageously waiting for the Lord' },
      { reference: 'Psalm 130', context: 'Waiting for God with watchful hope' },
      { reference: 'Isaiah 40:27-31', context: 'Renewed strength for those who hope in God' },
      { reference: 'Romans 8:18-30', context: 'Hope, groaning, and the Spirit’s help' },
      { reference: 'Habakkuk 2:1-4', context: 'Watching and waiting for the appointed time' },
      { reference: 'James 5:7-11', context: 'Patient endurance in suffering' },
    ],
  },
  {
    id: 'identity',
    title: 'Identity in Christ',
    description: 'Remember who you are because you belong to Christ.',
    passages: [
      { reference: 'Ephesians 1:3-14', context: 'Blessed, chosen, adopted, and redeemed in Christ' },
      { reference: 'Romans 8:1-17', context: 'No condemnation and life as God’s children' },
      { reference: '2 Corinthians 5:14-21', context: 'New creation and reconciliation in Christ' },
      { reference: 'Colossians 3:1-17', context: 'Putting on the life of God’s chosen people' },
      { reference: '1 Peter 2:4-12', context: 'A people called to declare God’s goodness' },
      { reference: 'Galatians 2:15-21', context: 'A life now centered on faith in Christ' },
    ],
  },
  {
    id: 'forgiveness',
    title: 'Forgiveness',
    description: 'Consider God’s mercy and the call to forgive others.',
    passages: [
      { reference: 'Psalm 32', context: 'The freedom of confession and forgiveness' },
      { reference: 'Matthew 18:21-35', context: 'Jesus’ parable about receiving and extending mercy' },
      { reference: 'Luke 15:11-32', context: 'A father’s welcome and two lost sons' },
      { reference: 'Ephesians 4:25-32', context: 'Forgiving one another as God forgave us in Christ' },
      { reference: 'Colossians 2:6-15', context: 'The record of debt canceled through Christ' },
      { reference: '1 John 1:5-10', context: 'Walking in the light through honest confession' },
    ],
  },
  {
    id: 'purpose',
    title: 'Purpose',
    description: 'Reflect on calling, good work, and everyday faithfulness.',
    passages: [
      { reference: 'Ephesians 2:1-10', context: 'Saved by grace and created for good works' },
      { reference: 'Micah 6:6-8', context: 'Justice, mercy, and humble walking with God' },
      { reference: 'Matthew 5:13-16', context: 'Living as salt and light' },
      { reference: 'Colossians 3:18-24', context: 'Wholehearted faithfulness in ordinary responsibilities' },
      { reference: '1 Corinthians 12:4-27', context: 'Different gifts within one body' },
      { reference: 'John 15:1-17', context: 'Abiding in Christ and bearing lasting fruit' },
    ],
  },
  {
    id: 'relationships',
    title: 'Relationships',
    description: 'Grow in love, humility, truth, and healthy community.',
    passages: [
      { reference: '1 Corinthians 13:1-13', context: 'The character and necessity of love' },
      { reference: 'Philippians 2:1-11', context: 'Humility shaped by the example of Christ' },
      { reference: 'Romans 12:9-21', context: 'Sincere love in Christian community' },
      { reference: 'James 1:19-27', context: 'Listening, speaking, and living out the word' },
      { reference: 'Matthew 18:15-20', context: 'Addressing sin and pursuing restoration' },
      { reference: 'Colossians 3:12-15', context: 'Compassion, patience, forgiveness, and love' },
    ],
  },
  {
    id: 'temptation',
    title: 'Temptation',
    description: 'Recognize temptation and learn to stand faithfully.',
    passages: [
      { reference: 'Matthew 4:1-11', context: 'Jesus is tested in the wilderness' },
      { reference: 'James 1:12-18', context: 'How desire grows and God’s goodness remains' },
      { reference: '1 Corinthians 10:1-13', context: 'Warnings from Israel and God’s faithfulness in testing' },
      { reference: 'Genesis 39:1-23', context: 'Joseph flees temptation and bears the cost' },
      { reference: 'Ephesians 6:10-18', context: 'Standing firm with the armor of God' },
      { reference: 'Hebrews 4:14-16', context: 'Jesus understands weakness and gives timely grace' },
    ],
  },
  {
    id: 'gratitude',
    title: 'Gratitude',
    description: 'Practice noticing God’s gifts and responding with thanks.',
    passages: [
      { reference: 'Psalm 103', context: 'Remembering the Lord’s benefits and compassion' },
      { reference: 'Luke 17:11-19', context: 'One healed man returns to thank Jesus' },
      { reference: '1 Thessalonians 5:12-24', context: 'Rejoicing, praying, and giving thanks' },
      { reference: 'Philippians 4:10-20', context: 'Contentment and gratitude in every circumstance' },
      { reference: 'Colossians 3:15-17', context: 'A community marked by peace and thankfulness' },
      { reference: 'Psalm 100', context: 'Entering God’s presence with thanksgiving' },
    ],
  },
  {
    id: 'faith',
    title: 'Faith',
    description: 'Explore trust in God through uncertainty and action.',
    passages: [
      { reference: 'Hebrews 11:1-16', context: 'Faith as trust that shapes how people live' },
      { reference: 'Mark 9:14-29', context: 'An honest prayer of belief and unbelief' },
      { reference: 'Genesis 12:1-9', context: 'Abram goes in response to God’s call' },
      { reference: 'Romans 4:13-25', context: 'Abraham’s hope and trust in God’s promise' },
      { reference: 'James 2:14-26', context: 'Faith made visible through action' },
      { reference: 'Psalm 46', context: 'Trusting God as refuge in upheaval' },
    ],
  },
];
