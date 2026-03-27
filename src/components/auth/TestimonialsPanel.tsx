import { useState, useEffect } from "react";

const testimonials = [
  {
    quote: "This platform completely transformed how we onboard new team members. Setup took minutes, not days.",
    author: "Sarah Chen",
    role: "VP of Engineering",
    company: "Arclight Systems",
  },
  {
    quote: "The best developer experience I've encountered. It feels like the tool was built by people who actually ship software.",
    author: "Marcus Rivera",
    role: "CTO",
    company: "Threadline",
  },
  {
    quote: "We cut our deployment time by 80%. The team hasn't looked back since switching over.",
    author: "Priya Sharma",
    role: "Lead Developer",
    company: "Novalith",
  },
];

export const TestimonialsPanel = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const t = testimonials[active];

  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-auth-panel p-12 xl:p-16 relative overflow-hidden">
      {/* Subtle gradient orb */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />

      {/* Logo / Brand */}
      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">L</span>
          </div>
          <span className="text-auth-panel-foreground font-semibold text-lg tracking-tight">Lovable</span>
        </div>
      </div>

      {/* Testimonial */}
      <div className="relative z-10 space-y-8">
        <blockquote className="text-2xl xl:text-3xl font-light leading-relaxed text-auth-panel-foreground tracking-tight">
          "{t.quote}"
        </blockquote>
        <div>
          <p className="text-auth-panel-foreground font-medium">{t.author}</p>
          <p className="text-auth-panel-muted text-sm">
            {t.role}, {t.company}
          </p>
        </div>

        {/* Dots */}
        <div className="flex gap-2">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === active
                  ? "w-8 bg-primary"
                  : "w-1.5 bg-auth-panel-muted"
              }`}
              aria-label={`Show testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 text-auth-panel-muted text-xs">
        Trusted by 10,000+ teams worldwide
      </p>
    </div>
  );
};
