import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside a screen (a notification tap) move the app, since the
// handler lives in AuthContext, above the navigator.
export const navigationRef = createNavigationContainerRef();

export function navigateHome() {
  // Signed out, the stack only has Login; the tap just opens the app.
  if (navigationRef.isReady() && navigationRef.getRootState()?.routeNames?.includes('Main')) {
    navigationRef.navigate('Main', { screen: 'Home' });
  }
}
