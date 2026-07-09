import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../constants/colors";

/**
 * Reusable confirmation bottom-sheet. Matches the dark theme of
 * IncidentDetailsModal. Drive it with `visible` + `onCancel`/`onConfirm`.
 *
 * `tone` picks the confirm button colour:
 *   "danger"  → fire red  (default; destructive/irreversible)
 *   "warning" → amber
 *   "primary" → green
 *
 * Pass `busy` to show a spinner and lock the buttons while the action runs.
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  icon = "alert-circle",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const pal = TONES[tone] ?? TONES.danger;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={busy ? undefined : onCancel}
        />
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: pal.dim, borderColor: pal.border }]}>
            <Ionicons name={icon} size={22} color={pal.color} />
          </View>

          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onCancel}
              activeOpacity={0.85}
              disabled={busy}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: pal.color }]}
              onPress={onConfirm}
              activeOpacity={0.85}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const TONES = {
  danger:  { color: Colors.accentFire,  dim: Colors.accentFireDim,  border: Colors.badgeFire.border },
  warning: { color: Colors.accentAmber, dim: Colors.accentAmberDim, border: Colors.badgeAmber.border },
  primary: { color: Colors.accentGreen, dim: Colors.accentGreenDim, border: Colors.badgeGreen.border },
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.bgPanel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: "center",
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: "AxiformaBold",
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    textAlign: "center",
    marginBottom: 6,
  },
  message: {
    fontFamily: "AxiformaRegular",
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    textAlign: "center",
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 26,
  },
  cancelBtn: {
    backgroundColor: Colors.bgHover,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    fontFamily: "AxiformaBold",
    fontSize: 11,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    textTransform: "uppercase",
  },
  confirmText: {
    fontFamily: "AxiformaBold",
    fontSize: 11,
    color: "#fff",
    letterSpacing: -0.3,
    textTransform: "uppercase",
  },
});
