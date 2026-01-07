"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { analyzeResume } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, History, LogOut } from "lucide-react";

export default function AppPage() {
  const [user, setUser] = useState<any>(null);
  const [resume, setResume] = useState("");
  const [position, setPosition] = useState("前端工程师");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (data) setJobs(data);
  };

  useEffect(() => {
    // 1. 获取当前登录用户
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchJobs();
  
    // 2. 建立实时订阅并打印日志
    console.log(">>> [调试] 正在初始化 Supabase 实时订阅...");
  
    const channel = supabase
      .channel("jobs_realtime")
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", // 核心：监听 AI 回写导致的更新
          schema: "public", 
          table: "jobs" 
        },
        (payload) => {
          // ⭐ 如果开启成功，提交简历后这里会疯狂跳出日志
          console.log(">>> [核心调试] 实时更新送达！新数据如下:", payload.new);
          
          setJobs((currentJobs) =>
            currentJobs.map((job) => (job.id === payload.new.id ? payload.new : job))
          );
        }
      )
      .subscribe((status) => {
        // 查看订阅是否成功连接 (应该是 'SUBSCRIBED')
        console.log(">>> [调试] 订阅连接状态:", status);
      });
  
    return () => {
      console.log(">>> [调试] 页面卸载，正在销毁订阅...");
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async () => {
    if (!resume.trim()) return toast.error("请输入简历内容");
    setLoading(true);
    
    try {
      // 1. 调用后端接口并获取分配的 ID
      const { jobId } = await analyzeResume({ resumeText: resume, position, userId: user.id });

      // 2. ⭐ 占位逻辑：立即向本地列表插入一个“处理中”的假卡片
      const placeholderCard = {
        id: jobId,
        position: position,
        status: "processing", // 触发 UI 的加载动画
        created_at: new Date().toISOString(),
      };
      
      setJobs((prev) => [placeholderCard, ...prev]);
      
      toast.success("提交成功，AI 正在扫描...");
      setResume(""); // 清空输入框
      
    } catch (e) {
      toast.error("提交失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-10 p-4 flex justify-between">
        <h1 className="font-bold text-xl text-blue-600">Resume AI Scanner</h1>
        <Button variant="ghost" size="sm" onClick={() => { supabase.auth.signOut(); window.location.href = "/"; }}>
          <LogOut className="w-4 h-4 mr-2" /> 退出
        </Button>
      </nav>

      <main className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左侧控制区 */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>开始分析</CardTitle>
              <CardDescription>提交后卡片将立即出现并由 AI 实时分析</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="前端工程师">前端工程师</SelectItem>
                  <SelectItem value="产品经理">产品经理</SelectItem>
                  <SelectItem value="数据分析师">数据分析师</SelectItem>
                </SelectContent>
              </Select>
              <Textarea 
                placeholder="粘贴简历内容..." 
                className="min-h-[400px]" 
                value={resume}
                onChange={(e) => setResume(e.target.value)}
              />
              <Button className="w-full" onClick={handleSubmit} disabled={loading}>
                {loading ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                提交给 AI 扫描
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧结果区 */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-bold flex items-center gap-2"><History /> 分析历史</h2>
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
            {jobs.map((job) => (
              <Card key={job.id} className={`border-l-4 ${job.status === 'processing' ? 'border-l-zinc-300 animate-pulse' : 'border-l-blue-500'}`}>
                <CardContent className="pt-4">
                  <div className="flex justify-between mb-4">
                    <span className="font-bold">{job.position}</span>
                    <Badge variant={job.status === "done" ? "default" : "secondary"}>
                      {job.status === "processing" ? "AI 正在分析..." : job.status}
                    </Badge>
                  </div>

                  {job.status === "done" && job.result ? (
                    <div className="space-y-2 text-sm">
                      <div className="p-2 bg-green-50 text-green-700 rounded border border-green-100">
                        建议面试：{job.result.hire_recommendation.toUpperCase()}
                      </div>
                      <div className="p-2 bg-red-50 text-red-700 rounded border border-red-100">
                        风险提示：
                        <ul className="list-disc pl-4">{job.result.risks.map((r: any, i: number) => <li key={i}>{r}</li>)}</ul>
                      </div>
                    </div>
                  ) : job.status === "processing" ? (
                    <div className="flex items-center justify-center py-6 text-zinc-400">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      <span>正在调用 Gemini 后台解析，请稍候...</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}