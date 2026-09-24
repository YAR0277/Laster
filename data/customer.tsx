import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';
import { useAuth } from './auth';

export type Customer = {
  customerID: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  payment: string;
};

type CustomerContextType = {
  customer: Customer | null;
  setCustomer: React.Dispatch<React.SetStateAction<Customer | null>>;
};

const CustomerContext = createContext<CustomerContextType | undefined>(
  undefined
);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const { user: supabaseAuthUser, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const loadCustomer = async () => {
      // No authenticated customer
      if (!supabaseAuthUser) {
        setCustomer(null);
        return;
      }

      // Registered customer
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('auth_user_id', supabaseAuthUser.id)
        .maybeSingle();

      if (error) {
        console.error('Customer load error:', error.message);
        setCustomer(null);
        return;
      }

      if (!data) {
        // The authenticated user does not have a Customer account.
        setCustomer(null);
        return;
      }

      setCustomer({
        customerID: data.customer_id,
        firstName: data.first_name,
        lastName: data.last_name,
        phone: data.phone,
        email: data.email,
        payment: data.payment,
      });
    };

    loadCustomer();
  }, [supabaseAuthUser, authLoading]);

  return (
    <CustomerContext.Provider value={{ customer, setCustomer }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);

  if (!context) {
    throw new Error('useCustomer must be used inside a CustomerProvider');
  }

  return context;
}