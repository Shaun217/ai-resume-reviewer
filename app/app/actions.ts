"use server"; // 必须在文件第一行

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// 1. 初始化后端 Admin 客户端
// 确保使用 SERVICE_ROLE_KEY，这是跨越 RLS 权限回写分析结果的关键
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 初始化 Google AI SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * 主函数：前端点击提交按钮时触发
 */
export async function analyzeResume(formData: {
  resumeText: string;
  position: string;
  userId: string;
}) {
  console.log(">>> [节点 1] 收到请求，准备写入 Supabase...");

  // 在 jobs 表中创建初始记录
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

  if (insertError) {
    console.error("!!! 数据库写入失败:", insertError);
    throw new Error("数据库写入失败");
  }

  console.log(`>>> [节点 2] 记录已生成 (ID: ${job.id})。启动 AI 实时分析...`);

  // ⭐ 关键修改：添加 await，确保 Vercel 不会在 AI 运行完之前杀掉进程
  try {
    await runAiAnalysis(job.id, formData.resumeText, formData.position);
    console.log(">>> [节点 8] AI 分析与回写全部完成。");
  } catch (err) {
    console.error("!!! AI 分析阶段报错:", err);
    // 这里不需要 throw，因为我们在 runAiAnalysis 内部已经处理了错误状态更新
  }

  return { jobId: job.id };
}

/**
 * 后台异步分析逻辑：调用 Gemini 2.5 Flash 并将结果回写至数据库
 */
async function runAiAnalysis(jobId: string, text: string, pos: string) {
  try {
    console.log(">>> [节点 3] 正在建立连接，调用模型: gemini-2.5-flash");

    // ⭐ 核心修改：指定调用 gemini-2.5-flash 模型
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // 在 runAiAnalysis 函数中修改 prompt
      const prompt = `
      你是一位资深 HR 专家。请针对【${pos}】岗位分析这份简历。
      要求：仅返回 JSON 格式字符串，禁止任何 Markdown 标记或解释性文字。

      JSON 格式规范：
      {
        "hire_recommendation": "yes/no",
        "highlights": ["亮点1", "亮点2", "亮点3"], 
        "risks": ["风险点1", "风险点2"]
      }

      注意：
      1. highlights 必须是 1-3 条最核心的竞争力总结。
      2. hire_recommendation 为 yes 时建议安排面试，no 为暂不匹配。

      简历内容：
      ${text}
      `;

    console.log(">>> [节点 4] 正在向 Google 发起请求...");
    const result = await model.generateContent(prompt);
    const aiRawText = result.response.text();
    
    console.log(">>> [节点 5] AI 成功返回，原始结果:", aiRawText);

    // 清洗 JSON 字符串（过滤掉 AI 可能自带的 Markdown 语法块）
    const cleanJsonString = aiRawText.replace(/```json|```/g, "").trim();
    const jsonObject = JSON.parse(cleanJsonString);

    // 将结果更新回 Supabase 的 result (jsonb) 字段
    console.log(">>> [节点 6] 解析成功，正在回写至数据库...");
    const { error: updateError } = await supabaseAdmin
      .from("jobs")
      .update({
        status: "done",
        result: jsonObject,
      })
      .eq("id", jobId);

    if (updateError) throw updateError;
    console.log(`>>> [节点 7] 任务 ${jobId} 状态已更新为 done，流程结束。`);

  } catch (error: any) {
    console.error(`>>> [异常中断] 任务 ${jobId} 分析失败:`, error.message);
    
    // 即使失败也要更新状态，确保前端显示错误信息而不是无限转圈
    await supabaseAdmin
      .from("jobs")
      .update({ 
        status: "error", 
        error_msg: error.message || "AI 响应异常" 
      })
      .eq("id", jobId);
  }
}