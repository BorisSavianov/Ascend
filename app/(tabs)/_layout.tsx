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

type TabEntry = { name: string; icon: IoniconName; label: string; activeColor: string; routeIndex: number; isFAB?: boolean };

// Routes are indexed: 0=today, 1=move, 2=insights, 3=profile, 4=log (non-swipeable)
const TAB_CONFIG: TabEntry[] = [
  { name: 'today',    icon: 'calendar-outline',   label: 'Today',    activeColor: colors.accent.primary, routeIndex: 0 },
  { name: 'move',     icon: 'barbell-outline',     label: 'Move',     activeColor: colors.intensity.primary, routeIndex: 1 },
  { name: 'insights', icon: 'trending-up-outline', label: 'Insights', activeColor: colors.accent.primary, routeIndex: 2 },
  { name: 'profile',  icon: 'person-outline',      label: 'Profile',  activeColor: colors.accent.primary, routeIndex: 3 },
  { name: 'log',      icon: 'add',                 label: 'Log',      activeColor: colors.cta.bg, routeIndex: 4 },
];

const TAB_BAR_H   = 68;
const H_MARGIN    = 12;
const BOTTOM_LIFT = 8;
const FAB_SIZE    = 52;

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const barWidth  = screenWidth - H_MARGIN * 2;
  const tabWidth  = barWidth / 5; // 5 slots: Today, Move, FAB, Insights, Profile
  const indicatorW = 40;

  // Mapping state.index to visual position
  // Routes: 0:today, 1:move, 2:insights, 3:profile, 4:log
  // Visual: 0:today, 1:move, 2:log, 3:insights, 4:profile
  const getVisualIndex = (index: number) => {
    if (index === 4) return 2; // log is in the middle
    if (index === 2) return 3; // insights is 4th
    if (index === 3) return 4; // profile is 5th
    return index; // today(0), move(1)
  };

  const indicatorX = useSharedValue(
    getVisualIndex(state.index) * tabWidth + (tabWidth - indicatorW) / 2,
  );

  useEffect(() => {
    indicatorX.value = withSpring(
      getVisualIndex(state.index) * tabWidth + (tabWidth - indicatorW) / 2,
      motion.spring.snappy,
    );
  }, [state.index, tabWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
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

      {/* Left tabs: Today, Move */}
      {TAB_CONFIG.slice(0, 2).map((tab) => {
        const focused = state.index === tab.routeIndex;
        const iconColor = focused ? tab.activeColor : colors.text.disabled;

        return (
          <TabButton
            key={tab.name}
            icon={tab.icon}
            label={tab.label}
            color={iconColor}
            focused={focused}
            tabWidth={tabWidth}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[tab.routeIndex]?.key ?? '',
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            }}
            onLongPress={() => {
              navigation.emit({
                type: 'tabLongPress',
                target: state.routes[tab.routeIndex]?.key ?? '',
              });
            }}
          />
        );
      })}

      {/* Center FAB - press-only, non-swipeable */}
      <FABButton
        tabWidth={tabWidth}
        onPress={() => {
          navigation.navigate('log');
        }}
      />

      {/* Right tabs: Insights, Profile */}
      {TAB_CONFIG.slice(2).map((tab) => {
        const focused = state.index === tab.routeIndex;
        const iconColor = focused ? tab.activeColor : colors.text.disabled;

        return (
          <TabButton
            key={tab.name}
            icon={tab.icon}
            label={tab.label}
            color={iconColor}
            focused={focused}
            tabWidth={tabWidth}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[tab.routeIndex]?.key ?? '',
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            }}
            onLongPress={() => {
              navigation.emit({
                type: 'tabLongPress',
                target: state.routes[tab.routeIndex]?.key ?? '',
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
    <View style={{ width: tabWidth, alignItems: 'center', justifyContent: 'center', pointerEvents: 'box-only' }}>
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
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="profile"  options={{ title: 'Profile' }} />
      <Tabs.Screen name="log"      options={{ title: 'Log' }} />
    </Tabs>
  );
}
