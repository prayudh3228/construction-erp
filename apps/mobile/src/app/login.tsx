import { defaultBranding, loginFormSchema } from '@erp/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '@/components/TextField';
import { AppText, Button, Card } from '@/components/ui';
import { isDemoMode } from '@/lib/demo';
import { startDemoSession, useSession } from '@/state/session';
import { colors, radii, space } from '@/theme';

type Errors = Partial<Record<'username' | 'password', string>>;

export default function LoginScreen() {
  const router = useRouter();
  const session = useSession();
  const demo = isDemoMode();
  const branding = defaultBranding;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  const submit = () => {
    const result = loginFormSchema.safeParse({ username, password });
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      setNotice(null);
      return;
    }
    setErrors({});
    // Phase 2 replaces this with the real sign-in call. Until then no password is accepted.
    setNotice(
      demo
        ? 'Password sign-in is switched on in the next phase. For now, use "Continue as demo user".'
        : 'Password sign-in is not switched on yet.',
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            {/* Placeholder mark until the company logo is supplied (Q2). */}
            <View
              style={styles.logo}
              accessible
              accessibilityLabel={`${branding.companyName} logo`}
            >
              <Ionicons name="business" size={28} color={colors['primary-foreground']} />
            </View>
            <AppText variant="title" accessibilityRole="header">
              Sign in
            </AppText>
            <AppText variant="small">
              {branding.productName} for {branding.companyName}
            </AppText>
          </View>

          {demo && (
            <Card>
              <AppText variant="small">
                This is a demo with fake data. No password is needed.
              </AppText>
              <Button
                label="Continue as demo user"
                size="lg"
                onPress={() => {
                  startDemoSession();
                  router.replace('/');
                }}
              />
            </Card>
          )}

          <View style={styles.form}>
            <TextField
              label="Username or email"
              required
              value={username}
              onChangeText={(v) => {
                setUsername(v);
                if (errors.username) setErrors((e) => ({ ...e, username: undefined }));
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              error={errors.username}
            />
            <TextField
              label="Password"
              required
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={errors.password}
            />
            {notice && (
              <View style={styles.notice} accessibilityLiveRegion="polite" accessibilityRole="text">
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors['info-foreground']}
                />
                <AppText variant="small" style={styles.noticeText}>
                  {notice}
                </AppText>
              </View>
            )}
            <Button
              label="Sign in"
              variant={demo ? 'outline' : 'primary'}
              size="lg"
              onPress={submit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space(5), gap: space(6), paddingTop: space(10) },
  brand: { gap: space(2) },
  logo: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(2),
  },
  form: { gap: space(4) },
  notice: {
    flexDirection: 'row',
    gap: space(2),
    padding: space(3),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.info,
    backgroundColor: colors['info-subtle'],
  },
  noticeText: { flex: 1, color: colors['info-foreground'] },
});
