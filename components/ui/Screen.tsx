import React from 'react';
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router, usePathname } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, motion } from '../../lib/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
};

const TAB_ROUTES = ['/log', '/today', '/move', '/insights', '/profile'] as const;

export default function Screen({
  children,
  scroll = false,
  edges = ['top', 'left', 'right'],
  style,
  contentContainerStyle,
}: Props) {
  const isFocused = useIsFocused();
  const pathname = usePathname();
  const opacity = useSharedValue(isFocused ? 1 : 0);
  const translateY = useSharedValue(isFocused ? 0 : 8);
  const swipeTranslateX = useSharedValue(0);

  const currentRouteIndex = TAB_ROUTES.findIndex((route) => route === pathname);
  const canSwipeTabs = currentRouteIndex !== -1;

  React.useEffect(() => {
    opacity.value = withTiming(isFocused ? 1 : 0.96, { duration: motion.medium });
    translateY.value = withTiming(isFocused ? 0 : 8, { duration: motion.medium });
  }, [isFocused, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: swipeTranslateX.value },
      { translateY: translateY.value },
    ],
  }));

  function navigateToSibling(direction: -1 | 1) {
    const nextRoute = TAB_ROUTES[currentRouteIndex + direction];
    if (nextRoute) {
      router.replace(nextRoute);
    }
  }

  const swipeGesture = Gesture.Pan()
    .enabled(canSwipeTabs)
    .activeOffsetX([-28, 28])
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      const movingTowardPrev = event.translationX > 0 && currentRouteIndex > 0;
      const movingTowardNext = event.translationX < 0 && currentRouteIndex < TAB_ROUTES.length - 1;
      if (!movingTowardPrev && !movingTowardNext) {
        swipeTranslateX.value = 0;
        return;
      }
      swipeTranslateX.value = event.translationX * 0.35;
    })
    .onEnd((event) => {
      const passedThreshold = Math.abs(event.translationX) > 96 || Math.abs(event.velocityX) > 900;

      if (event.translationX > 0 && currentRouteIndex > 0 && passedThreshold) {
        swipeTranslateX.value = withTiming(64, { duration: motion.fast }, () => {
          swipeTranslateX.value = 0;
          runOnJS(navigateToSibling)(-1);
        });
        return;
      }

      if (event.translationX < 0 && currentRouteIndex < TAB_ROUTES.length - 1 && passedThreshold) {
        swipeTranslateX.value = withTiming(-64, { duration: motion.fast }, () => {
          swipeTranslateX.value = 0;
          runOnJS(navigateToSibling)(1);
        });
        return;
      }

      swipeTranslateX.value = withTiming(0, { duration: motion.fast });
    });

  const content = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1 }}>{children}</View>
  );

  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: colors.bg.canvas }, style]}
      edges={edges}
    >
      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          {content}
        </Animated.View>
      </GestureDetector>
    </SafeAreaView>
  );
}
