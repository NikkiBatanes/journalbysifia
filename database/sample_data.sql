-- Sample Data for siFia Faith Points System Testing
-- Run this after the main schema to populate test data

-- Insert sample devotionals
INSERT INTO devotionals (id, title, content, scripture_reference, reflection_questions, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Finding Peace in Prayer', 
 'In our busy lives, we often forget to pause and connect with God through prayer. Prayer is not just asking for things, but building a relationship with our Creator. When we pray, we open our hearts to receive God''s peace that surpasses all understanding.

Take a moment today to sit quietly and simply talk to God. Share your worries, your joys, your hopes. Listen for His gentle voice in the silence.', 
 'Philippians 4:6-7', 
 '["What worries are you carrying that you can give to God in prayer?", "How has prayer brought you peace in difficult times?", "What would change if you made prayer your first response instead of your last resort?"]',
 NOW()),

('550e8400-e29b-41d4-a716-446655440002', 'Walking in Faith', 
 'Faith is not the absence of doubt, but the decision to trust God despite our uncertainties. Abraham left his homeland not knowing where God was leading him, yet he trusted. Moses led the Israelites through the wilderness, trusting in God''s provision.

Your faith journey may have moments of uncertainty, but remember that God is faithful even when our faith wavers.', 
 'Hebrews 11:1', 
 '["What step of faith is God calling you to take today?", "How has God proven faithful in your past experiences?", "What would you do if you knew you could not fail?"]',
 NOW()),

('550e8400-e29b-41d4-a716-446655440003', 'Love in Action', 
 'Love is more than a feeling—it''s a choice we make daily. Jesus showed us perfect love by laying down His life for us. We are called to love others in the same sacrificial way, putting their needs before our own.

Look for opportunities today to show love through your actions, not just your words.', 
 '1 John 4:19', 
 '["Who in your life needs to experience God''s love through you?", "How can you show sacrificial love to someone today?", "What barriers prevent you from loving others freely?"]',
 NOW());

-- Insert sample playbooks
INSERT INTO playbooks (id, title, description, category, estimated_duration, created_at) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'Morning Prayer Routine', 
 'Establish a consistent morning prayer practice to start your day connected with God. This playbook guides you through creating a sustainable prayer routine that fits your lifestyle.',
 'prayer', 15, NOW()),

('660e8400-e29b-41d4-a716-446655440002', 'Scripture Meditation', 
 'Learn to meditate on God''s Word for deeper spiritual insight. This playbook teaches you how to slowly read, reflect, and apply biblical truths to your daily life.',
 'study', 20, NOW()),

('660e8400-e29b-41d4-a716-446655440003', 'Gratitude Practice', 
 'Develop a heart of thanksgiving through intentional gratitude practices. This playbook helps you recognize God''s blessings and cultivate a grateful spirit.',
 'gratitude', 10, NOW());

-- Insert sample playbook action steps
INSERT INTO playbook_action_steps (id, playbook_id, step_number, title, description, estimated_minutes, created_at) VALUES
-- Morning Prayer Routine steps
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 1, 'Set Your Alarm', 'Choose a consistent wake-up time that allows for 15 minutes of prayer before your day begins.', 2, NOW()),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 2, 'Create Sacred Space', 'Designate a quiet corner of your home for prayer. Keep a Bible, journal, and comfortable seating there.', 5, NOW()),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', 3, 'Begin with Gratitude', 'Start each prayer time by thanking God for three specific things from the previous day.', 3, NOW()),
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440001', 4, 'Read Scripture', 'Read a short passage from the Bible. Consider using a daily reading plan or devotional.', 5, NOW()),

-- Scripture Meditation steps
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440002', 1, 'Choose Your Passage', 'Select a short Bible verse or passage (3-5 verses maximum) for meditation.', 2, NOW()),
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440002', 2, 'Read Slowly', 'Read the passage three times slowly, paying attention to different words each time.', 5, NOW()),
('770e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440002', 3, 'Ask Questions', 'What is God saying? What does this mean for my life? How can I apply this today?', 8, NOW()),
('770e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440002', 4, 'Pray the Passage', 'Turn the scripture into a personal prayer, using the words and themes from the text.', 5, NOW()),

-- Gratitude Practice steps
('770e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440003', 1, 'Morning Gratitude', 'Before getting out of bed, think of three things you''re grateful for.', 2, NOW()),
('770e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440003', 2, 'Gratitude Journal', 'Write down five things you''re thankful for in a dedicated gratitude journal.', 5, NOW()),
('770e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440003', 3, 'Express Thanks', 'Tell someone specific why you''re grateful for them today.', 3, NOW());

-- Insert sample affirmations and verses into playbooks (using JSON format)
UPDATE playbooks SET 
  affirmations = '["I am fearfully and wonderfully made by God", "God has plans to prosper me and not to harm me", "I can do all things through Christ who strengthens me"]'
WHERE id = '660e8400-e29b-41d4-a716-446655440001';

UPDATE playbooks SET 
  bible_verses = '["Be still and know that I am God - Psalm 46:10", "Your word is a lamp for my feet, a light on my path - Psalm 119:105", "All Scripture is God-breathed and is useful for teaching - 2 Timothy 3:16"]'
WHERE id = '660e8400-e29b-41d4-a716-446655440002';

UPDATE playbooks SET 
  reflection_questions = '["What unexpected blessing did I receive today?", "How did God show up in my ordinary moments?", "What challenge can I reframe as an opportunity for growth?"]'
WHERE id = '660e8400-e29b-41d4-a716-446655440003';

-- Add some sample devotional affirmations and verses
UPDATE devotionals SET 
  affirmations = '["God hears my prayers and cares about my concerns", "I am never alone because God is always with me", "Prayer changes both my circumstances and my heart"]'
WHERE id = '550e8400-e29b-41d4-a716-446655440001';

UPDATE devotionals SET 
  bible_verses = '["Now faith is confidence in what we hope for - Hebrews 11:1", "Trust in the Lord with all your heart - Proverbs 3:5", "Faith comes from hearing the message - Romans 10:17"]'
WHERE id = '550e8400-e29b-41d4-a716-446655440002';

UPDATE devotionals SET 
  affirmations = '["I choose to love others as Christ loves me", "God''s love flows through me to touch others", "Love is my response to God''s grace in my life"]'
WHERE id = '550e8400-e29b-41d4-a716-446655440003';

COMMIT;
