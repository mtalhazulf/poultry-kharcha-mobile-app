import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, Icon, Money, Skeleton } from '../../ui';
import { colors, layout, spacing } from '../../theme';

export interface WalletBalanceCardProps {
  balance: number;
  currency: string;
  /** First load with nothing fetched yet: a placeholder instead of a stale 0. */
  loading?: boolean;
  onPress: () => void;
  testID?: string;
}

/** Mirrors ExpenseSummaryCard's shell without the sparkline — a single figure, tappable to the full history. */
export function WalletBalanceCard({ balance, currency, loading = false, onPress, testID }: WalletBalanceCardProps) {
  return (
    <Card style={styles.card} onPress={onPress} testID={testID}>
      <View style={styles.topRow}>
        <AppText variant="subhead" color="textSecondary">
          Wallet
        </AppText>
        <Icon name="chevron-right" size={layout.icon.sm} color={colors.textTertiary} />
      </View>

      {loading ? (
        <Skeleton width="45%" height={spacing.xxl} />
      ) : (
        <Money
          amount={balance}
          currency={currency}
          variant="amountLarge"
          numberOfLines={1}
          adjustsFontSizeToFit
          color={balance < 0 ? 'dangerText' : 'text'}
          testID="wallet-balance-amount"
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
