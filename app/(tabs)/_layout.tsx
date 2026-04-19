import { Ionicons } from '@expo/vector-icons';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Keyboard, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, fontFamily, motion, radius, shadows, spacing } from '../../lib/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type TabEntry =
  | { name: string; icon: IoniconName; label: string; activeColor: string; isFAB?: false }
  | { name: string; isFAB: true };

const TAB_CONFIG: TabEntry[] = [
  { name: 'today',    icon: 'calendar-outline',   label: 'Today',    activeColor: colors.accent.primary },
  { name: 'move',     icon: 'barbell-outline',     label: 'Move',     activeColor: colors.intensity.primary },
  { name: 'log',      isFAB: true },
  { name: 'insights', icon: 'trending-up-outline', label: 'Insights', activeColor: colors.accent.primary },
  { name: 'profile',  icon: 'person-outline',      label: 'Profile',  activeColor: colors.accent.primary },
];

const TAB_BAR_H   = 68;
const H_MARGIN    = 12;
const BOTTOM_LIFT = 8;
const FAB_SIZE    = 52;

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const barWidth  = screenWidth - H_MARGIN * 2;
  const tabWidth  = barWidth / TAB_CONFIG.length;
  const indicatorW = 40;

  // Only animate indicator for non-FAB positions
  const visibleIndex = state.index === 2 ? -1 : state.index;
  const indicatorX = useSharedValue(
    visibleIndex >= 0 ? visibleIndex * tabWidth + (tabWidth - indicatorW) / 2 : -100,
  );

  useEffect(() => {
    const idx = state.index === 2 ? -1 : state.index;
    indicatorX.value = withSpring(
      idx >= 0 ? idx * tabWidth + (tabWidth - indicatorW) / 2 : -100,
      motion.spring.snappy,
    );
  }, [state.index, tabWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    opacity: withTiming(state.index === 2 ? 0 : 1, { duration: 150 }),
  }));

  // Slide off-screen when keyboard is visible
  const tabSlideY = useSharedValue(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => {
      tabSlideY.value = withTiming(TAB_BAR_H + insets.bottom + BOTTOM_LIFT + 20, { duration: 180 });
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      tabSlideY.value = withTiming(0, { duration: 200 });
    });
    return () => { show.remove(); hide.remove(); };
  }, [tabSlideY, insets.bottom]);

  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabSlideY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position:  'absolute',
          left:       H_MARGIN,
          right:      H_MARGIN,
          bottom:     insets.bottom + BOTTOM_LIFT,
          height:     TAB_BAR_H,
          borderRadius: radius.xl,
          backgroundColor: colors.bg.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border.default,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'visible',
          ...shadows.floating,
        },
        tabBarAnimatedStyle,
      ]}
    >
      {/* Animated pill indicator */}
      <Animated.View
        style={[
          {
            position:        'absolute',
            top:             (TAB_BAR_H - 36) / 2,
            left:            0,
            width:           indicatorW,
            height:          36,
            borderRadius:    radius.pill,
            backgroundColor: TAB_CONFIG[state.index] && !('isFAB' in TAB_CONFIG[state.index] && TAB_CONFIG[state.index].isFAB)
              ? (TAB_CONFIG[state.index] as Exclude<TabEntry, { isFAB: true }>).activeColor === colors.intensity.primary
                ? colors.intensity.muted
                : colors.accent.primaryMuted
              : colors.accent.primaryMuted,
          },
          indicatorStyle,
        ]}
      />

      {TAB_CONFIG.map((tab, index) => {
        const focused = state.index === index;

        if ('isFAB' in tab && tab.isFAB) {
          return (
            <FABButton
              key={tab.name}
              tabWidth={tabWidth}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: state.routes[index]?.key ?? '',
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(tab.name);
                }
              }}
            />
          );
        }

        const iconColor = focused
          ? (tab as Exclude<TabEntry, { isFAB: true }>).activeColor
          : colors.text.disabled;

        return (
          <TabButton
            key={tab.name}
            icon={(tab as Exclude<TabEntry, { isFAB: true }>).icon}
            label={(tab as Exclude<TabEntry, { isFAB: true }>).label}
            color={iconColor}
            focused={focused}
            tabWidth={tabWidth}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[index]?.key ?? '',
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            }}
            onLongPress={() => {
              navigation.emit({
                type: 'tabLongPress',
                target: state.routes[index]?.key ?? '',
              });
            }}
          />
        );
      })}
    </Animated.View>
  );
}

function FABButton({ tabWidth, onPress }: { tabWidth: number; onPress: () => void }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={{ width: tabWidth, alignItems: 'center', justifyContent: 'center' }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.92, { duration: 80 }); }}
        onPressOut={() => { scale.value = withSpring(1, motion.spring.snappy); }}
        accessibilityRole="button"
        accessibilityLabel="Quick log"
      >
        <Animated.View
          style={[
            {
              width:           FAB_SIZE,
              height:          FAB_SIZE,
              borderRadius:    16,
              backgroundColor: colors.cta.bg,
              alignItems:      'center',
              justifyContent:  'center',
              marginTop:       -16,
              shadowColor:     '#000',
              shadowOpacity:   0.35,
              shadowRadius:    16,
              shadowOffset:    { width: 0, height: 8 },
              elevation:       12,
            },
            animStyle,
          ]}
        >
          <Ionicons name="add" size={26} color={colors.cta.ink} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

function TabButton({
  icon,
  label,
  color,
  focused,
  tabWidth,
  onPress,
  onLongPress,
}: {
  icon:        IoniconName;
  label:       string;
  color:       string;
  focused:     boolean;
  tabWidth:    number;
  onPress:     () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withTiming(1.12, { duration: motion.fast }, () => {
        scale.value = withSpring(1, motion.spring.snappy);
      });
    }
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      style={{
        width:          tabWidth,
        height:         TAB_BAR_H,
        alignItems:     'center',
        justifyContent: 'center',
        gap:            3,
      }}
    >
      <Animated.View style={[{ alignItems: 'center', gap: 3 }, animatedStyle]}>
        <Ionicons name={icon} size={21} color={color} />
        <Text style={{
          fontSize:   10,
          fontWeight: '500',
          color,
          fontFamily: fontFamily.medium,
          letterSpacing: 0.1,
        }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      initialRouteName="today"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: colors.bg.canvas,
          paddingBottom: TAB_BAR_H + insets.bottom + BOTTOM_LIFT + spacing.sm,
        },
      }}
    >
      <Tabs.Screen name="today"    options={{ title: 'Today' }} />
      <Tabs.Screen name="move"     options={{ title: 'Move' }} />
      <Tabs.Screen name="log"      options={{ title: 'Log' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="profile"  options={{ title: 'Profile' }} />
    </Tabs>
  );
}
