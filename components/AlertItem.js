import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

// Tile tint + glyph colour per variant — the same tinted-puck treatment the
// web dashboard's alert panel uses, so an alert reads the same on both.
const TONE = {
  fire:  { fg: Colors.accentFire,    bg: Colors.accentFireDim },
  amber: { fg: Colors.accentAmber,   bg: Colors.accentAmberDim },
  blue:  { fg: Colors.accentBlue,    bg: Colors.accentBlueDim },
  green: { fg: Colors.accentGreen,   bg: Colors.accentGreenDim },
  muted: { fg: Colors.textSecondary, bg: Colors.bgHover },
};

export default function AlertItem({
  title,
  body,
  time,
  icon = 'notifications',
  variant = 'muted',
  unread = false,
}) {
  const tone = TONE[variant] ?? TONE.muted;
  const dotOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!unread) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.25, duration: 500, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [unread, dotOpacity]);

  return (
    <View
      style={[
        styles.card,
        unread && { borderColor: tone.fg + '40', backgroundColor: tone.bg },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: unread ? Colors.bgPanel : tone.bg }]}>
        <Ionicons name={icon} size={17} color={tone.fg} />
        {unread && (
          <Animated.View
            style={[styles.unreadDot, { backgroundColor: tone.fg, opacity: dotOpacity }]}
          />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        {body ? <Text style={styles.text}>{body}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.pageDefaultBase,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  title: {
    flex: 1,
    fontFamily: 'AxiformaMedium',
    fontSize: 13,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  time: {
    fontFamily: 'AxiformaRegular',
    fontSize: 10.5,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
  },
  text: {
    fontFamily: 'AxiformaRegular',
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
  },
});
