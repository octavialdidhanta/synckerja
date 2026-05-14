
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "@/shared/components/ui/use-toast";

interface SetPasswordFormProps {
  token: string;
  email: string;
  fullName: string;
  organizationId?: string;
  onSuccess: () => void;
}

export const SetPasswordForm = ({ token, email, fullName, organizationId, onSuccess }: SetPasswordFormProps) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Password tidak cocok",
        description: "Pastikan kedua password yang dimasukkan sama.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password terlalu pendek",
        description: "Password harus minimal 6 karakter.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 SetPasswordForm: Starting password setup process');
      
      // Call edge function to handle complete password setup
      const { data, error } = await supabase.functions.invoke('complete-magic-link-setup', {
        body: { 
          token, 
          password, 
          email, 
          fullName 
        }
      });

      console.log('📋 SetPasswordForm: Edge function response:', data);

      if (error) {
        console.error('❌ SetPasswordForm: Edge function error:', error);
        throw new Error((data as any)?.error || error.message || 'Terjadi kesalahan saat mengatur password');
      }

      if (!data || !data.success) {
        console.error('❌ SetPasswordForm: Invalid response from edge function');
        throw new Error(data?.error || 'Gagal mengatur password');
      }

      console.log('✅ SetPasswordForm: Password setup completed successfully');
      
      toast({
        title: "Berhasil!",
        description: "Password berhasil diatur. Anda sekarang dapat login.",
      });

      onSuccess();

    } catch (error) {
      console.error('💥 SetPasswordForm: Error:', error);
      toast({
        title: "Gagal mengatur password",
        description: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak terduga.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <Card className="w-full max-w-md shadow border rounded-2xl bg-white">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Atur Password Anda
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Selamat datang, {fullName}! Silakan buat password untuk akun Anda.
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <Label htmlFor="password">Password Baru</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password baru"
                  className="pr-10"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Konfirmasi password baru"
                  className="pr-10"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold bg-[#181E29] hover:bg-[#222b3c]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mengatur Password...</span>
                </div>
              ) : (
                "Atur Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
