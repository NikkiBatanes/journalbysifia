export interface PsalmAttribute {
  label: string;
  verses: string;
}

export interface PsalmReflection {
  psalm: number;
  attributes: PsalmAttribute[];
}

export const psalmReflections: PsalmReflection[] = [
  {
    psalm: 1,
    attributes: [
      { label: 'Righteous', verses: 'Psalm 1:5–6' },
      { label: 'Just', verses: 'Psalm 1:4–6' },
      { label: 'Knows His people', verses: 'Psalm 1:6' },
    ],
  },
  {
    psalm: 2,
    attributes: [
      { label: 'Sovereign King', verses: 'Psalm 2:4–6' },
      { label: 'Establishes His Son', verses: 'Psalm 2:7–9' },
      { label: 'Refuge', verses: 'Psalm 2:11–12' },
    ],
  },
  {
    psalm: 3,
    attributes: [
      { label: 'Shield', verses: 'Psalm 3:3–4' },
      { label: 'Sustainer', verses: 'Psalm 3:5–6' },
      { label: 'Saves His people', verses: 'Psalm 3:7–8' },
    ],
  },
  {
    psalm: 4,
    attributes: [
      { label: 'Answers prayer', verses: 'Psalm 4:1–3' },
      { label: 'Shows favor', verses: 'Psalm 4:6–7' },
      { label: 'Gives safety', verses: 'Psalm 4:7–8' },
    ],
  },
  {
    psalm: 5,
    attributes: [
      { label: 'Hears', verses: 'Psalm 5:1–3' },
      { label: 'Holy', verses: 'Psalm 5:4–6' },
      { label: 'Guide and Protector', verses: 'Psalm 5:8–12' },
    ],
  },
  {
    psalm: 6,
    attributes: [
      { label: 'Merciful', verses: 'Psalm 6:1–4' },
      { label: 'Hears weeping', verses: 'Psalm 6:6–9' },
      { label: 'Receives prayer', verses: 'Psalm 6:8–10' },
    ],
  },
  {
    psalm: 7,
    attributes: [
      { label: 'Refuge', verses: 'Psalm 7:1–2' },
      { label: 'Righteous Judge', verses: 'Psalm 7:8–11' },
      { label: 'Shield', verses: 'Psalm 7:10–11' },
    ],
  },
  {
    psalm: 8,
    attributes: [
      { label: 'Majestic', verses: 'Psalm 8:1–2' },
      { label: 'Creator', verses: 'Psalm 8:3–4' },
      { label: 'Mindful of humanity', verses: 'Psalm 8:4–6' },
    ],
  },
  {
    psalm: 9,
    attributes: [
      { label: 'Righteous Judge', verses: 'Psalm 9:7–8' },
      { label: 'Refuge for the oppressed', verses: 'Psalm 9:9–10' },
      { label: 'Remembers the afflicted', verses: 'Psalm 9:11–12' },
    ],
  },
  {
    psalm: 10,
    attributes: [
      { label: 'Sees injustice', verses: 'Psalm 10:13–14' },
      { label: 'Helper of the fatherless', verses: 'Psalm 10:14–15' },
      { label: 'Eternal King', verses: 'Psalm 10:16–18' },
    ],
  },
  {
    psalm: 11,
    attributes: [
      { label: 'Refuge', verses: 'Psalm 11:1–2' },
      { label: 'Examines all people', verses: 'Psalm 11:4–5' },
      { label: 'Righteous and Just', verses: 'Psalm 11:6–7' },
    ],
  },
  {
    psalm: 12,
    attributes: [
      { label: 'Hears the oppressed', verses: 'Psalm 12:5–6' },
      { label: 'Pure in speech', verses: 'Psalm 12:6–7' },
      { label: 'Protector', verses: 'Psalm 12:5–7' },
    ],
  },
  {
    psalm: 13,
    attributes: [
      { label: 'Attentive', verses: 'Psalm 13:3–4' },
      { label: 'Steadfast in love', verses: 'Psalm 13:5–6' },
      { label: 'Generous', verses: 'Psalm 13:5–6' },
    ],
  },
  {
    psalm: 14,
    attributes: [
      { label: 'Sees all humanity', verses: 'Psalm 14:2–3' },
      { label: 'Present with the righteous', verses: 'Psalm 14:4–6' },
      { label: 'Restores His people', verses: 'Psalm 14:6–7' },
    ],
  },
  {
    psalm: 15,
    attributes: [
      { label: 'Holy Host', verses: 'Psalm 15:1–2' },
      { label: 'Loves integrity', verses: 'Psalm 15:2–4' },
      { label: 'Gives lasting security', verses: 'Psalm 15:4–5' },
    ],
  },
  {
    psalm: 16,
    attributes: [
      { label: 'Refuge', verses: 'Psalm 16:1–2' },
      { label: 'Counselor', verses: 'Psalm 16:7–8' },
      { label: 'Giver of life and joy', verses: 'Psalm 16:9–11' },
    ],
  },
  {
    psalm: 17,
    attributes: [
      { label: 'Righteous Listener', verses: 'Psalm 17:1–2' },
      { label: 'Savior', verses: 'Psalm 17:6–7' },
      { label: 'Tender Protector', verses: 'Psalm 17:8–9' },
    ],
  },
  {
    psalm: 18,
    attributes: [
      { label: 'Rock and Deliverer', verses: 'Psalm 18:1–3' },
      { label: 'Powerful Rescuer', verses: 'Psalm 18:16–19' },
      { label: 'Faithful and Perfect', verses: 'Psalm 18:25–30' },
    ],
  },
  {
    psalm: 19,
    attributes: [
      { label: 'Glorious Creator', verses: 'Psalm 19:1–4' },
      { label: 'Perfect Lawgiver', verses: 'Psalm 19:7–9' },
      { label: 'Rock and Redeemer', verses: 'Psalm 19:12–14' },
    ],
  },
  {
    psalm: 20,
    attributes: [
      { label: 'Answers distress', verses: 'Psalm 20:1–3' },
      { label: 'Grants righteous desires', verses: 'Psalm 20:4–5' },
      { label: 'Saves His anointed', verses: 'Psalm 20:6–9' },
    ],
  },
  {
    psalm: 21,
    attributes: [
      { label: 'Gives victory', verses: 'Psalm 21:1–5' },
      { label: 'Steadfast in love', verses: 'Psalm 21:6–7' },
      { label: 'Exalted in strength', verses: 'Psalm 21:8–13' },
    ],
  },
  {
    psalm: 22,
    attributes: [
      { label: 'Holy', verses: 'Psalm 22:3–5' },
      { label: 'Near the afflicted', verses: 'Psalm 22:19–24' },
      { label: 'Universal King', verses: 'Psalm 22:27–31' },
    ],
  },
  {
    psalm: 23,
    attributes: [
      { label: 'Shepherd', verses: 'Psalm 23:1' },
      { label: 'Provider', verses: 'Psalm 23:1–2' },
      { label: 'Guide', verses: 'Psalm 23:2–3' },
      { label: 'Protector', verses: 'Psalm 23:4–5' },
      { label: 'Present', verses: 'Psalm 23:4' },
    ],
  },
  {
    psalm: 24,
    attributes: [
      { label: 'Creator and Owner', verses: 'Psalm 24:1–2' },
      { label: 'Holy', verses: 'Psalm 24:3–6' },
      { label: 'King of glory', verses: 'Psalm 24:7–10' },
    ],
  },
  {
    psalm: 25,
    attributes: [
      { label: 'Guide', verses: 'Psalm 25:4–5' },
      { label: 'Merciful and Loving', verses: 'Psalm 25:6–7' },
      { label: 'Good and Upright', verses: 'Psalm 25:8–10' },
    ],
  },
  {
    psalm: 26,
    attributes: [
      { label: 'Examines hearts', verses: 'Psalm 26:1–3' },
      { label: 'Steadfast in love', verses: 'Psalm 26:2–3' },
      { label: 'Redeemer', verses: 'Psalm 26:10–12' },
    ],
  },
  {
    psalm: 27,
    attributes: [
      { label: 'Light and Salvation', verses: 'Psalm 27:1–3' },
      { label: 'Shelter', verses: 'Psalm 27:4–6' },
      { label: 'Faithful Guide', verses: 'Psalm 27:9–14' },
    ],
  },
  {
    psalm: 28,
    attributes: [
      { label: 'Hears pleas', verses: 'Psalm 28:1–2' },
      { label: 'Strength and Shield', verses: 'Psalm 28:6–7' },
      { label: 'Shepherd and Savior', verses: 'Psalm 28:8–9' },
    ],
  },
  {
    psalm: 29,
    attributes: [
      { label: 'Glorious', verses: 'Psalm 29:1–2' },
      { label: 'Powerful in voice', verses: 'Psalm 29:3–9' },
      { label: 'Enthroned and Peace-giving', verses: 'Psalm 29:10–11' },
    ],
  },
  {
    psalm: 30,
    attributes: [
      { label: 'Healer', verses: 'Psalm 30:1–3' },
      { label: 'Favor-giving', verses: 'Psalm 30:4–5' },
      { label: 'Turns mourning to joy', verses: 'Psalm 30:10–12' },
    ],
  },
  {
    psalm: 31,
    attributes: [
      { label: 'Rock and Refuge', verses: 'Psalm 31:1–5' },
      { label: 'Sees affliction', verses: 'Psalm 31:7–8' },
      { label: 'Abundant in goodness', verses: 'Psalm 31:19–24' },
    ],
  },
  {
    psalm: 32,
    attributes: [
      { label: 'Forgiving', verses: 'Psalm 32:1–5' },
      { label: 'Hiding place', verses: 'Psalm 32:6–7' },
      { label: 'Instructor and Guide', verses: 'Psalm 32:8–10' },
    ],
  },
  {
    psalm: 33,
    attributes: [
      { label: 'Upright and Faithful', verses: 'Psalm 33:4–5' },
      { label: 'Sovereign Creator', verses: 'Psalm 33:6–11' },
      { label: 'Watchful Deliverer', verses: 'Psalm 33:13–19' },
    ],
  },
  {
    psalm: 34,
    attributes: [
      { label: 'Answers and Delivers', verses: 'Psalm 34:4–7' },
      { label: 'Good Provider', verses: 'Psalm 34:8–10' },
      { label: 'Near the brokenhearted', verses: 'Psalm 34:15–18' },
    ],
  },
  {
    psalm: 35,
    attributes: [
      { label: 'Defender', verses: 'Psalm 35:1–3' },
      { label: 'Rescues the vulnerable', verses: 'Psalm 35:9–10' },
      { label: 'Delights in well-being', verses: 'Psalm 35:22–28' },
    ],
  },
  {
    psalm: 36,
    attributes: [
      { label: 'Steadfast in love', verses: 'Psalm 36:5–7' },
      { label: 'Abundant Provider', verses: 'Psalm 36:7–9' },
      { label: 'Fountain of life', verses: 'Psalm 36:8–10' },
    ],
  },
  {
    psalm: 37,
    attributes: [
      { label: 'Trustworthy Provider', verses: 'Psalm 37:3–6' },
      { label: 'Establishes the righteous', verses: 'Psalm 37:23–26' },
      { label: 'Stronghold and Savior', verses: 'Psalm 37:39–40' },
    ],
  },
  {
    psalm: 38,
    attributes: [
      { label: 'Disciplines sin', verses: 'Psalm 38:1–4' },
      { label: 'Knows every longing', verses: 'Psalm 38:9–10' },
      { label: 'Savior who stays near', verses: 'Psalm 38:21–22' },
    ],
  },
  {
    psalm: 39,
    attributes: [
      { label: 'Lord of our days', verses: 'Psalm 39:4–6' },
      { label: 'Only Hope', verses: 'Psalm 39:7–8' },
      { label: 'Hears tears', verses: 'Psalm 39:12–13' },
    ],
  },
  {
    psalm: 40,
    attributes: [
      { label: 'Attentive Rescuer', verses: 'Psalm 40:1–3' },
      { label: 'Wonder-working', verses: 'Psalm 40:4–5' },
      { label: 'Helper and Deliverer', verses: 'Psalm 40:16–17' },
    ],
  },
  {
    psalm: 41,
    attributes: [
      { label: 'Protector of the compassionate', verses: 'Psalm 41:1–3' },
      { label: 'Healer', verses: 'Psalm 41:3–4' },
      { label: 'Upholds with integrity', verses: 'Psalm 41:10–13' },
    ],
  },
  {
    psalm: 42,
    attributes: [
      { label: 'Living God', verses: 'Psalm 42:1–2' },
      { label: 'Giver of steadfast love', verses: 'Psalm 42:7–8' },
      { label: 'Saving Presence', verses: 'Psalm 42:5–6' },
    ],
  },
  {
    psalm: 43,
    attributes: [
      { label: 'Just Defender', verses: 'Psalm 43:1–2' },
      { label: 'Light and Truth', verses: 'Psalm 43:3–4' },
      { label: 'Saving Presence', verses: 'Psalm 43:4–5' },
    ],
  },
  {
    psalm: 44,
    attributes: [
      { label: 'Giver of victory', verses: 'Psalm 44:1–3' },
      { label: 'Knows hidden hearts', verses: 'Psalm 44:20–22' },
      { label: 'Redeemer in steadfast love', verses: 'Psalm 44:23–26' },
    ],
  },
  {
    psalm: 45,
    attributes: [
      { label: 'Eternal King', verses: 'Psalm 45:6–7' },
      { label: 'Loves righteousness', verses: 'Psalm 45:6–8' },
      { label: 'Worthy of lasting praise', verses: 'Psalm 45:16–17' },
    ],
  },
  {
    psalm: 46,
    attributes: [
      { label: 'Refuge', verses: 'Psalm 46:1–3' },
      { label: 'Strength', verses: 'Psalm 46:1' },
      { label: 'Present', verses: 'Psalm 46:1, 5–7' },
      { label: 'Sovereign', verses: 'Psalm 46:8–11' },
    ],
  },
  {
    psalm: 47,
    attributes: [
      { label: 'Awesome King', verses: 'Psalm 47:1–2' },
      { label: 'Sovereign over nations', verses: 'Psalm 47:7–9' },
      { label: 'Worthy of praise', verses: 'Psalm 47:5–7' },
    ],
  },
  {
    psalm: 48,
    attributes: [
      { label: 'Great King', verses: 'Psalm 48:1–3' },
      { label: 'Steadfast in love', verses: 'Psalm 48:9–10' },
      { label: 'Everlasting Guide', verses: 'Psalm 48:13–14' },
    ],
  },
  {
    psalm: 49,
    attributes: [
      { label: 'Redeemer from death', verses: 'Psalm 49:14–15' },
      { label: 'Beyond purchase', verses: 'Psalm 49:7–9' },
      { label: 'Judge of rich and poor', verses: 'Psalm 49:16–20' },
    ],
  },
  {
    psalm: 50,
    attributes: [
      { label: 'Mighty Judge', verses: 'Psalm 50:1–6' },
      { label: 'Owner of creation', verses: 'Psalm 50:9–12' },
      { label: 'Deliverer', verses: 'Psalm 50:14–15' },
    ],
  },
  {
    psalm: 51,
    attributes: [
      { label: 'Merciful', verses: 'Psalm 51:1–2' },
      { label: 'Just', verses: 'Psalm 51:4' },
      { label: 'Restorer', verses: 'Psalm 51:10–12' },
      { label: 'Cleansing', verses: 'Psalm 51:2, 7' },
    ],
  },
  {
    psalm: 52,
    attributes: [
      { label: 'Steadfast in love', verses: 'Psalm 52:1–2' },
      { label: 'Just against deceit', verses: 'Psalm 52:5–7' },
      { label: 'Trustworthy', verses: 'Psalm 52:8–9' },
    ],
  },
  {
    psalm: 53,
    attributes: [
      { label: 'Sees all humanity', verses: 'Psalm 53:2–3' },
      { label: 'Defender of His people', verses: 'Psalm 53:4–5' },
      { label: 'Restorer', verses: 'Psalm 53:5–6' },
    ],
  },
  {
    psalm: 54,
    attributes: [
      { label: 'Savior', verses: 'Psalm 54:1–3' },
      { label: 'Helper and Sustainer', verses: 'Psalm 54:4–5' },
      { label: 'Deliverer', verses: 'Psalm 54:6–7' },
    ],
  },
  {
    psalm: 55,
    attributes: [
      { label: 'Listens in distress', verses: 'Psalm 55:1–3' },
      { label: 'Enthroned forever', verses: 'Psalm 55:19–20' },
      { label: 'Sustains burdens', verses: 'Psalm 55:22–23' },
    ],
  },
  {
    psalm: 56,
    attributes: [
      { label: 'Trustworthy', verses: 'Psalm 56:3–4' },
      { label: 'Counts every tear', verses: 'Psalm 56:8–9' },
      { label: 'Deliverer', verses: 'Psalm 56:12–13' },
    ],
  },
  {
    psalm: 57,
    attributes: [
      { label: 'Merciful Refuge', verses: 'Psalm 57:1–3' },
      { label: 'Fulfills His purpose', verses: 'Psalm 57:2–3' },
      { label: 'Exalted in love and faithfulness', verses: 'Psalm 57:9–11' },
    ],
  },
  {
    psalm: 58,
    attributes: [
      { label: 'Righteous Judge', verses: 'Psalm 58:6–9' },
      { label: 'Avenger of evil', verses: 'Psalm 58:9–10' },
      { label: 'Rewards righteousness', verses: 'Psalm 58:10–11' },
    ],
  },
  {
    psalm: 59,
    attributes: [
      { label: 'Fortress and Deliverer', verses: 'Psalm 59:1–2' },
      { label: 'Sovereign over nations', verses: 'Psalm 59:5–8' },
      { label: 'Steadfast in love', verses: 'Psalm 59:16–17' },
    ],
  },
  {
    psalm: 60,
    attributes: [
      { label: 'Restorer', verses: 'Psalm 60:1–4' },
      { label: 'Sovereign over lands', verses: 'Psalm 60:6–8' },
      { label: 'Giver of victory', verses: 'Psalm 60:11–12' },
    ],
  },
  {
    psalm: 61,
    attributes: [
      { label: 'Listening Refuge', verses: 'Psalm 61:1–3' },
      { label: 'Sheltering Host', verses: 'Psalm 61:4–5' },
      { label: 'Preserver of the king', verses: 'Psalm 61:6–8' },
    ],
  },
  {
    psalm: 62,
    attributes: [
      { label: 'Rock and Salvation', verses: 'Psalm 62:1–2' },
      { label: 'Powerful and Loving', verses: 'Psalm 62:11–12' },
      { label: 'Just Rewarder', verses: 'Psalm 62:11–12' },
    ],
  },
  {
    psalm: 63,
    attributes: [
      { label: 'Satisfying Presence', verses: 'Psalm 63:1–5' },
      { label: 'Steadfast in love', verses: 'Psalm 63:3–4' },
      { label: 'Protective Helper', verses: 'Psalm 63:7–8' },
    ],
  },
  {
    psalm: 64,
    attributes: [
      { label: 'Protector from plots', verses: 'Psalm 64:1–2' },
      { label: 'Sudden Judge', verses: 'Psalm 64:7–9' },
      { label: 'Refuge for the upright', verses: 'Psalm 64:9–10' },
    ],
  },
  {
    psalm: 65,
    attributes: [
      { label: 'Hears and Forgives', verses: 'Psalm 65:2–4' },
      { label: 'Creator of awesome power', verses: 'Psalm 65:5–8' },
      { label: 'Provider of abundance', verses: 'Psalm 65:9–13' },
    ],
  },
  {
    psalm: 66,
    attributes: [
      { label: 'Awesome in deeds', verses: 'Psalm 66:3–7' },
      { label: 'Preserver and Refiner', verses: 'Psalm 66:8–12' },
      { label: 'Attentive and Loving', verses: 'Psalm 66:19–20' },
    ],
  },
  {
    psalm: 67,
    attributes: [
      { label: 'Gracious and Blessing', verses: 'Psalm 67:1–2' },
      { label: 'Just Guide of nations', verses: 'Psalm 67:3–5' },
      { label: 'Provider', verses: 'Psalm 67:6–7' },
    ],
  },
  {
    psalm: 68,
    attributes: [
      { label: 'Defender of the vulnerable', verses: 'Psalm 68:4–6' },
      { label: 'Daily Burden-bearer', verses: 'Psalm 68:19–20' },
      { label: 'Awesome Giver of power', verses: 'Psalm 68:32–35' },
    ],
  },
  {
    psalm: 69,
    attributes: [
      { label: 'Saving Listener', verses: 'Psalm 69:13–18' },
      { label: 'Knows reproach', verses: 'Psalm 69:19–21' },
      { label: 'Restorer of Zion', verses: 'Psalm 69:33–36' },
    ],
  },
  {
    psalm: 70,
    attributes: [
      { label: 'Swift Deliverer', verses: 'Psalm 70:1–3' },
      { label: 'Great Savior', verses: 'Psalm 70:4–5' },
      { label: 'Helper of the needy', verses: 'Psalm 70:4–5' },
    ],
  },
  {
    psalm: 71,
    attributes: [
      { label: 'Rock and Refuge', verses: 'Psalm 71:1–3' },
      { label: 'Hope from youth', verses: 'Psalm 71:5–6' },
      { label: 'Faithful Restorer', verses: 'Psalm 71:19–21' },
    ],
  },
  {
    psalm: 72,
    attributes: [
      { label: 'Just King', verses: 'Psalm 72:1–4' },
      { label: 'Compassionate Deliverer', verses: 'Psalm 72:12–14' },
      { label: 'Glorious Wonder-worker', verses: 'Psalm 72:18–19' },
    ],
  },
  {
    psalm: 73,
    attributes: [
      { label: 'Good to the pure', verses: 'Psalm 73:1–2' },
      { label: 'Present Counselor', verses: 'Psalm 73:23–24' },
      { label: 'Strength and Portion', verses: 'Psalm 73:25–28' },
    ],
  },
  {
    psalm: 74,
    attributes: [
      { label: 'Ancient King', verses: 'Psalm 74:12–13' },
      { label: 'Creator of boundaries and seasons', verses: 'Psalm 74:16–17' },
      { label: 'Defender of the oppressed', verses: 'Psalm 74:19–23' },
    ],
  },
  {
    psalm: 75,
    attributes: [
      { label: 'Near and Wonderful', verses: 'Psalm 75:1–2' },
      { label: 'Upholder of creation', verses: 'Psalm 75:2–3' },
      { label: 'Just Judge', verses: 'Psalm 75:7–10' },
    ],
  },
  {
    psalm: 76,
    attributes: [
      { label: 'Glorious Warrior', verses: 'Psalm 76:3–6' },
      { label: 'Fearsome Judge', verses: 'Psalm 76:7–9' },
      { label: 'Savior of the humble', verses: 'Psalm 76:8–10' },
    ],
  },
  {
    psalm: 77,
    attributes: [
      { label: 'Holy Wonder-worker', verses: 'Psalm 77:11–14' },
      { label: 'Redeemer', verses: 'Psalm 77:14–15' },
      { label: 'Unseen Shepherd', verses: 'Psalm 77:19–20' },
    ],
  },
  {
    psalm: 78,
    attributes: [
      { label: 'Faithful despite rebellion', verses: 'Psalm 78:35–39' },
      { label: 'Powerful Deliverer', verses: 'Psalm 78:42–55' },
      { label: 'Shepherd of His people', verses: 'Psalm 78:70–72' },
    ],
  },
  {
    psalm: 79,
    attributes: [
      { label: 'Jealous for His name', verses: 'Psalm 79:5–9' },
      { label: 'Savior and Forgiver', verses: 'Psalm 79:8–9' },
      { label: 'Avenger of His servants', verses: 'Psalm 79:10–13' },
    ],
  },
  {
    psalm: 80,
    attributes: [
      { label: 'Shepherd enthroned', verses: 'Psalm 80:1–3' },
      { label: 'Restorer', verses: 'Psalm 80:14–19' },
      { label: 'Radiant Savior', verses: 'Psalm 80:17–19' },
    ],
  },
  {
    psalm: 81,
    attributes: [
      { label: 'Deliverer', verses: 'Psalm 81:6–7' },
      { label: 'Sole Provider', verses: 'Psalm 81:8–10' },
      { label: 'Longs to bless obedience', verses: 'Psalm 81:13–16' },
    ],
  },
  {
    psalm: 82,
    attributes: [
      { label: 'Supreme Judge', verses: 'Psalm 82:1–2' },
      { label: 'Defender of the vulnerable', verses: 'Psalm 82:3–4' },
      { label: 'Owner of all nations', verses: 'Psalm 82:7–8' },
    ],
  },
  {
    psalm: 83,
    attributes: [
      { label: 'Defender of His treasured people', verses: 'Psalm 83:1–4' },
      { label: 'Judge of hostile nations', verses: 'Psalm 83:13–17' },
      { label: 'Most High over earth', verses: 'Psalm 83:17–18' },
    ],
  },
  {
    psalm: 84,
    attributes: [
      { label: 'Living God', verses: 'Psalm 84:1–4' },
      { label: 'Strength and Guide', verses: 'Psalm 84:5–7' },
      { label: 'Sun and Shield', verses: 'Psalm 84:10–12' },
    ],
  },
  {
    psalm: 85,
    attributes: [
      { label: 'Forgiving Restorer', verses: 'Psalm 85:1–3' },
      { label: 'Reviving Savior', verses: 'Psalm 85:4–7' },
      { label: 'Giver of peace and goodness', verses: 'Psalm 85:8–13' },
    ],
  },
  {
    psalm: 86,
    attributes: [
      { label: 'Good and Forgiving', verses: 'Psalm 86:3–5' },
      { label: 'Incomparable Wonder-worker', verses: 'Psalm 86:8–10' },
      { label: 'Compassionate and Faithful', verses: 'Psalm 86:15–17' },
    ],
  },
  {
    psalm: 87,
    attributes: [
      { label: 'Founder of Zion', verses: 'Psalm 87:1–3' },
      { label: 'Welcomes the nations', verses: 'Psalm 87:4–6' },
      { label: 'Source of life', verses: 'Psalm 87:6–7' },
    ],
  },
  {
    psalm: 88,
    attributes: [
      { label: 'God of salvation', verses: 'Psalm 88:1–2' },
      { label: 'Sovereign over affliction', verses: 'Psalm 88:6–9' },
      { label: 'Sought in darkness', verses: 'Psalm 88:13–14' },
    ],
  },
  {
    psalm: 89,
    attributes: [
      { label: 'Steadfast and Faithful', verses: 'Psalm 89:1–4' },
      { label: 'Incomparable Creator', verses: 'Psalm 89:6–12' },
      { label: 'Righteous King', verses: 'Psalm 89:13–18' },
    ],
  },
  {
    psalm: 90,
    attributes: [
      { label: 'Eternal Dwelling Place', verses: 'Psalm 90:1–2' },
      { label: 'Sovereign over time', verses: 'Psalm 90:3–6' },
      { label: 'Compassionate and Satisfying', verses: 'Psalm 90:13–17' },
    ],
  },
  {
    psalm: 91,
    attributes: [
      { label: 'Shelter and Refuge', verses: 'Psalm 91:1–4' },
      { label: 'Protector', verses: 'Psalm 91:9–13' },
      { label: 'Present Deliverer', verses: 'Psalm 91:14–16' },
    ],
  },
  {
    psalm: 92,
    attributes: [
      { label: 'Steadfast and Faithful', verses: 'Psalm 92:1–4' },
      { label: 'Profound in wisdom', verses: 'Psalm 92:5–8' },
      { label: 'Upright Rock', verses: 'Psalm 92:12–15' },
    ],
  },
  {
    psalm: 93,
    attributes: [
      { label: 'Majestic King', verses: 'Psalm 93:1–2' },
      { label: 'Mightier than chaos', verses: 'Psalm 93:3–4' },
      { label: 'Holy and Trustworthy', verses: 'Psalm 93:4–5' },
    ],
  },
  {
    psalm: 94,
    attributes: [
      { label: 'God of vengeance', verses: 'Psalm 94:1–2' },
      { label: 'Creator who knows', verses: 'Psalm 94:8–11' },
      { label: 'Fortress of justice', verses: 'Psalm 94:18–23' },
    ],
  },
  {
    psalm: 95,
    attributes: [
      { label: 'Rock of salvation', verses: 'Psalm 95:1–2' },
      { label: 'Great Creator King', verses: 'Psalm 95:3–6' },
      { label: 'Shepherd', verses: 'Psalm 95:6–8' },
    ],
  },
  {
    psalm: 96,
    attributes: [
      { label: 'Great Creator', verses: 'Psalm 96:4–6' },
      { label: 'Glorious and Strong', verses: 'Psalm 96:7–9' },
      { label: 'Righteous Judge', verses: 'Psalm 96:10–13' },
    ],
  },
  {
    psalm: 97,
    attributes: [
      { label: 'Righteous King', verses: 'Psalm 97:1–6' },
      { label: 'Most High', verses: 'Psalm 97:7–9' },
      { label: 'Guardian of the faithful', verses: 'Psalm 97:10–12' },
    ],
  },
  {
    psalm: 98,
    attributes: [
      { label: 'Victorious Savior', verses: 'Psalm 98:1–3' },
      { label: 'Universal King', verses: 'Psalm 98:4–6' },
      { label: 'Equitable Judge', verses: 'Psalm 98:7–9' },
    ],
  },
  {
    psalm: 99,
    attributes: [
      { label: 'Holy King', verses: 'Psalm 99:1–5' },
      { label: 'Answers prayer', verses: 'Psalm 99:6–7' },
      { label: 'Forgiving and Just', verses: 'Psalm 99:8–9' },
    ],
  },
  {
    psalm: 100,
    attributes: [
      { label: 'Creator and Shepherd', verses: 'Psalm 100:1–3' },
      { label: 'Good', verses: 'Psalm 100:4–5' },
      { label: 'Loving and Faithful', verses: 'Psalm 100:4–5' },
    ],
  },
  {
    psalm: 101,
    attributes: [
      { label: 'Loving and Just', verses: 'Psalm 101:1–2' },
      { label: 'Dwells with integrity', verses: 'Psalm 101:2–4' },
      { label: 'Favors the faithful', verses: 'Psalm 101:6–8' },
    ],
  },
  {
    psalm: 102,
    attributes: [
      { label: 'Hears the destitute', verses: 'Psalm 102:16–20' },
      { label: 'Eternal King', verses: 'Psalm 102:12–13' },
      { label: 'Unchanging Creator', verses: 'Psalm 102:25–28' },
    ],
  },
  {
    psalm: 103,
    attributes: [
      { label: 'Forgiving', verses: 'Psalm 103:3, 10–12' },
      { label: 'Compassionate', verses: 'Psalm 103:8, 13' },
      { label: 'Merciful', verses: 'Psalm 103:8' },
      { label: 'Patient', verses: 'Psalm 103:8–9' },
      { label: 'Sovereign', verses: 'Psalm 103:19' },
    ],
  },
  {
    psalm: 104,
    attributes: [
      { label: 'Majestic Creator', verses: 'Psalm 104:1–9' },
      { label: 'Provider for creation', verses: 'Psalm 104:10–18' },
      { label: 'Life-giving Sustainer', verses: 'Psalm 104:27–30' },
    ],
  },
  {
    psalm: 105,
    attributes: [
      { label: 'Wonder-working', verses: 'Psalm 105:1–5' },
      { label: 'Covenant-keeping', verses: 'Psalm 105:7–11' },
      { label: 'Providential Deliverer', verses: 'Psalm 105:16–22' },
    ],
  },
  {
    psalm: 106,
    attributes: [
      { label: 'Good and Loving', verses: 'Psalm 106:1–3' },
      { label: 'Repeatedly Merciful', verses: 'Psalm 106:43–46' },
      { label: 'Saving Covenant-keeper', verses: 'Psalm 106:44–48' },
    ],
  },
  {
    psalm: 107,
    attributes: [
      { label: 'Steadfast Redeemer', verses: 'Psalm 107:1–3' },
      { label: 'Satisfies the needy', verses: 'Psalm 107:8–9' },
      { label: 'Rescuer in every distress', verses: 'Psalm 107:19–30' },
    ],
  },
  {
    psalm: 108,
    attributes: [
      { label: 'Exalted in love and faithfulness', verses: 'Psalm 108:3–6' },
      { label: 'Sovereign over nations', verses: 'Psalm 108:7–9' },
      { label: 'Giver of victory', verses: 'Psalm 108:12–13' },
    ],
  },
  {
    psalm: 109,
    attributes: [
      { label: 'God of praise', verses: 'Psalm 109:1–4' },
      { label: 'Advocate for the needy', verses: 'Psalm 109:26–31' },
      { label: 'Savior from condemnation', verses: 'Psalm 109:30–31' },
    ],
  },
  {
    psalm: 110,
    attributes: [
      { label: 'Enthrones His King', verses: 'Psalm 110:1–3' },
      { label: 'Appoints an eternal Priest', verses: 'Psalm 110:4–5' },
      { label: 'Victorious Judge', verses: 'Psalm 110:5–7' },
    ],
  },
  {
    psalm: 111,
    attributes: [
      { label: 'Great in works', verses: 'Psalm 111:2–4' },
      { label: 'Gracious Provider', verses: 'Psalm 111:4–7' },
      { label: 'Faithful Redeemer', verses: 'Psalm 111:7–9' },
    ],
  },
  {
    psalm: 112,
    attributes: [
      { label: 'Blesses those who fear Him', verses: 'Psalm 112:1–3' },
      { label: 'Gracious and Righteous', verses: 'Psalm 112:4–6' },
      { label: 'Gives steadfast security', verses: 'Psalm 112:7–9' },
    ],
  },
  {
    psalm: 113,
    attributes: [
      { label: 'Exalted above all', verses: 'Psalm 113:3–5' },
      { label: 'Stooping Observer', verses: 'Psalm 113:5–6' },
      { label: 'Lifter of the lowly', verses: 'Psalm 113:7–9' },
    ],
  },
  {
    psalm: 114,
    attributes: [
      { label: 'Dwells among His people', verses: 'Psalm 114:1–2' },
      { label: 'Lord over creation', verses: 'Psalm 114:3–7' },
      { label: 'Provider from rock', verses: 'Psalm 114:7–8' },
    ],
  },
  {
    psalm: 115,
    attributes: [
      { label: 'Glorious and Loving', verses: 'Psalm 115:1–3' },
      { label: 'Sovereign', verses: 'Psalm 115:2–3' },
      { label: 'Help and Shield', verses: 'Psalm 115:9–13' },
    ],
  },
  {
    psalm: 116,
    attributes: [
      { label: 'Listening and Responsive', verses: 'Psalm 116:1–2' },
      { label: 'Gracious and Compassionate', verses: 'Psalm 116:5–7' },
      { label: 'Deliverer from death', verses: 'Psalm 116:8–9' },
    ],
  },
  {
    psalm: 117,
    attributes: [
      { label: 'Worthy of universal praise', verses: 'Psalm 117:1–2' },
      { label: 'Steadfast in love', verses: 'Psalm 117:1–2' },
      { label: 'Faithful forever', verses: 'Psalm 117:1–2' },
    ],
  },
  {
    psalm: 118,
    attributes: [
      { label: 'Good and Loving', verses: 'Psalm 118:1–4' },
      { label: 'Present Helper and Refuge', verses: 'Psalm 118:5–9' },
      { label: 'Saving Cornerstone-giver', verses: 'Psalm 118:21–24' },
    ],
  },
  {
    psalm: 119,
    attributes: [
      { label: 'Righteous Lawgiver', verses: 'Psalm 119:137–144' },
      { label: 'Teacher and Guide', verses: 'Psalm 119:33–40' },
      { label: 'Near and Faithful', verses: 'Psalm 119:145–152' },
    ],
  },
  {
    psalm: 120,
    attributes: [
      { label: 'Answers distress', verses: 'Psalm 120:1–2' },
      { label: 'Deliverer from deceit', verses: 'Psalm 120:2–4' },
      { label: 'Just against falsehood', verses: 'Psalm 120:3–4' },
    ],
  },
  {
    psalm: 121,
    attributes: [
      { label: 'Helper', verses: 'Psalm 121:1–2' },
      { label: 'Keeper', verses: 'Psalm 121:3–5' },
      { label: 'Protector', verses: 'Psalm 121:5–7' },
      { label: 'Watchful', verses: 'Psalm 121:3–4, 8' },
    ],
  },
  {
    psalm: 122,
    attributes: [
      { label: 'Present in His house', verses: 'Psalm 122:1–2' },
      { label: 'Establishes justice', verses: 'Psalm 122:4–5' },
      { label: 'Giver of peace', verses: 'Psalm 122:6–9' },
    ],
  },
  {
    psalm: 123,
    attributes: [
      { label: 'Enthroned in heaven', verses: 'Psalm 123:1–2' },
      { label: 'Master worthy of trust', verses: 'Psalm 123:1–2' },
      { label: 'Merciful to the despised', verses: 'Psalm 123:3–4' },
    ],
  },
  {
    psalm: 124,
    attributes: [
      { label: 'Present Ally', verses: 'Psalm 124:1–3' },
      { label: 'Deliverer from danger', verses: 'Psalm 124:4–7' },
      { label: 'Creator and Helper', verses: 'Psalm 124:7–8' },
    ],
  },
  {
    psalm: 125,
    attributes: [
      { label: 'Surrounding Protector', verses: 'Psalm 125:1–2' },
      { label: 'Guardian of the righteous', verses: 'Psalm 125:3–4' },
      { label: 'Just Giver of peace', verses: 'Psalm 125:4–5' },
    ],
  },
  {
    psalm: 126,
    attributes: [
      { label: 'Restorer of fortunes', verses: 'Psalm 126:1–3' },
      { label: 'Doer of great things', verses: 'Psalm 126:2–3' },
      { label: 'Turns tears to joy', verses: 'Psalm 126:4–6' },
    ],
  },
  {
    psalm: 127,
    attributes: [
      { label: 'Builder and Guardian', verses: 'Psalm 127:1–2' },
      { label: 'Giver of rest', verses: 'Psalm 127:1–2' },
      { label: 'Giver of children', verses: 'Psalm 127:3–5' },
    ],
  },
  {
    psalm: 128,
    attributes: [
      { label: 'Blesses reverent obedience', verses: 'Psalm 128:1–4' },
      { label: 'Provider of fruitful work', verses: 'Psalm 128:2–4' },
      { label: 'Blesses from Zion', verses: 'Psalm 128:5–6' },
    ],
  },
  {
    psalm: 129,
    attributes: [
      { label: 'Righteous', verses: 'Psalm 129:4–5' },
      { label: 'Cuts bonds of oppression', verses: 'Psalm 129:2–4' },
      { label: 'Withholds blessing from hatred', verses: 'Psalm 129:5–8' },
    ],
  },
  {
    psalm: 130,
    attributes: [
      { label: 'Attentive Listener', verses: 'Psalm 130:1–2' },
      { label: 'Forgiving', verses: 'Psalm 130:3–4' },
      { label: 'Abundant Redeemer', verses: 'Psalm 130:5–8' },
    ],
  },
  {
    psalm: 131,
    attributes: [
      { label: 'Rest-giving', verses: 'Psalm 131:1–2' },
      { label: 'Nurturing Presence', verses: 'Psalm 131:1–2' },
      { label: 'Everlasting Hope', verses: 'Psalm 131:2–3' },
    ],
  },
  {
    psalm: 132,
    attributes: [
      { label: 'Remembers devotion', verses: 'Psalm 132:1–5' },
      { label: 'Covenant-keeping', verses: 'Psalm 132:11–12' },
      { label: 'Dwelling Provider and Savior', verses: 'Psalm 132:13–18' },
    ],
  },
  {
    psalm: 133,
    attributes: [
      { label: 'Delights in unity', verses: 'Psalm 133:1–2' },
      { label: 'Consecrates fellowship', verses: 'Psalm 133:2–3' },
      { label: 'Commands enduring blessing', verses: 'Psalm 133:2–3' },
    ],
  },
  {
    psalm: 134,
    attributes: [
      { label: 'Worthy of nightly praise', verses: 'Psalm 134:1–2' },
      { label: 'Dwells in His house', verses: 'Psalm 134:1–2' },
      { label: 'Creator who blesses', verses: 'Psalm 134:2–3' },
    ],
  },
  {
    psalm: 135,
    attributes: [
      { label: 'Good and Worthy', verses: 'Psalm 135:1–3' },
      { label: 'Sovereign Creator', verses: 'Psalm 135:5–7' },
      { label: 'Enduring Judge and Defender', verses: 'Psalm 135:13–14' },
    ],
  },
  {
    psalm: 136,
    attributes: [
      { label: 'Everlasting in love', verses: 'Psalm 136:1–3' },
      { label: 'Wise Creator', verses: 'Psalm 136:4–9' },
      { label: 'Remembering Provider', verses: 'Psalm 136:23–26' },
    ],
  },
  {
    psalm: 137,
    attributes: [
      { label: 'Worthy of remembered worship', verses: 'Psalm 137:4–6' },
      { label: 'Remembers injustice', verses: 'Psalm 137:7–8' },
      { label: 'Judge of oppressors', verses: 'Psalm 137:7–9' },
    ],
  },
  {
    psalm: 138,
    attributes: [
      { label: 'Loving and Faithful', verses: 'Psalm 138:1–2' },
      { label: 'Answers and Strengthens', verses: 'Psalm 138:3–5' },
      { label: 'Preserver who fulfills His purpose', verses: 'Psalm 138:6–8' },
    ],
  },
  {
    psalm: 139,
    attributes: [
      { label: 'All-knowing', verses: 'Psalm 139:1–6' },
      { label: 'Ever-present Guide', verses: 'Psalm 139:7–12' },
      { label: 'Intentional Creator', verses: 'Psalm 139:13–18' },
    ],
  },
  {
    psalm: 140,
    attributes: [
      { label: 'Deliverer from evil', verses: 'Psalm 140:1–4' },
      { label: 'Strength and Protector', verses: 'Psalm 140:6–8' },
      { label: 'Just Defender of the needy', verses: 'Psalm 140:12–13' },
    ],
  },
  {
    psalm: 141,
    attributes: [
      { label: 'Attentive to prayer', verses: 'Psalm 141:1–2' },
      { label: 'Guardian of speech and heart', verses: 'Psalm 141:3–4' },
      { label: 'Refuge from traps', verses: 'Psalm 141:8–10' },
    ],
  },
  {
    psalm: 142,
    attributes: [
      { label: 'Listener to complaint', verses: 'Psalm 142:1–2' },
      { label: 'Knows the hidden path', verses: 'Psalm 142:3–4' },
      { label: 'Refuge and Deliverer', verses: 'Psalm 142:5–7' },
    ],
  },
  {
    psalm: 143,
    attributes: [
      { label: 'Faithful and Righteous', verses: 'Psalm 143:1–2' },
      { label: 'Loving Guide', verses: 'Psalm 143:7–10' },
      { label: 'Preserver and Deliverer', verses: 'Psalm 143:11–12' },
    ],
  },
  {
    psalm: 144,
    attributes: [
      { label: 'Rock and Trainer', verses: 'Psalm 144:1–2' },
      { label: 'Fortress and Deliverer', verses: 'Psalm 144:1–2' },
      { label: 'Blessing Provider', verses: 'Psalm 144:12–15' },
    ],
  },
  {
    psalm: 145,
    attributes: [
      { label: 'Great and Gracious King', verses: 'Psalm 145:1–8' },
      { label: 'Compassionate Provider', verses: 'Psalm 145:14–16' },
      { label: 'Near and Righteous', verses: 'Psalm 145:17–20' },
    ],
  },
  {
    psalm: 146,
    attributes: [
      { label: 'Faithful Creator', verses: 'Psalm 146:5–6' },
      { label: 'Just Provider and Liberator', verses: 'Psalm 146:7–8' },
      { label: 'Protector and Eternal King', verses: 'Psalm 146:9–10' },
    ],
  },
  {
    psalm: 147,
    attributes: [
      { label: 'Restoring Healer', verses: 'Psalm 147:2–3' },
      { label: 'Great and All-knowing', verses: 'Psalm 147:4–5' },
      { label: 'Provider who delights in trust', verses: 'Psalm 147:8–11' },
    ],
  },
  {
    psalm: 148,
    attributes: [
      { label: 'Creator by command', verses: 'Psalm 148:3–6' },
      { label: 'Exalted above creation', verses: 'Psalm 148:11–13' },
      { label: 'Strength of His people', verses: 'Psalm 148:13–14' },
    ],
  },
  {
    psalm: 149,
    attributes: [
      { label: 'Maker and King', verses: 'Psalm 149:1–2' },
      { label: 'Delights in His people', verses: 'Psalm 149:3–4' },
      { label: 'Savior who honors the humble', verses: 'Psalm 149:4–5' },
    ],
  },
  {
    psalm: 150,
    attributes: [
      { label: 'Holy and Mighty', verses: 'Psalm 150:1–2' },
      { label: 'Excellent in greatness', verses: 'Psalm 150:1–2' },
      { label: 'Worthy of all praise', verses: 'Psalm 150:3–6' },
    ],
  },
];

export const getPsalmReflection = (psalm: number): PsalmReflection =>
  psalmReflections[psalm - 1] ?? psalmReflections[0];
