import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

const SIDE_TABS = [
  { name: 'Home',     icon: 'home',     label: 'Home' },
  { name: 'Settings', icon: 'settings', label: 'Settings' },
];

const CENTER_TAB = { name: 'Route', icon: 'map', label: 'Route' };

export default function BottomNav({ state, navigation }) {
  const insets = useSafeAreaInsets();

  const renderSide = (tab) => {
    const index = state.routes.findIndex((r) => r.name === tab.name);
    const isFocused = state.index === index;
    const color = isFocused ? Colors.accentFire : Colors.textTertiary;

    return (
      <TouchableOpacity
        key={tab.name}
        style={styles.navItem}
        onPress={() => navigation.navigate(tab.name)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isFocused ? tab.icon : `${tab.icon}-outline`}
          size={14}
          color={color}
        />
        <Text style={[styles.label, { color }]}>{tab.label}</Text>
      </TouchableOpacity>
    );
  };

  const centerIndex = state.routes.findIndex((r) => r.name === CENTER_TAB.name);
  const centerFocused = state.index === centerIndex;

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <View style={styles.container}>
        {renderSide(SIDE_TABS[0])}
        <View style={styles.centerSpacer} />
        {renderSide(SIDE_TABS[1])}
      </View>

      <TouchableOpacity
        style={[
          styles.centerButton,
          centerFocused && styles.centerButtonActive,
        ]}
        onPress={() => navigation.navigate(CENTER_TAB.name)}
        activeOpacity={0.85}
      >
        <Ionicons name={CENTER_TAB.icon} size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const CIRCLE_SIZE = 69;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  container: {
    height: 60,
    backgroundColor: Colors.bgPanel,
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 12,
    borderWidth: 1,
    borderColor: Colors.borderDim,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1.2,
  },
  centerSpacer: {
    width: CIRCLE_SIZE,
  },
  label: {
    fontFamily: 'AxiformaBold',
    fontSize: 9.8,
    letterSpacing: -0.1,
    marginTop: 1,
  },
  centerButton: {
    position: 'absolute',
    top: -CIRCLE_SIZE / 2.4,
    left: '50%',
    marginLeft: -CIRCLE_SIZE / 2,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: Colors.accentFire,
    alignItems: 'center',
    justifyContent: 'center',
    // borderWidth: 0,
    // borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  centerButtonActive: {
    backgroundColor: Colors.accentFire,
  },
});
