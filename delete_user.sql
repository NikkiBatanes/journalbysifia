-- Delete user 14fcc448-ec2a-4a12-b729-1f4be83eb9ae in correct order to handle foreign key constraints

-- Delete from device_tokens first (child table)
DELETE FROM device_tokens WHERE user_id = '14fcc448-ec2a-4a12-b729-1f4be83eb9ae';

-- Delete from other potential user-related tables
DELETE FROM user_profiles WHERE id = '14fcc448-ec2a-4a12-b729-1f4be83eb9ae';
DELETE FROM playbooks WHERE user_id = '14fcc448-ec2a-4a12-b729-1f4be83eb9ae';
DELETE FROM devotionals WHERE user_id = '14fcc448-ec2a-4a12-b729-1f4be83eb9ae';
DELETE FROM prayer_requests WHERE user_id = '14fcc448-ec2a-4a12-b729-1f4be83eb9ae';
DELETE FROM journal_entries WHERE user_id = '14fcc448-ec2a-4a12-b729-1f4be83eb9ae';

-- Finally delete from auth.users (parent table)
DELETE FROM auth.users WHERE id = '14fcc448-ec2a-4a12-b729-1f4be83eb9ae';
