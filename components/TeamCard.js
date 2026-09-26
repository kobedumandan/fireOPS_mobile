import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "../constants/colors";
import { useAuth } from "../context/AuthContext";

function Badge({ label, color }) {
  return (
    <View
      style={[
        styles.badge,
        { borderColor: color + "55", backgroundColor: color + "22" },
      ]}
    >
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, value, valueColor }) {
  return (
    <View style={styles.row}>
      {/* <Ionicons name={icon} size={13} color={Colors.textMuted} style={styles.rowIcon} /> */}
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, valueColor ? { color: valueColor } : null]}
      >
        {value}
      </Text>
    </View>
  );
}

export default function TeamCard() {
  const { status } = useAuth();
  const loading = status === null;
  const error = null;

  return (
    <View style={styles.card}>
      {/* <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>My Team</Text>
      </View> */}

      {loading && (
        <ActivityIndicator
          size="small"
          color={Colors.accentBlue}
          style={{ marginVertical: 12 }}
        />
      )}

      {error && !loading && (
        <Text style={styles.errorText}>Failed to load team data</Text>
      )}

      {status?.team && !loading && (
        <>
          <View style={styles.teamNameRow}>
            <View style={styles.trk_icon_wrap}>
              <MaterialCommunityIcons
                name="fire-truck"
                size={26}
                color={Colors.accentFire}
              />
            </View>
            <View style={styles.teamNameCol}>
              <Badge
                style={styles.teamCode}
                label={status.team.team_code}
                color={Colors.textSecondary}
              />
              <Text style={styles.teamName}>{status.team.team_name}</Text>
            </View>
          </View>
          {/* <View style={styles.teamNameRow}> */}
            {/* <Badge
              label={status.team.member_role}
              color={
                status.team.member_role === "Team Leader"
                  ? Colors.accentFire
                  : Colors.accentGreen
              }
            /> */}
          {/* </View> */}

          <View style={styles.divider} />

          <Row label="Station" value={status.station?.station_name ?? "—"} />
          <Row label="Shift" value={status.shift?.shift_name ?? "—"} />
          <Row
            label="Team Role"
            value={status.team.member_role}
            valueColor={
              status.team.member_role === "Team Leader"
                ? Colors.accentFire
                : Colors.accentGreen
            }
          />
        </>
      )}

      {!status?.team && !loading && !error && (
        <Text style={styles.errorText}>No team assigned</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 14,
    backgroundColor: Colors.bgPanel,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 15,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: "AxiformaMedium",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
  },
  teamNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  teamNameCol: {
    flexDirection: "column",
    alignItems: "flex-start",
    flexShrink: 1,
  },
  trk_icon_wrap: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  teamName: {
    fontFamily: "AxiformaMedium",
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: -1,
    marginRight: 2,
    marginBottom: 1,
  },
  teamCode: {
  },
  badge: {
    borderWidth: 0,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: "AxiformaMedium",
    fontSize: 8.8,
    letterSpacing: -0.5,
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderDim,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  rowIcon: {
    width: 16,
  },
  rowLabel: {
    fontFamily: "AxiformaRegular",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    width: 60,
  },
  rowValue: {
    fontFamily: "AxiformaMedium",
    fontSize: 11,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    flex: 1,
  },
  errorText: {
    fontFamily: "AxiformaRegular",
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: 8,
  },
});
