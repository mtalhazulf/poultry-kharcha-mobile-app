import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { useSignedUrl } from '../hooks/useSignedUrl';
import { AppError } from '../lib/errors';
import { isPdfPath } from '../lib/receipts';
import { colors, radius, spacing, typography } from '../theme';
import { Button, Card, ErrorBanner } from './ui';

interface ReceiptPreviewProps {
  /** Storage key of an uploaded receipt (`{kharcha_id}/{filename}`). */
  path: string | null;
  /** A just-picked local file, shown instead of `path` until it is uploaded. */
  localUri?: string | null;
  onRemove?(): void;
}

/**
 * Shows a receipt. Remote receipts are loaded through a signed URL minted at
 * render time (see useSignedUrl) — the URL is never stored.
 */
export function ReceiptPreview({ path, localUri, onRemove }: ReceiptPreviewProps) {
  // Skip minting entirely while a local file is being previewed.
  const remotePath = localUri ? null : path;
  const { url, loading, error, refresh } = useSignedUrl(remotePath);
  const [imageError, setImageError] = useState<AppError | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [openError, setOpenError] = useState<AppError | null>(null);

  const openPdf = useCallback(async () => {
    if (!url) {
      return;
    }
    try {
      setOpenError(null);
      await Linking.openURL(url);
    } catch (err) {
      setOpenError(AppError.from(err, 'Could not open the receipt.'));
    }
  }, [url]);

  const retry = useCallback(() => {
    setImageError(null);
    refresh();
  }, [refresh]);

  if (!localUri && !path) {
    return null;
  }

  let content: React.ReactNode;
  if (localUri) {
    content = (
      <View style={styles.frame}>
        <Image source={{ uri: localUri }} style={styles.image} resizeMode="cover" />
      </View>
    );
  } else if (error) {
    content = <ErrorBanner message={error.message} kind={error.kind} onRetry={retry} />;
  } else if (loading || !url) {
    content = (
      <View style={[styles.frame, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (path && isPdfPath(path)) {
    content = (
      <Card style={styles.pdfCard}>
        <Text style={styles.pdfTitle}>PDF receipt</Text>
        <Text style={styles.pdfHint}>Opens in your PDF viewer.</Text>
        <Button title="Open" variant="secondary" onPress={openPdf} style={styles.pdfButton} />
        {openError ? <ErrorBanner message={openError.message} kind={openError.kind} /> : null}
      </Card>
    );
  } else if (imageError) {
    content = <ErrorBanner message={imageError.message} kind={imageError.kind} onRetry={retry} />;
  } else {
    content = (
      <View style={styles.frame}>
        <Image
          source={{ uri: url }}
          style={styles.image}
          resizeMode="cover"
          accessibilityLabel="Receipt image"
          onLoadStart={() => setImageLoading(true)}
          onLoadEnd={() => setImageLoading(false)}
          onError={() => {
            setImageLoading(false);
            setImageError(new AppError('storage', 'Could not load the receipt image.'));
          }}
        />
        {imageLoading ? (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {content}
      {onRemove ? (
        <Button title="Remove receipt" variant="ghost" onPress={onRemove} style={styles.remove} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  frame: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pdfCard: { alignItems: 'flex-start', gap: spacing.sm },
  pdfTitle: { ...typography.heading },
  pdfHint: { ...typography.caption },
  pdfButton: { alignSelf: 'stretch', marginTop: spacing.xs },
  remove: { alignSelf: 'flex-start', minHeight: 40 },
});
