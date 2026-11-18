/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () =>
  __DEV__ ? require('./src/dev/JournalRestoreStartupGate').default : require('./App').default,
);
