"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { analyzeResume } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, History, LogOut, CheckCircle2, ChevronDown, ChevronUp, PlusCircle, Trash2 } from "lucide-react";

export default function AppPage() {
  const [user, setUser] = useState<any>(null);
  const [resume, setResume] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // ⭐ 新增：岗位配置相关状态
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileReq, setNewProfileReq] = useState("");

  const fetchJobs = async () => {
    const { data } = await supabase.from("jobs").select("*").not("result", "is", null).order("created_at", { ascending: false });
    if (data) setJobs(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("job_profiles").select("*").order("created_at", { ascending: false });
    if (data) setProfiles(data);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      fetchProfiles();
      fetchJobs();
    });
  }, []);

  // 保存新岗位配置
  const handleSaveProfile = async () => {
    if (!newProfileName || !newProfileReq) return toast.error("请填写完整岗位信息");
    const { data, error } = await supabase.from("job_profiles").insert([
      { name: newProfileName, requirements: newProfileReq, user_id: user.id }
    ]).select().single();

    if (error) return toast.error("保存失败");
    setProfiles([data, ...profiles]);
    setIsAddingProfile(false);
    setNewProfileName("");
    setNewProfileReq("");
    toast.success("岗位模板已保存");
  };

  const handleSubmit = async () => {
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
    if (!selectedProfile) return toast.error("请选择一个岗位模板");
    if (!resume.trim()) return toast.error("请粘贴简历内容");

    setLoading(true);
    try {
      await analyzeResume({ 
        resumeText: resume, 
        position: selectedProfile.name, 
        jobRequirements: selectedProfile.requirements, // 传入 JD
        userId: user.id 
      });
      toast.success("分析完成");
      setResume("");
      fetchJobs();
    } catch (e) {
      toast.error("分析失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white p-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <h1 className="font-bold text-xl flex items-center gap-2">
          <div className="w-2 h-6 bg-blue-600 rounded-full" /> AI Resume Reviewer <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded ml-2">Enterprise</span>
        </h1>
        <Button variant="ghost" size="sm" onClick={() => { supabase.auth.signOut(); window.location.href = "/"; }}>
          <LogOut className="w-4 h-4 mr-2" /> 退出
        </Button>
      </nav>

      <main className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左侧：配置与上传 */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. 岗位管理模块 */}
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-zinc-900 text-white pb-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">岗位画像定义</CardTitle>
                <Button variant="outline" size="sm" className="text-zinc-900 border-white hover:bg-white/10" onClick={() => setIsAddingProfile(!isAddingProfile)}>
                  {isAddingProfile ? "取消" : "新增岗位"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {isAddingProfile ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <input 
                    placeholder="岗位名称 (如: 高级数据分析师)" 
                    className="w-full p-2 border rounded text-sm"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                  />
                  <Textarea 
                    placeholder="输入该岗位的核心要求 (JD)..." 
                    className="h-32 text-sm"
                    value={newProfileReq}
                    onChange={(e) => setNewProfileReq(e.target.value)}
                  />
                  <Button className="w-full bg-zinc-800" onClick={handleSaveProfile}>保存此岗位模板</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="选择已有的岗位模板" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedProfileId && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                      <strong>当前 JD 重点：</strong>
                      <p className="line-clamp-3 mt-1 opacity-80">{profiles.find(p => p.id === selectedProfileId)?.requirements}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. 简历上传模块 */}
          <Card className="border-none shadow-md">
            <CardHeader><CardTitle className="text-lg">简历原文</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="在此粘贴简历全文..." 
                className="h-[300px] bg-zinc-50/50 resize-none text-sm"
                value={resume}
                onChange={(e) => setResume(e.target.value)}
              />
              <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold" onClick={handleSubmit} disabled={loading || !selectedProfileId}>
                {loading ? <><Loader2 className="mr-2 animate-spin" />正在深度对标...</> : <><Send className="mr-2 w-5 h-5" />开始对标分析</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：分析历史 (逻辑与之前一致，略作视觉优化) */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-bold text-zinc-500 flex items-center gap-2 uppercase tracking-wider text-sm"><History className="w-4 h-4" /> 对标历史</h2>
          <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 pb-10">
            {jobs.map((job) => {
              const isHero = job.result?.hire_recommendation === 'yes';
              const isExpanded = expandedIds.has(job.id);
              return (
                <Card key={job.id} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden">
                   {/* 此处保留你上一版中带有 Highlights 和 Risks 的渲染逻辑 */}
                   {/* ... 卡片内部渲染 ... */}
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}