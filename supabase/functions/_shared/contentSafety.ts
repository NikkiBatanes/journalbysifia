/**
 * Content Safety Utility
 * Detects harmful intent vs victim experiences in user input
 */

export interface ContentAnalysis {
  isHarmfulIntent: boolean;
  isVictimExperience: boolean;
  category?: 'violence' | 'sexual_assault' | 'theft' | 'harassment' | 'self_harm' | 'other';
  shouldBlock: boolean;
  shouldParaphrase: boolean;
  christianMessage?: string;
  constructiveAlternatives?: string[];
}

/**
 * Analyze user input for harmful intent vs victim experiences
 */
export function analyzeContent(input: string): ContentAnalysis {
  const lowerInput = input.toLowerCase();
  
  // Patterns indicating harmful PLANNING/INTENT/CONFESSION (perpetrator perspective)
  const harmfulPlanningPatterns = [
    // Violence planning and confessions
    /\b(i want to|i will|i'm going to|planning to|how (can|do) i|help me)\s+(kill|murder|harm|hurt|beat|attack|shoot|stab)\s+(someone|him|her|them|my)/i,
    /\b(i killed|i murdered|i hurt|i beat|i attacked|i shot|i stabbed)\s+(someone|him|her|them|my)/i,
    /\b(revenge|get back at|make (him|her|them) pay)\b/i,
    /\bhow (can|do) i (hurt|harm|kill|murder)/i,
    
    // Sexual assault planning and confessions
    /\b(i want to|i will|i'm going to|planning to|how (can|do) i)\s+(rape|assault|force|molest)/i,
    /\b(i raped|i assaulted|i molested|i forced)\s+(someone|him|her|them|a|my)/i,
    /\bhow (can|do) i (get away with|commit)/i,
    
    // Theft/fraud planning and confessions
    /\b(i want to|i will|i'm going to|planning to|how (can|do) i)\s+(steal|rob|fraud|scam|cheat)/i,
    /\b(i stole|i robbed|i scammed|i cheated)\s+(from|someone|him|her|them)/i,
    
    // Harassment/stalking planning and confessions
    /\b(i want to|i will|i'm going to|planning to|how (can|do) i)\s+(stalk|harass|follow|track|spy on)/i,
    /\b(i stalked|i harassed|i followed)\s+(someone|him|her|them|my)/i,
  ];

  // Patterns indicating VICTIM experiences (victim perspective)
  const victimExperiencePatterns = [
    // Violence victim
    /\b(i was|someone|he|she|they)\s+(killed|murdered|attacked|beat|assaulted)\b/i,
    /\b(my|our)\s+(husband|wife|son|daughter|brother|sister|friend|family)\s+(was|were)\s+(killed|murdered)/i,
    /\bgrieving|healing from|struggling after|dealing with|recovering from\b/i,
    
    // Sexual assault victim
    /\b(i was|i've been)\s+(raped|sexually assaulted|molested|abused)/i,
    /\bvictim of (sexual assault|rape|abuse)/i,
    
    // Theft/crime victim
    /\b(i was|my)\s+(robbed|stolen from|burglarized)/i,
    /\bsomeone stole (my|our)/i,
    
    // General trauma
    /\btrauma|ptsd|nightmares from|flashbacks/i,
    /\bhealing|recovery|coping with|dealing with\b/i,
  ];

  // Check for harmful planning patterns
  const hasHarmfulIntent = harmfulPlanningPatterns.some(pattern => pattern.test(lowerInput));
  
  // Check for victim experience patterns
  const hasVictimExperience = victimExperiencePatterns.some(pattern => pattern.test(lowerInput));

  // Determine category
  let category: ContentAnalysis['category'];
  if (lowerInput.includes('kill') || lowerInput.includes('murder') || lowerInput.includes('violence')) {
    category = 'violence';
  } else if (lowerInput.includes('rape') || lowerInput.includes('sexual assault') || lowerInput.includes('molest')) {
    category = 'sexual_assault';
  } else if (lowerInput.includes('steal') || lowerInput.includes('rob') || lowerInput.includes('fraud')) {
    category = 'theft';
  } else if (lowerInput.includes('stalk') || lowerInput.includes('harass')) {
    category = 'harassment';
  } else if (lowerInput.includes('suicide') || lowerInput.includes('self harm')) {
    category = 'self_harm';
  } else {
    category = 'other';
  }

  // Determine action
  const shouldBlock = hasHarmfulIntent && !hasVictimExperience;
  const shouldParaphrase = hasVictimExperience || (!hasHarmfulIntent && (
    lowerInput.includes('rape') || 
    lowerInput.includes('murder') ||
    lowerInput.includes('assault')
  ));

  return {
    isHarmfulIntent: hasHarmfulIntent,
    isVictimExperience: hasVictimExperience,
    category,
    shouldBlock,
    shouldParaphrase,
    christianMessage: shouldBlock ? getChristianMessage(category) : undefined,
    constructiveAlternatives: shouldBlock ? getConstructiveAlternatives(category) : undefined,
  };
}

/**
 * Get Christian-focused message for blocked content
 */
function getChristianMessage(category?: ContentAnalysis['category']): string {
  const baseMessage = "We're here to support your journey with Christ in ways that honor God and protect others.";
  
  switch (category) {
    case 'violence':
      return `${baseMessage} If you've harmed someone or are struggling with violent thoughts, God offers forgiveness and transformation through Christ. Please reach out immediately to a Christian counselor, pastor, or law enforcement who can help you find God's healing path and ensure everyone's safety.`;
    
    case 'sexual_assault':
      return `${baseMessage} If you've harmed someone sexually or are struggling with these thoughts, God's grace is available, but you need proper help. Please speak immediately with a Christian counselor, pastor, or appropriate authorities who can guide you toward repentance, accountability, and healing in Christ.`;
    
    case 'theft':
      return `${baseMessage} If you've taken from others or are facing these temptations, God calls you to restitution and honesty. Please reach out to your church family, a Christian counselor, or appropriate authorities who can help you make things right and find God's provision.`;
    
    case 'harassment':
      return `${baseMessage} If you've hurt someone through harassment or stalking, you need accountability and help. Please speak with a Christian counselor, pastor, or appropriate authorities who can help you understand healthy boundaries and find healing in Christ.`;
    
    case 'self_harm':
      return `${baseMessage} Your life is precious to God, and you are deeply loved. If you're having thoughts of harming yourself, please reach out to a Christian counselor, pastor, or call 988 (Suicide & Crisis Lifeline). God wants to walk with you through this pain.`;
    
    default:
      return `${baseMessage} Some situations require specialized help beyond what we can provide. Please reach out to Christian counselors, pastors, or appropriate authorities who can provide proper guidance while helping you walk in God's truth and love.`;
  }
}

/**
 * Get constructive alternative suggestions
 */
function getConstructiveAlternatives(category?: ContentAnalysis['category']): string[] {
  const baseAlternatives = [
    "Understanding true repentance and God's forgiveness",
    "Walking in accountability and transparency",
    "Finding transformation through Christ",
  ];

  switch (category) {
    case 'violence':
      return [
        "Seeking forgiveness and making amends",
        "Overcoming anger through God's peace",
        "Learning non-violent conflict resolution",
        ...baseAlternatives,
      ];
    
    case 'sexual_assault':
      return [
        "Understanding true repentance and restoration",
        "Accepting accountability for past actions",
        "Building a life of integrity and respect",
        ...baseAlternatives,
      ];
    
    case 'theft':
      return [
        "Making restitution and seeking forgiveness",
        "Learning honesty and integrity in Christ",
        "Trusting God's provision instead of taking",
        ...baseAlternatives,
      ];
    
    case 'harassment':
      return [
        "Understanding and respecting boundaries",
        "Seeking help for obsessive behaviors",
        "Learning healthy ways to process rejection",
        ...baseAlternatives,
      ];
    
    case 'self_harm':
      return [
        "Finding hope and purpose in Christ",
        "Overcoming depression with God's help",
        "Building resilience through faith",
        ...baseAlternatives,
      ];
    
    default:
      return baseAlternatives;
  }
}

/**
 * Paraphrase victim experiences in a Christian-focused way
 */
export function paraphraseVictimExperience(input: string): string {
  let paraphrased = input;

  // Violence victim paraphrasing
  paraphrased = paraphrased.replace(/\b(i was|someone)\s+(killed|murdered)\b/gi, 'I lost someone to violence');
  paraphrased = paraphrased.replace(/\bmy (husband|wife|son|daughter|brother|sister|friend|family) was (killed|murdered)\b/gi, 'I\'m grieving the loss of my $1');
  
  // Sexual assault victim paraphrasing
  paraphrased = paraphrased.replace(/\b(i was|i've been)\s+raped\b/gi, 'I\'m healing from sexual assault');
  paraphrased = paraphrased.replace(/\bsexually assaulted\b/gi, 'healing from sexual assault');
  
  // Theft victim paraphrasing
  paraphrased = paraphrased.replace(/\b(i was|my)\s+robbed\b/gi, 'I experienced theft');
  paraphrased = paraphrased.replace(/\bstolen from\b/gi, 'victimized by theft');
  
  // Add Christian framing
  paraphrased = paraphrased.replace(/\bstruggling\b/gi, 'seeking God\'s comfort and healing');
  paraphrased = paraphrased.replace(/\bhealing\b/gi, 'healing through Christ');

  return paraphrased.trim();
}
