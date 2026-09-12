import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout, radius, spacing } from '../theme';
import { AppText } from './AppText';
import { Divider } from './Divider';
import { SectionHeader, type SectionHeaderAction } from './SectionHeader';

/** Separator inset that lines up with titles after a 40dp leading tile. */
export const LIST_TEXT_INSET = spacing.lg + layout.tile.md + spacing.md;

export interface ListGroupProps {
  title?: string;
  action?: SectionHeaderAction;
  /** Short hint under the group. */
  footer?: string;
  /** Left inset of separators. Default 16; use LIST_TEXT_INSET with leading tiles. */
  separatorInset?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** White rounded group of ListItems with hairline separators. Renders nothing without rows. */
export function ListGroup({
  title,
  action,
  footer,
  separatorInset = spacing.lg,
  children,
  style,
  testID,
}: ListGroupProps) {
  const rows = React.Children.toArray(children);
  if (rows.length === 0) {
    return null;
  }
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {title ? <SectionHeader title={title} action={action} /> : null}
      <View style={styles.group}>
        {rows.map((row, index) => (
          <React.Fragment key={React.isValidElement(row) && row.key != null ? row.key : index}>
            {index > 0 ? <Divider inset={separatorInset} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>
      {footer ? (
        <AppText variant="caption" color="textSecondary" style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  footer: { paddingHorizontal: spacing.xs },
});
