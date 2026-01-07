"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function analyzeResume(formData: {
  resumeText: string;
  position: string;
  jobRequirements: string; // ⭐ 新增：具体的岗位要求
  userId: string;
}) {
  const { data: job, error: insertError } = await supabaseAdmin
    .from("jobs")
    .insert([
      {
        user_id: formData.userId,
        resume_text: formData.resumeText,
        position: formData.position,
        status: "processing",
      },
    ])
    .select()
    .single();

  if (insertError) throw new Error("数据库写入失败");

  try {
    // 传入 jobRequirements 进行比对分析
    await runAiAnalysis(job.id, formData.resumeText, formData.position, formData.jobRequirements);
  } catch (err) {
    console.error("AI 分析报错:", err);
  }

  return { jobId: job.id };
}

async function runAiAnalysis(jobId: string, text: string, pos: string, requirements: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // ⭐ 核心 Prompt 升级：对比分析逻辑
    const prompt = `
      你是一位拥有 20 年招聘经验的资深 HR 专家。
      
      【目标岗位】：${pos}
      【该岗位的具体要求（JD）】：
      ${requirements}

      【待评估候选人简历】：
      ${text}

      任务说明：
      请根据上述【具体要求】严谨评估候选人的匹配度。
      要求：仅返回 JSON 格式字符串，禁止任何 Markdown 标记。

      JSON 格式规范：
      {
        "hire_recommendation": "yes/no",
        "highlights": ["匹配亮点1", "匹配亮点2", "匹配亮点3"], 
        "risks": ["不符合要求或潜在风险点1", "风险点2"]
      }

      注意点：
      1. highlights 必须是针对 JD 的 1-3 条核心竞争力总结。
      2. 如果简历整体很强，但【完全不符合】JD 中的硬性要求，请在 hire_recommendation 中给出 "no"。
    `;

    const result = await model.generateContent(prompt);
    const aiRawText = result.response.text();
    const cleanJsonString = aiRawText.replace(/```json|```/g, "").trim();
    const jsonObject = JSON.parse(cleanJsonString);

    await supabaseAdmin
      .from("jobs")
      .update({
        status: "done",
        result: jsonObject,
      })
      .eq("id", jobId);

  } catch (error: any) {
    await supabaseAdmin
      .from("jobs")
      .update({ status: "error", error_msg: error.message || "AI 响应异常" })
      .eq("id", jobId);
  }
}