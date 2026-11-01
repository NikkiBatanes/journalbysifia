import type {
  GuidedBibleStudy,
  GuidedBibleStudyContext,
  GuidedBibleStudyPrompt,
} from '../../src/data/guidedBibleStudies';

type PromptContent = {
  question: string;
  answer: string;
};

type JohnChapterContent = {
  chapter: number;
  subtitle: string;
  summary: string;
  keyVerse: GuidedBibleStudy['keyVerse'];
  contexts: GuidedBibleStudyContext[];
  lookAgain: PromptContent;
  reflect: PromptContent;
  respond: PromptContent;
  prayer: string;
  carryTruth: string;
};

const makePrompt = (
  content: PromptContent,
  kind: 'look' | 'reflect' | 'respond',
): GuidedBibleStudyPrompt => ({
  question: content.question,
  guideLabel:
    kind === 'look'
      ? 'Compare with the guide'
      : kind === 'reflect'
      ? 'Read the study note'
      : 'See an example',
  guideAnswer: content.answer,
  placeholder:
    kind === 'look'
      ? 'Write what you notice in the passage…'
      : kind === 'reflect'
      ? 'Reflect in your own words…'
      : 'Name one faithful response…',
});

const makeJohnStudy = (content: JohnChapterContent): GuidedBibleStudy => ({
  id: `john-${content.chapter}-chapter-companion`,
  version: 1,
  reference: `John ${content.chapter}`,
  title: `John ${content.chapter}`,
  subtitle: content.subtitle,
  estimatedMinutes: 10,
  summary: content.summary,
  keyVerse: content.keyVerse,
  contexts: content.contexts,
  lookAgain: makePrompt(content.lookAgain, 'look'),
  reflect: makePrompt(content.reflect, 'reflect'),
  respond: makePrompt(content.respond, 'respond'),
  prayer: content.prayer,
  carryTruth: content.carryTruth,
});

