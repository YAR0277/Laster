
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import {
    Pressable,
    StyleProp,
    Text,
    ViewStyle,
} from 'react-native';

import { styles as accountStyles } from '../../Common/src/components/account';
import { useCustomer } from '../data/customer';

type Props = {
  style?: StyleProp<ViewStyle>;
};

export default function CustomerAccountButton({ style }: Props) {
  const router = useRouter();
  const { customer } = useCustomer();

  return (
    <Pressable
      style={[accountStyles.accountButton, style]}
      onPress={() => router.push('/customer_account?mode=default')}
    >
      <MaterialCommunityIcons
        name={customer ? 'account-check' : 'account-outline'}
        size={30}
        color={customer ? '#8B5CF6' : '#B8BCC4'}
      />

      {customer && (
        <Text style={accountStyles.accountName}>
          {customer.firstName}
        </Text>
      )}
    </Pressable>
  );
}
