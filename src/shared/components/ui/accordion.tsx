import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/shared/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    headerAccessory?: React.ReactNode;
    headerClassName?: string;
  }
>(({ className, children, headerAccessory, headerClassName, ...props }, ref) => {
  const innerRef = React.useRef<HTMLButtonElement>(null);
  const setRefs = (node: HTMLButtonElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <AccordionPrimitive.Header className={cn("flex items-center", headerClassName)}>
      <AccordionPrimitive.Trigger
        ref={setRefs}
        className={cn(
          "flex min-w-0 flex-1 items-center py-4 text-left font-medium transition-all duration-300 ease-smooth hover:underline motion-reduce:duration-150 [&[data-state=open]>svg]:rotate-180",
          headerAccessory ? "peer justify-start" : "justify-between",
          className,
        )}
        {...props}
      >
        {children}
        {headerAccessory ? null : (
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-300 ease-smooth motion-reduce:duration-150" />
        )}
      </AccordionPrimitive.Trigger>
      {headerAccessory}
      {headerAccessory ? (
        <span
          aria-hidden
          className="ml-2 inline-flex shrink-0 cursor-pointer items-center peer-data-[state=open]:[&>svg]:rotate-180"
          onClick={() => innerRef.current?.click()}
        >
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-300 ease-smooth motion-reduce:duration-150" />
        </span>
      ) : null}
    </AccordionPrimitive.Header>
  );
});
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & {
    primitiveClassName?: string;
  }
>(({ className, primitiveClassName, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      primitiveClassName,
    )}
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
