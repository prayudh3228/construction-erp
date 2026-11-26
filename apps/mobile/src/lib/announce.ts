import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Speak a message with the screen reader when it appears or changes. Live regions only work on
 * Android; this works with VoiceOver (iOS) and TalkBack (Android) alike.
 */
export function useAnnounce(message: string | null | undefined): void {
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
}
