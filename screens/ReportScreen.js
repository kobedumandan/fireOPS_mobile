import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { submitIncidentReport } from '../constants/api';
import ConfirmModal from '../components/ConfirmModal';

function Field({ label, hint, value, onChangeText, placeholder, multiline, required }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required ? <Text style={styles.required}>required</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

export default function ReportScreen({ navigation, route }) {
  const { incident, dispatchId } = route.params ?? {};
  const { token, refreshStatus } = useAuth();

  const [narrative, setNarrative]             = useState('');
  const [cause, setCause]                     = useState('');
  const [casualties, setCasualties]           = useState('');
  const [damageEstimate, setDamageEstimate]   = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [photos, setPhotos]                   = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm]       = useState(false);

  const fireIdLabel = incident?.fire_id != null ? `#${incident.fire_id}` : '—';
  const MAX_PHOTOS  = 8;

  const addAssets = (assets) => {
    setPhotos((prev) => {
      const merged = [...prev];
      for (const a of assets) {
        if (merged.length >= MAX_PHOTOS) break;
        // Skip duplicates that share the same uri.
        if (!merged.some((p) => p.uri === a.uri)) merged.push(a);
      }
      return merged;
    });
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Photos', `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera Access', 'Camera permission is needed to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled) addAssets(result.assets);
  };

  const pickFromLibrary = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Photos', `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo Library', 'Photo library permission is needed to choose photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.6,
    });
    if (!result.canceled) addAssets(result.assets);
  };

  const removePhoto = (uri) => {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  const handleSubmit = () => {
    if (!narrative.trim()) {
      Alert.alert('Incident Report', 'Please write the report narrative before submitting.');
      return;
    }
    if (!token || !dispatchId) {
      Alert.alert('Incident Report', 'Missing dispatch information. Please reopen the incident.');
      return;
    }
    setConfirm(true);
  };

  const confirmSubmit = async () => {
    if (!token || !dispatchId) return;
    setSubmitting(true);
    try {
      await submitIncidentReport(token, dispatchId, {
        narrative,
        cause,
        casualties,
        damage_estimate: damageEstimate,
        recommendations,
      }, photos);
      setConfirm(false);
      await refreshStatus?.();
      Alert.alert('Incident Report', 'Report submitted. The incident has been closed.');
      navigation.goBack();
    } catch (err) {
      setConfirm(false);
      Alert.alert('Incident Report', err.message ?? 'Could not submit the report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incident Report</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.scrollWrap}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Incident summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.summaryLabel}>Fire ID</Text>
                  <Text style={styles.summaryValue}>{fireIdLabel}</Text>
                </View>
                <View style={styles.containedBadge}>
                  {/* <Ionicons name="checkmark-circle" size={13} color={Colors.accentGreen} /> */}
                  <Text style={styles.containedText}>Contained</Text>
                </View>
              </View>
              {incident?.fire_address ? (
                <Text style={styles.summaryAddr} numberOfLines={2}>
                  {incident.fire_address}
                </Text>
              ) : null}
            </View>

            <Text style={styles.sectionNote}>
              Filing this report closes the incident. This cannot be undone.
            </Text>

            <Field
              label="Narrative"
              // hint="Account of the response — what happened, actions taken, outcome."
              value={narrative}
              onChangeText={setNarrative}
              placeholder="Describe the incident and response…"
              multiline
              required
            />
            <Field
              label="Probable Cause"
              value={cause}
              onChangeText={setCause}
              placeholder="e.g. Electrical / faulty wiring"
            />
            <Field
              label="Casualties / Injuries"
              value={casualties}
              onChangeText={setCasualties}
              placeholder="e.g. None / 1 injured"
            />
            <Field
              label="Estimated Damage"
              value={damageEstimate}
              onChangeText={setDamageEstimate}
              placeholder="e.g. ₱250,000"
            />
            <Field
              label="Recommendations"
              hint="Optional follow-up actions or remarks."
              value={recommendations}
              onChangeText={setRecommendations}
              placeholder="Optional…"
              multiline
            />

            {/* Scene photos */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Photos</Text>
                <Text style={styles.photoCount}>{photos.length}/{MAX_PHOTOS}</Text>
              </View>
              <Text style={styles.hint}>
                Attach photographs of the scene. Optional, up to {MAX_PHOTOS}.
              </Text>

              <View style={styles.photoBtnRow}>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={takePhoto}
                  activeOpacity={0.85}
                  disabled={submitting}
                >
                  <Ionicons name="camera-outline" size={17} color={Colors.textPrimary} />
                  <Text style={styles.photoBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={pickFromLibrary}
                  activeOpacity={0.85}
                  disabled={submitting}
                >
                  <Ionicons name="images-outline" size={17} color={Colors.textPrimary} />
                  <Text style={styles.photoBtnText}>Library</Text>
                </TouchableOpacity>
              </View>

              {photos.length > 0 ? (
                <View style={styles.thumbGrid}>
                  {photos.map((p) => (
                    <View key={p.uri} style={styles.thumbWrap}>
                      <Image source={{ uri: p.uri }} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => removePhoto(p.uri)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        disabled={submitting}
                      >
                        <Ionicons name="close" size={13} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting}
            >
              {/* <Ionicons name="send" size={16} color="#fff" /> */}
              <Text style={styles.submitText}>
                {submitting ? 'Submitting…' : 'Submit & Close Incident'}
              </Text>
            </TouchableOpacity>

            <View style={styles.bottomPad} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <ConfirmModal
        visible={confirm}
        icon="document-text-outline"
        title="Submit Report?"
        message="This files the incident report and closes the incident. You won't be able to edit it afterward."
        confirmLabel="Submit & Close"
        tone="primary"
        busy={submitting}
        onConfirm={confirmSubmit}
        onCancel={() => setConfirm(false)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 13,
    backgroundColor: Colors.bgPanel,
  },
  headerTitle: {
    fontFamily: 'AxiformaMedium',
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  scrollWrap: {
    flex: 1,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    marginHorizontal: 3,
    backgroundColor: Colors.pageDefaultBase,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: 'AxiformaMedium',
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  summaryValue: {
    fontFamily: 'AxiformaMedium',
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  containedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    // borderWidth: 1,
    borderColor: Colors.accentGreen,
    backgroundColor: Colors.accentGreenDim,
  },
  containedText: {
    fontFamily: 'AxiformaMedium',
    fontSize: 9.5,
    color: Colors.accentGreen,
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  summaryAddr: {
    fontFamily: 'AxiformaRegular',
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginTop: 8,
  },
  sectionNote: {
    fontFamily: 'AxiformaRegular',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontFamily: 'AxiformaMedium',
    fontSize: 12,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  required: {
    fontFamily: 'AxiformaMedium',
    fontSize: 9,
    color: Colors.accentFire,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  hint: {
    fontFamily: 'AxiformaRegular',
    fontSize: 10.5,
    color: Colors.textMuted,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: 'AxiformaRegular',
    fontSize: 13,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: 11,
  },
  photoCount: {
    fontFamily: 'AxiformaMedium',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: -0.2,
  },
  photoBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 10,
    paddingVertical: 12,
  },
  photoBtnText: {
    fontFamily: 'AxiformaMedium',
    fontSize: 12.5,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  thumbWrap: {
    width: 76,
    height: 76,
    borderRadius: 10,
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    backgroundColor: Colors.bgPanel,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentFire,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.pageDefaultBase,
  },
  submitBtn: {
    marginTop: 6,
    backgroundColor: Colors.accentFire,
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.accentFire,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitText: {
    fontFamily: 'AxiformaMedium',
    fontSize: 12.8,
    color: '#fff',
    letterSpacing: -0.3,
  },
  bottomPad: {
    height: 20,
  },
});
