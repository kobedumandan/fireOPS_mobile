import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AlertItem from '../components/AlertItem';
import Colors from '../constants/colors';

const ALERTS = [
  {
    id: 1,
    title: 'Emergency Mode Activated',
    body: 'INC-084 · Brgy. San Isidro. Report to dispatch immediately.',
    time: '14:12',
    variant: 'fire',
    unread: true,
  },
  {
    id: 2,
    title: 'Route Updated',
    body: 'Route 1 recalculated by GNN-RL. New ETA: 4 min.',
    time: '14:09',
    variant: 'amber',
    unread: true,
  },
  {
    id: 3,
    title: 'Dispatch Assigned',
    body: 'You are assigned to Alpha Team · INC-084.',
    time: '14:05',
    variant: 'blue',
    unread: false,
  },
  {
    id: 4,
    title: 'IoT Device Active',
    body: 'BFP-ESP-002 GPS signal confirmed. Battery 62%.',
    time: '13:50',
    variant: 'green',
    unread: false,
  },
  {
    id: 5,
    title: 'Standby Cleared',
    body: 'Previous INC-081 closed. You are now on standby.',
    time: '13:20',
    variant: 'muted',
    unread: false,
  },
];

export default function AlertsScreen({ navigation }) {
  const newCount = ALERTS.filter((a) => a.unread).length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Ionicons
          name="chevron-back"
          size={20}
          color={Colors.textSecondary}
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.title}>Alerts</Text>
        {newCount > 0 && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{newCount} NEW</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {ALERTS.map((alert) => (
          <AlertItem
            key={alert.id}
            title={alert.title}
            body={alert.body}
            time={alert.time}
            variant={alert.variant}
            unread={alert.unread}
          />
        ))}
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  topBar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgPanel,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 20,
    color: Colors.textPrimary,
    flex: 1,
  },
  newBadge: {
    backgroundColor: Colors.accentFire,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
  bottomPad: {
    height: 12,
  },
});
