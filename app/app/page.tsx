"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { analyzeResume } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Loader2, Send, History, LogOut, CheckCircle2, XCircle, 
  ChevronDown, ChevronUp, PlusCircle, Target, FileText, 
  Edit3, Sparkles, Cpu, User, Trash2, FileSearch, 
  UploadCloud, Mail, Phone, Copy 
} from "lucide-react";

export default function AppPage() {
  const [user, setUser] = useState<any>(null);
  const [resume, setResume] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileReq, setNewProfileReq] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------- 功能函数 ----------------

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveProfile = async () => {
    if (!newProfileName.trim() || !newProfileReq.trim()) {
      return toast.error("请填写完整的岗位名称和要求");
    }
    if (!user?.id) return toast.error("登录状态异常，请重新登录");

    try {
      if (editingProfileId) {
        const { error } = await supabase
          .from("job_profiles")
          .update({ name: newProfileName, requirements: newProfileReq })
          .eq("id", editingProfileId);

        if (error) throw error;
        toast.success("岗位画像更新成功");
      } else {
        const { data, error } = await supabase
          .from("job_profiles")
          .insert([{ name: newProfileName, requirements: newProfileReq, user_id: user.id }])
          .select()
          .single();

        if (error) throw error;
        setProfiles([data, ...profiles]);
        toast.success("新岗位画像已存入云端");
      }
      setIsAddingProfile(false);
      setEditingProfileId(null);
      setNewProfileName("");
      setNewProfileReq("");
      fetchProfiles();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "保存失败，请检查权限");
    }
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
      if (data.user) { fetchProfiles(); fetchJobs(); }
    });
    const channel = supabase.channel("sync").on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => fetchJobs()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    if (!text || text === "未提取") return toast.error("无内容可复制");
    navigator.clipboard.writeText(text);
    toast.success(`${label}已复制到剪贴板`);
  };

  const executeDelete = async (id: string) => {
    setJobs(jobs.filter(j => j.id !== id));
    setDeletingId(null);
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) { fetchJobs(); toast.error("删除失败"); } else { toast.success("记录已移除"); }
  };

  const processAnalysis = async (content: string, fileName?: string) => {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return toast.error("请先选择或创建一个对标岗位");
    try {
      await analyzeResume({ 
        resumeText: content, 
        position: profile.name, 
        jobRequirements: profile.requirements, 
        userId: user.id 
      });
    } catch (e) {
      toast.error(fileName ? `${fileName} 处理失败` : "分析任务提交失败");
    }
  };

  const handleBatchFiles = async (files: FileList | File[]) => {
    setLoading(true);
    const fileArray = Array.from(files);
    toast.info(`流水线启动：正在处理 ${fileArray.length} 份文件...`);
    for (const file of fileArray) {
      const text = await file.text();
      await processAnalysis(text, file.name);
    }
    setLoading(false);
    toast.success("所有简历已提交 AI 处理");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleManualSubmit = async () => {
    if (!resume.trim()) return toast.error("请粘贴简历内容或拖入文件");
    setLoading(true);
    await processAnalysis(resume);
    setResume("");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] selection:bg-blue-100">
      <nav className="border-b bg-white/80 backdrop-blur-md p-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200"><FileSearch className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="font-bold text-xl text-slate-900 tracking-tight">AI Resume Reviewer</h1>
            <p className="text-[10px] text-blue-600 font-bold flex items-center gap-1 uppercase tracking-widest"><Cpu className="w-3 h-3" /> Gemini Pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-slate-600 truncate max-w-[200px]">{user.email}</span>
            </div>
          )}
          <Button variant="ghost" size="sm" className="hover:bg-red-50 hover:text-red-600" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}>
            <LogOut className="w-4 h-4 mr-2" /> 退出
          </Button>
        </div>
      </nav>

      <main className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-6">
          {/* 岗位画像卡片 */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-base font-bold text-slate-800">岗位画像定义</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setIsAddingProfile(!isAddingProfile); setEditingProfileId(null); setNewProfileName(""); setNewProfileReq(""); }}>
                  {isAddingProfile ? "取消" : <PlusCircle className="w-4 h-4 mr-1" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isAddingProfile ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <p className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1"><Sparkles className="w-3 h-3" /> {editingProfileId ? "正在重校画像" : "定义新标准"}</p>
                  <input placeholder="岗位名称 (如: Senior Data Analyst)" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} />
                  <Textarea placeholder="输入画像具体对标要求..." className="h-32 text-sm border-slate-200" value={newProfileReq} onChange={(e) => setNewProfileReq(e.target.value)} />
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 h-11 font-bold" onClick={handleSaveProfile}>确认并保存</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                      <SelectTrigger className="h-11 border-slate-200 w-full"><SelectValue placeholder="请选择对标岗位画像" /></SelectTrigger>
                      <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {selectedProfileId && (
                      <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 border-slate-200 hover:text-blue-600" onClick={() => {
                        const p = profiles.find(x => x.id === selectedProfileId);
                        if(p) { setEditingProfileId(p.id); setNewProfileName(p.name); setNewProfileReq(p.requirements); setIsAddingProfile(true); }
                      }}><Edit3 className="w-4 h-4" /></Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 简历内容卡片 */}
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-base font-bold text-slate-800">简历原文内容</CardTitle>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,.txt" onChange={(e) => e.target.files && handleBatchFiles(e.target.files)} />
              <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-blue-600 uppercase" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="w-3.5 h-3.5 mr-1" /> 批量上传
              </Button>
            </CardHeader>
            
            <CardContent className="pt-6 space-y-4">
              {/* ✨ 优化后的拖拽窗口区域 ✨ */}
              <div 
                className={`relative rounded-xl border-2 transition-all duration-300 group
                  ${isDragging ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' : 'border-transparent'}
                `}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragLeave={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
                    setIsDragging(false);
                  }
                }}
                onDrop={async (e) => { 
                  e.preventDefault(); e.stopPropagation(); setIsDragging(false); 
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) await handleBatchFiles(e.dataTransfer.files); 
                }}
              >
                {/* 仅在此区域显示的动画层 */}
                {isDragging && (
                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-blue-600/10 backdrop-blur-[2px] rounded-lg border-2 border-blue-500 border-dashed animate-in fade-in duration-200 pointer-events-none">
                    <UploadCloud className="w-12 h-12 text-blue-600 animate-bounce" />
                    <p className="text-blue-700 font-bold mt-2 tracking-widest uppercase text-[10px]">Drop to Process</p>
                  </div>
                )}

                <Textarea 
                  placeholder="在此直接粘贴，或拖拽简历文件到此处..." 
                  className={`h-[400px] bg-transparent resize-none text-sm border-slate-200 focus:ring-2 focus:ring-blue-500/20 custom-scrollbar transition-opacity
                    ${isDragging ? 'opacity-20 pointer-events-none' : 'opacity-100'}
                  `}
                  value={resume} 
                  onChange={(e) => setResume(e.target.value)} 
                />
              </div>

              <Button className="w-full bg-slate-900 hover:bg-slate-800 h-12 text-lg font-black shadow-lg transition-all active:scale-[0.98]" onClick={handleManualSubmit} disabled={loading || !selectedProfileId}>
                {loading ? <><Loader2 className="mr-2 animate-spin" />正在扫描...</> : <><Send className="mr-2 w-5 h-5" />开启 AI 评估</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧列表区域 */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 px-1 uppercase tracking-widest text-[10px] font-bold text-slate-400">
            <div className="flex items-center gap-2"><History className="w-4 h-4" /> Analysis Pipeline</div>
            <div className="bg-slate-100 px-2 py-0.5 rounded-full">{jobs.length} Records</div>
          </div>
          
          <div className="space-y-6 lg:h-[845px] overflow-y-auto pr-2 pb-10 custom-scrollbar">
            {jobs.map((job) => {
              const res = job.result || {};
              const isMatch = res.hire_recommendation === 'yes';
              const isExpanded = expandedIds.has(job.id);
              const isConfirming = deletingId === job.id;

              return (
                <Card key={job.id} className={`group border transition-all duration-300 relative ${isConfirming ? 'border-red-500 scale-[0.98] shadow-lg' : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md'}`}>
                  <div className="absolute top-4 right-4 z-20">
                    {isConfirming ? (
                      <div className="flex gap-1 animate-in slide-in-from-right-2">
                        <Button size="sm" variant="destructive" className="h-7 text-[10px] font-bold" onClick={() => executeDelete(job.id)}>确认</Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setDeletingId(null)}>取消</Button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingId(job.id)} className="p-2 text-slate-300 hover:text-red-500 transition-opacity opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>

                  <CardContent className={`pt-6 ${isConfirming ? 'opacity-30 grayscale' : 'opacity-100'}`}>
                    <div className="flex justify-between items-start mb-6 pr-12">
                      <div className="space-y-1">
                        <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tight">{res.name || "未提取姓名"}</h3>
                        <div className="flex flex-wrap gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                          <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {job.position}</span>
                          <button onClick={() => copyToClipboard(res.email, "邮箱")} className="flex items-center gap-1 hover:text-blue-600"><Mail className="w-3 h-3" /> {res.email || "N/A"}</button>
                          <button onClick={() => copyToClipboard(res.phone, "电话")} className="flex items-center gap-1 hover:text-blue-600"><Phone className="w-3 h-3" /> {res.phone || "N/A"}</button>
                        </div>
                      </div>
                      <div className={`p-2 rounded-full ${isMatch ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                         {isMatch ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className={`p-5 rounded-2xl border transition-all duration-500 ${isMatch ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
                        <p className="text-[9px] font-black uppercase mb-3 opacity-50 tracking-widest">{isMatch ? 'Match Highlights' : 'Resume Focus'}</p>
                        <ul className="space-y-3">
                          {(res.highlights || []).map((h: string, i: number) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm font-semibold leading-snug">
                              <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${isMatch ? 'bg-green-500' : 'bg-red-500'}`} />{h}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-3 tracking-widest">Risk Assessment</p>
                        <ul className="space-y-2.5 text-sm text-slate-600 font-medium leading-relaxed">
                          {(res.risks || ["No major risks found."]).map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-2.5"><span className="w-1.5 h-1.5 bg-slate-300 rounded-full mt-2 shrink-0" />{r}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <button onClick={() => toggleExpand(job.id)} className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase transition-colors">
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? "Hide Source" : "Review Source"}
                        </button>
                        {isExpanded && <div className="mt-3 p-4 bg-slate-100 rounded-xl text-[10px] text-slate-500 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed animate-in slide-in-from-top-1">{job.resume_text}</div>}
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