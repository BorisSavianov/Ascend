import { Ionicons } from '@expo/vector-icons';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, radius, shadows, spacing } from '../../lib/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Per-tab configuration
const TAB_CONFIG = [
  { name: 'log',      icon: 'add-circle-outline' as IoniconName, activeColor: colors.accent.primary },
  { name: 'today',    icon: 'today-outline' as IoniconName,      activeColor: colors.accent.primary },
  { name: 'move',     icon: 'barbell-outline' as IoniconName,    activeColor: colors.intensity.primary },
  { name: 'insights', icon: 'sparkles-outline' as IoniconName,   activeColor: colors.accent.primary },
  { name: 'profile',  icon: 'person-outline' as IoniconName,     activeColor: colors.accent.primary },
] as const;

const TAB_BAR_H   = 64;
const H_MARGIN    = 12;
const BOTTOM_LIFT = 8;   // px above safe area

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const barWidth   = screenWidth - H_MARGIN * 2;
  const tabWidth   = barWidth / TAB_CONFIG.length;
  const indicatorW = 44;

  // Sliding indicator x position
  const indicatorX = useSharedValue(state.index * tabWidth + (tabWidth - indicatorW) / 2);

  useEffect(() => {
    indicatorX.value = withSpring(
      state.index * tabWidth + (tabWidth - indicatorW) / 2,
      motion.spring.snappy,
    );
  }, [state.index, tabWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      style={{
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
        overflow: 'hidden',
        ...shadows.floating,
      }}
    >
      {/* Animated pill indicator — absolute, slides behind icons */}
      <Animated.View
        style={[
          {
            position:        'absolute',
            top:             (TAB_BAR_H - 40) / 2,
            left:            0,
            width:           indicatorW,
            height:          40,
            borderRadius:    radius.pill,
            backgroundColor: TAB_CONFIG[state.index].activeColor === colors.intensity.primary
              ? colors.intensity.muted
              : colors.accent.primaryMuted,
          },
          indicatorStyle,
        ]}
      />

      {/* Tab buttons */}
      {TAB_CONFIG.map((tab, index) => {
        const focused  = state.index === index;
        const iconColor = focused ? tab.activeColor : colors.text.disabled;

        return (
          <TabButton
            key={tab.name}
            icon={tab.icon}
            color={iconColor}
            focused={focused}
            tabWidth={tabWidth}
            onPress={() => {
              const event = navigation.emit({
                type:    'tabPress',
                target:  state.routes[index]?.key ?? '',
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            }}
            onLongPress={() => {
              navigation.emit({
                type:   'tabLongPress',
                target: state.routes[index]?.key ?? '',
              });
            }}
          />
        );
      })}
    </View>
  );
}

function TabButton({
  icon,
  color,
  focused,
  tabWidth,
  onPress,
  onLongPress,
}: {
  icon:       IoniconName;
  color:      string;
  focused:    boolean;
  tabWidth:   number;
  onPress:    () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(1);

  // Brief scale pulse on focus change
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
        width:            tabWidth,
        height:           TAB_BAR_H,
        alignItems:       'center',
        justifyContent:   'center',
      }}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons name={icon} size={22} color={color} />
      </Animated.View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: colors.bg.canvas,
          // Extra bottom padding so content clears the floating tab bar
          paddingBottom: TAB_BAR_H + insets.bottom + BOTTOM_LIFT + spacing.sm,
        },
      }}
    >
      <Tabs.Screen name="log"      options={{ title: 'Log' }} />
      <Tabs.Screen name="today"    options={{ title: 'Today' }} />
      <Tabs.Screen name="move"     options={{ title: 'Move' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="profile"  options={{ title: 'Profile' }} />
    </Tabs>
  );
}
