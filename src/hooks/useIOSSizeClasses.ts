import {NativeModules, Platform, useWindowDimensions} from 'react-native';
import {useEffect, useState} from 'react';

export type IOSSizeClass = 'compact' | 'regular' | 'unspecified';

type SizeClasses = {
  horizontal: IOSSizeClass;
  vertical: IOSSizeClass;
};

type InterfaceEnvironmentModule = {
  currentSizeClasses: () => Promise<SizeClasses>;
};

const unspecified: SizeClasses = {
  horizontal: 'unspecified',
  vertical: 'unspecified',
};

export const useIOSSizeClasses = (): SizeClasses => {
  const {width, height} = useWindowDimensions();
  const [sizeClasses, setSizeClasses] = useState<SizeClasses>(unspecified);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    const module = NativeModules.InterfaceEnvironmentBridge as InterfaceEnvironmentModule | undefined;
    if (!module?.currentSizeClasses) {
      return;
    }

    let active = true;
    module.currentSizeClasses()
      .then(next => {
        if (active) {
          setSizeClasses(next);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [height, width]);

  return sizeClasses;
};
