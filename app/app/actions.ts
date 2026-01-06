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

  console.log(`>>> [节点 2] 记录已生成 (ID: ${job.id})。启动 Gemini 2.5 Flash 后台分析...`);

  // 异步触发 AI 分析（不阻塞主线程，让用户立刻看到“处理中”状态）
  runAiAnalysis(job.id, formData.resumeText, formData.position).catch((err) => {
    console.error("!!! 后台异步进程报错:", err);
  });

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
    
    const prompt = `
      你是一位资深 HR 专家。请针对【${pos}】岗位分析这份简历。
      要求：仅返回 JSON 格式字符串，禁止任何 Markdown 标记或解释性文字。
      格式：{"hire_recommendation": "yes/no", "risks": ["风险点1", "风险点2"]}
      
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