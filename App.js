import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  BarlowCondensed_400Regular,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_900Black,
} from '@expo-google-fonts/barlow-condensed';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';

import LoginScreen    from './screens/LoginScreen';
import HomeScreen     from './screens/HomeScreen';
import RouteScreen    from './screens/RouteScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReportScreen   from './screens/ReportScreen';
import BottomNav      from './components/BottomNav';
import Colors         from './constants/colors';
import { AuthProvider, useAuth } from './context/AuthContext';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Route"    component={RouteScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { isAuthenticated, restoring } = useAuth();
  if (restoring) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgBase, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.accentFire} size="large" />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Report"
            component={ReportScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_400Regular,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_900Black,
    ShareTechMono_400Regular,

    // Each key loads the weight it is named after.
    AxiformaRegular: require('./components/fonts/Axiforma/Axiforma-Regular.otf'),
    AxiformaMedium: require('./components/fonts/Axiforma/Axiforma-Medium.otf'),
    AxiformaBlack: require('./components/fonts/Axiforma/Axiforma-Black.otf'),
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgBase, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.accentFire} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
