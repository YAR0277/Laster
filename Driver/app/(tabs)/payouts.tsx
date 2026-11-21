import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { styles as accountStylesCommon } from '../../../Common/src/components/account';
import { styles as commonStyles } from '../../../Common/src/components/common';
import { styles as payoutStyles } from '../../components/driver_payouts';
import { useAuth } from '../../data/auth';
import { useDriver } from '../../data/driver';
import { supabase } from '../../lib/supabase';

type Transfer = {
  transfer_id: string;
  trip_id: string;
  display_trip_id: string | null;
  transfer_amount: number;
  transferred_at: string | null;
};

type PayoutPeriod = {
  payout_period_id: string;
  period_start: string;
  period_end: string;
  scheduled_payout_date: string;
};

type Payout = {
  payout_id: string;
  payout_amount: number;
  fees: number;
  net_payout: number;
  payout_type: 'standard' | 'instant';
  payout_status: string;
  created_at: string;
  paid_at: string | null;
  payout_period_id: string | null;
};

export default function PayoutsScreen() {
  const { driver } = useDriver();
  const router = useRouter();
  const { user: supabaseAuthUser } = useAuth();
  const hasAccount = supabaseAuthUser !== null && driver !== null;
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [periods, setPeriods] = useState<PayoutPeriod[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [processingTransferId, setProcessingTransferId] = useState<string | null>(null);
  const [pendingPayoutKeys, setPendingPayoutKeys] = useState<Record<string, string>>({});
  const loadPayoutData = useCallback(async () => {
    if (!driver) {
      setTransfers([]);
      setPeriods([]);
      setPayouts([]);
      setLoading(false);
      return;
    }

    try {
      const [transferResult, periodResult, payoutResult] =
        await Promise.all([
          supabase
            .from('transfers')
            .select(
              'transfer_id, trip_id, transfer_amount, transferred_at'
            )
            .eq('driver_id', driver.driverID)
            .eq('transfer_status', 'transferred')
            .is('payout_id', null)
            .order('transferred_at', { ascending: false }),

          supabase
            .from('payout_periods')
            .select(
              'payout_period_id, period_start, period_end, scheduled_payout_date'
            )
            .order('period_start', { ascending: true }),

          supabase
            .from('payouts')
            .select(
              'payout_id, payout_amount, fees, net_payout, payout_type, payout_status, created_at, paid_at, payout_period_id'
            )
            .eq('driver_id', driver.driverID)
            .order('created_at', { ascending: false }),
        ]);

      if (transferResult.error) throw transferResult.error;
      if (periodResult.error) throw periodResult.error;
      if (payoutResult.error) throw payoutResult.error;

      const transferRows = transferResult.data ?? [];
      const tripIds = [...new Set(transferRows.map((t) => t.trip_id))];
      let displayTripIds: Record<string, string> = {};

      if (tripIds.length > 0) {
        const { data: tripRows, error: tripsError } = await supabase
          .from('trips')
          .select('trip_id, display_trip_id')
          .in('trip_id', tripIds);

        if (tripsError) throw tripsError;

        displayTripIds = Object.fromEntries(
          (tripRows ?? []).map((trip) => [
            trip.trip_id,
            trip.display_trip_id,
          ])
        );
      }

      const mappedTransfers = transferRows.map((transfer) => ({
        ...transfer,
        display_trip_id: displayTripIds[transfer.trip_id] ?? null,
      }));

      setTransfers(
        mappedTransfers.map((row) => ({
          ...row,
          transfer_amount: Number(row.transfer_amount),
        }))
      );

      setPeriods(periodResult.data ?? []);

      setPayouts(
        (payoutResult.data ?? []).map((row) => ({
          ...row,
          payout_amount: Number(row.payout_amount),
          fees: Number(row.fees),
          net_payout: Number(row.net_payout),
        }))
      );
    } catch (error) {
      console.error('Payout data loading error:', error);
      Alert.alert(
        'Payouts',
        'Unable to load payout information. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driver]);

  useFocusEffect(
    useCallback(() => {
      void loadPayoutData();
    }, [loadPayoutData])
  );

  const formatDate = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString();

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleDateString([], {
      dateStyle: 'medium',
    });

  const availableTotal = transfers.reduce(
    (sum, transfer) => sum + transfer.transfer_amount,
    0
  );

  const getInstantPayoutAmount = (amount: number) => {
    const fee = Math.round(amount * 0.01 * 100) / 100;
    return amount - fee;
  };

  const requestInstantPayout = (transfer: Transfer) => {
    const fee = Math.round(transfer.transfer_amount * 0.01 * 100) / 100;
    const net = transfer.transfer_amount - fee;

    Alert.alert(
      'Confirm instant payout',
      `Trip ${transfer.display_trip_id ?? '—'}\n\n` +
        `Gross: $${transfer.transfer_amount.toFixed(2)}\n` +
        `Instant payout fee (1%): $${fee.toFixed(2)}\n` +
        `Instant payout amount: $${net.toFixed(2)}\n\n` +
        'Request this instant payout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request payout',
          onPress: async () => {

            const idempotencyKey = pendingPayoutKeys[transfer.transfer_id] ?? uuidv4();
            setPendingPayoutKeys((current) => ({
              ...current,
              [transfer.transfer_id]: idempotencyKey,
            }));

            setProcessingTransferId(transfer.transfer_id);

            try {
              const { error } = await supabase.functions.invoke(
                'create-driver-payout',
                {
                  body: {
                    payoutType: 'instant',
                    idempotencyKey,
                    transferIds: [transfer.transfer_id],
                  },
                }
              );

              if (error) throw error;

              setPendingPayoutKeys((current) => {
                const updated = { ...current };
                delete updated[transfer.transfer_id];
                return updated;
              });

              Alert.alert(
                'Payout requested',
                'Your instant payout request was submitted.'
              );

              await loadPayoutData();
            } catch (error) {
              console.error('Instant payout error:', error);
              Alert.alert(
                'Instant payout',
                'Unable to submit your payout request. Please try again.'
              );
            } finally {
              setProcessingTransferId(null);
            }
          },
        },
      ]
    );
  };

  const renderSectionTitle = (title: string) => (
    <Text style={payoutStyles.sectionTitle}>
      {title}
    </Text>
  );

  if (loading) {
    return (
      <View
        style={[commonStyles.container,payoutStyles.loadingContainer,]}
      >
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={[commonStyles.contentContainer,payoutStyles.scrollContent,]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadPayoutData();
          }}
          tintColor="#F59E0B"
        />
      }
    >
      {/* Page Header */}
      <View style={accountStylesCommon.pageHeader}>
        <View style={accountStylesCommon.pageHeaderContent}>
          <View style={accountStylesCommon.pageHeaderText}>
            <Text style={accountStylesCommon.pageSubtitle}>
              Manage your payouts
            </Text>
          </View>

          <Pressable
            style={accountStylesCommon.accountButton}
            onPress={() => router.push('/driver_account')}
          >
            <MaterialCommunityIcons
              name={hasAccount ? 'account-check' : 'account-outline'}
              size={30}
              color={hasAccount ? '#F59E0B' : '#B8BCC4'}
            />
            {driver && (
              <Text style={accountStylesCommon.accountName}>
                {driver.firstName}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={payoutStyles.balanceCard}>
        <Text style={payoutStyles.balanceLabel}>
          AVAILABLE FOR PAYOUT
        </Text>

        <Text style={payoutStyles.balanceAmount}>
          ${availableTotal.toFixed(2)}
        </Text>

        <Text style={payoutStyles.balanceTrips}>
          {transfers.length} eligible trip
          {transfers.length === 1 ? '' : 's'}
        </Text>
      </View>

      {renderSectionTitle('Eligible transfers')}
      <Text style={payoutStyles.providerFeeNote}>
        Instant payouts are charged a 1% fee by the payout provider.
      </Text>

      {transfers.length === 0 ? (
        <Text style={payoutStyles.emptyMessage}>
          No transfers available for payout.
        </Text>
      ) : (
        transfers.map((transfer) => (
          <View key={transfer.transfer_id} style={payoutStyles.transferCard}>
            <View style={payoutStyles.transferDetails}>
              <Text style={payoutStyles.transferTrip}>
                Trip {transfer.display_trip_id ?? '—'}
              </Text>

              <Text style={payoutStyles.transferDate}>
                {transfer.transferred_at
                  ? new Date(transfer.transferred_at).toLocaleDateString()
                  : '—'}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={payoutStyles.transferAmount}>
                ${transfer.transfer_amount.toFixed(2)}
              </Text>

              <Text style={payoutStyles.transferInstantAmount}>
                ${getInstantPayoutAmount(transfer.transfer_amount).toFixed(2)}
              </Text>

              <Pressable
                onPress={() => requestInstantPayout(transfer)}
                style={payoutStyles.instantPayoutButton}
              >
                <Text>Instant Payout</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Pressable
        onPress={() => setScheduleExpanded((expanded) => !expanded)}
        style={payoutStyles.sectionToggle}
      >
        {renderSectionTitle('Standard payout schedule')}

        <MaterialCommunityIcons
          name={scheduleExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="#B8BCC4"
        />
      </Pressable>

      {scheduleExpanded && (
        <>
          {periods.length === 0 ? (
            <Text style={{ color: '#B8BCC4', fontSize: 14 }}>
              No payout periods found.
            </Text>
          ) : (
            periods.map((period) => (
              <View
                key={period.payout_period_id}
                style={payoutStyles.periodCard}
              >
                <Text style={payoutStyles.periodDates}>
                  {formatDate(period.period_start)} –{' '}
                  {formatDate(period.period_end)}
                </Text>

                <Text style={payoutStyles.periodPayoutDate}>
                  Scheduled payout: {formatDate(period.scheduled_payout_date)}
                </Text>
              </View>
            ))
          )}
        </>
      )}

      {/* Payout History */}
      <Pressable
        onPress={() => setHistoryExpanded((expanded) => !expanded)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        {renderSectionTitle('Payout history')}

        <MaterialCommunityIcons
          name={historyExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="#B8BCC4"
        />
      </Pressable>

      {historyExpanded && (
        <>
            {payouts.length === 0 ? (
              <Text style={payoutStyles.emptyMessage}>
                No payout periods found.
              </Text>
            ) : (
              payouts.map((payout) => (
                <View
                  key={payout.payout_id}
                  style={payoutStyles.payoutCard}
                >
                  <View
                    style={payoutStyles.payoutHeader}
                  >
                    <Text style={payoutStyles.payoutType}>
                      {payout.payout_type === 'instant'
                        ? 'Instant payout'
                        : 'Standard payout'}
                    </Text>

                    <Text
                      style={[
                        payoutStyles.payoutStatus,
                        {
                          color:
                            payout.payout_status === 'paid'
                              ? '#55C49A'
                              : '#F59E0B',
                        },
                      ]}
                    >
                      {payout.payout_status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>

                  <Text style={payoutStyles.payoutDate}>
                    {formatDateTime(payout.created_at)}
                  </Text>

                  <View style={[payoutStyles.payoutRow,payoutStyles.payoutFirstRow,]}>
                    <Text style={payoutStyles.payoutLabel}>
                      Gross
                    </Text>
                    <Text style={payoutStyles.payoutValue}>
                      ${payout.payout_amount.toFixed(2)}
                    </Text>
                  </View>

                  {payout.fees > 0 && (
                    <View style={payoutStyles.payoutRow}>
                      <Text style={payoutStyles.payoutLabel}>
                        Instant payout fee
                      </Text>
                      <Text style={payoutStyles.payoutValue}>
                        -${payout.fees.toFixed(2)}
                      </Text>
                    </View>
                  )}

                  <View style={payoutStyles.payoutRow}>
                    <Text style={payoutStyles.payoutLabel}>
                      Net payout
                    </Text>
                    <Text style={payoutStyles.payoutNetValue}>
                      ${payout.net_payout.toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))
            )}
        </>
      )}
    </ScrollView>
  );
}
