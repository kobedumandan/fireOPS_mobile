import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Colors from '../constants/colors';

export default function EmergencyBanner({ incidentId, location }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.banner}>
      <Animated.View style={[styles.dot, { opacity }]} />
      <View>
        <Text style={styles.bannerTitle}>Emergency Active</Text>
        <Text style={styles.sub}>
          {incidentId} · {location}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: Colors.accentFireDim,
    borderWidth: 1,
    borderColor: 'rgba(255,77,26,0.35)',
    borderRadius: 8,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentFire,
    shadowColor: Colors.accentFire,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    marginRight: 6,
  },
  bannerTitle: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 12,
    letterSpacing: 1.3,
    color: Colors.accentFire,
    textTransform: 'uppercase',
  },
  sub: {
    // fontFamily: 'ShareTechMono_400Regular',
    fontSize: 12,
    fontWeight: 800,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
