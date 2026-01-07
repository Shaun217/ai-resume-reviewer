"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { analyzeResume } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, History, LogOut, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

export default function AppPage() {
  const [user, setUser] = useState<any>(null);
  const [resume, setResume] = useState("");
  const [position, setPosition] = useState("数据分析师");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ⭐ 新增：记录展开状态的 ID 集合
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newIds = new Set(expandedIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    setExpandedIds(newIds);
  };

  const fetchJobs = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .not("result", "is", null)
      .order("created_at", { ascending: false });
    if (data) setJobs(data);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchJobs();

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
      await analyzeResume({ resumeText: resume, position, userId: user.id });
      toast.success("分析成功！");
      setResume("");
      fetchJobs(); 
    } catch (e) {
      console.error(e);
      toast.error("服务繁忙，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <nav className="border-b bg-white p-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <h1 className="font-bold text-xl flex items-center gap-2">
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
              <CardDescription>粘贴文本，获取即时反馈</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="前端工程师">前端工程师</SelectItem>
                  <SelectItem value="产品经理">产品经理</SelectItem>
                  <SelectItem value="数据分析师">数据分析师</SelectItem>
                </SelectContent>
              </Select>
              
              <Textarea 
                placeholder="在此粘贴简历全文内容..." 
                className="h-[400px] bg-zinc-50/50 resize-none font-sans text-sm" 
                value={resume}
                onChange={(e) => setResume(e.target.value)}
              />
              
              <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold" onClick={handleSubmit} disabled={loading}>
                {loading ? <><Loader2 className="mr-2 animate-spin" />分析中...</> : <><Send className="mr-2 w-5 h-5" />开始分析</>}
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
            {jobs.map((job) => {
              const isHero = job.result?.hire_recommendation === 'yes';
              const isExpanded = expandedIds.has(job.id);
              
              return (
                <Card key={job.id} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-bold text-xl text-zinc-800">{job.position}</h3>
                        <p className="text-xs text-zinc-400">{new Date(job.created_at).toLocaleDateString()} 完成</p>
                      </div>
                      <CheckCircle2 className={isHero ? "text-green-500 w-6 h-6" : "text-zinc-300 w-6 h-6"} />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {/* 录取建议 */}
                      <div className={`p-5 rounded-2xl border ${
                        isHero ? 'bg-green-50/50 border-green-100 text-green-900' : 'bg-red-50/50 border-red-100 text-red-900'
                      }`}>
                        <p className="text-[10px] font-bold uppercase mb-1 opacity-60 tracking-wider">录取建议</p>
                        <p className="text-2xl font-black mb-4">
                          {isHero ? '建议安排面试' : '暂不匹配岗位'}
                        </p>
                        
                        {/* 简历亮点 */}
                        {job.result?.highlights && (
                          <div className={`pt-4 border-t ${isHero ? 'border-green-200' : 'border-red-200'}`}>
                            <p className="text-[10px] font-bold uppercase mb-2 opacity-60 tracking-wider">简历亮点</p>
                            <ul className="space-y-1.5 text-sm font-medium">
                              {job.result.highlights.map((h: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isHero ? 'bg-green-500' : 'bg-red-500'}`} />
                                  {h}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      {/* 风险点 */}
                      <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-3 tracking-wider">AI 评价风险点</p>
                        <ul className="space-y-2 text-sm text-zinc-600">
                          {job.result?.risks?.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full mt-1.5 shrink-0" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* ⭐ 新增：折叠原文区域 */}
                      <div className="border-t pt-2">
                        <button 
                          onClick={() => toggleExpand(job.id)}
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-blue-600 transition-colors py-2"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? "隐藏简历原文" : "查看简历原文"}
                        </button>
                        
                        {isExpanded && (
                          <div className="mt-2 p-4 bg-zinc-100/50 rounded-lg text-xs text-zinc-500 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                            {job.resume_text}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}