# Playbook Title Uniqueness - Enterprise Feature

## Problem Statement
Previously, playbooks generated for the same topic would often have identical or very similar titles because the AI received identical inputs without any context about existing playbooks.

## Solution Overview
Implemented a multi-layered enterprise-grade solution to ensure unique, contextual playbook titles:

### 1. **Context-Aware Generation**
- Edge Function now fetches user's 10 most recent playbook titles
- Passes these titles to the AI with explicit instructions to create unique titles
- Non-blocking: If database fetch fails, generation continues without context

### 2. **Temporal Uniqueness**
- Added ISO timestamp to every generation request
- Ensures each request has a unique temporal marker
- Helps AI understand this is a distinct generation event

### 3. **Enhanced AI Instructions**
- Updated system prompt with explicit uniqueness requirements
- AI instructed to differentiate titles using:
  - Specific angles or perspectives
  - Metaphors or imagery
  - Focus areas within the broader topic
  - Fresh approaches to familiar themes

### 4. **Increased Creative Variation**
- Temperature increased from 0.7 to 0.85
- Provides more creative freedom while maintaining quality
- Balances consistency with variation

## Technical Implementation

### Edge Function Changes
**File:** `/supabase/functions/generate-playbook/index.ts`

```typescript
// 1. Added Supabase client import for database access
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// 2. Extended RequestBody interface
interface RequestBody {
  userInput: string;
  userName: string;
  userId?: string; // NEW: For context-aware generation
}

// 3. Fetch recent playbook titles
const supabase = createClient(supabaseUrl, supabaseKey);
const { data: recentPlaybooks } = await supabase
  .from('playbooks')
  .select('title')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(10);

// 4. Build contextual prompt
const contextualPrompt = recentTitles.length > 0
  ? `User: ${userName}\nStruggle: ${userInput}\nGeneration Time: ${timestamp}\n\nIMPORTANT: This user has ${recentTitles.length} existing playbooks. Create a UNIQUE title that is different from these recent titles:\n${recentTitles.map((t, i) => `${i + 1}. "${t}"`).join('\n')}\n\nEnsure your new playbook title offers a fresh perspective or angle on this topic.`
  : `User: ${userName}\nStruggle: ${userInput}\nGeneration Time: ${timestamp}\n\nCreate a unique, specific title that captures the essence of this particular journey.`;

// 5. Increased temperature
temperature: 0.85 // Up from 0.7
```

### Client-Side Changes
**File:** `/src/services/modernPlaybookApi.ts`

```typescript
// Extract and pass userId to Edge Function
const { data: { user } } = await supabase.auth.getUser();
userId = user?.id; // ENTERPRISE: Pass userId for context-aware generation

// Include userId in request body
body: JSON.stringify({ userInput, userName, bibleVersion, userId })
```

### Persona Configuration Changes
**File:** `/supabase/functions/generate-playbook/persona.config.ts`

```typescript
PLAYBOOK TITLE:
[Main Title - Be direct and specific, do NOT start with 'Navigating' or similar verbs. 
CRITICAL: Create a UNIQUE title that offers a fresh perspective. If the user has 
existing playbooks on similar topics, differentiate this one with a specific angle, 
metaphor, or focus area. Avoid generic titles.]
```

## Example Scenarios

### Scenario 1: First Playbook on Anxiety
**Input:** "I'm struggling with anxiety"
**Context:** No previous playbooks
**Result:** "Breaking Free from Anxiety's Grip"

### Scenario 2: Second Playbook on Anxiety
**Input:** "I'm struggling with anxiety"
**Context:** Previous title: "Breaking Free from Anxiety's Grip"
**Result:** "Finding Peace in the Storm: Your Anxiety Action Plan"

### Scenario 3: Third Playbook on Anxiety
**Input:** "I'm struggling with anxiety"
**Context:** 
- "Breaking Free from Anxiety's Grip"
- "Finding Peace in the Storm: Your Anxiety Action Plan"
**Result:** "Rooted in Truth: Overcoming Anxious Thoughts"

## Benefits

### User Experience
- **Variety:** Each playbook feels fresh and distinct
- **Clarity:** Titles reflect different aspects of the same topic
- **Engagement:** Users can easily distinguish between playbooks

### Technical
- **Scalable:** Works for any number of playbooks
- **Resilient:** Gracefully handles database failures
- **Performance:** Non-blocking database queries
- **Type-Safe:** Full TypeScript support

### Business
- **Premium Feature:** Demonstrates intelligent, context-aware AI
- **User Retention:** Encourages multiple playbook generations
- **Quality:** Maintains high standards for content uniqueness

## Error Handling

The implementation includes robust error handling:

```typescript
try {
  // Fetch recent playbooks
} catch (error) {
  console.warn('Could not fetch recent playbooks for context:', error);
  // Continue without context - non-blocking
}
```

If the database fetch fails:
- Generation continues normally
- Uses timestamp-based uniqueness
- Relies on increased temperature for variation
- No user-facing errors

## Monitoring

To monitor effectiveness:
1. Check Edge Function logs for: `Found X recent playbook titles for context`
2. Review generated playbook titles in database
3. Track user feedback on playbook quality
4. Monitor duplicate title occurrences

## Future Enhancements

Potential improvements:
1. **Semantic Analysis:** Use embeddings to ensure titles are semantically distinct
2. **User Preferences:** Learn user's preferred title styles over time
3. **Topic Clustering:** Group similar topics and ensure variety within clusters
4. **A/B Testing:** Test different temperature values and prompt strategies
5. **Title Suggestions:** Offer multiple title options for user selection

## Deployment Notes

### Environment Variables Required
- `SUPABASE_URL` - Already configured
- `SUPABASE_SERVICE_ROLE_KEY` - Required for server-side database access
- `OPENAI_API_KEY` - Already configured

### Database Permissions
The Edge Function uses the service role key, which has full access. No additional RLS policies needed.

### Testing Checklist
- [ ] Generate first playbook on a topic - verify unique title
- [ ] Generate second playbook on same topic - verify different title
- [ ] Generate third playbook on same topic - verify distinct from both
- [ ] Test with database unavailable - verify graceful degradation
- [ ] Test with new user (no previous playbooks) - verify works correctly
- [ ] Monitor Edge Function logs for context fetch messages

## Lint Warnings

The Deno lint warnings about uncached URLs are expected:
- `https://deno.land/std@0.168.0/http/server.ts` - Standard Deno HTTP server
- `https://esm.sh/@supabase/supabase-js@2.39.3` - Supabase client library

These will be cached on first deployment to Supabase Edge Functions.
