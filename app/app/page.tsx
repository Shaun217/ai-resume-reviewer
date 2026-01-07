"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { analyzeResume } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, History, LogOut, CheckCircle2, ChevronDown, ChevronUp, PlusCircle, Briefcase, FileText, Edit2 } from "lucide-react";

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
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null); // ⭐ 新增：记录正在编辑的岗位ID
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileReq, setNewProfileReq] = useState("");

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

  // ⭐ 新增：进入编辑模式
  const startEditing = () => {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (profile) {
      setEditingProfileId(profile.id);
      setNewProfileName(profile.name);
      setNewProfileReq(profile.requirements);
      setIsAddingProfile(true);
    }
  };

  // ⭐ 修改：统一处理保存和更新
  const handleSaveProfile = async () => {
    if (!newProfileName || !newProfileReq) return toast.error("请填写完整岗位信息");

    if (editingProfileId) {
      // 执行更新逻辑
      const { error } = await supabase
        .from("job_profiles")
        .update({ name: newProfileName, requirements: newProfileReq })
        .eq("id", editingProfileId);

      if (error) return toast.error("更新失败");
      toast.success("岗位画像已更新");
    } else {
      // 执行新增逻辑
      const { data, error } = await supabase.from("job_profiles").insert([
        { name: newProfileName, requirements: newProfileReq, user_id: user.id }
      ]).select().single();

      if (error) return toast.error("保存失败");
      setProfiles([data, ...profiles]);
      toast.success("岗位画像已保存");
    }

    // 重置状态
    fetchProfiles();
    setIsAddingProfile(false);
    setEditingProfileId(null);
    setNewProfileName("");
    setNewProfileReq("");
  };

  const handleSubmit = async () => {
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
    if (!selectedProfile) return toast.error("请先选择一个岗位画像");
    if (!resume.trim()) return toast.error("请粘贴简历内容");

    setLoading(true);
    try {
      await analyzeResume({ 
        resumeText: resume, 
        position: selectedProfile.name, 
        jobRequirements: selectedProfile.requirements, 
        userId: user.id 
      });
      toast.success("分析任务已提交");
      setResume("");
    } catch (e) {
      toast.error("提交失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <nav className="border-b bg-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <h1 className="font-bold text-xl flex items-center gap-2 text-zinc-900">
          <div className="w-2 h-6 bg-blue-600 rounded-full" /> AI Resume Reviewer
        </h1>
        <Button variant="ghost" size="sm" onClick={() => { supabase.auth.signOut(); window.location.href = "/"; }}>
          <LogOut className="w-4 h-4 mr-2" /> 退出
        </Button>
      </nav>

      <main className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左侧控制区 */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="border-b border-zinc-100 pb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-lg">岗位画像画像</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  setIsAddingProfile(!isAddingProfile);
                  setEditingProfileId(null); // 关闭编辑状态
                  setNewProfileName("");
                  setNewProfileReq("");
                }}>
                  {isAddingProfile ? "取消" : <PlusCircle className="w-4 h-4 mr-1" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isAddingProfile ? (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-blue-600 uppercase">{editingProfileId ? "正在修改岗位" : "新增岗位画像"}</p>
                  <input 
                    placeholder="岗位名称 (例如: 数据分析师)" 
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                  />
                  <Textarea 
                    placeholder="请输入该岗位的详细要求 (JD)..." 
                    className="h-32 text-sm bg-zinc-50 border-zinc-200"
                    value={newProfileReq}
                    onChange={(e) => setNewProfileReq(e.target.value)}
                  />
                  <Button className="w-full bg-blue-600" onClick={handleSaveProfile}>
                    {editingProfileId ? "确认更新画像" : "保存画像模板"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                      <SelectTrigger className="h-11 border-zinc-200 flex-1"><SelectValue placeholder="选择目标岗位画像" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* ⭐ 编辑按钮：只有选中岗位后才显示 */}
                    {selectedProfileId && (
                      <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={startEditing}>
                        <Edit2 className="w-4 h-4 text-zinc-500" />
                      </Button>
                    )}
                  </div>
                  {selectedProfileId && (
                    <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-blue-700">
                      <p className="font-bold mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> 当前选定画像要求：</p>
                      <p className="opacity-80 line-clamp-3">{profiles.find(p => p.id === selectedProfileId)?.requirements}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="pb-3"><CardTitle className="text-lg text-zinc-800">简历原文</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="粘贴简历文本..." 
                className="h-[400px] bg-zinc-50/50 resize-none text-sm border-zinc-200"
                value={resume}
                onChange={(e) => setResume(e.target.value)}
              />
              <Button className="w-full bg-zinc-900 hover:bg-zinc-800 h-12 text-lg font-bold" onClick={handleSubmit} disabled={loading || !selectedProfileId}>
                {loading ? <><Loader2 className="mr-2 animate-spin" />分析中...</> : <><Send className="mr-2 w-5 h-5" />开始 AI 分析</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧结果（保持之前的逻辑） */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-bold text-zinc-500 flex items-center gap-2 uppercase tracking-wider text-xs">
            <History className="w-4 h-4" /> 分析历史记录
          </h2>
          <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 pb-10 custom-scrollbar">
            {jobs.map((job) => {
              const res = job.result || {};
              const isMatch = res.hire_recommendation === 'yes';
              const isExpanded = expandedIds.has(job.id);
              return (
                <Card key={job.id} className="border-none shadow-sm ring-1 ring-zinc-200 overflow-hidden bg-white hover:shadow-md transition-all">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="font-bold text-xl text-zinc-800">{job.position}</h3>
                        <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest">
                          分析完成时间: {new Date(job.created_at).toLocaleString('zh-CN', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', hour12: false
                          })}
                        </p>
                      </div>
                      <CheckCircle2 className={isMatch ? "text-green-500 w-6 h-6" : "text-zinc-300 w-6 h-6"} />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className={`p-5 rounded-2xl border ${isMatch ? 'bg-green-50/50 border-green-100 text-green-900' : 'bg-red-50/50 border-red-100 text-red-900'}`}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-1 opacity-60">录取建议</p>
                        <p className="text-2xl font-black mb-4">{isMatch ? '✅ 建议安排面试' : '⚪ 暂不匹配岗位'}</p>
                        {(res.highlights || []).length > 0 && (
                          <div className={`pt-4 border-t ${isMatch ? 'border-green-200' : 'border-red-200'}`}>
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-2 opacity-60">{isMatch ? '核心匹配亮点' : '简历重点分析'}</p>
                            <ul className="space-y-2">
                              {res.highlights.map((h: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm font-medium">
                                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isMatch ? 'bg-green-500' : 'bg-red-500'}`} />{h}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-2xl">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-3">AI 风险评估提示</p>
                        <ul className="space-y-2">
                          {(res.risks || ["暂无明显硬性风险点"]).map((r: string, i: number) => (
                            <li key={i} className="text-sm text-zinc-600 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full mt-1.5 shrink-0" />{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="border-t border-zinc-100 pt-2">
                        <button onClick={() => toggleExpand(job.id)} className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-blue-600 py-2">
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? "隐藏简历原文" : "查看原始简历备份"}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 p-4 bg-zinc-50 rounded-xl text-[11px] text-zinc-500 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto border border-zinc-100">
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