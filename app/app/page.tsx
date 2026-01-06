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
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchJobs();

    // 开启 Supabase 实时推送
    const channel = supabase.channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => fetchJobs())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async () => {
    if (!resume.trim()) return toast.error("请输入简历内容");
    setLoading(true);
    try {
      await analyzeResume({ resumeText: resume, position, userId: user.id });
      toast.success("任务已提交，Gemini 2.5 Flash 正在快速处理...");
      setResume("");
      fetchJobs(); // 手动保底刷新
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
              <CardDescription>由 Gemini 2.5 Flash 提供毫秒级分析支持</CardDescription>
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
              <Card key={job.id} className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4">
                  <div className="flex justify-between mb-4">
                    <span className="font-bold">{job.position}</span>
                    <Badge variant={job.status === "done" ? "default" : "secondary"}>
                      {job.status === "processing" ? "Flash 正在扫描..." : job.status}
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
                  ) : job.status === "processing" && (
                    <div className="text-center py-4 text-zinc-400 animate-pulse">AI 正在深度分析中...</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}