const JOHN_CHAPTER_CONTENT: JohnChapterContent[] = [
  {
    chapter: 1,
    subtitle: `Read slowly, noticing every name and description given to Jesus.`,
    summary: `John opens before creation, identifying the Word as both with God and God. The Word creates, gives life, and shines as light that darkness cannot overcome. John the Baptist appears as a witness who prepares people to recognize the true Light. The Word becomes flesh in Jesus, revealing the Father's glory, grace, and truth among humanity. John then identifies Jesus as the Lamb of God and the Son of God. The chapter closes as the first disciples follow Jesus, invite others to meet Him, and hear that greater things are still to come.`,
    keyVerse: {
      reference: 'John 1:14',
      translation: 'KJV',
      text: `“And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth.”`,
      note: `This verse gathers the chapter's central claim that the eternal Word truly entered human life and revealed God's glory.`,
    },
    contexts: [
      {
        title: 'The Word',
        body: `The Greek term translated “Word” is logos, a term John uses for God's self-expression and revelation. John does not describe the Word as a created messenger: the Word is with God, is God, and becomes flesh in Jesus.`,
      },
      {
        title: 'The Lamb of God',
        body: `Calling Jesus the Lamb of God brings sacrifice, deliverance, and the removal of sin into view. John does not explain the image fully here; the Gospel develops its meaning as Jesus moves toward His death.`,
      },
      {
        title: 'Heaven opened',
        body: `Jesus' words to Nathanael echo Jacob's vision of a ladder between heaven and earth in Genesis 28. Jesus presents Himself as the meeting place between God and humanity.`,
      },
    ],
    lookAgain: {
      question: `Read John 1:1–18 again. Which words describe what the Word is, does, and reveals?`,
      answer: `The Word is with God and is God, exists from the beginning, creates all things, gives life, and shines as light. He becomes flesh, dwells among humanity, and makes the unseen Father known with grace and truth.`,
    },
    reflect: {
      question: `How does John's description of Jesus enlarge or correct the way you have been seeing Him?`,
      answer: `John presents Jesus as far more than a teacher who entered history. He is the eternal Word, the source of life, and the One who makes the Father known, yet He chose to dwell among ordinary people in human flesh.`,
    },
    respond: {
      question: `What would it look like to follow the first disciples' simple invitation to “come and see”?`,
      answer: `I can make room to remain with Jesus in Scripture and bring one honest question to Him instead of keeping my distance. I can also invite another person toward Him without pretending to have every answer.`,
    },
    prayer: `Lord Jesus, help me behold Your glory as the eternal Word who came near in grace and truth. Give me a willing heart to follow You and bear faithful witness to who You are.`,
    carryTruth: `The eternal Word came near, revealing the Father in grace and truth.`,
  },
  {
    chapter: 2,
    subtitle: `Watch how Jesus reveals His glory at a celebration and in the temple.`,
    summary: `Jesus attends a wedding in Cana where the wine runs out. At His direction, servants fill six stone water jars, and the water becomes excellent wine. John calls this the first sign through which Jesus reveals His glory, and His disciples believe in Him. Jesus later goes to Jerusalem for Passover and drives merchants and money changers from the temple courts. When leaders ask for a sign, He speaks of destroying and raising the temple of His body. Many believe because of His signs, but Jesus does not entrust Himself to them because He knows what is within people.`,
    keyVerse: {
      reference: 'John 2:11',
      translation: 'KJV',
      text: `“This beginning of miracles did Jesus in Cana of Galilee, and manifested forth his glory; and his disciples believed on him.”`,
      note: `John identifies the miracle as a sign that reveals Jesus' glory and calls His disciples toward deeper belief.`,
    },
    contexts: [
      {
        title: 'Signs in John',
        body: `John often calls Jesus' miracles “signs” because they point beyond the event to His identity and mission. The gift of wine matters within the wedding, but John especially directs attention to the glory it reveals.`,
      },
      {
        title: 'Stone water jars',
        body: `The jars held water used for Jewish purification practices. Their size emphasizes the abundance of what Jesus provides, while their purpose places the sign alongside themes of cleansing and renewal.`,
      },
      {
        title: 'The temple of His body',
        body: `Jesus' hearers think He is speaking about the Jerusalem temple, but John explains that He is speaking about His body. The disciples understand this after His resurrection, connecting His words with His death and rising.`,
      },
    ],
    lookAgain: {
      question: `Compare John 2:1–11 and 2:13–22. What does each scene reveal about Jesus' authority?`,
      answer: `At Cana, Jesus quietly exercises authority over creation and provides abundantly. In Jerusalem, He claims authority over the temple and identifies His own body with the place of God's presence, pointing ahead to His resurrection.`,
    },
    reflect: {
      question: `What difference do you notice between being impressed by Jesus' signs and entrusting yourself to Jesus?`,
      answer: `People may respond to something remarkable without truly receiving Jesus or understanding what the sign reveals. Trust moves beyond amazement toward relying on His identity, words, and authority.`,
    },
    respond: {
      question: `Where might Jesus be asking for attentive obedience before you can see what He will do?`,
      answer: `Like the servants who filled the jars, I can obey the clear instruction already before me without demanding the full outcome first. That may mean telling the truth, making something right, or taking the next faithful step.`,
    },
    prayer: `Jesus, open my eyes to the glory Your signs reveal and not only to the help I desire. Teach me to trust Your authority and obey Your words with an attentive heart.`,
    carryTruth: `Jesus' signs reveal His glory and invite trust deeper than mere amazement.`,
  },
  {
    chapter: 3,
    subtitle: `Listen to Jesus explain new birth, belief, light, and eternal life.`,
    summary: `Nicodemus, a Pharisee and ruler, comes to Jesus at night and acknowledges the signs God is doing through Him. Jesus tells him that no one can see God's kingdom without being born again, or born from above. He explains the Spirit's mysterious work and points to the Son of Man being lifted up so that believers may have eternal life. God's love is shown in giving His Son to save rather than condemn the world. The chapter then returns to John the Baptist, whose disciples are concerned that people are going to Jesus. John receives Jesus' growing ministry with joy, saying that Christ must increase while he must decrease.`,
    keyVerse: {
      reference: 'John 3:16–17',
      translation: 'KJV',
      text: `“For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life. For God sent not his Son into the world to condemn the world; but that the world through him might be saved.”`,
      note: `These verses place God's love, the gift of His Son, belief, salvation, and eternal life at the heart of Jesus' mission.`,
    },
    contexts: [
      {
        title: 'Born again or from above',
        body: `The Greek expression can mean both “born again” and “born from above.” Nicodemus hears it as a second physical birth, while Jesus speaks of life that comes from God's Spirit.`,
      },
      {
        title: 'The bronze serpent',
        body: `Jesus refers to Numbers 21, where Israelites who had been bitten looked at the bronze serpent Moses lifted up and lived. The comparison points ahead to Jesus being lifted up and to life received by believing in Him.`,
      },
      {
        title: 'Bridegroom and friend',
        body: `John describes Jesus as the bridegroom and himself as the friend who rejoices at the bridegroom's voice. The image explains why John's joy is complete when attention turns from him to Jesus.`,
      },
    ],
    lookAgain: {
      question: `Trace the contrasts in John 3:1–21: flesh and Spirit, earthly and heavenly, darkness and light. What do they clarify?`,
      answer: `The contrasts show that entry into God's kingdom cannot be produced by natural birth, status, or human effort. Life comes from above through the Spirit, and belief in the lifted-up Son brings people into the light.`,
    },
    reflect: {
      question: `Where do you recognize Nicodemus in yourself: curious, respectful, yet struggling to receive what Jesus says?`,
      answer: `Nicodemus reminds me that religious knowledge and sincere questions do not remove my need for new life from God. I can bring confusion to Jesus while remaining open to truths that unsettle my existing categories.`,
    },
    respond: {
      question: `How can John's words, “He must increase, but I must decrease,” shape one area of your life?`,
      answer: `I can release the need to be noticed or to control how others respond and instead make Jesus more visible through my words and choices. The response is not self-contempt but gladness that He is the center.`,
    },
    prayer: `Father, thank You for loving the world and giving Your Son so that believers may have life. Bring me into Your light by the Spirit, and let Jesus increase in every part of me.`,
    carryTruth: `New life comes from above through faith in God's given Son.`,
  },
  {
    chapter: 4,
    subtitle: `Notice whom Jesus welcomes and what He offers across familiar boundaries.`,
    summary: `Jesus travels through Samaria and rests at Jacob's well, where He asks a Samaritan woman for water. Their conversation moves from ordinary water to the living water He gives, then to the truth about her life. When she raises the dispute about the proper place of worship, Jesus speaks of worshiping the Father in spirit and truth and identifies Himself as the Messiah. The woman leaves her jar, tells her town about Jesus, and many Samaritans believe after hearing Him for themselves. Jesus teaches His disciples to see a harvest already ready rather than overlook the people before them. Back in Galilee, He heals a royal official's son from a distance, and the man believes Jesus' word before seeing the result.`,
    keyVerse: {
      reference: 'John 4:23–24',
      translation: 'KJV',
      text: `“But the hour cometh, and now is, when the true worshippers shall worship the Father in spirit and in truth: for the Father seeketh such to worship him. God is a Spirit: and they that worship him must worship him in spirit and in truth.”`,
      note: `Jesus moves worship beyond a dispute over locations and centers it on the Father, the Spirit, and truth.`,
    },
    contexts: [
      {
        title: 'Jews and Samaritans',
        body: `Jews and Samaritans shared ancestral roots but were divided by long-standing religious and ethnic hostility. Jesus crosses those boundaries by speaking publicly with a Samaritan woman and receiving her town.`,
      },
      {
        title: 'Gerizim and Jerusalem',
        body: `Samaritans worshiped at Mount Gerizim, while Jews centered worship at the Jerusalem temple. Jesus acknowledges the history of salvation through the Jews but announces an hour when worship will not be defined by either mountain.`,
      },
      {
        title: 'Living water',
        body: `In ordinary speech, living water could mean fresh, flowing water rather than water stored in a cistern. Jesus uses the phrase for the life He gives, which becomes an enduring spring within the recipient.`,
      },
    ],
    lookAgain: {
      question: `Follow the Samaritan woman's changing words for Jesus in John 4:9–29. What progression do you see?`,
      answer: `She first sees a Jewish man, then calls Him “Sir,” wonders whether He is greater than Jacob, recognizes Him as a prophet, discusses the coming Messiah, and finally invites others to consider whether He is the Christ. Her understanding grows through honest conversation with Jesus.`,
    },
    reflect: {
      question: `What thirst or part of your story are you tempted to hide rather than bring into truthful conversation with Jesus?`,
      answer: `Jesus neither ignores the woman's history nor uses it to push her away. The chapter invites me to let Him address the truth beneath my surface needs while receiving the life only He gives.`,
    },
    respond: {
      question: `Whom might you be failing to see because of a social, cultural, or personal boundary?`,
      answer: `I can slow down, listen without superiority, and treat one overlooked person as someone God may already be drawing. The disciples saw errands and food, while Jesus saw a field ready for harvest.`,
    },
    prayer: `Jesus, meet me truthfully in the places where I thirst and give me the living water only You provide. Teach me to worship the Father in spirit and truth and to see people with Your welcome.`,
    carryTruth: `Jesus meets hidden thirst with truth, living water, and unexpected welcome.`,
  },
  {
    chapter: 5,
    subtitle: `See how one Sabbath healing opens a larger question about Jesus' authority.`,
    summary: `At a pool in Jerusalem, Jesus meets a man who has been unable to walk for thirty-eight years. Jesus tells him to rise, take his bed, and walk, and the man is healed immediately. Because the healing occurs on the Sabbath, religious leaders focus on the man's carrying his mat and begin opposing Jesus. Jesus answers that His Father is working and that He is also working, a claim His opponents understand as making Himself equal with God. He explains that the Son gives life, executes judgment, and deserves the same honor as the Father. Jesus then names several witnesses to His identity: John the Baptist, His works, the Father, the Scriptures, and Moses.`,
    keyVerse: {
      reference: 'John 5:24',
      translation: 'KJV',
      text: `“Verily, verily, I say unto you, He that heareth my word, and believeth on him that sent me, hath everlasting life, and shall not come into condemnation; but is passed from death unto life.”`,
      note: `Jesus describes belief as a present passage from death to life, grounded in hearing His word and trusting the Father who sent Him.`,
    },
    contexts: [
      {
        title: 'The Sabbath dispute',
        body: `The Sabbath was God's covenant gift and command, set apart for rest. The dispute centers on whether the healed man's mat-carrying and Jesus' healing violate Sabbath faithfulness, but Jesus answers at the deeper level of His unique relationship with the Father.`,
      },
      {
        title: 'Equal honor',
        body: `Jesus does not present Himself as acting independently from God. He says the Son does what He sees the Father doing and then claims the Father's works of giving life and judging, so that all should honor the Son as they honor the Father.`,
      },
      {
        title: 'A chain of witnesses',
        body: `Jewish law valued confirming testimony, and Jesus names multiple witnesses rather than relying on unsupported self-assertion. Each witness points toward Him, yet Scripture can still be studied without coming to the One to whom it testifies.`,
      },
    ],
    lookAgain: {
      question: `List every claim Jesus makes about the Son in John 5:19–30. Which claim seems most central?`,
      answer: `The Son sees and does the Father's works, gives life, has judgment entrusted to Him, deserves equal honor, possesses life in Himself, and will raise the dead. Together the claims center on the Son's complete unity with the Father's work and authority.`,
    },
    reflect: {
      question: `How can careful attention to religious rules still miss the life-giving work of God in front of us?`,
      answer: `The leaders know the Sabbath command yet respond to a restored man primarily as a violation to investigate. The passage warns that protecting our interpretation or position can make us resistant to the One Scripture is meant to reveal.`,
    },
    respond: {
      question: `What would it mean today to come to Jesus for life rather than only gather information about Him?`,
      answer: `I can hear His word with the intention to trust and obey, not merely evaluate it from a safe distance. Coming to Him may begin with naming where I feel powerless and receiving His authority over that place.`,
    },
    prayer: `Father, keep me from searching the Scriptures while refusing to come to Your Son for life. Help me hear Jesus' word, honor Him, and recognize Your work even when it unsettles my expectations.`,
    carryTruth: `The Son shares the Father's life-giving work and is worthy of equal honor.`,
  },
  {
    chapter: 6,
    subtitle: `Read the signs and the difficult teaching together, asking what true belief seeks.`,
    summary: `A large crowd follows Jesus because of His healings, and He feeds them with five loaves and two fish. The people want to make Him king by force, so He withdraws alone while His disciples cross the sea. Jesus comes to them walking on the water and brings them safely to shore. When the crowd finds Him, He exposes their pursuit of food that perishes and directs them toward the true bread from heaven. Jesus identifies Himself as the bread of life and speaks of giving His flesh for the life of the world. Many disciples turn back because the teaching is hard, but Peter remains, confessing that Jesus has the words of eternal life.`,
    keyVerse: {
      reference: 'John 6:35',
      translation: 'KJV',
      text: `“And Jesus said unto them, I am the bread of life: he that cometh to me shall never hunger; and he that believeth on me shall never thirst.”`,
      note: `Jesus does not merely give sustaining bread; He identifies Himself as the One who satisfies the deepest human need.`,
    },
    contexts: [
      {
        title: 'Passover and manna',
        body: `John notes that Passover is near, and the chapter repeatedly recalls Israel's wilderness story. The crowd compares Jesus' sign with manna, but Jesus says the Father gives the true bread from heaven and identifies that bread with Himself.`,
      },
      {
        title: 'A king by force',
        body: `The crowd recognizes Jesus as the expected prophet after being fed, but they try to define His kingship around their own expectations. Jesus withdraws rather than accept a crown detached from the mission given by His Father.`,
      },
      {
        title: 'Eating and drinking',
        body: `Christians agree that Jesus' words call for receiving and depending on His life given for the world, though traditions differ on how directly the passage relates to the Lord's Supper. The chapter itself repeatedly connects coming, believing, eating, abiding, and eternal life.`,
      },
    ],
    lookAgain: {
      question: `What does the crowd ask Jesus to give them, and how does He redirect their attention in John 6:26–40?`,
      answer: `They seek more bread and ask for a sign like the manna. Jesus redirects them from perishable food and Moses toward the Father's true bread, then declares that He Himself is the bread of life received by coming and believing.`,
    },
    reflect: {
      question: `When Jesus does not fit the help or outcome you expected, what makes you stay or turn away?`,
      answer: `The chapter distinguishes wanting Jesus' gifts from receiving Jesus Himself. Peter does not claim to understand everything; he stays because he has come to know that Jesus has the words of eternal life.`,
    },
    respond: {
      question: `How can you seek Jesus Himself today rather than using Him only to reach another desire?`,
      answer: `I can remain with one of His difficult words long enough to listen, surrender my preferred outcome, and tell Him honestly what I do not understand. Trust can stay present even before every question is resolved.`,
    },
    prayer: `Lord Jesus, forgive me for seeking Your gifts while resisting You as the bread of life. Hold me near when Your words are difficult, for You alone have the words of eternal life.`,
    carryTruth: `Jesus Himself is the bread of life, not merely the giver of temporary provision.`,
  },
  {
    chapter: 7,
    subtitle: `Notice the divided responses to Jesus and His invitation to the thirsty.`,
    summary: `Jesus remains in Galilee because leaders in Judea seek to kill Him, while His brothers urge Him to show Himself publicly at the Feast of Tabernacles. He later goes to the feast quietly and begins teaching in the temple, astonishing people who know He lacks formal rabbinic training. Jesus says His teaching comes from the One who sent Him and exposes inconsistent judgments about His Sabbath healing. The crowds debate whether He is good, deceptive, the Prophet, or the Christ, and arguments about His origins deepen the division. On the final day of the feast, Jesus calls the thirsty to come to Him and drink, speaking of the Spirit believers would receive. Officers sent to arrest Him return empty-handed, and Nicodemus cautiously asks the leaders to follow their own law before judging Him.`,
    keyVerse: {
      reference: 'John 7:37–38',
      translation: 'KJV',
      text: `“In the last day, that great day of the feast, Jesus stood and cried, saying, If any man thirst, let him come unto me, and drink. He that believeth on me, as the scripture hath said, out of his belly shall flow rivers of living water.”`,
      note: `At the feast's climax, Jesus publicly identifies Himself as the source to whom the thirsty must come for Spirit-given life.`,
    },
    contexts: [
      {
        title: 'The Feast of Tabernacles',
        body: `This autumn feast remembered Israel's wilderness journey and celebrated God's provision at harvest. Water and light carried strong meaning during the celebration, giving Jesus' invitation to the thirsty particular force.`,
      },
      {
        title: 'The promised Spirit',
        body: `John explains that Jesus is speaking about the Spirit, whom believers would receive after Jesus was glorified. “Not yet given” does not mean the Spirit had never been active, but points to the new-covenant outpouring connected with Jesus' death, resurrection, and exaltation.`,
      },
      {
        title: 'Confusion about origins',
        body: `Some reject Jesus because they associate Him with Galilee while Scripture connects the Messiah with Bethlehem and David's line. Their confident conclusion rests on incomplete knowledge of Jesus' earthly birth and, more deeply, failure to recognize the One who sent Him.`,
      },
    ],
    lookAgain: {
      question: `Collect the different opinions about Jesus in John 7. What evidence or assumptions shape each response?`,
      answer: `People call Him good, a deceiver, demon-possessed, the Prophet, or the Christ; some marvel at His teaching, while others rely on assumptions about His origins. The officers are arrested by His words, Nicodemus appeals to fair hearing, and the leaders answer with contempt.`,
    },
    reflect: {
      question: `Which is more likely to keep you from hearing Jesus clearly: fear of people, quick assumptions, or the need to appear certain?`,
      answer: `John 7 shows people whispering because they fear leaders, dismissing Jesus because they think they know His origins, and judging before listening. The chapter invites honest attention before confident conclusions.`,
    },
    respond: {
      question: `What thirst can you bring directly to Jesus instead of masking it with argument or distraction?`,
      answer: `I can name the longing beneath my activity or defensiveness and ask Jesus to meet me by His Spirit. Coming to drink means receiving from Him rather than only discussing Him.`,
    },
    prayer: `Jesus, I bring You the thirst I cannot satisfy or explain away. Give me Your living water by the Spirit and free me from fear, pride, and careless judgment.`,
    carryTruth: `Jesus invites every thirsty person to come, believe, and receive the Spirit's life.`,
  },
  {
    chapter: 8,
    subtitle: `Listen for Jesus' claims about light, freedom, truth, and His identity.`,
    summary: `The chapter opens with religious leaders using a woman caught in adultery to test Jesus, but He exposes their readiness to condemn and tells her to leave her sin. Jesus then declares Himself the light of the world and promises the light of life to those who follow Him. A long dispute follows over whether His testimony is valid and where He comes from. Jesus says that knowing the truth will make His disciples free, while His opponents insist that their descent from Abraham means they have never been enslaved. He identifies sin as slavery and explains that true children of Abraham would receive the One sent by God. The conflict reaches its height when Jesus says that before Abraham existed, “I am,” and the crowd takes up stones.`,
    keyVerse: {
      reference: 'John 8:12',
      translation: 'KJV',
      text: `“Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.”`,
      note: `Jesus presents Himself as the world's light and connects freedom from darkness with following Him.`,
    },
    contexts: [
      {
        title: 'The woman caught in adultery',
        body: `The account in John 7:53–8:11 appears in the KJV and has been treasured throughout church history, but the earliest surviving Greek manuscripts do not place it here. Modern Bibles often mark the passage while retaining it, and readers should know the textual history without missing its serious treatment of sin, hypocrisy, and mercy.`,
      },
      {
        title: `Abraham's children`,
        body: `Jesus does not deny His opponents' physical descent from Abraham. He distinguishes ancestry from spiritual resemblance: Abraham received God's promise, while they seek to kill the One who speaks God's truth.`,
      },
      {
        title: 'Before Abraham was, I am',
        body: `Jesus contrasts Abraham's coming into existence with His own continuing identity. The wording also recalls God's divine name in Exodus, which helps explain why His hearers respond by trying to stone Him.`,
      },
    ],
    lookAgain: {
      question: `Trace the words “light,” “truth,” “free,” and “word” through John 8. How are they connected?`,
      answer: `Jesus is the light who reveals the Father, and remaining in His word marks genuine disciples. His word brings knowledge of the truth, and the truth frees people from slavery to sin so the Son can make them truly free.`,
    },
    reflect: {
      question: `Where might confidence in your background or knowledge be keeping you from recognizing a deeper bondage?`,
      answer: `Jesus' opponents appeal to ancestry and certainty while resisting His word. The chapter asks me to let the Son name the slavery I would rather deny and to receive freedom as His gift.`,
    },
    respond: {
      question: `What word of Jesus do you need to remain in rather than merely agree with today?`,
      answer: `I can choose one clear saying of Jesus from this chapter, return to it throughout the day, and let it question my habits. Remaining means allowing His truth to shape action over time.`,
    },
    prayer: `Jesus, light of the world, expose the darkness and bondage I would rather deny. Keep me in Your word, lead me into truth, and make me truly free.`,
    carryTruth: `The Son brings true freedom to those who remain in His word.`,
  },
  {
    chapter: 9,
    subtitle: `Watch sight and blindness change meaning as the healed man tells his story.`,
    summary: `Jesus and His disciples meet a man blind from birth, and Jesus rejects the assumption that a particular sin directly caused his condition. Jesus makes clay, sends the man to wash in the pool of Siloam, and the man returns seeing. Neighbors question whether he is the same person, and the Pharisees investigate because Jesus healed on the Sabbath. The man's testimony grows bolder as repeated questioning moves him from calling Jesus a man to recognizing Him as a prophet and someone from God. His parents fear being put out of the synagogue, and the leaders eventually cast the healed man out. Jesus finds him, reveals Himself as the Son of God, receives his worship, and turns the discussion toward spiritual sight and blindness.`,
    keyVerse: {
      reference: 'John 9:25',
      translation: 'KJV',
      text: `“He answered and said, Whether he be a sinner or no, I know not: one thing I know, that, whereas I was blind, now I see.”`,
      note: `The healed man holds to the clear work of Jesus even while powerful people pressure him to deny it.`,
    },
    contexts: [
      {
        title: 'Sin and suffering',
        body: `The disciples assume the man's blindness must identify a particular sinner, but Jesus refuses their either-or explanation. His answer does not explain every cause of suffering; it redirects attention from blame toward the work of God that will be revealed.`,
      },
      {
        title: 'The pool of Siloam',
        body: `Siloam was a water reservoir in Jerusalem, and John notes that its name means “Sent.” The man is sent there by the One repeatedly described in John as sent by the Father.`,
      },
      {
        title: 'Put out of the synagogue',
        body: `Exclusion from the synagogue carried religious and social consequences, not merely the loss of a weekly meeting. The parents' fear highlights the real cost of publicly confessing Jesus.`,
      },
    ],
    lookAgain: {
      question: `Follow what the healed man says about Jesus in verses 11, 17, 25, 30–33, and 35–38. What changes?`,
      answer: `He begins with “a man that is called Jesus,” then calls Him a prophet, defends the undeniable healing, argues that He must be from God, and finally believes in and worships the Son of God. Pressure does not erase his witness; it clarifies it.`,
    },
    reflect: {
      question: `Who seems able to see most clearly in this chapter, and what keeps the others from seeing?`,
      answer: `The formerly blind man grows in sight because he responds honestly to what Jesus has done. Those confident that they already see become more blind through fear, fixed conclusions, and unwillingness to follow the evidence.`,
    },
    respond: {
      question: `What simple, truthful testimony about Jesus can you hold without claiming to know everything?`,
      answer: `I can name what I actually know about Jesus' work in my life or in this passage without exaggerating. Honest witness can say, like the man, that I do not know every answer but I will not deny what has become clear.`,
    },
    prayer: `Jesus, give me honest sight and courage when truth carries a cost. Find me in rejection, deepen my faith, and keep confident blindness from hardening my heart.`,
    carryTruth: `Honest response to Jesus leads toward sight, faith, and worship.`,
  },
  {
    chapter: 10,
    subtitle: `Hear the difference between the shepherd's voice and every voice that harms.`,
    summary: `Jesus describes a sheepfold where the true shepherd enters properly, calls his own sheep by name, and leads them out. Because His hearers do not understand, He explains that He is both the door for the sheep and the good shepherd. Unlike thieves and hired workers, He comes to give life and willingly lays down His life for the sheep. He knows His sheep, is known by them, and speaks of bringing other sheep into one flock. At the Feast of Dedication, leaders demand a plain answer about whether He is the Christ. Jesus points to His works, promises that no one will snatch His sheep from His hand, and declares His unity with the Father, leading again to an attempt to seize Him.`,
    keyVerse: {
      reference: 'John 10:11',
      translation: 'KJV',
      text: `“I am the good shepherd: the good shepherd giveth his life for the sheep.”`,
      note: `Jesus defines His shepherding authority by His willing, self-giving death for those who belong to Him.`,
    },
    contexts: [
      {
        title: `Shepherds of God's people`,
        body: `Israel's Scriptures often describe kings and leaders as shepherds, and Ezekiel 34 condemns shepherds who feed themselves while harming the flock. God promises to seek His sheep and set one Davidic shepherd over them, forming a strong backdrop to Jesus' claims.`,
      },
      {
        title: 'Door and shepherd',
        body: `Jesus uses more than one image in the same teaching. As the door, He is the way into safety and pasture; as the shepherd, He personally knows, leads, protects, and gives His life for the sheep.`,
      },
      {
        title: 'The Feast of Dedication',
        body: `Also known as Hanukkah, this winter feast remembered the temple's rededication after its desecration in the second century BC. The setting intensifies questions about true leadership, consecration, and Jesus' claim to be the One sent by the Father.`,
      },
    ],
    lookAgain: {
      question: `Make two columns from John 10:1–18: what the good shepherd does and what thieves or hired workers do.`,
      answer: `The good shepherd enters rightly, calls by name, leads, goes before, gives life, knows the sheep, gathers others, and lays down His life willingly. Thieves steal, kill, and destroy, while a hired worker abandons the sheep when danger comes.`,
    },
    reflect: {
      question: `Which voices most compete with the Shepherd's voice in your decisions, fears, or sense of worth?`,
      answer: `Competing voices may promise safety while using fear, pressure, comparison, or self-protection. Jesus' voice is recognized through His words and character as the Shepherd who knows His own and gives Himself for them.`,
    },
    respond: {
      question: `How can you become more familiar with Jesus' voice this week?`,
      answer: `I can return daily to a small section of His words, notice what He consistently reveals about Himself, and practice the next clear act of obedience. Familiarity grows through listening and following together.`,
    },
    prayer: `Good Shepherd, quiet the voices that steal, scatter, and lead me away from You. Teach me to recognize Your voice, follow Your lead, and rest in Your self-giving care.`,
    carryTruth: `The Good Shepherd knows His sheep, leads them, and gives His life for them.`,
  },
  {
    chapter: 11,
    subtitle: `Stay with the grief, delay, revelation, and life in Lazarus's story.`,
    summary: `Martha and Mary send word that their brother Lazarus is sick, yet Jesus remains where He is for two more days. He tells His disciples that Lazarus has died and then travels toward Bethany despite danger near Jerusalem. Martha meets Him with grief and faith, and Jesus identifies Himself as the resurrection and the life. Mary later comes weeping, and Jesus is deeply moved and weeps beside the mourners. At the tomb, He thanks the Father, calls Lazarus out, and tells the people to unbind him. Many believe, but the sign also leads the council to plan Jesus' death, with Caiaphas unknowingly speaking of one man dying for the people.`,
    keyVerse: {
      reference: 'John 11:25–26',
      translation: 'KJV',
      text: `“Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live: And whosoever liveth and believeth in me shall never die. Believest thou this?”`,
      note: `Jesus directs Martha's hope beyond a future event to Himself as the source of resurrection and life.`,
    },
    contexts: [
      {
        title: 'Four days in the tomb',
        body: `John emphasizes that Lazarus has been buried four days before Jesus arrives. The detail removes any suggestion of a brief fainting spell and makes the sign unmistakably a confrontation with death.`,
      },
      {
        title: 'Mourning at Bethany',
        body: `Family and community mourning included gathering, weeping, and accompanying bereaved relatives to the tomb. Jesus enters this grief fully: His knowledge that He will raise Lazarus does not make Him detached from sorrow.`,
      },
      {
        title: `Caiaphas's words`,
        body: `Caiaphas argues politically that one man should die to preserve the nation from Roman intervention. John sees a meaning beyond Caiaphas's intent: Jesus will die not only for the nation but to gather God's scattered children.`,
      },
    ],
    lookAgain: {
      question: `Notice how Martha, Mary, Jesus, and the crowd each respond to death. What does Jesus add to the scene?`,
      answer: `Martha speaks faith through questions, Mary falls at Jesus' feet in grief, and the crowd mourns and speculates. Jesus shares their sorrow, reveals Himself as resurrection and life, prays to the Father, and calls the dead man out.`,
    },
    reflect: {
      question: `What does Jesus' combination of tears and resurrection power teach you about bringing grief to Him?`,
      answer: `Jesus does not treat grief as unbelief or hurry past it with a correct answer. He enters sorrow with compassion while remaining the One whose life and authority are greater than the tomb.`,
    },
    respond: {
      question: `Is there a place of grief or delay where you can answer Jesus' question, “Believest thou this?”`,
      answer: `I can tell Jesus what hurts and confess the truth I can hold, even if it is incomplete like Martha's understanding. Faith here may mean staying in relationship with Him while the outcome remains beyond me.`,
    },
    prayer: `Jesus, resurrection and life, meet me in grief without asking me to pretend it does not hurt. Deepen my trust in who You are when Your timing is difficult and death seems final.`,
    carryTruth: `Jesus enters human grief as the resurrection and the life.`,
  },
  {
    chapter: 12,
    subtitle: `Follow Jesus toward His hour, where glory is revealed through costly love and death.`,
    summary: `Six days before Passover, Mary anoints Jesus' feet with costly perfume, and Jesus receives the act in light of His burial. A crowd gathers because of Lazarus, leading the chief priests to plan Lazarus's death as well as Jesus'. Jesus enters Jerusalem on a young donkey while people greet Him as Israel's king. When Greeks ask to see Him, Jesus announces that His hour has come and compares His death to a grain of wheat that bears fruit by falling into the ground. A voice from heaven answers as Jesus speaks of the world's judgment and of drawing people to Himself when He is lifted up. The chapter closes by showing both persistent unbelief and hidden belief, then summarizes Jesus' call to believe in the One who sent Him and walk in His light.`,
    keyVerse: {
      reference: 'John 12:24–25',
      translation: 'KJV',
      text: `“Verily, verily, I say unto you, Except a corn of wheat fall into the ground and die, it abideth alone: but if it die, it bringeth forth much fruit. He that loveth his life shall lose it; and he that hateth his life in this world shall keep it unto life eternal.”`,
      note: `Jesus interprets His approaching death as the fruitful path of glory and calls His followers into the same surrendered pattern.`,
    },
    contexts: [
      {
        title: 'Anointing for burial',
        body: `Mary's perfume is extraordinarily valuable, and wiping Jesus' feet with her hair makes the act deeply personal and socially unguarded. Jesus connects her devotion with His coming burial, whether or not she understands all that her act signifies.`,
      },
      {
        title: 'A king on a donkey',
        body: `The crowd's palm branches and acclamation carry royal and national hopes. Jesus' entry on a young donkey fulfills Zechariah 9:9 and presents a king whose manner and mission challenge triumphalist expectations.`,
      },
      {
        title: 'The hour has come',
        body: `Earlier chapters repeatedly say Jesus' hour has not yet come. The arrival of Greeks who wish to see Him marks a turning point: Jesus now speaks of His hour of glorification, meaning His death, resurrection, and their worldwide fruit.`,
      },
    ],
    lookAgain: {
      question: `Compare the different responses to Jesus in John 12: Mary, Judas, the crowd, the leaders, the Greeks, and secret believers.`,
      answer: `Mary gives costly love, Judas disguises self-interest as concern, the crowd celebrates signs and kingship, leaders protect their position, Greeks seek Jesus, and some rulers believe but hide it because they love human praise. Each response reveals what the person values.`,
    },
    reflect: {
      question: `Where does love of approval make your belief quieter or less obedient than it should be?`,
      answer: `John describes people who believe yet will not confess Jesus because exclusion threatens them and human praise matters more than God's praise. The passage asks what my silence is protecting.`,
    },
    respond: {
      question: `What costly act of love or surrendered obedience fits Jesus' grain-of-wheat pattern in your life?`,
      answer: `I can release one form of self-protection in order to love faithfully, without trying to manufacture suffering. The faithful response may be generous giving, truthful confession, patient service, or public allegiance to Jesus.`,
    },
    prayer: `Lord Jesus, teach me to see Your cross as glory rather than defeat. Free me from loving praise and self-protection, and form in me the fruitful surrender of a faithful servant.`,
    carryTruth: `Jesus' glory is revealed through self-giving love that brings life from death.`,
  },
  {
    chapter: 13,
    subtitle: `Enter the upper room and watch Jesus love, serve, warn, and command.`,
    summary: `Before Passover, Jesus knows His hour has come and loves His own to the end. During supper, He rises, washes His disciples' feet, and returns to explain the example He has given them. Peter first refuses and then asks for more, but Jesus tells him that receiving His cleansing is necessary. Jesus identifies Judas as the betrayer by giving him a morsel, and Judas leaves into the night. With betrayal underway, Jesus speaks of the Son of Man being glorified and gives His disciples a new command to love one another as He has loved them. Peter promises to lay down his life for Jesus, but Jesus predicts that he will deny Him three times before the rooster crows.`,
    keyVerse: {
      reference: 'John 13:34–35',
      translation: 'KJV',
      text: `“A new commandment I give unto you, That ye love one another; as I have loved you, that ye also love one another. By this shall all men know that ye are my disciples, if ye have love one to another.”`,
      note: `Jesus makes His own self-giving love both the pattern and the public mark of His disciples.`,
    },
    contexts: [
      {
        title: 'Washing feet',
        body: `Foot washing was low-status work made necessary by dusty roads and open sandals. By taking the servant's place, Jesus does not set aside His identity as Lord and Teacher; He shows what His authority and love look like.`,
      },
      {
        title: 'Reclining at the meal',
        body: `Guests reclined beside a low table rather than sitting upright in modern chairs. This arrangement explains how the beloved disciple could lean near Jesus and how Jesus could give Judas the dipped morsel.`,
      },
      {
        title: 'A new commandment',
        body: `The command to love was not new in the sense that love had never been required. Its defining measure is newly concentrated in Jesus' own love: “as I have loved you,” moving toward His willing death.`,
      },
    ],
    lookAgain: {
      question: `What does Jesus know in verses 1–3, and what does He do because of that knowledge in verses 4–17?`,
      answer: `Jesus knows His hour has come, that He returns to the Father, and that all things are in His hands. Secure in that identity and authority, He takes the servant's place, washes feet, and calls His disciples to follow His example.`,
    },
    reflect: {
      question: `Is it harder for you to receive humble service or to offer it, and what might that reveal?`,
      answer: `Peter's resistance shows that receiving from Jesus can confront pride as surely as serving others can. The chapter invites both surrender to Jesus' cleansing and willingness to take a low place in love.`,
    },
    respond: {
      question: `Whose good can you quietly serve without needing the act to be noticed or returned?`,
      answer: `I can choose a concrete need that is ordinary, inconvenient, or beneath the attention I usually seek. Serving in Jesus' pattern means acting from loved security rather than using service to earn worth.`,
    },
    prayer: `Jesus, let me receive the cleansing and love I cannot provide for myself. Give me Your humble posture so that my service and love make Your discipleship visible.`,
    carryTruth: `Jesus' disciples are recognized by love shaped after His humble, self-giving example.`,
  },
  {
    chapter: 14,
    subtitle: `Receive Jesus' words to troubled disciples about home, the Father, and the Spirit.`,
    summary: `After predicting betrayal and denial, Jesus tells His troubled disciples to believe in God and in Him. He promises room in His Father's house and says He will prepare a place and receive them to Himself. When Thomas asks the way, Jesus identifies Himself as the way, the truth, and the life, the One through whom people come to the Father. In response to Philip, Jesus explains that seeing Him is seeing the Father because He and the Father dwell in one another. He promises that the Father will give another Comforter, the Spirit of truth, who will remain with and in His disciples and teach them. Jesus leaves His own peace, calls His followers to love Him through obedience, and prepares them for His departure before it occurs.`,
    keyVerse: {
      reference: 'John 14:6',
      translation: 'KJV',
      text: `“Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.”`,
      note: `Jesus answers the question of the way not with a route or method but with His own person and relationship to the Father.`,
    },
    contexts: [
      {
        title: `My Father's house`,
        body: `The KJV's “many mansions” translates a word for dwelling places or rooms, emphasizing abundant welcome in the Father's household rather than separate luxurious estates. Jesus' promise centers on being with Him where He is.`,
      },
      {
        title: 'Another Comforter',
        body: `The word translated “Comforter” can also carry the senses of advocate, helper, or one called alongside. Jesus promises another who will continue His presence with the disciples: the Holy Spirit, who teaches, reminds, dwells within, and remains.`,
      },
      {
        title: 'Greater works',
        body: `Jesus connects the disciples' works with His going to the Father and their asking in His name. The promise should not be reduced to personal spectacle; Acts shows the risen Jesus extending His saving work through Spirit-empowered witnesses across peoples and places.`,
      },
    ],
    lookAgain: {
      question: `Find each promise Jesus gives to His troubled disciples in John 14. What kind of presence does He promise?`,
      answer: `He promises a place with Him, access to the Father, answered prayer in His name, another Comforter, His own continuing presence, the Spirit's teaching, and His peace. His departure will not leave them orphaned.`,
    },
    reflect: {
      question: `Which promise in this chapter meets the particular shape of your troubled heart right now?`,
      answer: `Jesus addresses fear with more than a demand to calm down. He anchors His disciples in who He is, where He is going, the Father's welcome, the Spirit's presence, and a peace different from what the world gives.`,
    },
    respond: {
      question: `How can love for Jesus become visible through obedience in one specific choice?`,
      answer: `I can identify one command or teaching of Jesus I already understand and act on it without postponing for a stronger feeling. Obedience is not payment for His presence; it is love responding to the One who has come near.`,
    },
    prayer: `Jesus, steady my troubled heart in You as the way, the truth, and the life. Teach me by Your Spirit, make my love obedient, and give me the peace the world cannot give.`,
    carryTruth: `Jesus brings troubled disciples to the Father and remains with them by the Spirit.`,
  },
  {
    chapter: 15,
    subtitle: `Remain with Jesus' picture of the vine, its fruit, and costly friendship.`,
    summary: `Jesus identifies Himself as the true vine and His Father as the husbandman who tends every branch. He calls His disciples to abide in Him because a branch cannot bear fruit apart from the vine. Fruitfulness grows from this continuing union, while separation from Jesus leaves people unable to accomplish anything of lasting spiritual value. Abiding also includes receiving His words, obeying His commands, and remaining in His love and joy. Jesus commands His disciples to love one another as He has loved them, a love defined by laying down one's life for friends. He then prepares them for the world's hatred and promises the Spirit of truth, who will testify about Him alongside their own witness.`,
    keyVerse: {
      reference: 'John 15:5',
      translation: 'KJV',
      text: `“I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.”`,
      note: `Jesus makes ongoing dependence on Him, rather than self-generated effort, the source of genuine fruitfulness.`,
    },
    contexts: [
      {
        title: 'The true vine',
        body: `Israel is often pictured as a vine in the Old Testament, sometimes one that fails to produce the fruit God seeks. By calling Himself the true vine, Jesus presents Himself as the faithful source and center of God's fruitful people.`,
      },
      {
        title: 'Pruning and cleansing',
        body: `Vine growers cut away what hinders fruit and tend healthy branches for greater yield. Jesus also tells the disciples they are already “clean” through His word, linking the Father's careful pruning with the shaping power of what Jesus has spoken.`,
      },
      {
        title: 'Servants and friends',
        body: `Jesus remains Lord, yet He calls His disciples friends because He has made known what He heard from the Father. Friendship here is not casual equality; it is chosen, disclosed, obedient relationship shaped by His sacrificial love.`,
      },
    ],
    lookAgain: {
      question: `In John 15:1–17, what is connected with abiding, and what fruit does abiding produce?`,
      answer: `Abiding involves remaining in Jesus, letting His words remain, keeping His commands, and continuing in His love. It produces answered prayer aligned with Him, fruit that glorifies the Father, obedience, joy, lasting love, and faithful witness.`,
    },
    reflect: {
      question: `Where are you trying to manufacture fruit without receiving life from the Vine?`,
      answer: `Activity can look fruitful while being driven by fear, image, or self-reliance. Jesus begins with relationship and dependence: fruit grows because the branch remains connected to His life.`,
    },
    respond: {
      question: `What small rhythm could help you abide in Jesus rather than hurry past Him?`,
      answer: `I can choose a repeatable moment to receive Jesus' words, answer Him in prayer, and obey what becomes clear. The rhythm is not a technique for control but a way of remaining available to the Vine.`,
    },
    prayer: `Jesus, true Vine, keep me from the empty strain of trying to bear fruit apart from You. Let Your words remain in me, deepen my obedience, and make my love resemble Yours.`,
    carryTruth: `Lasting fruit grows from abiding in Jesus, the true Vine.`,
  },
  {
    chapter: 16,
    subtitle: `Hear Jesus prepare His friends for sorrow, witness, prayer, and enduring peace.`,
    summary: `Jesus warns His disciples that exclusion and persecution will come from people who believe they are serving God. He explains that His departure is for their good because He will send the Comforter. The Spirit will expose the world's error concerning sin, righteousness, and judgment and will guide the disciples into truth while glorifying Jesus. Jesus speaks of a little while in which they will not see Him and then will see Him again, a saying they struggle to understand. He compares their coming sorrow and joy to a woman whose labor anguish gives way when a child is born. The chapter ends with the disciples claiming understanding, Jesus predicting their scattering, and His promise that they can have peace in Him because He has overcome the world.`,
    keyVerse: {
      reference: 'John 16:33',
      translation: 'KJV',
      text: `“These things I have spoken unto you, that in me ye might have peace. In the world ye shall have tribulation: but be of good cheer; I have overcome the world.”`,
      note: `Jesus offers peace without denying real trouble, grounding courage in His completed victory over the world.`,
    },
    contexts: [
      {
        title: 'Service without knowing God',
        body: `Jesus warns that some persecutors will think they are offering service to God. Religious conviction alone does not guarantee faithfulness; zeal that does not know the Father or the Son can become destructive.`,
      },
      {
        title: `The Spirit's work`,
        body: `The Spirit does not draw attention away from Jesus. He exposes the world's false verdict, guides the apostolic witnesses into truth, declares what belongs to Jesus, and glorifies Him.`,
      },
      {
        title: 'A little while',
        body: `The disciples' sorrow centers on Jesus' imminent death and absence, while their joy begins with seeing Him risen. The childbirth image shows anguish transformed by a new reality, not dismissed as if it never mattered.`,
      },
    ],
    lookAgain: {
      question: `What does Jesus say will happen to the disciples, and what provision does He promise for each difficulty?`,
      answer: `They will face exclusion, persecution, confusion, grief, scattering, and trouble. Jesus prepares them with His words, sends the Spirit to guide and testify, gives access to the Father in prayer, promises joy after sorrow, and offers peace in His victory.`,
    },
    reflect: {
      question: `How does Jesus' honest promise of trouble differ from either despair or false reassurance?`,
      answer: `Jesus neither hides suffering nor treats it as the final reality. His peace exists “in me” while trouble remains “in the world,” so courage rests in His overcoming rather than in an easy forecast.`,
    },
    respond: {
      question: `Where can you practice courage rooted in Jesus' victory rather than confidence in a painless outcome?`,
      answer: `I can face one difficult conversation, responsibility, or uncertainty without pretending it will be easy. Courage can tell the truth about trouble while choosing to remain in Jesus' peace and ask the Father for help.`,
    },
    prayer: `Jesus, keep me from confusing peace with the absence of trouble. By Your Spirit, guide me into truth and give me courage rooted in Your victory over the world.`,
    carryTruth: `Jesus gives peace within real trouble because He has overcome the world.`,
  },
  {
    chapter: 17,
    subtitle: `Listen as Jesus prays for glory, protection, holiness, unity, and love.`,
    summary: `Jesus lifts His eyes to the Father and announces that His hour has come. He asks to be glorified so that He may glorify the Father, speaking of the glory He shared with the Father before the world existed. Jesus defines eternal life as knowing the only true God and Jesus Christ whom He sent. He prays for the disciples the Father gave Him, asking that they be protected in God's name, filled with His joy, and kept from the evil one while remaining in the world. He asks the Father to sanctify them in the truth and sends them into the world as He was sent. Jesus then prays for future believers, asking that they share a visible unity rooted in the Father and Son so the world may know the Father's mission and love.`,
    keyVerse: {
      reference: 'John 17:3',
      translation: 'KJV',
      text: `“And this is life eternal, that they might know thee the only true God, and Jesus Christ, whom thou hast sent.”`,
      note: `Eternal life is described not merely as endless existence but as knowing the Father through the Son He sent.`,
    },
    contexts: [
      {
        title: `Jesus' prayer`,
        body: `John 17 is often called Jesus' high-priestly prayer, though that title is not part of the biblical text. The prayer gathers themes from His farewell teaching and turns them toward the Father before His arrest.`,
      },
      {
        title: 'Glory and the cross',
        body: `In John, Jesus' glorification includes the cross rather than bypassing it. As the hour arrives, the Son glorifies the Father by completing the work given to Him and then returning to the glory He shared before creation.`,
      },
      {
        title: 'Unity for witness',
        body: `Jesus' prayer for oneness is rooted in the shared life and love of the Father and Son. It does not erase every distinction among believers, but it refuses a divided life that contradicts the reconciling message they carry.`,
      },
    ],
    lookAgain: {
      question: `List what Jesus asks the Father to do for His present and future disciples. Which requests repeat?`,
      answer: `Jesus asks the Father to keep them, make them one, fill them with joy, protect them from evil, sanctify them in truth, bring future believers into unity, let them see His glory, and place divine love within them. Protection, truth, unity, mission, and shared glory recur.`,
    },
    reflect: {
      question: `What changes when you realize Jesus prayed for people who would believe through the apostles' word, including believers today?`,
      answer: `Faith is not an isolated private discovery; it comes through a preserved witness and enters a people Jesus desires to protect, sanctify, unite, and send. His prayer gives dignity and responsibility to shared Christian life.`,
    },
    respond: {
      question: `What can you do to protect truth and unity together in one Christian relationship?`,
      answer: `I can refuse both false peace and needless division by speaking truth with love, listening carefully, and praying for the other person's holiness and good. Unity begins in shared life with the Father and Son, not in winning every preference.`,
    },
    prayer: `Father, let me know You through Jesus Christ and be sanctified by Your truth. Keep Your people from evil, make us one in holy love, and send us faithfully into the world.`,
    carryTruth: `Jesus prays for a truthful, protected, loving, and united people sent into the world.`,
  },
  {
    chapter: 18,
    subtitle: `Follow Jesus from the garden to Pilate, noticing who truly acts with authority.`,
    summary: `Jesus enters a garden with His disciples, where Judas arrives with soldiers and officers to arrest Him. Jesus steps forward, identifies Himself, protects His disciples, and stops Peter's attempt to defend Him with a sword. He is taken first to Annas, where He answers questions about His teaching while being struck by an officer. Outside, Peter denies being Jesus' disciple three times, and the rooster crows. The leaders bring Jesus to Pilate while avoiding ceremonial defilement, and Pilate questions Him about kingship. Jesus says His kingdom is not from this world and that He came to bear witness to the truth, yet the crowd chooses Barabbas when Pilate offers to release a prisoner.`,
    keyVerse: {
      reference: 'John 18:37',
      translation: 'KJV',
      text: `“Pilate therefore said unto him, Art thou a king then? Jesus answered, Thou sayest that I am a king. To this end was I born, and for this cause came I into the world, that I should bear witness unto the truth. Every one that is of the truth heareth my voice.”`,
      note: `Before political power, Jesus defines His royal mission as bearing witness to truth and gathering those who hear His voice.`,
    },
    contexts: [
      {
        title: 'Annas and Caiaphas',
        body: `Caiaphas was the acting high priest, while Annas was his father-in-law and a former high priest who retained considerable influence. Jesus is questioned within this powerful priestly household before being taken to the Roman governor.`,
      },
      {
        title: 'A kingdom not from this world',
        body: `Jesus does not say His kingdom has nothing to do with this world; He says its source is not from here. The evidence is that His servants do not fight to prevent His arrest, because His kingship does not advance through the world's coercive methods.`,
      },
      {
        title: 'Barabbas',
        body: `Pilate offers a Passover release, and the crowd asks for Barabbas instead of Jesus. John calls Barabbas a robber, a term that could also be used for an insurrectionist, sharpening the contrast between competing kinds of kingship and deliverance.`,
      },
    ],
    lookAgain: {
      question: `Who appears in control at each stage of John 18, and what details reveal Jesus' own authority?`,
      answer: `Soldiers, priestly leaders, and Pilate exercise visible power, yet Jesus steps forward knowingly, causes the arresting group to fall back, protects His disciples, submits to the Father's cup, challenges unjust treatment, and defines His kingdom before Pilate. He is not a surprised victim.`,
    },
    reflect: {
      question: `Which pressure is most likely to make you hide your connection to Jesus as Peter did?`,
      answer: `Peter's confidence collapses in an ordinary courtyard under repeated social pressure. The scene invites honest recognition of where fear of association, loss, or embarrassment can overpower sincere intentions.`,
    },
    respond: {
      question: `How can you bear witness to truth without adopting the world's methods of fear or force?`,
      answer: `I can speak clearly, refuse manipulation, protect others rather than myself, and accept that faithful truth-telling may be costly. Jesus' kingdom shapes not only what I defend but how I defend it.`,
    },
    prayer: `King Jesus, keep me near Your voice when fear makes denial seem safer. Teach me to bear witness to truth with courage, restraint, and trust in Your greater authority.`,
    carryTruth: `Jesus' kingdom bears witness to truth without relying on the world's coercive power.`,
  },
  {
    chapter: 19,
    subtitle: `Remain at the cross and attend to how Jesus completes His work.`,
    summary: `Pilate has Jesus flogged, and soldiers dress Him in a crown of thorns and a purple robe to mock His kingship. Though Pilate repeatedly says he finds no fault in Jesus, pressure from the leaders and crowd leads him to hand Jesus over for crucifixion. Jesus carries the cross to Golgotha, where He is crucified between two others under a title naming Him King of the Jews. Soldiers divide His garments, and Jesus entrusts His mother to the beloved disciple. Knowing that His work is accomplished, Jesus receives vinegar, says, “It is finished,” and gives up His spirit. His side is pierced rather than His legs broken, and Joseph of Arimathea and Nicodemus place His body in a nearby new tomb.`,
    keyVerse: {
      reference: 'John 19:30',
      translation: 'KJV',
      text: `“When Jesus therefore had received the vinegar, he said, It is finished: and he bowed his head, and gave up the ghost.”`,
      note: `Jesus' final word announces that the work entrusted to Him has been brought to its intended completion.`,
    },
    contexts: [
      {
        title: 'King of the Jews',
        body: `The soldiers' robe, crown, greeting, and blows are meant as cruel parody, while Pilate's written title turns the charge into a public announcement. John lets the irony stand: the mocked and crucified Jesus is truly king, though His glory overturns ordinary expectations.`,
      },
      {
        title: 'Scripture fulfilled',
        body: `John repeatedly notes details that correspond to Scripture, including divided garments, thirst, unbroken bones, and a pierced figure. These connections present the cross as the fulfillment of God's purpose, not evidence that events escaped His control.`,
      },
      {
        title: 'Joseph and Nicodemus',
        body: `Both men had previously approached discipleship cautiously or secretly. At Jesus' death they step forward publicly, receive permission for His body, provide abundant burial spices, and place Him in a new tomb.`,
      },
    ],
    lookAgain: {
      question: `Mark each time John mentions kingship, fulfillment, or completion in John 19. How do those themes meet at the cross?`,
      answer: `Jesus is mocked, presented, rejected, and labeled as king while Scripture is repeatedly fulfilled around Him. His final “It is finished” shows that the cross is both human injustice and the deliberate completion of His God-given mission.`,
    },
    reflect: {
      question: `What do you learn about divine power by seeing Jesus' kingship displayed through suffering love?`,
      answer: `John does not portray Jesus as powerless, even when He is humiliated and killed. His authority appears in faithful self-giving, care for others, fulfillment of Scripture, and completion of the Father's work.`,
    },
    respond: {
      question: `How can you receive Christ's finished work instead of trying to prove or rescue yourself?`,
      answer: `I can confess the limits of self-salvation and rest my standing with God on what Jesus completed. From that place, obedience becomes grateful participation rather than an attempt to make His work sufficient.`,
    },
    prayer: `Crucified King, thank You for carrying the Father's work to completion through suffering love. Teach me to receive what You have finished and to live with grateful, faithful allegiance.`,
    carryTruth: `At the cross, Jesus completes His mission as the true and self-giving King.`,
  },
  {
    chapter: 20,
    subtitle: `Enter the empty tomb and listen to the witnesses who learn Jesus is alive.`,
    summary: `Mary Magdalene comes to the tomb while it is still dark and finds the stone removed. Peter and the beloved disciple run to the tomb, see the linen cloths, and return home while still not understanding the Scripture. Mary remains weeping until Jesus calls her by name, and she recognizes the risen Lord and carries His message to the disciples. That evening Jesus appears among the fearful disciples, shows His wounds, speaks peace, and sends them as the Father sent Him. Thomas is absent and refuses the others' testimony unless he sees and touches the wounds. Eight days later Jesus meets Thomas's demand with His presence, receives his confession as Lord and God, and John explains that his written signs are meant to lead readers to belief and life.`,
    keyVerse: {
      reference: 'John 20:31',
      translation: 'KJV',
      text: `“But these are written, that ye might believe that Jesus is the Christ, the Son of God; and that believing ye might have life through his name.”`,
      note: `John states the purpose of his Gospel: its selected signs bear witness to Jesus so readers may believe and have life.`,
    },
    contexts: [
      {
        title: 'The first day of the week',
        body: `All four Gospels place the discovery of the empty tomb on the first day of the week. John moves from darkness and grief into recognition, gathered joy, and new creation as the risen Jesus breathes on His disciples.`,
      },
      {
        title: 'Rabboni',
        body: `Mary recognizes Jesus when He speaks her name and answers with the Aramaic title “Rabboni,” meaning teacher or master. Her personal recognition immediately becomes a commission to carry His message to the others.`,
      },
      {
        title: `Thomas's confession`,
        body: `Thomas moves from refusing secondhand testimony to addressing Jesus as “My Lord and my God.” His confession echoes the Gospel's opening claim about the Word and provides a climactic response to the signs John has recorded.`,
      },
    ],
    lookAgain: {
      question: `Compare how the beloved disciple, Mary, the gathered disciples, and Thomas come to believe. What meets each person?`,
      answer: `The beloved disciple sees the tomb's evidence, Mary recognizes Jesus when He calls her name, the gathered disciples see His wounds and presence, and Thomas is invited to face the evidence he demanded. Jesus meets different people while moving each toward witness and belief.`,
    },
    reflect: {
      question: `Where do you see yourself in this chapter's movement from darkness, fear, grief, or doubt toward belief?`,
      answer: `John does not flatten every response into the same path. The risen Jesus meets grieving Mary, fearful disciples, and doubtful Thomas personally, while calling all of them beyond private experience into believing witness.`,
    },
    respond: {
      question: `What message of the risen Jesus are you being sent to carry, and to whom?`,
      answer: `I can speak simply about the peace, life, and identity of Jesus revealed in this Gospel to one person who needs hope. Witness does not require pretending certainty about every question; it points truthfully to the risen Lord.`,
    },
    prayer: `Risen Jesus, call me from fear and unbelief into the life Your signs reveal. Give me Your peace, strengthen my faith, and send me as a truthful witness to others.`,
    carryTruth: `The risen Jesus meets doubters and witnesses so that people may believe and have life.`,
  },
  {
    chapter: 21,
    subtitle: `Watch the risen Jesus provide, restore, commission, and call His disciples again.`,
    summary: `Seven disciples fish through the night on the Sea of Tiberias but catch nothing. At daybreak, the risen Jesus directs them to cast the net on the right side, and the great catch leads the beloved disciple to recognize Him. Jesus has prepared a charcoal fire with bread and fish and invites the disciples to breakfast. After the meal, He asks Peter three times whether he loves Him and entrusts him with feeding and tending His sheep. Jesus then speaks of the death by which Peter will glorify God and renews the call, “Follow me.” When Peter asks about the beloved disciple's future, Jesus redirects him from comparison to personal faithfulness, and the Gospel closes by affirming its witness while acknowledging that Jesus did far more than any book could contain.`,
    keyVerse: {
      reference: 'John 21:17',
      translation: 'KJV',
      text: `“He saith unto him the third time, Simon, son of Jonas, lovest thou me? Peter was grieved because he said unto him the third time, Lovest thou me? And he said unto him, Lord, thou knowest all things; thou knowest that I love thee. Jesus saith unto him, Feed my sheep.”`,
      note: `Jesus brings Peter's threefold failure into a threefold conversation of love, responsibility, and restored service.`,
    },
    contexts: [
      {
        title: 'The charcoal fire',
        body: `John mentions a charcoal fire only here and in the courtyard where Peter denied Jesus. The repeated detail links Peter's failure with the setting in which Jesus feeds him and restores his calling.`,
      },
      {
        title: 'One hundred fifty-three fish',
        body: `The precise count has inspired many symbolic explanations, but John does not provide one. The safest emphasis is the eyewitness vividness, the extraordinary provision, and the unbroken net despite the size of the catch.`,
      },
      {
        title: 'Feed my sheep',
        body: `Peter's love for Jesus is joined to responsibility for Jesus' flock. Restoration is not a return to self-confident promises; it becomes dependent, costly care shaped by following Jesus.`,
      },
    ],
    lookAgain: {
      question: `Compare Peter around the charcoal fire in John 18 with Peter around the fire in John 21. What does Jesus do with his failure?`,
      answer: `Peter denied Jesus three times while warming himself by the first fire. At the second, Jesus provides food, asks three times about Peter's love, entrusts him with the sheep, speaks honestly about cost, and calls him to follow again.`,
    },
    reflect: {
      question: `Do you more often let past failure define you or compare your calling with someone else's?`,
      answer: `Jesus addresses Peter's failure without discarding him, then refuses Peter's attempt to manage another disciple's future. Grace restores Peter to a particular path of love, service, and following.`,
    },
    respond: {
      question: `What faithful care belongs to your calling now, without comparison to another person's path?`,
      answer: `I can name the people or responsibility Jesus has actually placed before me and serve there with love. His words to Peter free me from measuring my obedience against someone else's assignment.`,
    },
    prayer: `Risen Lord, meet my failure with truthful grace and restore me to faithful love. Keep me from comparison, teach me to care for what You entrust, and help me follow You to the end.`,
    carryTruth: `Jesus restores failed disciples to loving service and calls them to follow without comparison.`,
  },
];

export const JOHN_GUIDED_STUDIES: GuidedBibleStudy[] =
  JOHN_CHAPTER_CONTENT.map(makeJohnStudy);
