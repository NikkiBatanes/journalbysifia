import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useUser } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';

export default function UserProfileScreen() {
  const { name, setName } = useUser();
  const [input, setInput] = useState(name);
  const { logout } = useAuth();

  // Sync input with context when the screen mounts or name changes
  useEffect(() => {
    setInput(name);
  }, [name]);

  const handleSave = async () => {
    if (input) {
      await setName(input);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Profile</Text>
      <Text style={styles.label}>Your Name</Text>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="Enter your name"
        autoCapitalize="words"
      />
      <Button title="Save" onPress={handleSave} disabled={!input.trim()} />
      <Button title="Log Out" onPress={logout} color="#d9534f" />
      {name ? <Text style={styles.greeting}>Hello, {name}!</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center', backgroundColor: '#F8F9FB' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
  label: { fontSize: 18, marginBottom: 8, alignSelf: 'flex-start' },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, backgroundColor: '#fff' },
  greeting: { marginTop: 20, fontSize: 16, color: '#666' },
});
