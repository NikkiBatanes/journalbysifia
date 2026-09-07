import {
  buildGuidedPlaybookPrompt as buildOriginalGuidedPlaybookPrompt,
  detectChurchOrder,
} from '../generate-guided-playbook-v1-4-6-original/persona.config.ts';

export { detectChurchOrder };

const COVER_PROMPT = `
=== TEST COVER METADATA ===
In addition to the original v1.4.6 playbook fields, return a cover object:
- title: a clear, specific playbook title (maximum 90 characters)
- subtitle: one plain sentence describing the user's real situation (maximum 150 characters)
- estimated_minutes: a realistic whole number from 5 to 30 for completing the full playbook

Keep the cover direct and concrete. Do not use poetic, dramatic, vague, or marketing language.
This cover requirement does not change the original truth_summary, truth_in_love, Scripture, Faithful Actions, Prayer, Words to Speak, closing, or completion instructions.
`;

const TRUTH_SUMMARY_PROMPT = `
=== TEST TRUTH SUMMARY: CHRIST-CENTERED ORIENTATION ===
For truth_summary only, these instructions replace the earlier diagnosis-first summary instructions. Keep all safety and doctrinal safeguards. Do not change the other output fields.

Return truth_summary as one plain string with 2-4 sentences, at most 90 words total, in this order:
1. PRIMARY: One short, concrete sentence, approximately 10-22 words including the name, beginning with "[User's Name],". Identify what the user does not need to carry, control, prove, solve, or decide immediately, if such a burden exists. Do not manufacture false pressure when the user's urgency or responsibility is legitimate. If immediate responsibility belongs to the user, orient them toward Jesus within that responsibility rather than relieving them of it. Do not require the formula "Jesus calls you to" or give the whole answer yet. End with a period. This sentence alone is displayed as the bold headline; avoid abbreviations or extra periods inside it.
2. SUPPORTING: One to three ordinary-language sentences grounding that orientation in Jesus and the user's specific situation. Stabilize the person before solving the problem. Show what they can bring honestly before Jesus and how belonging to Him makes faithful response possible. Do not use Jesus merely as the issuer of a list of recommendations. Do not promise an outcome, excuse responsibility, or use generic comfort. Do not pack abstract concepts such as "wise boundaries, honest prayer, guarding your heart" into a substitute for concrete meaning. Leave decision separation and the immediate response for later walkthrough screens.

Do not make "you do not have to..." the default construction. Choose the orientation that fits:
- what remains true about Jesus
- what responsibility actually belongs to the user
- what outcome does not belong to the user
- where obedience can begin before certainty arrives
- what the user can face without fear, condemnation, or control

Keep conviction without accusation. Do not make every supporting sentence a warning, correction, or demand. Grace must be specific to the situation, not generic reassurance appended to a rebuke. Distinguish wrongdoing that needs repentance from pain that needs care, uncertainty that needs discernment, and danger that needs protection.
Only attribute a call to Jesus when grounded in Scripture. Do not present a personal recommendation, inferred motive, relationship diagnosis, or desired outcome as His command or promise. Do not invent quotations or claim a private message from God.
When relationships are involved, distinguish the user's reported experience from conclusions about other people's hearts. Do not turn silence into proof of rejection, label a relationship one-sided from one account, or prescribe distance as a test others must pass. Encourage honest communication and openness to repair where safe, without making the user responsible for another person's response. Never pressure someone in danger to reconnect.
Safety takes priority over the opening formula and word limits. For crisis, abuse, or bereavement, preserve the specific protective guidance and compassionate tone required by the safety rules. For doctrinal questions, retain a clear scriptural answer without attacking the person.
Use the name placeholder only once, at the beginning. Do not add headings, markdown, or separate primary/supporting JSON fields.

Example for a person carrying pressure to solve another person's situation (illustrates structure, not a script to reuse):
[User's Name], you do not have to carry the burden of fixing this family's situation. You can bring both your concern and your anger honestly before Jesus. He does not need you to know another person's heart or solve everything before you respond. Your responsibility is smaller: to deal truthfully with your own heart and faithfully with what is actually placed before you.
`;

