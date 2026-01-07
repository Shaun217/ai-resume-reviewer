"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { analyzeResume } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, History, LogOut, CheckCircle2 } from "lucide-react";

export default function AppPage() {
  const [user, setUser] = useState<any>(null);
  const [resume, setResume] = useState("");
  const [position, setPosition] = useState("数据分析师");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 只拉取包含有效结果的记录
  const fetchJobs = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .not("result", "is", null) // 核心过滤：没结果的不显示
      .order("created_at", { ascending: false });
    if (data) setJobs(data);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchJobs();

    // 实时订阅：当后台更新结果时，自动刷新列表
    const channel = supabase.channel("jobs_sync")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs" }, () => {
        fetchJobs(); 
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async () => {
    if (!resume.trim()) return toast.error("请输入简历内容");
    
    setLoading(true);
    
    try {
      // 等待后端 Gemini 2.5 Flash 完成所有分析并回写数据库
      await analyzeResume({ resumeText: resume, position, userId: user.id });
      
      toast.success("分析成功！");
      setResume("");
      fetchJobs(); // 分析完立刻刷新列表
    } catch (e) {
      console.error(e);
      toast.error("服务繁忙，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white p-4 flex justify-between items-center shadow-sm">
        <h1 className="font-bold text-xl text-zinc-900 flex items-center gap-2">
          <div className="w-2 h-6 bg-blue-600 rounded-full" /> AI Resume Reviewer
        </h1>
        <Button variant="ghost" size="sm" onClick={() => { supabase.auth.signOut(); window.location.href = "/"; }}>
          <LogOut className="w-4 h-4 mr-2" /> 退出
        </Button>
      </nav>

      <main className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左侧控制区 */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>简历分析</CardTitle>
              <CardDescription>粘贴文本，获取由 Gemini 驱动的即时反馈</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="前端工程师">前端工程师</SelectItem>
                  <SelectItem value="产品经理">产品经理</SelectItem>
                  <SelectItem value="数据分析师">数据分析师</SelectItem>
                </SelectContent>
              </Select>
              <Textarea 
                placeholder="在此粘贴简历全文内容..." 
                className="min-h-[400px] bg-zinc-50/50" 
                value={resume}
                onChange={(e) => setResume(e.target.value)}
              />
              <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg" onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" />
                    正在分析...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 w-5 h-5" />
                    开始分析
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧结果区 */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-bold text-zinc-500 flex items-center gap-2 uppercase tracking-wider text-sm">
            <History className="w-4 h-4" /> 分析历史
          </h2>
          <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 pb-10">
            {jobs.map((job) => (
              <Card key={job.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-bold text-xl text-zinc-800">{job.position}</h3>
                      <p className="text-xs text-zinc-400">{new Date(job.created_at).toLocaleDateString()} 分析完成</p>
                    </div>
                    <CheckCircle2 className="text-green-500 w-6 h-6" />
                  </div>

                  {/* 直接展示结果，不再显示任何状态标签 */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 bg-zinc-50 rounded-xl">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">录取建议</p>
                      <p className={`text-xl font-bold ${job.result.hire_recommendation === 'yes' ? 'text-green-600' : 'text-zinc-600'}`}>
                        {job.result.hire_recommendation === 'yes' ? '✅ 建议安排面试' : '⚪ 暂不匹配岗位'}
                      </p>
                    </div>
                    
                    <div className="p-4 bg-zinc-50 rounded-xl">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">AI 评价风险点</p>
                      <ul className="space-y-2">
                        {job.result.risks.map((r: string, i: number) => (
                          <li key={i} className="text-sm text-zinc-600 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full mt-1.5 shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {jobs.length === 0 && !loading && (
              <div className="text-center py-24 text-zinc-300 border-2 border-dashed rounded-2xl">
                暂无分析结果
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}