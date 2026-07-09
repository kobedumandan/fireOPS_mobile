import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/colors';

export default function TrucksScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.center}>
        <Text style={styles.label}>LIVE TRUCKS</Text>
        <Text style={styles.sub}>Screen coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  sub: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
  },
});
