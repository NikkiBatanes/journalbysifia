import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useRoutine } from '../../context/RoutineContext';
import { getRoutineResumeRoutes } from '../../services/routineResume';
import { Colors } from '../../theme/colors';

const RoutineResumeScreen = () => {
  const navigation = useNavigation<any>();
  const { routine, completedSteps, completed, isLoading } = useRoutine();

  React.useEffect(() => {
    if (isLoading) {return;}
    const routes = getRoutineResumeRoutes(routine, completedSteps, completed).map(name => ({ name }));
    navigation.reset({ index: routes.length - 1, routes });
  }, [completed, completedSteps, isLoading, navigation, routine]);

  return <View style={{ flex: 1, backgroundColor: Colors.lightBackground }} />;
};

export default RoutineResumeScreen;
