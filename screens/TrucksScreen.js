import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { fetchTrucks } from '../constants/api';
import { useAuth } from '../context/AuthContext';

// Same status → colour mapping as the web dashboard's Trucks page, so a truck
// reads the same on the console and on the phone.
const TONE = {
  available:   { fg: Colors.accentGreen,   bg: Colors.accentGreenDim, label: 'Available' },
  dispatched:  { fg: Colors.accentAmber,   bg: Colors.accentAmberDim, label: 'Dispatched' },
  on_scene:    { fg: Colors.accentBlue,    bg: Colors.accentBlueDim,  label: 'On Scene' },
  maintenance: { fg: Colors.accentFire,    bg: Colors.accentFireDim,  label: 'Maintenance' },
  unavailable: { fg: Colors.textSecondary, bg: Colors.bgHover,        label: 'Unavailable' },
};
const toneOf = (s) => TONE[s] ?? TONE.unavailable;

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'available',   label: 'Available' },
  { key: 'dispatched',  label: 'Dispatched' },
  { key: 'maintenance', label: 'Maintenance' },
];

const truckCode = (id) => `TRK-${String(id).padStart(3, '0')}`;

function lastSeen(iso) {
  if (!iso) return 'No position yet';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return 'No position yet';
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `Updated ${hrs}h ago` : `Updated ${Math.round(hrs / 24)}d ago`;
}

function StatusBadge({ status }) {
  const tone = toneOf(status);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>
        {tone.label ?? String(status).replace('_', ' ')}
      </Text>
    </View>
  );
}

function StatTile({ label, value, icon, color }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statIconWrap}>
          <Ionicons name={icon} size={13} color={Colors.textPrimary} />
        </View>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function TruckRow({ t, last }) {
  const tone = toneOf(t.truck_status);
  return (
    <>
      <View style={styles.row}>
        <View style={[styles.tile, { backgroundColor: tone.bg }]}>
          <MaterialCommunityIcons name="fire-truck" size={19} color={tone.fg} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.plate} numberOfLines={1}>{t.truck_platenum}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {truckCode(t.truck_id)} · {lastSeen(t.truck_last_updated)}
          </Text>
        </View>
        <StatusBadge status={t.truck_status} />
      </View>
      {!last && <View style={styles.divider} />}
    </>
  );
}

