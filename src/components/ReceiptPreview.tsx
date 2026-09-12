import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, View } from 'react-native';
import { useSignedUrl } from '../hooks/useSignedUrl';
import { AppError } from '../lib/errors';
import { isPdfPath } from '../lib/receipts';
import {
  AppText,
  Button,
  Card,
  ErrorBanner,
  IconTile,
  ListGroup,
  ListItem,
  LIST_TEXT_INSET,
} from '../ui';
import { colors, radius, spacing } from '../theme';

export interface ReceiptPreviewProps {
  /** Storage key of an uploaded receipt (`{kharcha_id}/{filename}`). */
  path: string | null;
  /** A just-picked local file, shown instead of `path` until it is uploaded. */
  localUri?: string | null;
  /** With both pickers set, an empty receipt offers "Take photo" / "Choose from gallery". */
  onTakePhoto?: () => void;
  onChooseFromGallery?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  /** 'compact' (4:3, forms) or 'full' (3:4, detail). Default 'full'. */
  size?: 'compact' | 'full';
}

/**
 * Shows a receipt, or the ways to add one. Remote receipts load through a
 * signed URL minted at render time (useSignedUrl); the URL is never stored.
 */
export function ReceiptPreview({
  path,
  localUri = null,
  onTakePhoto,
  onChooseFromGallery,
  onRemove,
  disabled = false,
  size = 'full',
}: ReceiptPreviewProps) {
  // Skip minting while a local file is previewed.
  const remotePath = localUri ? null : path;
  const { url, loading, error, refresh } = useSignedUrl(remotePath);
  const [imageError, setImageError] = useState<AppError | null>(null);
  // Starts true so `receipt-preview-loaded` is only ever reached through
  // onLoadEnd — the first frame of the image branch has fetched nothing yet.
  const [imageLoading, setImageLoading] = useState(true);
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
    setImageLoading(true);
    refresh();
  }, [refresh]);

  const frameStyle = [styles.frame, size === 'compact' ? styles.frameCompact : styles.frameFull];

  if (!localUri && !path) {
    if (!onTakePhoto || !onChooseFromGallery) {
      return null;
    }
    return (
      <ListGroup separatorInset={LIST_TEXT_INSET}>
        <ListItem
          title="Take photo"
          leadingIcon="camera"
          onPress={onTakePhoto}
          disabled={disabled}
          chevron={false}
          testID="receipt-camera"
        />
        <ListItem
          title="Choose from gallery"
          leadingIcon="image"
          onPress={onChooseFromGallery}
          disabled={disabled}
          chevron={false}
          testID="receipt-gallery"
        />
      </ListGroup>
    );
  }

  let content: React.ReactNode;
  if (localUri) {
    content = (
      <View style={frameStyle} testID="receipt-preview-local">
        <Image
          source={{ uri: localUri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="Selected receipt"
        />
      </View>
    );
  } else if (error) {
    content = <ErrorBanner message={error.message} kind={error.kind} onRetry={retry} />;
  } else if (loading || !url) {
    content = (
      <View style={[frameStyle, styles.center]} testID="receipt-preview-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (path && isPdfPath(path)) {
    content = (
      <Card style={styles.pdfCard}>
        <IconTile icon="file-text" tone="primary" />
        <View style={styles.pdfText}>
          <AppText variant="bodyStrong">Receipt</AppText>
          <AppText variant="callout" color="textSecondary">
            PDF document
          </AppText>
        </View>
        <Button title="Open" variant="secondary" size="sm" onPress={openPdf} />
      </Card>
    );
  } else if (imageError) {
    content = <ErrorBanner message={imageError.message} kind={imageError.kind} onRetry={retry} />;
  } else {
    content = (
      <View
        style={frameStyle}
        testID={imageLoading ? 'receipt-preview-loading' : 'receipt-preview-loaded'}
      >
        <Image
          source={{ uri: url }}
          style={styles.image}
          resizeMode="contain"
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
      {openError ? <ErrorBanner message={openError.message} kind={openError.kind} /> : null}
      {onRemove ? (
        <Button
          title="Remove receipt"
          icon="trash"
          variant="ghost"
          size="sm"
          onPress={onRemove}
          disabled={disabled}
          style={styles.remove}
          testID="receipt-remove"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  frame: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  frameFull: { aspectRatio: 3 / 4 },
  frameCompact: { aspectRatio: 4 / 3 },
  image: { width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pdfCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pdfText: { flex: 1, gap: spacing.xxs },
  remove: { alignSelf: 'flex-start' },
});
