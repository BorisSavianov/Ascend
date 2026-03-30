import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: '#1f2937',
        },
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#6b7280',
      }}
    >
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'add-circle-outline' as IoniconName} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'today-outline' as IoniconName} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="move"
        options={{
          title: 'Move',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'barbell-outline' as IoniconName} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'bar-chart-outline' as IoniconName} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'person-outline' as IoniconName} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