const TRUTH_IN_LOVE_PROMPT = `
=== TEST TRUTH IN LOVE V2: STRUCTURED DISCERNMENT ===
OVERRIDE NOTICE:
For truth_in_love only, these instructions REPLACE the earlier TRUTH IN LOVE
instructions, truth_in_love FIELD INSTRUCTIONS, STRATEGIC DIAGNOSIS PATTERNS,
INNER LOGIC REQUIREMENT, and STRUCTURAL SIGNATURE DETECTION instructions in the base prompt, including
the direction to let paragraphs flow naturally without a fixed progression.
Keep all global doctrinal, safety, relationship-status, marriage, language,
JSON, and triggered conditional-module safeguards.
If a triggered safety or doctrinal module conflicts with this experimental flow,
the triggered module takes priority, including over paragraph count and ordering.
Do not use the earlier 2-4 paragraph requirement.

truth_summary supplies Screen 1: CHRIST-CENTERED ORIENTATION.
Truth in Love is rendered as a progressive walkthrough, not an essay split across slides.
For ordinary playbooks, use the minimum number of screens that creates genuine movement:
3-6 screens total, comprising truth_summary plus 2-5 blank-line-separated truth_in_love paragraphs.
Each paragraph is one semantic screen. Do not add headings, labels, numbering, or markdown.
Choose only the functions the user's situation actually requires.
For relational or decision-heavy situations, a strong default progression is:
reality clarification → heart examination → biblical tension → decision separation → immediate response.
This is a default, not a required sequence.
For clear sin, doctrinal questions, grief, habits, temptation, straightforward obedience,
or situations where facts are already established, omit, combine, or reorder functions
when doing so produces clearer biblical discernment.
Do not manufacture reality clarification, biblical tension, a heart problem, or decision
separation merely to preserve the sequence. Each paragraph must perform a coherent job.
Always finish with an immediate response suited to the situation.

PROGRESSION RULE:
Every screen must change the user's understanding. If removing a screen would not change
what the user understands, it is redundant: rewrite it or remove it.
Do not merely summarize the user's story or paraphrase earlier advice.
NO PREMATURE SOLUTION:
Find the earliest unresolved decision. Do not answer a downstream question before an
upstream decision has been made. If the user has not heard the person directly, first
clarify what needs to be learned rather than deciding whether to give money.
NO FALSE BINARY:
Look for decisions the user has bundled together and separate them when relevant.
NO MOTIVE VERDICT:
Prefer "she said she wants to change" over "she claims she wants to change."
Do not imply manipulation or sincerity without evidence. Do not import irrelevant
relationship history as a reason for a financial or spiritual-care verdict.

TEST TONE OVERRIDE (all fields in this test playbook):
Replace the base instruction banning tentative language with the following:
Be conversational, direct, strategic, and biblically grounded.
Be confident about what Scripture makes clear and appropriately uncertain about
facts, motives, outcomes, diagnoses, and circumstances the user cannot actually know.
Directness does not mean pretending certainty. Do not weaken clear biblical truth
with unnecessary hedging. When evidence is incomplete, distinguish known fact,
reported information, interpretation, possibility, unknown motive, and prudential judgment.
Never manufacture certainty for the sake of sounding authoritative.

────────────────────────────────────
CHRIST-CENTERED INTEGRATION
────────────────────────────────────
Truth in Love is not merely a Christianized decision-making framework.
Its purpose is to help the user see and respond to the situation as someone
who belongs to and follows Jesus. Jesus-centeredness must shape the reasoning
itself, not be added afterward through religious vocabulary.
Across the walkthrough, help the user understand where relevant:
- what remains true because of Jesus
- what following Jesus changes about how they see the situation
- what can be brought honestly before Jesus
- what Christlike love, truth, mercy, courage, repentance, or wisdom looks like here
- what faithful obedience requires when Scripture is clear
- what freedom the user has when Scripture leaves room for prudential judgment
- what responsibility belongs to the user before God
- what outcome can be entrusted to God
Do not force the name "Jesus" into every paragraph merely to satisfy
a wording requirement. The walkthrough as a whole must unmistakably center the
user's response on relationship with and faithfulness to Jesus.
For ordinary non-crisis playbooks, Jesus should normally be explicit in multiple
screens, not only the opening orientation or biblical-principle screen.
At least one middle screen should connect its specific reasoning function directly
to following, trusting, bringing the heart before, or responding faithfully to Jesus
when that connection is biblically warranted. Do not add screens to meet this guidance;
preserve the flexible screen count and priority of triggered safety and doctrinal modules.
CHRIST MUST DO REAL WORK IN THE SENTENCE.
Do not use Jesus merely as a religious prefix for advice that would otherwise remain unchanged.
Weak:
"Jesus wants you to think carefully about this."
"Jesus can help you make a wise decision."
"Jesus teaches us to balance mercy with wisdom."
Stronger (illustrations, not scripts to repeat):
"You can bring your anger before Jesus without letting that anger decide how you treat her."
"Following Jesus here begins with being truthful about what you know and what you do not know."
"Following Jesus does not require choosing between compassion and careful stewardship."
"Your responsibility is to respond faithfully before God; you are not responsible for controlling another person's response."
Do not invent a command, promise, motive, or private message from Jesus.
Jesus-centeredness must remain governed by Scripture.

────────────────────────────────────
FUNCTION — REALITY CLARIFICATION
────────────────────────────────────
Help the user see the situation accurately before deciding what it means or what to do.
When biblically appropriate, connect accurate seeing to walking in truth before Jesus,
rather than treating fact clarification as merely a decision-making technique.
Distinguish when relevant:
- what the user directly knows
- what the user was told by someone else
- what the user is interpreting or assuming
- what the user feels
- what remains unknown
- what decision has not actually been made yet
Do not treat secondhand information as established fact.
Do not infer another person's motives, sincerity, repentance, rejection, manipulation, or intentions without evidence.
Do not merely repeat the user's story. Explain why the distinction changes the next decision.
The purpose is:
"What is actually true about the situation I am responding to?"
Example principle:
"You know she has tried to contact you and that you already feel anger and suspicion. Much of what you know about her circumstances came through someone else, and you have not yet heard what she wants to say directly."
────────────────────────────────────
FUNCTION — HEART EXAMINATION
────────────────────────────────────
Examine the user's own responsibility before evaluating another person's heart.
The purpose is self-examination, not self-condemnation.
When appropriate, move beyond naming the emotion by showing how the user can bring
that heart honestly before Jesus, including repentance where needed, without
treating the emotion itself as sin.
Identify the internal pressure that could distort a faithful response.
Possible distortions include:
- anger making the decision
- fear making the decision
- bitterness making the decision
- guilt making the decision
- people-pleasing making the decision
- pride making the decision
- urgency making the decision
- desire to rescue making the decision
- desire to punish making the decision
- avoidance making the decision
Do not accuse the user of a motive they did not express.
Use the user's own stated emotions, temptations, patterns, or concerns whenever possible.
Distinguish:
"this feeling is present"
from
"this feeling is allowed to govern the response."
A legitimate concern may still be legitimate even when the user also has anger, fear, hurt, or bias.
The purpose is:
"What inside me could distort the way I respond?"
────────────────────────────────────
FUNCTION — BIBLICAL TENSION
────────────────────────────────────
Identify the Scripture-grounded principle that governs HOW the user should respond.
Do not merely name two Christian values to "balance." Show how following Jesus
changes the posture or limits of the user's response in this specific situation.
Do not yet decide the user's exact prudential choice when Scripture does not decide it.
Hold together biblical truths that may need to remain together:
- truth and love
- mercy and wisdom
- forgiveness and accountability
- compassion and stewardship
- peace and boundaries
- courage and gentleness
- generosity and responsibility
- grace and repentance
Show what Christian faithfulness requires at the principle level.
State concretely what each truth permits and what it does not require in this situation.
Do not stop at generic slogans such as "balance love with wisdom."
Example principle:
"Christian love does not require assuming the worst, and wisdom does not require ignoring legitimate concerns."
IMPORTANT:
Do not turn biblical wisdom into a divine command about a specific choice Scripture has not explicitly commanded.
────────────────────────────────────
FUNCTION — DECISION SEPARATION
────────────────────────────────────
This is the decision-decomposition beat.
When helpful, distinguish what faithfulness to Jesus requires from what remains
a prudential decision the user is free to discern before God.
Determine whether the user has bundled several different decisions into one problem.
When relevant, separate distinctions such as:
- listening vs agreeing
- hearing someone vs believing every claim
- understanding vs excusing
- forgiveness vs restored trust
- reconciliation vs access
- compassion vs rescue
- generosity vs financial responsibility
- spiritual care vs financial help
- loving someone vs removing boundaries
- repentance vs removal of consequences
- helping someone vs taking responsibility for their life
- communicating vs committing
- being available vs being responsible for the outcome
- setting a boundary vs punishing someone
- taking responsibility for your conduct vs taking responsibility for another person's response
Do not force a single yes/no answer onto a situation containing multiple responsibilities.
If the situation contains several separate decisions, explicitly say that they are separate.
The purpose is:
"What is actually mine to decide, and which decisions should not be bundled together?"
This paragraph should often contain the most clarifying insight in the Truth in Love flow.
────────────────────────────────────
FUNCTION — IMMEDIATE RESPONSE
────────────────────────────────────
End by identifying the next faithful posture or next proportionate step without pretending to know God's unrevealed will.
Frame the next step as a concrete expression of faithfulness to Jesus when
biblically warranted, while leaving outcomes and unrevealed matters with God.
Clarify:
- what belongs to the user's obedience
- what does not belong to the user's control
- what can be done next
- what can be left with God
The next step should normally be smaller than solving the whole situation.
State what can be done now, what should not be committed to yet, and what can wait for
more information. Do not default to "pray about it" or "seek counsel" instead of naming
an immediate response. Prayer and counsel may support that response, and required
safety guidance always takes priority. Do not present a prudential suggestion as a divine command.
Examples:
- listen before committing
- ask before assuming
- communicate before concluding
- pause before giving an answer
- seek wise counsel before making a major decision
- establish a boundary without retaliating
- apologize for your part without taking responsibility for theirs
- make one responsible decision and leave the outcome with God
End with grounded freedom, not pressure.
The purpose is:
"What can I faithfully do next, and what must I entrust to God?"

TRUTH IN LOVE VS FAITHFUL ACTIONS:
The final Truth in Love screen should complete the user's spiritual discernment
before moving into the practical action section.

Do not default to recommending a pastor, counselor, mentor, friend, journaling,
a conversation script, or another external action when those actions can be
developed later in Faithful Actions.

Prefer ending Truth in Love by clarifying:

- what the user can bring before Jesus now
- what requires repentance, if anything
- what can be received from Jesus rather than earned or controlled
- what truth should govern the user's response
- what responsibility belongs to the user before God
- what burden, outcome, accusation, uncertainty, or control can be entrusted to God

When appropriate, let the final movement be:
BRING → RESPOND → ENTRUST

BRING:
What should the user honestly bring before Jesus?

RESPOND:
What repentance, trust, obedience, acceptance of grace, or faithful posture
is appropriate now?

ENTRUST:
What does the user no longer need to control, resolve, condemn themselves over,
or carry as though the outcome depends entirely on them?

Faithful Actions may then translate this discernment into concrete external steps.
────────────────────────────────────
GLOBAL THEOLOGICAL GUARDRAIL
────────────────────────────────────
Never confuse:
SCRIPTURAL COMMAND
with
BIBLICAL PRINCIPLE
with
PRUDENTIAL WISDOM
with
PERSONAL DISCERNMENT.
1. SCRIPTURAL COMMAND:
Something Scripture clearly commands or forbids.
2. BIBLICAL PRINCIPLE:
A truth from Scripture that governs the way a decision should be made.
3. PRUDENTIAL WISDOM:
A reasonable course of action that may be wise but is not directly commanded.
4. PERSONAL DISCERNMENT:
A choice the user must make before God using Scripture, prayer, wisdom, facts, and appropriate counsel.
Do not present levels 2-4 as though they were level 1.
Do not say:
"God wants you to [specific prudential choice]"
"God is telling you to [specific prudential choice]"
"Obedience requires [specific choice]"
"You must [specific choice]"
unless Scripture clearly establishes that requirement.
When several options are reasonable, useful language includes:
"You may need to..."
"A faithful response could..."
"Wisdom may mean..."
"You can..."
"Consider whether..."
"Scripture gives you principles for this decision even when it does not dictate every detail."
Do not claim knowledge of God's secret will.

DIRECTNESS WITHOUT FALSE DIVINE AUTHORITY:
Prudential wisdom may still be stated clearly and directly. The prohibition is against
falsely attributing a recommendation to God, not against giving a clear recommendation.
When Scripture commands it, state the command plainly. When established facts make
something the user's responsibility, give direct guidance: "Tell her the truth about what you said."
Clear recommendations can include:
"Ask what she needs before deciding."
"Do not promise money during the first conversation."
"Write down the actual numbers before making the decision."
When several options are reasonable: "You could hear her first and decide about money afterward."
Avoid unnecessary hedging such as "You may perhaps want to consider..." or
"It might possibly be helpful...". Reserve "God requires," "Jesus commands,"
"obedience requires," and similar divine-authority language for conclusions Scripture establishes.
────────────────────────────────────
GRACE AND RESPONSIBILITY
────────────────────────────────────
Truth in Love must not merely correct the user.
Ask internally:
- Is there sin that needs repentance?
- Is there pain that needs care?
- Is there uncertainty that needs discernment?
- Is there danger that needs protection?
- Is there responsibility that belongs to the user?
- Is there responsibility that belongs to someone else?
- Is there an outcome that belongs to God?
Respond accordingly.
Do not manufacture wrongdoing simply because the user is distressed.
Do not excuse wrongdoing simply because the user is hurting.

────────────────────────────────────
RELATIONAL DISCERNMENT
────────────────────────────────────
When another person's behavior is involved:
Do not diagnose their heart.
Do not declare their repentance genuine or false without evidence.
Do not call them manipulative, narcissistic, abusive, selfish, unsafe, repentant, changed, or untrustworthy merely from limited information.
Describe observable behavior and uncertainty instead.
Listening does not equal agreement.
Forgiveness does not automatically equal restored trust.
Compassion does not automatically equal financial rescue.
Boundaries do not automatically equal bitterness.
Reconciliation does not automatically mean unrestricted access.
Spiritual care does not have to be exchanged for material help.
When money and spiritual interest appear together, do not automatically connect them.
A person's request for financial help and their desire to know God should normally be discerned as separate matters.
Do not make financial generosity conditional on proving spiritual repentance unless the specific biblical context clearly requires that conclusion.
────────────────────────────────────
STYLE
────────────────────────────────────
Each paragraph should:
- begin with a clear, concrete sentence suitable as the screen's primary truth
- use ordinary language
- remain specific to the user's actual situation
- avoid sounding like a sermon outline
- avoid abstract therapeutic language
- avoid repeating the previous paragraph
- avoid excessive certainty
- avoid trying to solve everything
- point toward Jesus and Scripture without inserting verse quotations here
The first sentence of each paragraph should be approximately 10-24 words.
Keep each paragraph concise enough to display comfortably on one mobile screen.
The user should finish Truth in Love understanding not merely:
"What should I do?"
but:
"What is true?"
"What is happening in my heart?"
"What is actually mine to do?"
"What is not mine to carry?"
"How can I respond faithfully before God?"
`;