export default function TrucksScreen({ navigation }) {
  const { token, status, station } = useAuth();
  const stationId = station?.station_id ?? status?.station?.station_id ?? null;
  const stationName = station?.station_name ?? status?.station?.station_name ?? null;
  const myTruckId = status?.dispatch?.truck?.truck_id ?? null;

  const [trucks, setTrucks] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const all = await fetchTrucks(token);
      // Station trucks only; a responder with no station sees the whole fleet.
      setTrucks(stationId ? all.filter((t) => t.station_id === stationId) : all);
      setError(null);
    } catch (err) {
      setError(err.message ?? 'Could not load trucks.');
    }
  }, [token, stationId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const counts = useMemo(() => {
    const c = { all: 0, available: 0, dispatched: 0, maintenance: 0 };
    (trucks ?? []).forEach((t) => {
      c.all += 1;
      // on_scene is still out on a call — it counts toward dispatched.
      const k = t.truck_status === 'on_scene' ? 'dispatched' : t.truck_status;
      if (k in c) c[k] += 1;
    });
    return c;
  }, [trucks]);

  const myTruck = trucks?.find((t) => t.truck_id === myTruckId) ?? null;
  const visible = (trucks ?? []).filter((t) => {
    if (t.truck_id === myTruckId) return false; // shown in its own card above
    if (filter === 'all') return true;
    if (filter === 'dispatched') return t.truck_status === 'dispatched' || t.truck_status === 'on_scene';
    return t.truck_status === filter;
  });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Trucks</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {stationName ?? 'Whole fleet'}
          </Text>
        </View>
      </View>

      <View style={styles.scrollWrap}>
        {trucks === null && !error ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.accentFire} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.accentFire}
                colors={[Colors.accentFire]}
                progressBackgroundColor={Colors.bgPanel}
              />
            }
          >
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.accentFire} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {trucks && (
              <View style={styles.statRow}>
                <StatTile label="Available" value={counts.available} icon="checkmark-circle" color={Colors.accentGreen} />
                <StatTile label="Dispatched" value={counts.dispatched} icon="navigate" color={Colors.accentAmber} />
                <StatTile label="Repair" value={counts.maintenance} icon="construct" color={Colors.accentFire} />
              </View>
            )}

            {myTruck && (
              <>
                <Text style={styles.sectionHeader}>Your Dispatch Truck</Text>
                <View style={[styles.card, styles.cardMine]}>
                  <View style={styles.mineTop}>
                    <View style={[styles.tileLg, { backgroundColor: Colors.accentFireDim }]}>
                      <MaterialCommunityIcons name="fire-truck" size={26} color={Colors.accentFire} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.mineLabel}>{truckCode(myTruck.truck_id)}</Text>
                      <Text style={styles.minePlate} numberOfLines={1}>{myTruck.truck_platenum}</Text>
                    </View>
                    <StatusBadge status={myTruck.truck_status} />
                  </View>
                  <View style={styles.mineDivider} />
                  <View style={styles.mineRow}>
                    <Text style={styles.mineRowLabel}>Station</Text>
                    <Text style={styles.mineRowValue}>{myTruck.station_name ?? stationName ?? '—'}</Text>
                  </View>
                  <View style={styles.mineRow}>
                    <Text style={styles.mineRowLabel}>Position</Text>
                    <Text style={styles.mineRowValue}>{lastSeen(myTruck.truck_last_updated)}</Text>
                  </View>
                </View>
              </>
            )}

            {trucks && trucks.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>
                  {myTruck ? 'Other Station Trucks' : 'Station Trucks'}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                >
                  {FILTERS.map((f) => {
                    const active = filter === f.key;
                    return (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setFilter(f.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {f.label}
                        </Text>
                        <Text style={[styles.chipCount, active && styles.chipCountActive]}>
                          {counts[f.key]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {visible.length > 0 ? (
                  <View style={styles.card}>
                    {visible.map((t, i) => (
                      <TruckRow key={t.truck_id} t={t} last={i === visible.length - 1} />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.filterEmpty}>No trucks in this category.</Text>
                )}
              </>
            )}

            {trucks?.length === 0 && (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <MaterialCommunityIcons name="fire-truck" size={24} color={Colors.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>No trucks yet</Text>
                <Text style={styles.emptySub}>No trucks are assigned to your station.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 13,
    backgroundColor: Colors.bgPanel,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: Colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontFamily: 'AxiformaMedium',
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  headerSub: {
    fontFamily: 'AxiformaRegular',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginTop: 1,
  },
  scrollWrap: {
    flex: 1,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    marginHorizontal: 3,
    backgroundColor: Colors.pageDefaultBase,
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 13, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: Colors.borderDim,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 12,
    gap: 8,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontFamily: 'AxiformaMedium',
    fontSize: 10.8,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
  },
  statIconWrap: {
    padding: 5,
    backgroundColor: Colors.bgHover,
    borderRadius: 8,
  },
  statValue: {
    fontFamily: 'AxiformaMedium',
    fontSize: 22,
    letterSpacing: -1,
  },

  sectionHeader: {
    fontFamily: 'AxiformaMedium',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: 12,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderDim,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardMine: {
    borderColor: Colors.badgeFire.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  mineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tileLg: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mineLabel: {
    fontFamily: 'AxiformaRegular',
    fontSize: 10.5,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  minePlate: {
    fontFamily: 'AxiformaMedium',
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  mineDivider: {
    height: 1,
    backgroundColor: Colors.borderDim,
    marginVertical: 12,
  },
  mineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  mineRowLabel: {
    fontFamily: 'AxiformaRegular',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    width: 64,
  },
  mineRowValue: {
    flex: 1,
    fontFamily: 'AxiformaMedium',
    fontSize: 11,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },

  chips: {
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderDim,
  },
  chipActive: {
    backgroundColor: Colors.bgHover,
    borderColor: Colors.border,
  },
  chipText: {
    fontFamily: 'AxiformaMedium',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
  },
  chipTextActive: { color: Colors.textPrimary },
  chipCount: {
    fontFamily: 'AxiformaRegular',
    fontSize: 10,
    color: Colors.textMuted,
  },
  chipCountActive: { color: Colors.textSecondary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  plate: {
    fontFamily: 'AxiformaMedium',
    fontSize: 13,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  meta: {
    fontFamily: 'AxiformaRegular',
    fontSize: 10.8,
    color: Colors.textSecondary,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderDim,
    marginLeft: 62,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'AxiformaMedium',
    fontSize: 8.8,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.accentFireDim,
  },
  errorText: {
    flex: 1,
    fontFamily: 'AxiformaRegular',
    fontSize: 11.5,
    color: Colors.accentFire,
    letterSpacing: -0.2,
  },
  filterEmpty: {
    fontFamily: 'AxiformaRegular',
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 18,
    letterSpacing: -0.2,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 70,
    gap: 8,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: 'AxiformaMedium',
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  emptySub: {
    fontFamily: 'AxiformaRegular',
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
