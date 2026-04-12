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
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, motion } from '../../lib/theme';
import { useWindowDimensions } from 'react-native';

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
  const { width: screenWidth } = useWindowDimensions();
  const opacity = useSharedValue(isFocused ? 1 : 0);
  const translateY = useSharedValue(isFocused ? 0 : 16);
  const scale = useSharedValue(isFocused ? 1 : 0.98);
  const swipeTranslateX = useSharedValue(0);

  const currentRouteIndex = TAB_ROUTES.findIndex((route) => route === pathname);
  const canSwipeTabs = currentRouteIndex !== -1;

  const easing = Easing.out(Easing.cubic);

  React.useEffect(() => {
    if (isFocused) {
      opacity.value = withTiming(1, { duration: motion.standard, easing });
      translateY.value = withTiming(0, { duration: motion.standard, easing: Easing.out(Easing.poly(4)) });
      scale.value = withTiming(1, { duration: motion.standard, easing: Easing.out(Easing.poly(4)) });
    } else {
      opacity.value = withTiming(0, { duration: motion.fast, easing });
    }
  }, [isFocused, opacity, translateY, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: swipeTranslateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
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
      // 40% damping (up from 35%) + subtle opacity reduction during drag
      swipeTranslateX.value = event.translationX * 0.40;
      opacity.value = 1 - Math.abs(event.translationX) / screenWidth * 0.15;
    })
    .onEnd((event) => {
      const passedThreshold = Math.abs(event.translationX) > 96 || Math.abs(event.velocityX) > 700;

      if (event.translationX > 0 && currentRouteIndex > 0 && passedThreshold) {
        swipeTranslateX.value = withSpring(64, motion.spring.snappy, () => {
          swipeTranslateX.value = 0;
          runOnJS(navigateToSibling)(-1);
        });
        return;
      }

      if (event.translationX < 0 && currentRouteIndex < TAB_ROUTES.length - 1 && passedThreshold) {
        swipeTranslateX.value = withSpring(-64, motion.spring.snappy, () => {
          swipeTranslateX.value = 0;
          runOnJS(navigateToSibling)(1);
        });
        return;
      }

      swipeTranslateX.value = withSpring(0, motion.spring.snappy);
      opacity.value = withTiming(1, { duration: motion.fast });
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
