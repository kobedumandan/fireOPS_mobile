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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

function clockTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function elapsed(iso, now) {
  if (!iso) return null;
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return null;
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

// Tint pairs, so a pill and its icon tile always come from the same accent.
const TONE = {
  fire: { fg: Colors.accentFire, bg: Colors.accentFireDim },
  amber: { fg: Colors.accentAmber, bg: Colors.accentAmberDim },
  blue: { fg: Colors.accentBlue, bg: Colors.accentBlueDim },
  green: { fg: Colors.accentGreen, bg: Colors.accentGreenDim },
  muted: { fg: Colors.textSecondary, bg: Colors.bgHover },
};

const SEVERITY_TONE = { Critical: "fire", Moderate: "amber", Minor: "blue" };

const DISPATCH_LABEL = {
  dispatched: { label: "Dispatched", tone: "amber" },
  en_route: { label: "En Route", tone: "amber" },
  on_scene: { label: "On Scene", tone: "blue" },
};

function Pill({ label, tone = "muted" }) {
  const t = TONE[tone] ?? TONE.muted;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

function PulseDot({ color }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.pulseDot, { backgroundColor: color, opacity }]} />;
}

function StatusTile({ icon, label, value, tone }) {
  const t = TONE[tone] ?? TONE.muted;
  return (
    <View style={styles.statusCard}>
      <View style={styles.statusTop}>
        <Text style={styles.statusLabel}>{label}</Text>
        <View style={styles.statusIconWrap}>
          <Ionicons name={icon} size={14} color={Colors.textPrimary} />
        </View>
      </View>
      <View style={styles.statusValueRow}>
        <View style={[styles.statusDot, { backgroundColor: t.fg }]} />
        <Text style={[styles.statusValue, { color: t.fg }]}>{value}</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value, valueColor, last }) {
  return (
    <View style={[styles.infoRow, last && { marginBottom: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function QuickTile({ icon, iconSet = "ion", label, sub, onPress, badge }) {
  const Icon = iconSet === "mci" ? MaterialCommunityIcons : Ionicons;
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.quickTop}>
        <View style={styles.quickIcon}>
          <Icon name={icon} size={17} color={Colors.textPrimary} />
        </View>
        {badge ? (
          <View style={styles.quickBadge}>
            <Text style={styles.quickBadgeText}>{badge}</Text>
          </View>
        ) : (
          <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
        )}
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickSub} numberOfLines={1}>{sub}</Text>
    </TouchableOpacity>
  );
}

/* The one thing a responder opens the app to find out: am I going somewhere,
   and where. Everything about the live dispatch lives in this card. */
function DispatchHero({ dispatch, incident, now, onDetails, onRoute }) {
  const contained = incident?.fire_status === "contained";
  const ds = DISPATCH_LABEL[dispatch.dispatch_status] ?? { label: dispatch.dispatch_status, tone: "muted" };
  const place = incident?.fire_location_name || incident?.fire_address || "Incident location";
  const since = elapsed(dispatch.dispatch_at, now);
  const truck = dispatch.truck;
  const role = dispatch.is_team_leader ? "Team Leader" : dispatch.is_driver ? "Driver" : "Responder";

  return (
    <View style={[styles.hero, contained ? styles.heroContained : styles.heroActive]}>
      <View style={styles.heroTag}>
        {contained ? (
          <Ionicons name="checkmark-circle" size={13} color={Colors.accentGreen} />
        ) : (
          <PulseDot color={Colors.accentFire} />
        )}
        <Text style={[styles.heroTagText, { color: contained ? Colors.accentGreen : Colors.accentFire }]}>
          {contained ? "Fire Contained" : "Emergency Active"}
        </Text>
        {since && <Text style={styles.heroSince}>{since}</Text>}
      </View>

      <Text style={styles.heroId}>DISP-{dispatch.dispatch_id}</Text>
      <Text style={styles.heroPlace} numberOfLines={2}>{place}</Text>
      {incident?.fire_address && incident.fire_address !== place ? (
        <Text style={styles.heroAddr} numberOfLines={1}>{incident.fire_address}</Text>
      ) : null}

      <View style={styles.heroPills}>
        {incident?.fire_severity && (
          <Pill label={incident.fire_severity} tone={SEVERITY_TONE[incident.fire_severity] ?? "muted"} />
        )}
        {incident?.fire_level && <Pill label={incident.fire_level} tone="muted" />}
        <Pill label={ds.label} tone={ds.tone} />
      </View>

      <View style={styles.heroMeta}>
        <View style={styles.heroMetaItem}>
          <Text style={styles.heroMetaLabel}>Dispatched</Text>
          <Text style={styles.heroMetaValue}>{clockTime(dispatch.dispatch_at)}</Text>
        </View>
        <View style={styles.heroMetaDivider} />
        <View style={styles.heroMetaItem}>
          <Text style={styles.heroMetaLabel}>Truck</Text>
          <Text style={styles.heroMetaValue} numberOfLines={1}>{truck?.truck_platenum ?? "—"}</Text>
        </View>
        <View style={styles.heroMetaDivider} />
        <View style={styles.heroMetaItem}>
          <Text style={styles.heroMetaLabel}>Role</Text>
          <Text style={styles.heroMetaValue} numberOfLines={1}>{role}</Text>
        </View>
      </View>

      <View style={styles.heroActions}>
        <TouchableOpacity style={styles.btnPrimary} onPress={onDetails} activeOpacity={0.85}>
          <Text style={styles.btnPrimaryText}>Incident Details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={onRoute} activeOpacity={0.8}>
          <Ionicons name="navigate" size={14} color={Colors.textPrimary} />
          <Text style={styles.btnSecondaryText}>Route</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StandbyHero({ station, shift }) {
  return (
    <View style={styles.hero}>
      <View style={styles.standbyRow}>
        <View style={[styles.standbyIcon, { backgroundColor: Colors.accentBlueDim }]}>
          <Ionicons name="shield-checkmark" size={22} color={Colors.accentBlue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.standbyTitle}>On Standby</Text>
          <Text style={styles.standbySub}>
            No active dispatch. You'll be alerted the moment one comes in.
          </Text>
        </View>
      </View>
      <View style={styles.heroPills}>
        {station && <Pill label={station} tone="muted" />}
        {shift && <Pill label={shift} tone="blue" />}
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, status, token, refreshStatus, unreadAlerts, deviationState } = useAuth();
  const dispatch = status?.dispatch ?? null;
  const incident = dispatch?.incident ?? null;
  const isTeamLeader = dispatch?.is_team_leader ?? false;
  const team = status?.team ?? null;
  const stationName = status?.station?.station_name ?? null;
  const shiftName = status?.shift?.shift_name ?? null;
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Ticks the "12m ago" on the dispatch card; idle on standby.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!dispatch) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [dispatch]);

  // Location is only reported while a dispatch is active (see
  // useLocationTracking), so the tile says so rather than claiming "Active".
  const tracking = !dispatch
    ? { value: "Idle", tone: "muted" }
    : deviationState?.isDeviated
    ? { value: "Off Route", tone: "amber" }
    : { value: "Live", tone: "green" };

  const duty = dispatch
    ? DISPATCH_LABEL[dispatch.dispatch_status] ?? { label: "Dispatched", tone: "amber" }
    : { label: "Standby", tone: "blue" };

  const loading = status === null;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.name} numberOfLines={1}>{displayName(user)}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate("Alerts")}
            activeOpacity={0.7}
            accessibilityLabel="Alerts"
          >
            <Ionicons name="notifications" size={17} color={Colors.textPrimary} />
            {unreadAlerts > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadAlerts > 9 ? "9+" : unreadAlerts}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate("Settings")}
            activeOpacity={0.8}
            accessibilityLabel="Profile and settings"
          >
            <Text style={styles.avatarText}>{getInitials(user)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.scrollWrap}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          {dispatch ? (
            <DispatchHero
              dispatch={dispatch}
              incident={incident}
              now={now}
              onDetails={() => setDetailsVisible(true)}
              onRoute={() => navigation.navigate("Route")}
            />
          ) : !loading ? (
            <StandbyHero station={stationName} shift={shiftName} />
          ) : (
            <View style={[styles.hero, styles.heroLoading]}>
              <Text style={styles.loadingText}>Loading your status…</Text>
            </View>
          )}

          {/* Status tiles */}
          <View style={styles.statusRow}>
            <StatusTile icon="navigate" label="Tracking" value={tracking.value} tone={tracking.tone} />
            <StatusTile icon="people" label="Duty Status" value={duty.label} tone={duty.tone} />
          </View>

          {/* Team */}
          <Text style={styles.sectionHeader}>My Team</Text>
          <View style={styles.card}>
            {team ? (
              <>
                <View style={styles.teamTop}>
                  <View style={styles.teamIcon}>
                    <Ionicons name="flag" size={17} color={Colors.textPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamName} numberOfLines={1}>{team.team_name}</Text>
                    <Text style={styles.teamCode}>{team.team_code ?? "—"}</Text>
                  </View>
                  <Pill
                    label={team.member_role ?? "Member"}
                    tone={team.member_role === "Team Leader" ? "fire" : "green"}
                  />
                </View>
                <View style={styles.cardDivider} />
                <InfoRow label="Station" value={stationName ?? "—"} />
                <InfoRow label="Shift" value={shiftName ?? "—"} last />
              </>
            ) : (
              <Text style={styles.emptyText}>
                {loading ? "Loading…" : "You aren't assigned to a team yet."}
              </Text>
            )}
          </View>

          {/* Quick access */}
          <Text style={styles.sectionHeader}>Quick Access</Text>
          <View style={styles.quickGrid}>
            <QuickTile
              icon="map"
              label="My Route"
              sub={dispatch ? "Navigate to scene" : "No active route"}
              onPress={() => navigation.navigate("Route")}
            />
            <QuickTile
              icon="notifications"
              label="Alerts"
              sub={unreadAlerts > 0 ? `${unreadAlerts} unread` : "All caught up"}
              badge={unreadAlerts > 0 ? String(unreadAlerts) : null}
              onPress={() => navigation.navigate("Alerts")}
            />
            <QuickTile
              icon="fire-truck"
              iconSet="mci"
              label="Station Trucks"
              sub={stationName ?? "Fleet status"}
              onPress={() => navigation.navigate("Trucks")}
            />
            <QuickTile
              icon="settings"
              label="Settings"
              sub="Alerts & account"
              onPress={() => navigation.navigate("Settings")}
            />
          </View>
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

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 13,
    backgroundColor: Colors.bgPanel,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: Colors.bgHover,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Colors.accentFire,
    borderWidth: 2,
    borderColor: Colors.bgPanel,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: {
    fontFamily: "AxiformaMedium",
    fontSize: 8.5,
    color: "#fff",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: Colors.accentFire,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "AxiformaMedium",
    fontSize: 14,
    color: "#fff",
    letterSpacing: 0.3,
  },

  // Sheet
  scrollWrap: {
    flex: 1,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    marginHorizontal: 3,
    backgroundColor: Colors.pageDefaultBase,
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  sectionHeader: {
    fontFamily: "AxiformaMedium",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },

  // Hero
  hero: {
    marginHorizontal: 12,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 14,
    padding: 16,
  },
  heroActive: {
    borderColor: Colors.badgeFire.border,
  },
  heroContained: {
    borderColor: Colors.badgeGreen.border,
  },
  heroLoading: {
    alignItems: "center",
    paddingVertical: 28,
  },
  loadingText: {
    fontFamily: "AxiformaRegular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroTagText: {
    fontFamily: "AxiformaMedium",
    fontSize: 10.5,
    letterSpacing: -0.2,
    textTransform: "uppercase",
  },
  heroSince: {
    marginLeft: "auto",
    fontFamily: "AxiformaRegular",
    fontSize: 10.5,
    color: Colors.textSecondary,
  },
  heroId: {
    fontFamily: "AxiformaMedium",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  heroPlace: {
    fontFamily: "AxiformaMedium",
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 27,
  },
  heroAddr: {
    fontFamily: "AxiformaRegular",
    fontSize: 11.5,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderDim,
  },
  heroMetaItem: {
    flex: 1,
    paddingHorizontal: 2,
  },
  heroMetaDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: Colors.borderDim,
    marginHorizontal: 10,
  },
  heroMetaLabel: {
    fontFamily: "AxiformaRegular",
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  heroMetaValue: {
    fontFamily: "AxiformaMedium",
    fontSize: 12,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  heroActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: Colors.accentFire,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    shadowColor: Colors.accentFire,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: {
    fontFamily: "AxiformaMedium",
    fontSize: 12.8,
    color: "#fff",
    letterSpacing: -0.2,
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.bgHover,
  },
  btnSecondaryText: {
    fontFamily: "AxiformaMedium",
    fontSize: 12.8,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  standbyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  standbyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  standbyTitle: {
    fontFamily: "AxiformaMedium",
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 2,
  },
  standbySub: {
    fontFamily: "AxiformaRegular",
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
  },

  // Pills
  pill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: "AxiformaMedium",
    fontSize: 8.8,
    letterSpacing: -0.5,
    textTransform: "uppercase",
  },

  // Status tiles
  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
  },
  statusCard: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: Colors.borderDim,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 13,
    gap: 10,
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  statusLabel: {
    fontFamily: "AxiformaMedium",
    fontSize: 10.8,
    letterSpacing: -0.2,
    color: Colors.textSecondary,
  },
  statusIconWrap: {
    padding: 6,
    backgroundColor: Colors.bgHover,
    borderRadius: 8,
  },
  statusValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusValue: {
    fontFamily: "AxiformaMedium",
    fontSize: 14,
    letterSpacing: -0.5,
  },

  // Team card
  card: {
    marginHorizontal: 12,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  teamTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  teamIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bgHover,
    alignItems: "center",
    justifyContent: "center",
  },
  teamName: {
    fontFamily: "AxiformaMedium",
    fontSize: 14,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  teamCode: {
    fontFamily: "AxiformaRegular",
    fontSize: 10.5,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.borderDim,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 7,
  },
  infoLabel: {
    fontFamily: "AxiformaRegular",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    width: 60,
  },
  infoValue: {
    flex: 1,
    fontFamily: "AxiformaMedium",
    fontSize: 11,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  emptyText: {
    fontFamily: "AxiformaRegular",
    fontSize: 11.5,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: 6,
  },

  // Quick access
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 12,
  },
  quickCard: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 10,
    padding: 13,
  },
  quickTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: Colors.bgHover,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Colors.accentFireDim,
    alignItems: "center",
  },
  quickBadgeText: {
    fontFamily: "AxiformaMedium",
    fontSize: 9.5,
    color: Colors.accentFire,
  },
  quickLabel: {
    fontFamily: "AxiformaMedium",
    fontSize: 13,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  quickSub: {
    fontFamily: "AxiformaRegular",
    fontSize: 10.5,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginTop: 2,
  },
});
