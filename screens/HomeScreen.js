import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import IncidentCard from "../components/IncidentCard";
import TeamCard from "../components/TeamCard";
import IncidentDetailsModal from "../components/IncidentDetailsModal";
import Colors from "../constants/colors";
import { useAuth } from "../context/AuthContext";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning,";
  if (h < 18) return "Good Afternoon,";
  return "Good Evening,";
}

function displayName(user) {
  if (!user) return "Officer";
  const name = user.last_name ?? user.first_name ?? "";
  return user.rank && name ? `${user.rank} ${name}` : name || "Officer";
}

function getInitials(user) {
  if (!user) return "?";
  const first = (user.first_name ?? "").trim();
  const last = (user.last_name ?? "").trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return initials || "?";
}

const QUICK_TILES = [
  { icon: "map", label: "My Route", screen: "Route" },
  { icon: "flame", label: "Heatmap", screen: "Incident" },
  { icon: "settings", label: "Settings", screen: "Settings" },
  { icon: "navigate", label: "Dispatch", screen: "Route" },
];

function StatusCard({
  icon,
  label,
  value,
  color,
  dimColor,
  borderColor,
  iconColor,
  pulse,
}) {
  const dotOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, {
          toValue: 0.25,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dotOpacity, pulse]);

  return (
    <View
      style={[styles.statusCard, { backgroundColor: dimColor, borderColor }]}
    >
      <View style={styles.statusTop}>
        <Text style={styles.statusLabel}>{label}</Text>
        <View style={styles.statusIconWrap}>
          <Ionicons name={icon} size={14} color={iconColor} />
        </View>
        {/* <Animated.View
          style={[
            styles.statusDot,
            { backgroundColor: color },
            pulse ? { opacity: dotOpacity } : null,
          ]}
        /> */}
      </View>
      <Text style={[styles.statusValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, status, token, refreshStatus } = useAuth();
  const dispatch = status?.dispatch ?? null;
  const incident = dispatch?.incident ?? null;
  const isTeamLeader = dispatch?.is_team_leader ?? false;
  const [detailsVisible, setDetailsVisible] = useState(false);

  const dispatchId = dispatch?.dispatch_id
    ? `DISP-${dispatch.dispatch_id}`
    : null;
  const dispatchLoc = incident?.fire_address ?? null;
  const dispatchTime = (() => {
    const raw = dispatch?.dispatch_at ?? null;
    if (!raw) return null;
    try {
      return new Date(raw).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return raw;
    }
  })();

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.name}>{displayName(user)}</Text>
        </View>
        <View style={styles.bellAndPerAVWrap}>
          <TouchableOpacity
            style={styles.bellWrap}
            onPress={() => navigation.navigate("Settings")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="notifications"
              size={15}
              color={Colors.textSecondary}
            />
            <View style={styles.bellDot} />
          </TouchableOpacity>
          <View style={styles.perAV}>
            <Text style={styles.perAVText}>{getInitials(user)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.scrollWrap}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusRow}>
            <StatusCard
              icon="navigate"
              label="Tracking"
              value="Active"
              color={Colors.accentGreen}
              dimColor={"transparent"}
              iconColor={Colors.textPrimary}
              borderColor={Colors.borderDim}
            />
            <StatusCard
              icon="people"
              label="Member Status"
              value={dispatch ? "Dispatched" : "Standby"}
              color={dispatch ? Colors.accentFire : Colors.accentBlue}
              dimColor={"transparent"}
              iconColor={Colors.textPrimary}
              borderColor={Colors.borderDim}
            />
          </View>

          {dispatch ? (
            <IncidentCard
              incidentId={dispatchId}
              location={dispatchLoc}
              time={dispatchTime}
              onPress={() => setDetailsVisible(true)}
            />
          ) : null}

          <TeamCard />

          {/* Quick access grid */}
          {/* <View style={styles.quickGrid}>
            {QUICK_TILES.map((tile) => (
              <TouchableOpacity
                key={tile.label}
                style={styles.quickCard}
                onPress={() => navigation.navigate(tile.screen)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={`${tile.icon}-outline`}
                  size={22}
                  color={Colors.accentFire}
                />
                <Text style={styles.quickLabel}>{tile.label}</Text>
              </TouchableOpacity>
            ))}
          </View> */}

          <View style={styles.bottomPad} />
        </ScrollView>
      </View>

      <IncidentDetailsModal
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
        incident={incident}
        dispatch={dispatch}
        isTeamLeader={isTeamLeader}
        token={token}
        onContained={refreshStatus}
        onArrived={refreshStatus}
        onCreateReport={() =>
          navigation.navigate("Report", {
            incident,
            dispatchId: dispatch?.dispatch_id ?? null,
          })
        }
      />
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
    paddingTop: 10,
    paddingBottom: 13,
    backgroundColor: Colors.bgPanel,
    // borderBottomWidth: 1,
    // borderBottomColor: Colors.borderDim,
    // borderBottomStartRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: {
    fontFamily: "AxiformaRegular",
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  name: {
    fontFamily: "AxiformaMedium",
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  bellWrap: {
    position: "relative",
    padding: 4,
  },
  bellDot: {
    position: "absolute",
    right: 3,
    top: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentFire,
    borderWidth: 1.5,
    borderColor: Colors.bgPanel,
  },
  perAV: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: Colors.bgHover,
    borderWidth: 1,
    // borderColor: Colors.badgeFire.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bellAndPerAVWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    // borderWidth: 1,
    // borderColor: 'white',
  },
  perAVText: {
    fontFamily: "AxiformaMedium",
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  scrollWrap: {
    flex: 1,
    borderWidth: 1,
    // borderColor: Colors.borderDim,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    marginHorizontal: 3,
    backgroundColor: Colors.pageDefaultBase,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 1,
    paddingVertical: 13,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  quickGrid: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  quickCard: {
    width: "47.5%",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  quickLabel: {
    fontFamily: "BarlowCondensed_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
  },
  statusCard: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 13,
    gap: 8,
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontFamily: "AxiformaMedium",
    fontSize: 10.8,
    letterSpacing: -0.2 ,
    color: Colors.textSecondary,
    // textTransform: "uppercase",
  },
  statusValue: {
    fontFamily: "AxiformaMedium",
    fontSize: 11,
    letterSpacing: -0.3,
  },
  statusIconWrap: {
    padding: 6,
    backgroundColor: Colors.bgHover,
    borderRadius: 8,
  },
  bottomPad: {
    height: 12,
  },
});
