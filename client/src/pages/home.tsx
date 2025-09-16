import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

export default function Home() {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    // Initial state for fade-in animation
    main.style.opacity = '0';
    main.style.transform = 'translateY(20px)';
    main.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';

    // Trigger animation after a short delay
    const timer = setTimeout(() => {
      main.style.opacity = '1';
      main.style.transform = 'translateY(0)';
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <main 
      ref={mainRef}
      className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground"
      data-testid="main-greeting-page"
    >
      <div className="text-center space-y-6 max-w-2xl mx-auto">
        <Card className="bg-card border border-border rounded-lg p-12 shadow-sm hover:shadow-md transition-shadow duration-200">
          {/* Main greeting text */}
          <h1 
            className="text-6xl md:text-7xl lg:text-8xl font-light text-foreground tracking-tight leading-none"
            data-testid="text-greeting"
          >
            merhaba
          </h1>
          
          {/* Subtle decorative element */}
          <div className="mt-8 flex justify-center">
            <div 
              className="w-16 h-0.5 bg-primary rounded-full"
              data-testid="decorative-line"
            ></div>
          </div>
          
          {/* Additional context */}
          <p 
            className="mt-6 text-muted-foreground text-lg font-light"
            data-testid="text-welcome"
          >
            Hoş geldiniz
          </p>

          {/* Navigation Links */}
          <div className="mt-8 flex gap-4 justify-center">
            <Link 
              to="/products/grid"
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              data-testid="link-products-grid"
            >
              Ürün Grid Editörü
            </Link>
            <Link 
              to="/import-export"
              className="inline-flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
              data-testid="link-import-export"
            >
              Import/Export
            </Link>
          </div>
        </Card>
        
        {/* Footer information */}
        <footer className="text-center">
          <p 
            className="text-sm text-muted-foreground"
            data-testid="text-footer"
          >
            Simple HTML sayfası
          </p>
        </footer>
      </div>
    </main>
  );
}
