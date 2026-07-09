import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Colors from '../constants/colors';

const ACCENT_MAP = {
  fire:  Colors.accentFire,
  amber: Colors.accentAmber,
  blue:  Colors.accentBlue,
  green: Colors.accentGreen,
  muted: Colors.textMuted,
};

export default function AlertItem({ title, body, time, variant = 'muted', unread = false }) {
  const accentColor = ACCENT_MAP[variant] ?? Colors.textMuted;

  const dotOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!unread) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1,   duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [unread, dotOpacity]);

  return (
    <TouchableOpacity
      style={[styles.item, { borderLeftColor: accentColor }]}
      activeOpacity={0.75}
    >
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {unread && (
            <Animated.View style={[styles.unreadDot, { opacity: dotOpacity, backgroundColor: Colors.accentFire }]} />
          )}
        </View>
        <Text style={styles.time}>{time}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  unreadDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  time: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 9,
    color: Colors.textMuted,
    marginLeft: 8,
    marginTop: 1,
    flexShrink: 0,
  },
  body: {
    fontSize: 10,
    color: Colors.textSecondary,
    lineHeight: 14,
  },
});
