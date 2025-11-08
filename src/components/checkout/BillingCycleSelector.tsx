'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { type BillingCycle } from '@/types';
import { calculateAnnualPrice, calculateAnnualSavings } from '@/types/pricing';

interface BillingCycleSelectorProps {
  selectedCycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  monthlyPrice: number;
}

export function BillingCycleSelector({
  selectedCycle,
  onCycleChange,
  monthlyPrice,
}: BillingCycleSelectorProps) {
  const annualPrice = calculateAnnualPrice(monthlyPrice);
  const savings = calculateAnnualSavings(monthlyPrice);
  const monthlyAnnualPrice = Math.floor(annualPrice / 12);

  return (
    <div>
      <Label className="mb-4 block text-base font-semibold">
        Billing Cycle
      </Label>
      <RadioGroup
        value={selectedCycle}
        onValueChange={(value) => onCycleChange(value as BillingCycle)}
      >
        <div className="space-y-3">
          {/* Monthly Option */}
          <div
            className={`relative flex cursor-pointer items-center space-x-3 rounded-lg border-2 p-4 transition-all ${
              selectedCycle === 'monthly'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="monthly" id="monthly" />
            <Label htmlFor="monthly" className="flex-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Monthly</div>
                  <div className="text-sm text-muted-foreground">
                    ${monthlyPrice}/month
                  </div>
                </div>
              </div>
            </Label>
          </div>

          {/* Annual Option */}
          <div
            className={`relative flex cursor-pointer items-center space-x-3 rounded-lg border-2 p-4 transition-all ${
              selectedCycle === 'annual'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="annual" id="annual" />
            <Label htmlFor="annual" className="flex-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    Annual
                    <Badge variant="secondary" className="bg-accent text-white">
                      Save ${savings}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ${monthlyAnnualPrice}/month (${annualPrice}/year)
                  </div>
                </div>
              </div>
            </Label>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
