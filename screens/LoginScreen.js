import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { BASE_URL, API_HEADERS, authHeaders } from '../constants/api';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/login_user`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ email: email.trim(), password }),
      });

      let data = {};
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      }

      if (!res.ok) {
        setError(data.message ?? data.detail ?? `Error ${res.status}: Login failed.`);
        return;
      }

      const userData  = data.user ?? data;
      const authToken = data.token ?? data.access_token ?? null;

      // Fetch user status after successful login
      let statusData = null;
      if (authToken) {
        try {
          const statusRes = await fetch(`${BASE_URL}/api/mobile/me/status`, {
            headers: authHeaders(authToken),
          });
          if (statusRes.ok) {
            const ct = statusRes.headers.get('content-type') ?? '';
            if (ct.includes('application/json')) {
              statusData = await statusRes.json();
            }
          }
        } catch {
          // Status fetch is non-critical; proceed without it
        }
      }

      login(userData, authToken, statusData, data.station ?? null);
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo block */}
        <View style={styles.logoWrap}>
          <Text style={styles.org}>BFP  |  Panabo City</Text>
          <View style={styles.fireIcon} />
          <Text style={styles.appTitle}>
            FIRE<Text style={styles.appTitleAccent}>OPS</Text>
          </Text>
          <Text style={styles.appSub}>Personnel Mobile</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="bfp@gmail.com"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={16}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={Colors.accentFire} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.secureRow}>
            {/* <Ionicons name="lock-closed" size={9} color={Colors.textMuted} /> */}
            <Text style={styles.secureText}>FireOPS 2026  |  All Rights Reserved.</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.pageDefaultBase,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 46,
    paddingVertical: 50,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 36,
  },
  fireIcon: {
    width: 48,
    height: 48,
    backgroundColor: Colors.accentFire,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
    marginBottom: 12,
    shadowColor: Colors.accentFire,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  org: {
    fontFamily: 'AxiformaMedium',
    fontSize: 7.8,
    color: Colors.accentFire,
    letterSpacing: -0.1,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  appTitle: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 41,
    letterSpacing: 2.6,
    color: Colors.textPrimary,
  },
  appTitleAccent: {
    color: Colors.accentFire,
  },
  appSub: {
    fontFamily: 'Axiforma',
    fontSize: 8,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  form: {
    width: '100%',
  },
  fieldLabel: {
    fontFamily: 'AxiformaMedium',
    fontSize: 10.8,
    letterSpacing: -0.2,
    // textTransform: 'uppercase',
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  input: {
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontFamily: 'AxiformaRegular',
    fontSize: 10.8,
    marginBottom: 18,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 6,
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontFamily: 'AxiformaRegular',
    fontSize: 10.8,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,77,26,0.1)',
    borderWidth: 0.2,
    borderColor: Colors.accentFire,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 4,
  },
  errorText: {
    fontFamily: 'AxiformaRegular',
    fontSize: 9.8,
    color: Colors.accentFire,
    flex: 1,
  },
  btn: {
    backgroundColor: Colors.accentFire,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: Colors.accentFire,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontFamily: 'AxiformaMedium',
    fontSize: 10.8,
    color: '#fff',
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 54,
  },
  secureText: {
    fontFamily: 'AxiformaRegular',
    fontSize: 9.8,
    color: Colors.textTertiary,
  },
});