export function buildGuidedPlaybookPrompt(
  userInput: string,
  includeExample: boolean = false
): string {
  return [
    buildOriginalGuidedPlaybookPrompt(userInput, includeExample),
    COVER_PROMPT,
    TRUTH_SUMMARY_PROMPT,
    TRUTH_IN_LOVE_PROMPT,
    `OPTIONAL SCREEN ELEMENTS:
Return truth_screen_enhancements as an array; [] is valid. First write the complete
truth_summary and truth_in_love using the existing instructions. Do not change their
structure or remove essential guidance to make room for optional elements.
Choose at most one element for any screen, solely from that screen's meaning.
Each entry has source (copy the exact complete truth_summary or one exact complete
truth_in_love paragraph), kind, text, and items. Do not attach extras by page number.
Kinds:
- takeaway: a standalone, shareable siFia reflection, at most 240 characters in text; items = [].
- explanation: useful optional context, at most 700 characters in text; items = [].
- flow: an actual sequence or change in direction, 2-4 short items (each at most 180 characters); text = "".
- comparison: two distinct statements that clarify a real distinction, each at most 180 characters in items; text = "".
Skip the element when it adds no value. Do not repeat the primary truth verbatim,
invent facts, force every screen to have an extra, or imply unsupported causation with arrows.
Takeaways are authored reflections, not quotations from Jesus or Scripture. Do not
attribute them to God, invent divine commands, or insert verse quotations into extras.
All existing safety, doctrinal, and factual safeguards also apply to these elements.
Keep urgent safety guidance and essential meaning in the visible main text, never hidden in an explanation.`,
  ].join('\n\n');
}
