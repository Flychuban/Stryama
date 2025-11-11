import * as React from 'react';

import { cn } from '@/lib/utils';

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    autoGrow?: boolean;
    minHeight?: number;
    maxHeight?: number;
  };

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, autoGrow = false, minHeight = 80, maxHeight = 400, ...props },
    ref
  ) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);

    const adjustHeight = React.useCallback(
      (element: HTMLTextAreaElement) => {
        if (!autoGrow) return;

        // Reset height to auto to get the correct scrollHeight
        element.style.height = 'auto';

        // Calculate new height within min/max constraints
        const newHeight = Math.min(
          Math.max(element.scrollHeight, minHeight),
          maxHeight
        );

        element.style.height = `${newHeight}px`;

        // Add overflow-y when content exceeds maxHeight
        if (element.scrollHeight > maxHeight) {
          element.style.overflowY = 'auto';
        } else {
          element.style.overflowY = 'hidden';
        }
      },
      [autoGrow, minHeight, maxHeight]
    );

    // Adjust height on mount and when value changes
    React.useEffect(() => {
      const element =
        (ref && 'current' in ref ? ref.current : null) ?? internalRef.current;
      if (element) {
        adjustHeight(element);
      }
    }, [props.value, adjustHeight, ref]);

    // Handle onChange to adjust height immediately
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      props.onChange?.(e);
      adjustHeight(e.target);
    };

    return (
      <textarea
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          autoGrow ? 'resize-none' : 'min-h-[80px]',
          className
        )}
        style={
          autoGrow
            ? { minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }
            : undefined
        }
        ref={ref ?? internalRef}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
