"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner"; 
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // 1. 尝试登录
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // 2. 如果登录失败（通常是账号不存在），尝试自动注册
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (signUpError) {
        // 如果是真正的错误（如密码太短），显示错误信息
        toast.error("认证失败", { description: signUpError.message });
      } else if (signUpData.session) {
        // ⭐ 关键改进：如果关闭了邮件验证，signUp 会立即返回 session
        // 意味着账号创建的同时已经登录成功，直接跳转
        toast.success("账号已创建并自动登录！");
        router.push("/app"); 
        router.refresh(); 
      } else {
        // 极端兜底逻辑：如果后台配置未生效导致没有 session
        toast.info("账号已创建", { description: "请尝试再次输入密码登录。" });
      }
    } else if (signInData.session) {
      // 3. 已经是老用户，登录成功直接跳转
      toast.success("欢迎回来！");
      router.push("/app"); 
      router.refresh(); 
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
              {loading ? "正在进入系统..." : "进入系统"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}