import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { CheckoutPageClient } from './checkout-client';

export default async function CheckoutPage() {
  // Verify user is authenticated
  const { userId } = await auth();

  // Redirect to sign-in if not authenticated
  if (!userId) {
    redirect('/sign-in?redirect_url=/checkout');
  }

  return <CheckoutPageClient />;
}
