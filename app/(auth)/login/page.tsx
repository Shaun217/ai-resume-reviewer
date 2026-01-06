"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner"; // 使用我们刚安装的 Sonner
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // 尝试登录
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 如果登录失败，尝试自动注册（MVP 极速逻辑）
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (signUpError) {
        toast.error("认证失败", { description: signUpError.message });
      } else {
        toast.success("注册成功！", { description: "请查看邮箱确认或直接尝试再次登录。" });
      }
    } else {
      toast.success("登录成功！");
      router.push("/app"); // 登录成功跳转到功能页
      router.refresh(); // 刷新路由状态
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50/50 p-4">
      <Card className="w-full max-w-[400px] shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">AI 简历助手</CardTitle>
          <CardDescription className="text-center">
            输入邮箱即可登录或创建账号
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input 
                type="email" 
                placeholder="name@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Input 
                type="password" 
                placeholder="密码 (至少6位)" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "请稍候..." : "进入系统"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}






