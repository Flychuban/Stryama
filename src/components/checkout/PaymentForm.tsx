'use client';

import { useState } from 'react';
import { CreditCard, Lock } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { type BillingCycle } from '@/types';
import { getDisplayPrice } from '@/types/pricing';

interface PaymentFormProps {
  monthlyPrice: number;
  billingCycle: BillingCycle;
}

export function PaymentForm({ monthlyPrice, billingCycle }: PaymentFormProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const finalPrice = getDisplayPrice(monthlyPrice, billingCycle);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // TODO: Integrate with Clerk Billing
    // When ready to integrate:
    // 1. Install @clerk/clerk-react or use Clerk's built-in <PricingTable /> component
    // 2. Create a subscription using Clerk's API:
    //    const { user } = useUser();
    //    await clerk.subscriptions.create({
    //      planId: 'pro', // or 'enterprise'
    //      cycle: billingCycle,
    //    });
    // 3. Handle success/error states
    // 4. Redirect to dashboard on success

    console.log(
      'Payment submission prevented - Clerk Billing not yet configured'
    );
    alert(
      'Payment integration pending. Please configure Clerk Billing in your dashboard.'
    );
  };

  return (
    <div>
      {/* Payment Form Card */}
      <Card className="sticky top-24 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Details
          </CardTitle>
          <CardDescription>
            Enter your payment information securely
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Card Number */}
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                maxLength={19}
                required
                className="h-12 text-lg"
              />
            </div>

            {/* Cardholder Name */}
            <div className="space-y-2">
              <Label htmlFor="cardName">Cardholder Name</Label>
              <Input
                id="cardName"
                type="text"
                placeholder="John Doe"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                required
                className="h-12"
              />
            </div>

            {/* Expiry and CVC */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cardExpiry">Expiry Date</Label>
                <Input
                  id="cardExpiry"
                  type="text"
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  maxLength={5}
                  required
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardCvc">CVC</Label>
                <Input
                  id="cardCvc"
                  type="text"
                  placeholder="123"
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value)}
                  maxLength={4}
                  required
                  className="h-12"
                />
              </div>
            </div>

            <Separator />

            {/* Submit Button */}
            <Button
              type="submit"
              className="h-12 w-full bg-gradient-to-r from-primary to-accent text-base text-white hover:shadow-lg hover:shadow-primary/25"
            >
              <Lock className="mr-2 h-4 w-4" />
              Pay ${finalPrice} Securely
            </Button>

            {/* Terms Text */}
            <p className="text-center text-xs text-muted-foreground">
              By confirming your subscription, you allow Stryama to charge your
              card for this payment and future payments in accordance with their
              terms. You can cancel anytime.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
