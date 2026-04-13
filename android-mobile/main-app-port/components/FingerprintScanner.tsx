import { Fingerprint } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export const FingerprintScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  const handleScan = () => {
    setIsScanning(true);
    
    // Simulate fingerprint scanning
    setTimeout(() => {
      setIsScanning(false);
      toast({
        title: "Absensi Berhasil",
        description: "Sidik jari berhasil diverifikasi",
        className: "bg-success text-success-foreground"
      });
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center py-8">
      <button
        onClick={handleScan}
        disabled={isScanning}
        className={`relative p-8 rounded-full transition-all duration-300 ${
          isScanning 
            ? 'bg-primary/20 scale-110' 
            : 'bg-card hover:bg-muted active:scale-95'
        } shadow-floating border border-border`}
      >
        <Fingerprint 
          className={`h-20 w-20 transition-all duration-300 ${
            isScanning 
              ? 'text-primary animate-pulse' 
              : 'text-muted-foreground'
          }`} 
        />
        
        {isScanning && (
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        )}
      </button>
      
      <p className="text-sm text-muted-foreground mt-4 text-center">
        {isScanning ? 'Memindai sidik jari...' : 'Sentuh untuk memindai sidik jari'}
      </p>
    </div>
  );
};