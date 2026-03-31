import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing, typography } from '../../lib/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: IoniconName;
  color: string;
  size: number;
  focused: boolean;
}) {
  return (
    <View
      style={{
        minWidth: 52,
        height: 36,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.accent.primaryMuted : 'transparent',
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? colors.accent.primary : 'transparent',
      }}
    >
      <Ionicons name={name} size={focused ? size + 1 : size} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: typography.caption.fontSize,
          lineHeight: typography.caption.lineHeight,
          fontFamily: typography.caption.fontFamily,
          marginTop: 2,
        },
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 64 + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          borderTopWidth: 1,
          borderTopColor: colors.border.default,
          borderLeftWidth: 0,
          borderRightWidth: 0,
          borderBottomWidth: 0,
          borderRadius: 0,
          backgroundColor: colors.bg.surfaceOverlay,
          ...shadows.floating,
        },
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarItemStyle: {
          paddingVertical: spacing.xs,
        },
        sceneStyle: {
          backgroundColor: colors.bg.canvas,
        },
      }}
    >
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={'add-circle-outline' as IoniconName}
              size={size}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={'today-outline' as IoniconName}
              size={size}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="move"
        options={{
          title: 'Move',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={'barbell-outline' as IoniconName}
              size={size}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={'sparkles-outline' as IoniconName}
              size={size}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={'person-outline' as IoniconName}
              size={size}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
