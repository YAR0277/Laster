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

      console.log('CUSTOMER LOAD:', {
        authLoading,
        authUserID: supabaseAuthUser?.id,
        isAnonymous: supabaseAuthUser?.is_anonymous,
      });

      // Load Customer record
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', supabaseAuthUser.id)
        .maybeSingle();

      console.log('CUSTOMER QUERY:', {
        found: !!data,
        error: error?.message,
        isGuest: data?.is_guest,
      });

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

      if (data.is_guest) {
        setCustomer(null);

        // Only sign out if this is still the same anonymous
        // guest session that initiated the customer lookup.
        if (supabaseAuthUser.is_anonymous) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (
            session?.user.id === supabaseAuthUser.id &&
            session.user.is_anonymous
          ) {
            await supabase.auth.signOut();
          }
        }

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