import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationTemplate {
  type: string
  templates: string[]
  priority: 'low' | 'normal' | 'high' | 'critical'
  timing: 'morning' | 'afternoon' | 'evening' | 'immediate'
}

const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    type: 'prayer_reminder',
    templates: [
      '💙 {firstName}, your heart is ready for prayer. Take a moment with God today.',
      '🙏 Time for prayer, {firstName}. Your {streakDays}-day streak is waiting!',
      '💝 {firstName}, God is listening. Share what\'s on your heart today.',
      '✨ Prayer time, {firstName}. Let\'s continue your beautiful journey with God.',
      '🕊️ {firstName}, find peace in prayer today. Your spirit is calling.'
    ],
    priority: 'high',
    timing: 'morning'
  },
  {
    type: 'playbook_step',
    templates: [
      '🎯 Ready for \'{playbookTitle}\'? Your next step: {stepTitle}',
      '✨ Continue \'{playbookTitle}\'? Time for: {stepTitle}',
      '🌟 Let\'s grow! \'{playbookTitle}\' awaits: {stepTitle}',
      '💪 {firstName}, ready to tackle \'{stepTitle}\' in your {playbookTitle} journey?',
      '🚀 Next adventure in \'{playbookTitle}\': {stepTitle}. You\'ve got this!'
    ],
    priority: 'high',
    timing: 'evening'
  },
  {
    type: 'playbook_verse',
    templates: [
      '📖 Today\'s verse for \'{playbookTitle}\': {verseReference} - {versePreview}...',
      '✝️ Your \'{playbookTitle}\' verse: {verseReference} - {versePreview}...',
      '🕊️ Verse for \'{playbookTitle}\': {verseReference} - {versePreview}...',
      '💫 {firstName}, meditate on {verseReference} for your \'{playbookTitle}\' journey.',
      '📚 Scripture for \'{playbookTitle}\': {verseReference} - {versePreview}...'
    ],
    priority: 'normal',
    timing: 'morning'
  },
  {
    type: 'playbook_challenge',
    templates: [
      '🔥 Challenge alert! \'{challengeTitle}\' from \'{playbookTitle}\' ends in {timeLeft}',
      '⚡ Don\'t miss it! \'{challengeTitle}\' from \'{playbookTitle}\' ends {timeLeft}',
      '🎯 Final call! \'{challengeTitle}\' from \'{playbookTitle}\' ends in {timeLeft}',
      '💪 {firstName}, \'{challengeTitle}\' challenge ends {timeLeft}. You can do this!',
      '🌟 Last chance! Complete \'{challengeTitle}\' in \'{playbookTitle}\' - {timeLeft} left!'
    ],
    priority: 'critical',
    timing: 'immediate'
  },
  {
    type: 'devotional_reminder',
    templates: [
      '🌅 Good morning {firstName}! Today\'s devotional: \'{devotionalTitle}\' is ready',
      '☀️ Start strong, {firstName}! Your devotional \'{devotionalTitle}\' awaits',
      '💫 Ready to grow, {firstName}? Today\'s focus: \'{devotionalTitle}\' is here',
      '🌱 {firstName}, nurture your soul with today\'s devotional: \'{devotionalTitle}\'',
      '✨ Morning blessing, {firstName}! \'{devotionalTitle}\' is waiting for you'
    ],
    priority: 'high',
    timing: 'morning'
  },
  {
    type: 'journal_prompt',
    templates: [
      '✍️ Reflection time, {firstName}. Today\'s prompt: \'{promptPreview}...\'',
      '📝 Evening reflection, {firstName}: \'{promptPreview}...\'',
      '💭 Time to journal, {firstName}: \'{promptPreview}...\'',
      '🌙 {firstName}, end your day with reflection: \'{promptPreview}...\'',
      '📖 Journaling moment, {firstName}. Consider: \'{promptPreview}...\''
    ],
    priority: 'normal',
    timing: 'evening'
  },
  {
    type: 'streak_alert',
    templates: [
      '🔥 Amazing! {streakDays}-day {category} streak. Keep the momentum going!',
      '⭐ Incredible! {streakDays}-day streak in \'{category}\'. You\'re on fire!',
      '🎉 Wow! {streakDays}-day {category} streak. Your consistency is inspiring!',
      '💪 {firstName}, {streakDays} days strong in {category}! Don\'t break the chain!',
      '🌟 Streak alert! {streakDays} consecutive days of {category}. You\'re amazing!'
    ],
    priority: 'critical',
    timing: 'evening'
  },
  {
    type: 'prayer_request',
    templates: [
      '🙏 {requesterName} needs prayer: {prayerPreview}...',
      '💙 Prayer request from {requesterName}: {prayerPreview}...',
      '🤝 Join in prayer for {requesterName}: {prayerPreview}...',
      '✨ {firstName}, {requesterName} is asking for prayer: {prayerPreview}...',
      '💝 Community prayer needed for {requesterName}: {prayerPreview}...'
    ],
    priority: 'high',
    timing: 'immediate'
  }
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // This function can be called in different ways:
    // 1. Generate specific notification for a user
    // 2. Generate daily batch notifications
    // 3. Check for trigger conditions and generate notifications

    const { action, user_id, notification_type, data } = await req.json()

    switch (action) {
      case 'generate_specific':
        return await generateSpecificNotification(supabase, user_id, notification_type, data)
      
      case 'daily_batch':
        return await generateDailyBatch(supabase)
      
      case 'check_triggers':
        return await checkTriggersAndGenerate(supabase)
      
      default:
        throw new Error('Invalid action specified')
    }

  } catch (error) {
    console.error('Notification generation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function generateSpecificNotification(supabase: any, userId: string, type: string, data: any) {
  // Get user profile for personalization
  const { data: user, error: userError } = await supabase
    .from('user_profiles')
    .select('first_name, last_name, current_streak, timezone')
    .eq('user_id', userId)
    .single()

  if (userError) {
    console.warn('Could not fetch user profile:', userError.message)
  }

  // Generate personalized message
  const template = NOTIFICATION_TEMPLATES.find(t => t.type === type)
  if (!template) {
    throw new Error(`Unknown notification type: ${type}`)
  }

  const message = generatePersonalizedMessage(template, user, data)
  const title = generateTitle(type, data)

  // Schedule the notification
  const scheduledTime = calculateScheduledTime(template.timing, user?.timezone)

  const { error: insertError } = await supabase
    .from('notification_queue')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      data,
      scheduled_for: scheduledTime,
      priority: template.priority,
    })

  if (insertError) {
    throw new Error(`Failed to queue notification: ${insertError.message}`)
  }

  return new Response(
    JSON.stringify({ success: true, message, scheduled_for: scheduledTime }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function generateDailyBatch(supabase: any) {
  const results = {
    prayer_reminders: 0,
    devotional_reminders: 0,
    journal_prompts: 0,
    playbook_steps: 0,
  }

  // Generate prayer reminders
  await supabase.rpc('check_prayer_reminders')
  results.prayer_reminders++

  // Generate devotional reminders
  await supabase.rpc('check_devotional_reminders')
  results.devotional_reminders++

  // Generate playbook step reminders
  await supabase.rpc('check_playbook_step_reminders')
  results.playbook_steps++

  return new Response(
    JSON.stringify({ success: true, generated: results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function checkTriggersAndGenerate(supabase: any) {
  const triggers = []

  // Check for users at risk of breaking streaks
  const { data: streakRisks } = await supabase
    .from('user_profiles')
    .select('user_id, first_name, current_streak, last_activity')
    .gt('current_streak', 0)
    .lt('last_activity', new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()) // 20 hours ago

  for (const user of streakRisks || []) {
    const hoursLeft = 24 - Math.floor((Date.now() - new Date(user.last_activity).getTime()) / (1000 * 60 * 60))
    
    if (hoursLeft <= 4) { // Critical: less than 4 hours left
      await generateSpecificNotification(supabase, user.user_id, 'streak_alert', {
        streakDays: user.current_streak,
        category: 'spiritual growth',
        hoursLeft
      })
      triggers.push(`streak_alert_${user.user_id}`)
    }
  }

  // Check for expiring playbook challenges
  const { data: challenges } = await supabase
    .from('playbook_challenges')
    .select('*, playbooks(title), playbook_sessions(user_id)')
    .lt('deadline', new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()) // 2 days from now
    .eq('status', 'active')

  for (const challenge of challenges || []) {
    const timeLeft = Math.ceil((new Date(challenge.deadline).getTime() - Date.now()) / (1000 * 60 * 60))
    const timeLeftText = timeLeft > 24 ? `${Math.ceil(timeLeft / 24)} days` : `${timeLeft} hours`

    await generateSpecificNotification(supabase, challenge.playbook_sessions.user_id, 'playbook_challenge', {
      challengeTitle: challenge.title,
      playbookTitle: challenge.playbooks.title,
      timeLeft: timeLeftText,
      deadline: challenge.deadline
    })
    triggers.push(`challenge_${challenge.id}`)
  }

  return new Response(
    JSON.stringify({ success: true, triggers_checked: triggers.length, triggers }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function generatePersonalizedMessage(template: NotificationTemplate, user: any, data: any): string {
  const templates = template.templates
  const selectedTemplate = templates[Math.floor(Math.random() * templates.length)]
  
  let message = selectedTemplate
  
  // Replace placeholders
  const replacements = {
    firstName: user?.first_name || 'Friend',
    lastName: user?.last_name || '',
    streakDays: user?.current_streak || 0,
    playbookTitle: data?.playbook_title || data?.playbookTitle || '',
    stepTitle: data?.step_title || data?.stepTitle || '',
    challengeTitle: data?.challenge_title || data?.challengeTitle || '',
    devotionalTitle: data?.devotional_title || data?.devotionalTitle || '',
    promptPreview: data?.prompt_preview || data?.promptPreview || '',
    verseReference: data?.verse_reference || data?.verseReference || '',
    versePreview: data?.verse_preview || data?.versePreview || '',
    timeLeft: data?.time_left || data?.timeLeft || '',
    category: data?.category || '',
    requesterName: data?.requester_name || data?.requesterName || 'Someone',
    prayerPreview: data?.prayer_preview || data?.prayerPreview || '',
  }
  
  for (const [key, value] of Object.entries(replacements)) {
    message = message.replace(new RegExp(`{${key}}`, 'g'), String(value))
  }
  
  return message
}

function generateTitle(type: string, data: any): string {
  const titles = {
    prayer_reminder: 'Time for Prayer 💙',
    playbook_step: 'Ready for Your Next Step? 🎯',
    playbook_verse: 'Today\'s Scripture 📖',
    playbook_challenge: 'Challenge Alert! 🔥',
    devotional_reminder: 'Your Daily Devotional 🌅',
    journal_prompt: 'Reflection Time ✍️',
    streak_alert: 'Streak Alert! 🔥',
    prayer_request: 'Prayer Request 🙏',
  }
  
  return titles[type] || 'siFia Notification'
}

function calculateScheduledTime(timing: string, timezone?: string): string {
  const now = new Date()
  let scheduledTime = new Date()
  
  switch (timing) {
    case 'morning':
      scheduledTime.setHours(8, 0, 0, 0) // 8:00 AM
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1)
      }
      break
    
    case 'afternoon':
      scheduledTime.setHours(12, 0, 0, 0) // 12:00 PM
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1)
      }
      break
    
    case 'evening':
      scheduledTime.setHours(18, 0, 0, 0) // 6:00 PM
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1)
      }
      break
    
    case 'immediate':
    default:
      scheduledTime = new Date(now.getTime() + 30000) // 30 seconds from now
      break
  }
  
  return scheduledTime.toISOString()
}
