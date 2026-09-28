import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AlertItem from '../components/AlertItem';
import Colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';

// "4m ago" for the first hour — what matters mid-dispatch — then the clock
// time the alert was logged at.
function relTime(alert, now) {
  if (!alert.at) return alert.time;
  const mins = Math.floor((now - alert.at) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return alert.time;
}

export default function AlertsScreen({ navigation }) {
  const { alerts, unreadAlerts, markAlertsRead, clearAlerts } = useAuth();
  // Snapshot which items were new when the screen opened, so they keep their
  // highlight while being read even though they're marked read immediately.
  const [newIds] = useState(
    () => new Set(alerts.filter((a) => a.unread).map((a) => a.id))
  );
  // Re-renders the relative stamps while the screen is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (unreadAlerts > 0) markAlertsRead();
  }, [unreadAlerts, markAlertsRead]);

  const fresh = alerts.filter((a) => newIds.has(a.id));
  const earlier = alerts.filter((a) => !newIds.has(a.id));

  const renderGroup = (label, items) =>
    items.length > 0 && (
      <View key={label}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeader}>{label}</Text>
          <Text style={styles.sectionCount}>{items.length}</Text>
        </View>
        <View style={styles.group}>
          {items.map((alert) => (
            <AlertItem
              key={alert.id}
              title={alert.title}
              body={alert.body}
              time={relTime(alert, now)}
              icon={alert.icon}
              variant={alert.variant}
              unread={newIds.has(alert.id)}
            />
          ))}
        </View>
      </View>
    );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Alerts</Text>
            {newIds.size > 0 && (
              <View style={styles.newChip}>
                <Text style={styles.newChipText}>{newIds.size} new</Text>
              </View>
            )}
          </View>
          <Text style={styles.headerSub}>Dispatch, route and incident updates</Text>
        </View>
        {alerts.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={clearAlerts}
            activeOpacity={0.7}
          >
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.scrollWrap}>
        {alerts.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={24} color={Colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptySub}>
              Dispatch, route and incident updates will appear here while you are signed in.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderGroup('New', fresh)}
            {renderGroup('Earlier', earlier)}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 13,
    backgroundColor: Colors.bgPanel,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: Colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'AxiformaMedium',
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  headerSub: {
    fontFamily: 'AxiformaRegular',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginTop: 1,
  },
  newChip: {
    backgroundColor: Colors.accentFireDim,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newChipText: {
    fontFamily: 'AxiformaMedium',
    fontSize: 8.8,
    color: Colors.accentFire,
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  clearBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearText: {
    fontFamily: 'AxiformaMedium',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
  },
  scrollWrap: {
    flex: 1,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    marginHorizontal: 3,
    backgroundColor: Colors.pageDefaultBase,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionHeader: {
    fontFamily: 'AxiformaMedium',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontFamily: 'AxiformaRegular',
    fontSize: 10,
    color: Colors.textMuted,
  },
  group: {
    gap: 8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 60,
    gap: 8,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: 'AxiformaMedium',
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  emptySub: {
    fontFamily: 'AxiformaRegular',
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
