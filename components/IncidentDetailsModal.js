import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../constants/colors";
import { markArrived, markContained } from "../constants/api";
import ConfirmModal from "./ConfirmModal";

function statusPalette(status) {
  switch ((status || "").toLowerCase()) {
    case "contained":
      return Colors.badgeGreen;
    case "closed":
      return Colors.badgeMuted;
    case "dispatched":
      return Colors.badgeAmber;
    default:
      return Colors.badgeFire; // pending / active
  }
}

function Row({ label, value, valueColor }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, valueColor ? { color: valueColor } : null]}
        numberOfLines={2}
      >
        {value ?? "—"}
      </Text>
    </View>
  );
}

export default function IncidentDetailsModal({
  visible,
  onClose,
  incident,
  dispatch,
  isTeamLeader,
  token,
  onContained,
  onArrived,
  onCreateReport,
}) {
  const [containing, setContaining] = useState(false);
  const [containConfirm, setContainConfirm] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [arriveConfirm, setArriveConfirm] = useState(false);

  // The crew must be on scene before the fire can be marked contained, so the
  // arrival action takes the footer while the dispatch is still en route.
  const dispatchStatus = dispatch?.dispatch_status ?? null;
  const enRoute = dispatchStatus === "dispatched" || dispatchStatus === "en_route";

  const fireStatus = incident?.fire_status ?? null;
  const isContained = fireStatus === "contained" || fireStatus === "closed";
  // The report can only be filed while the fire is contained (not yet closed).
  const canReport = fireStatus === "contained";
  const pal = statusPalette(fireStatus);

  const dispatchId = dispatch?.dispatch_id ? `DISP-${dispatch.dispatch_id}` : "—";
  const coords =
    incident?.fire_latitude != null && incident?.fire_longitude != null
      ? `${Number(incident.fire_latitude).toFixed(5)}, ${Number(
          incident.fire_longitude
        ).toFixed(5)}`
      : "—";
  const reportedAt = (() => {
    const raw = incident?.fire_incident_datetime;
    if (!raw) return "—";
    try {
      return new Date(raw).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return raw;
    }
  })();

  const handleContain = () => {
    if (!token || !dispatch?.dispatch_id || containing) return;
    setContainConfirm(true);
  };

  const confirmArrive = async () => {
    if (!token || !dispatch?.dispatch_id) return;
    setArriving(true);
    try {
      await markArrived(token, dispatch.dispatch_id);
      setArriveConfirm(false);
      await onArrived?.();
    } catch (err) {
      setArriveConfirm(false);
      Alert.alert("Incident", err.message ?? "Could not mark arrival.");
      // A 409 means a teammate already marked arrival; pull the fresh status.
      await onArrived?.();
    } finally {
      setArriving(false);
    }
  };

  const confirmContain = async () => {
    if (!token || !dispatch?.dispatch_id) return;
    setContaining(true);
    try {
      await markContained(token, dispatch.dispatch_id);
      setContainConfirm(false);
      await onContained?.();
    } catch (err) {
      setContainConfirm(false);
      Alert.alert("Incident", err.message ?? "Could not mark incident contained.");
    } finally {
      setContaining(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Incident Details</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topRow}>
              <View>
                <Text style={styles.idLabel}>Dispatch</Text>
                <Text style={styles.idValue}>{dispatchId}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: pal.bg, borderColor: pal.border },
                ]}
              >
                <Text style={[styles.statusBadgeText, { color: pal.text }]}>
                  {fireStatus ?? "—"}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Row
              label="Dispatch"
              value={
                enRoute
                  ? "En route"
                  : dispatchStatus === "on_scene"
                  ? "On scene"
                  : dispatchStatus
              }
            />
            <Row label="Fire ID" value={incident?.fire_id != null ? `#${incident.fire_id}` : "—"} />
            <Row label="Address" value={incident?.fire_address} />
            <Row label="Area" value={incident?.fire_location_name} />
            <Row
              label="Alarm"
              value={incident?.fire_level}
              valueColor={Colors.accentFire}
            />
            <Row label="Severity" value={incident?.fire_severity} />
            <Row label="Structure" value={incident?.fire_structure_type} />
            <Row label="Coordinates" value={coords} />
            <Row label="Reported" value={reportedAt} />
          </ScrollView>

          {/* Bottom action */}
          <View style={styles.footer}>
            {enRoute && !isContained ? (
              <TouchableOpacity
                style={styles.containBtn}
                onPress={() => !arriving && setArriveConfirm(true)}
                activeOpacity={0.85}
                disabled={arriving}
              >
                <Text style={styles.containBtnText}>
                  {arriving ? "Marking..." : "Arrived on Scene"}
                </Text>
              </TouchableOpacity>
            ) : isContained ? (
              <>
                <View style={[styles.containBtn, styles.containedDone]}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={Colors.accentGreen}
                  />
                  <Text
                    style={[styles.containBtnText, { color: Colors.accentGreen }]}
                  >
                    {fireStatus === "closed" ? "Incident Closed" : "Incident Contained"}
                  </Text>
                </View>
                {canReport ? (
                  <TouchableOpacity
                    style={styles.reportBtn}
                    onPress={() => {
                      onClose?.();
                      onCreateReport?.();
                    }}
                    activeOpacity={0.85}
                  >
                    {/* <Ionicons name="document-text" size={16} color="#fff" /> */}
                    <Text style={styles.containBtnText}>Create Report</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : isTeamLeader ? (
              <TouchableOpacity
                style={styles.containBtn}
                onPress={handleContain}
                activeOpacity={0.85}
                disabled={containing}
              >
                {/* <Ionicons name="water" size={16} color="#fff" /> */}
                <Text style={styles.containBtnText}>
                  {containing ? "Marking..." : "Mark as Contained"}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.leaderHint}>
                Only the team leader can mark this incident as contained.
              </Text>
            )}
          </View>
        </View>
      </View>

      <ConfirmModal
        visible={arriveConfirm}
        title="Arrived on Scene?"
        message="Confirm your team has reached the incident. Dispatchers will be notified and the arrival time is recorded."
        confirmLabel="Confirm Arrival"
        tone="primary"
        busy={arriving}
        onConfirm={confirmArrive}
        onCancel={() => setArriveConfirm(false)}
      />

      <ConfirmModal
        visible={containConfirm}
        title="Mark as Contained?"
        message="Confirm the fire is contained at this incident. Dispatchers will be notified."
        confirmLabel="Mark Contained"
        tone="primary"
        busy={containing}
        onConfirm={confirmContain}
        onCancel={() => setContainConfirm(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.bgBase,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: "82%",
    paddingBottom: 28,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  title: {
    fontFamily: "AxiformaBold",
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: -0.6,
  },
  body: {
    paddingHorizontal: 18,
  },
  bodyContent: {
    paddingTop: 6,
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  idLabel: {
    fontFamily: "AxiformaBold",
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  idValue: {
    fontFamily: "AxiformaBold",
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: "AxiformaBold",
    fontSize: 9.5,
    letterSpacing: -0.3,
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderDim,
    marginVertical: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 11,
  },
  rowLabel: {
    fontFamily: "AxiformaRegular",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    width: 92,
  },
  rowValue: {
    fontFamily: "AxiformaBold",
    fontSize: 12,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDim,
  },
  containBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: Colors.accentFire,
  },
  containedDone: {
    backgroundColor: Colors.accentGreenDim,
    // borderWidth: 1,
    borderColor: Colors.accentGreen,
  },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: Colors.accentFire,
    marginTop: 10,
  },
  containBtnText: {
    fontFamily: "AxiformaBold",
    fontSize: 12.8,
    color: "#fff",
    letterSpacing: -0.4,
    // textTransform: "uppercase",
  },
  leaderHint: {
    fontFamily: "AxiformaRegular",
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: 6,
    letterSpacing: -0.2,
  },
});
