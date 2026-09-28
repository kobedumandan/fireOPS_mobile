import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '../constants/colors';

function Badge({ label, variant = 'fire' }) {
  const palette = Colors[`badge${variant.charAt(0).toUpperCase() + variant.slice(1)}`];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

export default function IncidentCard({ incidentId, location, time, onPress }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Assigned Incident</Text>
      <Text style={styles.cardId}>{incidentId}</Text>
      <Text style={styles.cardLoc}>
        {location}  |  {time}
      </Text>
      <View style={styles.badges}>
        <Badge label="Critical" variant="fire" />
        <Badge label="Emergency Active" variant="amber" />
      </View>
      <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.btnText}>View Incident Details</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 14,
    backgroundColor: Colors.bgPanel,
    // borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 19,
  },
  cardLabel: {
    fontFamily: 'AxiformaMedium',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    // textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardId: {
    fontFamily: 'AxiformaMedium',
    fontSize: 23,
    color: Colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 1,
  },
  cardLoc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontWeight: 400,
  },
  badges: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 3,
    marginBottom: 28,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontFamily: 'AxiformaMedium',
    fontSize: 8.8,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  btn: {
    backgroundColor: Colors.accentFire,
    borderRadius: 6,
    padding: 7,
    alignItems: 'center',
    shadowColor: Colors.accentFire,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: {
    fontFamily: 'AxiformaMedium',
    fontSize: 12.8,
    color: '#fff',
    letterSpacing: -0.2,
    // textTransform: 'uppercase',
  },
});
