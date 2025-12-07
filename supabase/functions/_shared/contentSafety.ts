/**
 * Content Safety Utility
 * Detects harmful intent vs victim experiences in user input
 */

export interface ContentAnalysis {
  isHarmfulIntent: boolean;
  isVictimExperience: boolean;
  category?: 'violence' | 'sexual_assault' | 'theft' | 'harassment' | 'self_harm' | 'gender_identity' | 'revenge' | 'hate_speech' | 'other';
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
    /\bhow (can|do) i (hurt|harm|kill|murder)/i,
    
    // Self-harm planning (REMOVED - we want to support, not block)
    // These are now handled with paraphrasing instead of blocking
    
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

  // Patterns indicating REVENGE topics (should be allowed, not blocked)
  const revengePatterns = [
    /\b(revenge|get back at|make (him|her|them) pay)\b/i,
    /\b(i want|i need|i'm going to)\s+(to\s+)?(get\s+)?revenge\b/i,
    /\bhow (can|do) i (get\s+)?revenge\b/i,
    /\bpayback|retaliation|vengeance\b/i,
  ];

  // Patterns indicating HATE SPEECH topics (should be allowed for guidance, not blocked)
  const hateSpeechPatterns = [
    /\bi hate (white|black|asian|hispanic|latino|indian|jewish|muslim|christian|lgbt|gay|lesbian|bi|trans|queer|non-binary) people\b/i,
    /\bi hate (white|black|asian|hispanic|latino|indian|jewish|muslim|christian|lgbt|gay|lesbian|bi|trans|queer|non-binary)\b/i,
    /\b(all white|all black|all asian|all hispanic|all latino|all indian|all jewish|all muslim|all christian|all lgbt) people are\b/i,
    /\b(hate|dislike) (white|black|asian|hispanic|latino|indian|jewish|muslim|christian|lgbt|gay|lesbian|bi|trans|queer) people\b/i,
  ];

  // Patterns indicating GENDER IDENTITY topics (should be allowed, not blocked)
  const genderIdentityPatterns = [
    /\b(i want to|i will|i'm going to|i need to|i would like to)\s+(change|transition|explore)\s+(my\s+)?(gender|identity)\b/i,
    /\b(i am|i'm|i feel like|i identify as)\s+(trans|transgender|non-binary|genderfluid|genderqueer)\b/i,
    /\b(i'm|i am)\s+(questioning|exploring)\s+(my\s+)?(gender|identity)\b/i,
    /\b(gender\s+)?transition\b/i,
    /\b(sex\s+)?change\b/i,
    /\bgender\s+(dysphoria|affirmation)\b/i,
  ];

  // Check for harmful planning patterns
  const hasHarmfulIntent = harmfulPlanningPatterns.some(pattern => pattern.test(lowerInput));
  
  // Check for victim experience patterns
  const hasVictimExperience = victimExperiencePatterns.some(pattern => pattern.test(lowerInput));

  // Check for gender identity patterns (should be allowed)
  const isGenderIdentity = genderIdentityPatterns.some(pattern => pattern.test(lowerInput));

  // Check for revenge patterns (should be allowed)
  const isRevenge = revengePatterns.some(pattern => pattern.test(lowerInput));

  // Check for hate speech patterns (should be allowed for guidance)
  const isHateSpeech = hateSpeechPatterns.some(pattern => pattern.test(lowerInput));

  // Determine category
  let category: ContentAnalysis['category'];
  if (isRevenge) {
    category = 'revenge';
  } else if (isGenderIdentity) {
    category = 'gender_identity';
  } else if (isHateSpeech) {
    category = 'hate_speech';
  } else if (lowerInput.includes('suicide') || lowerInput.includes('self harm') || 
             lowerInput.includes('dead') || lowerInput.includes('die') || 
             lowerInput.includes('kill myself') || lowerInput.includes('end my life')) {
    category = 'self_harm';
  } else if (lowerInput.includes('kill') || lowerInput.includes('murder') || lowerInput.includes('violence')) {
    category = 'violence';
  } else if (lowerInput.includes('rape') || lowerInput.includes('sexual assault') || lowerInput.includes('molest')) {
    category = 'sexual_assault';
  } else if (lowerInput.includes('steal') || lowerInput.includes('rob') || lowerInput.includes('fraud')) {
    category = 'theft';
  } else if (lowerInput.includes('stalk') || lowerInput.includes('harass')) {
    category = 'harassment';
  } else {
    category = 'other';
  }

  // Determine action
  const shouldBlock = hasHarmfulIntent && !hasVictimExperience && !isGenderIdentity && !isRevenge && !isHateSpeech;
  const shouldParaphrase = hasVictimExperience || (!hasHarmfulIntent && !isGenderIdentity && !isRevenge && !isHateSpeech && (
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
