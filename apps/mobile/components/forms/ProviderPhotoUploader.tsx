/**
 * Reusable provider photo upload widget (G12).
 *
 * Used by both:
 *   - provider-profile.tsx onboarding section (initial photo upload during sign-up)
 *   - provider-edit.tsx (edit existing photo after approved)
 *
 * Owns the picker → upload → delete loop. Caller supplies provider id/name + current
 * photo_url, and a callback fired after each successful mutation so the caller can
 * update its own state (which feeds back into props for re-render).
 *
 * Backend wiring:
 *   - POST   /provider/me/photo (multipart)  → returns updated provider with new photo_url
 *   - DELETE /provider/me/photo              → returns updated provider with photo_url=null
 * Both endpoints reject when review_status='rejected' — caller passes `disabled` to
 * surface a clear hint upfront.
 */
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';

interface ProviderPhotoUpdated {
  photo_url: string | null;
}

interface Props {
  providerId: string;
  providerName: string;
  photoUrl: string | null;
  /** Called after successful upload OR delete with the server's returned photo_url. */
  onPhotoUpdated: (newUrl: string | null) => void;
  /** When true, disable both buttons and show `disabledReason` if user taps. */
  disabled?: boolean;
  disabledReason?: string;
}

export function ProviderPhotoUploader({
  providerId,
  providerName,
  photoUrl,
  onPhotoUpdated,
  disabled = false,
  disabledReason,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function pickAndUpload() {
    if (busy) return;
    if (disabled) {
      if (disabledReason) Alert.alert('提示', disabledReason);
      return;
    }

    // Request permission first for clearer errors than letting the picker auto-prompt.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相簿權限', '請於系統設定開啟相簿存取權限');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7, // ~70% JPEG quality keeps under 5 MB server limit comfortably
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setBusy(true);
    try {
      const formData = new FormData();
      // RN FormData typing requires the file-object cast — documented React Native pattern.
      formData.append('photo', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: `${providerId || 'photo'}.jpg`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const updated = await api.upload<ProviderPhotoUpdated>('/provider/me/photo', formData);
      onPhotoUpdated(updated.photo_url ?? null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '照片上傳失敗，請稍後再試';
      Alert.alert('上傳失敗', msg);
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove() {
    if (busy) return;
    if (disabled) {
      if (disabledReason) Alert.alert('提示', disabledReason);
      return;
    }
    Alert.alert('移除照片', '確定要移除目前的個人照片嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '移除', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  async function remove() {
    setBusy(true);
    try {
      const updated = await api.delete<ProviderPhotoUpdated>('/provider/me/photo');
      onPhotoUpdated(updated.photo_url ?? null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '移除失敗，請稍後再試';
      Alert.alert('移除失敗', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.row}>
      {photoUrl ? (
        // key={photoUrl} forces RN <Image> to refetch — bare prop change isn't enough
        // because RN caches by source identity. Cache busting via ?t= in URL handles CDN.
        <Image key={photoUrl} source={{ uri: photoUrl }} style={s.img} />
      ) : (
        <View style={s.fallback}>
          <Text style={s.fallbackText}>{providerName.charAt(0) || '?'}</Text>
        </View>
      )}
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={s.hint}>建議上傳近 3 個月個人正面清晰照片，最大 5 MB。</Text>
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, (busy || disabled) && { opacity: 0.5 }]}
            onPress={() => void pickAndUpload()}
            disabled={busy || disabled}
            activeOpacity={0.7}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Text style={s.btnText}>{photoUrl ? '更換照片' : '選擇照片'}</Text>
            )}
          </TouchableOpacity>
          {photoUrl && !busy && !disabled && (
            <TouchableOpacity style={s.btnDanger} onPress={confirmRemove} activeOpacity={0.7}>
              <Text style={s.btnDangerText}>移除</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  img: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.bgSurfaceAlt,
  },
  fallback: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.bgSurfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  fallbackText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  hint: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 90,
    alignItems: 'center',
  },
  btnText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: typography.captionSm.fontSize,
  },
  btnDanger: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: 'rgba(217,83,79,0.3)',
  },
  btnDangerText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: typography.captionSm.fontSize,
  },
});
