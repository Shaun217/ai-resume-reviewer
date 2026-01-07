"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { analyzeResume } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, History, LogOut, CheckCircle2, XCircle, ChevronDown, ChevronUp, PlusCircle, Target, FileText, Edit3, Sparkles, Cpu, User, Trash2, FileSearch } from "lucide-react";

export default function AppPage() {
  const [user, setUser] = useState<any>(null);
  const [resume, setResume] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 岗位配置状态
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileReq, setNewProfileReq] = useState("");

  // 删除状态
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    const newIds = new Set(expandedIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    setExpandedIds(newIds);
  };

  const fetchJobs = async () => {
    const { data } = await supabase.from("jobs").select("*").not("result", "is", null).order("created_at", { ascending: false });
    if (data) setJobs(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("job_profiles").select("*").order("created_at", { ascending: false });
    if (data) setProfiles(data);
  };

  // 核心功能：编辑模式
  const startEditing = (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (profile) {
      setEditingProfileId(profile.id);
      setNewProfileName(profile.name);
      setNewProfileReq(profile.requirements);
      setIsAddingProfile(true);
    }
  };

  // 核心功能：物理删除
  const executeDelete = async (id: string) => {
    const previousJobs = [...jobs];
    setJobs(jobs.filter(j => j.id !== id));
    setDeletingId(null);
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) {
      setJobs(previousJobs);
      toast.error("删除失败");
    } else {
      toast.success("记录已永久删除");
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        fetchProfiles();
        fetchJobs();
      }
    });

    const channel = supabase.channel("jobs_realtime_sync").on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => fetchJobs()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSaveProfile = async () => {
    if (!newProfileName || !newProfileReq) return toast.error("请填写完整信息");
    if (editingProfileId) {
      const { error } = await supabase.from("job_profiles").update({ name: newProfileName, requirements: newProfileReq }).eq("id", editingProfileId);
      if (error) return toast.error("更新失败");
      toast.success("岗位画像已更新");
    } else {
      const { data, error } = await supabase.from("job_profiles").insert([{ name: newProfileName, requirements: newProfileReq, user_id: user.id }]).select().single();
      if (error) return toast.error("保存失败");
      setProfiles([data, ...profiles]);
      toast.success("岗位画像已保存");
    }
    fetchProfiles();
    setIsAddingProfile(false);
    setEditingProfileId(null);
    setNewProfileName("");
    setNewProfileReq("");
  };

  const handleSubmit = async () => {
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
    if (!selectedProfile || !resume.trim()) return toast.error("请选择岗位并粘贴简历");
    setLoading(true);
    try {
      await analyzeResume({ resumeText: resume, position: selectedProfile.name, jobRequirements: selectedProfile.requirements, userId: user.id });
      toast.success("分析任务已提交");
      setResume("");
    } catch (e) {
      toast.error("提交失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      {/* 导航栏：仅更换图标 */}
      <nav className="border-b bg-white p-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <h1 className="font-bold text-xl flex items-center gap-2 text-zinc-900">
          <FileSearch className="w-6 h-6 text-blue-600" /> AI Resume Reviewer
        </h1>

        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-100 rounded-full">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <User className="w-3 h-3 text-blue-600" />
              </div>
              <span className="text-xs font-bold text-zinc-700 max-w-[250px] truncate">{user.email}</span>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="hover:bg-red-50 hover:text-red-600 transition-colors" 
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
          >
            <LogOut className="w-4 h-4 mr-2" /> 退出
          </Button>
        </div>
      </nav>

      <main className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 左侧控制区 */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border border-zinc-200/60 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-zinc-100 pb-4 bg-zinc-50/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-base font-bold text-zinc-800">岗位画像定义</CardTitle>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={() => { setIsAddingProfile(!isAddingProfile); setEditingProfileId(null); setNewProfileName(""); setNewProfileReq(""); }}>
                  {isAddingProfile ? "取消" : <PlusCircle className="w-4 h-4 mr-1" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isAddingProfile ? (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <input placeholder="岗位名称 (例如: Data Analyst)" className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} />
                  <Textarea placeholder="输入岗位要求..." className="h-32 text-sm bg-zinc-50 border-zinc-200" value={newProfileReq} onChange={(e) => setNewProfileReq(e.target.value)} />
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 h-11 font-bold" onClick={handleSaveProfile}>{editingProfileId ? "确认更新" : "保存画像"}</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                        <SelectTrigger className="h-11 border-zinc-200 w-full bg-white font-medium"><SelectValue placeholder="选择目标画像" /></SelectTrigger>
                        <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {selectedProfileId && (
                      <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 border-zinc-200 hover:text-blue-600 shadow-sm" onClick={() => startEditing(selectedProfileId)}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {selectedProfileId && (
                    <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-xl text-[11px] text-blue-700">
                      <p className="font-bold mb-1 flex items-center gap-1">核心要求预览：</p>
                      <p className="opacity-80 line-clamp-3 leading-relaxed italic">{profiles.find(p => p.id === selectedProfileId)?.requirements}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-zinc-200/60 shadow-sm bg-white">
            <CardHeader className="border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-zinc-600" />
                <CardTitle className="text-base font-bold text-zinc-800">简历原文内容</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Textarea placeholder="在此粘贴简历全文..." className="h-[400px] bg-zinc-50/50 resize-none text-sm border-zinc-200" value={resume} onChange={(e) => setResume(e.target.value)} />
              <Button className="w-full bg-zinc-900 hover:bg-zinc-800 h-12 text-lg font-black tracking-wide shadow-lg" onClick={handleSubmit} disabled={loading || !selectedProfileId}>
                {loading ? <><Loader2 className="mr-2 animate-spin" />ANALYZING...</> : <><Send className="mr-2 w-5 h-5" />EXECUTE ANALYSIS</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：分析历史 */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              <h2 className="font-bold text-zinc-500 uppercase tracking-widest text-[10px]">ANALYSIS HISTORY</h2>
            </div>
          </div>
          
          <div className="space-y-6 lg:h-[835px] overflow-y-auto pr-3 pb-10 custom-scrollbar scroll-smooth">
            {jobs.map((job) => {
              const res = job.result || {};
              const isMatch = res.hire_recommendation === 'yes';
              const isConfirming = deletingId === job.id;
              const isExpanded = expandedIds.has(job.id);

              return (
                <Card key={job.id} className={`group border shadow-sm transition-all duration-300 overflow-hidden relative ${isConfirming ? 'border-red-500 ring-2 ring-red-100 scale-[0.98]' : 'border-zinc-200/70 bg-white hover:shadow-md hover:-translate-y-1'}`}>
                  {/* 内联删除 */}
                  <div className="absolute top-4 right-4 z-10">
                    {isConfirming ? (
                      <div className="flex gap-1 animate-in slide-in-from-right-2">
                        <Button size="sm" variant="destructive" className="h-7 text-[10px] font-bold" onClick={() => executeDelete(job.id)}>确认删除</Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setDeletingId(null)}>取消</Button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingId(job.id)} className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <CardContent className={`pt-6 transition-opacity ${isConfirming ? 'opacity-40 grayscale' : 'opacity-100'}`}>
                    <div className="flex justify-between items-start mb-6 pr-12">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                          <h3 className="font-black text-lg text-zinc-800 uppercase tracking-tight">{job.position}</h3>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-mono">TS: {new Date(job.created_at).toLocaleString('zh-CN', { hour12: false })}</p>
                      </div>
                      <div className={`p-2 rounded-full ${isMatch ? 'bg-green-50' : 'bg-red-50'}`}>
                         {isMatch ? <CheckCircle2 className="text-green-500 w-5 h-5" /> : <XCircle className="text-red-500 w-5 h-5" />}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className={`p-5 rounded-2xl border transition-all duration-300 ${isMatch ? 'bg-green-50/40 border-green-100/50 text-green-900' : 'bg-red-50/40 border-red-100/50 text-red-900'}`}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-1 opacity-60">录取建议</p>
                        <p className="text-2xl font-black mb-4">{isMatch ? '✅ 建议安排面试' : '⚪ 暂不匹配岗位'}</p>
                        {(res.highlights || []).length > 0 && (
                          <div className={`pt-4 border-t ${isMatch ? 'border-green-200/50' : 'border-red-200/50'}`}>
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-2 opacity-60">{isMatch ? '核心匹配亮点' : '简历重点分析'}</p>
                            <ul className="space-y-2.5">
                              {res.highlights.map((h: string, i: number) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm font-semibold leading-snug">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isMatch ? 'bg-green-500' : 'bg-red-500'}`} />{h}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-2xl">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-3">AI 风险评估提示</p>
                        <ul className="space-y-2.5 text-sm text-zinc-600 font-medium">
                          {(res.risks || ["Passed screening."]).map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-2.5 leading-relaxed"><div className="w-1.5 h-1.5 bg-zinc-300 rounded-full mt-1.5 shrink-0" />{r}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="border-t border-zinc-100 pt-2">
                        <button onClick={() => toggleExpand(job.id)} className="flex items-center gap-1.5 text-[10px] text-zinc-400 hover:text-blue-600 transition-colors py-2 font-bold uppercase">
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? "隐藏简历原文" : "查看原始简历备份"}
                        </button>
                        {isExpanded && <div className="mt-2 p-4 bg-zinc-50 rounded-xl text-[10px] text-zinc-500 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto border border-zinc-100">{job.resume_text}</div>}
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