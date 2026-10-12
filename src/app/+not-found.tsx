import { Redirect } from 'expo-router';

/** Unknown URLs (e.g. when the web app is served under a sub path) lead to the start screen. */
export default function NotFound() {
  return <Redirect href="/" />;
}
