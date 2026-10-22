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
  paymentMethodBrand?: string | null;
  paymentMethodLast4?: string | null;
  paymentMethodExpMonth?: number | null;
  paymentMethodExpYear?: number | null;
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

      // Load Customer record
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', supabaseAuthUser.id)
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
        paymentMethodBrand: data.payment_method_brand,
        paymentMethodLast4: data.payment_method_last4,
        paymentMethodExpMonth: data.payment_method_exp_month,
        paymentMethodExpYear: data.payment_method_exp_year,
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