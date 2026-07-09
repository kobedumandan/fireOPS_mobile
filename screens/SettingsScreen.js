import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';

function SectionHeader({ label }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function SettingRow({ icon, label, value, onPress, rightElement }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={16} color={Colors.accentFire} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {rightElement ?? (
          <Ionicons name="chevron-forward" size={15} color={Colors.textSecondary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function profileDisplayName(user) {
  if (!user) return 'Officer';
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return full || 'Officer';
}

function avatarInitial(user) {
  return (user?.last_name ?? user?.first_name ?? '?').charAt(0).toUpperCase();
}

export default function SettingsScreen() {
  const { logout, user } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationTracking, setLocationTracking] = useState(true);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const name    = profileDisplayName(user);
  const initial = avatarInitial(user);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.scrollWrap}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
        <SectionHeader label="Profile" />
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{name}</Text>
              {user?.email ? <Text style={styles.profileMeta}>{user.email}</Text> : null}
              {user?.designation ? <Text style={styles.profileId}>{user.designation}</Text> : null}
            </View>
          </View>
        </View>

        {/* Notifications */}
        <SectionHeader label="Notifications" />
        <View style={styles.card}>
          <SettingRow
            icon="notifications-outline"
            label="Push Notifications"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: Colors.border, true: Colors.accentFire }}
                thumbColor="#fff"
              />
            }
          />
          <Divider />
          <SettingRow
            icon="warning-outline"
            label="Emergency Alerts"
            value="All"
          />
          <Divider />
          <SettingRow
            icon="volume-high-outline"
            label="Alert Sound"
            value="Siren"
          />
        </View>

        {/* Location */}
        {/* <SectionHeader label="Location" />
        <View style={styles.card}>
          <SettingRow
            icon="location-outline"
            label="IoT Location Tracking"
            rightElement={
              <Switch
                value={locationTracking}
                onValueChange={setLocationTracking}
                trackColor={{ false: Colors.border, true: Colors.accentFire }}
                thumbColor="#fff"
              />
            }
          />
          <Divider />
          <SettingRow
            icon="hardware-chip-outline"
            label="Device ID"
            value="BFP-ESP-002"
          />
        </View> */}

        {/* App */}
        <SectionHeader label="Application" />
        <View style={styles.card}>
          <SettingRow icon="moon-outline" label="Theme" value="Dark" />
          <Divider />
          <SettingRow icon="language-outline" label="Language" value="English" />
          <Divider />
          <SettingRow icon="shield-checkmark-outline" label="Privacy Policy" />
          <Divider />
          <SettingRow icon="document-text-outline" label="Terms of Use" />
        </View>

        {/* About */}
        <SectionHeader label="About" />
        <View style={styles.card}>
          <SettingRow icon="phone-portrait-outline" label="App Version" value="v0.1.0" />
          <Divider />
          <SettingRow icon="business-outline" label="Organization" value="BFP Panabo City" />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setLogoutConfirm(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <ConfirmModal
          visible={logoutConfirm}
          icon="log-out-outline"
          title="Sign Out?"
          message="You'll be signed out and live location tracking will stop. You'll need to log in again to receive dispatches."
          confirmLabel="Sign Out"
          tone="danger"
          onConfirm={() => {
            setLogoutConfirm(false);
            logout();
          }}
          onCancel={() => setLogoutConfirm(false)}
        />

        <View style={styles.bottomPad} />
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 13,
    backgroundColor: Colors.bgPanel,
  },
  headerTitle: {
    fontFamily: 'AxiformaBold',
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -1,
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
    paddingBottom: 100,
  },
  sectionHeader: {
    fontFamily: 'AxiformaBold',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: 12,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontFamily: 'AxiformaBold',
    fontSize: 13,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  rowValue: {
    fontFamily: 'AxiformaRegular',
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderDim,
    marginLeft: 56,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.accentFire,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'AxiformaBlack',
    fontSize: 22,
    color: '#fff',
    letterSpacing: -0.5,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: 'AxiformaBold',
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 2,
  },
  profileMeta: {
    fontFamily: 'AxiformaRegular',
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  profileId: {
    fontFamily: 'AxiformaRegular',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: -0.2,
  },
  logoutBtn: {
    marginHorizontal: 12,
    marginTop: 22,
    backgroundColor: Colors.accentFire,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.accentFire,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoutText: {
    fontFamily: 'AxiformaBold',
    fontSize: 12.8,
    color: '#fff',
    letterSpacing: -0.3,
    // textTransform: "uppercase",
  },
  bottomPad: {
    height: 12,
  },
});