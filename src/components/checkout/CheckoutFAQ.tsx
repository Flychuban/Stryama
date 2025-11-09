'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'Can I change my plan later?',
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect at the start of your next billing cycle.",
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor Clerk. Your payment information is encrypted and never stored on our servers.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer:
      "Absolutely! There are no long-term commitments. You can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your current billing period.",
  },
  {
    question: 'What happens when I reach my generation limit?',
    answer:
      "When you reach your monthly AI generation limit, you'll be prompted to upgrade to a higher plan. Your existing projects remain accessible, but you won't be able to create new AI generations until your limit resets or you upgrade.",
  },
  {
    question: 'Do you offer refunds?',
    answer:
      "Yes, we offer a 30-day money-back guarantee. If you're not satisfied with Stryama for any reason within the first 30 days, contact our support team for a full refund.",
  },
  {
    question: "What's the difference between Haiku and Sonnet models?",
    answer:
      'Haiku is our fast AI model, perfect for quick iterations and simple tasks. Sonnet is more powerful and provides higher quality code generation for complex projects. Builder and Pro plans include both, with smart routing to use the best model for each task.',
  },
  {
    question: 'How does the E2B sandbox work?',
    answer:
      'E2B sandbox provides isolated environments for your projects to run and test code safely. Different plans have different timeout limits: Starter (10min), Builder (30min), and Pro (2hr), allowing you to work on increasingly complex projects.',
  },
  {
    question: 'Can I use Stryama for commercial projects?',
    answer:
      'Yes! All plans, including the free Starter plan, can be used for commercial projects. There are no restrictions on how you use the applications you build with Stryama.',
  },
];

function FAQItemComponent({ faq }: { faq: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4 text-left backdrop-blur-sm transition-all hover:border-border hover:bg-muted/30">
        <span className="font-medium">{faq.question}</span>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pt-2">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {faq.answer}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CheckoutFAQ() {
  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl">Frequently Asked Questions</CardTitle>
        <CardDescription>
          Everything you need to know about our plans and pricing
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <FAQItemComponent key={idx} faq={faq} />
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-6 text-center backdrop-blur-sm">
          <h3 className="mb-2 font-semibold">Still have questions?</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Our team is here to help you find the perfect plan for your needs
          </p>
          <a
            href="mailto:support@stryama.com"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-6 py-2 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            Contact Support
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
